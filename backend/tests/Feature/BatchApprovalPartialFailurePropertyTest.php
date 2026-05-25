<?php

namespace Tests\Feature;

use App\Models\School;
use App\Models\SkDocument;
use App\Models\User;
use Faker\Factory as Faker;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Property 3: Partial failure resilience in batch approval
 *
 * For any batch containing V valid and I invalid SK documents (where V + I ≤ 50),
 * the batch approval handler SHALL successfully process exactly V documents and
 * return exactly I failure entries with their IDs and reasons, without aborting
 * the entire batch.
 *
 * **Validates: Requirements 1.6**
 *
 * @group performance-optimization
 */
class BatchApprovalPartialFailurePropertyTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Property 3: Partial failure resilience in batch approval
     *
     * Create test with mix of valid and invalid SK documents (randomized V valid + I invalid, V+I ≤ 50).
     * Assert response contains exactly V succeeded and I failed entries.
     * Run 100 iterations with randomized V and I counts.
     *
     * **Validates: Requirements 1.6**
     *
     * @test
     * @group performance-optimization
     */
    public function property_partial_failure_resilience_in_batch_approval(): void
    {
        $faker = Faker::create('id_ID');

        for ($iteration = 0; $iteration < 100; $iteration++) {
            // Clean up data from previous iteration
            SkDocument::withoutTenantScope()->forceDelete();
            School::query()->forceDelete();
            User::query()->forceDelete();

            // Reset the global Faker unique generators to avoid exhaustion across iterations
            fake()->unique(true);
            fake('id_ID')->unique(true);

            // Create a school and admin user
            $school = School::factory()->create();
            $admin = User::factory()->create([
                'role' => $faker->randomElement(['super_admin', 'admin_yayasan']),
                'school_id' => $school->id,
                'is_active' => true,
            ]);

            // Randomize V (valid) and I (invalid) counts where V + I ≤ 50
            $maxTotal = 50;
            $totalCount = $faker->numberBetween(1, $maxTotal);
            $validCount = $faker->numberBetween(0, $totalCount);
            $invalidCount = $totalCount - $validCount;

            // Create V valid SK documents with 'pending' status (eligible for approval)
            $validIds = [];
            for ($v = 0; $v < $validCount; $v++) {
                $sk = SkDocument::factory()->create([
                    'school_id' => $school->id,
                    'status' => 'pending',
                    'nomor_sk' => "SK/{$iteration}/{$v}/" . uniqid(),
                ]);
                $validIds[] = $sk->id;
            }

            // Generate I invalid IDs (non-existent in database)
            $invalidIds = [];
            $maxExistingId = SkDocument::withoutTenantScope()->max('id') ?? 0;
            for ($i = 0; $i < $invalidCount; $i++) {
                $invalidIds[] = $maxExistingId + 1000 + $i;
            }

            // Combine and shuffle IDs to simulate realistic mixed input
            $allIds = array_merge($validIds, $invalidIds);
            shuffle($allIds);

            // Make the batch approval request
            $response = $this->actingAs($admin, 'sanctum')
                ->patchJson('/api/sk-documents/batch-status', [
                    'ids' => $allIds,
                    'status' => 'approved',
                ]);

            $response->assertStatus(200);
            $data = $response->json();

            // Assert: response contains exactly V succeeded
            $this->assertEquals(
                $validCount,
                $data['count'],
                "Iteration {$iteration}: Expected {$validCount} succeeded, got {$data['count']}. "
                . "V={$validCount}, I={$invalidCount}, total={$totalCount}"
            );

            // Assert: response contains exactly I failed entries
            $this->assertCount(
                $invalidCount,
                $data['failed'],
                "Iteration {$iteration}: Expected {$invalidCount} failed entries, got "
                . count($data['failed']) . ". V={$validCount}, I={$invalidCount}, total={$totalCount}"
            );

            // Assert: each failed entry has an 'id' and 'reason'
            foreach ($data['failed'] as $failedEntry) {
                $this->assertArrayHasKey(
                    'id',
                    $failedEntry,
                    "Iteration {$iteration}: Each failed entry must have an 'id' field"
                );
                $this->assertArrayHasKey(
                    'reason',
                    $failedEntry,
                    "Iteration {$iteration}: Each failed entry must have a 'reason' field"
                );
                $this->assertNotEmpty(
                    $failedEntry['reason'],
                    "Iteration {$iteration}: Failed entry reason must not be empty"
                );
            }

            // Assert: all invalid IDs appear in the failed list
            $failedIds = array_column($data['failed'], 'id');
            foreach ($invalidIds as $invalidId) {
                $this->assertContains(
                    $invalidId,
                    $failedIds,
                    "Iteration {$iteration}: Invalid ID {$invalidId} should appear in failed list"
                );
            }

            // Assert: no valid IDs appear in the failed list
            foreach ($validIds as $validId) {
                $this->assertNotContains(
                    $validId,
                    $failedIds,
                    "Iteration {$iteration}: Valid ID {$validId} should NOT appear in failed list"
                );
            }
        }
    }
}
