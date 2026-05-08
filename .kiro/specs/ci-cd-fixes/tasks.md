# Implementation Tasks: CI/CD Fixes

## Task 1: Verify MeetingRepositoryInterface Fix

Verifikasi bahwa MeetingRepositoryInterface sudah diperbaiki dan tidak melanggar Liskov Substitution Principle.

**Requirements:** Requirements section - Phase 1

### Sub-tasks

- [x] Read `backend/app/Repositories/Contracts/MeetingRepositoryInterface.php`
- [x] Verify interface extends `BaseRepositoryInterface`
- [x] Verify interface only defines `paginate()` and `findBySchoolId()`
- [x] Verify no method override with different signature
- [ ] Read `backend/app/Repositories/MeetingRepository.php`
- [ ] Verify class implements `MeetingRepositoryInterface`
- [ ] Verify all interface methods are implemented
- [ ] Verify implementation methods have correct signatures
- [ ] Verify additional methods (findById, create, update, delete) don't violate LSP

---

## Task 2: Verify MeetingService Dependency Injection

Verifikasi bahwa MeetingService menggunakan interface, bukan concrete class.

**Requirements:** Requirements section - Phase 1
**Dependencies:** Task 1

### Sub-tasks

- [ ] Find `MeetingService` class
- [ ] Verify service uses `MeetingRepositoryInterface` (not concrete class)
- [ ] Verify service calls only interface methods
- [ ] Verify no direct dependency on `MeetingRepository`

---

## Task 3: Verify Routes Protection

Verifikasi bahwa routes untuk SK template sudah dilindungi dengan auth:sanctum middleware.

**Requirements:** Requirements section - Phase 2
**Dependencies:** Task 2

### Sub-tasks

- [ ] Read `backend/routes/api.php`
- [ ] Verify `/sk-templates/active` is inside `auth:sanctum` middleware group
- [ ] Verify `/sk-templates/{id}/download` is inside `auth:sanctum` middleware group
- [ ] Verify routes are registered before wildcard routes
- [ ] Check middleware order in routes
- [ ] Verify `auth:sanctum` is applied first

---

## Task 4: Verify CORS Configuration

Verifikasi bahwa CORS configuration memungkinkan Authorization header dan expose Content-Disposition.

**Requirements:** Requirements section - Phase 2
**Dependencies:** Task 3

### Sub-tasks

- [ ] Check `config/cors.php` or CORS middleware
- [ ] Verify `allowed_headers` includes '*' or 'Authorization'
- [ ] Verify `exposed_headers` includes 'Content-Disposition'
- [ ] Verify `supports_credentials` is true

---

## Task 5: Verify SkTemplateController

Verifikasi bahwa SkTemplateController meng-set response headers dengan benar.

**Requirements:** Requirements section - Phase 2
**Dependencies:** Task 4

### Sub-tasks

- [ ] Read `backend/app/Http/Controllers/Api/SkTemplateController.php`
- [ ] Verify `active()` method checks `$request->user()`
- [ ] Verify `download()` method checks `$request->user()`
- [ ] Verify error response if user is null
- [ ] Verify `Content-Type` header is set correctly
- [ ] Verify `Content-Disposition` header is set with `attachment`
- [ ] Verify `Content-Length` header is set
- [ ] Verify `Cache-Control` header is set

---

## Task 6: Verify Frontend API Configuration

Verifikasi bahwa Axios client menambahkan Authorization header dengan benar.

**Requirements:** Requirements section - Phase 2
**Dependencies:** Task 5

### Sub-tasks

- [ ] Read `src/lib/api.ts`
- [ ] Verify Authorization header is added in interceptor
- [ ] Verify token is retrieved from localStorage
- [ ] Verify token format is correct (Bearer {token})

---

## Task 7: Verify Frontend Download Function

Verifikasi bahwa frontend download function menggunakan responseType blob dan error handling.

**Requirements:** Requirements section - Phase 2
**Dependencies:** Task 6

### Sub-tasks

- [ ] Find download template function in frontend
- [ ] Verify function uses `responseType: 'blob'`
- [ ] Verify function adds Authorization header
- [ ] Verify function triggers browser download
- [ ] Verify error handling

---

## Task 8: Fix CORS Configuration

Perbaiki CORS configuration jika diperlukan.

**Requirements:** Requirements section - Phase 3
**Dependencies:** Task 7

### Sub-tasks

- [ ] If CORS not allowing Authorization, update config
- [ ] If Content-Disposition not exposed, add to exposed_headers
- [ ] Verify CORS headers in response

---

## Task 9: Refactor Frontend Download Function

Refactor frontend download function untuk menggunakan apiClient dan error handling yang lebih baik.

**Requirements:** Requirements section - Phase 3
**Dependencies:** Task 8

### Sub-tasks

- [ ] If Authorization header not added, add it
- [ ] If responseType not set, set it to 'blob'
- [ ] If download not triggered, implement it
- [ ] If error handling missing, add it

---

## Task 10: Run Backend Tests

Jalankan backend tests untuk memverifikasi tidak ada regresi.

**Requirements:** Requirements section - Phase 4
**Dependencies:** Task 9

### Sub-tasks

- [ ] Write test for `MeetingRepository::paginate()`
- [ ] Write test for `MeetingRepository::findBySchoolId()`
- [ ] Write test for `SkTemplateController::active()`
- [ ] Write test for `SkTemplateController::download()`
- [ ] Run tests: `php artisan test`

---

## Task 11: Run Frontend Tests

Jalankan frontend tests untuk memverifikasi tidak ada errors.

**Requirements:** Requirements section - Phase 4
**Dependencies:** Task 10

### Sub-tasks

- [ ] Write test for download function
- [ ] Test Authorization header is added
- [ ] Test error handling
- [ ] Run tests: `npm run test`
- [ ] Run lint: `npm run lint`
- [ ] Run build: `npm run build`

---

## Task 12: Manual Testing

Test download functionality secara manual.

**Requirements:** Requirements section - Phase 5
**Dependencies:** Task 11

### Sub-tasks

- [ ] Login to application
- [ ] Navigate to SK template download page
- [ ] Click download button
- [ ] Verify file is downloaded
- [ ] Verify file is correct
- [ ] Test with expired token
- [ ] Test with invalid token
- [ ] Test with missing file
- [ ] Test with invalid template ID
- [ ] Verify error messages are correct

---

## Task 13: Run CI/CD Pipeline

Jalankan GitHub Actions workflow untuk memverifikasi semua checks pass.

**Requirements:** Requirements section - Phase 5
**Dependencies:** Task 12

### Sub-tasks

- [ ] Run GitHub Actions workflow
- [ ] Verify backend tests pass
- [ ] Verify frontend lint passes
- [ ] Verify frontend build passes
- [ ] Check for any errors or warnings

---

## Task 14: Final Verification

Verifikasi final bahwa semua fixes bekerja dengan benar.

**Requirements:** Requirements section - Phase 5
**Dependencies:** Task 13

### Sub-tasks

- [ ] Verify all fixes are working correctly
- [ ] Verify no regressions introduced
- [ ] Verify CI/CD pipeline passes
- [ ] Verify download functionality works

---

## Task 15: Documentation

Update dokumentasi untuk mencerminkan fixes yang dilakukan.

**Requirements:** Requirements section - Phase 6
**Dependencies:** Task 14

### Sub-tasks

- [ ] Document `/sk-templates/active` endpoint
- [ ] Document `/sk-templates/{id}/download` endpoint
- [ ] Document required headers
- [ ] Document response format
- [ ] Document error responses
- [ ] Document download function
- [ ] Document error handling
- [ ] Document usage examples
- [ ] Document configuration
- [ ] Document deployment steps
- [ ] Document troubleshooting
- [ ] Document rollback procedure

---

## Summary

Total Tasks: 15
- Completed: 1 (Task 1 - Verify MeetingRepositoryInterface Fix)
- In Progress: 0
- Not Started: 14
- Ready: 1 (Task 2 - Verify MeetingService Dependency Injection)
