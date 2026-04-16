# Teacher Import 500 Error — Bugfix Design

## Overview

Fitur `POST /api/teachers/import` mengembalikan HTTP 500 akibat lima bug yang saling berkaitan di layer routing, data filtering, tenant scoping, dan audit logging. Fix ini bersifat minimal dan targeted: memperbaiki kelima bug tanpa mengubah logika bisnis import yang sudah ada. Pendekatan fix mengutamakan defensive programming — setiap bug diperbaiki di titik paling dekat dengan sumbernya agar tidak menimbulkan regresi.

## Glossary

- **Bug_Condition (C)**: Kondisi yang memicu HTTP 500 — salah satu dari lima bug aktif saat request `POST /api/teachers/import` diproses
- **Property (P)**: Perilaku yang diharapkan — import mengembalikan HTTP 200 dengan `{ created, errors, summary }` untuk semua input valid
- **Preservation**: Perilaku yang tidak boleh berubah — CRUD manual guru, tenant scoping pada GET, partial success, upsert NUPTK, dan auto-fill `school_id` operator
- **TenantScope**: Global scope Eloquent di `App\Models\Scopes\TenantScope` yang memfilter query berdasarkan `school_id` user yang sedang login
- **AuditLogTrait**: Trait di `App\Traits\AuditLogTrait` yang mencatat activity log otomatis pada event `created`, `updated`, `deleted` model
- **HasTenantScope**: Trait di `App\Traits\HasTenantScope` yang mendaftarkan `TenantScope` sebagai global scope dan menyediakan `withoutTenantScope()`
- **array_filter**: Fungsi PHP yang secara default membuang semua nilai falsy (`false`, `0`, `""`, `null`) — berbahaya untuk field boolean
- **apiResource**: `Route::apiResource()` yang mendaftarkan 7 route CRUD standar termasuk `GET /teachers/{teacher}` (show)
- **ImportTeachersJob**: Job antrian di `app/Jobs/ImportTeachersJob.php` — saat ini tidak digunakan oleh controller import

## Bug Details

### Bug Condition

Lima bug aktif yang secara individual atau kombinasi memicu HTTP 500 saat `POST /api/teachers/import` diproses.

**Formal Specification:**
```
FUNCTION isBugCondition(request)
  INPUT: request berupa HTTP POST ke /api/teachers/import
  OUTPUT: boolean

  RETURN (
    Bug1_RouteConflict(request)        -- import route terdaftar setelah apiResource
    OR Bug2_ArrayFilter(request)       -- baris memiliki is_certified = false
    OR Bug3_TenantScope(request)       -- user adalah super_admin, query NUPTK diblokir
    OR Bug4_AuditLog(request)          -- AuditLogTrait melempar exception saat create/update
    OR Bug5_JobException(request)      -- exception di level job tidak di-handle per baris
  )
END FUNCTION
```

### Contoh Konkret

- **Bug 1**: `POST /api/teachers/import` → Laravel memetakan ke `TeacherController@show` dengan `{teacher} = 'import'` → model binding gagal → 500 `ModelNotFoundException`
- **Bug 2**: Baris dengan `is_certified = false` → `array_filter($dataToSave, fn($v) => !is_null($v))` membuang `false` → field `is_certified` hilang dari payload → DB constraint error atau nilai salah tersimpan
- **Bug 3**: Super admin (tanpa `school_id`) mengirim import → `Teacher::where('nuptk', $nuptk)->first()` → `TenantScope::apply()` dipanggil → karena `school_id` null dan bukan super_admin path yang benar → `AuthorizationException` → 500 *(catatan: TenantScope sudah bypass super_admin, tapi jika auth context hilang di dalam job/closure, bisa throw)*
- **Bug 4**: `Teacher::create($savePayload)` berhasil → `AuditLogTrait::logActivity()` dipanggil → `ActivityLog::create()` gagal (misal: `properties` terlalu besar atau constraint) → exception tidak tertangkap → rollback seluruh baris
- **Bug 5**: Exception apapun di dalam loop `foreach ($request->teachers as $index => $row)` yang tidak tertangkap oleh `catch (\Throwable $e)` yang ada → menghentikan seluruh proses import

## Expected Behavior

### Preservation Requirements

**Perilaku yang tidak boleh berubah:**
- `POST /api/teachers` (store manual) harus tetap memvalidasi, menyimpan guru, dan mencatat audit log dengan benar
- `GET /api/teachers` harus tetap menerapkan tenant scope sesuai role pengguna (operator hanya melihat sekolahnya)
- Import dengan campuran baris valid dan invalid harus tetap mengembalikan partial success dengan daftar error per baris
- Guru dengan NUPTK yang sama harus tetap di-update (upsert), bukan dibuat duplikat
- Operator dengan `school_id` valid harus tetap mendapatkan auto-fill `school_id` pada setiap baris yang diimport

**Scope:**
Semua request yang BUKAN `POST /api/teachers/import` tidak boleh terpengaruh oleh fix ini. Ini mencakup:
- Semua endpoint CRUD guru (`GET`, `POST`, `PUT`, `DELETE`)
- Semua endpoint resource lain (students, schools, sk-documents, dll.)
- Behavior `TenantScope` untuk operator (harus tetap memfilter berdasarkan `school_id`)
- Behavior `AuditLogTrait` untuk operasi normal (harus tetap mencatat log)

## Hypothesized Root Cause

Berdasarkan analisis kode di `routes/api.php` dan `TeacherController.php`:

1. **Route Registration Order (Bug 1)**: Di `routes/api.php`, `Route::apiResource('teachers', ...)` didaftarkan **sebelum** `Route::post('teachers/import', ...)`. Laravel mencocokkan route secara berurutan — `GET /teachers/{teacher}` dari apiResource menangkap `POST /teachers/import` sebelum route import terdaftar. Fix: pindahkan `Route::post('teachers/import', ...)` ke **atas** `Route::apiResource('teachers', ...)`.

2. **array_filter Falsy Removal (Bug 2)**: Di `TeacherController::import()`, baris:
   ```php
   $savePayload = array_merge(array_filter($dataToSave, fn($v) => !is_null($v)), ['school_id' => $schoolId]);
   ```
   Callback `fn($v) => !is_null($v)` mempertahankan `false` dengan benar. Namun ada kemungkinan `array_filter` tanpa callback digunakan di tempat lain, atau `false` dikonversi ke string `""` sebelumnya. Perlu verifikasi bahwa `is_certified = false` tidak dibuang di tahap manapun.

3. **TenantScope in Import Context (Bug 3)**: Query `Teacher::where('nuptk', $nuptk)->first()` di dalam `import()` menggunakan model dengan `HasTenantScope`. Meskipun `TenantScope` sudah bypass `super_admin`, jika import dijalankan dalam konteks yang auth-nya tidak tersedia (misal via job atau test), scope bisa melempar exception. Fix: gunakan `Teacher::withoutTenantScope()->where('nuptk', $nuptk)->first()` untuk lookup di dalam import.

4. **AuditLogTrait Unhandled Exception (Bug 4)**: `AuditLogTrait::logActivity()` memanggil `ActivityLog::create()` secara langsung tanpa try-catch. Jika `ActivityLog::create()` gagal (constraint violation, koneksi DB, dll.), exception akan bubble up dan menggagalkan operasi `Teacher::create()` atau `Teacher::update()` yang sudah berhasil. Fix: wrap `ActivityLog::create()` dalam try-catch di dalam `logActivity()`.

5. **Import Job Exception Propagation (Bug 5)**: `ImportTeachersJob::handle()` sudah memiliki try-catch per baris, tapi controller `import()` juga memiliki try-catch sendiri. Potensi masalah: exception yang terjadi di luar loop (misal saat validasi awal atau inisialisasi) tidak tertangkap. Fix: pastikan seluruh body `import()` terlindungi dan error per baris tidak menghentikan proses.

## Correctness Properties

Property 1: Bug Condition — Import Mengembalikan HTTP 200

_For any_ request `POST /api/teachers/import` dengan array guru yang valid (minimal field `nama` ada), the fixed import function SHALL mengembalikan HTTP 200 dengan body `{ created: N, errors: [], summary: "Berhasil: N, Gagal: 0" }` tanpa melempar exception yang tidak tertangkap.

**Validates: Requirements 2.1**

Property 2: Bug Condition — Boolean False Dipertahankan

_For any_ baris import yang memiliki `is_certified = false` (atau nilai falsy lain yang valid seperti `is_active = false`), the fixed import function SHALL menyimpan nilai `false` tersebut ke database dengan benar, bukan membuangnya atau menggantinya dengan `null`.

**Validates: Requirements 2.2**

Property 3: Bug Condition — NUPTK Lookup Tidak Diblokir TenantScope

_For any_ request import yang dieksekusi oleh super admin (user tanpa `school_id` atau dengan role `super_admin`), the fixed import function SHALL berhasil melakukan query `Teacher::where('nuptk', ...)` tanpa melempar `AuthorizationException` dari `TenantScope`.

**Validates: Requirements 2.3**

Property 4: Preservation — Perilaku Non-Import Tidak Berubah

_For any_ request yang BUKAN `POST /api/teachers/import` (termasuk `GET /teachers`, `POST /teachers`, `PUT /teachers/{id}`, `DELETE /teachers/{id}`), the fixed code SHALL menghasilkan perilaku yang identik dengan kode original, termasuk tenant scoping, audit logging, dan validasi.

**Validates: Requirements 3.1, 3.2, 3.4, 3.5**

Property 5: Preservation — Partial Success Tetap Berfungsi

_For any_ request import dengan campuran baris valid dan baris yang gagal (misal: nama kosong, data tidak valid), the fixed import function SHALL mengembalikan partial success — baris valid tersimpan, baris gagal dilaporkan di array `errors` — tanpa menghentikan seluruh proses.

**Validates: Requirements 3.3**

## Fix Implementation

### Perubahan yang Diperlukan

Dengan asumsi root cause analysis di atas benar:

**File 1**: `backend/routes/api.php`

**Perubahan**:
1. **Pindahkan route import sebelum apiResource**: Pindahkan `Route::post('teachers/import', ...)` ke atas `Route::apiResource('teachers', ...)` di dalam blok `middleware('tenant')`. Lakukan hal yang sama untuk `students/import` sebagai pencegahan.

**File 2**: `backend/app/Http/Controllers/Api/TeacherController.php`

**Perubahan**:
2. **Perbaiki array_filter**: Ganti `array_filter($dataToSave, fn($v) => !is_null($v))` dengan filter yang hanya membuang `null` dan empty string, tapi mempertahankan `false`, `0`, dan nilai falsy valid lainnya:
   ```php
   array_filter($dataToSave, fn($v) => $v !== null && $v !== '')
   ```
   Atau lebih eksplisit: pertahankan semua nilai kecuali `null`.

3. **Gunakan withoutTenantScope untuk NUPTK lookup**: Ganti:
   ```php
   $teacher = Teacher::where('nuptk', $nuptk)->first();
   ```
   dengan:
   ```php
   $teacher = Teacher::withoutTenantScope()->where('nuptk', $nuptk)->first();
   ```
   Dan untuk lookup berdasarkan nama + school_id:
   ```php
   $teacher = Teacher::withoutTenantScope()
       ->where('nama', $dataToSave['nama'])
       ->where('school_id', $schoolId)
       ->first();
   ```

**File 3**: `backend/app/Traits/AuditLogTrait.php`

**Perubahan**:
4. **Wrap ActivityLog::create() dalam try-catch**: Di method `logActivity()`, wrap seluruh `ActivityLog::create([...])` dalam try-catch agar exception dari audit log tidak menggagalkan operasi model utama:
   ```php
   protected static function logActivity($model, string $event, string $description, array $properties = [])
   {
       try {
           $user = Auth::user();
           ActivityLog::create([...]);
       } catch (\Throwable $e) {
           \Illuminate\Support\Facades\Log::warning('AuditLogTrait: gagal mencatat activity log', [
               'error' => $e->getMessage(),
               'model' => get_class($model),
               'event' => $event,
           ]);
       }
   }
   ```

**File 4**: `backend/app/Http/Controllers/Api/TeacherController.php` (lanjutan)

**Perubahan**:
5. **Pastikan exception per baris tidak menghentikan proses**: Verifikasi bahwa `catch (\Throwable $e)` sudah membungkus seluruh logika per baris di dalam loop. Tambahkan `continue` eksplisit setelah menambahkan ke `$errors[]` untuk memastikan loop berlanjut.

## Testing Strategy

### Validation Approach

Strategi testing mengikuti dua fase: pertama, surface counterexample yang mendemonstrasikan bug pada kode yang belum di-fix; kedua, verifikasi fix bekerja dengan benar dan tidak menimbulkan regresi.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexample yang mendemonstrasikan bug SEBELUM implementasi fix. Konfirmasi atau refutasi root cause analysis.

**Test Plan**: Tulis test yang mengirim request import ke endpoint yang belum di-fix dan observasi error yang terjadi. Jalankan pada kode UNFIXED untuk memahami root cause secara empiris.

**Test Cases**:
1. **Route Conflict Test**: Kirim `POST /api/teachers/import` dengan payload valid → observasi apakah response adalah 404 (model not found) atau 500 (akan gagal pada unfixed code)
2. **Boolean False Test**: Import baris dengan `is_certified = false` → cek apakah nilai tersimpan sebagai `false` atau `null` di DB (akan gagal pada unfixed code)
3. **Super Admin NUPTK Lookup Test**: Login sebagai super admin, import guru dengan NUPTK yang sudah ada → observasi apakah `AuthorizationException` dilempar (akan gagal pada unfixed code)
4. **AuditLog Exception Test**: Simulasikan `ActivityLog::create()` gagal (mock) → observasi apakah seluruh baris gagal atau hanya log yang gagal (akan gagal pada unfixed code)
5. **Partial Success Test**: Import array dengan 3 baris valid dan 1 baris invalid → observasi apakah 3 baris tersimpan atau semua gagal

**Expected Counterexamples**:
- Route conflict: response 500 dengan pesan `ModelNotFoundException` atau `No query results for model [Teacher] import`
- Boolean false: `is_certified` tersimpan sebagai `null` atau `1` (bukan `false`/`0`)
- TenantScope: `AuthorizationException: Akun operator belum terhubung ke sekolah`
- AuditLog: seluruh baris gagal meski data guru valid

### Fix Checking

**Goal**: Verifikasi bahwa untuk semua input di mana bug condition berlaku, fungsi yang sudah di-fix menghasilkan perilaku yang diharapkan.

**Pseudocode:**
```
FOR ALL request WHERE isBugCondition(request) DO
  response := importEndpoint_fixed(request)
  ASSERT response.status == 200
  ASSERT response.body.created >= 0
  ASSERT response.body.errors IS array
  ASSERT response.body.summary IS string
END FOR
```

### Preservation Checking

**Goal**: Verifikasi bahwa untuk semua input di mana bug condition TIDAK berlaku, fungsi yang sudah di-fix menghasilkan hasil yang sama dengan fungsi original.

**Pseudocode:**
```
FOR ALL request WHERE NOT isBugCondition(request) DO
  ASSERT endpoint_original(request) == endpoint_fixed(request)
END FOR
```

**Testing Approach**: Property-based testing direkomendasikan untuk preservation checking karena:
- Menghasilkan banyak test case secara otomatis di seluruh domain input
- Menangkap edge case yang mungkin terlewat oleh unit test manual
- Memberikan jaminan kuat bahwa perilaku tidak berubah untuk semua input non-buggy

**Test Plan**: Observasi perilaku pada kode UNFIXED untuk operasi CRUD normal, kemudian tulis property-based test yang menangkap perilaku tersebut.

**Test Cases**:
1. **Manual Store Preservation**: Verifikasi `POST /api/teachers` (store manual) tetap berfungsi setelah fix — data tersimpan, audit log tercatat
2. **Tenant Scope Preservation**: Verifikasi `GET /api/teachers` sebagai operator masih hanya mengembalikan data sekolahnya
3. **Upsert NUPTK Preservation**: Verifikasi guru dengan NUPTK yang sama di-update, bukan dibuat duplikat baru
4. **Operator School ID Preservation**: Verifikasi operator auto-fill `school_id` masih berfungsi pada import

### Unit Tests

- Test route registration order: verifikasi `POST /teachers/import` tidak di-route ke `show`
- Test `array_filter` behavior: verifikasi `false`, `0`, `""` diperlakukan dengan benar
- Test `withoutTenantScope()` pada NUPTK lookup: verifikasi tidak ada `AuthorizationException`
- Test `AuditLogTrait` graceful failure: mock `ActivityLog::create()` untuk throw exception, verifikasi model tetap tersimpan
- Test partial success: array campuran valid/invalid, verifikasi hanya baris invalid yang masuk ke `errors`

### Property-Based Tests

- Generate array guru acak dengan berbagai kombinasi `is_certified` (true/false/null) → verifikasi nilai tersimpan dengan benar
- Generate array guru acak dengan berbagai NUPTK (ada/tidak ada di DB) → verifikasi upsert bekerja konsisten
- Generate request dari berbagai role (operator/super_admin) → verifikasi tenant scoping tetap benar untuk non-import endpoints
- Generate array dengan proporsi baris valid/invalid acak → verifikasi `created + errors.length == total_rows`

### Integration Tests

- Test full import flow sebagai operator: upload array guru → verifikasi response 200, data tersimpan dengan `school_id` operator
- Test full import flow sebagai super admin: upload array guru dengan NUPTK yang sudah ada → verifikasi upsert, tidak ada 500
- Test import dengan baris yang memiliki `is_certified = false` → verifikasi nilai tersimpan di DB
- Test bahwa `GET /api/teachers`, `POST /api/teachers`, `PUT /api/teachers/{id}` tetap berfungsi normal setelah fix diterapkan
