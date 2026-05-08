# Requirements: CI/CD Fixes

## Overview
Spec ini mendokumentasikan dua masalah yang perlu di-fix:
1. **CI/CD Failure (FIXED)**: Liskov Substitution Principle (LSP) violation di `MeetingRepositoryInterface`
2. **Download Template Surat Permohonan**: Frontend gagal download template surat permohonan dengan Authorization header

---

## 1. MeetingRepositoryInterface LSP Violation (FIXED)

### Masalah
- `MeetingRepository` mengimplementasikan method yang tidak didefinisikan di interface `MeetingRepositoryInterface`
- Ini melanggar Liskov Substitution Principle (LSP) — interface harus mendefinisikan semua method public yang diimplementasikan
- CI/CD pipeline gagal karena violation ini

### Solusi yang Diharapkan
- Interface `MeetingRepositoryInterface` hanya mendefinisikan method yang benar-benar diperlukan oleh consumer
- Implementasi `MeetingRepository` dapat memiliki method tambahan yang tidak di-expose di interface
- Semua method yang di-expose di interface harus compatible dengan parent interface `BaseRepositoryInterface`

### Acceptance Criteria
- [ ] Verifikasi `MeetingRepositoryInterface` hanya mendefinisikan `paginate()` dan `findBySchoolId()`
- [ ] Verifikasi `MeetingRepository` mengimplementasikan semua method di interface
- [ ] Verifikasi tidak ada method override yang tidak compatible dengan parent interface
- [ ] CI/CD pipeline lulus tanpa error LSP

---

## 2. Download Template Surat Permohonan Issue

### Masalah
- Frontend gagal download template surat permohonan
- Commit message menunjukkan "use fetch with Authorization header" — ada issue dengan Authorization header handling
- Endpoint `/sk-templates/active` dan `/sk-templates/{id}/download` mungkin tidak menerima token dengan benar

### Root Cause Analysis
Kemungkinan penyebab:
1. **Authorization Header tidak di-forward**: Frontend mengirim token tapi backend tidak menerima
2. **Middleware auth:sanctum tidak di-apply**: Routes tidak protected dengan middleware
3. **CORS issue**: Authorization header di-block oleh CORS policy
4. **Token format salah**: Frontend mengirim token dengan format yang tidak sesuai (e.g., "Bearer token" vs "token")
5. **File storage issue**: File template tidak ada di storage atau path salah

### Solusi yang Diharapkan
1. Verifikasi routes `/sk-templates/active` dan `/sk-templates/{id}/download` protected dengan `auth:sanctum`
2. Verifikasi Authorization header di-handle dengan benar oleh Laravel Sanctum
3. Verifikasi CORS headers memungkinkan Authorization header
4. Verifikasi file template ada di storage dan path benar
5. Verifikasi response headers untuk download (Content-Disposition, Content-Type)

### Acceptance Criteria
- [ ] Endpoint `/sk-templates/active` dapat diakses dengan valid token
- [ ] Endpoint `/sk-templates/{id}/download` dapat diakses dengan valid token
- [ ] Authorization header di-forward dengan benar ke backend
- [ ] Response headers untuk download benar (Content-Disposition: attachment)
- [ ] File template di-download dengan benar ke client
- [ ] Error handling untuk missing file atau invalid token
- [ ] CORS headers memungkinkan Authorization header

---

## 3. CI/CD Pipeline Verification

### Masalah
- CI/CD pipeline perlu di-test setelah fix untuk memastikan tidak ada regression

### Solusi yang Diharapkan
- Jalankan GitHub Actions workflow untuk backend PHPUnit tests
- Jalankan GitHub Actions workflow untuk frontend ESLint + Vite build
- Verifikasi semua tests lulus

### Acceptance Criteria
- [ ] Backend PHPUnit tests lulus
- [ ] Frontend ESLint lulus
- [ ] Frontend Vite build lulus
- [ ] Tidak ada error atau warning di CI/CD pipeline

---

## Technical Context

### Current Implementation
- **Backend**: Laravel 12 dengan Sanctum untuk authentication
- **Frontend**: React 19 + Vite dengan Axios untuk API calls
- **Routes**: `/sk-templates/active` dan `/sk-templates/{id}/download` protected dengan `auth:sanctum`
- **Middleware**: `CheckRole` untuk role-based access control

### Key Files
- Backend:
  - `backend/app/Http/Controllers/Api/SkTemplateController.php` — controller untuk SK template
  - `backend/app/Repositories/Contracts/MeetingRepositoryInterface.php` — interface
  - `backend/app/Repositories/MeetingRepository.php` — implementasi
  - `backend/routes/api.php` — routes definition
  - `backend/app/Http/Middleware/CheckRole.php` — role middleware

- Frontend:
  - `src/lib/api.ts` — central Axios client
  - `src/features/sk-management/` — SK management feature
  - `.env` / `.env.local` — environment variables

---

## Dependencies
- Laravel 12 + Sanctum
- React 19 + Axios
- GitHub Actions CI/CD
- PHPUnit (backend tests)
- ESLint (frontend linting)
- Vite (frontend build)

---

## Notes
- MeetingRepositoryInterface fix sudah dilakukan, tinggal verifikasi
- Download template issue perlu debugging lebih lanjut untuk menemukan root cause
- Pastikan Authorization header di-handle dengan benar di semua layer (frontend, middleware, controller)
