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
 *   Property 1: NIM generate = MAX sequence + 1 (1134XXXXX format)
 *   Property 3: Global uniqueness — no two teachers may share the same NIM
 *   Property 5: Format validation — non-numeric NIM rejected
 */
class NimGeneratorTest extends TestCase
{
    use RefreshDatabase;

    private School $school;

    protected function setUp(): void
    {
        parent::setUp();

        $this->school = School::factory()->create(['nama' => 'MI Nurul Huda']);
    }

    // ── Property 1: NIM generate = MAX sequence + 1 ───────────────────────────

    /**
     * Property 1 — data provider: various existing NIM sets → expected next NIM
     *
     * FOR ANY set of existing NIMs matching 1134XXXXX format, the generated NIM
     * must be 1134 + (max_seq + 1, zero-padded 5 digits).
     * If no valid NIMs exist, the first generated NIM must be "113400001".
     *
     * Validates: Requirements 2.2, 7.4, 11.3
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
            'empty database'          => [[], '113400001'],
            'single nim 001'          => [['113400001'], '113400002'],
            'single nim 139'          => [['113400139'], '113400140'],
            'multiple nims'           => [['113400001', '113400050', '113400139'], '113400140'],
            'large sequence'          => [['113499998'], '113499999'],
            'non-sequential nims'     => [['113400001', '113400999', '113400500'], '113401000'],
            'only non-1134 nims'      => [['999900001', '888800001'], '113400001'],
            'with gaps'               => [['113400001', '113400003'], '113400004'],
            'very large sequence'     => [['113450000', '113450001', '113450002'], '113450003'],
        ];
    }

    /**
     * Property 1 — Property: For ANY valid NIM set, generated NIM = MAX + 1
     *
     * This test uses a comprehensive set of inputs to verify the MAX + 1 property
     * holds across various scenarios.
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
        $currentMax = $response->json('data.current_max');

        // Verify format: 1134 + 5 digits
        $this->assertMatchesRegularExpression('/^1134[0-9]{5}$/', $generatedNim);

        if (empty($existingNims)) {
            // No existing NIMs → first NIM must be 113400001
            $this->assertSame('113400001', $generatedNim);
            $this->assertNull($currentMax);
        } else {
            // With existing NIMs → generated = MAX + 1
            $maxExisting = max(array_map('intval', $existingNims));
            $expectedNext = '1134' . str_pad((string)($maxExisting + 1), 5, '0', STR_PAD_LEFT);
            $this->assertSame($expectedNext, $generatedNim);
        }
    }

    public static function nimSetProvider(): array
    {
        return [
            'empty set' => [[]],
            'single nim' => [['113400001']],
            'two nims' => [['113400001', '113400002']],
            'many nims' => [['113400001', '113400100', '113400200', '113400300', '113400400']],
            'random order' => [['113400500', '113400001', '113400999', '113400250']],
            'consecutive' => [['113400001', '113400002', '113400003', '113400004', '113400005']],
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
    public function test_duplicate_nim_rejected_globally(int $schoolIdA, int $schoolIdB, string $nim): void
    {
        $schoolA = School::find($schoolIdA);
        $schoolB = School::find($schoolIdB);

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
            'simple duplicate' => [1, 2, '113400140'],
            'large NIM' => [1, 2, '113499999'],
            'small NIM' => [1, 2, '113400001'],
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
            'decimal'               => ['12.3', 'decimal number'],
            'space in middle'       => ['12 3', 'space in middle'],
            'space at start'        => [' 123', 'leading space'],
            'space at end'          => ['123 ', 'trailing space'],
            'hyphen'                => ['12-3', 'hyphenated'],
            'hex notation'          => ['0x1F', 'hexadecimal'],
            'plus sign'             => ['+123', 'with plus sign'],
            'special chars'         => ['#123', 'with hash'],
            'underscore'            => ['_123', 'with underscore'],
            'parentheses'           => ['(123)', 'with parentheses'],
            'brackets'              => ['[123]', 'with brackets'],
            'curly braces'          => ['{123}', 'with curly braces'],
            'arabic numerals'       => ['١٢٣', 'Arabic-Indic digits'],
            'empty string'          => ['', 'empty string'],
            'only spaces'           => ['   ', 'whitespace only'],
            'mixed special'         => ['12@#3', 'mixed special characters'],
            'newline'               => ["12\n3", 'with newline'],
            'tab'                   => ["12\t3", 'with tab'],
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

        // Add special characters
        foreach (['@', '#', '$', '%', '^', '&', '*', '(', ')', '-', '_', '=', '+', '[', ']', '{', '}', '|', '\\', ':', ';', '<', '>', ',', '.', '?', '/', '~', '`'] as $char) {
            $strings["special: {$char}"] = [$char . '123'];
        }

        // Add whitespace variations
        foreach ([' 123', '123 ', ' 123 ', "\t123", "123\t", "\n123", "123\n"] as $str) {
            $strings["whitespace: " . bin2hex($str)] = [$str];
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
