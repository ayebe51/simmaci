<?php

namespace Tests\Unit;

use App\Http\Controllers\Api\DashboardController;
use App\Models\School;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Tests\TestCase;

class DashboardControllerTest extends TestCase
{
    use RefreshDatabase;

    private DashboardController $controller;

    protected function setUp(): void
    {
        parent::setUp();
        $this->controller = new DashboardController();
    }

    /**
     * Test: Response structure has correct keys (affiliation, jenjang, total)
     * Requirements: 7.1, 7.2, 7.5
     */
    public function test_response_structure_has_correct_keys(): void
    {
        // Arrange: Create a super_admin user
        $user = User::factory()->create([
            'role' => 'super_admin',
            'school_id' => null,
        ]);

        // Create a test school
        School::factory()->create([
            'status_jamiyyah' => 'Jama\'ah',
            'jenjang' => 'MI',
        ]);

        // Act: Make request
        $request = Request::create('/api/dashboard/school-statistics', 'GET');
        $request->setUserResolver(fn() => $user);
        
        $response = $this->controller->getSchoolStatistics($request);
        $data = $response->getData(true);

        // Assert: Check response structure
        $this->assertTrue($data['success']);
        $this->assertArrayHasKey('data', $data);
        $this->assertArrayHasKey('affiliation', $data['data']);
        $this->assertArrayHasKey('jenjang', $data['data']);
        $this->assertArrayHasKey('total', $data['data']);

        // Assert: Check affiliation keys
        $this->assertArrayHasKey('jamaah', $data['data']['affiliation']);
        $this->assertArrayHasKey('jamiyyah', $data['data']['affiliation']);
        $this->assertArrayHasKey('undefined', $data['data']['affiliation']);

        // Assert: Check jenjang keys
        $this->assertArrayHasKey('mi_sd', $data['data']['jenjang']);
        $this->assertArrayHasKey('mts_smp', $data['data']['jenjang']);
        $this->assertArrayHasKey('ma_sma_smk', $data['data']['jenjang']);
        $this->assertArrayHasKey('lainnya', $data['data']['jenjang']);
        $this->assertArrayHasKey('undefined', $data['data']['jenjang']);
    }

    /**
     * Test: Affiliation categorization logic (Jama'ah/Afiliasi → jamaah, Jam'iyyah → jamiyyah)
     * Requirements: 7.1, 7.2, 7.5
     */
    public function test_affiliation_categorization_logic(): void
    {
        // Arrange: Create super_admin user
        $user = User::factory()->create(['role' => 'super_admin']);

        // Create schools with different affiliation values
        School::factory()->create(['status_jamiyyah' => 'Jama\'ah', 'jenjang' => 'MI']);
        School::factory()->create(['status_jamiyyah' => 'Afiliasi', 'jenjang' => 'MI']);
        School::factory()->create(['status_jamiyyah' => 'Jam\'iyyah', 'jenjang' => 'MI']);
        School::factory()->create(['status_jamiyyah' => 'Jam\'iyyah', 'jenjang' => 'MTs']);

        // Act
        $request = Request::create('/api/dashboard/school-statistics', 'GET');
        $request->setUserResolver(fn() => $user);
        
        $response = $this->controller->getSchoolStatistics($request);
        $data = $response->getData(true)['data'];

        // Assert: Jama'ah and Afiliasi should be counted as 'jamaah'
        $this->assertEquals(2, $data['affiliation']['jamaah']);
        
        // Assert: Jam'iyyah should be counted as 'jamiyyah'
        $this->assertEquals(2, $data['affiliation']['jamiyyah']);
        
        // Assert: No undefined
        $this->assertEquals(0, $data['affiliation']['undefined']);
    }

    /**
     * Test: Jenjang categorization logic (MI/SD → mi_sd, MTs/SMP → mts_smp, MA/SMA/SMK → ma_sma_smk)
     * Requirements: 7.1, 7.2, 7.5
     */
    public function test_jenjang_categorization_logic(): void
    {
        // Arrange: Create super_admin user
        $user = User::factory()->create(['role' => 'super_admin']);

        // Create schools with different jenjang values
        School::factory()->create(['status_jamiyyah' => 'Jama\'ah', 'jenjang' => 'MI']);
        School::factory()->create(['status_jamiyyah' => 'Jama\'ah', 'jenjang' => 'SD']);
        School::factory()->create(['status_jamiyyah' => 'Jama\'ah', 'jenjang' => 'MTs']);
        School::factory()->create(['status_jamiyyah' => 'Jama\'ah', 'jenjang' => 'SMP']);
        School::factory()->create(['status_jamiyyah' => 'Jama\'ah', 'jenjang' => 'MA']);
        School::factory()->create(['status_jamiyyah' => 'Jama\'ah', 'jenjang' => 'SMA']);
        School::factory()->create(['status_jamiyyah' => 'Jama\'ah', 'jenjang' => 'SMK']);

        // Act
        $request = Request::create('/api/dashboard/school-statistics', 'GET');
        $request->setUserResolver(fn() => $user);
        
        $response = $this->controller->getSchoolStatistics($request);
        $data = $response->getData(true)['data'];

        // Assert: MI and SD should be counted as 'mi_sd'
        $this->assertEquals(2, $data['jenjang']['mi_sd']);
        
        // Assert: MTs and SMP should be counted as 'mts_smp'
        $this->assertEquals(2, $data['jenjang']['mts_smp']);
        
        // Assert: MA, SMA, and SMK should be counted as 'ma_sma_smk'
        $this->assertEquals(3, $data['jenjang']['ma_sma_smk']);
        
        // Assert: No lainnya or undefined
        $this->assertEquals(0, $data['jenjang']['lainnya']);
        $this->assertEquals(0, $data['jenjang']['undefined']);
    }

    /**
     * Test: Case-insensitive matching for jenjang values
     * Requirements: 7.1, 7.2, 7.5
     */
    public function test_case_insensitive_matching_for_jenjang(): void
    {
        // Arrange: Create super_admin user
        $user = User::factory()->create(['role' => 'super_admin']);

        // Create schools with mixed case jenjang values
        School::factory()->create(['status_jamiyyah' => 'Jama\'ah', 'jenjang' => 'MI']);
        School::factory()->create(['status_jamiyyah' => 'Jama\'ah', 'jenjang' => 'mi']);
        School::factory()->create(['status_jamiyyah' => 'Jama\'ah', 'jenjang' => 'Mi']);
        School::factory()->create(['status_jamiyyah' => 'Jama\'ah', 'jenjang' => 'MTS']);
        School::factory()->create(['status_jamiyyah' => 'Jama\'ah', 'jenjang' => 'mts']);
        School::factory()->create(['status_jamiyyah' => 'Jama\'ah', 'jenjang' => 'MtS']);

        // Act
        $request = Request::create('/api/dashboard/school-statistics', 'GET');
        $request->setUserResolver(fn() => $user);
        
        $response = $this->controller->getSchoolStatistics($request);
        $data = $response->getData(true)['data'];

        // Assert: All MI variations should be counted together
        $this->assertEquals(3, $data['jenjang']['mi_sd']);
        
        // Assert: All MTs variations should be counted together
        $this->assertEquals(3, $data['jenjang']['mts_smp']);
    }

    /**
     * Test: Tenant scoping for operator role (only their school)
     * Requirements: 7.1, 7.2, 7.5
     */
    public function test_tenant_scoping_for_operator_role(): void
    {
        // Arrange: Create schools
        $school1 = School::factory()->create(['status_jamiyyah' => 'Jama\'ah', 'jenjang' => 'MI']);
        $school2 = School::factory()->create(['status_jamiyyah' => 'Jam\'iyyah', 'jenjang' => 'MTs']);
        $school3 = School::factory()->create(['status_jamiyyah' => 'Jama\'ah', 'jenjang' => 'MA']);

        // Create operator user for school1
        $operator = User::factory()->create([
            'role' => 'operator',
            'school_id' => $school1->id,
        ]);

        // Act
        $request = Request::create('/api/dashboard/school-statistics', 'GET');
        $request->setUserResolver(fn() => $operator);
        
        $response = $this->controller->getSchoolStatistics($request);
        $data = $response->getData(true)['data'];

        // Assert: Only school1 should be counted
        $this->assertEquals(1, $data['total']);
        $this->assertEquals(1, $data['affiliation']['jamaah']);
        $this->assertEquals(0, $data['affiliation']['jamiyyah']);
        $this->assertEquals(1, $data['jenjang']['mi_sd']);
        $this->assertEquals(0, $data['jenjang']['mts_smp']);
        $this->assertEquals(0, $data['jenjang']['ma_sma_smk']);
    }

    /**
     * Test: Global access for super_admin and admin_yayasan
     * Requirements: 7.1, 7.2, 7.5
     */
    public function test_global_access_for_super_admin(): void
    {
        // Arrange: Create schools
        School::factory()->create(['status_jamiyyah' => 'Jama\'ah', 'jenjang' => 'MI']);
        School::factory()->create(['status_jamiyyah' => 'Jam\'iyyah', 'jenjang' => 'MTs']);
        School::factory()->create(['status_jamiyyah' => 'Jama\'ah', 'jenjang' => 'MA']);

        // Create super_admin user
        $superAdmin = User::factory()->create([
            'role' => 'super_admin',
            'school_id' => null,
        ]);

        // Act
        $request = Request::create('/api/dashboard/school-statistics', 'GET');
        $request->setUserResolver(fn() => $superAdmin);
        
        $response = $this->controller->getSchoolStatistics($request);
        $data = $response->getData(true)['data'];

        // Assert: All schools should be counted
        $this->assertEquals(3, $data['total']);
        $this->assertEquals(2, $data['affiliation']['jamaah']);
        $this->assertEquals(1, $data['affiliation']['jamiyyah']);
    }

    /**
     * Test: Global access for admin_yayasan
     * Requirements: 7.1, 7.2, 7.5
     */
    public function test_global_access_for_admin_yayasan(): void
    {
        // Arrange: Create schools
        School::factory()->create(['status_jamiyyah' => 'Jama\'ah', 'jenjang' => 'MI']);
        School::factory()->create(['status_jamiyyah' => 'Jam\'iyyah', 'jenjang' => 'MTs']);

        // Create admin_yayasan user
        $adminYayasan = User::factory()->create([
            'role' => 'admin_yayasan',
            'school_id' => null,
        ]);

        // Act
        $request = Request::create('/api/dashboard/school-statistics', 'GET');
        $request->setUserResolver(fn() => $adminYayasan);
        
        $response = $this->controller->getSchoolStatistics($request);
        $data = $response->getData(true)['data'];

        // Assert: All schools should be counted
        $this->assertEquals(2, $data['total']);
        $this->assertEquals(1, $data['affiliation']['jamaah']);
        $this->assertEquals(1, $data['affiliation']['jamiyyah']);
    }

    /**
     * Test: NULL and empty string values categorized as "undefined"
     * Requirements: 7.1, 7.2, 7.5
     */
    public function test_null_and_empty_values_categorized_as_undefined(): void
    {
        // Arrange: Create super_admin user
        $user = User::factory()->create(['role' => 'super_admin']);

        // Create schools with NULL and empty values
        School::factory()->create(['status_jamiyyah' => null, 'jenjang' => null]);
        School::factory()->create(['status_jamiyyah' => '', 'jenjang' => '']);
        School::factory()->create(['status_jamiyyah' => 'Jama\'ah', 'jenjang' => null]);
        School::factory()->create(['status_jamiyyah' => null, 'jenjang' => 'MI']);

        // Act
        $request = Request::create('/api/dashboard/school-statistics', 'GET');
        $request->setUserResolver(fn() => $user);
        
        $response = $this->controller->getSchoolStatistics($request);
        $data = $response->getData(true)['data'];

        // Assert: NULL and empty affiliation should be counted as 'undefined'
        // Note: Empty string '' is not matched by LOWER() = 'jam'iyyah' or IN ('jama'ah', 'afiliasi')
        // so it falls into the ELSE 'undefined' category along with NULL
        $this->assertEquals(3, $data['affiliation']['undefined']); // null, '', null
        $this->assertEquals(1, $data['affiliation']['jamaah']); // 'Jama'ah'
        
        // Assert: NULL and empty jenjang should be counted as 'undefined'
        $this->assertEquals(3, $data['jenjang']['undefined']); // null, '', null
        $this->assertEquals(1, $data['jenjang']['mi_sd']); // 'MI'
    }

    /**
     * Test: Zero values returned for empty categories
     * Requirements: 7.1, 7.2, 7.5
     */
    public function test_zero_values_returned_for_empty_categories(): void
    {
        // Arrange: Create super_admin user
        $user = User::factory()->create(['role' => 'super_admin']);

        // Create only one school with specific values
        School::factory()->create(['status_jamiyyah' => 'Jama\'ah', 'jenjang' => 'MI']);

        // Act
        $request = Request::create('/api/dashboard/school-statistics', 'GET');
        $request->setUserResolver(fn() => $user);
        
        $response = $this->controller->getSchoolStatistics($request);
        $data = $response->getData(true)['data'];

        // Assert: Empty affiliation categories should return 0
        $this->assertEquals(1, $data['affiliation']['jamaah']);
        $this->assertEquals(0, $data['affiliation']['jamiyyah']);
        $this->assertEquals(0, $data['affiliation']['undefined']);
        
        // Assert: Empty jenjang categories should return 0
        $this->assertEquals(1, $data['jenjang']['mi_sd']);
        $this->assertEquals(0, $data['jenjang']['mts_smp']);
        $this->assertEquals(0, $data['jenjang']['ma_sma_smk']);
        $this->assertEquals(0, $data['jenjang']['lainnya']);
        $this->assertEquals(0, $data['jenjang']['undefined']);
    }

    /**
     * Test: Unrecognized jenjang values categorized as "lainnya"
     * Requirements: 7.1, 7.2, 7.5
     */
    public function test_unrecognized_jenjang_values_categorized_as_lainnya(): void
    {
        // Arrange: Create super_admin user
        $user = User::factory()->create(['role' => 'super_admin']);

        // Create schools with unrecognized jenjang values
        School::factory()->create(['status_jamiyyah' => 'Jama\'ah', 'jenjang' => 'TK']);
        School::factory()->create(['status_jamiyyah' => 'Jama\'ah', 'jenjang' => 'PAUD']);
        School::factory()->create(['status_jamiyyah' => 'Jama\'ah', 'jenjang' => 'Universitas']);

        // Act
        $request = Request::create('/api/dashboard/school-statistics', 'GET');
        $request->setUserResolver(fn() => $user);
        
        $response = $this->controller->getSchoolStatistics($request);
        $data = $response->getData(true)['data'];

        // Assert: Unrecognized values should be counted as 'lainnya'
        $this->assertEquals(3, $data['jenjang']['lainnya']);
        $this->assertEquals(0, $data['jenjang']['mi_sd']);
        $this->assertEquals(0, $data['jenjang']['mts_smp']);
        $this->assertEquals(0, $data['jenjang']['ma_sma_smk']);
        $this->assertEquals(0, $data['jenjang']['undefined']);
    }

    /**
     * Test: Total count matches sum of all categories
     * Requirements: 7.1, 7.2, 7.5
     */
    public function test_total_count_matches_sum_of_categories(): void
    {
        // Arrange: Create super_admin user
        $user = User::factory()->create(['role' => 'super_admin']);

        // Create various schools
        School::factory()->create(['status_jamiyyah' => 'Jama\'ah', 'jenjang' => 'MI']);
        School::factory()->create(['status_jamiyyah' => 'Jam\'iyyah', 'jenjang' => 'MTs']);
        School::factory()->create(['status_jamiyyah' => null, 'jenjang' => 'MA']);
        School::factory()->create(['status_jamiyyah' => 'Jama\'ah', 'jenjang' => null]);
        School::factory()->create(['status_jamiyyah' => 'Afiliasi', 'jenjang' => 'TK']);

        // Act
        $request = Request::create('/api/dashboard/school-statistics', 'GET');
        $request->setUserResolver(fn() => $user);
        
        $response = $this->controller->getSchoolStatistics($request);
        $data = $response->getData(true)['data'];

        // Assert: Total should match sum of affiliation categories
        $affiliationSum = $data['affiliation']['jamaah'] 
                        + $data['affiliation']['jamiyyah'] 
                        + $data['affiliation']['undefined'];
        $this->assertEquals($data['total'], $affiliationSum);

        // Assert: Total should match sum of jenjang categories
        $jenjangSum = $data['jenjang']['mi_sd'] 
                    + $data['jenjang']['mts_smp'] 
                    + $data['jenjang']['ma_sma_smk'] 
                    + $data['jenjang']['lainnya'] 
                    + $data['jenjang']['undefined'];
        $this->assertEquals($data['total'], $jenjangSum);
    }

    /**
     * Test: Complex jenjang values with multiple keywords
     * Requirements: 7.1, 7.2, 7.5
     */
    public function test_complex_jenjang_values_with_multiple_keywords(): void
    {
        // Arrange: Create super_admin user
        $user = User::factory()->create(['role' => 'super_admin']);

        // Create schools with complex jenjang values
        School::factory()->create(['status_jamiyyah' => 'Jama\'ah', 'jenjang' => 'MI Terpadu']);
        School::factory()->create(['status_jamiyyah' => 'Jama\'ah', 'jenjang' => 'SD Islam']);
        School::factory()->create(['status_jamiyyah' => 'Jama\'ah', 'jenjang' => 'MTs Negeri']);
        School::factory()->create(['status_jamiyyah' => 'Jama\'ah', 'jenjang' => 'SMP Plus']);
        School::factory()->create(['status_jamiyyah' => 'Jama\'ah', 'jenjang' => 'MA Unggulan']);
        School::factory()->create(['status_jamiyyah' => 'Jama\'ah', 'jenjang' => 'SMA Boarding']);
        School::factory()->create(['status_jamiyyah' => 'Jama\'ah', 'jenjang' => 'SMK Teknologi']);

        // Act
        $request = Request::create('/api/dashboard/school-statistics', 'GET');
        $request->setUserResolver(fn() => $user);
        
        $response = $this->controller->getSchoolStatistics($request);
        $data = $response->getData(true)['data'];

        // Assert: Complex values should still be categorized correctly
        $this->assertEquals(2, $data['jenjang']['mi_sd']); // MI Terpadu, SD Islam
        $this->assertEquals(2, $data['jenjang']['mts_smp']); // MTs Negeri, SMP Plus
        $this->assertEquals(3, $data['jenjang']['ma_sma_smk']); // MA Unggulan, SMA Boarding, SMK Teknologi
    }
}
