<?php

namespace Tests\Feature;

use App\Models\School;
use App\Models\Student;
use App\Models\User;
use Faker\Factory as Faker;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Unit Tests for StudentStatisticsController
 *
 * Tests authentication, authorization, response structure, error handling,
 * and tenant scoping for student statistics endpoints.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 *
 * @group student-statistics
 */
class StudentStatisticsControllerTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test: 401 for unauthenticated requests
     *
     * Validates: Requirement 6.1, 6.2
     *
     * @test
     */
    public function unauthenticated_requests_return_401(): void
    {
        $endpoints = [
            '/api/student-statistics/per-jenjang',
            '/api/student-statistics/per-jenjang/mi/madrasah',
            '/api/student-statistics/madrasah/1/per-kelas',
        ];

        foreach ($endpoints as $endpoint) {
            $response = $this->getJson($endpoint);
            $response->assertStatus(401);
            $response->assertJsonFragment([
                'message' => 'Unauthenticated.',
            ]);
        }
    }

    /**
     * Test: 403 for users with roles other than super_admin/admin_yayasan/operator
     *
     * Validates: Requirement 6.3, 6.4
     *
     * @test
     */
    public function forbidden_roles_return_403(): void
    {
        $forbiddenRoles = ['guru', 'kepala_sekolah', 'viewer', 'staff'];

        foreach ($forbiddenRoles as $role) {
            $user = User::factory()->create(['role' => $role]);

            $response = $this->actingAs($user, 'sanctum')
                ->getJson('/api/student-statistics/per-jenjang');

            $response->assertStatus(403);
            $response->assertJson([
                'success' => false,
            ]);
        }
    }

    /**
     * Test: 200 with correct response structure for perJenjang endpoint
     *
     * Validates: Requirement 6.4, 1.1
     *
     * @test
     */
    public function per_jenjang_returns_correct_response_structure(): void
    {
        $user = User::factory()->create(['role' => 'super_admin']);

        $school = School::factory()->create(['jenjang' => 'MI']);
        Student::factory()->create([
            'school_id' => $school->id,
            'status' => 'Aktif',
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/student-statistics/per-jenjang');

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'success',
            'message',
            'data' => [
                'categories' => [
                    '*' => ['jenjang', 'jumlah_siswa', 'persentase'],
                ],
                'total',
            ],
        ]);
        $response->assertJson(['success' => true]);

        // Verify all 6 categories are present
        $categories = $response->json('data.categories');
        $jenjangNames = array_column($categories, 'jenjang');
        $this->assertContains('RA', $jenjangNames);
        $this->assertContains('MI', $jenjangNames);
        $this->assertContains('MTs', $jenjangNames);
        $this->assertContains('MA', $jenjangNames);
        $this->assertContains('Tidak Terdefinisi', $jenjangNames);
        $this->assertContains('Lainnya', $jenjangNames);
    }

    /**
     * Test: 400 for invalid jenjang parameter in madrasahByJenjang
     *
     * Validates: Requirement 6.3
     *
     * @test
     */
    public function invalid_jenjang_returns_400(): void
    {
        $user = User::factory()->create(['role' => 'super_admin']);

        $invalidJenjangValues = ['invalid', 'universitas', 'smp', 'xyz', '123'];

        foreach ($invalidJenjangValues as $jenjang) {
            $response = $this->actingAs($user, 'sanctum')
                ->getJson("/api/student-statistics/per-jenjang/{$jenjang}/madrasah");

            $response->assertStatus(400);
            $response->assertJson([
                'success' => false,
                'message' => 'Kategori jenjang tidak valid.',
            ]);
        }
    }

    /**
     * Test: 404 for non-existent madrasah in perKelas
     *
     * Validates: Requirement 6.3
     *
     * @test
     */
    public function non_existent_madrasah_returns_404(): void
    {
        $user = User::factory()->create(['role' => 'super_admin']);

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/student-statistics/madrasah/99999/per-kelas');

        $response->assertStatus(404);
        $response->assertJson([
            'success' => false,
            'message' => 'Madrasah tidak ditemukan.',
        ]);
    }

    /**
     * Test: Operator scoping — only sees their school's data
     *
     * Validates: Requirement 6.5, 1.3
     *
     * @test
     */
    public function operator_only_sees_own_school_data(): void
    {
        $school1 = School::factory()->create(['jenjang' => 'MI']);
        $school2 = School::factory()->create(['jenjang' => 'MI']);

        $operator = User::factory()->create([
            'role' => 'operator',
            'school_id' => $school1->id,
        ]);

        // Create students for both schools
        Student::factory()->count(3)->create([
            'school_id' => $school1->id,
            'status' => 'Aktif',
        ]);
        Student::factory()->count(5)->create([
            'school_id' => $school2->id,
            'status' => 'Aktif',
        ]);

        $response = $this->actingAs($operator, 'sanctum')
            ->getJson('/api/student-statistics/per-jenjang');

        $response->assertStatus(200);

        // Operator should only see 3 students (their school)
        $total = $response->json('data.total');
        $this->assertEquals(3, $total);
    }

    /**
     * Test: Super_admin sees all data across schools
     *
     * Validates: Requirement 6.6, 1.2
     *
     * @test
     */
    public function super_admin_sees_all_data_across_schools(): void
    {
        $school1 = School::factory()->create(['jenjang' => 'MI']);
        $school2 = School::factory()->create(['jenjang' => 'MTs']);

        $superAdmin = User::factory()->create(['role' => 'super_admin']);

        // Create students for both schools
        Student::factory()->count(3)->create([
            'school_id' => $school1->id,
            'status' => 'Aktif',
        ]);
        Student::factory()->count(5)->create([
            'school_id' => $school2->id,
            'status' => 'Aktif',
        ]);

        $response = $this->actingAs($superAdmin, 'sanctum')
            ->getJson('/api/student-statistics/per-jenjang');

        $response->assertStatus(200);

        // Super admin should see all 8 students
        $total = $response->json('data.total');
        $this->assertEquals(8, $total);
    }

    /**
     * Test: admin_yayasan sees all data across schools
     *
     * Validates: Requirement 6.6, 1.2
     *
     * @test
     */
    public function admin_yayasan_sees_all_data_across_schools(): void
    {
        $school1 = School::factory()->create(['jenjang' => 'MA']);
        $school2 = School::factory()->create(['jenjang' => 'RA']);

        $adminYayasan = User::factory()->create(['role' => 'admin_yayasan']);

        Student::factory()->count(2)->create([
            'school_id' => $school1->id,
            'status' => 'Aktif',
        ]);
        Student::factory()->count(4)->create([
            'school_id' => $school2->id,
            'status' => 'Aktif',
        ]);

        $response = $this->actingAs($adminYayasan, 'sanctum')
            ->getJson('/api/student-statistics/per-jenjang');

        $response->assertStatus(200);
        $total = $response->json('data.total');
        $this->assertEquals(6, $total);
    }

    /**
     * Test: Valid jenjang values are accepted in madrasahByJenjang
     *
     * Validates: Requirement 6.4
     *
     * @test
     */
    public function valid_jenjang_values_return_200(): void
    {
        $user = User::factory()->create(['role' => 'super_admin']);

        $validJenjangValues = ['tk/ra', 'ra', 'mi', 'mts', 'ma', 'sma', 'smk', 'tidak_terdefinisi', 'lainnya'];

        foreach ($validJenjangValues as $jenjang) {
            $response = $this->actingAs($user, 'sanctum')
                ->getJson("/api/student-statistics/per-jenjang/{$jenjang}/madrasah");

            $response->assertStatus(200);
            $response->assertJson(['success' => true]);
        }
    }

    /**
     * Test: perKelas returns correct structure for existing madrasah
     *
     * Validates: Requirement 3.1, 3.2
     *
     * @test
     */
    public function per_kelas_returns_correct_structure_for_existing_madrasah(): void
    {
        $user = User::factory()->create(['role' => 'super_admin']);
        $school = School::factory()->create(['jenjang' => 'MI']);

        Student::factory()->create([
            'school_id' => $school->id,
            'status' => 'Aktif',
            'kelas' => '1A',
        ]);
        Student::factory()->create([
            'school_id' => $school->id,
            'status' => 'Aktif',
            'kelas' => '2B',
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->getJson("/api/student-statistics/madrasah/{$school->id}/per-kelas");

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'success',
            'message',
            'data' => [
                '*' => ['kelas', 'jumlah_siswa'],
            ],
        ]);
        $response->assertJson(['success' => true]);
    }
}
