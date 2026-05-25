<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\School;
use App\Models\User;
use App\Services\DashboardCacheService;
use Faker\Factory as Faker;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Property 16: School name cache prevents N queries
 *
 * For any set of N activity log entries referencing M distinct school_ids,
 * the dashboard handler SHALL execute at most 1 database query to resolve
 * all school names (via cache population), not M individual School::find() calls.
 *
 * **Validates: Requirements 10.2**
 *
 * Feature: performance-optimization, Property 16: School name cache prevents N queries
 *
 * @group performance-optimization
 */
class SchoolNameCacheTest extends TestCase
{
    use RefreshDatabase;

    private DashboardCacheService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new DashboardCacheService();
    }

    /**
     * Property 16: School name cache prevents N queries
     *
     * Generate N activity logs referencing M distinct school_ids.
     * Assert at most 1 DB query to resolve all school names.
     * Run 100 iterations with randomized N and M values.
     *
     * **Validates: Requirements 10.2**
     *
     * @test
     * @group performance-optimization
     */
    public function property_school_name_cache_prevents_n_queries(): void
    {
        $faker = Faker::create('id_ID');

        for ($iteration = 0; $iteration < 100; $iteration++) {
            // Clear cache before each iteration to force fresh population
            Cache::flush();

            // Clean up data from previous iteration
            ActivityLog::query()->forceDelete();
            School::query()->forceDelete();

            // Generate M distinct schools (1 to 10)
            $M = $faker->numberBetween(1, 10);
            $schools = [];
            for ($s = 0; $s < $M; $s++) {
                $schools[] = School::factory()->create();
            }
            $schoolIds = array_map(fn($school) => $school->id, $schools);

            // Generate N activity logs referencing the M schools (M to 30)
            $N = $faker->numberBetween($M, 30);
            for ($n = 0; $n < $N; $n++) {
                $schoolId = $faker->randomElement($schoolIds);
                ActivityLog::create([
                    'log_name' => 'default',
                    'description' => 'Test activity ' . $n,
                    'event' => $faker->randomElement(['created', 'updated', 'deleted', 'login']),
                    'school_id' => $schoolId,
                    'properties' => [],
                ]);
            }

            // Enable query log to count DB queries for school name resolution
            DB::flushQueryLog();
            DB::enableQueryLog();

            // Call getSchoolNames() — this should execute exactly 1 query
            $result = $this->service->getSchoolNames();

            $queries = DB::getQueryLog();
            DB::disableQueryLog();

            // Filter queries that target the schools table
            $schoolQueries = array_filter($queries, function ($query) {
                return stripos($query['query'], 'schools') !== false
                    && stripos($query['query'], 'select') !== false;
            });

            // Assert: at most 1 DB query to resolve all school names
            $this->assertLessThanOrEqual(
                1,
                count($schoolQueries),
                "Expected at most 1 query to resolve school names, got " . count($schoolQueries)
                . ". Iteration: {$iteration}, N={$N}, M={$M}"
            );

            // Assert: the result contains all M schools
            foreach ($schools as $school) {
                $this->assertArrayHasKey(
                    $school->id,
                    $result,
                    "School ID {$school->id} should be in the cached result. Iteration: {$iteration}"
                );
                $this->assertEquals(
                    $school->nama,
                    $result[$school->id],
                    "School name mismatch for ID {$school->id}. Iteration: {$iteration}"
                );
            }

            // Now call getSchoolNames() again — should use cache, 0 additional queries
            DB::flushQueryLog();
            DB::enableQueryLog();

            $resultCached = $this->service->getSchoolNames();

            $queriesSecondCall = DB::getQueryLog();
            DB::disableQueryLog();

            $schoolQueriesSecondCall = array_filter($queriesSecondCall, function ($query) {
                return stripos($query['query'], 'schools') !== false
                    && stripos($query['query'], 'select') !== false;
            });

            // Assert: 0 queries on second call (served from cache)
            $this->assertCount(
                0,
                $schoolQueriesSecondCall,
                "Expected 0 queries on cached call, got " . count($schoolQueriesSecondCall)
                . ". Iteration: {$iteration}"
            );

            // Assert: cached result is identical
            $this->assertEquals(
                $result,
                $resultCached,
                "Cached result should be identical to first call. Iteration: {$iteration}"
            );
        }
    }
}
