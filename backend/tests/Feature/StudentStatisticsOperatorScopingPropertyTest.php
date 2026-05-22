<?php

namespace Tests\Feature;

use App\Models\School;
use App\Models\Student;
use App\Models\User;
use Faker\Factory as Faker;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Property 3: Operator Tenant Scoping
 *
 * For any operator with a school_id, all student statistics queries (per-jenjang,
 * per-madrasah, per-kelas) SHALL return data exclusively from that operator's
 * associated school_id, returning zero results if no active students exist for that school.
 *
 * **Validates: Requirements 1.3, 6.5**
 *
 * @group student-statistics
 */
class StudentStatisticsOperatorScopingPropertyTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Property 3: Operator Tenant Scoping
     *
     * Create operators with different school_ids, seed students across schools.
     * Assert: operator queries return data exclusively from their school_id.
     * Run 50+ iterations with randomized data.
     *
     * **Validates: Requirements 1.3, 6.5**
     *
     * @test
     * @group student-statistics
     */
    public function property_operator_tenant_scoping(): void
    {
        $faker = Faker::create('id_ID');

        $jenjangValues = ['RA', 'MI', 'MTs', 'MA'];

        for ($iteration = 0; $iteration < 50; $iteration++) {
            // Clean up for each iteration
            Student::withoutTenantScope()->forceDelete();
            School::query()->forceDelete();
            User::query()->forceDelete();

            // Create 2-3 schools with random jenjang
            $numSchools = $faker->numberBetween(2, 3);
            $schools = [];

            for ($s = 0; $s < $numSchools; $s++) {
                $schools[] = School::factory()->create([
                    'jenjang' => $faker->randomElement($jenjangValues),
                ]);
            }

            // Create an operator for each school
            $operators = [];
            foreach ($schools as $school) {
                $operators[] = User::factory()->create([
                    'role' => 'operator',
                    'school_id' => $school->id,
                ]);
            }

            // Seed students across all schools with random counts
            $studentCountsPerSchool = [];
            foreach ($schools as $school) {
                $numActive = $faker->numberBetween(0, 10);
                $numInactive = $faker->numberBetween(0, 5);

                // Create active students
                if ($numActive > 0) {
                    Student::factory()->count($numActive)->create([
                        'school_id' => $school->id,
                        'status' => 'Aktif',
                    ]);
                }

                // Create inactive students (should not be counted)
                if ($numInactive > 0) {
                    Student::factory()->count($numInactive)->create([
                        'school_id' => $school->id,
                        'status' => $faker->randomElement(['Lulus', 'Pindah', 'Keluar', 'Mutasi']),
                    ]);
                }

                $studentCountsPerSchool[$school->id] = $numActive;
            }

            // For each operator, verify they only see their own school's data
            foreach ($operators as $index => $operator) {
                $school = $schools[$index];
                $expectedCount = $studentCountsPerSchool[$school->id];

                // Test per-jenjang endpoint
                $response = $this->actingAs($operator, 'sanctum')
                    ->getJson('/api/student-statistics/per-jenjang');

                $response->assertStatus(200);

                $total = $response->json('data.total');
                $this->assertEquals(
                    $expectedCount,
                    $total,
                    "Iteration {$iteration}: Operator for school {$school->id} should see {$expectedCount} students, got {$total}"
                );

                // Verify sum of categories equals total
                $categories = $response->json('data.categories');
                $sumCategories = array_sum(array_column($categories, 'jumlah_siswa'));
                $this->assertEquals(
                    $expectedCount,
                    $sumCategories,
                    "Iteration {$iteration}: Sum of categories ({$sumCategories}) should equal expected count ({$expectedCount})"
                );

                // Test madrasahByJenjang endpoint — operator should only see their school
                $jenjang = strtolower($school->jenjang);
                if (in_array($jenjang, ['ra', 'mi', 'mts', 'ma'])) {
                    $madrasahResponse = $this->actingAs($operator, 'sanctum')
                        ->getJson("/api/student-statistics/per-jenjang/{$jenjang}/madrasah");

                    $madrasahResponse->assertStatus(200);

                    $madrasahData = $madrasahResponse->json('data');

                    // Operator should only see their own school in the list
                    foreach ($madrasahData as $madrasah) {
                        $this->assertEquals(
                            $school->id,
                            $madrasah['id'],
                            "Iteration {$iteration}: Operator should only see their own school (id={$school->id}), but saw school id={$madrasah['id']}"
                        );
                    }
                }

                // Test perKelas endpoint — verify count matches
                $kelasResponse = $this->actingAs($operator, 'sanctum')
                    ->getJson("/api/student-statistics/madrasah/{$school->id}/per-kelas");

                $kelasResponse->assertStatus(200);

                $kelasData = $kelasResponse->json('data');
                $kelasTotal = array_sum(array_column($kelasData, 'jumlah_siswa'));
                $this->assertEquals(
                    $expectedCount,
                    $kelasTotal,
                    "Iteration {$iteration}: Per-kelas total ({$kelasTotal}) should equal expected active students ({$expectedCount}) for school {$school->id}"
                );
            }
        }
    }
}
