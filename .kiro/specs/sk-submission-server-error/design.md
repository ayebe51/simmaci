# SK Submission Server Error Bugfix Design

## Overview

This bugfix addresses the generic "Server Error" message that users encounter when submitting SK documents through the submission form. The root cause is the lack of exception handling in the `submitRequest` method of `SkDocumentController`, which allows database-level errors (constraint violations, null values, etc.) to propagate as unhelpful generic errors.

The fix will implement comprehensive try-catch blocks around each database operation (teacher upsert, SK document creation, activity log creation) to catch specific exception types and return user-friendly error messages in Indonesian. This approach ensures users understand what went wrong and how to correct their submission, while preserving all existing successful submission behavior.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when any database operation in submitRequest fails (constraint violation, null school_id, missing required field, etc.)
- **Property (P)**: The desired behavior when database operations fail - return specific, user-friendly error messages instead of generic "Server Error"
- **Preservation**: Existing successful submission behavior that must remain unchanged by the fix
- **submitRequest**: The method in `backend/app/Http/Controllers/Api/SkDocumentController.php` that handles SK submission requests
- **QueryException**: Laravel's database exception class that wraps PDO exceptions for constraint violations, SQL errors, etc.
- **nomor_sk**: The SK document number with a unique constraint in the database (format: REQ/{year}/{sequence})
- **school_id**: The tenant identifier that must be non-null for operators; null school_id causes database constraint violations

## Bug Details

### Bug Condition

The bug manifests when a user submits an SK request AND any of the following database operations fail: teacher creation/update, SK document creation, or activity log creation. The `submitRequest` method lacks exception handling, causing database exceptions (QueryException, constraint violations, null value errors) to propagate unhandled to Laravel's global exception handler, which returns a generic "Server Error" message to the frontend.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type SkSubmissionRequest
  OUTPUT: boolean
  
  RETURN (teacherUpsertFails(input) OR skDocumentCreationFails(input) OR activityLogCreationFails(input))
         AND exceptionIsNotCaught()
         AND userReceivesGenericError()
         
WHERE:
  teacherUpsertFails(input) := 
    input.school_id IS NULL OR
    database constraint violated during Teacher::create/update
    
  skDocumentCreationFails(input) :=
    input.nomor_sk violates unique constraint OR
    input.school_id IS NULL OR
    required field is missing OR
    foreign key constraint violated
    
  activityLogCreationFails(input) :=
    database error during ActivityLog::log() call
    
  exceptionIsNotCaught() :=
    no try-catch block wraps the database operation
    
  userReceivesGenericError() :=
    frontend displays "Gagal menyimpan pengajuan: Server Error"
END FUNCTION
```

### Examples

- **Example 1**: Operator with `null school_id` submits SK request → Database constraint violation on `teachers.school_id` → Generic "Server Error" instead of "Akun operator belum terhubung ke sekolah"
- **Example 2**: Duplicate `nomor_sk` generated (race condition) → Unique constraint violation on `sk_documents.nomor_sk` → Generic "Server Error" instead of "Nomor SK sudah digunakan"
- **Example 3**: Invalid `teacher_id` reference → Foreign key constraint violation → Generic "Server Error" instead of "Data guru tidak valid"
- **Edge Case**: Activity log creation fails after successful SK creation → Should still return success (activity log is non-critical)

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Valid SK submissions with all required fields must continue to create teacher records, SK documents, and activity logs successfully
- Teacher upsert logic (match by NUPTK, NIP, or name+school_id) must continue to work exactly as before
- Temporary nomor_sk generation (REQ/{year}/{sequence}) with uniqueness checking must continue to work
- Operator school_id forcing (overriding unit_kerja lookup) must continue to work
- Successful submissions must continue to return 201 status with created SK data

**Scope:**
All inputs that do NOT trigger database exceptions should be completely unaffected by this fix. This includes:
- Valid SK submissions with proper data
- Successful teacher upserts (both create and update paths)
- Successful nomor_sk generation without collisions
- Successful activity log creation

## Hypothesized Root Cause

Based on the bug description and code analysis, the root causes are:

1. **Missing Exception Handling**: The `submitRequest` method has no try-catch blocks around database operations, allowing any `QueryException` or database error to propagate unhandled to Laravel's global exception handler

2. **Null school_id Validation Gap**: When an operator has `null school_id`, the code doesn't validate this before attempting database operations, causing constraint violations on `teachers.school_id` and `sk_documents.school_id` (both have `nullable()->constrained()` foreign keys)

3. **Generic Exception Messages**: Laravel's default exception handler returns generic "Server Error" messages for unhandled database exceptions, providing no actionable information to users

4. **No Constraint-Specific Error Mapping**: The code doesn't catch `QueryException` and inspect the error code/message to provide specific user-friendly messages for different constraint violations (unique, foreign key, not null, etc.)

## Correctness Properties

Property 1: Bug Condition - Specific Error Messages for Database Failures

_For any_ SK submission request where a database operation fails (teacher upsert, SK creation, or activity log creation), the fixed submitRequest method SHALL catch the exception, log it for debugging, and return a specific user-friendly error message in Indonesian describing what went wrong (e.g., "Nomor SK sudah digunakan", "Data sekolah tidak valid", "Akun operator belum terhubung ke sekolah").

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

Property 2: Preservation - Successful Submission Behavior

_For any_ SK submission request where all database operations succeed (no exceptions thrown), the fixed submitRequest method SHALL produce exactly the same result as the original method, creating the teacher record, SK document, and activity log, and returning a 201 status with the created SK data.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `backend/app/Http/Controllers/Api/SkDocumentController.php`

**Function**: `submitRequest`

**Specific Changes**:

1. **Add school_id Validation for Operators**: Before any database operations, validate that operators have a non-null `school_id`
   - Check `if ($request->user()->role === 'operator' && $request->user()->school_id === null)`
   - Return 400 error with message: "Akun operator belum terhubung ke sekolah. Hubungi administrator."

2. **Wrap Teacher Upsert in Try-Catch**: Add try-catch block around teacher creation/update logic
   - Catch `\Illuminate\Database\QueryException`
   - Inspect error code: 23505 (unique violation), 23503 (foreign key violation), 23502 (not null violation)
   - Return specific error messages based on constraint violated

3. **Wrap SK Document Creation in Try-Catch**: Add try-catch block around `SkDocument::create()`
   - Catch `\Illuminate\Database\QueryException`
   - Check for unique constraint on `nomor_sk`: return "Nomor SK sudah digunakan. Silakan coba lagi."
   - Check for foreign key violations: return "Data guru atau sekolah tidak valid"
   - Check for not null violations: return "Field wajib tidak boleh kosong"

4. **Wrap Activity Log Creation in Try-Catch**: Add try-catch block around `ActivityLog::log()`
   - Catch any exception but DO NOT fail the request
   - Log the error for debugging: `\Log::error('Failed to create activity log', ['exception' => $e])`
   - Continue execution and return success if SK was created successfully

5. **Add Logging for All Caught Exceptions**: Use Laravel's `\Log::error()` to log full exception details for debugging
   - Include exception message, code, trace, and request data
   - This helps developers diagnose issues without exposing sensitive details to users

### Error Message Mapping

| Exception Type | Constraint/Code | User-Friendly Message (Indonesian) |
|----------------|-----------------|-------------------------------------|
| QueryException | 23505 (unique) on `nomor_sk` | "Nomor SK sudah digunakan. Silakan coba lagi." |
| QueryException | 23503 (foreign key) on `teacher_id` | "Data guru tidak valid. Silakan periksa kembali." |
| QueryException | 23503 (foreign key) on `school_id` | "Data sekolah tidak valid. Hubungi administrator." |
| QueryException | 23502 (not null) | "Field wajib tidak boleh kosong. Periksa formulir Anda." |
| Validation | Operator with null `school_id` | "Akun operator belum terhubung ke sekolah. Hubungi administrator." |
| Generic Exception | Any other database error | "Gagal menyimpan pengajuan. Silakan coba lagi atau hubungi administrator." |

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that simulate database failures (null school_id, duplicate nomor_sk, constraint violations) and observe the error messages returned. Run these tests on the UNFIXED code to observe generic "Server Error" responses and confirm the root cause.

**Test Cases**:
1. **Null school_id Test**: Create operator user with `school_id = null`, submit SK request (will fail on unfixed code with generic error)
2. **Duplicate nomor_sk Test**: Mock `SkDocument::create()` to throw unique constraint exception (will fail on unfixed code with generic error)
3. **Invalid Foreign Key Test**: Submit SK with invalid `teacher_id` reference (will fail on unfixed code with generic error)
4. **Activity Log Failure Test**: Mock `ActivityLog::log()` to throw exception after successful SK creation (will fail on unfixed code, blocking the submission)

**Expected Counterexamples**:
- Generic "Server Error" messages returned for all database failures
- Possible causes: no try-catch blocks, no constraint-specific error mapping, no validation for null school_id

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior (specific error messages).

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := submitRequest_fixed(input)
  ASSERT result.status IN [400, 422, 500]
  ASSERT result.message IS specific AND user-friendly
  ASSERT result.message NOT EQUAL "Server Error"
  ASSERT exception is logged for debugging
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT submitRequest_original(input) = submitRequest_fixed(input)
  ASSERT teacher record created/updated correctly
  ASSERT SK document created with correct data
  ASSERT activity log created
  ASSERT response status = 201
  ASSERT response contains created SK data
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for valid submissions, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Valid Submission Preservation**: Observe that valid SK submissions work correctly on unfixed code, then write test to verify this continues after fix
2. **Teacher Upsert Preservation**: Observe that teacher matching (by NUPTK, NIP, name+school_id) works correctly on unfixed code, then write test to verify this continues after fix
3. **Nomor SK Generation Preservation**: Observe that temporary nomor_sk generation works correctly on unfixed code, then write test to verify this continues after fix
4. **Operator school_id Forcing Preservation**: Observe that operator school_id overrides unit_kerja lookup on unfixed code, then write test to verify this continues after fix

### Unit Tests

- Test null school_id validation for operators returns 400 with specific message
- Test duplicate nomor_sk constraint violation returns specific error message
- Test foreign key constraint violations return specific error messages
- Test activity log failure does not block successful SK creation
- Test valid submissions continue to work with 201 status

### Property-Based Tests

- Generate random valid SK submission data and verify all submissions succeed with 201 status
- Generate random teacher data (with/without NUPTK, NIP) and verify upsert logic works correctly
- Generate random nomor_sk sequences and verify uniqueness checking works
- Test that all valid inputs produce identical results before and after the fix

### Integration Tests

- Test full SK submission flow with valid data (operator → teacher upsert → SK creation → activity log)
- Test error handling flow with invalid data (null school_id, duplicate nomor_sk, etc.)
- Test that frontend receives specific error messages and can display them to users
- Test that activity log failures don't block successful submissions
