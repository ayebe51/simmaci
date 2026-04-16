# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Teacher Import Returns HTTP 500
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate all five bugs exist
  - **Scoped PBT Approach**: Scope the property to concrete failing cases for each of the five bugs:
    1. `POST /api/teachers/import` dengan payload valid → observasi apakah response 500 `ModelNotFoundException` (Bug 1: Route Conflict)
    2. Import baris dengan `is_certified = false` → cek apakah nilai tersimpan sebagai `null` bukan `false` (Bug 2: array_filter)
    3. Login sebagai super admin, import guru dengan NUPTK yang sudah ada → observasi `AuthorizationException` dari TenantScope (Bug 3)
    4. Mock `ActivityLog::create()` agar throw exception → observasi apakah seluruh baris gagal (Bug 4: AuditLogTrait)
    5. Import array campuran valid/invalid → observasi apakah exception satu baris menghentikan seluruh proses (Bug 5)
  - Test assertions (dari Expected Behavior di design):
    - `response.status == 200`
    - `response.body.created >= 0`
    - `response.body.errors` adalah array
    - `is_certified = false` tersimpan sebagai `false`/`0` di DB, bukan `null`
  - Run test pada kode UNFIXED
  - **EXPECTED OUTCOME**: Test FAILS (ini benar — membuktikan bug ada)
  - Document counterexamples yang ditemukan:
    - Bug 1: `POST /api/teachers/import` → 500 `No query results for model [Teacher] import`
    - Bug 2: `is_certified` tersimpan sebagai `null` atau hilang dari payload
    - Bug 3: `AuthorizationException: Akun operator belum terhubung ke sekolah`
    - Bug 4: Seluruh baris gagal meski data guru valid
    - Bug 5: Loop berhenti di baris pertama yang error
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Import Endpoints Behavior Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior pada kode UNFIXED untuk operasi non-import:
    - Observe: `POST /api/teachers` (store manual) berhasil menyimpan guru dan mencatat audit log
    - Observe: `GET /api/teachers` sebagai operator hanya mengembalikan data sekolahnya (tenant scope aktif)
    - Observe: `GET /api/teachers` sebagai super admin mengembalikan semua data
    - Observe: Import dengan NUPTK yang sama melakukan update, bukan insert duplikat
    - Observe: Operator auto-fill `school_id` pada setiap baris import
  - Write property-based tests dari Preservation Requirements di design:
    - For all operator requests ke `GET /api/teachers`: response hanya berisi guru dengan `school_id == operator.school_id`
    - For all `POST /api/teachers` requests dengan data valid: guru tersimpan dan `ActivityLog` tercatat
    - For all import requests dengan campuran valid/invalid: `created + errors.length == total_rows`
    - For all import requests dengan NUPTK duplikat: tidak ada duplikat di DB setelah import
    - For all operator import requests: setiap baris memiliki `school_id == operator.school_id`
  - Verify tests PASS pada kode UNFIXED (baseline behavior)
  - **EXPECTED OUTCOME**: Tests PASS (mengkonfirmasi baseline behavior yang harus dipertahankan)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Fix: Teacher Import 500 Error (5 bugs)

  - [x] 3.1 Fix Bug 1 — Pindahkan route import sebelum apiResource di routes/api.php
    - Di `backend/routes/api.php`, dalam blok `middleware('tenant')`, pindahkan:
      ```php
      Route::post('teachers/import', [TeacherController::class, 'import']);
      ```
      ke **atas** `Route::apiResource('teachers', TeacherController::class)`
    - Lakukan hal yang sama untuk `students/import` sebagai pencegahan regresi
    - Verifikasi urutan route: import route harus terdaftar sebelum apiResource
    - _Bug_Condition: `POST /api/teachers/import` dipetakan ke `TeacherController@show` dengan `{teacher} = 'import'` karena apiResource terdaftar lebih dulu_
    - _Expected_Behavior: `POST /api/teachers/import` dipetakan ke `TeacherController@import` dengan benar_
    - _Preservation: Semua 7 route CRUD dari apiResource tetap berfungsi normal_
    - _Requirements: 1.5, 2.5_

  - [x] 3.2 Fix Bug 2 — Perbaiki array_filter agar tidak membuang nilai false di TeacherController::import()
    - Di `backend/app/Http/Controllers/Api/TeacherController.php`, method `import()`, ganti:
      ```php
      $savePayload = array_merge(array_filter($dataToSave, fn($v) => !is_null($v)), ['school_id' => $schoolId]);
      ```
      dengan:
      ```php
      $savePayload = array_merge(array_filter($dataToSave, fn($v) => $v !== null && $v !== ''), ['school_id' => $schoolId]);
      ```
    - Filter baru hanya membuang `null` dan empty string `""`, mempertahankan `false`, `0`, dan nilai falsy valid lainnya
    - _Bug_Condition: Baris import dengan `is_certified = false` — `array_filter` dengan `fn($v) => !is_null($v)` membuang `false` karena `!is_null(false) == true` tapi `false` tetap falsy... tunggu, ini sebenarnya sudah benar. Verifikasi apakah ada `array_filter` tanpa callback di tempat lain, atau apakah `false` dikonversi ke `""` sebelumnya_
    - _Expected_Behavior: `is_certified = false` tersimpan sebagai `false`/`0` di database_
    - _Preservation: Nilai `null` dan `""` tetap dibuang dari payload untuk menghindari DB constraint error_
    - _Requirements: 1.2, 2.2_

  - [x] 3.3 Fix Bug 3 — Gunakan withoutTenantScope() untuk NUPTK lookup di TeacherController::import()
    - Di `backend/app/Http/Controllers/Api/TeacherController.php`, method `import()`, ganti:
      ```php
      $teacher = Teacher::where('nuptk', $nuptk)->first();
      ```
      dengan:
      ```php
      $teacher = Teacher::withoutTenantScope()->where('nuptk', $nuptk)->first();
      ```
    - Ganti juga lookup berdasarkan nama + school_id:
      ```php
      $teacher = Teacher::withoutTenantScope()
          ->where('nama', $dataToSave['nama'])
          ->where('school_id', $schoolId)
          ->first();
      ```
    - `withoutTenantScope()` sudah tersedia via `HasTenantScope` trait di `Teacher` model
    - _Bug_Condition: Super admin (tanpa `school_id`) melakukan import — `TenantScope::apply()` dipanggil pada query NUPTK lookup dan melempar `AuthorizationException`_
    - _Expected_Behavior: Query NUPTK lookup berhasil untuk semua role tanpa `AuthorizationException`_
    - _Preservation: TenantScope tetap aktif untuk semua query di luar konteks import (GET, store manual, dll.)_
    - _Requirements: 1.3, 2.3_

  - [x] 3.4 Fix Bug 4 — Wrap ActivityLog::create() dalam try-catch di AuditLogTrait.php
    - Di `backend/app/Traits/AuditLogTrait.php`, method `logActivity()`, wrap seluruh `ActivityLog::create()` dalam try-catch:
      ```php
      protected static function logActivity($model, string $event, string $description, array $properties = [])
      {
          try {
              $user = Auth::user();
              ActivityLog::create([
                  'school_id'    => $model->school_id ?? ($user->school_id ?? null),
                  'log_name'     => strtolower(class_basename($model)),
                  'description'  => $description,
                  'subject_id'   => $model->id,
                  'subject_type' => get_class($model),
                  'causer_id'    => $user->id ?? null,
                  'causer_type'  => $user ? get_class($user) : null,
                  'properties'   => $properties,
                  'event'        => $event,
              ]);
          } catch (\Throwable $e) {
              \Illuminate\Support\Facades\Log::warning('AuditLogTrait: gagal mencatat activity log', [
                  'error' => $e->getMessage(),
                  'model' => get_class($model),
                  'event' => $event,
              ]);
          }
      }
      ```
    - Exception dari `ActivityLog::create()` di-log sebagai warning, tidak di-rethrow
    - _Bug_Condition: `Teacher::create()` berhasil → `AuditLogTrait::logActivity()` dipanggil → `ActivityLog::create()` gagal (constraint, koneksi DB, dll.) → exception bubble up → seluruh baris import gagal_
    - _Expected_Behavior: Jika `ActivityLog::create()` gagal, warning di-log tapi operasi model utama tetap berhasil_
    - _Preservation: Untuk operasi normal (non-import), audit log tetap dicatat. Jika gagal, warning di-log — tidak ada perubahan perilaku untuk kasus sukses_
    - _Requirements: 1.4, 2.4_

  - [x] 3.5 Fix Bug 5 — Pastikan exception per baris tidak menghentikan loop import di TeacherController::import()
    - Di `backend/app/Http/Controllers/Api/TeacherController.php`, method `import()`, verifikasi bahwa `catch (\Throwable $e)` sudah membungkus **seluruh** logika per baris
    - Tambahkan `continue` eksplisit setelah `$errors[] = [...]` untuk memastikan loop berlanjut ke baris berikutnya:
      ```php
      } catch (\Throwable $e) {
          $errors[] = [
              'row'   => $index + 1,
              'nuptk' => (string)($row['nuptk'] ?? $row['NUPTK'] ?? 'empty'),
              'error' => $e->getMessage()
          ];
          continue; // pastikan loop berlanjut
      }
      ```
    - Verifikasi bahwa tidak ada kode di luar loop yang bisa throw exception tanpa tertangkap (misal: validasi awal `$request->validate()` sudah di luar loop — ini OK)
    - _Bug_Condition: Exception apapun di dalam loop yang tidak tertangkap oleh `catch (\Throwable $e)` menghentikan seluruh proses import_
    - _Expected_Behavior: Setiap baris diproses secara independen — exception pada satu baris hanya menambahkan entry ke `$errors[]`, baris lain tetap diproses_
    - _Preservation: Partial success tetap berfungsi — `created + errors.length == total_rows`_
    - _Requirements: 1.1, 2.1, 3.3_

  - [x] 3.6 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Teacher Import Returns HTTP 200
    - **IMPORTANT**: Re-run the SAME test dari task 1 — do NOT write a new test
    - Test dari task 1 mengkodekan expected behavior
    - Ketika test ini pass, mengkonfirmasi semua lima bug sudah diperbaiki
    - Run bug condition exploration test dari step 1
    - **EXPECTED OUTCOME**: Test PASSES (mengkonfirmasi semua bug sudah di-fix)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.7 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Import Endpoints Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests dari task 2 — do NOT write new tests
    - Run preservation property tests dari step 2
    - **EXPECTED OUTCOME**: Tests PASS (mengkonfirmasi tidak ada regresi)
    - Konfirmasi semua endpoint non-import tetap berfungsi normal setelah fix
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 4. Checkpoint — Pastikan semua test pass
  - Jalankan seluruh test suite: `php artisan test` dari direktori `backend/`
  - Verifikasi tidak ada regresi pada endpoint lain (teachers CRUD, students, schools, dll.)
  - Verifikasi `POST /api/teachers/import` mengembalikan HTTP 200 untuk semua skenario:
    - Import sebagai operator (auto-fill `school_id`)
    - Import sebagai super admin (NUPTK lookup tanpa TenantScope)
    - Import dengan baris yang memiliki `is_certified = false`
    - Import dengan campuran baris valid dan invalid (partial success)
    - Import dengan NUPTK duplikat (upsert, bukan duplikat)
  - Tanyakan kepada user jika ada pertanyaan atau ambiguitas yang muncul
