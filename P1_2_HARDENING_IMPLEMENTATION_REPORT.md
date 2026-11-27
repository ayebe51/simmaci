# Laporan Implementasi Hardening P1.2 — Teacher Import Commit (F-01 s.d. F-06)

- **Proyek:** SIMMACI (`simmaci.com`)
- **Tahap:** **P1.2 — Teacher Import Commit Hardening (F-01 → F-06)**
- **Tanggal:** 26 November 2026
- **Basis Audit:** `P1_2_FINAL_SECURITY_DATA_INTEGRITY_REPORT.md`
- **Migration / Perubahan DB:** **Tidak ada** (0 migration dijalankan; analisis lengkap di Bagian 8)
- **Status:** **SELESAI — SIAP UNTUK FINAL ACCEPTANCE P1.2**

---

## 1. Executive Summary

Seluruh 6 temuan adversarial audit (**F-01 s.d. F-06**) pada fitur **Teacher Import Commit** telah ditangani secara berurutan (`F-01 → F-02 → F-03 → F-04 → F-05 → F-06`) dengan perubahan minimal, tanpa melemahkan strict date validation, dan tanpa menjalankan migration database.

Hasil verifikasi akhir:
- **Backend Hardening + Regression Suite:** **`106 passed (673 assertions), 0 failed`** (`10.47s`), termasuk 12 test hardening baru (`TeacherImportCommitHardeningP1Test`).
- **Security Regression (`AUTH-016`):** **`1 passed (8 assertions), 0 failed`** (`1.70s`).
- **Frontend Vitest Regression Suite:** **`56 passed (3 test files), 0 failed`** (`4.53s`).
- **Uji Concurrency 2 Proses Paralel Simultan:** Kedua worker berhasil (`HTTP 200`) tanpa race condition, tanpa HTTP 500 `database is locked`, 0 guru duplikat pada commit identik (`2/2`), dan 0 lost updates pada commit identitas berbeda (`6/6`).

---

## 2. Root Cause per Temuan (F-01 s.d. F-06)

| ID | Tingkat Risiko | Akar Masalah Sebelum Hardening |
|---|---|---|
| **F-01** | **HIGH** | `findExistingTeacherForCommit()` melakukan fall-through ke pencocokan `LOWER(nama)` saja ketika NIM incoming belum ada di DB atau `tanggal_lahir` kosong, sehingga menimpa guru berbeda bernama sama dan membajak NIM guru lama (`113400001` → `113400002`). Selain itu, `importPreview()` meneruskan kandidat bernama sama yang berbeda `tanggal_lahir` ke `determineStatusByName()`. |
| **F-02** | **HIGH** | `importCommit()` menjalankan pola `SELECT`-then-`INSERT` tanpa proteksi concurrency (tanpa `pg_advisory_xact_lock` maupun `Cache::lock`) dan tabel `teachers` tidak memiliki `UNIQUE` constraint, sehingga dua commit paralel menimbulkan race condition (HTTP 500 di SQLite; duplikasi baris pada PostgreSQL `READ COMMITTED`). |
| **F-03** | **MEDIUM-HIGH** | `signNormalizedDates()` memakai `(string) config('app.key', 'simmaci-fallback-key')` — mengandung literal hardcoded dan fail-open ke empty secret `''` saat `APP_KEY` bernilai `null`/kosong; selain itu `importPreview()` menelan `\Exception` di dalam loop. |
| **F-04** | **MEDIUM** | `preview_date_signature` hanya mengikat `(dates, user_id, school_id)` tanpa identitas baris dan tanpa masa berlaku (`exp`), sehingga memungkinkan cross-row signature transplant dalam user/sekolah sama secara tak terbatas. |
| **F-05** | **LOW-MEDIUM** | `importCommit()` hanya menangkap `\Exception` (bukan `\Throwable`) dan mengembalikan `$e->getMessage()` secara mentah pada respons HTTP 500 (berisiko membocorkan detail SQL/internal). |
| **F-06** | **LOW** | `validateCommitRows()` pada cabang unsigned/edited valid hanya menormalisasi `tanggal_lahir` dan `tmt`, belum mencakup `tanggal_surat_permohonan`. |

---

## 3. Daftar File yang Diubah / Ditambahkan (Khusus Scope Hardening P1.2)

| Jenis | File | Ringkasan Perubahan |
|---|---|---|
| **Backend Config (Modified)** | `backend/config/app.php` | Menambahkan konfigurasi `import_date_signing_key` (`env('IMPORT_DATE_SIGNING_KEY')`) dan `import_preview_signature_ttl` (`env('IMPORT_PREVIEW_SIGNATURE_TTL', 3600)`). |
| **Backend Service (Modified)** | `backend/app/Services/StrictDateValidationService.php` | (F-03) Menghapus hardcoded fallback secret, menerapkan `resolveSigningSecret()` fail-closed (menolak null/kosong, memprioritaskan `IMPORT_DATE_SIGNING_KEY` lalu `APP_KEY`). (F-04) Mengupgrade format signature ke `v2.<exp>.<hmac>` yang mengikat `v`, `exp`, `user_id`, `school_id`, `extractRowIdentity()` (`nama`, `nomor_induk_maarif`, `nuptk`, `nip`), dan `dates`, dengan verifikasi expiry di backend dan `hash_equals()`. (F-06) Menambahkan `tanggal_surat_permohonan` & `tgl_surat_permohonan` ke daftar normalisasi ulang pada `validateCommitRows()`. |
| **Backend Controller (Modified)** | `backend/app/Http/Controllers/Api/TeacherController.php` | (F-01) Mengganti `findExistingTeacherForCommit()` dengan `resolveExistingTeacherForCommit()` yang ketat (NIM utama tanpa fallback nama, tolak konflik NIM lintas sekolah, larang menimpa NIM eksisting pada INSERT/UPDATE, nama saja bukan identitas unik → 422 conflict jika ambigu) + menyaring kandidat berbeda DOB di `importPreview()`. (F-02) Menambahkan `resolveCommitLockSchoolIds()` (canonical sorted order mencegah deadlock), `withCommitLocks()` (`Cache::lock` dengan pelepasan terjamin di `finally`), dan `SELECT pg_advisory_xact_lock(?)` di dalam transaksi untuk PostgreSQL. (F-03) Menangani `\RuntimeException` signing key secara fail-closed (HTTP 500) di `importPreview()`. (F-05) Mengubah `catch (\Exception)` ke `catch (\Throwable)` dengan rollback terjamin, structured `Log::error`, dan pesan HTTP 500 generik yang tidak membocorkan detail SQL. |
| **Backend Test (Added)** | `backend/tests/Feature/TeacherImportCommitHardeningP1Test.php` | 12 feature test hardening baru mencakup F-01 (6 skenario), F-02 (lock release), F-03 (null/empty key fail-closed & key rotation), F-04 (cross-row transplant, NIM edit, cross-user/school, tampered future `exp`, expired TTL), F-05 (rollback & non-leaking 500), dan F-06 (`tanggal_surat_permohonan` normalization & ambiguous rejection). |

---

## 4. Deskripsi Perubahan Teknis per Fase

### 4.1. Phase A (F-01) — Teacher Identity Matching
- **Hierarki Identitas:**
  1. `nomor_induk_maarif` (NIM) adalah identitas utama. Jika ditemukan pada sekolah sama → match (`found`); jika ditemukan pada sekolah lain → `conflict` (HTTP 422 + rollback); jika tidak ditemukan di mana pun → `not_found` (INSERT guru baru, **tidak pernah** fall-through ke pencocokan nama).
  2. `nuptk` dan `nip` sebagai identifier kuat sekunder pada sekolah sama (dengan penolakan konflik lintas sekolah untuk NUPTK).
  3. Tanpa NIM/NUPTK/NIP: **nama saja tidak pernah dijadikan identitas unik**. Jika di sekolah sama sudah ada guru bernama identik:
     - Incoming tanpa `tanggal_lahir` → `conflict` (HTTP 422 + rollback).
     - Incoming dengan `tanggal_lahir` cocok tepat 1 kandidat → `found` (idempotent update).
     - Lebih dari 1 kandidat cocok, atau ada kandidat eksisting dengan `tanggal_lahir` kosong → `conflict` (HTTP 422 + rollback).
     - Seluruh kandidat eksisting memiliki `tanggal_lahir` non-null yang berbeda → `not_found` (aman INSERT sebagai guru berbeda).
- **Proteksi NIM:** Baik jalur idempotent `INSERT` maupun `UPDATE` melarang penggantian `nomor_induk_maarif` eksisting yang sudah terisi dengan NIM berbeda.

### 4.2. Phase B (F-02) — Concurrent Commit Protection
- **Dual-Layer Per-School Locking (Canonical Ordered, Zero Deadlock):**
  - `resolveCommitLockSchoolIds()` mengumpulkan seluruh `school_id` target secara unik dan terurut menaik (untuk operator selalu `[$operatorSchoolId]`).
  - **Layer 1 (Application Lock):** `Cache::store(...)->lock("teacher_import_commit:school:{$sid}", 30)->block(15)` melindungi keseluruhan blok transaksi; seluruh lock dilepas secara reverse-order dalam blok `finally` (terjamin bebas leak bahkan pada rollback/exception). Pada file-backed SQLite dengan `CACHE_STORE=array`, otomatis menggunakan `Cache::store('file')` + `PRAGMA busy_timeout = 10000`.
  - **Layer 2 (PostgreSQL Production Transaction-Scoped Advisory Lock):** Di dalam `\DB::beginTransaction()` sebelum query pertama, jika `DB::getDriverName() === 'pgsql'`, sistem mengeksekusi `SELECT pg_advisory_xact_lock(7100000000 + $schoolId)`. Lock ini secara native dilepas otomatis oleh PostgreSQL saat `COMMIT`, `ROLLBACK`, atau putus koneksi, dan terisolasi per madrasah sehingga madrasah berbeda tetap berjalan paralel.

### 4.3. Phase C & D (F-03 & F-04) — HMAC Secret Hardening & Row-Bound Expiring Signature
- **Konfigurasi & Rotasi Secret (Tanpa Mengekspos Nilai Secret):**
  - Variabel environment opsional dedicated: `IMPORT_DATE_SIGNING_KEY` (disarankan 32-byte random base64, terpisah dari `APP_KEY`). Jika tidak disetel, sistem menggunakan `APP_KEY`. Jika keduanya kosong/null, `resolveSigningSecret()` melempar `\RuntimeException` (fail-closed) dan `verifyNormalizedDates()` mengembalikan `false`.
  - **Prosedur Rotasi Key:** Perbarui `IMPORT_DATE_SIGNING_KEY` di environment produksi lalu jalankan `php artisan config:cache`. Signature preview lama yang terbit sebelum rotasi otomatis gagal verifikasi secara aman (HTTP 422) sehingga operator cukup mengulang preview tanpa celah bypass validasi.
- **Format Signature `v2.<exp>.<hmac_sha256_hex>`:**
  - Mengikat `v`, `exp` (dihitung murni dari `Carbon::now()->timestamp + ttl`, default 3600 detik), `user_id`, `school_id`, `identity` (`nama`, `nomor_induk_maarif`, `nuptk`, `nip`), dan `dates`.
  - Verifikasi memvalidasi format regex ketat, memeriksa `$exp >= Carbon::now()->timestamp` di backend, menghitung ulang HMAC dari payload & `exp` yang sama, lalu membandingkan dengan `hash_equals()`. Signature v1 lama tanpa `exp`/identity otomatis ditolak aman.

### 4.4. Phase E & F (F-05 & F-06) — Throwable Handling & Normalization Completeness
- `importCommit()` menangkap `\Throwable`, memastikan `\DB::rollBack()` bila `transactionLevel() > 0`, mencatat detail aman lewat `Log::error()`, dan mengembalikan HTTP 500 generik (`"Terjadi kesalahan saat menyimpan data guru. Seluruh perubahan telah dibatalkan..."`) tanpa membocorkan SQL/stack trace.
- `validateCommitRows()` turut menormalisasi `tanggal_surat_permohonan` / `tgl_surat_permohonan` pada cabang unsigned/edited valid.

---

## 5. Bukti Before / After

| Skenario Pengujian | Sebelum Hardening (Audit) | Sesudah Hardening (Aktual) |
|---|---|---|
| **F-01 Case 2a:** Nama sama (`BUDI SANTOSO` / `AHMAD FAUZI`), tanpa NIM & tanpa DOB | HTTP 200 — menimpa guru lama (`teachers=1`, `pendidikan=S2`) ❌ | **HTTP 422 Conflict** + rollback (`teachers=1`, data lama utuh `pendidikan=S1`) ✅ |
| **F-01 Case 2b:** Nama sama, NIM berbeda (`113400002` vs `113400001`), tanpa DOB | HTTP 200 — membajak NIM guru lama menjadi `113400002` (`teachers=1`) ❌ | **HTTP 200** — membentuk 2 guru berbeda (`teachers=2`), NIM guru lama tetap `113400001` ✅ |
| **F-01 Cross-School NIM:** NIM madrasah B disubmit operator A | HTTP 200 ❌ | **HTTP 422 Conflict**, data madrasah B utuh, 0 baris baru di madrasah A ✅ |
| **F-02 Concurrent Identical Commit (2 proses simultan):** | W1 HTTP 500 (`database is locked`), W2 HTTP 200 ❌ | **W1 HTTP 200 (`0 Ditambahkan, 2 Diperbarui`), W2 HTTP 200 (`2 Ditambahkan, 0 Diperbarui`), `DB count=2`** ✅ |
| **F-02 Concurrent Distinct Commit (2 proses simultan, sekolah sama):** | Rawan lock error / race ❌ | **W3 HTTP 200 (`+2`), W4 HTTP 200 (`+2`), `DB total=6`** (0 lost updates) ✅ |
| **F-03 `app.key=null` / empty secret:** | Fail-open ke secret `''` (`sigMatchesEmptyKey=YES`) ❌ | **Fail-closed:** `signNormalizedDates()` melempar `\RuntimeException`, `verifyNormalizedDates()` → `false`, `importPreview()` → HTTP 500 ✅ |
| **F-04 Cross-row signature transplant (user & sekolah sama):** | HTTP 200 ❌ | **HTTP 422** (`date_errors`, 0 tersimpan) ✅ |
| **F-04 Signature expired / tampered `exp`:** | Tidak ada expiry ❌ | **HTTP 422** (`date_errors`, 0 tersimpan) ✅ |
| **F-05 DB constraint error di baris 2:** | HTTP 500 membocorkan pesan `SQLSTATE[...]` ❌ | **HTTP 500 pesan generik aman** (tanpa `SQLSTATE`/`insert into`), rollback `teachers=0`, tercatat di `Log::error` ✅ |
| **F-06 Unsigned valid `tanggal_surat_permohonan: '11-Mei-2022'`:** | Tersimpan mentah `'11-Mei-2022'` ❌ | **Dinormalisasi ke `'2022-05-11'`**; input `'11/12/2022'` tetap ditolak HTTP 422 ✅ |

---

## 6. Security Impact Analysis

- **Fail-Closed Cryptography:** Eliminasi hardcoded secret & empty-string fallback memastikan sistem tidak pernah menandatangani atau memvalidasi token tanggal pada kondisi salah konfigurasi key.
- **Anti-Replay & Anti-Transplant:** Pengikatan `v2.<exp>.<hmac>` terhadap `(user_id, school_id, nama, nomor_induk_maarif, nuptk, nip, dates, exp)` menutup celah lintas-user, lintas-madrasah, lintas-baris, dan replay jangka panjang.
- **Zero Information Leakage:** Respons HTTP 500 tidak lagi memaparkan schema tabel atau query SQL kepada client.
- **Tenant Isolation Preserved:** `AUTH-016` tetap lulus penuh; lock diisolasi per `school_id`; konflik NIM lintas sekolah diblokir 422 tanpa menyentuh record tenant lain.

---

## 7. Database Concurrency Analysis

- **PostgreSQL (Produksi):** `SELECT pg_advisory_xact_lock(7100000000 + $schoolId)` dijalankan di dalam transaksi aktif sebelum `SELECT` identitas pertama, sehingga pada isolasi `READ COMMITTED`, transaksi kedua menunggu hingga transaksi pertama `COMMIT` (lalu langsung membaca baris baru dan menjalankan idempotent update) atau `ROLLBACK`. Lock dilepas otomatis oleh engine PostgreSQL tanpa risiko orphan lock.
- **Multi-School Deadlock Prevention:** Seluruh `school_id` pada batch diurutkan menaik (`sort(..., SORT_NUMERIC)`) sebelum akuisisi lock baik pada `Cache::lock` maupun `pg_advisory_xact_lock`.
- **Catatan Lingkungan Test Lokal:** Environment lokal hanya memiliki ekstensi `pdo_pgsql` tanpa server PostgreSQL aktif (`psql` tidak terpasang). Karena itu, verifikasi concurrency multi-proses dijalankan menggunakan 2 proses PHP paralel terhadap file SQLite bersama (membuktikan serialisasi & zero-duplicate secara empiris), sedangkan jalur `pg_advisory_xact_lock` diverifikasi mengikuti pola produksi yang sudah teruji di `SkDocumentController::reserveNomor()` (L1868). Uji smoke concurrency di staging PostgreSQL direkomendasikan sebelum cutover produksi.

---

## 8. Migration Assessment

- **Keputusan:** **TIDAK memerlukan migration database pada tahap ini.**
- **Alasan Teknis:**
  1. Penambahan `UNIQUE INDEX` pada `teachers.nomor_induk_maarif` atau `teachers.nuptk` berisiko gagal saat `migrate` apabila terdapat data historis duplikat atau baris soft-deleted (`deleted_at IS NOT NULL`) di database produksi.
  2. Governance mewajibkan analisis dampak data lama & persetujuan terpisah sebelum menambah unique constraint.
  3. Kombinasi **F-01** (pencocokan identitas ketat) + **F-02** (`pg_advisory_xact_lock` + `Cache::lock`) telah mencegah terbentuknya duplikasi baru pada proses `importCommit` tanpa risiko downtime atau kegagalan migration.
  4. Bila di masa depan diinginkan partial unique index (`CREATE UNIQUE INDEX teachers_nim_active_unique ON teachers (nomor_induk_maarif) WHERE nomor_induk_maarif IS NOT NULL AND deleted_at IS NULL`), langkah prasyaratnya adalah audit & pembersihan data duplikat produksi terlebih dahulu dengan persetujuan eksplisit.

---

## 9. Unit & Integration Test Results

```powershell
cd backend
php artisan test tests/Feature/TeacherImportCommitHardeningP1Test.php tests/Unit/Services/TeacherImportCommitDateServiceP1Test.php tests/Feature/TeacherImportCommitP1Test.php tests/Feature/StrictDateImportIntegrationTest.php tests/Unit/Services/StrictDateValidationServiceTest.php tests/Unit/Services/ExcelDateParserP1Test.php tests/Feature/ExcelDateParserP1IntegrationTest.php tests/Feature/BulkSkDateValidationP0Test.php tests/Feature/BulkSkRequestTest.php tests/Feature/NormalizationIntegrationTest.php tests/Feature/BulkSkImportPreservationTest.php
```
- **Hasil Aktual:** **`106 passed (673 assertions), 0 failed`** (`10.47s`):
  - `Tests\Feature\TeacherImportCommitHardeningP1Test`: **12/12 passed**
  - `Tests\Unit\Services\TeacherImportCommitDateServiceP1Test`: **3/3 passed**
  - `Tests\Feature\TeacherImportCommitP1Test`: **6/6 passed**
  - `Tests\Feature\StrictDateImportIntegrationTest`: **11/11 passed**
  - `Tests\Unit\Services\StrictDateValidationServiceTest`: **27/27 passed**
  - `Tests\Unit\Services\ExcelDateParserP1Test`: **7/7 passed**
  - `Tests\Feature\ExcelDateParserP1IntegrationTest`: **2/2 passed**
  - `Tests\Feature\BulkSkDateValidationP0Test`: **6/6 passed**
  - `Tests\Feature\BulkSkRequestTest`: **10/10 passed**
  - `Tests\Feature\NormalizationIntegrationTest`: **12/12 passed**
  - `Tests\Feature\BulkSkImportPreservationTest`: **10/10 passed**

---

## 10. Regression Test Results

- **Security (`AUTH-016` Cross-Tenant Mutation Blocked):**
  `php artisan test tests/Feature/PostRemediationSecurityVerificationTest.php --filter=test_auth_016_teacher_import_commit_cross_tenant_mutation_blocked`
  → **`1 passed (8 assertions), 0 failed`** (`1.70s`).
- **Frontend Vitest Regression (`excelDateParser.p1`, `parseIndonesianDate`, `BulkSkSubmission.p0`):**
  → **`56 passed (3 test files), 0 failed`** (`4.53s`).
- **Multi-Process Concurrency & Adversarial Probe (`verify_hardening_concurrent.php`):**
  → **Exit code `0`**: Concurrent Identical (`2/2`, 2× HTTP 200), Concurrent Distinct (`6/6`, 2× HTTP 200), F-03 null-key fail-closed (`YES`), F-04 cross-row transplant (`HTTP 422`).

---

## 11. Remaining Risks

1. **Verifikasi langsung di server PostgreSQL staging:** Karena server PostgreSQL tidak tersedia di workstation lokal, eksekusi aktual `pg_advisory_xact_lock` belum dijalankan terhadap instance PostgreSQL hidup (baru terverifikasi sintaks & konsistensi dengan `SkDocumentController::reserveNomor()`). Disarankan menjalankan 1 smoke test paralel di staging PostgreSQL sebelum rilis produksi.
2. **Konfigurasi `IMPORT_DATE_SIGNING_KEY` di deployment:** Disarankan menambahkan `IMPORT_DATE_SIGNING_KEY` terpisah pada environment staging/produksi (saat ini aman menggunakan fallback `APP_KEY` yang sudah terkonfigurasi dan fail-closed bila kosong).
3. **Konflik identitas untuk 2 guru eksisting lama yang sudah terlanjur duplikat di produksi:** Jika database produksi sudah memiliki data legacy duplikat (nama & DOB identik tanpa NIM), F-01 akan secara aman menolak commit ambigu (HTTP 422) hingga admin melengkapi NIM atau membersihkan duplikat.

---

## 12. Acceptance Checklist (F-01 s.d. F-06)

| Item | Kriteria | Status |
|---|---|:---:|
| **F-01** | NIM utama, tanpa fallback nama berbahaya, tidak menimpa/membajak NIM lama, konflik ambigu ditolak 422 + rollback, cross-school isolation terjaga | ✅ **PASS** |
| **F-02** | Dual-layer locking (`Cache::lock` + `pg_advisory_xact_lock`), canonical lock order, guaranteed release di `finally` / transaction end, 2-proses paralel 0 duplikat & 0 lost updates | ✅ **PASS** |
| **F-03** | Hardcoded fallback dihapus, empty/null key fail-closed, dedicated `IMPORT_DATE_SIGNING_KEY`, `hash_equals()`, rotasi key aman (meminta preview ulang) | ✅ **PASS** |
| **F-04** | Signature `v2.<exp>.<hmac>` mengikat `user_id`, `school_id`, row identity, normalized dates, dan backend-verified `exp`; menolak transplant & expired | ✅ **PASS** |
| **F-05** | `catch (\Throwable)` dengan rollback terjamin, structured `Log::error`, pesan HTTP 500 aman tanpa bocor detail SQL/internal | ✅ **PASS** |
| **F-06** | `tanggal_surat_permohonan` ikut dinormalisasi pada jalur unsigned/edited valid dan tetap menolak format numerik ambigu | ✅ **PASS** |
| **Regression** | Seluruh suite P0, P1.1, P1.2, `AUTH-016`, StrictDate, Normalization, & Frontend Vitest lulus 100% | ✅ **PASS** |

---

## Status Akhir

Seluruh perbaikan **F-01 s.d. F-06** telah diimplementasikan dan terverifikasi penuh tanpa perubahan di luar scope, tanpa migration, dan tanpa deployment. Pengerjaan berhenti di sini menunggu evaluasi dan **Final Acceptance P1.2** dari Anda.
