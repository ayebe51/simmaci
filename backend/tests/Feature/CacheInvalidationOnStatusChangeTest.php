<?php

namespace Tests\Feature;

use App\Models\ApprovalHistory;
use App\Models\Notification;
use App\Models\School;
use App\Models\SkDocument;
use App\Models\Teacher;
use App\Models\User;
use App\Services\DashboardCacheService;
use Faker\Factory as Faker;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

/**
 * Property 7: Cache invalidation on SK status change
 *
 * For any SK document whose status changes (via batch approval), all dashboard
 * cache entries scoped to the affected school_id SHALL be invalidated within
 * 1 second of the status change.
 *
 * **Validates: Requirements 4.3**
 *
 * @group performance-optimization
 */
class CacheInvalidationOnStatusChangeTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Property 7: After batch approval, dashboard cache entries for affected school_ids are invalidated.
     *
     * Pre-populate cache entries for a school, call batch approval, verify cache entries are cleared.
     * Run 100 iterations with randomized school_ids and batch sizes.
     *
     * **Validates: Requirements 4.3**
     *
     * @test
     * @group performance-optimization
     */
    public function property_cache_invalidation_on_batch_approval(): void
    {
        $faker = Faker::create('id_ID');
        $service = app(DashboardCacheService::class);

        $endpoints = ['stats', 'school-stats', 'charts', 'sk-statistics', 'sk-trend', 'school-breakdown', 'school-statistics'];

        for ($iteration = 0; $iteration < 100; $iteration++) {
            fake()->unique(true);

            $batchSize = $faker->numberBetween(1, 10);
            $status = $faker->randomElement(['approved', 'rejected']);

            // Create school and users
            $school = School::factory()->create();
            $admin = User::factory()->create([
                'role' => $faker->randomElement(['super_admin', 'admin_yayasan']),
                'school_id' => $school->id,
            ]);
            $operator = User::factory()->create([
                'role' => 'operator',
                'school_id' => $school->id,
            ]);

            // Create SK documents for this school
            $skIds = [];
            for ($i = 0; $i < $batchSize; $i++) {
                $teacher = Teacher::factory()->create(['school_id' => $school->id]);
                $sk = SkDocument::factory()->create([
                    'nomor_sk' => "SK/CACHE/{$iteration}/{$i}/" . date('Y'),
                    'school_id' => $school->id,
                    'teacher_id' => $teacher->id,
                    'status' => 'pending',
                    'created_by' => $operator->email,
                ]);
                $skIds[] = $sk->id;
            }

            // Pre-populate cache entries for the affected school
            // Operator-scoped keys
            foreach ($endpoints as $endpoint) {
                $operatorKey = "dashboard:{$endpoint}:operator:{$school->id}";
                Cache::put($operatorKey, ['data' => "cached_{$endpoint}_{$iteration}"], 60);
            }

            // Admin-scoped keys (global)
            foreach ($endpoints as $endpoint) {
                foreach (['admin_yayasan', 'super_admin'] as $role) {
                    $globalKey = "dashboard:{$endpoint}:{$role}:all";
                    Cache::put($globalKey, ['data' => "cached_{$endpoint}_{$role}_{$iteration}"], 60);
                }
            }

            // Verify cache is populated before batch approval
            $sampleOperatorKey = "dashboard:stats:operator:{$school->id}";
            $this->assertTrue(
                Cache::has($sampleOperatorKey),
                "Iteration {$iteration}: Cache should be populated before batch approval"
            );

            // Execute batch approval
            $response = $this->actingAs($admin)->patchJson('/api/sk-documents/batch-status', [
                'ids' => $skIds,
                'status' => $status,
            ]);

            $response->assertOk();

            // Verify all operator-scoped cache entries for this school are invalidated
            foreach ($endpoints as $endpoint) {
                $operatorKey = "dashboard:{$endpoint}:operator:{$school->id}";
                $this->assertFalse(
                    Cache::has($operatorKey),
                    "Iteration {$iteration}: Operator cache key '{$operatorKey}' should be invalidated after batch {$status}"
                );
            }

            // Verify all admin/super_admin global cache entries are invalidated
            foreach ($endpoints as $endpoint) {
                foreach (['admin_yayasan', 'super_admin'] as $role) {
                    $globalKey = "dashboard:{$endpoint}:{$role}:all";
                    $this->assertFalse(
                        Cache::has($globalKey),
                        "Iteration {$iteration}: Global cache key '{$globalKey}' should be invalidated after batch {$status}"
                    );
                }
            }

            // Cleanup
            SkDocument::withoutTenantScope()->where('school_id', $school->id)->forceDelete();
            Teacher::where('school_id', $school->id)->forceDelete();
            Notification::withoutTenantScope()->where('school_id', $school->id)->forceDelete();
            ApprovalHistory::withoutTenantScope()->where('school_id', $school->id)->forceDelete();
            $admin->forceDelete();
            $operator->forceDelete();
            $school->forceDelete();
            Cache::flush();
        }
    }
}
