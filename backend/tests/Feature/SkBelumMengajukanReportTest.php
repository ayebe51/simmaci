<?php

namespace Tests\Feature;

use App\Models\School;
use App\Models\SkDocument;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Feature Tests for GET /api/reports/sk-belum-mengajukan
 *
 * Tests authorization, response structure, filtering, search, period logic,
 * and data correctness for the SK Belum Mengajukan report endpoint.
 *
 * Requirements: 1.1, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4
 *
 * @group sk-report-missing-submissions
 */
class SkBelumMengajukanReportTest extends TestCase
{
    use RefreshDatabase;

    private string $endpoint = '/api/reports/sk-belum-mengajukan';

    /**
     * Test: super_admin gets 200 with correct response structure
     *
     * Validates: Requirements 1.1, 1.3
     *
     * @test
     */
    public function super_admin_gets_200_with_correct_response_structure(): void
    {
        $user = User::factory()->create(['role' => 'super_admin']);

        School::factory()->create([
            'status_jamiyyah' => "Jam'iyyah",
            'jenjang' => 'MI',
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->getJson($this->endpoint);

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'total',
            'kecamatan_list',
            'data' => [
                '*' => ['id', 'nama', 'npsn', 'jenjang', 'kecamatan', 'kepala_madrasah', 'telepon'],
            ],
        ]);
    }

    /**
     * Test: admin_yayasan gets 200
     *
     * Validates: Requirements 1.1
     *
     * @test
     */
    public function admin_yayasan_gets_200(): void
    {
        $user = User::factory()->create(['role' => 'admin_yayasan']);

        $response = $this->actingAs($user, 'sanctum')
            ->getJson($this->endpoint);

        $response->assertStatus(200);
    }

    /**
     * Test: operator gets 403
     *
     * Validates: Requirements 1.4
     *
     * @test
     */
    public function operator_gets_403(): void
    {
        $school = School::factory()->create();
        $user = User::factory()->create([
            'role' => 'operator',
            'school_id' => $school->id,
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->getJson($this->endpoint);

        $response->assertStatus(403);
        $response->assertJson([
            'message' => 'Akses ditolak. Hanya super admin dan admin yayasan yang dapat mengakses laporan ini.',
        ]);
    }

    /**
     * Test: only jam'iyyah schools without SK appear in results
     *
     * Validates: Requirements 1.1
     *
     * @test
     */
    public function only_jamiyyah_schools_without_sk_appear_in_results(): void
    {
        $user = User::factory()->create(['role' => 'super_admin']);

        // Jam'iyyah school WITHOUT SK — should appear
        $schoolWithout = School::factory()->create([
            'status_jamiyyah' => "Jam'iyyah",
            'nama' => 'MI Nurul Huda',
            'jenjang' => 'MI',
        ]);

        // Jam'iyyah school WITH SK — should NOT appear
        $schoolWith = School::factory()->create([
            'status_jamiyyah' => "Jam'iyyah",
            'nama' => 'MTs Al-Ikhlas',
            'jenjang' => 'MTs',
        ]);
        SkDocument::factory()->create(['school_id' => $schoolWith->id]);

        $response = $this->actingAs($user, 'sanctum')
            ->getJson($this->endpoint);

        $response->assertStatus(200);

        $data = $response->json('data');
        $ids = array_column($data, 'id');

        $this->assertContains($schoolWithout->id, $ids);
        $this->assertNotContains($schoolWith->id, $ids);
    }

    /**
     * Test: schools WITH SK submissions do NOT appear
     *
     * Validates: Requirements 1.1
     *
     * @test
     */
    public function schools_with_sk_submissions_do_not_appear(): void
    {
        $user = User::factory()->create(['role' => 'super_admin']);

        $school = School::factory()->create([
            'status_jamiyyah' => "Jam'iyyah",
            'jenjang' => 'MA',
        ]);

        // Create multiple SK documents for this school
        SkDocument::factory()->count(3)->create(['school_id' => $school->id]);

        $response = $this->actingAs($user, 'sanctum')
            ->getJson($this->endpoint);

        $response->assertStatus(200);

        $data = $response->json('data');
        $ids = array_column($data, 'id');

        $this->assertNotContains($school->id, $ids);
    }

    /**
     * Test: non-jam'iyyah schools do NOT appear
     *
     * Validates: Requirements 1.1
     *
     * @test
     */
    public function non_jamiyyah_schools_do_not_appear(): void
    {
        $user = User::factory()->create(['role' => 'super_admin']);

        // Non-jam'iyyah schools without SK — should NOT appear
        School::factory()->create([
            'status_jamiyyah' => "Jama'ah",
            'nama' => 'MI Jama\'ah School',
        ]);
        School::factory()->create([
            'status_jamiyyah' => 'Afiliasi',
            'nama' => 'MI Afiliasi School',
        ]);
        School::factory()->create([
            'status_jamiyyah' => null,
            'nama' => 'MI Null Status School',
        ]);

        // Jam'iyyah school without SK — should appear
        $jamiyyahSchool = School::factory()->create([
            'status_jamiyyah' => "Jam'iyyah",
            'nama' => 'MI Target School',
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->getJson($this->endpoint);

        $response->assertStatus(200);

        $data = $response->json('data');
        $ids = array_column($data, 'id');

        $this->assertContains($jamiyyahSchool->id, $ids);
        $this->assertCount(1, $data);
    }

    /**
     * Test: jenjang filter narrows results correctly
     *
     * Validates: Requirements 2.1
     *
     * @test
     */
    public function jenjang_filter_narrows_results_correctly(): void
    {
        $user = User::factory()->create(['role' => 'super_admin']);

        School::factory()->create([
            'status_jamiyyah' => "Jam'iyyah",
            'jenjang' => 'MI',
            'nama' => 'MI School A',
        ]);
        School::factory()->create([
            'status_jamiyyah' => "Jam'iyyah",
            'jenjang' => 'MTs',
            'nama' => 'MTs School B',
        ]);
        School::factory()->create([
            'status_jamiyyah' => "Jam'iyyah",
            'jenjang' => 'MA',
            'nama' => 'MA School C',
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->getJson($this->endpoint . '?jenjang=MI');

        $response->assertStatus(200);

        $data = $response->json('data');
        $this->assertCount(1, $data);
        $this->assertEquals('MI', $data[0]['jenjang']);
    }

    /**
     * Test: kecamatan filter narrows results correctly
     *
     * Validates: Requirements 2.2
     *
     * @test
     */
    public function kecamatan_filter_narrows_results_correctly(): void
    {
        $user = User::factory()->create(['role' => 'super_admin']);

        School::factory()->create([
            'status_jamiyyah' => "Jam'iyyah",
            'kecamatan' => 'Cilacap Selatan',
            'nama' => 'MI School Cilacap',
        ]);
        School::factory()->create([
            'status_jamiyyah' => "Jam'iyyah",
            'kecamatan' => 'Majenang',
            'nama' => 'MI School Majenang',
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->getJson($this->endpoint . '?kecamatan=Majenang');

        $response->assertStatus(200);

        $data = $response->json('data');
        $this->assertCount(1, $data);
        $this->assertEquals('Majenang', $data[0]['kecamatan']);
    }

    /**
     * Test: search filter matches nama and NPSN (case-insensitive)
     *
     * Validates: Requirements 2.3
     *
     * @test
     */
    public function search_filter_matches_nama_and_npsn_case_insensitive(): void
    {
        $user = User::factory()->create(['role' => 'super_admin']);

        $schoolA = School::factory()->create([
            'status_jamiyyah' => "Jam'iyyah",
            'nama' => 'MI Nurul Huda',
            'npsn' => '60710001',
        ]);
        $schoolB = School::factory()->create([
            'status_jamiyyah' => "Jam'iyyah",
            'nama' => 'MTs Al-Ikhlas',
            'npsn' => '60710002',
        ]);

        // Search by nama (case-insensitive)
        $response = $this->actingAs($user, 'sanctum')
            ->getJson($this->endpoint . '?search=nurul');

        $response->assertStatus(200);
        $data = $response->json('data');
        $this->assertCount(1, $data);
        $this->assertEquals($schoolA->id, $data[0]['id']);

        // Search by NPSN
        $response = $this->actingAs($user, 'sanctum')
            ->getJson($this->endpoint . '?search=60710002');

        $response->assertStatus(200);
        $data = $response->json('data');
        $this->assertCount(1, $data);
        $this->assertEquals($schoolB->id, $data[0]['id']);

        // Search by partial nama (uppercase)
        $response = $this->actingAs($user, 'sanctum')
            ->getJson($this->endpoint . '?search=IKHLAS');

        $response->assertStatus(200);
        $data = $response->json('data');
        $this->assertCount(1, $data);
        $this->assertEquals($schoolB->id, $data[0]['id']);
    }

    /**
     * Test: period filter (start_date/end_date) correctly determines "belum mengajukan"
     *
     * Validates: Requirements 2.4
     *
     * @test
     */
    public function period_filter_correctly_determines_belum_mengajukan(): void
    {
        $user = User::factory()->create(['role' => 'super_admin']);

        // School A: has SK created in January 2025
        $schoolA = School::factory()->create([
            'status_jamiyyah' => "Jam'iyyah",
            'nama' => 'MI School A',
        ]);
        SkDocument::factory()->create([
            'school_id' => $schoolA->id,
            'created_at' => '2025-01-15 10:00:00',
        ]);

        // School B: has SK created in March 2025
        $schoolB = School::factory()->create([
            'status_jamiyyah' => "Jam'iyyah",
            'nama' => 'MI School B',
        ]);
        SkDocument::factory()->create([
            'school_id' => $schoolB->id,
            'created_at' => '2025-03-15 10:00:00',
        ]);

        // School C: no SK at all
        $schoolC = School::factory()->create([
            'status_jamiyyah' => "Jam'iyyah",
            'nama' => 'MI School C',
        ]);

        // Filter for period January 2025 — School A has SK in this period, so it should NOT appear
        // School B and C should appear (no SK in January)
        $response = $this->actingAs($user, 'sanctum')
            ->getJson($this->endpoint . '?start_date=2025-01-01&end_date=2025-01-31');

        $response->assertStatus(200);
        $data = $response->json('data');
        $ids = array_column($data, 'id');

        $this->assertNotContains($schoolA->id, $ids);
        $this->assertContains($schoolB->id, $ids);
        $this->assertContains($schoolC->id, $ids);

        // Filter for period March 2025 — School B has SK in this period, so it should NOT appear
        // School A and C should appear (no SK in March)
        $response = $this->actingAs($user, 'sanctum')
            ->getJson($this->endpoint . '?start_date=2025-03-01&end_date=2025-03-31');

        $response->assertStatus(200);
        $data = $response->json('data');
        $ids = array_column($data, 'id');

        $this->assertContains($schoolA->id, $ids);
        $this->assertNotContains($schoolB->id, $ids);
        $this->assertContains($schoolC->id, $ids);
    }

    /**
     * Test: soft-deleted schools are excluded
     *
     * Validates: Requirements 1.1
     *
     * @test
     */
    public function soft_deleted_schools_are_excluded(): void
    {
        $user = User::factory()->create(['role' => 'super_admin']);

        // Active jam'iyyah school — should appear
        $activeSchool = School::factory()->create([
            'status_jamiyyah' => "Jam'iyyah",
            'nama' => 'MI Active School',
        ]);

        // Soft-deleted jam'iyyah school — should NOT appear
        $deletedSchool = School::factory()->create([
            'status_jamiyyah' => "Jam'iyyah",
            'nama' => 'MI Deleted School',
        ]);
        $deletedSchool->delete();

        $response = $this->actingAs($user, 'sanctum')
            ->getJson($this->endpoint);

        $response->assertStatus(200);

        $data = $response->json('data');
        $ids = array_column($data, 'id');

        $this->assertContains($activeSchool->id, $ids);
        $this->assertNotContains($deletedSchool->id, $ids);
    }

    /**
     * Test: total count matches data array length
     *
     * Validates: Requirements 1.3
     *
     * @test
     */
    public function total_count_matches_data_array_length(): void
    {
        $user = User::factory()->create(['role' => 'super_admin']);

        // Create 5 jam'iyyah schools without SK
        School::factory()->count(5)->create([
            'status_jamiyyah' => "Jam'iyyah",
        ]);

        // Create 2 jam'iyyah schools WITH SK (should not count)
        $schoolsWithSk = School::factory()->count(2)->create([
            'status_jamiyyah' => "Jam'iyyah",
        ]);
        foreach ($schoolsWithSk as $school) {
            SkDocument::factory()->create(['school_id' => $school->id]);
        }

        $response = $this->actingAs($user, 'sanctum')
            ->getJson($this->endpoint);

        $response->assertStatus(200);

        $total = $response->json('total');
        $data = $response->json('data');

        $this->assertEquals(count($data), $total);
        $this->assertEquals(5, $total);
    }

    // =========================================================================
    // Excel Export Endpoint Tests
    // =========================================================================

    private string $exportEndpoint = '/api/reports/sk-belum-mengajukan/export';

    /**
     * Test: export returns downloadable .xlsx file
     *
     * Validates: Requirements 3.1
     *
     * @test
     */
    public function export_returns_downloadable_xlsx_file(): void
    {
        $user = User::factory()->create(['role' => 'super_admin']);

        School::factory()->create([
            'status_jamiyyah' => "Jam'iyyah",
            'jenjang' => 'MI',
            'nama' => 'MI Test Export',
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->get($this->exportEndpoint);

        $response->assertStatus(200);
        $response->assertHeader(
            'Content-Disposition'
        );

        // Verify filename pattern in Content-Disposition header
        $contentDisposition = $response->headers->get('Content-Disposition');
        $this->assertStringContainsString('Laporan_Belum_Mengajukan_SK_', $contentDisposition);
        $this->assertStringContainsString('.xlsx', $contentDisposition);
    }

    /**
     * Test: export returns correct Content-Type header
     *
     * Validates: Requirements 3.1
     *
     * @test
     */
    public function export_returns_correct_content_type_header(): void
    {
        $user = User::factory()->create(['role' => 'super_admin']);

        School::factory()->create([
            'status_jamiyyah' => "Jam'iyyah",
            'jenjang' => 'MI',
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->get($this->exportEndpoint);

        $response->assertStatus(200);
        $response->assertHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
    }

    /**
     * Test: export respects active filters
     *
     * Validates: Requirements 3.1
     *
     * @test
     */
    public function export_respects_active_filters(): void
    {
        $user = User::factory()->create(['role' => 'super_admin']);

        School::factory()->create([
            'status_jamiyyah' => "Jam'iyyah",
            'jenjang' => 'MI',
            'nama' => 'MI Filtered School',
        ]);
        School::factory()->create([
            'status_jamiyyah' => "Jam'iyyah",
            'jenjang' => 'MTs',
            'nama' => 'MTs Other School',
        ]);

        // Export with jenjang filter — should still return 200 (file generated)
        $response = $this->actingAs($user, 'sanctum')
            ->get($this->exportEndpoint . '?jenjang=MI');

        $response->assertStatus(200);
        $response->assertHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );

        // Export without filter should also succeed
        $response = $this->actingAs($user, 'sanctum')
            ->get($this->exportEndpoint);

        $response->assertStatus(200);
    }

    /**
     * Test: export returns 403 for operator role
     *
     * Validates: Requirements 3.4
     *
     * @test
     */
    public function export_returns_403_for_operator_role(): void
    {
        $school = School::factory()->create();
        $user = User::factory()->create([
            'role' => 'operator',
            'school_id' => $school->id,
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->getJson($this->exportEndpoint);

        $response->assertStatus(403);
        $response->assertJson([
            'message' => 'Akses ditolak. Hanya super admin dan admin yayasan yang dapat mengakses laporan ini.',
        ]);
    }
}
