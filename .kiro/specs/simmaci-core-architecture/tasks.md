# Tasks: SIMMACI Core Architecture

## Task List

- [x] 1. Multi-Tenancy Global Scope
  - [x] 1.1 Buat `app/Models/Scopes/TenantScope.php` sebagai Eloquent Global Scope yang menambahkan `WHERE school_id = ?` untuk Operator dan bypass untuk Super Admin
  - [x] 1.2 Buat `app/Traits/HasTenantScope.php` yang mendaftarkan `TenantScope` sebagai Global Scope, menambahkan `creating` event untuk auto-fill `school_id`, dan menyediakan method `withoutTenantScope()`
  - [x] 1.3 Terapkan trait `HasTenantScope` pada semua 18 model tenant-aware: `Teacher`, `Student`, `TeacherAttendance`, `StudentAttendanceLog`, `Event`, `Notification`, `SkDocument`, `NuptkSubmission`, `HeadmasterTenure`, `TeacherMutation`, `AttendanceSetting`, `Setting`, `SchoolClass`, `Subject`, `LessonSchedule`, `SkArchive`, `AttendanceArchive`, `ApprovalHistory`
  - [x] 1.4 Hapus manual tenant scoping dari semua controller yang sudah ada (contoh: `TeacherController::index` yang menggunakan `forSchool()` secara manual)

- [x] 2. Service-Repository Pattern
  - [x] 2.1 Buat `app/Repositories/Contracts/BaseRepositoryInterface.php` dengan method: `findById`, `findAll`, `create`, `update`, `delete`, `paginate`
  - [x] 2.2 Buat `app/Repositories/BaseRepository.php` sebagai abstract class yang mengimplementasikan `BaseRepositoryInterface` menggunakan Eloquent Model yang di-inject via constructor
  - [x] 2.3 Buat `app/Services/BaseService.php` sebagai abstract class yang menerima `BaseRepositoryInterface` via constructor
  - [x] 2.4 Buat `app/Repositories/Contracts/TeacherRepositoryInterface.php` dan `app/Repositories/TeacherRepository.php`
  - [x] 2.5 Buat `app/Services/TeacherService.php` dengan method `createTeacher` dan `updateTeacher`
  - [x] 2.6 Buat `app/Repositories/Contracts/StudentRepositoryInterface.php` dan `app/Repositories/StudentRepository.php`
  - [x] 2.7 Buat `app/Services/StudentService.php` dengan method `createStudent` dan `updateStudent`
  - [x] 2.8 Daftarkan binding `TeacherRepositoryInterface → TeacherRepository` dan `StudentRepositoryInterface → StudentRepository` di `AppServiceProvider`
  - [x] 2.9 Refactor `TeacherController` untuk menggunakan `TeacherService` (inject via constructor) dan hapus akses langsung ke Model
  - [x] 2.10 Refactor `StudentController` untuk menggunakan `StudentService` (inject via constructor) dan hapus akses langsung ke Model

- [x] 3. Middleware EnsureTenantIsValid
  - [x] 3.1 Buat `app/Http/Middleware/EnsureTenantIsValid.php` yang memvalidasi `school_id` Operator (tidak null, ada di DB, status aktif) dan bypass untuk Super Admin
  - [x] 3.2 Daftarkan `EnsureTenantIsValid` sebagai alias `tenant` di `bootstrap/app.php`
  - [x] 3.3 Terapkan middleware `tenant` pada semua route group API yang memerlukan isolasi tenant di `routes/api.php`

- [x] 4. IDOR Protection via Policy
  - [x] 4.1 Buat `app/Providers/AuthServiceProvider.php` dan daftarkan di `bootstrap/app.php`
  - [x] 4.2 Buat `app/Policies/TeacherPolicy.php` dengan method `before` (Super Admin bypass), `view`, `update`, `delete`
  - [x] 4.3 Buat `app/Policies/StudentPolicy.php` dengan pola yang sama
  - [x] 4.4 Buat `app/Policies/SkDocumentPolicy.php`, `NuptkSubmissionPolicy.php`, `EventPolicy.php`
  - [x] 4.5 Daftarkan semua Policy di `AuthServiceProvider::$policies`
  - [x] 4.6 Tambahkan `$this->authorize()` di method `show`, `update`, `destroy` pada `TeacherController` dan `StudentController`

- [x] 5. Mass Assignment Protection
  - [x] 5.1 Audit semua model — pastikan setiap model memiliki `$fillable` eksplisit dan tidak menggunakan `$guarded = []`
  - [x] 5.2 Hapus `school_id` dari `$fillable` pada semua model tenant-aware (karena diisi otomatis via `creating` event dari task 1.2)
  - [x] 5.3 Pastikan field sensitif (`role`, `is_active`, `is_verified`, `is_sk_generated`) tidak dapat diubah melalui endpoint publik tanpa validasi eksplisit

- [x] 6. ApiResponse Trait dan Standarisasi Response
  - [x] 6.1 Buat `app/Traits/ApiResponse.php` dengan method: `successResponse`, `errorResponse`, `validationErrorResponse`, `paginatedResponse`
  - [x] 6.2 Tambahkan `use ApiResponse` pada `app/Http/Controllers/Controller.php` (base controller) agar semua controller mewarisinya
  - [x] 6.3 Refactor semua controller API yang sudah ada untuk menggunakan `ApiResponse` trait (ganti `response()->json(...)` langsung dengan method dari trait)

- [x] 7. Centralized Error Handling
  - [x] 7.1 Konfigurasi `->withExceptions()` di `bootstrap/app.php` untuk menangani: `ValidationException` (422), `AuthenticationException` (401), `AuthorizationException` (403), `ModelNotFoundException` (404), dan `Throwable` (500)
  - [x] 7.2 Implementasikan logging kontekstual di handler untuk exception 500: catat `tenant_id`, `user_id`, `url`, `method`, `exception_class`, `message`, `stack_trace`
  - [x] 7.3 Pastikan response 500 di production tidak menyertakan stack trace, dan di non-production menyertakan key `debug`

- [x] 8. Logging dan Audit Trail
  - [x] 8.1 Konfigurasi log channel `api` yang terpisah di `config/logging.php`
  - [x] 8.2 Update `AuditLogTrait` untuk memastikan field `properties` selalu menyertakan `old` dan `new` values pada event `updated`
  - [x] 8.3 Terapkan `AuditLogTrait` pada semua model tenant-aware yang belum menggunakannya (verifikasi semua 18 model)
  - [x] 8.4 Verifikasi `LogApiRequests` middleware sudah terdaftar dan aktif pada semua route API

- [x] 9. UniqueForTenant Validation Rule
  - [x] 9.1 Buat `app/Rules/UniqueForTenant.php` yang mengimplementasikan `ValidationRule` dengan parameter: `table`, `column`, `ignoreId`, `ignoreColumn`
  - [x] 9.2 Implementasikan logika: Operator → cek keunikan per `school_id`, Super Admin → cek keunikan global, update → exclude record dengan `ignoreId`

- [x] 10. Form Requests
  - [x] 10.1 Buat `app/Http/Requests/Teacher/StoreTeacherRequest.php` dengan validasi lengkap dan `UniqueForTenant` untuk `nuptk` dan `nomor_induk_maarif`
  - [x] 10.2 Buat `app/Http/Requests/Teacher/UpdateTeacherRequest.php` dengan `UniqueForTenant` yang menyertakan parameter `ignore`
  - [x] 10.3 Buat `app/Http/Requests/Student/StoreStudentRequest.php` dengan `UniqueForTenant` untuk `nisn` dan `nomor_induk_maarif`
  - [x] 10.4 Buat `app/Http/Requests/Student/UpdateStudentRequest.php`
  - [x] 10.5 Update `TeacherController` dan `StudentController` untuk menggunakan Form Request classes (ganti inline `$request->validate()`)

- [x] 11. Konfigurasi Environment dan CORS
  - [x] 11.1 Update `config/cors.php` untuk membaca `ALLOWED_ORIGINS` dari environment variable dan tidak menggunakan wildcard `*` di production
  - [x] 11.2 Tambahkan validasi di `AppServiceProvider::boot()` untuk mencatat peringatan log jika `APP_DEBUG=true` di environment production
  - [x] 11.3 Verifikasi `.env` terdaftar di `.gitignore` dan tidak ada file `.env` yang ter-commit

- [-] 12. Property-Based Tests
  - [ ] 12.1 Setup Pest PHP dengan konfigurasi untuk property-based testing (minimum 100 iterasi)
  - [ ] 12.2 Tulis property test untuk Property 1: TenantScope memfilter query Operator per school_id
  - [ ] 12.3 Tulis property test untuk Property 3: Auto-fill school_id saat creating
  - [ ] 12.4 Tulis property test untuk Property 7: Operator tanpa tenant valid → 403
  - [ ] 12.5 Tulis property test untuk Property 8: Policy menolak akses Operator ke resource tenant lain
  - [ ] 12.6 Tulis property test untuk Property 9: Field tidak dalam $fillable tidak tersimpan
  - [ ] 12.7 Tulis property test untuk Property 17: AuditLogTrait mencatat semua operasi CRUD
  - [ ] 12.8 Tulis property test untuk Property 19: Field sensitif diredaksi di log
  - [ ] 12.9 Tulis property test untuk Property 20: UniqueForTenant memvalidasi keunikan sesuai scope
  - [ ] 12.10 Tulis property test untuk Property 21: UniqueForTenant mengecualikan record saat update

- [ ] 13. Unit dan Feature Tests
  - [ ] 13.1 Tulis feature test untuk semua exception handler (ValidationException, AuthenticationException, AuthorizationException, ModelNotFoundException, Throwable)
  - [ ] 13.2 Tulis unit test untuk `ApiResponse` trait — verifikasi struktur response sukses, error validasi, dan error server
  - [ ] 13.3 Tulis unit test untuk `EnsureTenantIsValid` middleware
  - [ ] 13.4 Tulis unit test untuk `UniqueForTenant` rule — edge case: nilai null, update dengan nilai sama
  - [ ] 13.5 Tulis feature test untuk `TeacherController` dan `StudentController` menggunakan Service layer
  - [ ] 13.6 Tulis unit test struktural: semua model tenant-aware memiliki `HasTenantScope`, semua model memiliki `$fillable` eksplisit, tidak ada model menggunakan `$guarded = []`
