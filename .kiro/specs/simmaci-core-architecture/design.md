# Design Document: SIMMACI Core Architecture

## Overview

SIMMACI adalah aplikasi multi-tenant berbasis Laravel 12 + Filament yang melayani jaringan madrasah di bawah Ma'arif NU. Spec ini mendefinisikan fondasi arsitektur inti yang harus diterapkan secara konsisten di seluruh codebase sebelum pengembangan fitur domain lainnya.

Kondisi saat ini: beberapa pola sudah ada secara parsial — `TenantScope` middleware (bukan Global Scope), `AuditLogTrait`, `LogApiRequests` middleware — namun belum diterapkan secara konsisten. Controller masih mengakses model langsung, tidak ada Global Scope otomatis, dan format response JSON belum seragam.

Tujuan desain ini adalah menetapkan pola-pola berikut secara definitif:

1. **Multi-Tenancy via Eloquent Global Scope** — isolasi data otomatis per `school_id`
2. **Service-Repository Pattern** — pemisahan business logic dari query database
3. **Middleware EnsureTenantIsValid** — validasi konteks tenant sebelum request diproses
4. **IDOR Protection via Policy** — otorisasi resource per tenant
5. **Mass Assignment Protection** — `$fillable` eksplisit di semua model
6. **Standarisasi API Response** — format JSON seragam untuk semua endpoint
7. **Naming Convention** — konvensi penamaan konsisten di seluruh codebase
8. **Centralized Error Handling** — exception handler terpusat dengan logging kaya konteks
9. **Audit Trail** — pencatatan aktivitas CRUD otomatis
10. **UniqueForTenant Validation** — validasi keunikan dalam konteks tenant
11. **Struktur Direktori** — layout direktori yang jelas dan konsisten
12. **Konfigurasi Environment** — keamanan konfigurasi production

---

## Architecture

### Lapisan Arsitektur

```
┌─────────────────────────────────────────────────────────────┐
│                        HTTP Request                          │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    Middleware Stack                           │
│  HandleCors → auth:sanctum → EnsureTenantIsValid →          │
│  TenantScope (DB session) → LogApiRequests                   │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              Controller (app/Http/Controllers/Api/)          │
│  - Validasi input via FormRequest                            │
│  - Otorisasi via Policy ($this->authorize())                 │
│  - Delegasi ke Service Layer                                 │
│  - Return ApiResponse                                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                  Service Layer (app/Services/)               │
│  - Business logic                                            │
│  - Orchestrasi antar Repository                              │
│  - Tidak mengakses Model langsung                            │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              Repository Layer (app/Repositories/)            │
│  - Query Eloquent                                            │
│  - Implementasi interface dari Contracts/                    │
│  - TenantScope Global Scope aktif otomatis                   │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                  Eloquent Models (app/Models/)               │
│  - TenantScope Global Scope (boot)                           │
│  - AuditLogTrait (boot)                                      │
│  - $fillable eksplisit                                       │
│  - Auto-fill school_id via creating event                    │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    PostgreSQL Database                        │
│  - Shared database, isolated by school_id                    │
│  - RLS variable: app.current_school_id (opsional)            │
└─────────────────────────────────────────────────────────────┘
```

### Alur Multi-Tenancy

```
Request masuk
     │
     ▼
auth:sanctum → resolve $user
     │
     ▼
EnsureTenantIsValid
  ├─ Super Admin → pass
  └─ Operator → cek school aktif → 403 jika tidak valid
     │
     ▼
TenantScope (DB session) → SET app.current_school_id
     │
     ▼
Controller → Service → Repository
     │
     ▼
Eloquent Model dengan TenantScope Global Scope
  ├─ Operator → WHERE school_id = :user_school_id (otomatis)
  └─ Super Admin → tanpa filter (bypass)
```

### Alur Exception Handling

```
Exception terjadi di mana saja
     │
     ▼
bootstrap/app.php → withExceptions()
     │
     ├─ ValidationException     → 422 + ApiResponse errors
     ├─ AuthenticationException → 401 + ApiResponse
     ├─ AuthorizationException  → 403 + ApiResponse
     ├─ ModelNotFoundException  → 404 + ApiResponse
     └─ Throwable (lainnya)     → 500 + ApiResponse (generik di prod)
                                       + Log::error() dengan konteks lengkap
```

---

## Components and Interfaces

### 1. TenantScope (Eloquent Global Scope)

**File:** `app/Models/Scopes/TenantScope.php`

```php
interface Scope {
    public function apply(Builder $builder, Model $model): void;
}

class TenantScope implements Scope {
    public function apply(Builder $builder, Model $model): void
    // Menambahkan WHERE school_id = ? untuk Operator
    // Bypass untuk Super Admin
    // Throw AuthorizationException jika user tidak valid
}
```

**Trait untuk Model:** `app/Traits/HasTenantScope.php`

```php
trait HasTenantScope {
    public static function bootHasTenantScope(): void
    // Mendaftarkan TenantScope sebagai Global Scope
    // Mendaftarkan 'creating' event untuk auto-fill school_id

    public static function withoutTenantScope(): Builder
    // Mengembalikan query builder tanpa TenantScope
}
```

### 2. Repository Layer

**Interface Base:** `app/Repositories/Contracts/BaseRepositoryInterface.php`

```php
interface BaseRepositoryInterface {
    public function findById(int $id): ?Model;
    public function findAll(array $filters = []): Collection;
    public function create(array $data): Model;
    public function update(Model $model, array $data): Model;
    public function delete(Model $model): bool;
    public function paginate(int $perPage = 25, array $filters = []): LengthAwarePaginator;
}
```

**Abstract Base:** `app/Repositories/BaseRepository.php`

```php
abstract class BaseRepository implements BaseRepositoryInterface {
    public function __construct(protected Model $model) {}
    // Implementasi default semua method interface
}
```

**Contoh Interface:** `app/Repositories/Contracts/TeacherRepositoryInterface.php`

```php
interface TeacherRepositoryInterface extends BaseRepositoryInterface {
    public function findByNuptk(string $nuptk): ?Teacher;
    public function findBySchool(int $schoolId): Collection;
}
```

**Contoh Implementasi:** `app/Repositories/TeacherRepository.php`

```php
class TeacherRepository extends BaseRepository implements TeacherRepositoryInterface {
    public function __construct() {
        parent::__construct(new Teacher());
    }
}
```

### 3. Service Layer

**Abstract Base:** `app/Services/BaseService.php`

```php
abstract class BaseService {
    public function __construct(protected BaseRepositoryInterface $repository) {}
    // Method delegasi ke repository
}
```

**Contoh:** `app/Services/TeacherService.php`

```php
class TeacherService extends BaseService {
    public function __construct(TeacherRepositoryInterface $repository) {
        parent::__construct($repository);
    }
    public function createTeacher(array $data): Teacher;
    public function updateTeacher(Teacher $teacher, array $data): Teacher;
}
```

### 4. ApiResponse Trait

**File:** `app/Traits/ApiResponse.php`

```php
trait ApiResponse {
    protected function successResponse(mixed $data, string $message = 'Berhasil.', int $status = 200): JsonResponse;
    protected function errorResponse(string $message, mixed $errors = null, int $status = 400): JsonResponse;
    protected function validationErrorResponse(array $errors): JsonResponse;
    protected function paginatedResponse(LengthAwarePaginator $paginator, string $message = 'Berhasil.'): JsonResponse;
}
```

### 5. EnsureTenantIsValid Middleware

**File:** `app/Http/Middleware/EnsureTenantIsValid.php`

```php
class EnsureTenantIsValid {
    public function handle(Request $request, Closure $next): Response
    // Super Admin → pass
    // Operator → cek school_id tidak null
    //          → cek school ada di DB
    //          → cek school.status aktif
    //          → 403 jika gagal
}
```

### 6. UniqueForTenant Validation Rule

**File:** `app/Rules/UniqueForTenant.php`

```php
class UniqueForTenant implements ValidationRule {
    public function __construct(
        private string $table,
        private string $column,
        private ?int $ignoreId = null,
        private ?string $ignoreColumn = 'id'
    ) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    // Cek keunikan dalam school_id yang sama
    // Super Admin → cek global
    // Operator → cek per school_id
    // Ignore record saat update
}
```

### 7. Exception Handler

**Konfigurasi di:** `bootstrap/app.php` via `->withExceptions()`

```php
->withExceptions(function (Exceptions $exceptions): void {
    $exceptions->render(function (ValidationException $e, Request $request) { ... });
    $exceptions->render(function (AuthenticationException $e, Request $request) { ... });
    $exceptions->render(function (AuthorizationException $e, Request $request) { ... });
    $exceptions->render(function (ModelNotFoundException $e, Request $request) { ... });
    $exceptions->render(function (Throwable $e, Request $request) { ... });
    $exceptions->reportable(function (Throwable $e) { ... }); // Log dengan konteks
})
```

### 8. Policies

Setiap Policy mengikuti pola:

```php
class TeacherPolicy {
    public function before(User $user, string $ability): ?bool
    // Super Admin → return true (bypass semua check)

    public function view(User $user, Teacher $teacher): bool
    public function update(User $user, Teacher $teacher): bool
    public function delete(User $user, Teacher $teacher): bool
    // Operator → return $user->school_id === $teacher->school_id
}
```

### 9. Form Requests

Setiap Form Request mengikuti pola:

```php
class StoreTeacherRequest extends FormRequest {
    public function authorize(): bool
    // Cek otorisasi (bukan selalu return true)

    public function rules(): array
    // Validasi dengan UniqueForTenant untuk field unik
}
```

---

## Data Models

### Tenant-Aware Models (wajib HasTenantScope)

Semua model berikut harus menggunakan trait `HasTenantScope` dan `AuditLogTrait`:

| Model | Tabel | Field Unik (UniqueForTenant) |
|---|---|---|
| Teacher | teachers | nuptk, nomor_induk_maarif |
| Student | students | nisn, nomor_induk_maarif |
| TeacherAttendance | teacher_attendances | - |
| StudentAttendanceLog | student_attendance_logs | - |
| Event | events | - |
| Notification | notifications | - |
| SkDocument | sk_documents | - |
| NuptkSubmission | nuptk_submissions | - |
| HeadmasterTenure | headmaster_tenures | - |
| TeacherMutation | teacher_mutations | - |
| AttendanceSetting | attendance_settings | - |
| Setting | settings | - |
| SchoolClass | school_classes | - |
| Subject | subjects | - |
| LessonSchedule | lesson_schedules | - |
| SkArchive | sk_archives | - |
| AttendanceArchive | attendance_archives | - |
| ApprovalHistory | approval_histories | - |

### Non-Tenant Models (tidak menggunakan TenantScope)

| Model | Tabel | Keterangan |
|---|---|---|
| School | schools | nsm unik secara global |
| User | users | email unik secara global |
| ActivityLog | activity_logs | Log sistem, tidak di-scope |

### Struktur ActivityLog

```
activity_logs
├── id
├── school_id (nullable, FK ke schools)
├── log_name (string) — nama kategori log
├── description (string) — deskripsi aktivitas
├── subject_id (int, nullable) — ID record yang diubah
├── subject_type (string, nullable) — class name model
├── causer_id (int, nullable) — ID user yang melakukan
├── causer_type (string, nullable) — class name causer
├── event (string) — created/updated/deleted/login/dll
├── properties (json) — {old: {...}, new: {...}}
├── created_at
└── updated_at
```

### Struktur ApiResponse JSON

**Sukses:**
```json
{
  "success": true,
  "message": "Pesan sukses",
  "data": { ... }
}
```

**Sukses dengan Pagination:**
```json
{
  "success": true,
  "message": "Berhasil.",
  "data": {
    "items": [...],
    "meta": {
      "currentPage": 1,
      "lastPage": 5,
      "perPage": 25,
      "total": 120
    }
  }
}
```

**Error Validasi (422):**
```json
{
  "success": false,
  "message": "Data tidak valid.",
  "errors": { "field": ["pesan error"] }
}
```

**Error Server (500) — Production:**
```json
{
  "success": false,
  "message": "Terjadi kesalahan pada server.",
  "errors": null
}
```

**Error Server (500) — Non-Production:**
```json
{
  "success": false,
  "message": "Terjadi kesalahan pada server.",
  "errors": null,
  "debug": {
    "exception": "RuntimeException",
    "message": "...",
    "trace": [...]
  }
}
```

### Struktur Direktori Target

```
backend/app/
├── Console/Commands/
├── Exceptions/
│   └── (custom domain exceptions)
├── Filament/Resources/
├── Http/
│   ├── Controllers/Api/
│   ├── Middleware/
│   │   ├── EnsureTenantIsValid.php  ← BARU
│   │   ├── LogApiRequests.php       ← sudah ada
│   │   └── TenantScope.php          ← sudah ada (DB session)
│   └── Requests/                    ← BARU (Form Requests)
│       ├── Teacher/
│       │   ├── StoreTeacherRequest.php
│       │   └── UpdateTeacherRequest.php
│       └── Student/
│           ├── StoreStudentRequest.php
│           └── UpdateStudentRequest.php
├── Jobs/
├── Models/
│   └── Scopes/
│       └── TenantScope.php          ← BARU (Global Scope)
├── Policies/                        ← BARU
│   ├── TeacherPolicy.php
│   ├── StudentPolicy.php
│   ├── SkDocumentPolicy.php
│   ├── NuptkSubmissionPolicy.php
│   └── EventPolicy.php
├── Providers/
│   ├── AppServiceProvider.php       ← update (binding repository)
│   └── AuthServiceProvider.php      ← BARU (policy registration)
├── Repositories/
│   ├── Contracts/                   ← BARU
│   │   ├── BaseRepositoryInterface.php
│   │   ├── TeacherRepositoryInterface.php
│   │   └── StudentRepositoryInterface.php
│   ├── BaseRepository.php           ← BARU
│   ├── TeacherRepository.php        ← BARU
│   └── StudentRepository.php        ← BARU
├── Rules/
│   └── UniqueForTenant.php          ← BARU
├── Services/                        ← BARU
│   ├── BaseService.php
│   ├── TeacherService.php
│   └── StudentService.php
└── Traits/
    ├── ApiResponse.php              ← BARU
    ├── AuditLogTrait.php            ← sudah ada (update)
    └── HasTenantScope.php           ← BARU
```

---

## Correctness Properties


*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: TenantScope memfilter query Operator per school_id

*For any* model tenant-aware dan Operator dengan `school_id` tertentu, semua record yang dikembalikan oleh query Eloquent harus memiliki `school_id` yang sama dengan `school_id` Operator tersebut.

**Validates: Requirements 1.1, 1.2**

---

### Property 2: Super Admin bypass semua filter tenant

*For any* model tenant-aware dan user dengan role Super Admin, query Eloquent harus mengembalikan record dari semua `school_id` tanpa filter, dan Policy harus mengembalikan `true` untuk semua resource.

**Validates: Requirements 1.3, 3.4, 4.3**

---

### Property 3: Auto-fill school_id saat creating

*For any* model tenant-aware yang dibuat oleh Operator tanpa menyertakan `school_id` secara eksplisit, kolom `school_id` pada record yang tersimpan harus sama dengan `school_id` user yang sedang login.

**Validates: Requirements 1.5, 5.5**

---

### Property 4: withoutTenantScope() memungkinkan query lintas tenant

*For any* model tenant-aware, memanggil `withoutTenantScope()` harus mengembalikan query builder yang menghasilkan record dari semua `school_id` tanpa filter, terlepas dari role user yang sedang login.

**Validates: Requirements 1.7**

---

### Property 5: BaseRepository CRUD bekerja untuk semua input valid

*For any* model yang menggunakan `BaseRepository`, operasi `create` diikuti `findById` harus mengembalikan record yang ekuivalen (round-trip), dan operasi `delete` diikuti `findById` harus mengembalikan `null`.

**Validates: Requirements 2.2**

---

### Property 6: Exception propagasi dari Service ke caller

*For any* Service method yang memanggil Repository method yang melempar exception, exception tersebut harus naik ke caller tanpa ditangkap secara diam-diam oleh Service.

**Validates: Requirements 2.7**

---

### Property 7: Operator tanpa tenant valid → 403

*For any* request dari Operator yang `school_id`-nya `null`, tidak ditemukan di tabel `schools`, atau sekolahnya tidak aktif, middleware `EnsureTenantIsValid` harus mengembalikan HTTP 403 dengan pesan `"Tenant tidak valid atau tidak aktif."`.

**Validates: Requirements 3.2, 3.3**

---

### Property 8: Policy menolak akses Operator ke resource tenant lain

*For any* Operator dan resource tenant-aware yang `school_id`-nya berbeda dari `school_id` Operator tersebut, Policy harus mengembalikan `false` sehingga akses ditolak dengan HTTP 403.

**Validates: Requirements 4.2**

---

### Property 9: Field tidak dalam $fillable tidak tersimpan

*For any* model Eloquent dan request yang menyertakan field yang tidak ada dalam `$fillable` (termasuk field sensitif seperti `role`, `is_active`, `is_verified`), field tersebut harus diabaikan dan tidak tersimpan ke database.

**Validates: Requirements 5.1, 5.3, 5.4**

---

### Property 10: Response sukses selalu memiliki struktur konsisten

*For any* API endpoint yang berhasil diproses, response JSON harus memiliki key `success: true`, `message` (string), dan `data` (object atau array).

**Validates: Requirements 6.1, 6.2**

---

### Property 11: Response error validasi selalu memiliki struktur konsisten

*For any* `ValidationException` yang terjadi, response JSON harus memiliki key `success: false`, `message: "Data tidak valid."`, dan `errors` (object berisi field dan pesan error), dengan HTTP status 422.

**Validates: Requirements 6.3, 8.2**

---

### Property 12: Response 500 sesuai environment

*For any* unhandled exception di environment production, response JSON tidak boleh mengandung stack trace atau informasi internal sistem. Di environment non-production, response boleh menyertakan key `debug` berisi stack trace.

**Validates: Requirements 6.4, 6.5, 8.6**

---

### Property 13: Response paginated selalu memiliki struktur konsisten

*For any* API endpoint yang mengembalikan collection dengan pagination, response JSON harus memiliki key `data.items` (array) dan `data.meta` (object berisi `currentPage`, `lastPage`, `perPage`, `total`).

**Validates: Requirements 6.7**

---

### Property 14: Request tanpa autentikasi → 401

*For any* request ke endpoint yang dilindungi `auth:sanctum` tanpa token yang valid, response harus HTTP 401 dengan format `ApiResponse` dan pesan `"Unauthenticated."`.

**Validates: Requirements 8.3**

---

### Property 15: ModelNotFoundException → 404

*For any* request ke endpoint yang menggunakan Route Model Binding dengan ID yang tidak ada di database, response harus HTTP 404 dengan format `ApiResponse` dan pesan `"Data tidak ditemukan."`.

**Validates: Requirements 8.5**

---

### Property 16: Exception 500 selalu dicatat ke log dengan konteks lengkap

*For any* unhandled exception yang menghasilkan HTTP 500, log entry harus mengandung semua field berikut: `tenant_id`, `user_id`, `url`, `method`, `exception_class`, `message`, dan `stack_trace`.

**Validates: Requirements 8.7**

---

### Property 17: AuditLogTrait mencatat semua operasi CRUD

*For any* model yang menggunakan `AuditLogTrait`, setiap operasi `create`, `update`, dan `delete` harus menghasilkan satu record baru di tabel `activity_logs` yang mengandung: `school_id`, `log_name`, `description`, `subject_id`, `subject_type`, `causer_id`, `event`, dan `properties`.

**Validates: Requirements 9.1, 9.2**

---

### Property 18: Log level sesuai HTTP status code

*For any* API request yang diproses oleh `LogApiRequests` middleware, log entry harus menggunakan level `error` untuk status 5xx, `warning` untuk status 4xx, dan `info` untuk status 2xx/3xx.

**Validates: Requirements 9.4, 9.5, 9.6**

---

### Property 19: Field sensitif diredaksi di log

*For any* API request yang mengandung field `password`, `token`, atau `authorization` dalam request body, log entry yang dicatat oleh `LogApiRequests` tidak boleh mengandung nilai asli field tersebut — harus diganti dengan `"***REDACTED***"`.

**Validates: Requirements 9.8**

---

### Property 20: UniqueForTenant memvalidasi keunikan sesuai scope

*For any* validasi `UniqueForTenant` yang dijalankan oleh Operator, dua record dengan nilai field yang sama dan `school_id` yang sama harus dianggap tidak unik (invalid). Dua record dengan nilai field yang sama tetapi `school_id` berbeda harus dianggap unik (valid). Untuk Super Admin, keunikan divalidasi secara global tanpa filter `school_id`.

**Validates: Requirements 10.2, 10.4**

---

### Property 21: UniqueForTenant mengecualikan record saat update

*For any* validasi `UniqueForTenant` dalam konteks update dengan parameter `ignore`, record yang sedang diupdate harus dikecualikan dari pemeriksaan keunikan sehingga update dengan nilai yang sama tidak menghasilkan error validasi.

**Validates: Requirements 10.3**

---

## Error Handling

### Strategi Penanganan Exception

Semua exception ditangani secara terpusat di `bootstrap/app.php` menggunakan `->withExceptions()`. Tidak ada try-catch di controller atau service kecuali untuk transformasi domain exception yang spesifik.

### Peta Exception ke Response

| Exception | HTTP Status | Pesan |
|---|---|---|
| `ValidationException` | 422 | "Data tidak valid." + errors |
| `AuthenticationException` | 401 | "Unauthenticated." |
| `AuthorizationException` | 403 | "Aksi ini tidak diizinkan." |
| `ModelNotFoundException` | 404 | "Data tidak ditemukan." |
| `Throwable` (lainnya) | 500 | "Terjadi kesalahan pada server." |

### Logging Exception

Setiap exception yang menghasilkan HTTP 500 dicatat dengan konteks:

```php
Log::error('Unhandled exception', [
    'tenant_id'       => $request->user()?->school_id,
    'user_id'         => $request->user()?->id,
    'url'             => $request->fullUrl(),
    'method'          => $request->method(),
    'exception_class' => get_class($e),
    'message'         => $e->getMessage(),
    'stack_trace'     => $e->getTraceAsString(),
]);
```

### Keamanan Production

- `APP_DEBUG=false` wajib di production
- Stack trace tidak pernah disertakan dalam response production
- Whoops error page dinonaktifkan untuk semua request API

---

## Testing Strategy

### Pendekatan Dual Testing

Strategi pengujian menggunakan dua pendekatan yang saling melengkapi:

1. **Unit/Feature Tests** — memverifikasi contoh spesifik, edge case, dan kondisi error
2. **Property-Based Tests** — memverifikasi properti universal di seluruh input yang di-generate secara acak

### Library Property-Based Testing

Gunakan **[Pest PHP](https://pestphp.com/)** dengan plugin **[pest-plugin-faker](https://github.com/pestphp/pest-plugin-faker)** dan **[eris](https://github.com/giorgiosironi/eris)** atau **[php-quickcheck](https://github.com/steos/php-quickcheck)** untuk property-based testing di PHP.

Alternatif yang lebih sederhana: gunakan Pest dengan data provider yang di-generate secara acak menggunakan Faker, dengan minimum **100 iterasi per property test**.

### Konfigurasi Property Test

Setiap property test harus:
- Menjalankan minimum **100 iterasi** dengan input yang di-generate secara acak
- Menyertakan komentar referensi ke property di design document
- Menggunakan format tag: `Feature: simmaci-core-architecture, Property {N}: {deskripsi singkat}`

### Unit Tests (Contoh Spesifik dan Edge Cases)

**TenantScope:**
- Test bahwa model tanpa `HasTenantScope` tidak terpengaruh
- Test `withoutTenantScope()` di dalam Job (background process)
- Edge case: user dengan `school_id = null` dan bukan Super Admin → `AuthorizationException`

**Service-Repository:**
- Test binding container: `app(TeacherRepositoryInterface::class)` resolve ke `TeacherRepository`
- Test bahwa `TeacherService` dan `StudentService` dapat di-resolve dari container
- Test bahwa `BaseRepository::paginate()` mengembalikan `LengthAwarePaginator`

**EnsureTenantIsValid:**
- Test bahwa middleware terdaftar sebagai alias `tenant`
- Test bahwa route tanpa middleware `tenant` tidak terpengaruh

**Policies:**
- Test bahwa semua Policy terdaftar di `AuthServiceProvider`
- Test `before()` method untuk Super Admin

**Mass Assignment:**
- Test bahwa semua model memiliki `$fillable` yang tidak kosong
- Test bahwa tidak ada model menggunakan `$guarded = []`

**UniqueForTenant:**
- Test bahwa rule dapat di-instantiate dengan parameter `ignore`
- Test edge case: nilai `null` pada field yang divalidasi

**Logging:**
- Test bahwa log channel `api` terkonfigurasi di `config/logging.php`
- Test bahwa `AuditLogTrait` terdaftar di semua 18 model tenant-aware

### Property-Based Tests

```
// Feature: simmaci-core-architecture, Property 1: TenantScope memfilter query Operator per school_id
test('semua hasil query model tenant-aware hanya mengandung school_id Operator', function () {
    // Generate: random school_id, random Operator, random records dari berbagai school
    // Assert: Teacher::all() hanya mengandung record dengan school_id Operator
})->repeat(100);

// Feature: simmaci-core-architecture, Property 3: Auto-fill school_id saat creating
test('school_id terisi otomatis dari user yang login saat creating', function () {
    // Generate: random Operator, random teacher data tanpa school_id
    // Assert: teacher yang tersimpan memiliki school_id = Operator->school_id
})->repeat(100);

// Feature: simmaci-core-architecture, Property 7: Operator tanpa tenant valid → 403
test('Operator dengan school tidak valid selalu mendapat 403', function () {
    // Generate: random Operator dengan school_id null / tidak ada / tidak aktif
    // Assert: response status = 403, message = "Tenant tidak valid atau tidak aktif."
})->repeat(100);

// Feature: simmaci-core-architecture, Property 8: Policy menolak akses Operator ke resource tenant lain
test('Policy mengembalikan false untuk Operator yang mengakses resource tenant lain', function () {
    // Generate: random Operator A, random Teacher milik school B
    // Assert: TeacherPolicy->view(operatorA, teacherB) = false
})->repeat(100);

// Feature: simmaci-core-architecture, Property 9: Field tidak dalam $fillable tidak tersimpan
test('field di luar $fillable tidak tersimpan ke database', function () {
    // Generate: random model, random field name yang tidak ada dalam $fillable
    // Assert: setelah create/update, field tersebut tidak ada di database
})->repeat(100);

// Feature: simmaci-core-architecture, Property 17: AuditLogTrait mencatat semua operasi CRUD
test('setiap operasi CRUD menghasilkan satu ActivityLog dengan field lengkap', function () {
    // Generate: random tenant-aware model, random data
    // Assert: setelah create/update/delete, ActivityLog count bertambah 1 dengan field lengkap
})->repeat(100);

// Feature: simmaci-core-architecture, Property 19: Field sensitif diredaksi di log
test('field sensitif tidak muncul dalam log API', function () {
    // Generate: random request dengan field password/token
    // Assert: log entry tidak mengandung nilai asli field sensitif
})->repeat(100);

// Feature: simmaci-core-architecture, Property 20: UniqueForTenant memvalidasi keunikan sesuai scope
test('UniqueForTenant valid untuk nilai sama di school berbeda, invalid untuk school sama', function () {
    // Generate: random nuptk, random school_id A dan B
    // Assert: nuptk sama di school A dan B → valid
    //         nuptk sama di school A dan A → invalid
})->repeat(100);
```

### Coverage Target

- **Unit/Feature Tests**: semua controller endpoint, semua middleware, semua policy
- **Property Tests**: semua 21 property yang didefinisikan di atas
- **Minimum iterasi per property test**: 100
