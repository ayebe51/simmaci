<?php

namespace Tests\Feature;

use App\Models\School;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Feature: nim-generator-sk
 * Tests for GET /api/teachers/nim/generate (previewNim endpoint)
 *
 * Property 1: NIM yang di-generate mencari gap pertama mulai dari urutan 3832 (113403832).
 * — Jika tidak ada NIM valid >= scan start, kembalikan 113403832.
 * — Jika ada gap di range 113403832..MAX, kembalikan gap pertama.
 * — Jika tidak ada gap, kembalikan MAX+1.
 */
class PreviewNimTest extends TestCase
{
    use RefreshDatabase;

    // Titik awal scan gap — harus sama dengan $scanStartSeq di TeacherController::previewNim()
    private const SCAN_START = '113403832';

    private User $operator;
    private School $school;

    protected function setUp(): void
    {
        parent::setUp();

        $this->school = School::factory()->create(['nama' => 'MI Test Cilacap']);

        $this->operator = User::factory()->create([
            'role'      => 'operator',
            'school_id' => $this->school->id,
            'is_active' => true,
        ]);
    }

    // ── Authentication ────────────────────────────────────────────────────────

    public function test_unauthenticated_request_is_rejected(): void
    {
        $response = $this->getJson('/api/teachers/nim/generate');

        $response->assertUnauthorized();
    }

    // ── Empty Database ────────────────────────────────────────────────────────

    /**
     * Empty DB: first NIM must be the scan start point (113403832)
     */
    public function test_returns_first_nim_when_no_teachers_exist(): void
    {
        $response = $this->actingAs($this->operator)
            ->getJson('/api/teachers/nim/generate');

        $response->assertOk()
            ->assertJsonStructure(['success', 'message', 'data' => ['nim', 'current_max']])
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.nim', self::SCAN_START)
            ->assertJsonPath('data.current_max', null);
    }

    /**
     * Teachers exist but none have a valid 1134XXXXX NIM — should return scan start
     */
    public function test_returns_first_nim_when_no_valid_format_nims_exist(): void
    {
        Teacher::factory()->forSchool($this->school)->create(['nomor_induk_maarif' => null]);
        Teacher::factory()->forSchool($this->school)->create(['nomor_induk_maarif' => 'ABC123']);
        Teacher::factory()->forSchool($this->school)->create(['nomor_induk_maarif' => '999900001']);

        $response = $this->actingAs($this->operator)
            ->getJson('/api/teachers/nim/generate');

        $response->assertOk()
            ->assertJsonPath('data.nim', self::SCAN_START)
            ->assertJsonPath('data.current_max', null);
    }

    // ── NIMs below scan start ─────────────────────────────────────────────────

    /**
     * All NIMs below scan start: return scan start (gap at scan start)
     */
    public function test_returns_scan_start_when_all_nims_below_start(): void
    {
        foreach (['113400001', '113400050', '113400139'] as $nim) {
            Teacher::factory()->forSchool($this->school)->create(['nomor_induk_maarif' => $nim]);
        }

        $response = $this->actingAs($this->operator)
            ->getJson('/api/teachers/nim/generate');

        $response->assertOk()
            ->assertJsonPath('data.nim', self::SCAN_START);
    }

    // ── NIMs at/above scan start ──────────────────────────────────────────────

    /**
     * Scan start exists: next must be scan start + 1
     */
    public function test_returns_next_when_scan_start_nim_exists(): void
    {
        Teacher::factory()->forSchool($this->school)->create([
            'nomor_induk_maarif' => self::SCAN_START,
        ]);

        $response = $this->actingAs($this->operator)
            ->getJson('/api/teachers/nim/generate');

        $response->assertOk()
            ->assertJsonPath('data.nim', '113403833')
            ->assertJsonPath('data.current_max', self::SCAN_START);
    }

    /**
     * GAP scenario: 113403832 and 113403834 exist, 113403833 missing → return 113403833
     */
    public function test_returns_gap_when_gap_exists_in_scan_range(): void
    {
        Teacher::factory()->forSchool($this->school)->create(['nomor_induk_maarif' => '113403832']);
        Teacher::factory()->forSchool($this->school)->create(['nomor_induk_maarif' => '113403834']);

        $response = $this->actingAs($this->operator)
            ->getJson('/api/teachers/nim/generate');

        $response->assertOk()
            ->assertJsonPath('data.nim', '113403833')
            ->assertJsonPath('data.has_gap', true);
    }

    /**
     * No gap in scan range: return MAX+1
     */
    public function test_returns_max_plus_one_when_no_gap_in_scan_range(): void
    {
        Teacher::factory()->forSchool($this->school)->create(['nomor_induk_maarif' => '113403832']);
        Teacher::factory()->forSchool($this->school)->create(['nomor_induk_maarif' => '113403833']);
        Teacher::factory()->forSchool($this->school)->create(['nomor_induk_maarif' => '113403834']);

        $response = $this->actingAs($this->operator)
            ->getJson('/api/teachers/nim/generate');

        $response->assertOk()
            ->assertJsonPath('data.nim', '113403835')
            ->assertJsonPath('data.has_gap', false);
    }

    /**
     * Gap at scan start: 113403833 exists but 113403832 missing → return 113403832
     */
    public function test_fills_gap_at_scan_start(): void
    {
        Teacher::factory()->forSchool($this->school)->create(['nomor_induk_maarif' => '113403833']);
        Teacher::factory()->forSchool($this->school)->create(['nomor_induk_maarif' => '113403834']);

        $response = $this->actingAs($this->operator)
            ->getJson('/api/teachers/nim/generate');

        $response->assertOk()
            ->assertJsonPath('data.nim', self::SCAN_START)
            ->assertJsonPath('data.has_gap', true);
    }

    /**
     * Non-sequential NIMs above scan start — uses global max, fills first gap
     */
    public function test_uses_max_nim_not_last_inserted(): void
    {
        Teacher::factory()->forSchool($this->school)->create(['nomor_induk_maarif' => '113403900']);
        Teacher::factory()->forSchool($this->school)->create(['nomor_induk_maarif' => '113403832']);
        Teacher::factory()->forSchool($this->school)->create(['nomor_induk_maarif' => '113403999']);
        Teacher::factory()->forSchool($this->school)->create(['nomor_induk_maarif' => '113403850']);

        $response = $this->actingAs($this->operator)
            ->getJson('/api/teachers/nim/generate');

        $response->assertOk()
            // 113403832 exists, 113403833 is free → gap at 113403833
            ->assertJsonPath('data.nim', '113403833')
            ->assertJsonPath('data.current_max', '113403999');
    }

    // ── Format 1134XXXXX ──────────────────────────────────────────────────────

    /**
     * Property 4 — generated NIM must be exactly 9 chars, start with "1134", purely numeric
     */
    public function test_generated_nim_has_correct_format(): void
    {
        $response = $this->actingAs($this->operator)
            ->getJson('/api/teachers/nim/generate');

        $response->assertOk();

        $nim = $response->json('data.nim');

        $this->assertIsString($nim);
        $this->assertSame(9, strlen($nim), "NIM must be exactly 9 characters, got: {$nim}");
        $this->assertStringStartsWith('1134', $nim, "NIM must start with '1134'");
        $this->assertMatchesRegularExpression('/^[0-9]+$/', $nim, "NIM must be purely numeric");
    }

    /**
     * Property 4 — zero-padding: sequence must be zero-padded to 5 digits
     */
    public function test_generated_nim_has_zero_padded_sequence(): void
    {
        $response = $this->actingAs($this->operator)
            ->getJson('/api/teachers/nim/generate');

        $response->assertOk()
            ->assertJsonPath('data.nim', self::SCAN_START);

        $nim = $response->json('data.nim');
        $sequence = substr($nim, 4);
        $this->assertSame(5, strlen($sequence), "Sequence part must be exactly 5 digits");
    }

    // ── Global Scope (cross-tenant) ───────────────────────────────────────────

    /**
     * NIM generation uses global MAX across all tenants, fills gap from scan start
     */
    public function test_nim_generation_uses_global_max_across_tenants(): void
    {
        $otherSchool = School::factory()->create(['nama' => 'MI Other School']);

        Teacher::factory()->forSchool($otherSchool)->create(['nomor_induk_maarif' => '113403900']);
        Teacher::factory()->forSchool($this->school)->create(['nomor_induk_maarif' => '113403832']);

        $response = $this->actingAs($this->operator)
            ->getJson('/api/teachers/nim/generate');

        $response->assertOk()
            // 113403832 exists, 113403833 is free → gap at 113403833
            ->assertJsonPath('data.nim', '113403833')
            ->assertJsonPath('data.current_max', '113403900');
    }

    // ── Response Structure ────────────────────────────────────────────────────

    public function test_response_has_correct_structure(): void
    {
        $response = $this->actingAs($this->operator)
            ->getJson('/api/teachers/nim/generate');

        $response->assertOk()
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'nim',
                    'current_max',
                    'has_gap',
                ],
            ])
            ->assertJsonPath('success', true);
    }

    // ── Data Provider ─────────────────────────────────────────────────────────

    #[\PHPUnit\Framework\Attributes\DataProvider('nimSequenceProvider')]
    public function test_generated_nim_is_max_plus_one(array $existingNims, string $expectedNext): void
    {
        foreach ($existingNims as $nim) {
            Teacher::factory()->forSchool($this->school)->create([
                'nomor_induk_maarif' => $nim,
            ]);
        }

        $response = $this->actingAs($this->operator)
            ->getJson('/api/teachers/nim/generate');

        $response->assertOk()
            ->assertJsonPath('data.nim', $expectedNext);
    }

    public static function nimSequenceProvider(): array
    {
        return [
            // Kosong / di bawah scan start → kembalikan scan start
            'empty database'              => [[], '113403832'],
            'only non-1134 nims'          => [['999900001', '888800001'], '113403832'],
            'nims below scan start'       => [['113400001', '113400050', '113400139'], '113403832'],
            'large nim below scan start'  => [['113403831'], '113403832'],

            // Di atas scan start: gap fill atau MAX+1
            'scan start exists'           => [['113403832'], '113403833'],
            'gap at scan start'           => [['113403833'], '113403832'],
            'contiguous from start'       => [['113403832', '113403833', '113403834'], '113403835'],
            'gap in middle'               => [['113403832', '113403834'], '113403833'],
            'large sequence above start'  => [['113403832', '113499998'], '113403833'],
            'non-sequential above start'  => [['113403832', '113403900', '113403850'], '113403833'],
        ];
    }
}
