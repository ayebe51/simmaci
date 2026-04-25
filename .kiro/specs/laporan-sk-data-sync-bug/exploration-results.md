# Bug Condition Exploration Results

**Date**: 2024-01-XX
**Test File**: `src/features/reports/laporanSkDataSync.exploration.test.ts`
**Status**: ✅ Bug Confirmed - Test FAILED as expected on unfixed code

---

## Summary

The bug condition exploration test successfully confirmed the root cause of the "Laporan SK" page data sync bug. The test FAILED on unfixed code, which proves the bug exists and validates our hypothesis.

---

## Counterexamples Found

### ✗ Counterexample 1: API Definition Mismatch

**Location**: `src/lib/api.ts` (line ~470)

**Current (Incorrect) Definition**:
```typescript
skReport: {
  list: (params?: Record<string, any>) => apiClient.get('/reports/sk', { params }).then((r) => r.data),
}
```

**Component Usage**: `src/features/reports/SkReportPageSimple.tsx:50`
```typescript
reportApi.skReport({
  start_date: startDate || undefined,
  end_date: endDate || undefined,
  school_id: selectedSchool !== 'all' ? selectedSchool : undefined,
  status: selectedStatus !== 'all' ? selectedStatus : undefined
})
```

**Test Result**:
```
=== Testing API Definition ===
reportApi.skReport type: object
Is it a function? false
Is it an object? true
Has .list() method? true

FAIL: expected 'object' to be 'function'
Expected: "function"
Received: "object"
```

**Impact**: 
- Component calls `reportApi.skReport(params)` as a function
- But it's defined as an object with `.list()` method
- This causes: `TypeError: reportApi.skReport is not a function`
- Page fails to load data

---

### ✗ Counterexample 2: Response Structure Mismatch

**Location**: Backend `ReportController::skReport` vs Frontend expectations

**Frontend Expects** (from `SkReportPageSimple.tsx`):
```typescript
{
  summary: {
    total: number,
    approved: number,
    pending: number,
    rejected: number,
    draft: number
  },
  byType: {
    gty: number,
    gtt: number,
    kamad: number,
    tendik: number
  },
  data: Array<SkDocument>
}
```

**Backend Returns** (from `bugfix.md`):
```json
{
  "total": 100,
  "by_status": {
    "approved": 50,
    "pending": 30,
    "rejected": 20
  },
  "by_jenis": {
    "GTY": 40,
    "GTT": 30,
    "Kamad": 20,
    "Tendik": 10
  },
  "data": [...]
}
```

**Mismatches**:
1. No `summary` wrapper object - data is at top level
2. `by_status` instead of nested in `summary`
3. `by_jenis` instead of `byType`
4. No `draft` status in `by_status`

**Impact**:
- `reportData.summary.total` → undefined (causes statistics cards to show empty)
- `reportData.summary.approved` → undefined (causes pie chart to fail)
- `reportData.byType.gty` → undefined (causes bar chart to fail)

---

### ✗ Counterexample 3: Case Sensitivity Issue

**Location**: Backend response keys vs Frontend expectations

**Frontend Expects** (lowercase):
```typescript
reportData.byType.gty
reportData.byType.gtt
reportData.byType.kamad
reportData.byType.tendik
```

**Backend Returns** (mixed case):
```json
{
  "by_jenis": {
    "GTY": 40,
    "GTT": 30,
    "Kamad": 20,
    "Tendik": 10
  }
}
```

**Impact**:
- Even if `by_jenis` was renamed to `byType`, the keys are uppercase/mixed case
- Frontend expects lowercase keys: `gty`, `gtt`, `kamad`, `tendik`
- Accessing `reportData.byType.gty` will return undefined
- Bar chart will show empty data

---

### ✗ Counterexample 4: Missing Draft Status

**Location**: Backend response vs Frontend expectations

**Frontend Expects**:
```typescript
reportData.summary.draft // Used in statistics cards
```

**Backend Returns**:
```json
{
  "by_status": {
    "approved": 50,
    "pending": 30,
    "rejected": 20
    // No "draft" key
  }
}
```

**Impact**:
- Frontend expects `summary.draft` to display draft count
- Backend doesn't include draft status in `by_status`
- Statistics card for "Draft" will show undefined or 0

---

## Root Cause Confirmed

The exploration test confirms the following root causes:

1. **API Definition Error**: `reportApi.skReport` is defined as an object but called as a function
2. **Response Structure Mismatch**: Backend returns flat structure, frontend expects nested structure
3. **Key Naming Mismatch**: Backend uses `by_status` and `by_jenis`, frontend expects `summary` and `byType`
4. **Case Sensitivity**: Backend returns uppercase/mixed case keys, frontend expects lowercase
5. **Missing Data**: Backend doesn't include `draft` status

---

## Fix Requirements

Based on the counterexamples found, the fix must:

1. **Change API Definition** in `src/lib/api.ts`:
   - From: `skReport: { list: (...) => ... }`
   - To: `skReport: (params?: Record<string, any>) => apiClient.get('/reports/sk', { params }).then((r) => r.data)`

2. **Transform Backend Response** in `backend/app/Http/Controllers/Api/ReportController.php`:
   - Wrap status counts in `summary` object
   - Rename `by_jenis` to `byType`
   - Convert all keys to lowercase (`GTY` → `gty`, `GTT` → `gtt`, etc.)
   - Include `draft` status in summary (default to 0 if not present)

3. **Expected Response Structure After Fix**:
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

---

## Test Execution Details

**Command**: `npm run test -- src/features/reports/laporanSkDataSync.exploration.test.ts --run`

**Result**: 
- ✅ Test FAILED as expected (proving bug exists)
- ✅ Counterexamples documented
- ✅ Root cause confirmed

**Test Output**:
```
FAIL  src/features/reports/laporanSkDataSync.exploration.test.ts
  Bug Condition Exploration - Laporan SK Data Sync
    1. API Definition Mismatch
      × MUST FAIL: reportApi.skReport should be callable as a function (but it is not)
        AssertionError: expected 'object' to be 'function'
```

---

## Next Steps

1. ✅ Task 1 Complete: Bug condition exploration test written and run
2. ⏳ Task 2: Implement fix in `src/lib/api.ts`
3. ⏳ Task 3: Implement fix in `backend/app/Http/Controllers/Api/ReportController.php`
4. ⏳ Task 4: Write fix checking tests
5. ⏳ Task 5: Write preservation checking tests
6. ⏳ Task 6: Verify all tests pass

---

## Conclusion

The bug condition exploration test successfully confirmed the root cause of the "Laporan SK" page data sync bug. The test FAILED on unfixed code (as expected), proving that:

1. The API definition is incorrect (object instead of function)
2. The response structure doesn't match frontend expectations
3. Case sensitivity issues exist in the response keys
4. Draft status is missing from the response

All counterexamples have been documented and the fix requirements are clear. The exploration phase is complete and we can proceed with implementing the fix.
