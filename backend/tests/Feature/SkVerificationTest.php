<?php

namespace Tests\Feature;

use App\Models\School;
use App\Models\SkDocument;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Tests for GET /api/verify/sk/{nomor} — public SK verification endpoint.
 *
 * Covers:
 *   5.3 — 200 + is_expired: false  for approved SK still within 1 year
 *   5.4 — 200 + is_expired: true   for approved SK older than 1 year
 *   5.5 — 404 for pending SK or non-existent nomor
 */
class SkVerificationTest extends TestCase
{
    use RefreshDatabase;

    private School $school;

    protected function setUp(): void
    {
        parent::setUp();

        $this->school = School::factory()->create([
            'nama' => 'MI Darwata Glempang',
        ]);
    }

    // ── Helper ────────────────────────────────────────────────

    private function makeApprovedSk(string $nomorSk, string $tanggalPenetapan): SkDocument
    {
        return SkDocument::factory()->create([
            'nomor_sk'         => $nomorSk,
            'status'           => 'approved',
            'tanggal_penetapan'=> $tanggalPenetapan,
            'nama'             => 'AHMAD RIFAI, S.Pd.I',
            'jabatan'          => 'Guru Tetap Yayasan',
            'unit_kerja'       => 'MI Darwata Glempang',
            'jenis_sk'         => 'GTY',
            'school_id'        => $this->school->id,
        ]);
    }

    // ── Task 5.3 — Active SK returns 200 + is_expired: false ─

    /**
     * @test
     * Validates: Requirements 5.3
     * An approved SK whose tanggal_penetapan is less than 1 year ago
     * must return HTTP 200 with is_expired = false.
     */
    public function test_approved_active_sk_returns_200_with_is_expired_false(): void
    {
        // tanggal_penetapan = 6 months ago → still within 1-year window
        $tanggal = Carbon::now()->subMonths(6)->toDateString();
        $nomor   = 'SK/ACTIVE/001/2025';

        $this->makeApprovedSk($nomor, $tanggal);

        $response = $this->getJson('/api/verify/sk/' . urlencode($nomor));

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'nomor_sk'   => $nomor,
                    'nama'       => 'AHMAD RIFAI, S.Pd.I',
                    'jabatan'    => 'Guru Tetap Yayasan',
                    'unit_kerja' => 'MI Darwata Glempang',
                    'jenis_sk'   => 'GTY',
                    'status'     => 'approved',
                    'is_expired' => false,
                    'school'     => ['nama' => 'MI Darwata Glempang'],
                ],
            ]);

        // Ensure tanggal_penetapan and tanggal_kadaluarsa are present
        $data = $response->json('data');
        $this->assertArrayHasKey('tanggal_penetapan', $data);
        $this->assertArrayHasKey('tanggal_kadaluarsa', $data);
    }

    /**
     * @test
     * Validates: Requirements 5.3
     * An SK with status 'active' (alternative casing) should also return 200 + is_expired: false.
     */
    public function test_active_status_sk_returns_200_with_is_expired_false(): void
    {
        $tanggal = Carbon::now()->subMonths(3)->toDateString();
        $nomor   = 'SK/ACTIVE/002/2025';

        SkDocument::factory()->create([
            'nomor_sk'         => $nomor,
            'status'           => 'active',
            'tanggal_penetapan'=> $tanggal,
            'nama'             => 'SITI AMINAH, S.Pd',
            'jabatan'          => 'Guru Kelas',
            'unit_kerja'       => 'MI Darwata Glempang',
            'jenis_sk'         => 'GTY',
            'school_id'        => $this->school->id,
        ]);

        $response = $this->getJson('/api/verify/sk/' . urlencode($nomor));

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.is_expired', false);
    }

    // ── Task 5.4 — Expired SK returns 200 + is_expired: true ─

    /**
     * @test
     * Validates: Requirements 5.4
     * An approved SK whose tanggal_penetapan is more than 1 year ago
     * must return HTTP 200 with is_expired = true (not 404).
     */
    public function test_approved_expired_sk_returns_200_with_is_expired_true(): void
    {
        // tanggal_penetapan = 2 years ago → past the 1-year expiry
        $tanggal = Carbon::now()->subYears(2)->toDateString();
        $nomor   = 'SK/EXPIRED/001/2023';

        $this->makeApprovedSk($nomor, $tanggal);

        $response = $this->getJson('/api/verify/sk/' . urlencode($nomor));

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'nomor_sk'   => $nomor,
                    'is_expired' => true,
                    'status'     => 'approved',
                    'school'     => ['nama' => 'MI Darwata Glempang'],
                ],
            ]);
    }

    /**
     * @test
     * Validates: Requirements 5.4
     * An SK whose tanggal_penetapan is exactly 1 year + 1 day ago must be expired.
     */
    public function test_sk_just_past_one_year_is_expired(): void
    {
        $tanggal = Carbon::now()->subYear()->subDay()->toDateString();
        $nomor   = 'SK/EXPIRED/002/2024';

        $this->makeApprovedSk($nomor, $tanggal);

        $response = $this->getJson('/api/verify/sk/' . urlencode($nomor));

        $response->assertStatus(200)
            ->assertJsonPath('data.is_expired', true);
    }

    /**
     * @test
     * Validates: Requirements 5.4
     * An SK whose tanggal_penetapan is exactly 1 year ago (boundary) should be expired
     * because now() > tanggal_penetapan + 1 year is false only when strictly equal.
     * We test 1 day before expiry to confirm it is NOT expired.
     */
    public function test_sk_one_day_before_expiry_is_not_expired(): void
    {
        // 1 year - 1 day ago → expires tomorrow → not yet expired
        $tanggal = Carbon::now()->subYear()->addDay()->toDateString();
        $nomor   = 'SK/ALMOST/001/2024';

        $this->makeApprovedSk($nomor, $tanggal);

        $response = $this->getJson('/api/verify/sk/' . urlencode($nomor));

        $response->assertStatus(200)
            ->assertJsonPath('data.is_expired', false);
    }

    // ── Task 5.5 — 404 for pending SK or non-existent nomor ──

    /**
     * @test
     * Validates: Requirements 5.5
     * A non-existent nomor SK must return 404.
     */
    public function test_nonexistent_nomor_sk_returns_404(): void
    {
        $response = $this->getJson('/api/verify/sk/SK-DOES-NOT-EXIST-99999');

        $response->assertStatus(404)
            ->assertJson([
                'success' => false,
                'message' => 'Dokumen SK tidak ditemukan atau tidak aktif.',
            ]);
    }

    /**
     * @test
     * Validates: Requirements 5.5
     * An SK with status 'pending' must return 404 (not exposed publicly).
     */
    public function test_pending_sk_returns_404(): void
    {
        $nomor = 'SK/PENDING/001/2025';

        SkDocument::factory()->create([
            'nomor_sk'         => $nomor,
            'status'           => 'pending',
            'tanggal_penetapan'=> Carbon::now()->subMonths(1)->toDateString(),
            'school_id'        => $this->school->id,
        ]);

        $response = $this->getJson('/api/verify/sk/' . urlencode($nomor));

        $response->assertStatus(404)
            ->assertJson([
                'success' => false,
                'message' => 'Dokumen SK tidak ditemukan atau tidak aktif.',
            ]);
    }

    /**
     * @test
     * Validates: Requirements 5.5
     * An SK with status 'draft' must return 404.
     */
    public function test_draft_sk_returns_404(): void
    {
        $nomor = 'SK/DRAFT/001/2025';

        SkDocument::factory()->create([
            'nomor_sk'         => $nomor,
            'status'           => 'draft',
            'tanggal_penetapan'=> Carbon::now()->subMonths(1)->toDateString(),
            'school_id'        => $this->school->id,
        ]);

        $response = $this->getJson('/api/verify/sk/' . urlencode($nomor));

        $response->assertStatus(404)
            ->assertJson([
                'success' => false,
                'message' => 'Dokumen SK tidak ditemukan atau tidak aktif.',
            ]);
    }

    /**
     * @test
     * Validates: Requirements 5.5
     * An SK with status 'rejected' must return 404.
     */
    public function test_rejected_sk_returns_404(): void
    {
        $nomor = 'SK/REJECTED/001/2025';

        SkDocument::factory()->create([
            'nomor_sk'         => $nomor,
            'status'           => 'rejected',
            'tanggal_penetapan'=> Carbon::now()->subMonths(1)->toDateString(),
            'school_id'        => $this->school->id,
        ]);

        $response = $this->getJson('/api/verify/sk/' . urlencode($nomor));

        $response->assertStatus(404)
            ->assertJson([
                'success' => false,
                'message' => 'Dokumen SK tidak ditemukan atau tidak aktif.',
            ]);
    }

    // ── Additional: endpoint is public (no auth required) ────

    /**
     * @test
     * The verification endpoint must be accessible without authentication.
     */
    public function test_endpoint_is_accessible_without_authentication(): void
    {
        // No actingAs() — unauthenticated request
        $response = $this->getJson('/api/verify/sk/SK-NONEXISTENT');

        // Should get 404 (not found), not 401 (unauthorized)
        $response->assertStatus(404);
    }

    // ── Additional: response shape completeness ───────────────

    /**
     * @test
     * The 200 response must include all required fields.
     */
    public function test_200_response_contains_all_required_fields(): void
    {
        $tanggal = Carbon::now()->subMonths(6)->toDateString();
        $nomor   = 'SK/SHAPE/001/2025';

        $this->makeApprovedSk($nomor, $tanggal);

        $response = $this->getJson('/api/verify/sk/' . urlencode($nomor));

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'nomor_sk',
                    'nama',
                    'jabatan',
                    'unit_kerja',
                    'tanggal_penetapan',
                    'tanggal_kadaluarsa',
                    'jenis_sk',
                    'status',
                    'is_expired',
                    'school' => ['nama'],
                ],
            ]);
    }
}
