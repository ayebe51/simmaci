<?php

namespace Tests\Unit;

use App\Http\Controllers\Api\SkDocumentController;
use App\Models\Notification;
use App\Models\School;
use App\Models\SkDocument;
use App\Models\Teacher;
use App\Models\User;
use App\Services\NormalizationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Tests\TestCase;

/**
 * Exploratory tests for notification bugs in SkDocumentController.
 *
 * These tests document the CURRENT (buggy) behavior and are expected to PASS
 * on unfixed code — proving the bugs exist. After fixes are applied in tasks 2–4,
 * these exploratory tests will FAIL (which is expected — they'll be superseded by
 * fix-checking tests).
 */
class SkDocumentNotificationTest extends TestCase
{
    use RefreshDatabase;

    private SkDocumentController $controller;

    protected function setUp(): void
    {
        parent::setUp();
        $normalizationService = $this->app->make(NormalizationService::class);
        $this->controller = new SkDocumentController($normalizationService);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Task 1.1 — Bug 1: processBulkRequestSync does NOT notify admins
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * EXPLORATORY — Bug 1: Bulk sync with 2 documents does NOT create sk_bulk_submitted notification.
     *
     * This test PASSES on unfixed code, proving the bug exists.
     * After Bug 1 is fixed, this test will FAIL (expected).
     *
     * Requirements: 1.1, 1.2
     */
    public function test_bulk_sync_with_2_documents_does_not_create_notification(): void
    {
        // Arrange: create an admin who should receive the notification
        $admin = User::factory()->create(['role' => 'super_admin', 'school_id' => null]);

        // Create a school and an operator
        $school = School::factory()->create(['nama' => 'MI Test Sekolah']);
        $operator = User::factory()->create([
            'role'      => 'operator',
            'school_id' => $school->id,
            'email'     => 'operator@test.com',
        ]);

        // Create two teachers for the bulk request
        $teacher1 = Teacher::factory()->create(['school_id' => $school->id, 'nama' => 'Guru Satu']);
        $teacher2 = Teacher::factory()->create(['school_id' => $school->id, 'nama' => 'Guru Dua']);

        // Build a request with 2 documents (triggers processBulkRequestSync)
        $request = Request::create('/api/sk-documents/bulk-request', 'POST', [
            'surat_permohonan_url' => 'https://example.com/surat.pdf',
            'documents' => [
                [
                    'nama'      => $teacher1->nama,
                    'jenis_sk'  => 'GTY',
                    'unit_kerja' => $school->nama,
                    'status_kepegawaian' => 'GTY',
                ],
                [
                    'nama'      => $teacher2->nama,
                    'jenis_sk'  => 'GTY',
                    'unit_kerja' => $school->nama,
                    'status_kepegawaian' => 'GTY',
                ],
            ],
        ]);
        $request->setUserResolver(fn() => $operator);

        $notificationCountBefore = Notification::count();

        // Act: call bulkRequest (which routes to processBulkRequestSync for ≤3 docs)
        $response = $this->controller->bulkRequest($request);

        // Assert: the response is successful
        $responseData = $response->getData(true);
        $this->assertTrue($responseData['success'] ?? false, 'bulkRequest should succeed');

        // Assert (Bug 1): NO sk_bulk_submitted notification was created for the admin
        // This assertion PASSES on unfixed code — proving the bug exists.
        $notificationCountAfter = Notification::count();
        $this->assertEquals(
            $notificationCountBefore,
            $notificationCountAfter,
            'BUG 1 CONFIRMED: processBulkRequestSync does NOT create any notifications (expected on unfixed code)'
        );

        // More specific: assert no sk_bulk_submitted notification exists
        $this->assertDatabaseMissing('notifications', [
            'type' => 'sk_bulk_submitted',
        ]);
    }

    /**
     * EXPLORATORY — Bug 1: Bulk sync with 3 documents also does NOT create notification.
     *
     * Requirements: 1.1, 1.2
     */
    public function test_bulk_sync_with_3_documents_does_not_create_notification(): void
    {
        // Arrange
        $admin = User::factory()->create(['role' => 'admin_yayasan', 'school_id' => null]);
        $school = School::factory()->create(['nama' => 'MTs Test Sekolah']);
        $operator = User::factory()->create([
            'role'      => 'operator',
            'school_id' => $school->id,
        ]);

        $teachers = Teacher::factory()->count(3)->create(['school_id' => $school->id]);

        $documents = $teachers->map(fn($t) => [
            'nama'               => $t->nama,
            'jenis_sk'           => 'GTY',
            'unit_kerja'         => $school->nama,
            'status_kepegawaian' => 'GTY',
        ])->toArray();

        $request = Request::create('/api/sk-documents/bulk-request', 'POST', [
            'surat_permohonan_url' => 'https://example.com/surat.pdf',
            'documents'            => $documents,
        ]);
        $request->setUserResolver(fn() => $operator);

        // Act
        $this->controller->bulkRequest($request);

        // Assert (Bug 1): still no notification
        $this->assertDatabaseMissing('notifications', [
            'type' => 'sk_bulk_submitted',
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Task 1.2 — Bug 2: created_by null/not found prevents notification delivery
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * EXPLORATORY — Bug 2 Case A: SK with created_by = null does NOT create notification on approval.
     *
     * This test PASSES on unfixed code, proving the bug exists.
     * After Bug 2 is fixed, this test will FAIL (expected).
     *
     * Requirements: 1.3
     */
    public function test_approve_sk_with_null_created_by_does_not_create_notification(): void
    {
        // Arrange: create an admin (approver) and a school with an operator
        $admin = User::factory()->create(['role' => 'super_admin', 'school_id' => null]);
        $school = School::factory()->create();
        $operator = User::factory()->create([
            'role'      => 'operator',
            'school_id' => $school->id,
        ]);

        // Create an SK document with created_by = null (simulates import or admin-created SK)
        $skDocument = SkDocument::factory()->create([
            'status'     => 'pending',
            'created_by' => null,
            'school_id'  => $school->id,
        ]);

        $notificationCountBefore = Notification::count();

        // Build update request to change status to 'approved'
        $request = Request::create("/api/sk-documents/{$skDocument->id}", 'PUT', [
            'status' => 'approved',
        ]);
        $request->setUserResolver(fn() => $admin);

        // Act: call update() to approve the SK
        $response = $this->controller->update($request, $skDocument);

        // Assert (Bug 2 Case A): NO notification was created because created_by is null
        // The guard `&& $skDocument->created_by` prevents notification when created_by is null.
        // This assertion PASSES on unfixed code — proving the bug exists.
        $notificationCountAfter = Notification::count();
        $this->assertEquals(
            $notificationCountBefore,
            $notificationCountAfter,
            'BUG 2 CONFIRMED (Case A): No notification created when created_by is null (expected on unfixed code)'
        );

        $this->assertDatabaseMissing('notifications', [
            'type' => 'sk_approved',
        ]);
    }

    /**
     * EXPLORATORY — Bug 2 Case B: SK with created_by = nonexistent email does NOT create notification.
     *
     * This test PASSES on unfixed code, proving the bug exists.
     * After Bug 2 is fixed, this test will FAIL (expected).
     *
     * Requirements: 1.3
     */
    public function test_approve_sk_with_nonexistent_created_by_does_not_create_notification(): void
    {
        // Arrange
        $admin = User::factory()->create(['role' => 'super_admin', 'school_id' => null]);
        $school = School::factory()->create();
        $operator = User::factory()->create([
            'role'      => 'operator',
            'school_id' => $school->id,
        ]);

        // SK with a created_by email that does NOT exist in the users table
        $skDocument = SkDocument::factory()->create([
            'status'     => 'pending',
            'created_by' => 'nonexistent@email.com',
            'school_id'  => $school->id,
        ]);

        $notificationCountBefore = Notification::count();

        $request = Request::create("/api/sk-documents/{$skDocument->id}", 'PUT', [
            'status' => 'approved',
        ]);
        $request->setUserResolver(fn() => $admin);

        // Act
        $this->controller->update($request, $skDocument);

        // Assert (Bug 2 Case B): NO notification created because User::where('email', ...) returns null
        // This assertion PASSES on unfixed code — proving the bug exists.
        $notificationCountAfter = Notification::count();
        $this->assertEquals(
            $notificationCountBefore,
            $notificationCountAfter,
            'BUG 2 CONFIRMED (Case B): No notification created when created_by email not found (expected on unfixed code)'
        );

        $this->assertDatabaseMissing('notifications', [
            'type' => 'sk_approved',
        ]);
    }

    /**
     * EXPLORATORY — Bug 2 Case B (rejection): SK with nonexistent created_by also fails for rejection.
     *
     * Requirements: 1.3
     */
    public function test_reject_sk_with_nonexistent_created_by_does_not_create_notification(): void
    {
        // Arrange
        $admin = User::factory()->create(['role' => 'super_admin', 'school_id' => null]);
        $school = School::factory()->create();
        $operator = User::factory()->create([
            'role'      => 'operator',
            'school_id' => $school->id,
        ]);

        $skDocument = SkDocument::factory()->create([
            'status'     => 'pending',
            'created_by' => 'deleted.user@example.com',
            'school_id'  => $school->id,
        ]);

        $notificationCountBefore = Notification::count();

        $request = Request::create("/api/sk-documents/{$skDocument->id}", 'PUT', [
            'status'           => 'rejected',
            'rejection_reason' => 'Dokumen tidak lengkap',
        ]);
        $request->setUserResolver(fn() => $admin);

        // Act
        $this->controller->update($request, $skDocument);

        // Assert: no sk_rejected notification created
        $notificationCountAfter = Notification::count();
        $this->assertEquals(
            $notificationCountBefore,
            $notificationCountAfter,
            'BUG 2 CONFIRMED: No notification created for rejection when created_by not found (expected on unfixed code)'
        );

        $this->assertDatabaseMissing('notifications', [
            'type' => 'sk_rejected',
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Task 2.2 — Fix-checking tests for Bug 1
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * FIX-CHECKING — Bug 1: After fix, bulk sync with 1 document creates sk_bulk_submitted notification.
     *
     * This test FAILS on unfixed code and PASSES after Bug 1 is fixed.
     *
     * Requirements: 2.1, 2.2
     */
    public function test_bulk_sync_with_1_document_creates_notification_after_fix(): void
    {
        // Arrange
        $admin = User::factory()->create(['role' => 'super_admin', 'school_id' => null]);
        $school = School::factory()->create(['nama' => 'MI Test Sekolah']);
        $operator = User::factory()->create([
            'role'      => 'operator',
            'school_id' => $school->id,
            'email'     => 'operator@test.com',
        ]);

        $teacher = Teacher::factory()->create(['school_id' => $school->id, 'nama' => 'Guru Satu']);

        $request = Request::create('/api/sk-documents/bulk-request', 'POST', [
            'surat_permohonan_url' => 'https://example.com/surat.pdf',
            'documents' => [
                [
                    'nama'               => $teacher->nama,
                    'jenis_sk'           => 'GTY',
                    'unit_kerja'         => $school->nama,
                    'status_kepegawaian' => 'GTY',
                ],
            ],
        ]);
        $request->setUserResolver(fn() => $operator);

        // Act
        $response = $this->controller->bulkRequest($request);

        // Assert: sk_bulk_submitted notification was created for the admin
        $this->assertDatabaseHas('notifications', [
            'user_id' => $admin->id,
            'type'    => 'sk_bulk_submitted',
        ]);

        // Assert: notification message contains correct counts
        $notification = Notification::where('user_id', $admin->id)
            ->where('type', 'sk_bulk_submitted')
            ->first();

        $this->assertNotNull($notification);
        $this->assertStringContainsString('1 permohonan menunggu verifikasi', $notification->message);
        $this->assertEquals(1, $notification->metadata['created']);
        $this->assertEquals(0, $notification->metadata['skipped']);
    }

    /**
     * FIX-CHECKING — Bug 1: After fix, bulk sync with 2 documents creates notification for all admins.
     *
     * Requirements: 2.1, 2.2
     */
    public function test_bulk_sync_with_2_documents_creates_notification_for_all_admins_after_fix(): void
    {
        // Arrange: create multiple admins
        $superAdmin = User::factory()->create(['role' => 'super_admin', 'school_id' => null]);
        $adminYayasan = User::factory()->create(['role' => 'admin_yayasan', 'school_id' => null]);

        $school = School::factory()->create(['nama' => 'MTs Test Sekolah']);
        $operator = User::factory()->create([
            'role'      => 'operator',
            'school_id' => $school->id,
        ]);

        $teachers = Teacher::factory()->count(2)->create(['school_id' => $school->id]);

        $documents = $teachers->map(fn($t) => [
            'nama'               => $t->nama,
            'jenis_sk'           => 'GTY',
            'unit_kerja'         => $school->nama,
            'status_kepegawaian' => 'GTY',
        ])->toArray();

        $request = Request::create('/api/sk-documents/bulk-request', 'POST', [
            'surat_permohonan_url' => 'https://example.com/surat.pdf',
            'documents'            => $documents,
        ]);
        $request->setUserResolver(fn() => $operator);

        // Act
        $this->controller->bulkRequest($request);

        // Assert: both admins received the notification
        $this->assertDatabaseHas('notifications', [
            'user_id' => $superAdmin->id,
            'type'    => 'sk_bulk_submitted',
        ]);

        $this->assertDatabaseHas('notifications', [
            'user_id' => $adminYayasan->id,
            'type'    => 'sk_bulk_submitted',
        ]);

        // Assert: message contains correct count
        $notification = Notification::where('user_id', $superAdmin->id)
            ->where('type', 'sk_bulk_submitted')
            ->first();

        $this->assertStringContainsString('2 permohonan menunggu verifikasi', $notification->message);
    }

    /**
     * FIX-CHECKING — Bug 1: After fix, bulk sync with 3 documents creates notification.
     *
     * Requirements: 2.1, 2.2
     */
    public function test_bulk_sync_with_3_documents_creates_notification_after_fix(): void
    {
        // Arrange
        $admin = User::factory()->create(['role' => 'super_admin', 'school_id' => null]);
        $school = School::factory()->create(['nama' => 'MA Test Sekolah']);
        $operator = User::factory()->create([
            'role'      => 'operator',
            'school_id' => $school->id,
        ]);

        $teachers = Teacher::factory()->count(3)->create(['school_id' => $school->id]);

        $documents = $teachers->map(fn($t) => [
            'nama'               => $t->nama,
            'jenis_sk'           => 'GTY',
            'unit_kerja'         => $school->nama,
            'status_kepegawaian' => 'GTY',
        ])->toArray();

        $request = Request::create('/api/sk-documents/bulk-request', 'POST', [
            'surat_permohonan_url' => 'https://example.com/surat.pdf',
            'documents'            => $documents,
        ]);
        $request->setUserResolver(fn() => $operator);

        // Act
        $this->controller->bulkRequest($request);

        // Assert: notification created
        $this->assertDatabaseHas('notifications', [
            'user_id' => $admin->id,
            'type'    => 'sk_bulk_submitted',
        ]);

        $notification = Notification::where('user_id', $admin->id)
            ->where('type', 'sk_bulk_submitted')
            ->first();

        $this->assertStringContainsString('3 permohonan menunggu verifikasi', $notification->message);
        $this->assertEquals(3, $notification->metadata['created']);
    }

    /**
     * FIX-CHECKING — Bug 1: Notification message includes skipped count when applicable.
     *
     * Requirements: 2.1, 2.2
     */
    public function test_bulk_sync_notification_includes_skipped_count(): void
    {
        // Arrange
        $admin = User::factory()->create(['role' => 'super_admin', 'school_id' => null]);
        $school = School::factory()->create(['nama' => 'MI Test Sekolah']);
        $operator = User::factory()->create([
            'role'      => 'operator',
            'school_id' => $school->id,
        ]);

        // Create one valid teacher and one PNS (will be skipped)
        $validTeacher = Teacher::factory()->create(['school_id' => $school->id, 'nama' => 'Guru Valid']);

        $request = Request::create('/api/sk-documents/bulk-request', 'POST', [
            'surat_permohonan_url' => 'https://example.com/surat.pdf',
            'documents' => [
                [
                    'nama'               => $validTeacher->nama,
                    'jenis_sk'           => 'GTY',
                    'unit_kerja'         => $school->nama,
                    'status_kepegawaian' => 'GTY',
                ],
                [
                    'nama'               => 'Guru PNS',
                    'nip'                => '123456789012345678', // 18 digits = PNS
                    'jenis_sk'           => 'PNS',
                    'unit_kerja'         => $school->nama,
                    'status_kepegawaian' => 'PNS',
                ],
            ],
        ]);
        $request->setUserResolver(fn() => $operator);

        // Act
        $this->controller->bulkRequest($request);

        // Assert: notification message includes skipped count
        $notification = Notification::where('user_id', $admin->id)
            ->where('type', 'sk_bulk_submitted')
            ->first();

        $this->assertNotNull($notification);
        $this->assertStringContainsString('1 permohonan menunggu verifikasi', $notification->message);
        $this->assertStringContainsString('1 dilewati', $notification->message);
        $this->assertEquals(1, $notification->metadata['created']);
        $this->assertEquals(1, $notification->metadata['skipped']);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Task 3.4 — Fix-checking tests for Bug 2
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * FIX-CHECKING — Bug 2 Case A: After fix, SK with created_by = null sends notification via fallback.
     *
     * This test FAILS on unfixed code and PASSES after Bug 2 is fixed.
     *
     * Requirements: 2.3
     */
    public function test_approve_sk_with_null_created_by_sends_notification_via_fallback(): void
    {
        // Arrange: create an admin (approver) and a school with an operator
        $admin = User::factory()->create(['role' => 'super_admin', 'school_id' => null]);
        $school = School::factory()->create();
        $operator = User::factory()->create([
            'role'      => 'operator',
            'school_id' => $school->id,
            'email'     => 'operator@test.com',
        ]);

        // Create an SK document with created_by = null (simulates import or admin-created SK)
        $skDocument = SkDocument::factory()->create([
            'status'     => 'pending',
            'created_by' => null,
            'school_id'  => $school->id,
        ]);

        // Build update request to change status to 'approved'
        $request = Request::create("/api/sk-documents/{$skDocument->id}", 'PUT', [
            'status' => 'approved',
        ]);
        $request->setUserResolver(fn() => $admin);

        // Act: call update() to approve the SK
        $response = $this->controller->update($request, $skDocument);

        // Assert: notification WAS created via fallback to operator
        $this->assertDatabaseHas('notifications', [
            'user_id' => $operator->id,
            'type'    => 'sk_approved',
        ]);

        // Assert: notification message is correct
        $notification = Notification::where('user_id', $operator->id)
            ->where('type', 'sk_approved')
            ->first();

        $this->assertNotNull($notification);
        $this->assertStringContainsString('disetujui dan siap diterbitkan', $notification->message);
        $this->assertEquals($skDocument->id, $notification->metadata['sk_id']);
    }

    /**
     * FIX-CHECKING — Bug 2 Case B: After fix, SK with nonexistent created_by sends notification via fallback.
     *
     * Requirements: 2.3
     */
    public function test_approve_sk_with_nonexistent_created_by_sends_notification_via_fallback(): void
    {
        // Arrange
        $admin = User::factory()->create(['role' => 'super_admin', 'school_id' => null]);
        $school = School::factory()->create();
        $operator = User::factory()->create([
            'role'      => 'operator',
            'school_id' => $school->id,
            'email'     => 'current.operator@test.com',
        ]);

        // SK with a created_by email that does NOT exist in the users table
        $skDocument = SkDocument::factory()->create([
            'status'     => 'pending',
            'created_by' => 'deleted@email.com',
            'school_id'  => $school->id,
        ]);

        $request = Request::create("/api/sk-documents/{$skDocument->id}", 'PUT', [
            'status' => 'approved',
        ]);
        $request->setUserResolver(fn() => $admin);

        // Act
        $this->controller->update($request, $skDocument);

        // Assert: notification WAS created via fallback to operator
        $this->assertDatabaseHas('notifications', [
            'user_id' => $operator->id,
            'type'    => 'sk_approved',
        ]);

        $notification = Notification::where('user_id', $operator->id)
            ->where('type', 'sk_approved')
            ->first();

        $this->assertNotNull($notification);
        $this->assertStringContainsString('disetujui', $notification->message);
    }

    /**
     * FIX-CHECKING — Bug 2 Case C: After fix, SK with valid created_by still sends notification to that user.
     *
     * This verifies the primary path still works (preservation).
     *
     * Requirements: 2.3
     */
    public function test_approve_sk_with_valid_created_by_sends_notification_to_creator(): void
    {
        // Arrange
        $admin = User::factory()->create(['role' => 'super_admin', 'school_id' => null]);
        $school = School::factory()->create();
        
        // Create the original creator user
        $creator = User::factory()->create([
            'role'      => 'operator',
            'school_id' => $school->id,
            'email'     => 'creator@test.com',
        ]);

        // Create another operator in the same school (should NOT receive notification)
        $otherOperator = User::factory()->create([
            'role'      => 'operator',
            'school_id' => $school->id,
            'email'     => 'other@test.com',
        ]);

        // SK with valid created_by that exists in DB
        $skDocument = SkDocument::factory()->create([
            'status'     => 'pending',
            'created_by' => 'creator@test.com',
            'school_id'  => $school->id,
        ]);

        $request = Request::create("/api/sk-documents/{$skDocument->id}", 'PUT', [
            'status' => 'approved',
        ]);
        $request->setUserResolver(fn() => $admin);

        // Act
        $this->controller->update($request, $skDocument);

        // Assert: notification sent to the creator (primary path)
        $this->assertDatabaseHas('notifications', [
            'user_id' => $creator->id,
            'type'    => 'sk_approved',
        ]);

        // Assert: notification NOT sent to other operator (fallback not used)
        $this->assertDatabaseMissing('notifications', [
            'user_id' => $otherOperator->id,
            'type'    => 'sk_approved',
        ]);
    }

    /**
     * FIX-CHECKING — Bug 2 Case D: After fix, SK with null created_by and null school_id does not crash.
     *
     * Requirements: 2.3
     */
    public function test_approve_sk_with_null_created_by_and_null_school_id_does_not_crash(): void
    {
        // Arrange
        $admin = User::factory()->create(['role' => 'super_admin', 'school_id' => null]);

        // SK with both created_by and school_id null (edge case)
        $skDocument = SkDocument::factory()->create([
            'status'     => 'pending',
            'created_by' => null,
            'school_id'  => null,
        ]);

        $request = Request::create("/api/sk-documents/{$skDocument->id}", 'PUT', [
            'status' => 'approved',
        ]);
        $request->setUserResolver(fn() => $admin);

        // Act: should not crash
        $response = $this->controller->update($request, $skDocument);

        // Assert: response is successful (no exception thrown)
        $this->assertEquals(200, $response->getStatusCode());

        // Assert: no notification created (expected behavior when no recipient can be found)
        $this->assertDatabaseMissing('notifications', [
            'type' => 'sk_approved',
        ]);
    }

    /**
     * FIX-CHECKING — Bug 2: Rejection also works with fallback.
     *
     * Requirements: 2.3
     */
    public function test_reject_sk_with_null_created_by_sends_notification_via_fallback(): void
    {
        // Arrange
        $admin = User::factory()->create(['role' => 'super_admin', 'school_id' => null]);
        $school = School::factory()->create();
        $operator = User::factory()->create([
            'role'      => 'operator',
            'school_id' => $school->id,
        ]);

        $skDocument = SkDocument::factory()->create([
            'status'     => 'pending',
            'created_by' => null,
            'school_id'  => $school->id,
        ]);

        $request = Request::create("/api/sk-documents/{$skDocument->id}", 'PUT', [
            'status'           => 'rejected',
            'rejection_reason' => 'Dokumen tidak lengkap',
        ]);
        $request->setUserResolver(fn() => $admin);

        // Act
        $this->controller->update($request, $skDocument);

        // Assert: notification created via fallback
        $this->assertDatabaseHas('notifications', [
            'user_id' => $operator->id,
            'type'    => 'sk_rejected',
        ]);

        $notification = Notification::where('user_id', $operator->id)
            ->where('type', 'sk_rejected')
            ->first();

        $this->assertNotNull($notification);
        $this->assertStringContainsString('ditolak', $notification->message);
        $this->assertStringContainsString('Dokumen tidak lengkap', $notification->message);
    }

    /**
     * FIX-CHECKING — Bug 2: Batch update also uses fallback.
     *
     * Requirements: 2.3
     */
    public function test_batch_approve_with_null_created_by_sends_notifications_via_fallback(): void
    {
        // Arrange
        $admin = User::factory()->create(['role' => 'super_admin', 'school_id' => null]);
        $school = School::factory()->create();
        $operator = User::factory()->create([
            'role'      => 'operator',
            'school_id' => $school->id,
        ]);

        // Create 2 SK documents with null created_by
        $sk1 = SkDocument::factory()->create([
            'status'     => 'pending',
            'created_by' => null,
            'school_id'  => $school->id,
        ]);

        $sk2 = SkDocument::factory()->create([
            'status'     => 'pending',
            'created_by' => null,
            'school_id'  => $school->id,
        ]);

        $request = Request::create('/api/sk-documents/batch-status', 'PATCH', [
            'ids'    => [$sk1->id, $sk2->id],
            'status' => 'approved',
        ]);
        $request->setUserResolver(fn() => $admin);

        // Act
        $this->controller->batchUpdateStatus($request);

        // Assert: 2 notifications created for the operator (one per SK)
        $notifications = Notification::where('user_id', $operator->id)
            ->where('type', 'sk_approved')
            ->get();

        $this->assertCount(2, $notifications);
        $this->assertTrue($notifications->pluck('metadata.sk_id')->contains($sk1->id));
        $this->assertTrue($notifications->pluck('metadata.sk_id')->contains($sk2->id));
    }
}
