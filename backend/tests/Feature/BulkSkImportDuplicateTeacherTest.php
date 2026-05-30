<?php

namespace Tests\Feature;

use App\Models\School;
use App\Models\SkDocument;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Bug Condition Exploration Tests — SK Import Duplicate Teacher
 *
 * CRITICAL: These tests MUST FAIL on unfixed code - failure confirms the bug exists.
 * DO NOT attempt to fix the test or the code when it fails.
 *
 * Property 1: Bug Condition - Bare-Name Matching Fails and NIM Duplicates Accepted
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5
 *
 * Bug 1: Teacher matching via bare-name fallback fails when DB record has degrees
 *   - "RATINO, S.Pd." in DB → import "Ratino" → UPPER(nama) = 'RATINO' doesn't match "RATINO, S.PD."
 *   - Creates duplicate instead of updating existing teacher
 *
 * Bug 2: NIM uniqueness is not validated during import
 *   - Teacher A has NIM "113403283", import row for Teacher B with same NIM → accepted without error
 *   - No validation exists in ProcessBulkSkSubmission for NIM uniqueness
 *
 * EXPECTED OUTCOME: Tests FAIL on unfixed code (this is correct - proves bug exists)
 * After fix: Tests PASS (confirms expected behavior)
 *
 * COUNTEREXAMPLES DOCUMENTED:
 * 1. "RATINO, S.Pd." not matched by UPPER(nama) = 'RATINO' → duplicate created
 * 2. "SITI FATIMAH, S.Pd.I, M.Ag." not matched by UPPER(nama) = 'SITI FATIMAH' → duplicate created
 * 3. NIM "113403283" accepted for different teacher in same school → no validation error
 * 4. NIM "113403283" accepted for different teacher in different school → no validation error
 */
class BulkSkImportDuplicateTeacherTest extends TestCase
{
    use RefreshDatabase;

    private School $school;
    private School $schoolB;
    private User $operator;
    private User $operatorB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->school = School::factory()->create([
            'nama' => 'MI Ma\'arif NU 01 Testschool',
        ]);

        $this->schoolB = School::factory()->create([
            'nama' => 'MI Ma\'arif NU 02 Otherschool',
        ]);

        $this->operator = User::factory()->create([
            'role'      => 'operator',
            'email'     => 'operator-test@example.com',
            'school_id' => $this->school->id,
            'is_active' => true,
        ]);

        $this->operatorB = User::factory()->create([
            'role'      => 'operator',
            'email'     => 'operator-b@example.com',
            'school_id' => $this->schoolB->id,
            'is_active' => true,
        ]);
    }

    // ══════════════════════════════════════════════════════════════════════
    // Bug 1: Bare-Name Matching Fails — Degree Mismatch
    // ══════════════════════════════════════════════════════════════════════

    /**
     * Bug Condition 1.1: Teacher "RATINO, S.Pd." in DB with empty identifiers,
     * import row "Ratino" → should match existing teacher but creates duplicate.
     *
     * Root Cause: UPPER(nama) = 'RATINO' compares against "RATINO, S.PD." which never matches.
     * The LIKE clause "UPPER(nama) LIKE 'RATINO,%'" should match but the enrichNameFromTeacher
     * step may normalize the input name first, causing the exact match to also fail.
     *
     * Expected Behavior (after fix):
     *   - countTeachersWithBareName("Ratino", school_id) = 1 (no duplicate created)
     *   - result.teacher_id = existingTeacher.id (existing teacher updated)
     *
     * COUNTEREXAMPLE: "RATINO, S.Pd." not matched → duplicate teacher created
     *
     * Validates: Requirements 1.1, 1.2
     */
    public function test_bug1_bare_name_with_degree_suffix_should_match_existing_teacher(): void
    {
        // Arrange: Create existing teacher with degrees and NO identifiers
        $existingTeacher = Teacher::factory()->forSchool($this->school)->create([
            'nama'               => 'RATINO, S.Pd.',
            'nuptk'              => null,
            'nip'                => null,
            'nomor_induk_maarif' => null,
            'status'             => 'Tendik',
            'tmt'                => '2020-01-01',
        ]);

        $teacherCountBefore = Teacher::withoutTenantScope()
            ->where('school_id', $this->school->id)
            ->count();

        // Act: Import row with bare name "Ratino" (no degrees, different casing)
        $response = $this->actingAs($this->operator)
            ->postJson('/api/sk-documents/bulk-request', [
                'documents' => [
                    [
                        'nama'               => 'Ratino',
                        'unit_kerja'         => $this->school->nama,
                        'status'             => 'GTY',
                        'nomor_induk_maarif' => '113403001',
                        'tmt'                => '2020-01-01',
                    ],
                ],
                'surat_permohonan_url' => 'https://example.com/surat.pdf',
            ]);

        $response->assertOk();

        // Assert: Expected behavior — existing teacher should be matched, no duplicate
        $teacherCountAfter = Teacher::withoutTenantScope()
            ->where('school_id', $this->school->id)
            ->count();

        // EXPECTED: Teacher count should NOT increase (existing teacher updated)
        $this->assertEquals(
            $teacherCountBefore,
            $teacherCountAfter,
            "COUNTEREXAMPLE: Teacher 'RATINO, S.Pd.' was NOT matched by bare name 'RATINO'. " .
            "A duplicate teacher was created instead of updating the existing one. " .
            "Teacher count went from {$teacherCountBefore} to {$teacherCountAfter}."
        );

        // EXPECTED: The existing teacher record should have been updated
        $existingTeacher->refresh();
        $this->assertEquals(
            '113403001',
            $existingTeacher->nomor_induk_maarif,
            "COUNTEREXAMPLE: Existing teacher 'RATINO, S.Pd.' was not updated with NIM from import row."
        );
    }

    /**
     * Bug Condition 1.2: Teacher "SITI FATIMAH, S.Pd.I, M.Ag." in DB with empty identifiers,
     * import row "SITI FATIMAH" → should match existing teacher but creates duplicate.
     *
     * Root Cause: UPPER(nama) = 'SITI FATIMAH' doesn't match "SITI FATIMAH, S.PD.I, M.AG."
     * The LIKE clause checks "SITI FATIMAH,%" which also doesn't match because the DB value
     * has a space after the comma: "SITI FATIMAH, S.PD.I, M.AG."
     *
     * Expected Behavior (after fix):
     *   - countTeachersWithBareName("SITI FATIMAH", school_id) = 1 (no duplicate)
     *   - result.teacher_id = existingTeacher.id (existing teacher updated)
     *
     * COUNTEREXAMPLE: "SITI FATIMAH, S.Pd.I, M.Ag." not matched → duplicate created
     *
     * Validates: Requirements 1.2, 1.3
     */
    public function test_bug1_multiple_degree_suffixes_should_match_existing_teacher(): void
    {
        // Arrange: Create existing teacher with multiple degrees and NO identifiers
        $existingTeacher = Teacher::factory()->forSchool($this->school)->create([
            'nama'               => 'SITI FATIMAH, S.Pd.I, M.Ag.',
            'nuptk'              => null,
            'nip'                => null,
            'nomor_induk_maarif' => null,
            'status'             => 'GTY',
            'tmt'                => '2019-06-15',
        ]);

        $teacherCountBefore = Teacher::withoutTenantScope()
            ->where('school_id', $this->school->id)
            ->count();

        // Act: Import row with bare name "SITI FATIMAH" (no degrees)
        $response = $this->actingAs($this->operator)
            ->postJson('/api/sk-documents/bulk-request', [
                'documents' => [
                    [
                        'nama'               => 'SITI FATIMAH',
                        'unit_kerja'         => $this->school->nama,
                        'status'             => 'GTY',
                        'nomor_induk_maarif' => '113403002',
                        'tmt'                => '2019-06-15',
                    ],
                ],
                'surat_permohonan_url' => 'https://example.com/surat.pdf',
            ]);

        $response->assertOk();

        // Assert: Expected behavior — existing teacher should be matched, no duplicate
        $teacherCountAfter = Teacher::withoutTenantScope()
            ->where('school_id', $this->school->id)
            ->count();

        // EXPECTED: Teacher count should NOT increase (existing teacher updated)
        $this->assertEquals(
            $teacherCountBefore,
            $teacherCountAfter,
            "COUNTEREXAMPLE: Teacher 'SITI FATIMAH, S.Pd.I, M.Ag.' was NOT matched by bare name 'SITI FATIMAH'. " .
            "A duplicate teacher was created instead of updating the existing one. " .
            "Teacher count went from {$teacherCountBefore} to {$teacherCountAfter}."
        );

        // EXPECTED: The existing teacher record should have been updated
        $existingTeacher->refresh();
        $this->assertEquals(
            '113403002',
            $existingTeacher->nomor_induk_maarif,
            "COUNTEREXAMPLE: Existing teacher 'SITI FATIMAH, S.Pd.I, M.Ag.' was not updated with NIM from import row."
        );
    }

    // ══════════════════════════════════════════════════════════════════════
    // Bug 2: NIM Uniqueness Not Validated
    // ══════════════════════════════════════════════════════════════════════

    /**
     * Bug Condition 1.4 & 1.5: NIM uniqueness not validated — same school and cross-school.
     *
     * Root Cause: ProcessBulkSkSubmission never checks if nomor_induk_maarif is
     * already assigned to a different teacher. No uniqueness validation exists.
     *
     * Expected Behavior (after fix):
     *   - result.status = 'rejected'
     *   - result.rejection_reason CONTAINS 'NIM sudah digunakan'
     *
     * COUNTEREXAMPLES:
     *   - NIM "113403283" accepted for different teacher in same school
     *   - NIM "113403283" accepted for different teacher in different school
     *
     * Validates: Requirements 1.4, 1.5
     */
    public function test_bug2_duplicate_nim_should_reject(): void
    {
        // Arrange: Create existing teacher with NIM "113403283" in School A
        Teacher::factory()->forSchool($this->school)->create([
            'nama'               => 'TEACHER A',
            'nuptk'              => '1111222233334444',
            'nomor_induk_maarif' => '113403283',
            'nip'                => '113403283',
            'status'             => 'GTY',
            'tmt'                => '2018-01-01',
        ]);

        // --- Case 1: Same school duplicate NIM ---
        $response = $this->actingAs($this->operator)
            ->postJson('/api/sk-documents/bulk-request', [
                'documents' => [
                    [
                        'nama'               => 'TEACHER B',
                        'unit_kerja'         => $this->school->nama,
                        'status'             => 'GTY',
                        'nomor_induk_maarif' => '113403283',
                        'tmt'                => '2020-01-01',
                    ],
                ],
                'surat_permohonan_url' => 'https://example.com/surat.pdf',
            ]);

        $response->assertOk();
        $responseData = $response->json();

        $this->assertGreaterThan(
            0,
            $responseData['skipped'] ?? 0,
            "COUNTEREXAMPLE: Import row with duplicate NIM '113403283' (same school) was ACCEPTED. " .
            "No NIM uniqueness validation exists in ProcessBulkSkSubmission."
        );

        $rejected = $responseData['rejected'] ?? [];
        $this->assertNotEmpty(
            $rejected,
            "COUNTEREXAMPLE: No rejection record found for duplicate NIM '113403283' (same school)."
        );

        // --- Case 2: Cross-school duplicate NIM ---
        $response2 = $this->actingAs($this->operatorB)
            ->postJson('/api/sk-documents/bulk-request', [
                'documents' => [
                    [
                        'nama'               => 'TEACHER IN SCHOOL B',
                        'unit_kerja'         => $this->schoolB->nama,
                        'status'             => 'GTY',
                        'nomor_induk_maarif' => '113403283',
                        'tmt'                => '2021-01-01',
                    ],
                ],
                'surat_permohonan_url' => 'https://example.com/surat.pdf',
            ]);

        $response2->assertOk();
        $responseData2 = $response2->json();

        $this->assertGreaterThan(
            0,
            $responseData2['skipped'] ?? 0,
            "COUNTEREXAMPLE: Import row with duplicate NIM '113403283' (cross-school) was ACCEPTED. " .
            "No global NIM uniqueness validation exists in ProcessBulkSkSubmission."
        );

        $rejected2 = $responseData2['rejected'] ?? [];
        $this->assertNotEmpty(
            $rejected2,
            "COUNTEREXAMPLE: No rejection record found for cross-school duplicate NIM '113403283'."
        );
    }


}
