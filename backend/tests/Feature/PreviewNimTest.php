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
 * Property 1: NIM yang di-generate selalu mengikuti sequence 1134XXXXX
 * — For any set of existing NIMs, the generated NIM must be 1134 + (max_seq + 1, zero-padded 5 digits).
 * — If no NIMs exist, the first generated NIM must be "113400001".
 */
class PreviewNimTest extends TestCase
{
    use RefreshDatabase;

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
     * Property 1 — empty DB: first NIM must be "113400001"
     */
    public function test_returns_first_nim_when_no_teachers_exist(): void
    {
        $response = $this->actingAs($this->operator)
            ->getJson('/api/teachers/nim/generate');

        $response->assertOk()
            ->assertJsonStructure(['success', 'message', 'data' => ['nim', 'current_max']])
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.nim', '113400001')
            ->assertJsonPath('data.current_max', null);
    }

    /**
     * Teachers exist but none have a valid 1134XXXXX NIM — should still return "113400001"
     */
    public function test_returns_first_nim_when_no_valid_format_nims_exist(): void
    {
        // Teachers with non-1134 NIMs or null NIMs
        Teacher::factory()->forSchool($this->school)->create(['nomor_induk_maarif' => null]);
        Teacher::factory()->forSchool($this->school)->create(['nomor_induk_maarif' => 'ABC123']);
        Teacher::factory()->forSchool($this->school)->create(['nomor_induk_maarif' => '999900001']);

        $response = $this->actingAs($this->operator)
            ->getJson('/api/teachers/nim/generate');

        $response->assertOk()
            ->assertJsonPath('data.nim', '113400001')
            ->assertJsonPath('data.current_max', null);
    }

    // ── Single NIM ────────────────────────────────────────────────────────────

    /**
     * Property 1 — single NIM: next must be current + 1
     */
    public function test_returns_next_nim_when_single_nim_exists(): void
    {
        Teacher::factory()->forSchool($this->school)->create([
            'nomor_induk_maarif' => '113400001',
        ]);

        $response = $this->actingAs($this->operator)
            ->getJson('/api/teachers/nim/generate');

        $response->assertOk()
            ->assertJsonPath('data.nim', '113400002')
            ->assertJsonPath('data.current_max', '113400001');
    }

    // ── Multiple NIMs ─────────────────────────────────────────────────────────

    /**
     * Property 1 — multiple NIMs: next must be MAX + 1
     */
    public function test_returns_max_plus_one_when_multiple_nims_exist(): void
    {
        $nims = ['113400001', '113400050', '113400139'];
        foreach ($nims as $nim) {
            Teacher::factory()->forSchool($this->school)->create([
                'nomor_induk_maarif' => $nim,
            ]);
        }

        $response = $this->actingAs($this->operator)
            ->getJson('/api/teachers/nim/generate');

        $response->assertOk()
            ->assertJsonPath('data.nim', '113400140')
            ->assertJsonPath('data.current_max', '113400139');
    }

    /**
     * Non-sequential NIMs: next must still be MAX + 1 (not last inserted)
     */
    public function test_uses_max_nim_not_last_inserted(): void
    {
        // Insert in non-sequential order
        Teacher::factory()->forSchool($this->school)->create(['nomor_induk_maarif' => '113400500']);
        Teacher::factory()->forSchool($this->school)->create(['nomor_induk_maarif' => '113400001']);
        Teacher::factory()->forSchool($this->school)->create(['nomor_induk_maarif' => '113400999']);
        Teacher::factory()->forSchool($this->school)->create(['nomor_induk_maarif' => '113400200']);

        $response = $this->actingAs($this->operator)
            ->getJson('/api/teachers/nim/generate');

        $response->assertOk()
            ->assertJsonPath('data.nim', '113401000')
            ->assertJsonPath('data.current_max', '113400999');
    }

    // ── Format 1134XXXXX ──────────────────────────────────────────────────────

    /**
     * Property 4 — generated NIM must be exactly 9 chars, start with "1134", followed by 5 digits
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
        // With no existing NIMs, first NIM should be "113400001" (not "11341")
        $response = $this->actingAs($this->operator)
            ->getJson('/api/teachers/nim/generate');

        $response->assertOk()
            ->assertJsonPath('data.nim', '113400001');

        $nim = $response->json('data.nim');
        $sequence = substr($nim, 4); // last 5 chars
        $this->assertSame(5, strlen($sequence), "Sequence part must be exactly 5 digits");
    }

    // ── Global Scope (cross-tenant) ───────────────────────────────────────────

    /**
     * Property 1 + Requirement 11.3 — NIM generation uses global MAX across all tenants
     */
    public function test_nim_generation_uses_global_max_across_tenants(): void
    {
        $otherSchool = School::factory()->create(['nama' => 'MI Other School']);

        // Teacher in a different school (different tenant) has a higher NIM
        Teacher::factory()->forSchool($otherSchool)->create([
            'nomor_induk_maarif' => '113400500',
        ]);

        // Teacher in operator's school has a lower NIM
        Teacher::factory()->forSchool($this->school)->create([
            'nomor_induk_maarif' => '113400100',
        ]);

        $response = $this->actingAs($this->operator)
            ->getJson('/api/teachers/nim/generate');

        $response->assertOk()
            // Must use the global max (500), not the tenant-scoped max (100)
            ->assertJsonPath('data.nim', '113400501')
            ->assertJsonPath('data.current_max', '113400500');
    }

    // ── Gap Handling ──────────────────────────────────────────────────────────

    /**
     * If MAX+1 is already taken (gap scenario), skip to next available
     */
    public function test_skips_already_taken_nim_in_gap_scenario(): void
    {
        // Simulate a gap: 001 and 003 exist, 002 is missing but 003 is the max
        Teacher::factory()->forSchool($this->school)->create(['nomor_induk_maarif' => '113400001']);
        Teacher::factory()->forSchool($this->school)->create(['nomor_induk_maarif' => '113400003']);

        // MAX is 003, so next candidate is 004 — which is free
        $response = $this->actingAs($this->operator)
            ->getJson('/api/teachers/nim/generate');

        $response->assertOk()
            ->assertJsonPath('data.nim', '113400004');
    }

    // ── Response Structure ────────────────────────────────────────────────────

    /**
     * Response must follow the standard ApiResponse shape
     */
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
                ],
            ])
            ->assertJsonPath('success', true);
    }

    // ── Data Provider — Property 1 ────────────────────────────────────────────

    /**
     * Property 1 — data provider: various existing NIM sets → expected next NIM
     */
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
            'empty database'          => [[], '113400001'],
            'single nim 001'          => [['113400001'], '113400002'],
            'single nim 139'          => [['113400139'], '113400140'],
            'multiple nims'           => [['113400001', '113400050', '113400139'], '113400140'],
            'large sequence'          => [['113499998'], '113499999'],
            'non-sequential nims'     => [['113400001', '113400999', '113400500'], '113401000'],
            'only non-1134 nims'      => [['999900001', '888800001'], '113400001'],
        ];
    }
}
