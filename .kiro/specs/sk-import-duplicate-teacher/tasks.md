# Implementation Plan: SK Import Duplicate Teacher Bugfix

## Overview

Fix dua bug data integrity pada proses bulk import SK Excel (`ProcessBulkSkSubmission` job):
1. **Duplicate teacher records** — bare-name matching gagal karena query `UPPER(nama)` membandingkan nama lengkap (termasuk gelar) dengan bare name dari Excel
2. **NIM tidak divalidasi uniqueness** — `nomor_induk_maarif` dari Excel diterima tanpa pengecekan apakah sudah digunakan guru lain

Pendekatan bugfix menggunakan bug condition methodology:
1. **Explore** — Tulis test sebelum fix untuk membuktikan bug ada (Bug Condition)
2. **Preserve** — Tulis test untuk behavior yang tidak boleh berubah (Preservation)
3. **Implement** — Terapkan fix berdasarkan pemahaman dari eksplorasi
4. **Validate** — Verifikasi fix bekerja dan tidak merusak behavior lain

---

## Tasks

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Bare-Name Matching Fails and NIM Duplicates Accepted
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate both bugs exist
  - **Scoped PBT Approach**: Scope the property to concrete failing cases:
    - Bug 1: Teacher "RATINO, S.Pd." in DB with empty nuptk/nip/nim, import row "Ratino" → should match but creates duplicate
    - Bug 1: Teacher "SITI FATIMAH, S.Pd.I, M.Ag." in DB, import row "SITI FATIMAH" → should match but creates duplicate
    - Bug 2: Teacher A has NIM "113403283", import row for Teacher B with same NIM → should reject but accepts
    - Bug 2: Teacher in School A has NIM "113403283", import in School B with same NIM → should reject but accepts
  - Test that `ProcessBulkSkSubmission` matches existing teacher when bare names match (case-insensitive, degrees stripped)
  - Test that `ProcessBulkSkSubmission` rejects rows with duplicate NIM values
  - Test assertions match Expected Behavior from design:
    - `countTeachersWithBareName(input.nama, input.school_id) = 1` (no duplicate created)
    - `result.teacher_id = existingTeacher.id` (existing teacher updated)
    - `result.status = 'rejected'` for NIM duplicates
    - `result.rejection_reason CONTAINS 'NIM sudah digunakan'`
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found:
    - "RATINO, S.Pd." not matched by `UPPER(nama) = 'RATINO'` → duplicate created
    - NIM "113403283" accepted for different teacher → no validation error
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Identifier-Based Matching and Existing Validations Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - **Observe behavior on UNFIXED code for non-buggy inputs:**
    - Observe: Teacher matched by nuptk → existing record updated (teacher count unchanged)
    - Observe: Teacher matched by nip → existing record updated (teacher count unchanged)
    - Observe: Teacher matched by nomor_induk_maarif → existing record updated (teacher count unchanged)
    - Observe: Teacher matched by exact nama + school_id → existing record updated (teacher count unchanged)
    - Observe: No match found → new teacher created (teacher count +1)
    - Observe: PNS teacher → row rejected with PNS rejection message
    - Observe: Teacher matched but NIM and TMT empty → row rejected with "NIM dan TMT belum terisi"
    - Observe: Teacher's own NIM used in import (self-reference) → row accepted normally
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements:
    - For all inputs matched by nuptk/nip/nim/exact-name, teacher count stays the same and existing record is updated
    - For all genuinely new teachers, a new record is created
    - For all PNS teachers, row is rejected with correct message
    - For all matched teachers without NIM+TMT, row is rejected with correct message
    - Self-referencing NIM is not flagged as duplicate
  - Verify tests PASS on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [x] 3. Fix for duplicate teacher creation and NIM uniqueness validation

  - [x] 3.1 Fix bare-name fallback query in ProcessBulkSkSubmission
    - Replace `UPPER(nama) = ?` with `UPPER(SPLIT_PART(nama, ',', 1)) = ?` to strip degrees before comparison
    - Keep the `UPPER(nama) = ?` as an OR clause for names without degrees
    - Ensure the query is scoped to the same school_id and teachers without nuptk/nip/nim
    - _Bug_Condition: isBugCondition_Duplicate(input) where existingTeacher has degrees in nama and empty identifiers_
    - _Expected_Behavior: countTeachersWithBareName(input.nama, input.school_id) = 1 AND result.teacher_id = existingTeacher.id_
    - _Preservation: Identifier-based matching (nuptk, nip, nim, exact name) must remain unchanged_
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.2 Fix enrichNameFromTeacher() query in NormalizationService
    - Apply the same `SPLIT_PART` fix to the `$find` closure in `enrichNameFromTeacher()`
    - Ensure consistent bare-name matching across both the enrichment step and the fallback step
    - _Bug_Condition: Same as 3.1 - bare-name comparison includes degrees_
    - _Expected_Behavior: enrichNameFromTeacher finds existing teacher by bare name_
    - _Preservation: Existing enrichment behavior for exact matches must remain unchanged_
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 Add NIM uniqueness validation before teacher create/update
    - Before the teacher create/update block, check if `nomor_induk_maarif` is already assigned to a different teacher
    - Use `Teacher::withoutTenantScope()` to check globally (not just within the school)
    - Exclude the currently matched teacher's ID from the check (self-reference is OK)
    - Exclude soft-deleted records (`whereNull('deleted_at')`)
    - If duplicate found: reject the row with status 'rejected' and rejection_reason 'NIM sudah digunakan oleh guru lain'
    - Add rejected row to `$rejectedRows[]` array and increment `$skipped` counter
    - _Bug_Condition: isBugCondition_NimDuplicate(input) where NIM exists on different teacher_
    - _Expected_Behavior: result.status = 'rejected' AND result.rejection_reason CONTAINS 'NIM sudah digunakan'_
    - _Preservation: Self-referencing NIM (same teacher) must continue to be accepted_
    - _Requirements: 2.4, 2.5, 3.8_

  - [x] 3.4 Add NIM validation to NIP ↔ NIM sync logic
    - After the NIP ↔ NIM sync block (where empty NIP is set to NIM value), validate the synced value
    - Ensure the sync does not introduce a duplicate NIM/NIP
    - _Bug_Condition: NIP sync creates duplicate NIM indirectly_
    - _Expected_Behavior: Synced NIP/NIM values are also validated for uniqueness_
    - _Preservation: NIP ↔ NIM sync logic must continue to work for valid cases_
    - _Requirements: 2.4, 2.5_

  - [x] 3.5 Add database migration for partial unique index on nomor_induk_maarif
    - Create migration: `CREATE UNIQUE INDEX teachers_nomor_induk_maarif_unique ON teachers (nomor_induk_maarif) WHERE nomor_induk_maarif IS NOT NULL AND nomor_induk_maarif != ''`
    - This provides a database-level safety net beyond application-level validation
    - Handle the migration gracefully if existing duplicates exist (clean up first or use a conditional approach)
    - _Bug_Condition: Database allows duplicate NIM values_
    - _Expected_Behavior: Database enforces NIM uniqueness at schema level_
    - _Preservation: NULL and empty string NIM values must not conflict with each other_
    - _Requirements: 2.4, 2.5_

  - [x] 3.6 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Bare-Name Matching Finds Existing Teacher and NIM Duplicates Rejected
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied:
      - Teachers with degree-formatted names are matched by bare name
      - NIM duplicate rows are rejected with correct error message
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.7 Verify preservation tests still pass
    - **Property 2: Preservation** - Identifier-Based Matching and Existing Validations Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix:
      - NUPTK matching still works
      - NIP matching still works
      - NIM matching still works
      - Exact name matching still works
      - New teacher creation still works
      - PNS rejection still works
      - NIM+TMT empty rejection still works
      - Self-referencing NIM still accepted

- [x] 4. Checkpoint - Ensure all tests pass
  - Run full test suite: `php artisan test` from backend/
  - Ensure all exploration tests (Property 1) pass
  - Ensure all preservation tests (Property 2) pass
  - Ensure no existing tests are broken by the changes
  - Verify the migration runs cleanly on a fresh database
  - Ask the user if questions arise

---

## Notes

- Test file untuk exploration: `backend/tests/Feature/BulkSkImportDuplicateTeacherTest.php`
- Test file untuk preservation: `backend/tests/Feature/BulkSkImportPreservationTest.php`
- Bug 1 root cause: `UPPER(nama) = ?` di bare-name fallback membandingkan nama lengkap (termasuk gelar) dengan bare name
- Bug 2 root cause: Tidak ada validasi uniqueness `nomor_induk_maarif` di `ProcessBulkSkSubmission` job
- Fix menggunakan PostgreSQL `SPLIT_PART(nama, ',', 1)` untuk strip gelar setelah koma
- Database migration menambahkan partial unique index sebagai safety net
- Semua perubahan hanya di `ProcessBulkSkSubmission.php`, `NormalizationService.php`, dan migration baru
- Existing behavior (identifier matching, PNS rejection, NIM+TMT rejection) TIDAK boleh berubah

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2"] },
    { "id": 2, "tasks": ["3.1", "3.2", "3.3"] },
    { "id": 3, "tasks": ["3.4", "3.5"] },
    { "id": 4, "tasks": ["3.6", "3.7"] },
    { "id": 5, "tasks": ["4"] }
  ]
}
```
