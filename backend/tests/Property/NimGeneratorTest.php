<?php

namespace Tests\Property;

use App\Models\School;
use App\Models\Teacher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Property-Based Tests for NIM Generator Feature
 *
 * Feature: nim-generator-sk
 *
 * Properties tested:
 *   Property 1: NIM generate = gap-fill mulai dari 113403832, fallback MAX+1
 *   Property 3: Global uniqueness — no two teachers may share the same NIM
 *   Property 5: Format validation — non-numeric NIM rejected
 *
 * @group nim-generator
 */
class NimGeneratorTest extends TestCase
{
    use RefreshDatabase;

    // Titik awal scan gap — harus sama dengan $scanStartSeq di TeacherController::previewNim()
    private const SCAN_START_SEQ = 3832;
    private const SCAN_START_NIM = '113403832';

    private School $school;

    protected function setUp(): void
    {
        parent::setUp();

        $this->school = School::factory()->create(['nama' => 'MI Nurul Huda']);
    }

    // ── Property 1: NIM generate = gap-fill dari scan start ──────────────────

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

        $response = $this->actingAs($this->createOperator())
            ->getJson('/api/teachers/nim/generate');

        $response->assertOk()
            ->assertJsonPath('data.nim', $expectedNext);
    }

    public static function nimSequenceProvider(): array
    {
        return [
            // Kosong / di bawah scan start → kembalikan scan start
            'empty database'              => [[], self::SCAN_START_NIM],
            'only non-1134 nims'          => [['999900001', '888800001'], self::SCAN_START_NIM],
            'nims below scan start'       => [['113400001', '113400050', '113400139'], self::SCAN_START_NIM],
            'large sequence below start'  => [['113403831'], self::SCAN_START_NIM],

            // Di atas scan start: gap fill
            'scan start exists'           => [['113403832'], '113403833'],
            'gap at scan start'           => [['113403833'], '113403832'],
            'contiguous from start'       => [['113403832', '113403833', '113403834'], '113403835'],
            'gap in middle of range'      => [['113403832', '113403834'], '113403833'],
            'large sequence above start'  => [['113403832', '113499998'], '113403833'],
            'non-sequential above start'  => [['113403832', '113403900', '113403850'], '113403833'],

            // Khusus: NIM di bawah start dan di atas start
            'mix below and above start'   => [['113400001', '113403832', '113403834'], '113403833'],
        ];
    }

    /**
     * Property 1 — Property: generated NIM format always valid, behaviour follows gap-fill
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('nimSetProvider')]
    public function test_property_nim_generation_follows_max_plus_one(array $existingNims): void
    {
        foreach ($existingNims as $nim) {
            Teacher::factory()->forSchool($this->school)->create([
                'nomor_induk_maarif' => $nim,
            ]);
        }

        $response = $this->actingAs($this->createOperator())
            ->getJson('/api/teachers/nim/generate');

        $response->assertOk();
        $generatedNim = $response->json('data.nim');

        // Verify format: 1134 + 5 digits
        $this->assertMatchesRegularExpression('/^1134[0-9]{5}$/', $generatedNim);

        // Filter only valid 1134XXXXX NIMs at/above scan start
        $validNims = array_filter($existingNims, function ($nim) {
            return preg_match('/^1134[0-9]{5}$/', $nim)
                && (int) substr($nim, 4) >= self::SCAN_START_SEQ;
        });

        if (empty($validNims)) {
            // No NIMs at/above scan start → must return scan start
            $this->assertSame(self::SCAN_START_NIM, $generatedNim);
        } else {
            // There are NIMs in scan range — result must be a valid 1134XXXXX not in existing set
            $this->assertNotContains($generatedNim, $existingNims,
                "Generated NIM must not already exist");
            // And must be >= scan start
            $this->assertGreaterThanOrEqual(
                (int) self::SCAN_START_NIM,
                (int) $generatedNim,
                "Generated NIM must be >= scan start"
            );
        }
    }

    public static function nimSetProvider(): array
    {
        return [
            'empty set'       => [[]],
            'below start'     => [['113400001']],
            'at start'        => [['113403832']],
            'above start'     => [['113403832', '113403833']],
            'many nims'       => [['113403832', '113403833', '113403834', '113403835']],
            'random order'    => [['113403900', '113403832', '113403999', '113403850']],
            'consecutive'     => [['113403832', '113403833', '113403834', '113403835', '113403836']],
        ];
    }

    // ── Property 3: Global uniqueness ──────────────────────────────────────────

    /**
     * Property 3 — duplicate NIM across different tenants returns 422
     *
     * FOR ANY two teachers from different schools (tenants), they MUST NOT
     * have the same NIM value. Attempting to save a duplicate NIM must
     * always result in a 422 response.
     *
     * Validates: Requirements 4.1, 4.3, 11.1
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('duplicateNimProvider')]
    public function test_duplicate_nim_rejected_globally(string $nim): void
    {
        // Create two different schools
        $schoolA = School::factory()->create(['nama' => "School A - NIM {$nim}"]);
        $schoolB = School::factory()->create(['nama' => "School B - NIM {$nim}"]);

        // Create teacher A in school A with the NIM
        $teacherA = Teacher::factory()->forSchool($schoolA)->create([
            'nama'               => 'Guru A',
            'nomor_induk_maarif' => $nim,
        ]);

        // Create teacher B in school B without NIM
        $teacherB = Teacher::factory()->forSchool($schoolB)->create([
            'nama'               => 'Guru B',
            'nomor_induk_maarif' => null,
        ]);

        // Attempt to save the same NIM to teacher B
        $response = $this->actingAs($this->createOperatorForSchool($schoolB))
            ->patchJson("/api/teachers/{$teacherB->id}/nim", [
                'nim' => $nim,
            ]);

        // Must reject with 422 (global uniqueness)
        $response->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'NIM sudah digunakan oleh guru lain.');

        // Verify teacher B was NOT updated
        $this->assertDatabaseMissing('teachers', [
            'id'                 => $teacherB->id,
            'nomor_induk_maarif' => $nim,
        ]);

        // Verify teacher A still has the NIM
        $this->assertDatabaseHas('teachers', [
            'id'                 => $teacherA->id,
            'nomor_induk_maarif' => $nim,
        ]);
    }

    public static function duplicateNimProvider(): array
    {
        return [
            'simple duplicate' => ['113400140'],
            'large NIM' => ['113499999'],
            'small NIM' => ['113400001'],
        ];
    }

    /**
     * Property 3 — Property: For ANY teacher and ANY NIM, if another teacher
     * already has that NIM, saving it to the new teacher must fail.
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('uniqueNimProvider')]
    public function test_property_global_uniqueness_for_any_nim(string $nim): void
    {
        $schoolA = School::factory()->create(['nama' => "School A - NIM {$nim}"]);
        $schoolB = School::factory()->create(['nama' => "School B - NIM {$nim}"]);

        // Teacher A has the NIM
        $teacherA = Teacher::factory()->forSchool($schoolA)->create([
            'nama'               => "Guru A - {$nim}",
            'nomor_induk_maarif' => $nim,
        ]);

        // Teacher B does not have the NIM
        $teacherB = Teacher::factory()->forSchool($schoolB)->create([
            'nama'               => "Guru B - {$nim}",
            'nomor_induk_maarif' => null,
        ]);

        // Attempt to save NIM to teacher B
        $response = $this->actingAs($this->createOperatorForSchool($schoolB))
            ->patchJson("/api/teachers/{$teacherB->id}/nim", [
                'nim' => $nim,
            ]);

        // Must always fail (global uniqueness property)
        $response->assertStatus(422);

        // Verify teacher B was NOT updated
        $this->assertDatabaseMissing('teachers', [
            'id'                 => $teacherB->id,
            'nomor_induk_maarif' => $nim,
        ]);
    }

    public static function uniqueNimProvider(): array
    {
        return [
            'NIM 00001' => ['113400001'],
            'NIM 00139' => ['113400139'],
            'NIM 00500' => ['113400500'],
            'NIM 00999' => ['113400999'],
            'NIM 10000' => ['113410000'],
        ];
    }

    // ── Property 5: Format validation ──────────────────────────────────────────

    /**
     * Property 5 — non-numeric NIM returns 422
     *
     * FOR ANY string containing at least one non-digit character, the
     * PATCH /api/teachers/{id}/nim endpoint must return 422 with validation error.
     *
     * Validates: Requirements 7.2
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('invalidNimFormatProvider')]
    public function test_non_numeric_nim_rejected(string $invalidNim, string $description): void
    {
        $teacher = Teacher::factory()->forSchool($this->school)->create([
            'nama'               => 'Guru Test',
            'nomor_induk_maarif' => null,
        ]);

        $response = $this->actingAs($this->createOperator())
            ->patchJson("/api/teachers/{$teacher->id}/nim", [
                'nim' => $invalidNim,
            ]);

        // Must reject with 422 (format validation)
        $response->assertStatus(422)
            ->assertJsonStructure(['errors' => ['nim']]);

        // Verify teacher was NOT updated
        $this->assertDatabaseMissing('teachers', [
            'id'                 => $teacher->id,
            'nomor_induk_maarif' => $invalidNim,
        ]);
    }

    public static function invalidNimFormatProvider(): array
    {
        return [
            'letters only'          => ['abc', 'alphabetical string'],
            'mixed alphanumeric'    => ['12a3', 'alphanumeric with letter in middle'],
            // Note: 'decimal' (12.3), 'space in middle' (12 3), 'hyphen' (12-3),
            // 'newline', 'tab' are now ACCEPTED and normalized (separator chars stripped).
            'hex notation'          => ['0x1F', 'hexadecimal'],
            'plus sign'             => ['+123', 'with plus sign'],
            'special chars'         => ['#123', 'with hash'],
            'underscore'            => ['_123', 'with underscore'],
            'parentheses'           => ['(123)', 'with parentheses'],
            'brackets'              => ['[123]', 'with brackets'],
            'curly braces'          => ['{123}', 'with curly braces'],
            'arabic numerals'       => ['١٢٣', 'Arabic-Indic digits'],
            'empty string'          => ['', 'empty string'],
            'mixed special'         => ['12@#3', 'mixed special characters'],
        ];
    }

    /**
     * Property 5 — Property: For ANY input containing non-digit characters,
     * the endpoint must reject with 422.
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('nonDigitStringProvider')]
    public function test_property_format_validation_rejects_any_non_digit(string $invalidNim): void
    {
        $teacher = Teacher::factory()->forSchool($this->school)->create([
            'nama'               => 'Guru Test',
            'nomor_induk_maarif' => null,
        ]);

        $response = $this->actingAs($this->createOperator())
            ->patchJson("/api/teachers/{$teacher->id}/nim", [
                'nim' => $invalidNim,
            ]);

        // Must always reject (format validation property)
        $response->assertStatus(422);

        // Verify teacher was NOT updated
        $this->assertDatabaseMissing('teachers', [
            'id'                 => $teacher->id,
            'nomor_induk_maarif' => $invalidNim,
        ]);
    }

    public static function nonDigitStringProvider(): array
    {
        $strings = [];
        
        // Add letters
        foreach (['a', 'abc', 'ABC', 'a1b2c3', 'test'] as $str) {
            $strings["letter: {$str}"] = [$str];
        }

        // Add special characters (excluding whitespace-only and separator chars that are normalized)
        // Note: '-' (hyphen) and '.' (dot) are now ACCEPTED as separators and normalized away.
        foreach (['@', '#', '$', '%', '^', '&', '*', '(', ')', '_', '=', '+', '[', ']', '{', '}', '|', '\\', ':', ';', '<', '>', ',', '?', '/', '~', '`'] as $char) {
            $strings["special: {$char}"] = [$char . '123'];
        }

        // Add mixed
        foreach (['12@3', '1@2@3', 'test123', '123test'] as $str) {
            $strings["mixed: {$str}"] = [$str];
        }

        return $strings;
    }

    // ── Helper Methods ─────────────────────────────────────────────────────────

    private function createOperator(): \App\Models\User
    {
        return \App\Models\User::factory()->create([
            'role'      => 'operator',
            'school_id' => $this->school->id,
            'is_active' => true,
        ]);
    }

    private function createOperatorForSchool(School $school): \App\Models\User
    {
        return \App\Models\User::factory()->create([
            'role'      => 'operator',
            'school_id' => $school->id,
            'is_active' => true,
        ]);
    }
}
