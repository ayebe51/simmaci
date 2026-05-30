# SK Import Duplicate Teacher Bugfix Design

## Overview

The SK Excel bulk import process (`ProcessBulkSkSubmission` job) has two data integrity bugs causing duplicate teacher records and allowing non-unique NIM values. The fix targets the teacher matching logic in the bare-name fallback path and adds NIM uniqueness validation before teacher creation/update. The approach is minimal and surgical — only the matching query and a pre-insert validation step are modified, preserving all existing identifier-based matching (nuptk, nip, nomor_induk_maarif) and exact name matching.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — when bare-name fallback matching fails due to comparing the Excel bare name against the full DB name (with degrees), or when a duplicate NIM is accepted without validation
- **Property (P)**: The desired behavior — bare-name matching should strip degrees from DB records before comparison, and NIM values must be globally unique
- **Preservation**: Existing identifier-based matching (nuptk, nip, nomor_induk_maarif), exact name matching, PNS rejection, and NIM+TMT validation must remain unchanged
- **ProcessBulkSkSubmission**: The queued job in `backend/app/Jobs/ProcessBulkSkSubmission.php` that processes Excel rows for bulk SK submission
- **NormalizationService**: The service in `backend/app/Services/NormalizationService.php` that normalizes teacher names, parses academic degrees, and enriches names
- **bare name**: The teacher's name with all academic degrees (prefix and suffix) stripped — e.g., "RATINO" from "Ratino, S.Pd."
- **NIM (nomor_induk_maarif)**: Nomor Induk Ma'arif — a unique identifier assigned to teachers within the LP Ma'arif NU network

## Bug Details

### Bug Condition

The bug manifests in two distinct scenarios within the `ProcessBulkSkSubmission::handle()` method:

**Bug 1: Duplicate Teacher on Name Mismatch**

When a teacher exists in the database without nuptk/nip/nomor_induk_maarif, the system falls back to name matching. The exact name match (`Teacher::where('nama', $teacherData['nama'])`) fails when casing or degree formatting differs. The bare-name fallback then compares `UPPER(nama)` of the DB record against the bare name from the Excel row — but `UPPER(nama)` includes degrees (e.g., "RATINO, S.PD."), so it never equals the bare name "RATINO".

**Formal Specification:**
```
FUNCTION isBugCondition_Duplicate(input)
  INPUT: input of type ExcelImportRow
  OUTPUT: boolean
  
  existingTeacher ← findTeacherBySchool(input.school_id)
  
  RETURN existingTeacher EXISTS
    AND existingTeacher.nuptk IS EMPTY
    AND existingTeacher.nip IS EMPTY
    AND existingTeacher.nomor_induk_maarif IS EMPTY
    AND exactNameMatch(input.nama_normalized, existingTeacher.nama) = FALSE
    AND stripDegrees(UPPER(existingTeacher.nama)) = stripDegrees(UPPER(input.nama))
    AND currentQuery("UPPER(nama) = ?", [bareName]) RETURNS NULL
END FUNCTION
```

**Bug 2: NIM Not Validated for Uniqueness**

The import process never checks whether the `nomor_induk_maarif` value from the Excel row is already assigned to a different teacher. There is no unique constraint on the `nomor_induk_maarif` column in the database schema, and no application-level validation in the import job.

**Formal Specification:**
```
FUNCTION isBugCondition_NimDuplicate(input)
  INPUT: input of type ExcelImportRow
  OUTPUT: boolean
  
  RETURN input.nomor_induk_maarif IS NOT EMPTY
    AND EXISTS teacher IN DB WHERE teacher.nomor_induk_maarif = input.nomor_induk_maarif
    AND teacher.id ≠ matchedTeacher(input).id
END FUNCTION
```

### Examples

- **Case mismatch**: DB has "RATINO, S.Pd." (nama), Excel has "Ratino" → normalized to "RATINO". Exact match fails ("RATINO" ≠ "RATINO, S.Pd."). Bare-name fallback does `UPPER(nama) = 'RATINO'` which doesn't match "RATINO, S.PD." → duplicate created.
- **Degree mismatch**: DB has "SITI FATIMAH, S.Pd.I, M.Ag." (nama), Excel has "SITI FATIMAH" → bare-name fallback does `UPPER(nama) = 'SITI FATIMAH'` which doesn't match "SITI FATIMAH, S.PD.I, M.AG." → duplicate created.
- **Status conflict from duplicate**: DB has "RATINO" with status "Tendik", Excel has "RATINO" with status "GTY" → matching fails → new record created with "GTY" → two records for same person with different statuses.
- **NIM duplicate within school**: Teacher A has NIM "113403283", Excel row for Teacher B also has NIM "113403283" → both accepted, violating uniqueness.
- **NIM duplicate across schools**: School 1 Teacher has NIM "113403283", School 2 import also uses NIM "113403283" → both accepted, violating global uniqueness.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Matching by nuptk must continue to find and update existing teachers
- Matching by nip must continue to find and update existing teachers
- Matching by nomor_induk_maarif must continue to find and update existing teachers
- Exact name + school_id matching must continue to work
- New teacher creation when no match exists must continue to work
- PNS auto-rejection must continue to work with the same rejection message
- NIM+TMT empty rejection must continue to work with the same rejection message
- Self-referencing NIM (same teacher being matched already has that NIM) must continue to be accepted
- NIP ↔ NIM sync logic must continue to work
- Name normalization and degree enrichment must continue to work
- SK document creation with auto-incrementing nomor_sk must continue to work

**Scope:**
All inputs that do NOT involve the bare-name fallback path (i.e., matched by nuptk, nip, nomor_induk_maarif, or exact name) AND do NOT have a duplicate NIM should be completely unaffected by this fix. This includes:
- Teachers matched by any identifier field
- Teachers matched by exact normalized name
- New teachers with unique or empty NIM values
- PNS teachers (rejected before matching logic)

## Hypothesized Root Cause

Based on the bug description and code analysis, the root causes are:

1. **Incorrect Bare-Name Comparison in SQL Query**: In `ProcessBulkSkSubmission::handle()` (line ~180), the bare-name fallback query uses:
   ```php
   $q->whereRaw("UPPER(nama) = ?", [$bareName])
     ->orWhereRaw("UPPER(nama) LIKE ?", [$bareName . ',%']);
   ```
   The `UPPER(nama) = ?` clause compares the FULL database name (including degrees like "RATINO, S.PD.") against the bare name "RATINO". This will never match when the DB record has degrees. The `LIKE` clause (`UPPER(nama) LIKE 'RATINO,%'`) partially addresses this but fails when the DB name has prefix degrees (e.g., "DR. RATINO, S.PD." won't match `LIKE 'RATINO,%'`).

2. **Missing Degree Stripping on DB Side**: The `enrichNameFromTeacher()` method in `NormalizationService` has the same pattern — it searches `UPPER(nama) = ?` and `UPPER(nama) LIKE ?` — but this runs BEFORE the fallback in the job. The job's own fallback duplicates this logic but doesn't benefit from PostgreSQL functions to strip degrees on the DB side.

3. **No NIM Uniqueness Validation**: The `ProcessBulkSkSubmission` job never checks if `nomor_induk_maarif` is already in use by another teacher. The database schema has no unique constraint on `nomor_induk_maarif` (only an index for performance). The `UniqueForTenant` rule exists but is only used in form request validation for the manual teacher CRUD endpoints, not in the bulk import job.

4. **NIP ↔ NIM Sync Amplifies the Problem**: The job syncs NIP and NIM (`if empty nip, set nip = nim`), meaning a duplicate NIM also creates a duplicate NIP, further corrupting data.

## Correctness Properties

Property 1: Bug Condition - Bare-Name Matching Finds Existing Teacher

_For any_ Excel import row where the teacher exists in the database without nuptk/nip/nomor_induk_maarif, and the bare name (degrees stripped) of the Excel row matches the bare name of the existing DB record (case-insensitive), the fixed `ProcessBulkSkSubmission` job SHALL match the existing teacher record and update it, resulting in exactly one teacher record for that bare name within the school.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Bug Condition - NIM Uniqueness Enforced

_For any_ Excel import row where the `nomor_induk_maarif` value is already assigned to a different teacher (either within the same school or globally), the fixed `ProcessBulkSkSubmission` job SHALL reject the row with a clear error message indicating the NIM is already in use, and SHALL NOT create or update any teacher record for that row.

**Validates: Requirements 2.4, 2.5**

Property 3: Preservation - Identifier-Based Matching Unchanged

_For any_ Excel import row where the teacher is matched by nuptk, nip, nomor_induk_maarif, or exact name (i.e., the bug condition does NOT hold), the fixed code SHALL produce exactly the same behavior as the original code, preserving all existing matching, update, rejection, and creation logic.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `backend/app/Jobs/ProcessBulkSkSubmission.php`

**Function**: `handle()`

**Specific Changes**:

1. **Fix Bare-Name Fallback Query** (addresses Bug 1): Replace the current bare-name SQL query with a PHP-side approach that:
   - Fetches candidate teachers from the same school that have no nuptk/nip/nomor_induk_maarif
   - For each candidate, uses `NormalizationService::parseAcademicDegreesPublic()` to extract the bare name
   - Compares bare names case-insensitively
   - Returns the first match
   
   Alternative (preferred for performance): Use a PostgreSQL expression that strips everything after the first comma to approximate bare-name extraction:
   ```php
   $teacher = Teacher::where('school_id', $schoolId)
       ->where(function ($q) use ($bareName) {
           $q->whereRaw("UPPER(SPLIT_PART(nama, ',', 1)) = ?", [$bareName])
             ->orWhereRaw("UPPER(nama) = ?", [$bareName]);
       })
       ->first();
   ```
   This handles the common case where degrees are after a comma (e.g., "RATINO, S.Pd."). For prefix degrees, the `enrichNameFromTeacher()` call earlier in the flow should already handle enrichment.

2. **Add NIM Uniqueness Validation** (addresses Bug 2): Before the teacher create/update block, add a check:
   ```php
   if (!empty($teacherData['nomor_induk_maarif'])) {
       $existingNimTeacher = Teacher::withoutTenantScope()
           ->where('nomor_induk_maarif', $teacherData['nomor_induk_maarif'])
           ->where('id', '!=', $teacher?->id ?? 0)
           ->whereNull('deleted_at')
           ->first();
       
       if ($existingNimTeacher) {
           // Reject this row with NIM duplicate error
           $seq++;
           $nomorSk = 'REQ/' . $year . '/' . str_pad($seq, 4, '0', STR_PAD_LEFT);
           SkDocument::create([...status => 'rejected', rejection_reason => 'NIM sudah digunakan'...]);
           $skipped++;
           $rejectedRows[] = [...];
           continue;
       }
   }
   ```

3. **Also Fix enrichNameFromTeacher() Query** (in NormalizationService): Apply the same `SPLIT_PART` fix to the `$find` closure in `enrichNameFromTeacher()` to ensure consistent bare-name matching across both the enrichment step and the fallback step.

4. **Add NIM Validation to NIP Sync**: After the NIP ↔ NIM sync block, validate the synced value as well to prevent the sync from introducing duplicates.

5. **Consider Database-Level Constraint**: Add a partial unique index on `nomor_induk_maarif` where it is not null and not empty, to provide a safety net beyond application-level validation:
   ```sql
   CREATE UNIQUE INDEX teachers_nomor_induk_maarif_unique 
   ON teachers (nomor_induk_maarif) 
   WHERE nomor_induk_maarif IS NOT NULL AND nomor_induk_maarif != '';
   ```

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that create teachers with degrees in their names and empty identifier fields, then dispatch the `ProcessBulkSkSubmission` job with Excel rows containing bare names. Run these tests on the UNFIXED code to observe duplicate creation. Also test NIM uniqueness by importing rows with NIM values that already exist.

**Test Cases**:
1. **Degree Mismatch Test**: Create teacher "RATINO, S.Pd." with empty nuptk/nip/nim, import row with "Ratino" → expect duplicate on unfixed code (will fail on unfixed code)
2. **Case Mismatch Test**: Create teacher "SITI FATIMAH" with empty identifiers, import row with "siti fatimah" → expect duplicate on unfixed code (will fail on unfixed code)
3. **NIM Duplicate Same School Test**: Create teacher with NIM "113403283", import different teacher with same NIM → expect acceptance on unfixed code (will fail on unfixed code)
4. **NIM Duplicate Cross School Test**: Create teacher in School A with NIM "113403283", import in School B with same NIM → expect acceptance on unfixed code (will fail on unfixed code)

**Expected Counterexamples**:
- Teacher count increases by 1 (duplicate created) instead of staying at 1 (existing updated)
- NIM duplicate rows are accepted without error instead of being rejected
- Possible causes: `UPPER(nama)` comparison includes degrees, no NIM validation exists

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition_Duplicate(input) DO
  result := ProcessBulkSkSubmission_fixed(input)
  ASSERT countTeachersWithBareName(input.nama, input.school_id) = 1
  ASSERT result.teacher_id = existingTeacher.id
END FOR

FOR ALL input WHERE isBugCondition_NimDuplicate(input) DO
  result := ProcessBulkSkSubmission_fixed(input)
  ASSERT result.status = 'rejected'
  ASSERT result.rejection_reason CONTAINS 'NIM sudah digunakan'
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition_Duplicate(input) AND NOT isBugCondition_NimDuplicate(input) DO
  ASSERT ProcessBulkSkSubmission_original(input) = ProcessBulkSkSubmission_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain (various name formats, identifier combinations, status values)
- It catches edge cases that manual unit tests might miss (e.g., names that look like degrees, empty strings vs null)
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for identifier-based matching and exact name matching, then write property-based tests capturing that behavior.

**Test Cases**:
1. **NUPTK Matching Preservation**: Verify that teachers matched by nuptk continue to be updated correctly after fix
2. **NIP Matching Preservation**: Verify that teachers matched by nip continue to be updated correctly after fix
3. **NIM Matching Preservation**: Verify that teachers matched by nomor_induk_maarif continue to be updated correctly after fix
4. **Exact Name Matching Preservation**: Verify that teachers matched by exact normalized name + school_id continue to be updated correctly
5. **New Teacher Creation Preservation**: Verify that genuinely new teachers (no match by any criteria) are still created
6. **PNS Rejection Preservation**: Verify that PNS teachers continue to be rejected with the correct message
7. **NIM+TMT Empty Rejection Preservation**: Verify that matched teachers without NIM and TMT continue to be rejected
8. **Self-NIM Preservation**: Verify that a teacher's own NIM is not flagged as duplicate when updating themselves

### Unit Tests

- Test bare-name extraction from full names with various degree formats (prefix, suffix, both)
- Test case-insensitive bare-name comparison logic
- Test NIM uniqueness validation with same school, different school, and self-reference scenarios
- Test NIP ↔ NIM sync does not bypass NIM validation
- Test edge cases: empty names, names that are entirely degrees, names with only prefix degrees

### Property-Based Tests

- Generate random teacher names with/without degrees and verify bare-name matching finds the correct teacher
- Generate random NIM values and verify uniqueness is enforced across all schools
- Generate random combinations of identifier fields (nuptk, nip, nim) and verify the matching priority order is preserved
- Test that for any input not triggering the bug condition, the output is identical to the original function

### Integration Tests

- Test full bulk SK submission flow with mixed rows: some matching by identifier, some by bare name, some with duplicate NIM
- Test that rejected rows (PNS, NIM duplicate, NIM+TMT empty) all appear in the activity log with correct reasons
- Test that notifications to admins and operators correctly report created/skipped counts
- Test concurrent imports from different operators don't create cross-school NIM conflicts
