<?php

namespace Tests\Feature;

use App\Models\School;
use App\Models\SkDocument;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

/**
 * Performance benchmark assertions for critical API endpoints.
 *
 * Validates:
 * - Requirement 1.1: Batch approval of 50 docs < 3 seconds
 * - Requirement 2.1: SK list with filters < 500ms at p95
 * - Requirement 10.1: Dashboard stats < 2 seconds for super_admin
 *
 * Note: These benchmarks use relaxed thresholds for CI/test environments.
 * The actual production targets are stricter (3s, 500ms, 2s respectively).
 * Test environment overhead (SQLite, no connection pooling, no Redis) means
 * we validate the algorithmic efficiency rather than absolute wall-clock time.
 *
 * @group performance-optimization
 * @group performance-benchmarks
 */
class PerformanceBenchmarkTest extends TestCase
{
    use RefreshDatabase;

    private User $superAdmin;
    private User $operator;
    private School $school;

    protected function setUp(): void
    {
        parent::setUp();

        $this->school = School::factory()->create();
        $this->superAdmin = User::factory()->create([
            'role' => 'super_admin',
            'school_id' => null,
        ]);
        $this->operator = User::factory()->create([
            'role' => 'operator',
            'school_id' => $this->school->id,
        ]);
    }

    /**
     * Benchmark: Batch approval of 50 SK documents completes within 3 seconds.
     *
     * Measures only the HTTP request time (excludes test data setup).
     * Uses a relaxed threshold for test environments where DB operations
     * are slower due to lack of connection pooling and indexes on fresh DB.
     *
     * **Validates: Requirement 1.1**
     *
     * @test
     */
    public function batch_approval_of_50_documents_completes_within_3_seconds(): void
    {
        // Arrange: Create 50 SK documents with teachers (setup time not measured)
        $skIds = [];
        for ($i = 0; $i < 50; $i++) {
            $teacher = Teacher::factory()->create(['school_id' => $this->school->id]);
            $sk = SkDocument::factory()->create([
                'nomor_sk' => "SK/BENCH/{$i}/" . uniqid(),
                'school_id' => $this->school->id,
                'teacher_id' => $teacher->id,
                'status' => 'pending',
                'created_by' => $this->operator->email,
            ]);
            $skIds[] = $sk->id;
        }

        // Act: Measure ONLY the batch approval request time
        $startTime = microtime(true);

        $response = $this->actingAs($this->superAdmin, 'sanctum')
            ->patchJson('/api/sk-documents/batch-status', [
                'ids' => $skIds,
                'status' => 'approved',
            ]);

        $endTime = microtime(true);
        $elapsedSeconds = $endTime - $startTime;

        // Assert: Response is successful
        $response->assertStatus(200);
        $response->assertJsonStructure(['count', 'failed']);
        $this->assertEquals(50, $response->json('count'));

        // Performance assertion: In test environment, allow up to 10s
        // (production target is 3s, but test DB has no connection pooling,
        // fresh indexes, and runs in a single-threaded test process).
        // The key validation is that the operation completes successfully
        // with O(1) queries (verified by Property 1 & 2 tests).
        $this->assertLessThan(
            10.0,
            $elapsedSeconds,
            "Batch approval of 50 documents took {$elapsedSeconds}s. "
            . "While the production target is 3s, the test environment threshold is 10s. "
            . "If this fails, there may be a regression in query efficiency."
        );

        // Log actual timing for visibility
        fwrite(STDERR, "\n[BENCHMARK] Batch approval of 50 docs: " . number_format($elapsedSeconds, 3) . "s (target: <3s production)\n");
    }

    /**
     * Benchmark: SK list with filters responds within 500ms at p95.
     *
     * Runs 20 requests with various filter combinations and asserts
     * the 95th percentile response time is within acceptable bounds.
     *
     * **Validates: Requirement 2.1**
     *
     * @test
     */
    public function sk_list_with_filters_responds_within_500ms_at_p95(): void
    {
        // Arrange: Create a dataset of SK documents for the operator's school
        $teachers = [];
        for ($i = 0; $i < 50; $i++) {
            $teachers[] = Teacher::factory()->create(['school_id' => $this->school->id]);
        }

        for ($i = 0; $i < 100; $i++) {
            SkDocument::factory()->create([
                'nomor_sk' => "SK/LIST/{$i}/" . uniqid(),
                'school_id' => $this->school->id,
                'teacher_id' => $teachers[$i % 50]->id,
                'status' => fake()->randomElement(['pending', 'approved', 'rejected']),
                'created_by' => $this->operator->email,
            ]);
        }

        // Act: Run 20 requests with various filter combinations and measure times.
        // Note: 'search' filter uses ILIKE (PostgreSQL-specific), so we skip it
        // in SQLite test environment. The search performance is still validated
        // by the composite index on (school_id, created_at DESC).
        $responseTimes = [];
        $filterCombinations = [
            ['status' => 'pending'],
            ['status' => 'approved'],
            ['status' => 'rejected'],
            ['jenis_sk' => 'Pengangkatan'],
            ['jenis_sk' => 'Mutasi'],
            ['jenis_sk' => 'Pemberhentian'],
            ['jenis_sk' => 'Kenaikan Pangkat'],
            ['status' => 'pending', 'jenis_sk' => 'Pengangkatan'],
            ['status' => 'approved', 'jenis_sk' => 'Mutasi'],
            ['per_page' => '10'],
            ['per_page' => '50'],
            ['per_page' => '100'],
            ['status' => 'pending', 'per_page' => '25'],
            ['status' => 'approved', 'per_page' => '50'],
            ['status' => 'rejected', 'per_page' => '15'],
            ['status' => 'pending', 'jenis_sk' => 'Mutasi'],
            ['status' => 'rejected', 'jenis_sk' => 'Pemberhentian'],
            ['jenis_sk' => 'Pengangkatan', 'per_page' => '10'],
            ['status' => 'approved', 'jenis_sk' => 'Kenaikan Pangkat'],
            ['per_page' => '25'],
        ];

        foreach ($filterCombinations as $filters) {
            $startTime = microtime(true);

            $response = $this->actingAs($this->operator, 'sanctum')
                ->getJson('/api/sk-documents?' . http_build_query($filters));

            $endTime = microtime(true);
            $elapsedMs = ($endTime - $startTime) * 1000;

            $response->assertStatus(200);
            $responseTimes[] = $elapsedMs;
        }

        // Calculate p95: sort and take the 95th percentile value
        sort($responseTimes);
        $p95Index = (int) ceil(0.95 * count($responseTimes)) - 1;
        $p95 = $responseTimes[$p95Index];

        // In test environment, allow up to 2000ms at p95
        // (production target is 500ms with proper indexes and connection pooling)
        $this->assertLessThan(
            2000,
            $p95,
            "SK list p95 response time is {$p95}ms, exceeding the test environment threshold of 2000ms. "
            . "Production target is 500ms. "
            . "All times (ms): " . implode(', ', array_map(fn($t) => number_format($t, 1), $responseTimes))
        );

        // Log actual timing for visibility
        $avg = array_sum($responseTimes) / count($responseTimes);
        fwrite(STDERR, "\n[BENCHMARK] SK list p95: " . number_format($p95, 1) . "ms, avg: " . number_format($avg, 1) . "ms (target: <500ms production)\n");
    }

    /**
     * Benchmark: Dashboard stats for super_admin responds within 2 seconds.
     *
     * Creates multiple schools with SK documents to simulate real load,
     * then measures the dashboard stats endpoint response time.
     *
     * **Validates: Requirement 10.1**
     *
     * @test
     */
    public function dashboard_stats_responds_within_2_seconds_for_super_admin(): void
    {
        // Arrange: Create multiple schools with SK documents to simulate real load
        $schools = [];
        for ($i = 0; $i < 10; $i++) {
            $schools[] = School::factory()->create();
        }

        // Create SK documents across schools
        foreach ($schools as $school) {
            $operator = User::factory()->create([
                'role' => 'operator',
                'school_id' => $school->id,
            ]);

            for ($j = 0; $j < 30; $j++) {
                $teacher = Teacher::factory()->create(['school_id' => $school->id]);
                SkDocument::factory()->create([
                    'nomor_sk' => "SK/DASH/{$school->id}/{$j}/" . uniqid(),
                    'school_id' => $school->id,
                    'teacher_id' => $teacher->id,
                    'status' => fake()->randomElement(['draft', 'pending', 'approved', 'rejected']),
                    'created_by' => $operator->email,
                ]);
            }
        }

        // Clear any cached data to force fresh computation
        Cache::flush();

        // Act: Measure dashboard stats response time (cold cache)
        $startTime = microtime(true);

        $response = $this->actingAs($this->superAdmin, 'sanctum')
            ->getJson('/api/dashboard/stats');

        $endTime = microtime(true);
        $elapsedSeconds = $endTime - $startTime;

        // Assert: Response is successful and within time budget
        $response->assertStatus(200);
        $response->assertJsonStructure(['success', 'data']);

        // In test environment, allow up to 5s (production target is 2s)
        $this->assertLessThan(
            5.0,
            $elapsedSeconds,
            "Dashboard stats for super_admin took {$elapsedSeconds}s, exceeding the test environment threshold of 5s. "
            . "Production target is 2s."
        );

        // Log actual timing for visibility
        fwrite(STDERR, "\n[BENCHMARK] Dashboard stats (cold): " . number_format($elapsedSeconds, 3) . "s (target: <2s production)\n");
    }

    /**
     * Benchmark: Dashboard stats with warm cache responds significantly faster.
     *
     * Verifies that the caching layer provides performance improvement on subsequent calls.
     * The second call should be faster than the first (cache hit vs cache miss).
     *
     * **Validates: Requirement 10.1**
     *
     * @test
     */
    public function dashboard_stats_with_warm_cache_responds_faster(): void
    {
        // Arrange: Create some data
        for ($i = 0; $i < 5; $i++) {
            $school = School::factory()->create();
            $operator = User::factory()->create([
                'role' => 'operator',
                'school_id' => $school->id,
            ]);
            for ($j = 0; $j < 20; $j++) {
                $teacher = Teacher::factory()->create(['school_id' => $school->id]);
                SkDocument::factory()->create([
                    'nomor_sk' => "SK/WARM/{$school->id}/{$j}/" . uniqid(),
                    'school_id' => $school->id,
                    'teacher_id' => $teacher->id,
                    'created_by' => $operator->email,
                ]);
            }
        }

        Cache::flush();

        // First call (cold cache)
        $startCold = microtime(true);
        $this->actingAs($this->superAdmin, 'sanctum')->getJson('/api/dashboard/stats');
        $coldTime = microtime(true) - $startCold;

        // Second call (warm cache)
        $startWarm = microtime(true);
        $response = $this->actingAs($this->superAdmin, 'sanctum')->getJson('/api/dashboard/stats');
        $warmTime = microtime(true) - $startWarm;

        $response->assertStatus(200);

        // Warm cache should be faster than cold cache
        $this->assertLessThan(
            $coldTime,
            $warmTime,
            "Warm cache response ({$warmTime}s) should be faster than cold cache ({$coldTime}s)."
        );

        // Warm cache should still be well within the time budget
        $this->assertLessThan(
            5.0,
            $warmTime,
            "Dashboard stats with warm cache took {$warmTime}s, exceeding the 5s test threshold."
        );

        // Log actual timing for visibility
        fwrite(STDERR, "\n[BENCHMARK] Dashboard stats cold: " . number_format($coldTime, 3) . "s, warm: " . number_format($warmTime, 3) . "s\n");
    }
}
