# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Missing Degree Recognition
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Test specific failing cases: S.Pd.SD. and A.Md. normalization
  - Test that normalizeTeacherName("Ahmad S.Pd.SD.") returns "AHMAD, S.Pd.SD." (from Bug Condition in design)
  - Test that normalizeTeacherName("Siti A.Md.") returns "SITI, A.Md." (from Bug Condition in design)
  - Test that normalizeTeacherName("Budi A.Ma.") returns "BUDI, A.Ma."
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS for S.Pd.SD. and A.Md. cases (this proves the bug exists)
  - Document counterexamples found to understand root cause
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Existing Degree Normalization
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for existing degrees (S.Pd., M.Pd., Dr., Dra., Amd.Keb., etc.)
  - Write tests capturing observed behavior patterns from Preservation Requirements
  - Test that existing degrees like S.Pd., M.Pd., Dr., Dra. continue to normalize correctly
  - Test that Amd.Keb. continues to normalize to "Amd.Keb."
  - Test that names without degrees continue to convert to UPPERCASE
  - Test that multiple degrees continue to be separated with ", "
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Fix for missing degree recognition

  - [x] 3.1 Implement the fix
    - Add `'SPDSD' => 'S.Pd.SD.'` to DEGREE_MAP in NormalizationService.php
    - Change `'AMD' => 'Amd.'` to `'AMD' => 'A.Md.'` in DEGREE_MAP
    - Verify `'AMA' => 'A.Ma.'` entry exists and is correct
    - Ensure proper ordering in DEGREE_MAP (longer keys before shorter ones)
    - _Bug_Condition: isBugCondition(input) where input contains S.Pd.SD. or A.Md._
    - _Expected_Behavior: normalizeTeacherName returns name with canonical degree format_
    - _Preservation: All existing degree normalizations must continue to work_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Missing Degree Recognition
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Existing Degree Normalization
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Run full test suite: `php artisan test --filter=NormalizationServiceTest`
  - Ensure all tests pass, ask the user if questions arise.
  - Verify no regressions in existing functionality
