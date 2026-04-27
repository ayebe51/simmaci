<?php

namespace Tests\Feature;

use App\Models\School;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Task 8: Final Integration and Verification Tests
 * 
 * This test suite covers:
 * - 8.1: Test with different user roles
 * - 8.2: Test edge cases
 * - 8.3: Responsive design verification (manual)
 */
class Task8_IntegrationVerificationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Seed test data
        $this->seedTestData();
    }

    /**
     * Seed test data for verification
     */
    private function seedTestData(): void
    {
        // Create schools with various affiliation and jenjang values
        School::create([
            'nama' => 'MI Al-Ikhlas',
            'nsm' => '111111111111',
            'npsn' => '11111111',
            'status_jamiyyah' => 'Jama\'ah',
            'jenjang' => 'MI',
        ]);

        School::create([
            'nama' => 'MTs Nurul Huda',
            'nsm' => '222222222222',
            'npsn' => '22222222',
            'status_jamiyyah' => 'Jam\'iyyah',
            'jenjang' => 'MTs',
        ]);

        School::create([
            'nama' => 'MA Miftahul Ulum',
            'nsm' => '333333333333',
            'npsn' => '33333333',
            'status_jamiyyah' => 'Afiliasi',
            'jenjang' => 'MA',
        ]);

        School::create([
            'nama' => 'SD Terpadu',
            'nsm' => '444444444444',
            'npsn' => '44444444',
            'status_jamiyyah' => 'Jama\'ah',
            'jenjang' => 'SD',
        ]);

        School::create([
            'nama' => 'SMP Islam',
            'nsm' => '555555555555',
            'npsn' => '55555555',
            'status_jamiyyah' => 'Jam\'iyyah',
            'jenjang' => 'SMP',
        ]);

        School::create([
            'nama' => 'SMK Teknologi',
            'nsm' => '666666666666',
            'npsn' => '66666666',
            'status_jamiyyah' => 'Afiliasi',
            'jenjang' => 'SMK',
        ]);

        // Edge case: NULL jenjang
        School::create([
            'nama' => 'Sekolah Tanpa Jenjang',
            'nsm' => '777777777777',
            'npsn' => '77777777',
            'status_jamiyyah' => 'Jama\'ah',
            'jenjang' => null,
        ]);

        // Edge case: Empty string jenjang
        School::create([
            'nama' => 'Sekolah Jenjang Kosong',
            'nsm' => '888888888888',
            'npsn' => '88888888',
            'status_jamiyyah' => 'Jam\'iyyah',
            'jenjang' => '',
        ]);

        // Edge case: Unrecognized jenjang
        School::create([
            'nama' => 'Sekolah Jenjang Lain',
            'nsm' => '999999999999',
            'npsn' => '99999999',
            'status_jamiyyah' => 'Afiliasi',
            'jenjang' => 'TK',
        ]);

        // Edge case: Mixed case jenjang
        School::create([
            'nama' => 'Sekolah Mixed Case',
            'nsm' => '101010101010',
            'npsn' => '10101010',
            'status_jamiyyah' => 'Jama\'ah',
            'jenjang' => 'mi',
        ]);

        School::create([
            'nama' => 'Sekolah Mixed Case 2',
            'nsm' => '111111111110',
            'npsn' => '11111110',
            'status_jamiyyah' => 'Jam\'iyyah',
            'jenjang' => 'Mi',
        ]);
    }

    /**
     * Task 8.1: Test with super_admin role
     * Requirement: 1.8, 2.8, 3.6
     */
    public function test_super_admin_sees_all_schools(): void
    {
        // Create super_admin user
        $superAdmin = User::factory()->create([
            'role' => 'super_admin',
            'school_id' => null,
        ]);

        // Make API request
        $response = $this->actingAs($superAdmin, 'sanctum')
            ->getJson('/api/dashboard/school-statistics');

        // Assert response structure
        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'affiliation' => ['jamaah', 'jamiyyah', 'undefined'],
                    'jenjang' => ['mi_sd', 'mts_smp', 'ma_sma_smk', 'lainnya', 'undefined'],
                    'total',
                ],
            ]);

        // Assert super_admin sees all 11 schools
        $data = $response->json('data');
        $this->assertEquals(11, $data['total']);

        // Assert affiliation counts
        // Jama'ah/Afiliasi: 6 schools (MI Al-Ikhlas, MA Miftahul Ulum, SD Terpadu, Sekolah Tanpa Jenjang, Sekolah Mixed Case, Sekolah Mixed Case 2)
        // Jam'iyyah: 3 schools (MTs Nurul Huda, SMP Islam, Sekolah Jenjang Kosong)
        // Undefined: 2 schools (SMK Teknologi has 'Afiliasi', Sekolah Jenjang Lain has 'Afiliasi')
        // Wait, let me recount based on the seed data...
        // Jama'ah: MI Al-Ikhlas, SD Terpadu, Sekolah Tanpa Jenjang, Sekolah Mixed Case
        // Afiliasi: MA Miftahul Ulum, SMK Teknologi, Sekolah Jenjang Lain
        // Jam'iyyah: MTs Nurul Huda, SMP Islam, Sekolah Jenjang Kosong, Sekolah Mixed Case 2
        
        // Jama'ah + Afiliasi = 7 (4 Jama'ah + 3 Afiliasi)
        // Jam'iyyah = 4
        $this->assertEquals(7, $data['affiliation']['jamaah']);
        $this->assertEquals(4, $data['affiliation']['jamiyyah']);
        $this->assertEquals(0, $data['affiliation']['undefined']);

        // Assert jenjang counts
        // MI/SD: MI Al-Ikhlas, SD Terpadu, Sekolah Mixed Case, Sekolah Mixed Case 2 = 4
        // MTs/SMP: MTs Nurul Huda, SMP Islam = 2
        // MA/SMA/SMK: MA Miftahul Ulum, SMK Teknologi = 2
        // Lainnya: Sekolah Jenjang Lain (TK) = 1
        // Undefined: Sekolah Tanpa Jenjang (NULL), Sekolah Jenjang Kosong ('') = 2
        $this->assertEquals(4, $data['jenjang']['mi_sd']);
        $this->assertEquals(2, $data['jenjang']['mts_smp']);
        $this->assertEquals(2, $data['jenjang']['ma_sma_smk']);
        $this->assertEquals(1, $data['jenjang']['lainnya']);
        $this->assertEquals(2, $data['jenjang']['undefined']);
    }

    /**
     * Task 8.1: Test with admin_yayasan role
     * Requirement: 1.8, 2.8, 3.6
     */
    public function test_admin_yayasan_sees_all_schools(): void
    {
        // Create admin_yayasan user
        $adminYayasan = User::factory()->create([
            'role' => 'admin_yayasan',
            'school_id' => null,
        ]);

        // Make API request
        $response = $this->actingAs($adminYayasan, 'sanctum')
            ->getJson('/api/dashboard/school-statistics');

        // Assert response structure
        $response->assertStatus(200);

        // Assert admin_yayasan sees all 11 schools
        $data = $response->json('data');
        $this->assertEquals(11, $data['total']);

        // Same counts as super_admin
        $this->assertEquals(7, $data['affiliation']['jamaah']);
        $this->assertEquals(4, $data['affiliation']['jamiyyah']);
        $this->assertEquals(0, $data['affiliation']['undefined']);
    }

    /**
     * Task 8.1: Test with operator role
     * Requirement: 1.8, 2.8, 3.6
     */
    public function test_operator_sees_only_their_school(): void
    {
        // Get a specific school
        $school = School::where('nama', 'MI Al-Ikhlas')->first();

        // Create operator user for this school
        $operator = User::factory()->create([
            'role' => 'operator',
            'school_id' => $school->id,
        ]);

        // Make API request
        $response = $this->actingAs($operator, 'sanctum')
            ->getJson('/api/dashboard/school-statistics');

        // Assert response structure
        $response->assertStatus(200);

        // Assert operator sees only 1 school
        $data = $response->json('data');
        $this->assertEquals(1, $data['total']);

        // Assert affiliation counts (MI Al-Ikhlas is Jama'ah)
        $this->assertEquals(1, $data['affiliation']['jamaah']);
        $this->assertEquals(0, $data['affiliation']['jamiyyah']);
        $this->assertEquals(0, $data['affiliation']['undefined']);

        // Assert jenjang counts (MI Al-Ikhlas is MI)
        $this->assertEquals(1, $data['jenjang']['mi_sd']);
        $this->assertEquals(0, $data['jenjang']['mts_smp']);
        $this->assertEquals(0, $data['jenjang']['ma_sma_smk']);
        $this->assertEquals(0, $data['jenjang']['lainnya']);
        $this->assertEquals(0, $data['jenjang']['undefined']);
    }

    /**
     * Task 8.2: Test with empty database
     * Requirement: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
     */
    public function test_empty_database_returns_zero_values(): void
    {
        // Delete all schools
        School::query()->delete();

        // Create super_admin user
        $superAdmin = User::factory()->create([
            'role' => 'super_admin',
            'school_id' => null,
        ]);

        // Make API request
        $response = $this->actingAs($superAdmin, 'sanctum')
            ->getJson('/api/dashboard/school-statistics');

        // Assert response structure
        $response->assertStatus(200);

        // Assert all counts are zero
        $data = $response->json('data');
        $this->assertEquals(0, $data['total']);
        $this->assertEquals(0, $data['affiliation']['jamaah']);
        $this->assertEquals(0, $data['affiliation']['jamiyyah']);
        $this->assertEquals(0, $data['affiliation']['undefined']);
        $this->assertEquals(0, $data['jenjang']['mi_sd']);
        $this->assertEquals(0, $data['jenjang']['mts_smp']);
        $this->assertEquals(0, $data['jenjang']['ma_sma_smk']);
        $this->assertEquals(0, $data['jenjang']['lainnya']);
        $this->assertEquals(0, $data['jenjang']['undefined']);
    }

    /**
     * Task 8.2: Test with NULL jenjang values
     * Requirement: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
     */
    public function test_null_jenjang_categorized_as_undefined(): void
    {
        // Delete all schools and create only schools with NULL jenjang
        School::query()->delete();
        
        School::create([
            'nama' => 'School NULL 1',
            'nsm' => '111111111100',
            'npsn' => '11111100',
            'status_jamiyyah' => 'Jama\'ah',
            'jenjang' => null,
        ]);

        School::create([
            'nama' => 'School NULL 2',
            'nsm' => '222222222200',
            'npsn' => '22222200',
            'status_jamiyyah' => 'Jam\'iyyah',
            'jenjang' => null,
        ]);

        // Create super_admin user
        $superAdmin = User::factory()->create([
            'role' => 'super_admin',
            'school_id' => null,
        ]);

        // Make API request
        $response = $this->actingAs($superAdmin, 'sanctum')
            ->getJson('/api/dashboard/school-statistics');

        // Assert response
        $data = $response->json('data');
        $this->assertEquals(2, $data['total']);
        $this->assertEquals(2, $data['jenjang']['undefined']);
        $this->assertEquals(0, $data['jenjang']['mi_sd']);
        $this->assertEquals(0, $data['jenjang']['mts_smp']);
        $this->assertEquals(0, $data['jenjang']['ma_sma_smk']);
        $this->assertEquals(0, $data['jenjang']['lainnya']);
    }

    /**
     * Task 8.2: Test with empty string jenjang values
     * Requirement: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
     */
    public function test_empty_string_jenjang_categorized_as_undefined(): void
    {
        // Delete all schools and create only schools with empty string jenjang
        School::query()->delete();
        
        School::create([
            'nama' => 'School Empty 1',
            'nsm' => '111111111101',
            'npsn' => '11111101',
            'status_jamiyyah' => 'Jama\'ah',
            'jenjang' => '',
        ]);

        School::create([
            'nama' => 'School Empty 2',
            'nsm' => '222222222201',
            'npsn' => '22222201',
            'status_jamiyyah' => 'Jam\'iyyah',
            'jenjang' => '',
        ]);

        // Create super_admin user
        $superAdmin = User::factory()->create([
            'role' => 'super_admin',
            'school_id' => null,
        ]);

        // Make API request
        $response = $this->actingAs($superAdmin, 'sanctum')
            ->getJson('/api/dashboard/school-statistics');

        // Assert response
        $data = $response->json('data');
        $this->assertEquals(2, $data['total']);
        $this->assertEquals(2, $data['jenjang']['undefined']);
    }

    /**
     * Task 8.2: Test with unrecognized jenjang values
     * Requirement: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
     */
    public function test_unrecognized_jenjang_categorized_as_lainnya(): void
    {
        // Delete all schools and create only schools with unrecognized jenjang
        School::query()->delete();
        
        School::create([
            'nama' => 'TK School',
            'nsm' => '111111111102',
            'npsn' => '11111102',
            'status_jamiyyah' => 'Jama\'ah',
            'jenjang' => 'TK',
        ]);

        School::create([
            'nama' => 'PAUD School',
            'nsm' => '222222222202',
            'npsn' => '22222202',
            'status_jamiyyah' => 'Jam\'iyyah',
            'jenjang' => 'PAUD',
        ]);

        School::create([
            'nama' => 'Pondok School',
            'nsm' => '333333333302',
            'npsn' => '33333302',
            'status_jamiyyah' => 'Afiliasi',
            'jenjang' => 'Pondok Pesantren',
        ]);

        // Create super_admin user
        $superAdmin = User::factory()->create([
            'role' => 'super_admin',
            'school_id' => null,
        ]);

        // Make API request
        $response = $this->actingAs($superAdmin, 'sanctum')
            ->getJson('/api/dashboard/school-statistics');

        // Assert response
        $data = $response->json('data');
        $this->assertEquals(3, $data['total']);
        $this->assertEquals(3, $data['jenjang']['lainnya']);
        $this->assertEquals(0, $data['jenjang']['mi_sd']);
        $this->assertEquals(0, $data['jenjang']['mts_smp']);
        $this->assertEquals(0, $data['jenjang']['ma_sma_smk']);
        $this->assertEquals(0, $data['jenjang']['undefined']);
    }

    /**
     * Task 8.2: Test with mixed case jenjang values
     * Requirement: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
     */
    public function test_mixed_case_jenjang_handled_correctly(): void
    {
        // Delete all schools and create schools with mixed case jenjang
        School::query()->delete();
        
        School::create([
            'nama' => 'School MI uppercase',
            'nsm' => '111111111103',
            'npsn' => '11111103',
            'status_jamiyyah' => 'Jama\'ah',
            'jenjang' => 'MI',
        ]);

        School::create([
            'nama' => 'School mi lowercase',
            'nsm' => '222222222203',
            'npsn' => '22222203',
            'status_jamiyyah' => 'Jam\'iyyah',
            'jenjang' => 'mi',
        ]);

        School::create([
            'nama' => 'School Mi mixed',
            'nsm' => '333333333303',
            'npsn' => '33333303',
            'status_jamiyyah' => 'Afiliasi',
            'jenjang' => 'Mi',
        ]);

        School::create([
            'nama' => 'School MTS uppercase',
            'nsm' => '444444444403',
            'npsn' => '44444403',
            'status_jamiyyah' => 'Jama\'ah',
            'jenjang' => 'MTS',
        ]);

        School::create([
            'nama' => 'School mts lowercase',
            'nsm' => '555555555503',
            'npsn' => '55555503',
            'status_jamiyyah' => 'Jam\'iyyah',
            'jenjang' => 'mts',
        ]);

        // Create super_admin user
        $superAdmin = User::factory()->create([
            'role' => 'super_admin',
            'school_id' => null,
        ]);

        // Make API request
        $response = $this->actingAs($superAdmin, 'sanctum')
            ->getJson('/api/dashboard/school-statistics');

        // Assert response
        $data = $response->json('data');
        $this->assertEquals(5, $data['total']);
        
        // All MI variants should be categorized as mi_sd
        $this->assertEquals(3, $data['jenjang']['mi_sd']);
        
        // All MTs variants should be categorized as mts_smp
        $this->assertEquals(2, $data['jenjang']['mts_smp']);
        
        $this->assertEquals(0, $data['jenjang']['ma_sma_smk']);
        $this->assertEquals(0, $data['jenjang']['lainnya']);
        $this->assertEquals(0, $data['jenjang']['undefined']);
    }

    /**
     * Task 8.2: Test all edge cases are handled gracefully
     * Requirement: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
     */
    public function test_all_edge_cases_handled_gracefully(): void
    {
        // This test uses the default seed data which includes all edge cases
        
        // Create super_admin user
        $superAdmin = User::factory()->create([
            'role' => 'super_admin',
            'school_id' => null,
        ]);

        // Make API request
        $response = $this->actingAs($superAdmin, 'sanctum')
            ->getJson('/api/dashboard/school-statistics');

        // Assert response is successful
        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'affiliation' => ['jamaah', 'jamiyyah', 'undefined'],
                    'jenjang' => ['mi_sd', 'mts_smp', 'ma_sma_smk', 'lainnya', 'undefined'],
                    'total',
                ],
            ]);

        // Assert all values are non-negative integers
        $data = $response->json('data');
        $this->assertIsInt($data['total']);
        $this->assertGreaterThanOrEqual(0, $data['total']);
        
        foreach ($data['affiliation'] as $count) {
            $this->assertIsInt($count);
            $this->assertGreaterThanOrEqual(0, $count);
        }
        
        foreach ($data['jenjang'] as $count) {
            $this->assertIsInt($count);
            $this->assertGreaterThanOrEqual(0, $count);
        }

        // Assert total matches sum of categories
        $affiliationTotal = array_sum($data['affiliation']);
        $jenjangTotal = array_sum($data['jenjang']);
        $this->assertEquals($data['total'], $affiliationTotal);
        $this->assertEquals($data['total'], $jenjangTotal);
    }
}
