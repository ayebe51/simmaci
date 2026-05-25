<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\DashboardCacheService;
use Faker\Factory as Faker;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

/**
 * Property 8: Cache tenant isolation
 *
 * For any two users with different (role, school_id) combinations, their dashboard
 * cache keys SHALL be distinct, and a cache read by user A SHALL never return data
 * that was cached by user B with a different scope.
 *
 * **Validates: Requirements 4.6**
 *
 * @group performance-optimization
 */
class DashboardCacheTenantIsolationTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Property 8: Cache keys for different (role, school_id) pairs are always distinct.
     *
     * Generate randomized role + school_id combinations (100 iterations).
     * Assert that cache keys for different (role, school_id) pairs are always distinct.
     *
     * **Validates: Requirements 4.6**
     *
     * @test
     * @group performance-optimization
     */
    public function property_cache_keys_are_distinct_for_different_role_school_combinations(): void
    {
        $faker = Faker::create('id_ID');
        $service = app(DashboardCacheService::class);

        $roles = ['operator', 'admin_yayasan', 'super_admin'];
        $endpoints = ['stats', 'school-stats', 'charts', 'sk-statistics', 'sk-trend', 'school-breakdown', 'school-statistics'];

        for ($iteration = 0; $iteration < 100; $iteration++) {
            // Generate two users with different (role, school_id) combinations
            $roleA = $faker->randomElement($roles);
            $schoolIdA = $roleA === 'operator' ? $faker->numberBetween(1, 1000) : null;

            $roleB = $faker->randomElement($roles);
            $schoolIdB = $roleB === 'operator' ? $faker->numberBetween(1, 1000) : null;

            // Ensure the combinations are actually different
            if ($roleA === $roleB && $schoolIdA === $schoolIdB) {
                // Force a different combination
                $schoolIdB = $roleB === 'operator'
                    ? (($schoolIdA ?? 0) + $faker->numberBetween(1, 500))
                    : null;

                if ($roleA === $roleB && $schoolIdA === $schoolIdB) {
                    // If still the same (both non-operator), change the role
                    $roleB = $faker->randomElement(array_diff($roles, [$roleA]));
                    $schoolIdB = $roleB === 'operator' ? $faker->numberBetween(1, 1000) : null;
                }
            }

            $userA = new User([
                'name' => $faker->name(),
                'email' => $faker->unique()->safeEmail(),
                'role' => $roleA,
                'school_id' => $schoolIdA,
            ]);

            $userB = new User([
                'name' => $faker->name(),
                'email' => $faker->unique()->safeEmail(),
                'role' => $roleB,
                'school_id' => $schoolIdB,
            ]);

            // For each endpoint, verify keys are distinct
            $endpoint = $faker->randomElement($endpoints);
            $keyA = $service->buildKey($endpoint, $userA);
            $keyB = $service->buildKey($endpoint, $userB);

            $this->assertNotEquals(
                $keyA,
                $keyB,
                "Iteration {$iteration}: Cache keys should be distinct for "
                . "({$roleA}, {$schoolIdA}) vs ({$roleB}, {$schoolIdB}) "
                . "on endpoint '{$endpoint}'. Got key: '{$keyA}'"
            );
        }
    }

    /**
     * Property 8: Reading cache for user A never returns data cached by user B with different scope.
     *
     * Generate randomized role + school_id combinations (100 iterations).
     * Cache data for user A, then verify user B with a different scope cannot read it.
     *
     * **Validates: Requirements 4.6**
     *
     * @test
     * @group performance-optimization
     */
    public function property_cache_read_isolation_between_different_scopes(): void
    {
        $faker = Faker::create('id_ID');
        $service = app(DashboardCacheService::class);

        $roles = ['operator', 'admin_yayasan', 'super_admin'];
        $endpoints = ['stats', 'school-stats', 'charts', 'sk-statistics', 'sk-trend', 'school-breakdown', 'school-statistics'];

        for ($iteration = 0; $iteration < 100; $iteration++) {
            // Clear cache before each iteration
            Cache::flush();

            // Generate two users with different (role, school_id) combinations
            $roleA = $faker->randomElement($roles);
            $schoolIdA = $roleA === 'operator' ? $faker->numberBetween(1, 1000) : null;

            $roleB = $faker->randomElement($roles);
            $schoolIdB = $roleB === 'operator' ? $faker->numberBetween(1, 1000) : null;

            // Ensure the combinations are actually different
            if ($roleA === $roleB && $schoolIdA === $schoolIdB) {
                $schoolIdB = $roleB === 'operator'
                    ? (($schoolIdA ?? 0) + $faker->numberBetween(1, 500))
                    : null;

                if ($roleA === $roleB && $schoolIdA === $schoolIdB) {
                    $roleB = $faker->randomElement(array_diff($roles, [$roleA]));
                    $schoolIdB = $roleB === 'operator' ? $faker->numberBetween(1, 1000) : null;
                }
            }

            $userA = new User([
                'name' => $faker->name(),
                'email' => $faker->unique()->safeEmail(),
                'role' => $roleA,
                'school_id' => $schoolIdA,
            ]);

            $userB = new User([
                'name' => $faker->name(),
                'email' => $faker->unique()->safeEmail(),
                'role' => $roleB,
                'school_id' => $schoolIdB,
            ]);

            $endpoint = $faker->randomElement($endpoints);

            // Cache unique data for user A
            $keyA = $service->buildKey($endpoint, $userA);
            $dataA = ['tenant' => "user_a_data_{$iteration}", 'role' => $roleA, 'school_id' => $schoolIdA];
            Cache::put($keyA, $dataA, 60);

            // Verify user A can read their own cached data
            $readA = Cache::get($keyA);
            $this->assertEquals(
                $dataA,
                $readA,
                "Iteration {$iteration}: User A should be able to read their own cached data"
            );

            // Verify user B's key does NOT return user A's data
            $keyB = $service->buildKey($endpoint, $userB);
            $readB = Cache::get($keyB);

            $this->assertNotEquals(
                $dataA,
                $readB,
                "Iteration {$iteration}: User B ({$roleB}, {$schoolIdB}) should NOT "
                . "receive data cached by User A ({$roleA}, {$schoolIdA}) "
                . "on endpoint '{$endpoint}'"
            );

            // Specifically, user B's key should return null (nothing cached for them)
            $this->assertNull(
                $readB,
                "Iteration {$iteration}: User B's cache key should return null "
                . "when only User A has cached data. Key B: '{$keyB}', Key A: '{$keyA}'"
            );
        }
    }
}
