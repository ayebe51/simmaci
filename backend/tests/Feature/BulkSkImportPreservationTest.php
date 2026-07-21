<?php

namespace Tests\Feature;

use App\Models\School;
use App\Models\SkDocument;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Preservation Property Tests — SK Import Duplicate Teacher Bugfix
 *
 * Property 2: Preservation - Identifier-Based Matching and Existing Validations Unchanged
 *
 * These tests capture the WORKING behavior of the current (unfixed) code.
 * They must PASS on unfixed code and continue to PASS after the fix is applied.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8
 *
 * Observation-first methodology:
 * - Teacher matched by nuptk → existing record updated (teacher count unchanged)
 * - Teacher matched by nip → existing record updated (teacher count unchanged)
 * - Teacher matched by nomor_induk_maarif → existing record updated (teacher count unchanged)
 * - Teacher matched by exact nama + school_id → existing record updated (teacher count unchanged)
 * - No match found → new teacher created (teacher count +1)
 * - PNS teacher → row rejected with PNS rejection message
 * - Teacher matched but NIM and TMT empty → row rejected with "NIM dan TMT belum terisi"
 * - Teacher's own NIM used in import (self-reference) → row accepted normally
 */
class BulkSkImportPreservationTest extends TestCase
{
    use RefreshDatabase;

    private School $school;
    private User $operator;

    protected function setUp(): void
    {
        parent::setUp();

        $this->school = School::factory()->create([
            'nama' => 'MI Ma\'arif NU 01 Preservation Test',
            'sk_submission_unlocked' => true,
        ]);

        $this->operator = User::factory()->create([
            'role'      => 'operator',
            'email'     => 'operator-preservation@example.com',
            'school_id' => $this->school->id,
            'is_active' => true,
        ]);
    }

    // ══════════════════════════════════════════════════════════════════════
    // Helper Methods
    // ══════════════════════════════════════════════════════════════════════

    private function submitBulkRequest(array $documents): \Illuminate\Testing\TestResponse
    {
        return $this->actingAs($this->operator)
            ->postJson('/api/sk-documents/bulk-request', [
                'documents'            => $documents,
                'surat_permohonan_url' => 'https://example.com/surat.pdf',
            ]);
    }

    // ══════════════════════════════════════════════════════════════════════
    // Preservation 3.1: NUPTK Matching — Existing teacher updated
    // ══════════════════════════════════════════════════════════════════════

    /**
     * Preservation: Teacher matched by nuptk → existing record updated, no duplicate created.
     *
     * For all inputs matched by nuptk, teacher count stays the same and existing record is updated.
     *
     * **Validates: Requirements 3.1**
     */
    public function test_preservation_nuptk_matching_updates_existing_teacher(): void
    {
        // Arrange: Create teacher with a known NUPTK
        $existingTeacher = Teacher::factory()->forSchool($this->school)->create([
            'nama'               => 'AHMAD FAUZI, S.Pd.',
            'nuptk'              => '1234567890123456',
            'nip'                => '113400001',
            'nomor_induk_maarif' => '113400001',
            'status'             => 'GTY',
            'tmt'                => '2018-01-01',
        ]);

        $teacherCountBefore = Teacher::withoutTenantScope()
            ->where('school_id', $this->school->id)
            ->count();

        // Act: Import row with same NUPTK
        $response = $this->submitBulkRequest([
            [
                'nama'               => 'AHMAD FAUZI',
                'unit_kerja'         => $this->school->nama,
                'status'             => 'GTY',
                'nuptk'              => '1234567890123456',
                'nomor_induk_maarif' => '113400001',
                'tmt'                => '2018-01-01',
            ],
        ]);

        $response->assertOk();

        // Assert: Teacher count unchanged (existing teacher updated, no duplicate)
        $teacherCountAfter = Teacher::withoutTenantScope()
            ->where('school_id', $this->school->id)
            ->count();

        $this->assertEquals(
            $teacherCountBefore,
            $teacherCountAfter,
            "Preservation violated: NUPTK matching should update existing teacher, not create duplicate. " .
            "Count went from {$teacherCountBefore} to {$teacherCountAfter}."
        );

        // Assert: SK document created with existing teacher's ID
        $skDoc = SkDocument::where('teacher_id', $existingTeacher->id)
            ->where('status', 'pending')
            ->first();
        $this->assertNotNull($skDoc, "Preservation violated: SK document should reference existing teacher matched by NUPTK.");
    }

    // ══════════════════════════════════════════════════════════════════════
    // Preservation 3.2: NIP Matching — Existing teacher updated
    // ══════════════════════════════════════════════════════════════════════

    /**
     * Preservation: Teacher matched by nip → existing record updated, no duplicate created.
     *
     * For all inputs matched by nip, teacher count stays the same and existing record is updated.
     *
     * **Validates: Requirements 3.2**
     */
    public function test_preservation_nip_matching_updates_existing_teacher(): void
    {
        // Arrange: Create teacher with a known NIP (no NUPTK so NIP is the first match)
        $existingTeacher = Teacher::factory()->forSchool($this->school)->create([
            'nama'               => 'SITI AMINAH, S.Pd.I',
            'nuptk'              => null,
            'nip'                => '113400002',
            'nomor_induk_maarif' => '113400002',
            'status'             => 'GTY',
            'tmt'                => '2019-06-01',
        ]);

        $teacherCountBefore = Teacher::withoutTenantScope()
            ->where('school_id', $this->school->id)
            ->count();

        // Act: Import row with same NIP (nip matches via NIM→NIP sync)
        $response = $this->submitBulkRequest([
            [
                'nama'               => 'SITI AMINAH',
                'unit_kerja'         => $this->school->nama,
                'status'             => 'GTY',
                'nomor_induk_maarif' => '113400002',
                'tmt'                => '2019-06-01',
            ],
        ]);

        $response->assertOk();

        // Assert: Teacher count unchanged
        $teacherCountAfter = Teacher::withoutTenantScope()
            ->where('school_id', $this->school->id)
            ->count();

        $this->assertEquals(
            $teacherCountBefore,
            $teacherCountAfter,
            "Preservation violated: NIP matching should update existing teacher, not create duplicate. " .
            "Count went from {$teacherCountBefore} to {$teacherCountAfter}."
        );

        // Assert: SK document created with existing teacher's ID
        $skDoc = SkDocument::where('teacher_id', $existingTeacher->id)
            ->where('status', 'pending')
            ->first();
        $this->assertNotNull($skDoc, "Preservation violated: SK document should reference existing teacher matched by NIP.");
    }

    // ══════════════════════════════════════════════════════════════════════
    // Preservation 3.3: NIM Matching — Existing teacher updated
    // ══════════════════════════════════════════════════════════════════════

    /**
     * Preservation: Teacher matched by nomor_induk_maarif → existing record updated, no duplicate.
     *
     * For all inputs matched by nomor_induk_maarif, teacher count stays the same.
     *
     * **Validates: Requirements 3.3**
     */
    public function test_preservation_nim_matching_updates_existing_teacher(): void
    {
        // Arrange: Create teacher with a known NIM (no NUPTK/NIP so NIM is the match path)
        $existingTeacher = Teacher::factory()->forSchool($this->school)->create([
            'nama'               => 'BUDI SANTOSO',
            'nuptk'              => null,
            'nip'                => null,
            'nomor_induk_maarif' => '113400003',
            'status'             => 'GTY',
            'tmt'                => '2020-01-01',
        ]);

        $teacherCountBefore = Teacher::withoutTenantScope()
            ->where('school_id', $this->school->id)
            ->count();

        // Act: Import row with same NIM
        $response = $this->submitBulkRequest([
            [
                'nama'               => 'BUDI SANTOSO',
                'unit_kerja'         => $this->school->nama,
                'status'             => 'GTY',
                'nomor_induk_maarif' => '113400003',
                'tmt'                => '2020-01-01',
            ],
        ]);

        $response->assertOk();

        // Assert: Teacher count unchanged
        $teacherCountAfter = Teacher::withoutTenantScope()
            ->where('school_id', $this->school->id)
            ->count();

        $this->assertEquals(
            $teacherCountBefore,
            $teacherCountAfter,
            "Preservation violated: NIM matching should update existing teacher, not create duplicate. " .
            "Count went from {$teacherCountBefore} to {$teacherCountAfter}."
        );

        // Assert: SK document created with existing teacher's ID
        $skDoc = SkDocument::where('teacher_id', $existingTeacher->id)
            ->where('status', 'pending')
            ->first();
        $this->assertNotNull($skDoc, "Preservation violated: SK document should reference existing teacher matched by NIM.");
    }

    // ══════════════════════════════════════════════════════════════════════
    // Preservation 3.4: Exact Name Matching — Existing teacher updated
    // ══════════════════════════════════════════════════════════════════════

    /**
     * Preservation: Teacher matched by exact nama + school_id → existing record updated.
     *
     * For all inputs matched by exact name, teacher count stays the same.
     *
     * **Validates: Requirements 3.4**
     */
    public function test_preservation_exact_name_matching_updates_existing_teacher(): void
    {
        // Arrange: Create teacher with no identifiers — will be matched by exact name
        $existingTeacher = Teacher::factory()->forSchool($this->school)->create([
            'nama'               => 'MUHAMAD RIZKI',
            'nuptk'              => null,
            'nip'                => null,
            'nomor_induk_maarif' => null,
            'status'             => 'GTY',
            'tmt'                => '2021-01-01',
        ]);

        $teacherCountBefore = Teacher::withoutTenantScope()
            ->where('school_id', $this->school->id)
            ->count();

        // Act: Import row with exact same name (after normalization, should match)
        $response = $this->submitBulkRequest([
            [
                'nama'               => 'MUHAMAD RIZKI',
                'unit_kerja'         => $this->school->nama,
                'status'             => 'GTY',
                'nomor_induk_maarif' => '113400004',
                'tmt'                => '2021-01-01',
            ],
        ]);

        $response->assertOk();

        // Assert: Teacher count unchanged
        $teacherCountAfter = Teacher::withoutTenantScope()
            ->where('school_id', $this->school->id)
            ->count();

        $this->assertEquals(
            $teacherCountBefore,
            $teacherCountAfter,
            "Preservation violated: Exact name matching should update existing teacher, not create duplicate. " .
            "Count went from {$teacherCountBefore} to {$teacherCountAfter}."
        );

        // Assert: Existing teacher was updated with NIM from import
        $existingTeacher->refresh();
        $this->assertEquals(
            '113400004',
            $existingTeacher->nomor_induk_maarif,
            "Preservation violated: Existing teacher matched by exact name should be updated with NIM from import."
        );
    }

    // ══════════════════════════════════════════════════════════════════════
    // Preservation 3.5: New Teacher Creation — No match → new record
    // ══════════════════════════════════════════════════════════════════════

    /**
     * Preservation: No existing teacher matches → new teacher created (teacher count +1).
     *
     * For all genuinely new teachers, a new record is created.
     *
     * **Validates: Requirements 3.5**
     */
    public function test_preservation_new_teacher_creation_when_no_match(): void
    {
        $teacherCountBefore = Teacher::withoutTenantScope()
            ->where('school_id', $this->school->id)
            ->count();

        // Act: Import row with a completely new teacher (no matching identifiers or name)
        $response = $this->submitBulkRequest([
            [
                'nama'               => 'GURU BARU TIDAK ADA DI DB',
                'unit_kerja'         => $this->school->nama,
                'status'             => 'GTY',
                'nomor_induk_maarif' => '113400099',
                'tmt'                => '2023-01-01',
            ],
        ]);

        $response->assertOk();

        // Assert: Teacher count increased by 1
        $teacherCountAfter = Teacher::withoutTenantScope()
            ->where('school_id', $this->school->id)
            ->count();

        $this->assertEquals(
            $teacherCountBefore + 1,
            $teacherCountAfter,
            "Preservation violated: New teacher (no match) should create a new record. " .
            "Count went from {$teacherCountBefore} to {$teacherCountAfter}, expected " . ($teacherCountBefore + 1) . "."
        );

        // Assert: New teacher exists in DB
        $newTeacher = Teacher::withoutTenantScope()
            ->where('school_id', $this->school->id)
            ->where('nomor_induk_maarif', '113400099')
            ->first();
        $this->assertNotNull($newTeacher, "Preservation violated: New teacher should be created in database.");

        // Assert: SK document created with pending status
        $skDoc = SkDocument::where('teacher_id', $newTeacher->id)
            ->where('status', 'pending')
            ->first();
        $this->assertNotNull($skDoc, "Preservation violated: SK document should be created for new teacher.");
    }

    // ══════════════════════════════════════════════════════════════════════
    // Preservation 3.6: PNS Rejection — Row rejected with correct message
    // ══════════════════════════════════════════════════════════════════════

    /**
     * Preservation: PNS teacher → row rejected with PNS rejection message.
     *
     * For all PNS teachers, row is rejected with correct message.
     *
     * **Validates: Requirements 3.6**
     */
    public function test_preservation_pns_teacher_rejected_with_correct_message(): void
    {
        $teacherCountBefore = Teacher::withoutTenantScope()
            ->where('school_id', $this->school->id)
            ->count();

        // Act: Import row with PNS status
        $response = $this->submitBulkRequest([
            [
                'nama'               => 'GURU PNS PRESERVATION',
                'unit_kerja'         => $this->school->nama,
                'status'             => 'PNS',
                'nomor_induk_maarif' => '113400PNS',
                'tmt'                => '2015-01-01',
            ],
        ]);

        $response->assertOk();
        $responseData = $response->json();

        // Assert: Row was skipped (rejected)
        $this->assertEquals(1, $responseData['skipped'], "Preservation violated: PNS row should be skipped.");
        $this->assertEquals(0, $responseData['count'], "Preservation violated: PNS row should not create SK.");

        // Assert: Rejection message contains PNS reference
        $rejected = $responseData['rejected'];
        $this->assertNotEmpty($rejected, "Preservation violated: PNS rejection should appear in rejected array.");
        $this->assertStringContainsString(
            'PNS',
            $rejected[0]['alasan'],
            "Preservation violated: PNS rejection message should mention PNS."
        );

        // Assert: Teacher count unchanged (no teacher created for PNS)
        $teacherCountAfter = Teacher::withoutTenantScope()
            ->where('school_id', $this->school->id)
            ->count();
        $this->assertEquals(
            $teacherCountBefore,
            $teacherCountAfter,
            "Preservation violated: PNS rejection should not create a teacher record."
        );

        // Assert: SK document created with rejected status in DB
        $this->assertDatabaseHas('sk_documents', [
            'nama'   => 'GURU PNS PRESERVATION',
            'status' => 'rejected',
        ]);
    }

    /**
     * Preservation: PNS detected by 18-digit NIP → row rejected.
     *
     * **Validates: Requirements 3.6**
     */
    public function test_preservation_pns_by_18_digit_nip_rejected(): void
    {
        // Act: Import row with 18-digit NIP (PNS format) but non-PNS status
        $response = $this->submitBulkRequest([
            [
                'nama'               => 'GURU NIP PANJANG',
                'unit_kerja'         => $this->school->nama,
                'status'             => 'GTY',
                'nip'                => '199001012015041001', // 18 digits = PNS
                'nomor_induk_maarif' => '113400NIP',
                'tmt'                => '2015-01-01',
            ],
        ]);

        $response->assertOk();
        $responseData = $response->json();

        // Assert: Row was rejected as PNS
        $this->assertEquals(1, $responseData['skipped'], "Preservation violated: 18-digit NIP should trigger PNS rejection.");
        $this->assertEquals(0, $responseData['count'], "Preservation violated: 18-digit NIP row should not create SK.");

        $rejected = $responseData['rejected'];
        $this->assertNotEmpty($rejected, "Preservation violated: 18-digit NIP rejection should appear in rejected array.");
        $this->assertStringContainsString(
            'PNS',
            $rejected[0]['alasan'],
            "Preservation violated: 18-digit NIP rejection message should mention PNS."
        );
    }

    // ══════════════════════════════════════════════════════════════════════
    // Preservation 3.7: NIM+TMT Empty Rejection
    // ══════════════════════════════════════════════════════════════════════

    /**
     * Preservation: Teacher matched but NIM and TMT both empty → row rejected.
     *
     * For all matched teachers without NIM+TMT, row is rejected with correct message.
     *
     * **Validates: Requirements 3.7**
     */
    public function test_preservation_nim_and_tmt_empty_rejection(): void
    {
        // Arrange: Create teacher with no NIM and no TMT, matched by exact name
        Teacher::factory()->forSchool($this->school)->create([
            'nama'               => 'GURU TANPA NIM TMT',
            'nuptk'              => null,
            'nip'                => null,
            'nomor_induk_maarif' => null,
            'status'             => 'GTY',
            'tmt'                => null,
        ]);

        // Act: Import row matching by exact name, also without NIM and TMT
        $response = $this->submitBulkRequest([
            [
                'nama'               => 'GURU TANPA NIM TMT',
                'unit_kerja'         => $this->school->nama,
                'status'             => 'GTY',
            ],
        ]);

        $response->assertOk();
        $responseData = $response->json();

        // Assert: Row was rejected due to missing NIM+TMT
        $this->assertEquals(1, $responseData['skipped'], "Preservation violated: Teacher without NIM+TMT should be rejected.");
        $this->assertEquals(0, $responseData['count'], "Preservation violated: Teacher without NIM+TMT should not create SK.");

        // Assert: Rejection message mentions NIM dan TMT
        $rejected = $responseData['rejected'];
        $this->assertNotEmpty($rejected, "Preservation violated: NIM+TMT rejection should appear in rejected array.");
        $this->assertStringContainsString(
            'NIM dan TMT belum terisi',
            $rejected[0]['alasan'],
            "Preservation violated: Rejection message should mention 'NIM dan TMT belum terisi'."
        );

        // Assert: SK document created with rejected status in DB
        $this->assertDatabaseHas('sk_documents', [
            'nama'   => 'GURU TANPA NIM TMT',
            'status' => 'rejected',
        ]);
    }

    // ══════════════════════════════════════════════════════════════════════
    // Preservation 3.8: Self-Referencing NIM — Not flagged as duplicate
    // ══════════════════════════════════════════════════════════════════════

    /**
     * Preservation: Teacher's own NIM used in import (self-reference) → row accepted normally.
     *
     * Self-referencing NIM is not flagged as duplicate.
     *
     * **Validates: Requirements 3.8**
     */
    public function test_preservation_self_referencing_nim_accepted(): void
    {
        // Arrange: Create teacher with NIM "113400005"
        $existingTeacher = Teacher::factory()->forSchool($this->school)->create([
            'nama'               => 'GURU SELF NIM',
            'nuptk'              => null,
            'nip'                => '113400005',
            'nomor_induk_maarif' => '113400005',
            'status'             => 'GTY',
            'tmt'                => '2020-01-01',
        ]);

        $teacherCountBefore = Teacher::withoutTenantScope()
            ->where('school_id', $this->school->id)
            ->count();

        // Act: Import row with same NIM (self-reference — same teacher matched by NIM)
        $response = $this->submitBulkRequest([
            [
                'nama'               => 'GURU SELF NIM',
                'unit_kerja'         => $this->school->nama,
                'status'             => 'GTY',
                'nomor_induk_maarif' => '113400005',
                'tmt'                => '2020-01-01',
            ],
        ]);

        $response->assertOk();
        $responseData = $response->json();

        // Assert: Row was accepted (not rejected as duplicate NIM)
        $this->assertEquals(1, $responseData['count'], "Preservation violated: Self-referencing NIM should be accepted, not rejected.");
        $this->assertEquals(0, $responseData['skipped'], "Preservation violated: Self-referencing NIM should not be skipped.");

        // Assert: Teacher count unchanged (existing teacher updated)
        $teacherCountAfter = Teacher::withoutTenantScope()
            ->where('school_id', $this->school->id)
            ->count();
        $this->assertEquals(
            $teacherCountBefore,
            $teacherCountAfter,
            "Preservation violated: Self-referencing NIM should update existing teacher, not create duplicate."
        );

        // Assert: SK document created with existing teacher's ID
        $skDoc = SkDocument::where('teacher_id', $existingTeacher->id)
            ->where('status', 'pending')
            ->first();
        $this->assertNotNull($skDoc, "Preservation violated: SK document should be created for self-referencing NIM teacher.");
    }

    // ══════════════════════════════════════════════════════════════════════
    // Property-Based: Multiple identifier types in one batch
    // ══════════════════════════════════════════════════════════════════════

    /**
     * Property: For all inputs matched by any identifier (nuptk/nip/nim/exact-name),
     * teacher count stays the same and existing record is updated.
     *
     * This test combines multiple matching strategies in a single batch to verify
     * the matching priority order is preserved.
     *
     * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
     */
    public function test_preservation_multiple_identifier_matches_in_batch(): void
    {
        // Arrange: Create teachers with different identifier types
        $teacherByNuptk = Teacher::factory()->forSchool($this->school)->create([
            'nama'               => 'TEACHER NUPTK BATCH',
            'nuptk'              => '9999888877776666',
            'nip'                => '113400010',
            'nomor_induk_maarif' => '113400010',
            'status'             => 'GTY',
            'tmt'                => '2018-01-01',
        ]);

        $teacherByNim = Teacher::factory()->forSchool($this->school)->create([
            'nama'               => 'TEACHER NIM BATCH',
            'nuptk'              => null,
            'nip'                => null,
            'nomor_induk_maarif' => '113400011',
            'status'             => 'GTY',
            'tmt'                => '2019-01-01',
        ]);

        $teacherByName = Teacher::factory()->forSchool($this->school)->create([
            'nama'               => 'TEACHER EXACT NAME BATCH',
            'nuptk'              => null,
            'nip'                => null,
            'nomor_induk_maarif' => null,
            'status'             => 'GTY',
            'tmt'                => '2020-01-01',
        ]);

        $teacherCountBefore = Teacher::withoutTenantScope()
            ->where('school_id', $this->school->id)
            ->count();

        // Act: Import batch with 3 rows matching different identifiers (<=3 = sync path)
        $response = $this->submitBulkRequest([
            [
                'nama'               => 'TEACHER NUPTK BATCH',
                'unit_kerja'         => $this->school->nama,
                'status'             => 'GTY',
                'nuptk'              => '9999888877776666',
                'nomor_induk_maarif' => '113400010',
                'tmt'                => '2018-01-01',
            ],
            [
                'nama'               => 'TEACHER NIM BATCH',
                'unit_kerja'         => $this->school->nama,
                'status'             => 'GTY',
                'nomor_induk_maarif' => '113400011',
                'tmt'                => '2019-01-01',
            ],
            [
                'nama'               => 'TEACHER EXACT NAME BATCH',
                'unit_kerja'         => $this->school->nama,
                'status'             => 'GTY',
                'nomor_induk_maarif' => '113400012',
                'tmt'                => '2020-01-01',
            ],
        ]);

        $response->assertOk();
        $responseData = $response->json();

        // Assert: All 3 rows accepted
        $this->assertEquals(3, $responseData['count'], "All 3 identifier-matched rows should be accepted.");
        $this->assertEquals(0, $responseData['skipped'], "No rows should be skipped for identifier matches.");

        // Assert: Teacher count unchanged (all matched existing teachers)
        $teacherCountAfter = Teacher::withoutTenantScope()
            ->where('school_id', $this->school->id)
            ->count();
        $this->assertEquals(
            $teacherCountBefore,
            $teacherCountAfter,
            "Preservation violated: All identifier-matched rows should update existing teachers. " .
            "Count went from {$teacherCountBefore} to {$teacherCountAfter}."
        );

        // Assert: Each teacher has an SK document
        $this->assertNotNull(
            SkDocument::where('teacher_id', $teacherByNuptk->id)->where('status', 'pending')->first(),
            "SK document should exist for NUPTK-matched teacher."
        );
        $this->assertNotNull(
            SkDocument::where('teacher_id', $teacherByNim->id)->where('status', 'pending')->first(),
            "SK document should exist for NIM-matched teacher."
        );
        $this->assertNotNull(
            SkDocument::where('teacher_id', $teacherByName->id)->where('status', 'pending')->first(),
            "SK document should exist for exact-name-matched teacher."
        );

        // Assert: Third teacher was updated with NIM from import
        $teacherByName->refresh();
        $this->assertEquals(
            '113400012',
            $teacherByName->nomor_induk_maarif,
            "Exact-name-matched teacher should be updated with NIM from import row."
        );
    }
}
