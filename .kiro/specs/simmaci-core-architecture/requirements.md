# Requirements Document

## Introduction

SIMMACI (Sistem Informasi Manajemen Ma'arif NU) adalah aplikasi multi-tenant berbasis Laravel 12 + Filament yang digunakan oleh jaringan madrasah di bawah naungan Ma'arif NU. Setiap madrasah (tenant) beroperasi secara terisolasi dalam satu database bersama menggunakan kolom `school_id` sebagai pemisah data.

Spec ini mendefinisikan fondasi arsitektur inti yang harus diimplementasikan secara konsisten di seluruh codebase, mencakup: multi-tenancy isolation, service-repository pattern, security standards, API response standardization, dan error handling. Fondasi ini menjadi prasyarat wajib sebelum pengembangan fitur-fitur domain lainnya.

Kondisi saat ini: beberapa pola sudah ada secara parsial (TenantScope middleware, AuditLogTrait, LogApiRequests middleware) namun belum diterapkan secara konsisten — misalnya controller masih mengakses model langsung tanpa service layer, tidak ada Global Scope otomatis pada model tenant-aware, dan belum ada format response JSON yang seragam.

---

## Glossary

- **SIMMACI**: Sistem Informasi Manajemen Ma'arif NU — aplikasi utama yang menjadi subjek spec ini.
- **Tenant**: Satu madrasah/sekolah yang terdaftar dalam sistem, diidentifikasi oleh `school_id`.
- **Tenant-Aware Model**: Model Eloquent yang memiliki kolom `school_id` dan datanya harus diisolasi per tenant (contoh: Teacher, Student, TeacherAttendance, Event, Notification, dll).
- **Non-Tenant Model**: Model yang datanya bersifat global dan tidak diisolasi per tenant (contoh: School).
- **Super Admin**: User dengan role `super_admin` atau `admin_yayasan` yang dapat mengakses data lintas tenant.
- **Operator**: User dengan role `operator` yang hanya dapat mengakses data milik tenant-nya sendiri.
- **Global Scope**: Mekanisme Eloquent yang secara otomatis menambahkan klausa `WHERE school_id = ?` pada setiap query model tenant-aware.
- **TenantScope**: Global Scope Eloquent yang mengimplementasikan isolasi tenant berdasarkan `school_id` user yang sedang login.
- **Service Layer**: Kelas PHP di namespace `App\Services` yang mengandung business logic dan berinteraksi dengan Repository Layer.
- **Repository Layer**: Kelas PHP di namespace `App\Repositories` yang mengandung query database dan berinteraksi langsung dengan Eloquent Model.
- **Repository_Interface**: Interface PHP di namespace `App\Repositories\Contracts` yang mendefinisikan kontrak Repository.
- **ApiResponse**: Helper class atau trait yang menghasilkan format JSON response yang seragam untuk semua API endpoint.
- **EnsureTenantIsValid**: Middleware yang memvalidasi bahwa user yang terautentikasi memiliki `school_id` yang valid dan aktif (untuk role Operator).
- **IDOR**: Insecure Direct Object Reference — kerentanan keamanan di mana user dapat mengakses resource milik tenant lain dengan menebak ID.
- **Policy**: Laravel Authorization Policy yang melindungi resource dari akses IDOR lintas tenant.
- **Mass Assignment**: Serangan di mana attacker menyisipkan field yang tidak diizinkan melalui request HTTP.
- **$fillable**: Property Eloquent yang mendefinisikan field yang diizinkan untuk mass assignment.
- **ActivityLog**: Model yang merekam semua aktivitas CRUD dalam sistem beserta konteks tenant, user, dan perubahan data.
- **Handler**: Exception Handler Laravel di `App\Exceptions\Handler` yang menangani semua exception secara terpusat.

---

## Requirements

### Requirement 1: Multi-Tenancy Global Scope pada Model Tenant-Aware

**User Story:** Sebagai Operator, saya ingin data yang saya akses selalu terbatas pada madrasah saya sendiri secara otomatis, sehingga saya tidak perlu khawatir data madrasah lain bocor ke tampilan saya.

#### Acceptance Criteria

1. THE SIMMACI SHALL menyediakan sebuah `TenantScope` Global Scope Eloquent yang menambahkan klausa `WHERE school_id = :current_school_id` pada setiap query model tenant-aware ketika user yang sedang login adalah Operator.
2. WHEN seorang Operator melakukan query pada model tenant-aware, THE TenantScope SHALL secara otomatis memfilter hasil hanya untuk `school_id` milik Operator tersebut tanpa memerlukan kode tambahan di controller atau service.
3. WHEN seorang Super Admin melakukan query pada model tenant-aware, THE TenantScope SHALL melewati filter `school_id` sehingga Super Admin dapat mengakses data seluruh tenant.
4. THE SIMMACI SHALL menerapkan `TenantScope` Global Scope pada semua model tenant-aware berikut: `Teacher`, `Student`, `TeacherAttendance`, `StudentAttendanceLog`, `Event`, `Notification`, `SkDocument`, `NuptkSubmission`, `HeadmasterTenure`, `TeacherMutation`, `AttendanceSetting`, `Setting`, `SchoolClass`, `Subject`, `LessonSchedule`, `SkArchive`, `AttendanceArchive`, `ApprovalHistory`.
5. WHEN sebuah model tenant-aware dibuat (event `creating`), THE SIMMACI SHALL secara otomatis mengisi kolom `school_id` dari `school_id` user yang sedang login melalui model event, sehingga tidak perlu diisi manual di controller.
6. IF user yang sedang login tidak memiliki `school_id` dan bukan Super Admin, THEN THE TenantScope SHALL melempar `AuthorizationException` dengan pesan yang jelas.
7. THE SIMMACI SHALL menyediakan method `withoutTenantScope()` pada model tenant-aware untuk memungkinkan Super Admin atau proses background (Jobs) melakukan query lintas tenant secara eksplisit.

---

### Requirement 2: Service-Repository Pattern

**User Story:** Sebagai developer, saya ingin business logic dan query database dipisahkan ke dalam layer yang berbeda, sehingga kode mudah diuji, dipelihara, dan tidak ada duplikasi logika di controller.

#### Acceptance Criteria

1. THE SIMMACI SHALL menyediakan struktur direktori `app/Services/` untuk Service Layer dan `app/Repositories/` untuk Repository Layer beserta `app/Repositories/Contracts/` untuk interface.
2. THE SIMMACI SHALL menyediakan `BaseRepository` abstract class yang mengimplementasikan operasi CRUD standar (`findById`, `findAll`, `create`, `update`, `delete`, `paginate`) menggunakan Eloquent Model yang di-inject melalui constructor.
3. THE SIMMACI SHALL menyediakan `BaseService` abstract class yang menerima Repository melalui constructor injection dan menyediakan method delegasi ke Repository.
4. WHEN sebuah fitur domain baru diimplementasikan, THE SIMMACI SHALL memastikan controller hanya memanggil Service Layer dan tidak mengakses Model atau Repository secara langsung.
5. THE SIMMACI SHALL mendaftarkan semua binding Repository Interface ke implementasinya di `AppServiceProvider` menggunakan Laravel service container.
6. THE SIMMACI SHALL menyediakan `TeacherRepository`, `TeacherService`, `StudentRepository`, `StudentService` sebagai implementasi referensi pertama yang mengikuti pola ini.
7. WHEN sebuah Service method melempar exception, THE Service SHALL membiarkan exception tersebut naik ke Handler tanpa menangkapnya secara diam-diam (silent catch), kecuali exception tersebut perlu ditransformasi menjadi domain exception yang lebih spesifik.

---

### Requirement 3: Middleware EnsureTenantIsValid

**User Story:** Sebagai sistem, saya ingin memastikan setiap request dari Operator selalu memiliki konteks tenant yang valid sebelum request diproses, sehingga tidak ada request yang lolos tanpa tenant context.

#### Acceptance Criteria

1. THE SIMMACI SHALL menyediakan middleware `EnsureTenantIsValid` yang dijalankan pada semua route API yang memerlukan autentikasi tenant.
2. WHEN seorang Operator mengirim request dan `school_id`-nya `null` atau tidak ditemukan di tabel `schools`, THEN THE EnsureTenantIsValid SHALL mengembalikan response JSON `403 Forbidden` dengan pesan `"Tenant tidak valid atau tidak aktif."`.
3. WHEN seorang Operator mengirim request dan sekolahnya memiliki status tidak aktif, THEN THE EnsureTenantIsValid SHALL mengembalikan response JSON `403 Forbidden` dengan pesan `"Tenant tidak valid atau tidak aktif."`.
4. WHEN seorang Super Admin mengirim request, THE EnsureTenantIsValid SHALL melewati validasi tenant dan melanjutkan request tanpa pemeriksaan `school_id`.
5. THE SIMMACI SHALL mendaftarkan `EnsureTenantIsValid` sebagai middleware alias `tenant` di `bootstrap/app.php` dan menerapkannya pada semua route group API yang memerlukan isolasi tenant.

---

### Requirement 4: IDOR Protection via Policy

**User Story:** Sebagai sistem, saya ingin memastikan Operator tidak dapat mengakses atau memodifikasi data milik madrasah lain meskipun mereka mengetahui ID record tersebut, sehingga data setiap madrasah terlindungi dari akses tidak sah.

#### Acceptance Criteria

1. THE SIMMACI SHALL menyediakan Laravel Policy untuk setiap resource utama yang tenant-aware: `TeacherPolicy`, `StudentPolicy`, `SkDocumentPolicy`, `NuptkSubmissionPolicy`, `EventPolicy`.
2. WHEN seorang Operator mencoba mengakses, mengubah, atau menghapus record yang `school_id`-nya berbeda dari `school_id` Operator tersebut, THEN THE Policy SHALL mengembalikan `false` sehingga Laravel melempar `AuthorizationException` (HTTP 403).
3. WHEN seorang Super Admin mencoba mengakses resource apapun, THE Policy SHALL mengembalikan `true` tanpa memeriksa `school_id`.
4. THE SIMMACI SHALL memanggil `$this->authorize()` atau `Gate::authorize()` di setiap controller method yang mengoperasikan resource spesifik (`show`, `update`, `destroy`) sebelum memproses request.
5. THE SIMMACI SHALL mendaftarkan semua Policy di `AuthServiceProvider` menggunakan array `$policies`.

---

### Requirement 5: Mass Assignment Protection

**User Story:** Sebagai sistem, saya ingin memastikan semua model Eloquent memiliki perlindungan mass assignment yang eksplisit, sehingga attacker tidak dapat menyisipkan field berbahaya seperti `school_id` atau `role` melalui request HTTP.

#### Acceptance Criteria

1. THE SIMMACI SHALL memastikan setiap model Eloquent mendefinisikan property `$fillable` secara eksplisit dengan hanya mencantumkan field yang boleh diisi melalui mass assignment.
2. THE SIMMACI SHALL memastikan tidak ada model yang menggunakan `$guarded = []` atau `$guarded = ['*']` sebagai pengganti `$fillable`.
3. THE SIMMACI SHALL memastikan field sensitif seperti `role`, `is_active`, `is_verified`, `is_sk_generated` tidak dapat diubah melalui endpoint publik tanpa validasi dan otorisasi eksplisit.
4. WHEN sebuah request mencoba mengisi field yang tidak ada dalam `$fillable`, THE SIMMACI SHALL mengabaikan field tersebut secara diam-diam sesuai perilaku default Laravel (tidak melempar error, namun field tidak tersimpan).
5. THE SIMMACI SHALL memastikan `school_id` pada model tenant-aware diisi secara otomatis melalui model event `creating` (lihat Requirement 1.5) dan tidak perlu ada dalam `$fillable` untuk request dari Operator.

---

### Requirement 6: Standarisasi Format API Response JSON

**User Story:** Sebagai developer frontend/mobile, saya ingin semua API endpoint mengembalikan format JSON yang konsisten dan dapat diprediksi, sehingga saya tidak perlu menulis kode penanganan response yang berbeda untuk setiap endpoint.

#### Acceptance Criteria

1. THE SIMMACI SHALL menyediakan `ApiResponse` trait atau helper class yang menghasilkan format response JSON seragam untuk semua kondisi: sukses, error validasi, error otorisasi, dan error server.
2. WHEN sebuah API request berhasil diproses, THE ApiResponse SHALL mengembalikan struktur JSON berikut:
   ```json
   {
     "success": true,
     "message": "Pesan sukses",
     "data": { ... }
   }
   ```
3. WHEN sebuah API request gagal karena validasi (HTTP 422), THE ApiResponse SHALL mengembalikan struktur JSON berikut:
   ```json
   {
     "success": false,
     "message": "Data tidak valid.",
     "errors": { "field": ["pesan error"] }
   }
   ```
4. WHEN sebuah API request gagal karena error server (HTTP 500), THE ApiResponse SHALL mengembalikan struktur JSON berikut di environment production:
   ```json
   {
     "success": false,
     "message": "Terjadi kesalahan pada server.",
     "errors": null
   }
   ```
5. WHEN sebuah API request gagal karena error server (HTTP 500), THE ApiResponse SHALL menyertakan `"debug"` key berisi stack trace hanya di environment non-production (local, staging).
6. THE SIMMACI SHALL menerapkan `ApiResponse` pada semua controller API yang sudah ada maupun yang baru dibuat.
7. THE SIMMACI SHALL memastikan response untuk resource collection (list) menggunakan format pagination Laravel yang konsisten dengan tambahan wrapper `"data"` key.

---

### Requirement 7: Standarisasi Naming Convention

**User Story:** Sebagai developer, saya ingin seluruh codebase mengikuti naming convention yang konsisten, sehingga kode mudah dibaca, diprediksi, dan tidak menimbulkan kebingungan saat onboarding developer baru.

#### Acceptance Criteria

1. THE SIMMACI SHALL menggunakan `PascalCase` untuk nama class, interface, trait, dan enum (contoh: `TeacherService`, `TenantScopeInterface`).
2. THE SIMMACI SHALL menggunakan `camelCase` untuk nama method dan variable PHP (contoh: `findBySchoolId`, `$teacherData`).
3. THE SIMMACI SHALL menggunakan `snake_case` untuk nama kolom database, nama tabel, dan key dalam JSON request/response yang merepresentasikan field database (contoh: `school_id`, `tanggal_lahir`).
4. THE SIMMACI SHALL menggunakan `camelCase` untuk key dalam JSON response yang merepresentasikan properti objek domain (contoh: `schoolId`, `unitKerja`, `isActive`).
5. THE SIMMACI SHALL menggunakan prefix `I` atau suffix `Interface` secara konsisten untuk semua interface (contoh: `TeacherRepositoryInterface` atau `ITeacherRepository`) — pilih satu konvensi dan terapkan di seluruh codebase.
6. THE SIMMACI SHALL menggunakan suffix `Service` untuk semua kelas Service Layer dan suffix `Repository` untuk semua kelas Repository Layer.
7. THE SIMMACI SHALL menggunakan `kebab-case` untuk nama route API (contoh: `/api/teacher-mutations`, `/api/nuptk-submissions`).

---

### Requirement 8: Error Handling Terpusat

**User Story:** Sebagai sistem, saya ingin semua exception ditangani secara terpusat dengan logging yang kaya konteks dan response yang aman untuk production, sehingga tidak ada stack trace yang bocor ke client dan setiap error dapat ditelusuri dengan mudah.

#### Acceptance Criteria

1. THE SIMMACI SHALL mengkonfigurasi Exception Handler di `bootstrap/app.php` (Laravel 12 style) untuk menangani semua exception secara terpusat dan mengembalikan format `ApiResponse` yang seragam.
2. WHEN sebuah `ValidationException` terjadi, THE Handler SHALL mengembalikan HTTP 422 dengan format `ApiResponse` error validasi (lihat Requirement 6.3).
3. WHEN sebuah `AuthenticationException` terjadi, THE Handler SHALL mengembalikan HTTP 401 dengan pesan `"Unauthenticated."` dalam format `ApiResponse`.
4. WHEN sebuah `AuthorizationException` terjadi, THE Handler SHALL mengembalikan HTTP 403 dengan pesan `"Aksi ini tidak diizinkan."` dalam format `ApiResponse`.
5. WHEN sebuah `ModelNotFoundException` terjadi, THE Handler SHALL mengembalikan HTTP 404 dengan pesan `"Data tidak ditemukan."` dalam format `ApiResponse`.
6. WHEN sebuah exception tidak tertangani (HTTP 500) terjadi di environment production, THE Handler SHALL mengembalikan HTTP 500 dengan pesan generik `"Terjadi kesalahan pada server."` tanpa menyertakan stack trace dalam response.
7. WHEN sebuah exception tidak tertangani terjadi, THE Handler SHALL mencatat log error menggunakan `Log::error()` dengan konteks berikut: `tenant_id` (school_id user), `user_id`, `url`, `method`, `exception_class`, `message`, dan `stack_trace`.
8. THE SIMMACI SHALL memastikan konfigurasi `APP_DEBUG=false` di environment production sehingga Laravel tidak menampilkan Whoops error page atau stack trace dalam response apapun.

---

### Requirement 9: Logging dan Audit Trail

**User Story:** Sebagai Super Admin, saya ingin setiap aktivitas CRUD yang terjadi di sistem tercatat secara otomatis dengan konteks yang lengkap, sehingga saya dapat menelusuri siapa melakukan apa, kapan, dan pada tenant mana.

#### Acceptance Criteria

1. THE SIMMACI SHALL memastikan semua model tenant-aware menggunakan `AuditLogTrait` yang secara otomatis mencatat aktivitas `created`, `updated`, dan `deleted` ke tabel `activity_logs`.
2. WHEN sebuah record dibuat, diubah, atau dihapus, THE AuditLogTrait SHALL mencatat: `school_id`, `log_name`, `description`, `subject_id`, `subject_type`, `causer_id`, `causer_type`, `event`, dan `properties` (berisi `old` dan `new` values untuk update).
3. THE SIMMACI SHALL memastikan `LogApiRequests` middleware terdaftar dan aktif pada semua route API, mencatat: `method`, `uri`, `status`, `duration_ms`, `ip`, `user_id`, dan `user_agent`.
4. WHEN sebuah API request menghasilkan HTTP 500, THE LogApiRequests SHALL mencatat log dengan level `error`.
5. WHEN sebuah API request menghasilkan HTTP 4xx, THE LogApiRequests SHALL mencatat log dengan level `warning`.
6. WHEN sebuah API request menghasilkan HTTP 2xx atau 3xx, THE LogApiRequests SHALL mencatat log dengan level `info`.
7. THE SIMMACI SHALL mengkonfigurasi log channel `api` yang terpisah dari log channel default di `config/logging.php` untuk memisahkan log API dari log aplikasi umum.
8. IF field sensitif (password, token, authorization header) ada dalam request body, THEN THE LogApiRequests SHALL meredaksi nilai field tersebut menjadi `"***REDACTED***"` sebelum mencatat ke log.

---

### Requirement 10: Validasi Unique Per Tenant

**User Story:** Sebagai sistem, saya ingin validasi keunikan data (seperti NUPTK, NISN) dilakukan dalam konteks tenant yang sama, sehingga dua madrasah berbeda dapat memiliki data dengan nilai yang sama tanpa konflik.

#### Acceptance Criteria

1. THE SIMMACI SHALL menyediakan custom validation rule `UniqueForTenant` yang memvalidasi keunikan nilai dalam konteks `school_id` tenant yang sedang aktif.
2. WHEN validasi `UniqueForTenant` dijalankan untuk field `nuptk` pada tabel `teachers`, THE UniqueForTenant SHALL memeriksa keunikan hanya di antara record dengan `school_id` yang sama dengan user yang sedang login.
3. WHEN validasi `UniqueForTenant` dijalankan dalam konteks update (bukan create), THE UniqueForTenant SHALL mengecualikan record yang sedang diupdate dari pemeriksaan keunikan menggunakan parameter `ignore`.
4. WHEN seorang Super Admin menjalankan validasi `UniqueForTenant` tanpa `school_id` aktif, THE UniqueForTenant SHALL memvalidasi keunikan secara global (tanpa filter `school_id`).
5. THE SIMMACI SHALL menerapkan `UniqueForTenant` pada field-field berikut: `nuptk` pada `teachers`, `nisn` pada `students`, `nsm` pada `schools`, `nomor_induk_maarif` pada `teachers` dan `students`.

---

### Requirement 11: Struktur Direktori dan Autoloading

**User Story:** Sebagai developer, saya ingin struktur direktori aplikasi mengikuti konvensi yang jelas dan konsisten, sehingga mudah menemukan file yang relevan dan menambahkan kode baru di tempat yang tepat.

#### Acceptance Criteria

1. THE SIMMACI SHALL memiliki struktur direktori `app/` sebagai berikut:
   - `app/Console/Commands/` — Artisan commands
   - `app/Exceptions/` — Custom exception classes
   - `app/Filament/Resources/` — Filament admin resources
   - `app/Http/Controllers/Api/` — API controllers
   - `app/Http/Middleware/` — HTTP middleware
   - `app/Http/Requests/` — Form Request classes untuk validasi
   - `app/Jobs/` — Queue jobs
   - `app/Models/` — Eloquent models
   - `app/Policies/` — Authorization policies
   - `app/Providers/` — Service providers
   - `app/Repositories/Contracts/` — Repository interfaces
   - `app/Repositories/` — Repository implementations
   - `app/Services/` — Service layer classes
   - `app/Traits/` — Reusable traits
2. THE SIMMACI SHALL menggunakan Form Request classes di `app/Http/Requests/` untuk semua validasi input, menggantikan inline `$request->validate()` di controller.
3. THE SIMMACI SHALL memastikan semua namespace mengikuti pola PSR-4 yang dikonfigurasi di `composer.json` dengan root namespace `App\`.
4. WHEN sebuah Form Request class dibuat, THE SIMMACI SHALL memastikan method `authorize()` memeriksa otorisasi yang sesuai dan tidak selalu mengembalikan `true`.

---

### Requirement 12: Konfigurasi Environment dan Keamanan Dasar

**User Story:** Sebagai tim operasional, saya ingin konfigurasi environment production terlindungi dan tidak mengekspos informasi sensitif, sehingga sistem aman dari kebocoran data konfigurasi.

#### Acceptance Criteria

1. THE SIMMACI SHALL memastikan file `.env` tidak pernah di-commit ke version control dan terdaftar dalam `.gitignore`.
2. THE SIMMACI SHALL memastikan `APP_DEBUG=false` dan `APP_ENV=production` dikonfigurasi di environment production.
3. THE SIMMACI SHALL memastikan `APP_KEY` di-generate menggunakan `php artisan key:generate` dan nilainya unik per environment.
4. WHEN aplikasi berjalan di environment production dan `APP_DEBUG=true`, THE SIMMACI SHALL mencatat peringatan di log bahwa konfigurasi debug aktif di production.
5. THE SIMMACI SHALL mengkonfigurasi CORS di `config/cors.php` untuk hanya mengizinkan origin yang terdaftar dalam `ALLOWED_ORIGINS` environment variable, bukan wildcard `*` di production.
6. THE SIMMACI SHALL memastikan semua route API yang memerlukan autentikasi dilindungi oleh middleware `auth:sanctum`.
