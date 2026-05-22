<?php

namespace Tests\Feature;

use App\Models\School;
use App\Models\Student;
use App\Services\StudentStatisticsService;
use Faker\Factory as Faker;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Property 2: Aggregation Counts Only Active Students
 *
 * For any set of students with mixed statuses (Aktif, Lulus, Pindah, etc.)
 * associated with schools of various jenjang values, the per-jenjang aggregation
 * SHALL count only students with status "Aktif" and the sum of all category counts
 * SHALL equal the total number of active students.
 *
 * **Validates: Requirements 1.1**
 *
 * @group student-statistics
 */
class StudentStatisticsAggregationPropertyTest extends TestCase
{
    use RefreshDatabase;

    private StudentStatisticsService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new StudentStatisticsService();
    }

    /**
     * Property 2: Aggregation Counts Only Active Students
     *
     * Seed database with students of mixed statuses (Aktif, Lulus, Pindah, Keluar, Mutasi).
     * Assert: sum of all category counts equals total active students only.
     * Run 50+ iterations with randomized student data.
     *
     * **Validates: Requirements 1.1**
     *
     * @test
     * @group student-statistics
     */
    public function property_aggregation_counts_only_active_students(): void
    {
        $faker = Faker::create('id_ID');

        $statuses = ['Aktif', 'Lulus', 'Pindah', 'Keluar', 'Mutasi'];
        $jenjangValues = ['RA', 'MI', 'MTs', 'MA', null, '', 'SMK', 'SMP', 'SD'];

        for ($iteration = 0; $iteration < 50; $iteration++) {
            // Clean up students and schools for each iteration
            Student::withoutTenantScope()->forceDelete();
            School::query()->forceDelete();

            // Create random number of schools with various jenjang values
            $numSchools = $faker->numberBetween(1, 5);
            $schools = [];

            for ($s = 0; $s < $numSchools; $s++) {
                $jenjang = $faker->randomElement($jenjangValues);
                $schools[] = School::factory()->create([
                    'jenjang' => $jenjang,
                ]);
            }

            // Create random number of students with mixed statuses
            $numStudents = $faker->numberBetween(3, 20);
            $expectedActiveCount = 0;

            for ($st = 0; $st < $numStudents; $st++) {
                $status = $faker->randomElement($statuses);
                $school = $faker->randomElement($schools);

                Student::factory()->create([
                    'school_id' => $school->id,
                    'status' => $status,
                ]);

                if ($status === 'Aktif') {
                    $expectedActiveCount++;
                }
            }

            // Call the service method
            $result = $this->service->getPerJenjang();

            // Assert: sum of all category counts equals total active students
            $sumOfCategories = 0;
            foreach ($result['categories'] as $category) {
                $sumOfCategories += $category['jumlah_siswa'];
                // Each count must be non-negative
                $this->assertGreaterThanOrEqual(
                    0,
                    $category['jumlah_siswa'],
                    "Category '{$category['jenjang']}' count must be non-negative. Iteration: {$iteration}"
                );
            }

            $this->assertEquals(
                $expectedActiveCount,
                $sumOfCategories,
                "Sum of all category counts ({$sumOfCategories}) must equal total active students ({$expectedActiveCount}). Iteration: {$iteration}"
            );

            // Assert: the 'total' field also matches
            $this->assertEquals(
                $expectedActiveCount,
                $result['total'],
                "The 'total' field ({$result['total']}) must equal total active students ({$expectedActiveCount}). Iteration: {$iteration}"
            );

            // Assert: sum of categories equals the reported total
            $this->assertEquals(
                $result['total'],
                $sumOfCategories,
                "Sum of categories ({$sumOfCategories}) must equal reported total ({$result['total']}). Iteration: {$iteration}"
            );
        }
    }
}
