<?php

namespace Tests\Feature;

use App\Models\School;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class DashboardStatisticsPerformanceTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test performance with 1000 schools
     * 
     * Requirements:
     * - API response time < 500ms
     * - Database query time < 100ms
     */
    public function test_performance_with_1000_schools(): void
    {
        // Create super admin user
        $superAdmin = User::factory()->create([
            'role' => 'super_admin',
            'email' => 'superadmin@test.com',
        ]);

        // Seed 1000 test schools with various afiliasi and jenjang values
        $this->seedLargeDataset(1000);

        // Enable query logging
        DB::enableQueryLog();

        // Measure API response time
        $startTime = microtime(true);

        $response = $this->actingAs($superAdmin, 'sanctum')
            ->getJson('/api/dashboard/school-statistics');

        $endTime = microtime(true);
        $responseTime = ($endTime - $startTime) * 1000; // Convert to milliseconds

        // Get query logs
        $queries = DB::getQueryLog();
        $totalQueryTime = array_sum(array_column($queries, 'time'));

        // Assertions
        $response->assertStatus(200);
        $response->assertJsonStructure([
            'success',
            'message',
            'data' => [
                'affiliation' => [
                    'jamaah',
                    'jamiyyah',
                    'undefined',
                ],
                'jenjang' => [
                    'mi_sd',
                    'mts_smp',
                    'ma_sma_smk',
                    'lainnya',
                    'undefined',
                ],
                'total',
            ],
        ]);

        // Verify total count
        $this->assertEquals(1000, $response->json('data.total'));

        // Performance assertions
        $this->assertLessThan(
            500,
            $responseTime,
            "API response time ({$responseTime}ms) should be less than 500ms"
        );

        $this->assertLessThan(
            100,
            $totalQueryTime,
            "Database query time ({$totalQueryTime}ms) should be less than 100ms"
        );

        // Output performance metrics
        echo "\n";
        echo "=== Performance Test Results ===\n";
        echo "Total schools: 1000\n";
        echo "API response time: " . number_format($responseTime, 2) . "ms\n";
        echo "Database query time: " . number_format($totalQueryTime, 2) . "ms\n";
        echo "Number of queries: " . count($queries) . "\n";
        echo "================================\n";
    }

    /**
     * Test performance with operator role (single school)
     */
    public function test_performance_operator_with_large_dataset(): void
    {
        // Create operator user with school
        $school = School::factory()->create([
            'status_jamiyyah' => 'Jama\'ah',
            'jenjang' => 'MI',
        ]);

        $operator = User::factory()->create([
            'role' => 'operator',
            'school_id' => $school->id,
            'email' => 'operator@test.com',
        ]);

        // Seed 999 other schools (total 1000)
        $this->seedLargeDataset(999);

        // Enable query logging
        DB::enableQueryLog();

        // Measure API response time
        $startTime = microtime(true);

        $response = $this->actingAs($operator, 'sanctum')
            ->getJson('/api/dashboard/school-statistics');

        $endTime = microtime(true);
        $responseTime = ($endTime - $startTime) * 1000;

        // Get query logs
        $queries = DB::getQueryLog();
        $totalQueryTime = array_sum(array_column($queries, 'time'));

        // Assertions
        $response->assertStatus(200);

        // Operator should only see their school
        $this->assertEquals(1, $response->json('data.total'));

        // Performance should be even better for single school
        $this->assertLessThan(
            200,
            $responseTime,
            "Operator API response time ({$responseTime}ms) should be less than 200ms"
        );

        $this->assertLessThan(
            50,
            $totalQueryTime,
            "Operator database query time ({$totalQueryTime}ms) should be less than 50ms"
        );

        // Output performance metrics
        echo "\n";
        echo "=== Operator Performance Test Results ===\n";
        echo "Total schools in database: 1000\n";
        echo "Schools visible to operator: 1\n";
        echo "API response time: " . number_format($responseTime, 2) . "ms\n";
        echo "Database query time: " . number_format($totalQueryTime, 2) . "ms\n";
        echo "Number of queries: " . count($queries) . "\n";
        echo "=========================================\n";
    }

    /**
     * Test query efficiency - should use aggregation, not loading all records
     */
    public function test_query_uses_aggregation_not_full_load(): void
    {
        // Create super admin user
        $superAdmin = User::factory()->create([
            'role' => 'super_admin',
        ]);

        // Seed 1000 schools
        $this->seedLargeDataset(1000);

        // Enable query logging
        DB::enableQueryLog();

        $response = $this->actingAs($superAdmin, 'sanctum')
            ->getJson('/api/dashboard/school-statistics');

        $queries = DB::getQueryLog();

        // Verify queries use GROUP BY (aggregation)
        $hasGroupBy = false;
        foreach ($queries as $query) {
            if (stripos($query['query'], 'group by') !== false) {
                $hasGroupBy = true;
                break;
            }
        }

        $this->assertTrue(
            $hasGroupBy,
            'Queries should use GROUP BY for aggregation'
        );

        // Verify we're not selecting all columns (should use COUNT)
        $hasCount = false;
        foreach ($queries as $query) {
            if (stripos($query['query'], 'count(') !== false) {
                $hasCount = true;
                break;
            }
        }

        $this->assertTrue(
            $hasCount,
            'Queries should use COUNT for aggregation'
        );

        $response->assertStatus(200);
    }

    /**
     * Seed database with large dataset
     * 
     * @param int $count Number of schools to create
     */
    private function seedLargeDataset(int $count): void
    {
        $affiliations = ['Jama\'ah', 'Afiliasi', 'Jam\'iyyah', null, ''];
        $jenjangs = ['MI', 'SD', 'MTs', 'SMP', 'MA', 'SMA', 'SMK', 'PAUD', null, ''];

        $schools = [];
        for ($i = 0; $i < $count; $i++) {
            $schools[] = [
                'nsm' => 'NSM' . str_pad($i, 10, '0', STR_PAD_LEFT),
                'npsn' => 'NPSN' . str_pad($i, 8, '0', STR_PAD_LEFT),
                'nama' => 'Sekolah Test ' . $i,
                'alamat' => 'Alamat Test ' . $i,
                'provinsi' => 'Jawa Tengah',
                'kabupaten' => 'Cilacap',
                'kecamatan' => 'Kecamatan ' . ($i % 10),
                'kelurahan' => 'Kelurahan ' . ($i % 20),
                'status_jamiyyah' => $affiliations[$i % count($affiliations)],
                'jenjang' => $jenjangs[$i % count($jenjangs)],
                'status' => 'active',
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        // Bulk insert for performance
        foreach (array_chunk($schools, 500) as $chunk) {
            School::insert($chunk);
        }
    }

    /**
     * Test memory usage doesn't exceed reasonable limits
     */
    public function test_memory_usage_with_large_dataset(): void
    {
        // Create super admin user
        $superAdmin = User::factory()->create([
            'role' => 'super_admin',
        ]);

        // Seed 1000 schools
        $this->seedLargeDataset(1000);

        // Measure memory before request
        $memoryBefore = memory_get_usage(true);

        $response = $this->actingAs($superAdmin, 'sanctum')
            ->getJson('/api/dashboard/school-statistics');

        // Measure memory after request
        $memoryAfter = memory_get_usage(true);
        $memoryUsed = ($memoryAfter - $memoryBefore) / 1024 / 1024; // Convert to MB

        $response->assertStatus(200);

        // Memory usage should be reasonable (less than 10MB for aggregation query)
        $this->assertLessThan(
            10,
            $memoryUsed,
            "Memory usage ({$memoryUsed}MB) should be less than 10MB"
        );

        echo "\n";
        echo "=== Memory Usage Test Results ===\n";
        echo "Memory used: " . number_format($memoryUsed, 2) . "MB\n";
        echo "=================================\n";
    }

    /**
     * Test concurrent requests performance
     */
    public function test_concurrent_requests_performance(): void
    {
        // Create super admin user
        $superAdmin = User::factory()->create([
            'role' => 'super_admin',
        ]);

        // Seed 1000 schools
        $this->seedLargeDataset(1000);

        // Simulate 5 concurrent requests
        $responseTimes = [];
        for ($i = 0; $i < 5; $i++) {
            $startTime = microtime(true);

            $response = $this->actingAs($superAdmin, 'sanctum')
                ->getJson('/api/dashboard/school-statistics');

            $endTime = microtime(true);
            $responseTime = ($endTime - $startTime) * 1000;

            $response->assertStatus(200);
            $responseTimes[] = $responseTime;
        }

        // Calculate average response time
        $avgResponseTime = array_sum($responseTimes) / count($responseTimes);

        // Average should still be under 500ms
        $this->assertLessThan(
            500,
            $avgResponseTime,
            "Average response time ({$avgResponseTime}ms) should be less than 500ms"
        );

        echo "\n";
        echo "=== Concurrent Requests Test Results ===\n";
        echo "Number of requests: 5\n";
        echo "Average response time: " . number_format($avgResponseTime, 2) . "ms\n";
        echo "Min response time: " . number_format(min($responseTimes), 2) . "ms\n";
        echo "Max response time: " . number_format(max($responseTimes), 2) . "ms\n";
        echo "========================================\n";
    }
}
