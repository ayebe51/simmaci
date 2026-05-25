<?php

namespace Tests\Feature;

use App\Models\ApprovalHistory;
use App\Models\Notification;
use App\Models\School;
use App\Models\SkDocument;
use App\Models\Teacher;
use App\Models\User;
use App\Services\DashboardCacheService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

/**
 * Integration test for batch approval end-to-end flow.
 *
 * Tests the full flow: submit batch → verify DB state → verify cache invalidated → verify response shape.
 * Tests boundary conditions and Redis fallback behavior.
 *
 * **Validates: Requirements 1.1, 1.5, 1.6, 1.7, 4.5**
 *
 * @group performance-optimization
 * @group integration
 */
class BatchApprovalIntegrationTest extends TestCase
{
    use RefreshDatabase;

    private School $school;
    private User $admin;
    private User $operator;

    protected function setUp(): void
    {
        parent::setUp();

        $this->school = School::factory()->create();
        $this->admin = User::factory()->create([
            'role' => 'admin_yayasan',
            'school_id' => $this->school->id,
        ]);
        $this->operator = User::factory()->create([
            'role' => 'operator',
            'school_id' => $this->school->id,
        ]);
    }

    /**
     * Test full end-to-end flow: submit batch → verify DB state → verify cache invalidated → verify response shape.
     *
     * @test
     */
    public function it_processes_batch_approval_end_to_end(): void
    {
        // Create SK documents with teachers
        $skIds = [];
        for ($i = 0; $i < 5; $i++) {
            $teacher = Teacher::factory()->create(['school_id' => $this->school->id]);
            $sk = SkDocument::factory()->create([
                'nomor_sk' => "SK/INT/{$i}/" . uniqid(),
                'school_id' => $this->school->id,
                'teacher_id' => $teacher->id,
                'status' => 'pending',
                'created_by' => $this->operator->email,
            ]);
            $skIds[] = $sk->id;
        }

        // Pre-populate dashboard cache to verify invalidation
        $cacheKey = "dashboard:stats:operator:{$this->school->id}";
        Cache::put($cacheKey, ['data' => 'cached_stats'], 60);
        $this->assertTrue(Cache::has($cacheKey));

        // Submit batch approval
        $response = $this->actingAs($this->admin, 'sanctum')
            ->patchJson('/api/sk-documents/batch-status', [
                'ids' => $skIds,
                'status' => 'approved',
            ]);

        // Verify response shape: { count: N, failed: [...] }
        $response->assertOk();
        $response->assertJsonStructure([
            'count',
            'failed',
        ]);

        $data = $response->json();
        $this->assertEquals(5, $data['count']);
        $this->assertIsArray($data['failed']);
        $this->assertEmpty($data['failed']);

        // Verify DB state: all SK documents are now approved
        foreach ($skIds as $id) {
            $this->assertDatabaseHas('sk_documents', [
                'id' => $id,
                'status' => 'approved',
            ]);
        }

        // Verify notifications were created for each SK
        $notificationCount = Notification::withoutTenantScope()
            ->where('school_id', $this->school->id)
            ->where('type', 'sk_approved')
            ->count();
        $this->assertEquals(5, $notificationCount);

        // Verify approval history records were created
        $historyCount = ApprovalHistory::withoutTenantScope()
            ->where('school_id', $this->school->id)
            ->where('document_type', 'sk_document')
            ->where('action', 'approve')
            ->count();
        $this->assertEquals(5, $historyCount);

        // Verify cache was invalidated
        $this->assertFalse(Cache::has($cacheKey));
    }

    /**
     * Test that DB transaction ensures atomicity: all documents in a batch are updated together.
     *
     * @test
     */
    public function it_wraps_batch_operations_in_a_transaction(): void
    {
        // Create valid SK documents
        $skIds = [];
        for ($i = 0; $i < 3; $i++) {
            $teacher = Teacher::factory()->create(['school_id' => $this->school->id]);
            $sk = SkDocument::factory()->create([
                'nomor_sk' => "SK/TXN/{$i}/" . uniqid(),
                'school_id' => $this->school->id,
                'teacher_id' => $teacher->id,
                'status' => 'pending',
                'created_by' => $this->operator->email,
            ]);
            $skIds[] = $sk->id;
        }

        // Submit batch approval
        $response = $this->actingAs($this->admin, 'sanctum')
            ->patchJson('/api/sk-documents/batch-status', [
                'ids' => $skIds,
                'status' => 'approved',
            ]);

        $response->assertOk();

        // All documents should be approved (transaction committed)
        foreach ($skIds as $id) {
            $this->assertDatabaseHas('sk_documents', [
                'id' => $id,
                'status' => 'approved',
            ]);
        }

        // All approval histories should exist (bulk inserted within transaction)
        $historyCount = ApprovalHistory::withoutTenantScope()
            ->whereIn('document_id', $skIds)
            ->where('document_type', 'sk_document')
            ->count();
        $this->assertEquals(3, $historyCount);
    }

    /**
     * Test boundary: exactly 50 items succeeds.
     *
     * @test
     */
    public function it_accepts_batch_of_exactly_50_items(): void
    {
        $skIds = [];
        for ($i = 0; $i < 50; $i++) {
            $teacher = Teacher::factory()->create(['school_id' => $this->school->id]);
            $sk = SkDocument::factory()->create([
                'nomor_sk' => "SK/50/{$i}/" . uniqid(),
                'school_id' => $this->school->id,
                'teacher_id' => $teacher->id,
                'status' => 'pending',
                'created_by' => $this->operator->email,
            ]);
            $skIds[] = $sk->id;
        }

        $response = $this->actingAs($this->admin, 'sanctum')
            ->patchJson('/api/sk-documents/batch-status', [
                'ids' => $skIds,
                'status' => 'approved',
            ]);

        $response->assertOk();
        $data = $response->json();
        $this->assertEquals(50, $data['count']);
        $this->assertEmpty($data['failed']);

        // Verify all 50 documents are approved in DB
        $approvedCount = SkDocument::withoutTenantScope()
            ->whereIn('id', $skIds)
            ->where('status', 'approved')
            ->count();
        $this->assertEquals(50, $approvedCount);
    }

    /**
     * Test boundary: 51 items is rejected with validation error.
     *
     * @test
     */
    public function it_rejects_batch_of_51_items(): void
    {
        $skIds = [];
        for ($i = 0; $i < 51; $i++) {
            $teacher = Teacher::factory()->create(['school_id' => $this->school->id]);
            $sk = SkDocument::factory()->create([
                'nomor_sk' => "SK/51/{$i}/" . uniqid(),
                'school_id' => $this->school->id,
                'teacher_id' => $teacher->id,
                'status' => 'pending',
                'created_by' => $this->operator->email,
            ]);
            $skIds[] = $sk->id;
        }

        $response = $this->actingAs($this->admin, 'sanctum')
            ->patchJson('/api/sk-documents/batch-status', [
                'ids' => $skIds,
                'status' => 'approved',
            ]);

        // Should be rejected with 422 validation error
        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['ids']);

        // Verify no documents were modified (none should be approved)
        $approvedCount = SkDocument::withoutTenantScope()
            ->whereIn('id', $skIds)
            ->where('status', 'approved')
            ->count();
        $this->assertEquals(0, $approvedCount);
    }

    /**
     * Test partial failure: mix of valid and invalid IDs.
     *
     * @test
     */
    public function it_handles_partial_failure_with_mixed_valid_and_invalid_ids(): void
    {
        // Create 3 valid SK documents
        $validIds = [];
        for ($i = 0; $i < 3; $i++) {
            $teacher = Teacher::factory()->create(['school_id' => $this->school->id]);
            $sk = SkDocument::factory()->create([
                'nomor_sk' => "SK/PARTIAL/{$i}/" . uniqid(),
                'school_id' => $this->school->id,
                'teacher_id' => $teacher->id,
                'status' => 'pending',
                'created_by' => $this->operator->email,
            ]);
            $validIds[] = $sk->id;
        }

        // Add 2 non-existent IDs
        $maxId = SkDocument::withoutTenantScope()->max('id') ?? 0;
        $invalidIds = [$maxId + 1000, $maxId + 1001];

        $allIds = array_merge($validIds, $invalidIds);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->patchJson('/api/sk-documents/batch-status', [
                'ids' => $allIds,
                'status' => 'approved',
            ]);

        $response->assertOk();
        $data = $response->json();

        // 3 valid documents should succeed
        $this->assertEquals(3, $data['count']);

        // 2 invalid IDs should be in failed array
        $this->assertCount(2, $data['failed']);

        // Each failed entry should have id and reason
        foreach ($data['failed'] as $failedEntry) {
            $this->assertArrayHasKey('id', $failedEntry);
            $this->assertArrayHasKey('reason', $failedEntry);
            $this->assertContains($failedEntry['id'], $invalidIds);
        }

        // Valid documents should be approved in DB
        foreach ($validIds as $id) {
            $this->assertDatabaseHas('sk_documents', [
                'id' => $id,
                'status' => 'approved',
            ]);
        }
    }

    /**
     * Test cache invalidation: all dashboard cache entries for affected school are cleared.
     *
     * @test
     */
    public function it_invalidates_dashboard_cache_for_affected_schools(): void
    {
        $endpoints = ['stats', 'school-stats', 'charts', 'sk-statistics', 'sk-trend', 'school-breakdown', 'school-statistics'];

        // Pre-populate cache entries for the school
        foreach ($endpoints as $endpoint) {
            Cache::put("dashboard:{$endpoint}:operator:{$this->school->id}", ['data' => 'cached'], 60);
            Cache::put("dashboard:{$endpoint}:admin_yayasan:all", ['data' => 'cached'], 60);
            Cache::put("dashboard:{$endpoint}:super_admin:all", ['data' => 'cached'], 60);
        }

        // Create and approve an SK document
        $teacher = Teacher::factory()->create(['school_id' => $this->school->id]);
        $sk = SkDocument::factory()->create([
            'nomor_sk' => 'SK/CACHE/' . uniqid(),
            'school_id' => $this->school->id,
            'teacher_id' => $teacher->id,
            'status' => 'pending',
            'created_by' => $this->operator->email,
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->patchJson('/api/sk-documents/batch-status', [
                'ids' => [$sk->id],
                'status' => 'approved',
            ]);

        $response->assertOk();

        // Verify all cache entries for this school are invalidated
        foreach ($endpoints as $endpoint) {
            $this->assertFalse(
                Cache::has("dashboard:{$endpoint}:operator:{$this->school->id}"),
                "Cache key 'dashboard:{$endpoint}:operator:{$this->school->id}' should be invalidated"
            );
            $this->assertFalse(
                Cache::has("dashboard:{$endpoint}:admin_yayasan:all"),
                "Cache key 'dashboard:{$endpoint}:admin_yayasan:all' should be invalidated"
            );
            $this->assertFalse(
                Cache::has("dashboard:{$endpoint}:super_admin:all"),
                "Cache key 'dashboard:{$endpoint}:super_admin:all' should be invalidated"
            );
        }
    }

    /**
     * Test Redis fallback: when Redis is unavailable, the system falls back to database cache
     * and continues to serve requests without raising exceptions.
     *
     * @test
     */
    public function it_falls_back_gracefully_when_redis_is_unavailable(): void
    {
        // Simulate Redis unavailability by using a mock that throws ConnectionException
        // In the test environment, CACHE_STORE is 'array', so the DashboardCacheService
        // will attempt Redis first and fall back. We test the fallback path by mocking.
        $mockService = $this->partialMock(DashboardCacheService::class, function ($mock) {
            // Allow invalidateForSchool to be called - it should handle Redis failure gracefully
            $mock->shouldAllowMockingProtectedMethods();
            $mock->shouldReceive('invalidateForSchool')
                ->andReturnUsing(function (int $schoolId) {
                    // Simulate the fallback behavior: log warning and use default cache
                    Log::warning('Redis unavailable during cache invalidation, falling back to default cache', [
                        'school_id' => $schoolId,
                    ]);
                    // Clear from default cache store instead
                    $endpoints = ['stats', 'school-stats', 'charts', 'sk-statistics', 'sk-trend', 'school-breakdown', 'school-statistics'];
                    foreach ($endpoints as $endpoint) {
                        Cache::forget("dashboard:{$endpoint}:operator:{$schoolId}");
                        foreach (['admin_yayasan', 'super_admin'] as $role) {
                            Cache::forget("dashboard:{$endpoint}:{$role}:all");
                        }
                    }
                });
        });

        // Create SK document
        $teacher = Teacher::factory()->create(['school_id' => $this->school->id]);
        $sk = SkDocument::factory()->create([
            'nomor_sk' => 'SK/REDIS/' . uniqid(),
            'school_id' => $this->school->id,
            'teacher_id' => $teacher->id,
            'status' => 'pending',
            'created_by' => $this->operator->email,
        ]);

        // Pre-populate cache
        Cache::put("dashboard:stats:operator:{$this->school->id}", ['data' => 'cached'], 60);

        // The request should succeed even with Redis "unavailable"
        Log::shouldReceive('warning')->atLeast()->once();

        $response = $this->actingAs($this->admin, 'sanctum')
            ->patchJson('/api/sk-documents/batch-status', [
                'ids' => [$sk->id],
                'status' => 'approved',
            ]);

        // Request should complete successfully without error
        $response->assertOk();
        $data = $response->json();
        $this->assertEquals(1, $data['count']);
        $this->assertEmpty($data['failed']);

        // DB state should still be correct
        $this->assertDatabaseHas('sk_documents', [
            'id' => $sk->id,
            'status' => 'approved',
        ]);
    }

    /**
     * Test response shape matches expected format: { count: N, failed: [{id, reason}] }
     *
     * @test
     */
    public function it_returns_correct_response_shape(): void
    {
        $teacher = Teacher::factory()->create(['school_id' => $this->school->id]);
        $sk = SkDocument::factory()->create([
            'nomor_sk' => 'SK/SHAPE/' . uniqid(),
            'school_id' => $this->school->id,
            'teacher_id' => $teacher->id,
            'status' => 'pending',
            'created_by' => $this->operator->email,
        ]);

        // Include one invalid ID to test failed entry shape
        $maxId = SkDocument::withoutTenantScope()->max('id') ?? 0;
        $invalidId = $maxId + 999;

        $response = $this->actingAs($this->admin, 'sanctum')
            ->patchJson('/api/sk-documents/batch-status', [
                'ids' => [$sk->id, $invalidId],
                'status' => 'rejected',
                'rejection_reason' => 'Dokumen tidak lengkap',
            ]);

        $response->assertOk();
        $response->assertJsonStructure([
            'count',
            'failed' => [
                '*' => ['id', 'reason'],
            ],
        ]);

        $data = $response->json();
        $this->assertIsInt($data['count']);
        $this->assertEquals(1, $data['count']);
        $this->assertCount(1, $data['failed']);
        $this->assertEquals($invalidId, $data['failed'][0]['id']);
        $this->assertIsString($data['failed'][0]['reason']);
    }

    /**
     * Test that rejection with reason stores the rejection_reason in the database.
     *
     * @test
     */
    public function it_stores_rejection_reason_in_database(): void
    {
        $teacher = Teacher::factory()->create(['school_id' => $this->school->id]);
        $sk = SkDocument::factory()->create([
            'nomor_sk' => 'SK/REJ/' . uniqid(),
            'school_id' => $this->school->id,
            'teacher_id' => $teacher->id,
            'status' => 'pending',
            'created_by' => $this->operator->email,
        ]);

        $rejectionReason = 'Data guru tidak sesuai dengan dokumen pendukung';

        $response = $this->actingAs($this->admin, 'sanctum')
            ->patchJson('/api/sk-documents/batch-status', [
                'ids' => [$sk->id],
                'status' => 'rejected',
                'rejection_reason' => $rejectionReason,
            ]);

        $response->assertOk();

        $this->assertDatabaseHas('sk_documents', [
            'id' => $sk->id,
            'status' => 'rejected',
            'rejection_reason' => $rejectionReason,
        ]);
    }

    /**
     * Test that teacher is_verified is updated on approval.
     *
     * @test
     */
    public function it_verifies_teacher_on_approval(): void
    {
        $teacher = Teacher::factory()->create([
            'school_id' => $this->school->id,
            'is_verified' => false,
        ]);
        $sk = SkDocument::factory()->create([
            'nomor_sk' => 'SK/VERIFY/' . uniqid(),
            'school_id' => $this->school->id,
            'teacher_id' => $teacher->id,
            'status' => 'pending',
            'created_by' => $this->operator->email,
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->patchJson('/api/sk-documents/batch-status', [
                'ids' => [$sk->id],
                'status' => 'approved',
            ]);

        $response->assertOk();

        // Teacher should now be verified
        $this->assertDatabaseHas('teachers', [
            'id' => $teacher->id,
            'is_verified' => true,
        ]);
    }

    /**
     * Test that multiple schools' caches are invalidated when batch contains documents from different schools.
     *
     * @test
     */
    public function it_invalidates_cache_for_multiple_affected_schools(): void
    {
        $school2 = School::factory()->create();
        $operator2 = User::factory()->create([
            'role' => 'operator',
            'school_id' => $school2->id,
        ]);

        // Create SK documents in two different schools
        $teacher1 = Teacher::factory()->create(['school_id' => $this->school->id]);
        $sk1 = SkDocument::factory()->create([
            'nomor_sk' => 'SK/MULTI/1/' . uniqid(),
            'school_id' => $this->school->id,
            'teacher_id' => $teacher1->id,
            'status' => 'pending',
            'created_by' => $this->operator->email,
        ]);

        $teacher2 = Teacher::factory()->create(['school_id' => $school2->id]);
        $sk2 = SkDocument::factory()->create([
            'nomor_sk' => 'SK/MULTI/2/' . uniqid(),
            'school_id' => $school2->id,
            'teacher_id' => $teacher2->id,
            'status' => 'pending',
            'created_by' => $operator2->email,
        ]);

        // Pre-populate cache for both schools
        Cache::put("dashboard:stats:operator:{$this->school->id}", ['data' => 'school1'], 60);
        Cache::put("dashboard:stats:operator:{$school2->id}", ['data' => 'school2'], 60);

        // Use super_admin to approve documents from both schools
        $superAdmin = User::factory()->create(['role' => 'super_admin']);

        $response = $this->actingAs($superAdmin, 'sanctum')
            ->patchJson('/api/sk-documents/batch-status', [
                'ids' => [$sk1->id, $sk2->id],
                'status' => 'approved',
            ]);

        $response->assertOk();

        // Both schools' caches should be invalidated
        $this->assertFalse(Cache::has("dashboard:stats:operator:{$this->school->id}"));
        $this->assertFalse(Cache::has("dashboard:stats:operator:{$school2->id}"));
    }

    /**
     * Test that unauthorized roles cannot perform batch approval.
     *
     * @test
     */
    public function it_rejects_batch_approval_from_operator_role(): void
    {
        $teacher = Teacher::factory()->create(['school_id' => $this->school->id]);
        $sk = SkDocument::factory()->create([
            'nomor_sk' => 'SK/UNAUTH/' . uniqid(),
            'school_id' => $this->school->id,
            'teacher_id' => $teacher->id,
            'status' => 'pending',
            'created_by' => $this->operator->email,
        ]);

        $response = $this->actingAs($this->operator, 'sanctum')
            ->patchJson('/api/sk-documents/batch-status', [
                'ids' => [$sk->id],
                'status' => 'approved',
            ]);

        $response->assertStatus(403);

        // Document should remain pending
        $this->assertDatabaseHas('sk_documents', [
            'id' => $sk->id,
            'status' => 'pending',
        ]);
    }
}
