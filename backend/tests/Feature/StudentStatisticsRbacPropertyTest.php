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
 * Property-based tests for Student Statistics:
 * - Property 13: Percentage Calculation
 * - Property 12: Role-Based Access Control
 *
 * @group student-statistics
 */
class StudentStatisticsRbacPropertyTest extends TestCase
{
    use RefreshDatabase;

    private StudentStatisticsService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = app(StudentStatisticsService::class);
    }

    /**
     * Property 13: Percentage Calculation
     *
     * For any per-jenjang response where total > 0, each category's persentase
     * SHALL equal round((jumlah_siswa / total) * 100), and when total = 0,
     * all percentages SHALL be 0.
     *
     * **Validates: Requirements 1.4**
     *
     * @test
     * @group student-statistics
     */
    public function property_percentage_calculation(): void
    {
        $faker = Faker::create('id_ID');

        $jenjangValues = ['RA', 'MI', 'MTs', 'MA', null, '', 'SMK', 'SMP'];

        for ($iteration = 0; $iteration < 50; $iteration++) {
            // Clean up data from previous iteration
            Student::withoutTenantScope()->forceDelete();
            School::query()->forceDelete();

            // Randomly decide whether to create students or test the zero-total case
            $createStudents = $faker->boolean(85); // 85% chance to create students

            if ($createStudents) {
                // Generate random number of schools (1-5)
                $numSchools = $faker->numberBetween(1, 5);

                for ($s = 0; $s < $numSchools; $s++) {
                    $jenjang = $faker->randomElement($jenjangValues);
                    $school = School::factory()->create(['jenjang' => $jenjang]);

                    // Generate random number of active students per school (1-15)
                    $numStudents = $faker->numberBetween(1, 15);

                    for ($st = 0; $st < $numStudents; $st++) {
                        Student::factory()->create([
                            'school_id' => $school->id,
                            'status' => 'Aktif',
                        ]);
                    }
                }
            }

            // Call the service method
            $result = $this->service->getPerJenjang(null);
            $total = $result['total'];
            $categories = $result['categories'];

            if ($total === 0) {
                // When total = 0, all percentages must be 0
                foreach ($categories as $category) {
                    $this->assertEquals(
                        0,
                        $category['persentase'],
                        "Iteration {$iteration}: When total is 0, persentase for '{$category['jenjang']}' must be 0, got {$category['persentase']}"
                    );
                }
            } else {
                // When total > 0, each persentase must equal round((jumlah_siswa / total) * 100)
                foreach ($categories as $category) {
                    $expectedPersentase = (int) round(($category['jumlah_siswa'] / $total) * 100);

                    $this->assertEquals(
                        $expectedPersentase,
                        $category['persentase'],
                        "Iteration {$iteration}: Persentase for '{$category['jenjang']}' should be "
                        . "round(({$category['jumlah_siswa']} / {$total}) * 100) = {$expectedPersentase}, "
                        . "got {$category['persentase']}"
                    );
                }
            }

            // Additional invariant: all percentages must be >= 0
            foreach ($categories as $category) {
                $this->assertGreaterThanOrEqual(
                    0,
                    $category['persentase'],
                    "Iteration {$iteration}: Persentase for '{$category['jenjang']}' must be non-negative"
                );
            }
        }
    }

    /**
     * Property 12: Role-Based Access Control
     *
     * For any authenticated user, access to student statistics endpoints SHALL be
     * granted if and only if the user's role is one of: super_admin, admin_yayasan,
     * or operator. All other roles SHALL receive a 403 Forbidden response.
     *
     * **Validates: Requirements 6.4**
     *
     * @test
     * @group student-statistics
     */
    public function property_role_based_access_control(): void
    {
        $faker = Faker::create('id_ID');

        $allowedRoles = ['super_admin', 'admin_yayasan', 'operator'];
        $deniedRoles = ['guru', 'kepala_sekolah', 'viewer', 'staff', 'bendahara', 'tata_usaha', 'wali_kelas', 'pengawas'];

        // Create a school for operator users
        $school = School::factory()->create(['jenjang' => 'MI']);

        for ($iteration = 0; $iteration < 50; $iteration++) {
            // Pick a random role from either allowed or denied
            $testAllowed = $faker->boolean(50);

            if ($testAllowed) {
                $role = $faker->randomElement($allowedRoles);
            } else {
                $role = $faker->randomElement($deniedRoles);
            }

            // Create user with the selected role
            $user = User::factory()->create([
                'role' => $role,
                'school_id' => in_array($role, ['operator']) ? $school->id : null,
            ]);

            // Make authenticated API request
            $response = $this->actingAs($user, 'sanctum')
                ->getJson('/api/student-statistics/per-jenjang');

            if (in_array($role, $allowedRoles)) {
                // Allowed roles should get 200
                $this->assertEquals(
                    200,
                    $response->getStatusCode(),
                    "Iteration {$iteration}: Role '{$role}' should get 200, got {$response->getStatusCode()}"
                );
            } else {
                // Denied roles should get 403
                $this->assertEquals(
                    403,
                    $response->getStatusCode(),
                    "Iteration {$iteration}: Role '{$role}' should get 403, got {$response->getStatusCode()}"
                );
            }
        }
    }
}
