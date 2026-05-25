<?php

namespace Tests\Feature;

use App\Models\ApprovalHistory;
use App\Models\Notification;
use App\Models\School;
use App\Models\SkDocument;
use App\Models\Teacher;
use App\Models\User;
use Faker\Factory as Faker;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Property tests for batch approval query efficiency.
 *
 * @group performance-optimization
 */
class BatchApprovalQueryEfficiencyTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Property 1: Eager loading prevents N+1 queries
     *
     * **Validates: Requirements 1.2**
     *
     * @test
     * @group performance-optimization
     */
    public function property_eager_loading_prevents_n_plus_one_queries(): void
    {
        for ($iteration = 0; $iteration < 100; $iteration++) {
            $faker = Faker::create('id_ID');
            fake()->unique(true);
            $batchSize = $faker->numberBetween(1, 50);
            $school = School::factory()->create();
            $admin = User::factory()->create(['role' => $faker->randomElement(['super_admin', 'admin_yayasan']), 'school_id' => $school->id]);
            $operator = User::factory()->create(['role' => 'operator', 'school_id' => $school->id]);
            $skIds = [];
            for ($i = 0; $i < $batchSize; $i++) {
                $teacher = Teacher::factory()->create(['school_id' => $school->id]);
                $sk = SkDocument::factory()->create(['nomor_sk' => "SK/EL/{$iteration}/{$i}/" . date('Y'), 'school_id' => $school->id, 'teacher_id' => $teacher->id, 'status' => 'pending', 'created_by' => $operator->email]);
                $skIds[] = $sk->id;
            }
            DB::flushQueryLog();
            DB::enableQueryLog();
            $response = $this->actingAs($admin)->patchJson('/api/sk-documents/batch-status', ['ids' => $skIds, 'status' => 'approved']);
            $queries = DB::getQueryLog();
            DB::disableQueryLog();
            $response->assertStatus(200);
            $skDocSelects = collect($queries)->filter(fn($q) => stripos(trim($q['query']), 'select') === 0 && stripos($q['query'], 'sk_documents') !== false)->count();
            $teacherSelects = collect($queries)->filter(fn($q) => stripos(trim($q['query']), 'select') === 0 && stripos($q['query'], 'teachers') !== false)->count();
            $this->assertLessThanOrEqual(1, $skDocSelects, "Iteration {$iteration}: Batch size {$batchSize} produced {$skDocSelects} SELECT on sk_documents.");
            $this->assertLessThanOrEqual(1, $teacherSelects, "Iteration {$iteration}: Batch size {$batchSize} produced {$teacherSelects} SELECT on teachers.");
            SkDocument::withoutTenantScope()->where('school_id', $school->id)->forceDelete();
            Teacher::where('school_id', $school->id)->forceDelete();
            Notification::withoutTenantScope()->where('school_id', $school->id)->forceDelete();
            ApprovalHistory::withoutTenantScope()->where('school_id', $school->id)->forceDelete();
            $admin->forceDelete();
            $operator->forceDelete();
            $school->forceDelete();
        }
    }

    /**
     * Property 2: Bulk insert for batch write operations.
     *
     * For any batch of N SK documents being approved/rejected, the number of INSERT
     * statements for notifications and approval history records SHALL each be exactly 1
     * (bulk insert), not N individual inserts.
     *
     * Run 100 iterations with randomized batch sizes.
     *
     * **Validates: Requirements 1.3, 1.4**
     *
     * @test
     * @group performance-optimization
     */
    public function property_bulk_insert_for_notifications_and_approval_histories(): void
    {
        for ($iteration = 0; $iteration < 100; $iteration++) {
            $faker = Faker::create('id_ID');
            fake()->unique(true);
            $batchSize = $faker->numberBetween(1, 50);
            $status = $faker->randomElement(['approved', 'rejected']);
            $school = School::factory()->create();
            $admin = User::factory()->create(['role' => $faker->randomElement(['super_admin', 'admin_yayasan']), 'school_id' => $school->id]);
            $operator = User::factory()->create(['role' => 'operator', 'school_id' => $school->id]);
            $skIds = [];
            for ($i = 0; $i < $batchSize; $i++) {
                $teacher = Teacher::factory()->create(['school_id' => $school->id]);
                $sk = SkDocument::factory()->create(['nomor_sk' => "SK/BULK/{$iteration}/{$i}/" . date('Y'), 'school_id' => $school->id, 'teacher_id' => $teacher->id, 'status' => 'pending', 'created_by' => $operator->email]);
                $skIds[] = $sk->id;
            }
            DB::flushQueryLog();
            DB::enableQueryLog();
            $response = $this->actingAs($admin)->patchJson('/api/sk-documents/batch-status', ['ids' => $skIds, 'status' => $status]);
            $queryLog = DB::getQueryLog();
            DB::disableQueryLog();
            $response->assertOk();
            $notificationInserts = collect($queryLog)->filter(fn($q) => stripos($q['query'], 'insert') !== false && stripos($q['query'], 'notifications') !== false)->count();
            $historyInserts = collect($queryLog)->filter(fn($q) => stripos($q['query'], 'insert') !== false && stripos($q['query'], 'approval_histories') !== false)->count();
            $this->assertEquals(1, $notificationInserts, "Iteration {$iteration} (batch size {$batchSize}, status {$status}): Expected exactly 1 INSERT for notifications, got {$notificationInserts}.");
            $this->assertEquals(1, $historyInserts, "Iteration {$iteration} (batch size {$batchSize}, status {$status}): Expected exactly 1 INSERT for approval_histories, got {$historyInserts}.");
            SkDocument::withoutTenantScope()->where('school_id', $school->id)->forceDelete();
            Teacher::where('school_id', $school->id)->forceDelete();
            Notification::withoutTenantScope()->where('school_id', $school->id)->forceDelete();
            ApprovalHistory::withoutTenantScope()->where('school_id', $school->id)->forceDelete();
            $admin->forceDelete();
            $operator->forceDelete();
            $school->forceDelete();
        }
    }
}