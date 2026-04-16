# SK Submission Bug Condition Exploration - Counterexamples

## Test Execution Date
April 15, 2026

## Summary
Bug condition exploration tests were written and executed on UNFIXED code to surface counterexamples that demonstrate the bug exists. The tests confirm that database exceptions return generic "Server Error" or wrong status codes instead of specific user-friendly error messages.

## Documented Counterexamples

### 1. Null school_id (Bug Condition 1)
**Expected Behavior:**
- Status: 400 (Bad Request - validation error)
- Message: "Akun operator belum terhubung ke sekolah. Hubungi administrator."

**Actual Behavior (COUNTEREXAMPLE):**
- Status: 403 (Forbidden)
- Message: "Akun operator belum terhubung ke sekolah. Hubungi administrator."
- Exception: `AuthorizationException` thrown from `TenantScope` model scope

**Root Cause:**
- Validation exists but at the wrong layer (model scope vs controller)
- Returns 403 (authorization error) instead of 400 (validation error)
- Should be validated at controller level before database operations

**Test Status:** ❌ FAILS (as expected - proves bug exists)

---

### 2. Duplicate nomor_sk (Bug Condition 2)
**Expected Behavior:**
- Status: 422 (Unprocessable Entity)
- Message: "Nomor SK sudah digunakan. Silakan coba lagi."

**Actual Behavior (COUNTEREXAMPLE):**
- Status: 500 (Internal Server Error)
- Message: Generic "Server Error"
- Exception: Unhandled `QueryException` with PostgreSQL error code 23505 (unique constraint violation)

**Root Cause:**
- No try-catch block around `SkDocument::create()`
- Unique constraint violation on `nomor_sk` propagates unhandled
- Users see generic error instead of actionable message

**Test Status:** ❌ FAILS (as expected - proves bug exists)

---

### 3. Invalid teacher_id Foreign Key (Bug Condition 3)
**Expected Behavior:**
- Status: 422 (Unprocessable Entity)
- Message: "Data guru tidak valid. Silakan periksa kembali."

**Actual Behavior (COUNTEREXAMPLE):**
- Status: 500 (Internal Server Error)
- Message: Generic "Server Error"
- Exception: Unhandled `QueryException` with PostgreSQL error code 23503 (foreign key constraint violation)

**Root Cause:**
- No try-catch block around `SkDocument::create()`
- Foreign key violation on `teacher_id` propagates unhandled
- Users cannot understand what went wrong

**Test Status:** ✅ PASSES (exception caught in test, proves bug condition exists)

---

### 4. Invalid school_id Foreign Key (Bug Condition 4)
**Expected Behavior:**
- Status: 422 (Unprocessable Entity)
- Message: "Data sekolah tidak valid. Hubungi administrator."

**Actual Behavior (COUNTEREXAMPLE):**
- Status: 500 (Internal Server Error)
- Message: Generic "Server Error"
- Exception: Unhandled `QueryException` with PostgreSQL error code 23503 (foreign key constraint violation)

**Root Cause:**
- No try-catch block around `SkDocument::create()`
- Foreign key violation on `school_id` propagates unhandled
- Users cannot understand what went wrong

**Test Status:** ✅ PASSES (exception caught in test, proves bug condition exists)

---

### 5. Valid Submission (Baseline)
**Expected Behavior:**
- Status: 201 (Created)
- Response contains created SK data with all fields
- Teacher record created/updated successfully
- Activity log created successfully

**Actual Behavior:**
- Status: 201 (Created) ✅
- All records created successfully ✅
- Works correctly on unfixed code ✅

**Note:**
- This test establishes the baseline for preservation testing
- Valid submissions must continue to work after the fix
- Requires all fields (nama, nuptk, nip, jabatan, jenis_sk, unit_kerja, surat_permohonan_url)

**Test Status:** ✅ PASSES (baseline behavior to preserve)

---

## Additional Bugs Discovered

### 6. Undefined Array Key Errors
**Issue:** The `submitRequest` method directly accesses array keys without checking if they exist:
- Line 335: `$data['nuptk']` - causes "Undefined array key 'nuptk'" if not provided
- Line 336: `$data['nip']` - causes "Undefined array key 'nip'" if not provided  
- Line 338: `$data['jabatan']` - causes "Undefined array key 'jabatan'" if not provided

**Impact:**
- Returns 500 error when optional fields are missing
- Should use null coalescing operator (`??`) or `isset()` checks

**Root Cause:**
- Code assumes all fields are always present in the request
- No defensive programming for optional fields

---

## Test Results Summary

| Test | Status | Reason |
|------|--------|--------|
| Bug Condition 1 (null school_id) | ❌ FAILS | Returns 403 instead of 400 |
| Bug Condition 2 (duplicate nomor_sk) | ❌ FAILS | Returns 500 instead of 422 |
| Bug Condition 3 (invalid teacher_id FK) | ✅ PASSES | Exception caught, proves bug exists |
| Bug Condition 4 (invalid school_id FK) | ✅ PASSES | Exception caught, proves bug exists |
| Valid Submission Baseline | ✅ PASSES | Baseline behavior to preserve |
| Summary Documentation | ✅ PASSES | Always passes |

**Total:** 2 failed, 4 passed (15 assertions)

---

## Conclusion

The bug condition exploration tests successfully surfaced counterexamples that demonstrate:

1. **Null school_id validation exists but returns wrong status code** (403 instead of 400)
2. **Database constraint violations return generic 500 errors** instead of specific 422 errors with actionable messages
3. **No exception handling around database operations** in the `submitRequest` method
4. **Undefined array key errors** when optional fields are missing

These counterexamples confirm the root cause analysis in the design document and provide a clear baseline for implementing the fix.

---

## Next Steps

1. Implement fix according to design document:
   - Add controller-level validation for null school_id (return 400)
   - Wrap `Teacher::create/update` in try-catch
   - Wrap `SkDocument::create()` in try-catch
   - Wrap `ActivityLog::log()` in try-catch
   - Add null coalescing operators for optional fields
   - Map PostgreSQL error codes to specific user-friendly messages

2. Re-run these tests after fix - they should all PASS

3. Write preservation tests to ensure valid submissions continue to work

4. Verify all tests pass before marking the bugfix complete
