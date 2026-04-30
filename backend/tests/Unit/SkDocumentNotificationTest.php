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
 * Preservation tests for notification functionality in SkDocumentController.
 *
 * These tests verify that behaviors that should NOT have changed after bug fixes
 * are still working correctly.
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
    // Task 5.1 — Preservation test for individual submission
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * PRESERVATION — Individual SK submission still sends sk_submitted notification to admins.
     *
     * This test verifies that the fix for Bug 1 (bulk sync) did NOT affect the
     * existing behavior for individual submissions.
     *
     * Requirements: 3.1
     */
    public function test_individual_submission_still_sends_sk_submitted_notification(): void
    {
        // Arrange: create admins
        $superAdmin = User::factory()->create(['role' => 'super_admin', 'school_id' => null]);
        $adminYayasan = User::factory()->create(['role' => 'admin_yayasan', 'school_id' => null]);

        $school = School::factory()->create(['nama' => 'MI Test Individual']);
        $operator = User::factory()->create([
            'role'      => 'operator',
            'school_id' => $school->id,
        ]);

        $teacher = Teacher::factory()->create(['school_id' => $school->id, 'nama' => 'Guru Individual']);

        // Build individual submission request
        $request = Request::create('/api/sk-documents/submit-request', 'POST', [
            'nama'               => $teacher->nama,
            'jenis_sk'           => 'GTY',
            'unit_kerja'         => $school->nama,
            'status_kepegawaian' => 'GTY',
            'surat_permohonan_url' => 'https://example.com/surat.pdf',
        ]);
        $request->setUserResolver(fn() => $operator);

        // Act: call submitRequest (individual submission)
        $response = $this->controller->submitRequest($request);

        // Assert: sk_submitted notification was created for admins (NOT sk_bulk_submitted)
        $this->assertDatabaseHas('notifications', [
            'user_id' => $superAdmin->id,
            'type'    => 'sk_submitted',
        ]);

        $this->assertDatabaseHas('notifications', [
            'user_id' => $adminYayasan->id,
            'type'    => 'sk_submitted',
        ]);

        // Assert: NO sk_bulk_submitted notification was created (individual uses different type)
        $this->assertDatabaseMissing('notifications', [
            'type' => 'sk_bulk_submitted',
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Task 5.2 — Preservation test for queue bulk path (>3 documents)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * PRESERVATION — Bulk request with >3 documents still uses queue path (not sync).
     *
     * This test verifies that the fix for Bug 1 (bulk sync) did NOT affect the
     * existing behavior for bulk requests with >3 documents, which should be
     * processed via the ProcessBulkSkSubmission job (queue), not synchronously.
     *
     * Requirements: 3.2
     */
    public function test_bulk_request_with_4_documents_uses_queue_not_sync(): void
    {
        // Arrange
        $admin = User::factory()->create(['role' => 'super_admin', 'school_id' => null]);
        $school = School::factory()->create(['nama' => 'MI Test Queue']);
        $operator = User::factory()->create([
            'role'      => 'operator',
            'school_id' => $school->id,
        ]);

        // Create 4 teachers (triggers queue path)
        $teachers = Teacher::factory()->count(4)->create(['school_id' => $school->id]);

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

        // Act: call bulkRequest with 4 documents
        $response = $this->controller->bulkRequest($request);

        // Assert: response indicates job was queued (not processed synchronously)
        $responseData = $response->getData(true);
        $this->assertTrue($responseData['success'] ?? false);
        
        // Assert: response contains 'queued' flag (indicates queue path was used)
        $this->assertTrue($responseData['queued'] ?? false, 'Response should indicate job was queued');
        
        // Assert: response status is 202 Accepted (queue path)
        $this->assertEquals(202, $response->getStatusCode(), 'Queue path should return 202 Accepted');
        
        // Assert: response message indicates background processing
        $this->assertStringContainsString('sedang diproses', $responseData['message'] ?? '');

        // Note: The job will create notifications when it runs, but in this test
        // we're only verifying that the queue path was used (not the sync path).
        // The presence or absence of notifications depends on whether the job has run,
        // which is outside the scope of this preservation test.
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Task 5.3 — Preservation test for notification with valid created_by
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * PRESERVATION — SK with valid created_by still sends notification to that user (not fallback).
     *
     * This test verifies that the fix for Bug 2 (fallback lookup) did NOT affect
     * the existing behavior when created_by is valid and the user exists in the database.
     * The notification should still be sent to the creator, NOT to the fallback operator.
     *
     * Requirements: 3.1
     */
    public function test_notification_with_valid_created_by_goes_to_creator_not_fallback(): void
    {
        // Arrange
        $admin = User::factory()->create(['role' => 'super_admin', 'school_id' => null]);
        $school = School::factory()->create();

        // Create the original creator user
        $creator = User::factory()->create([
            'role'      => 'operator',
            'school_id' => $school->id,
            'email'     => 'valid@email.com',
        ]);

        // Create another operator in the same school (should NOT receive notification)
        $otherOperator = User::factory()->create([
            'role'      => 'operator',
            'school_id' => $school->id,
            'email'     => 'other@email.com',
        ]);

        // SK with valid created_by that exists in DB
        $skDocument = SkDocument::factory()->create([
            'status'     => 'pending',
            'created_by' => 'valid@email.com',
            'school_id'  => $school->id,
        ]);

        $request = Request::create("/api/sk-documents/{$skDocument->id}", 'PUT', [
            'status' => 'approved',
        ]);
        $request->setUserResolver(fn() => $admin);

        // Act: approve the SK
        $this->controller->update($request, $skDocument);

        // Assert: notification sent to the creator (primary path, NOT fallback)
        $this->assertDatabaseHas('notifications', [
            'user_id' => $creator->id,
            'type'    => 'sk_approved',
        ]);

        // Assert: notification NOT sent to other operator (fallback was NOT used)
        $this->assertDatabaseMissing('notifications', [
            'user_id' => $otherOperator->id,
            'type'    => 'sk_approved',
        ]);

        // Assert: exactly 1 notification created (not multiple)
        $notificationCount = Notification::where('type', 'sk_approved')->count();
        $this->assertEquals(1, $notificationCount);
    }
}
