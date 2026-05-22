<?php

namespace Tests\Feature;

use App\Models\School;
use App\Models\Student;
use App\Models\User;
use App\Services\StudentStatisticsService;
use Faker\Factory as Faker;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Property 4: Privileged Roles See All Data
 *
 * For any super_admin or admin_yayasan user, all student statistics queries
 * SHALL aggregate data across all madrasah without tenant scoping, and the
 * total count SHALL equal the sum of active students across all schools.
 *
 * **Validates: Requirements 1.2, 6.6**
 *
 * @group student-statistics
 */
class StudentStatisticsPrivilegedRolesPropertyTest extends TestCase
{
    use RefreshDatabase;

    private StudentStatisticsService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = app(StudentStatisticsService::class);
    }

    /**
     * Property 4: Privileged Roles See All Data
     *
     * Assert: super_admin/admin_yayasan total equals sum of all active students across all schools.
     * Assert: sum of all category jumlah_siswa equals total.
     *
     * **Validates: Requirements 1.2, 6.6**
     *
     * @test
     * @group student-statistics
     */
    public function property_privileged_roles_see_all_data(): void
    {
        $faker = Faker::create('id_ID');

        for ($iteration = 0; $iteration < 50; $iteration++) {
            // Clean up data from previous iteration
            Student::withoutTenantScope()->forceDelete();
            School::withoutTrashed()->forceDelete();

            // Generate random number of schools (2-5)
            $numSchools = $faker->numberBetween(2, 5);
            $schools = [];
            $totalExpectedActive = 0;

            for ($s = 0; $s < $numSchools; $s++) {
                $jenjang = $faker->randomElement(['RA', 'MI', 'MTs', 'MA', 'SMK', null, '']);
                $school = School::factory()->create(['jenjang' => $jenjang]);
                $schools[] = $school;

                // Generate random number of students per school (0-10)
                $numStudents = $faker->numberBetween(0, 10);
                $activeCount = 0;

                for ($st = 0; $st < $numStudents; $st++) {
                    $status = $faker->randomElement(['Aktif', 'Aktif', 'Aktif', 'Lulus', 'Pindah', 'Keluar']);
                    Student::factory()->create([
                        'school_id' => $school->id,
                        'status' => $status,
                        'kelas' => $faker->randomElement(['1A', '2B', '3C', 'VII-A', 'X IPA 1', null]),
                    ]);

                    if ($status === 'Aktif') {
                        $activeCount++;
                    }
                }

                $totalExpectedActive += $activeCount;
            }

            // Call getPerJenjang with null (privileged role view - no school_id scoping)
            $result = $this->service->getPerJenjang(null);

            // Assert 1: Total returned equals count of ALL active students across ALL schools
            $this->assertEquals(
                $totalExpectedActive,
                $result['total'],
                "Iteration {$iteration}: Privileged role total ({$result['total']}) must equal "
                . "sum of all active students across all schools ({$totalExpectedActive})"
            );

            // Assert 2: Sum of all category jumlah_siswa equals total
            $sumCategories = array_sum(array_column($result['categories'], 'jumlah_siswa'));
            $this->assertEquals(
                $result['total'],
                $sumCategories,
                "Iteration {$iteration}: Sum of category jumlah_siswa ({$sumCategories}) "
                . "must equal total ({$result['total']})"
            );

            // Assert 3: All 6 categories are present
            $this->assertCount(
                6,
                $result['categories'],
                "Iteration {$iteration}: Must have exactly 6 jenjang categories"
            );

            // Assert 4: Category names are correct
            $categoryNames = array_column($result['categories'], 'jenjang');
            $expectedCategories = ['RA', 'MI', 'MTs', 'MA', 'Tidak Terdefinisi', 'Lainnya'];
            $this->assertEquals(
                $expectedCategories,
                $categoryNames,
                "Iteration {$iteration}: Categories must be in expected order"
            );
        }
    }
}
