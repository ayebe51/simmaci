# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - API Call Failure and Data Structure Mismatch
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Test concrete failing cases - API definition mismatch and response structure mismatch
  - Test that `reportApi.skReport(params)` throws TypeError on unfixed code (API defined as object with `.list()` but called as function)
  - Test that response structure `{ total, by_status, by_jenis, data }` cannot be accessed as `reportData.summary.total` (structure mismatch)
  - Test that `by_jenis` keys are uppercase (`GTY`) but frontend expects lowercase (`gty`) (case sensitivity issue)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found:
    - TypeError: `reportApi.skReport is not a function`
    - `reportData.summary` is undefined
    - `reportData.byType.gty` is undefined
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Other Report Pages and Features Behavior
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (other report pages)
  - Test that `reportApi.teacherRekap.list()` works correctly for teacher reports page
  - Test that export Excel functionality works after data is loaded
  - Test that print/PDF functionality works with existing layout
  - Test that filter madrasah appears for super_admin/admin_yayasan roles
  - Test that operator data is auto-scoped to their school_id
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Fix for Laporan SK data sync bug

  - [x] 3.1 Fix API definition in frontend
    - Open `src/lib/api.ts`
    - Change `reportApi.skReport` from object with `.list()` method to direct function
    - Before: `skReport: { list: (params) => apiClient.get('/reports/sk', { params }).then((r) => r.data) }`
    - After: `skReport: (params?: Record<string, any>) => apiClient.get('/reports/sk', { params }).then((r) => r.data)`
    - Ensure other report API methods remain unchanged (teacherRekap, summary, etc.)
    - _Bug_Condition: isBugCondition(input) where input.url = "/dashboard/reports/sk" AND apiDefinitionMismatch()_
    - _Expected_Behavior: reportApi.skReport(params) successfully calls endpoint without TypeError_
    - _Preservation: Other reportApi methods (teacherRekap.list, summary) remain unchanged_
    - _Requirements: 1.1, 2.1_

  - [x] 3.2 Transform response structure in backend
    - Open `backend/app/Http/Controllers/Api/ReportController.php`
    - Locate `skReport(Request $request)` method
    - Transform response structure to match frontend expectations:
      - Wrap `by_status` counts into `summary` object with keys: `total`, `approved`, `pending`, `rejected`, `draft`
      - Rename `by_jenis` to `byType`
      - Lowercase all `byType` keys: `GTY` → `gty`, `GTT` → `gtt`, `Kamad` → `kamad`, `Tendik` → `tendik`
      - Add draft status calculation if exists
      - Ensure case-insensitive grouping for `jenis_sk`
      - Maintain `data` array with same structure
    - Handle empty data case (return 0 for all counts)
    - Expected response structure:
      ```json
      {
        "summary": {
          "total": 100,
          "approved": 50,
          "pending": 30,
          "rejected": 20,
          "draft": 0
        },
        "byType": {
          "gty": 40,
          "gtt": 30,
          "kamad": 20,
          "tendik": 10
        },
        "data": [...]
      }
      ```
    - _Bug_Condition: isBugCondition(input) where input.url = "/dashboard/reports/sk" AND responseStructureMismatch()_
    - _Expected_Behavior: Backend returns structure matching frontend expectations (summary, byType, data)_
    - _Preservation: Other report endpoints (teacher report, summary) remain unchanged_
    - _Requirements: 1.2, 2.2, 2.3, 2.4_

  - [x] 3.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - API Call Success and Data Rendering
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - Verify `reportApi.skReport(params)` returns data without TypeError
    - Verify response has `summary` object with correct keys
    - Verify response has `byType` object with lowercase keys
    - Verify table data renders correctly in `SkReportPageSimple.tsx`
    - Verify statistics cards display correct numbers
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.4 Verify preservation tests still pass
    - **Property 2: Preservation** - Other Report Pages and Features Behavior
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - Verify teacher report page still works with `reportApi.teacherRekap.list()`
    - Verify export Excel functionality still works
    - Verify print/PDF functionality still works
    - Verify filter madrasah still appears for super_admin/admin_yayasan
    - Verify operator data still auto-scoped to school_id
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 4. Checkpoint - Ensure all tests pass
  - Run all tests (exploration + preservation)
  - Verify no regressions in other report pages
  - Test SK report page manually:
    - Open `/dashboard/reports/sk`
    - Verify data loads without errors
    - Verify table displays SK documents
    - Verify statistics cards show correct numbers
    - Apply filters (date range, status, school) and verify data updates
    - Test export Excel functionality
    - Test print/PDF functionality
  - Ask user if questions arise
