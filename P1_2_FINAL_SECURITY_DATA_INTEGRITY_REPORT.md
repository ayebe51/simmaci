# P1.2 Final Security & Data Integrity Audit Report — Teacher Import Commit

- **Proyek:** SIMMACI (`simmaci.com`)
- **Tahap Diaudit:** **P1.2 — Teacher Import Commit**
- **Tanggal Audit:** 26 November 2026
- **Mode Audit:** **STRICT READ-ONLY** (0 perubahan pada source code, test, database, migration, konfigurasi, maupun commit)
- **Verdict:** **`P1.2 — NOT YET FULLY ACCEPTED (TERDAPAT 3 TEMUAN HIGH / MEDIUM-HIGH YANG WAJIB DIPERBAIKI)`**

---

## Ringkasan Eksekutif

Seluruh regression test yang ada saat ini **lulus 100%** (20/20 test date/commit + `AUTH-016` cross-tenant security test) dan atomicity transaksi bekerja dengan baik untuk skenario kegagalan tunggal. Namun, audit keamanan dan integritas data secara adversarial menemukan **3 temuan nyata yang tereproduksi secara empiris** pada area **HMAC-SHA256 Secret Handling** dan **Concurrent Idempotency / Teacher Identity Matching**, serta **3 catatan hardening tambahan (Low–Medium)**:

| ID | Area | Tingkat Risiko | Ringkasan Temuan |
|---|---|---|---|
| **F-01** | Concurrent Idempotency (`findExistingTeacherForCommit`) | **HIGH** | **False-positive identity collision & NIM hijacking**: dua guru berbeda dengan nama sama pada sekolah yang sama salah dianggap identik bila `tanggal_lahir` kosong — bahkan guru baru dengan `nomor_induk_maarif` **berbeda** menimpa record guru lama dan mengganti NIM guru lama (`113400001` → `113400002`). |
| **F-02** | Concurrent Idempotency (`importCommit`) | **HIGH** | **Race condition saat 2 commit identik berjalan bersamaan**: tidak ada locking (`pg_advisory_xact_lock` / `Cache::lock`) dan tabel `teachers` tidak memiliki `UNIQUE` constraint. Pada SQLite paralel memicu HTTP 500 `database is locked`; pada PostgreSQL `READ COMMITTED` (produksi), kedua transaksi membaca `SELECT = NULL` secara simultan lalu mengeksekusi `INSERT` ganda (membentuk guru duplikat). |
| **F-03** | HMAC-SHA256 Security (`signNormalizedDates`) | **MEDIUM-HIGH** | **Hardcoded fallback secret & fail-open ke empty string**: `StrictDateValidationService.php:468` menulis `(string) config('app.key', 'simmaci-fallback-key')`. Mengandung literal hardcoded `'simmaci-fallback-key'`, dan bila `APP_KEY` bernilai `null`/kosong di `.env`, `config('app.key')` mengembalikan `null` → dicast menjadi `''` (empty secret) yang dapat dipalsukan! |
| **F-04** | HMAC-SHA256 Defense-in-Depth | **MEDIUM** | **Cross-row signature transplant & tanpa TTL**: `signNormalizedDates()` hanya mengikat `(dates, user_id, school_id)` tanpa identitas baris (`nama`/`nomor_induk_maarif`) atau masa berlaku (`exp`), sehingga signature Guru A dapat dipindahkan ke Guru B (user & sekolah sama, tanggal sama) secara tidak terbatas. |
| **F-05** | Atomic Persistence (`importCommit`) | **LOW-MEDIUM** | Blok `catch (\Exception $e)` (`TeacherController.php:1987`) tidak menangkap `\Throwable` (`\Error`/`TypeError`), sehingga error fatal PHP di tengah loop tidak memanggil `\DB::rollBack()` secara eksplisit. |
| **F-06** | Validation Completeness (`validateCommitRows`) | **LOW** | Pada jalur unsigned/edited valid (`StrictDateValidationService.php:554–562`), normalisasi ulang hanya dilakukan untuk `tanggal_lahir` dan `tmt`, belum mencakup `tanggal_surat_permohonan` (yang ada di `Teacher::$fillable`). |

Sesuai aturan governance (*"Jangan memperbaiki temuan selama audit. Jika terdapat masalah, dokumentasikan dan tunggu keputusan."*), **belum ada satu pun perubahan kode yang dilakukan**.

---

## 1. Hasil Audit Area 1 — HMAC-SHA256 Security Audit

**Kode yang diperiksa:**
- `backend/app/Services/StrictDateValidationService.php`: `validateIsoDate()` (L357–395), `extractDateFieldsFromRow()` (L402–455), `signNormalizedDates()` (L460–470), `verifyNormalizedDates()` (L475–483), `validateCommitRows()` (L497–571).
- `backend/app/Http/Controllers/Api/TeacherController.php`: `importPreview()` (L1849–1866), `importCommit()` (L1881–1925).

| No | Kriteria Audit HMAC | Status | Bukti Kode & Pengujian |
|---|---|---|---|
| 1.1 | Signature mencakup seluruh tanggal hasil normalisasi yang relevan | ✅ **PASS** | `extractDateFieldsFromRow()` (L402–455) mengekstrak seluruh key bertema tanggal (`tanggal_lahir`, `tmt`, `ttl`, `tgl`, `tanggal`, `tanggal_surat_permohonan`, dll.) dan mengurutkannya secara deterministik (`ksort`) sebelum `json_encode`. |
| 1.2 | Signature terikat pada `user_id` dan `school_id` | ✅ **PASS** | `signNormalizedDates()` (L462–466) memasukkan `'user_id' => $userId` dan `'school_id' => $schoolId`. Pengujian replay oleh `$otherOperator` menghasilkan HTTP 422 (`TeacherImportCommitP1Test`, Skenario Tampering D). |
| 1.3 | **Secret tidak hardcoded atau terekspos ke frontend** | ❌ **FAIL (F-03)** | Secret memang tidak dikirim ke frontend (hanya digest hex `preview_date_signature`), **TETAPI** L468 menulis `$secret = (string) config('app.key', 'simmaci-fallback-key');`. Terdapat **hardcoded literal `'simmaci-fallback-key'`**, dan pengujian empiris membuktikan ketika `config(['app.key' => null])` (mis. `APP_KEY` kosong di `.env`), `(string) null` menjadi `''` (empty secret) sehingga signature dapat dipalsukan dengan key `''`:<br>`When app.key=null: sigMatchesEmptyKey=YES (EMPTY SECRET ACCEPTED!)` |
| 1.4 | Perbandingan signature aman | ✅ **PASS** | `verifyNormalizedDates()` (L482) menggunakan `hash_equals($expected, $signature)` (constant-time comparison, aman dari timing attack). |
| 1.5 | Signature yang hilang, salah, atau dimanipulasi tidak pernah melewati validasi penuh | ✅ **PASS** | L526–548: jika `$signature === null` atau `verifyNormalizedDates() === false`, eksekusi selalu masuk ke cabang `else` yang menjalankan `validateRows([$payload], [], $sheetName, $excelRowNum)` secara penuh. |
| 1.6 | Manipulasi tanggal setelah preview tidak dapat memanfaatkan signature lama | ⚠️ **PARTIAL (F-04)** | Mengubah nilai tanggal pada baris yang sama (misal `1992-08-03` → `2022-12-11` atau `11/12/2022`) atau menambah key tanggal baru (`tanggal_sk`) **berhasil ditolak 422**. Namun, pengujian empiris membuktikan **cross-row signature transplant** dalam user/sekolah yang sama lolos (`HTTP=200`) jika tanggalnya sama, karena signature belum mengikat identitas baris (`nama`/`nomor_induk_maarif`) maupun masa berlaku (`exp`):<br>`Cross-row signature transplant (same user, same date, different teacher): HTTP=200` |
| 1.7 | Tidak terdapat jalur alternatif untuk melewati strict validation | ✅ **PASS** (dengan catatan kecil **F-06**) | Tidak ada bypass untuk tanggal numerik ambigu atau ISO palsu di `importCommit()`. Catatan minor (**F-06**): jika field `tanggal_surat_permohonan` (ada di `Teacher::$fillable`) diedit manual menjadi format nama bulan tanpa signature, ia lolos `validateRows()` tetapi tidak ikut dinormalisasi di L555–560. |

---

## 2. Hasil Audit Area 2 — Concurrent Idempotency Audit (`findExistingTeacherForCommit()`)

**Kode & Schema yang diperiksa:**
- `backend/app/Http/Controllers/Api/TeacherController.php`: `importCommit()` (L1913–1955), `findExistingTeacherForCommit()` (L1997–2046).
- `backend/database/migrations/2024_01_02_000001_create_teachers_table.php`: definisi kolom & indeks tabel `teachers` (L12–55).

### 2.1. Pengujian Concurrency Terkontrol (2 Proses PHP Paralel + Barrier)

Dua proses PHP dijalankan secara simultan (`proc_open` dengan file barrier sinkronisasi) mengirim payload commit identik (2 guru: NIM `770001` dan `770002`, `action: INSERT`) ke database SQLite file-backed yang sama:

**Output Aktual:**
```text
Worker 1: {"status":500,"data":{"success":false,"message":"SQLSTATE[HY000]: General error: 5 database is locked ... SQL: insert into \"teachers\" (...) values (GURU CONCURRENT SATU, 1992-08-03, ..., 770001, ...)"}}
Worker 2: {"status":200,"data":{"success":true,"summary":"Berhasil: 2 Ditambahkan, 0 Diperbarui."}}
DB after concurrent commit: totalTeachers=2 (expected 2), nim770001_count=1, nim770002_count=1
```

**Analisis Teknis Concurrency & Keterbatasan Lingkungan Test (F-02 — HIGH):**
1. **Bukti Race Condition Terjadi:** Baik Worker 1 maupun Worker 2 **sama-sama mengeksekusi `findExistingTeacherForCommit()` dan sama-sama mendapat `NULL`**, lalu **sama-sama mengeksekusi `INSERT INTO teachers`!**
2. **Perbedaan Kritis SQLite (Test) vs PostgreSQL (Produksi):**
   - Pada SQLite (lingkungan test), duplikasi kebetulan terhenti **bukan karena idempotency**, melainkan karena SQLite memakai file-level write lock sehingga Worker 1 crash dengan **HTTP 500 `database is locked`**.
   - Pada **PostgreSQL (produksi SIMMACI, default isolation `READ COMMITTED`)**, dua transaksi simultan **diizinkan mengeksekusi `INSERT` secara paralel** pada tabel yang sama!
   - Inspeksi `2024_01_02_000001_create_teachers_table.php` membuktikan bahwa `teachers` **tidak memiliki satu pun `UNIQUE` constraint** (hanya `$table->index('nuptk')`, `$table->index('nomor_induk_maarif')`, `$table->index(['school_id', 'is_active'])`).
   - Selain itu, `importCommit()` **tidak menggunakan locking** (tidak ada `pg_advisory_xact_lock` seperti pada `SkDocumentController::reserveNomor`, tidak ada `Cache::lock`, dan `lockForUpdate()` saja pun tidak dapat mengunci baris yang belum ada / phantom insert).
   - **Konsekuensi di Produksi:** Dua request commit identik yang tiba bersamaan (double-click / network retry race) **akan menghasilkan record guru duplikat di PostgreSQL**.

### 2.2. Pengujian Collision Guru Berbeda dengan Nama Sama (F-01 — HIGH)

Pengujian empiris terhadap `findExistingTeacherForCommit()` (L1997–2046) membuktikan **2 cacat integritas data serius**:

```text
Case 2a (same name, blank tanggal_lahir):
  Existing DB : AHMAD FAUZI | school_id=1 | NIM=113400001 | tanggal_lahir=1985-01-10
  Incoming    : AHMAD FAUZI | school_id=1 | NIM=null      | tanggal_lahir=null | pendidikan_terakhir=S2
  Hasil Aktual: HTTP=200, teachersInSchool=1 (seharusnya 2!), existingPendidikan=S2 (guru lama TERTIMPA!)

Case 2b (same name, DIFFERENT NIM 113400002 vs 113400001):
  Existing DB : AHMAD FAUZI | school_id=1 | NIM=113400001 | tanggal_lahir=null
  Incoming    : AHMAD FAUZI | school_id=1 | NIM=113400002 | tanggal_lahir=null
  Hasil Aktual: HTTP=200, teachersInSchool=1, existingNIMAfter=113400002 (NIM GURU LAMA DIBAJAK/DITIMPA!)
```

**Penyebab Teknis (`TeacherController.php` L2001–2043):**
1. Ketika incoming guru memiliki `nomor_induk_maarif = '113400002'` yang tidak ditemukan di L2001–2009, kode tetap jatuh (fall-through) ke L2031–2043 (pencocokan berdasarkan `school_id` + `LOWER(nama)`), **tanpa memeriksa apakah guru yang ditemukan sudah memiliki `nomor_induk_maarif` / `nuptk` / `nip` yang berbeda!**
2. Ketika incoming guru memiliki `tanggal_lahir` kosong, filter `if (!empty($payload['tanggal_lahir']))` dilewati sehingga pencocokan hanya mengandalkan `LOWER(nama)` saja — mencampuradukkan dua guru berbeda bernama sama di madrasah yang sama!
3. Ketika `super_admin` melakukan import tanpa `school_id` (`$schoolId === null`), query L2001–2029 tidak membatasi `school_id`, sehingga berpotensi memperbarui guru di sekolah lain bila terjadi bentrok identifier.

### 2.3. Checklist Area 2

| No | Kriteria Audit Concurrency & Idempotency | Status | Bukti |
|---|---|---|---|
| 2.1 | Tidak terbentuk guru duplikat saat concurrent commit | ❌ **FAIL (F-02)** | Tidak ada advisory/mutex lock maupun DB unique constraint; 2 worker simultan sama-sama lolos `SELECT` → `INSERT` (HTTP 500 di SQLite; duplikat pasti terjadi di PostgreSQL). |
| 2.2 | Tidak terjadi race condition | ❌ **FAIL (F-02)** | Terbukti race condition TOCTOU (Time-of-Check to Time-of-Use) antara `findExistingTeacherForCommit()` dan `Teacher::create()`. |
| 2.3 | Tenant dan school boundary tetap terjaga | ✅ **PASS** (untuk operator; catatan minor untuk super_admin tanpa `school_id`) | Operator dipaksa `school_id = $operatorSchoolId` dan dicek ulang sebelum update (`HTTP 403` + rollback; `AUTH-016` PASS). |
| 2.4 | Guru berbeda dengan nama sama tidak salah dianggap identik | ❌ **FAIL (F-01)** | Case 2a & Case 2b terbukti menimpa guru eksisting dan bahkan menimpa NIM guru lama (`113400001` → `113400002`). |
| 2.5 | Retry sekuensial setelah commit berhasil tidak membuat record baru | ✅ **PASS** | `test_commit_retry_or_resubmit_does_not_create_duplicate_teachers` PASS (`2` guru tetap `2` guru setelah 2× commit berurutan). |

---

## 3. Hasil Audit Area 3 — Atomic Persistence Audit

**Bukti Pengujian Empiris:**
```text
Atomic 3a (Row 1 valid INSERT School A + Row 2 cross-tenant UPDATE School B -> 403):
  HTTP=403, row1Persisted=0 (rollback bekerja sempurna)

Atomic 3b (Row 1 valid INSERT + Row 2 DB NOT NULL violation nama=null -> 500):
  HTTP=500, row1Persisted=0 (rollback bekerja sempurna)
```

| No | Kriteria Audit Atomicity | Status | Bukti |
|---|---|---|---|
| 3.1 | Semua validasi dilakukan sebelum persistence / dilindungi transaksi | ✅ **PASS** | `validateCommitRows()` berjalan di L1892–1905 sebelum `\DB::beginTransaction()` (L1913). |
| 3.2 | Kegagalan pada salah satu record tidak meninggalkan partial persistence | ✅ **PASS** | Dibuktikan pada kegagalan validasi (422), kegagalan tenant (403, Atomic 3a), dan kegagalan constraint DB (500, Atomic 3b) — `row1Persisted = 0`. |
| 3.3 | Rollback bekerja sebagaimana mestinya | ⚠️ **PASS dengan catatan F-05** | `\DB::rollBack()` bekerja untuk `\Exception` dan 403; disarankan mengganti `catch (\Exception $e)` menjadi `catch (\Throwable $e)` atau `\DB::transaction()` agar juga mencakup `\Error`/`TypeError`. |
| 3.4 | Tidak ada data lintas school atau tenant yang terpengaruh | ✅ **PASS** | `AUTH-016` dan Atomic 3a membuktikan data madrasah lain tetap utuh 100%. |

---

## 4. Hasil Audit Area 4 — Security Regression Tests

Semua regression test dijalankan ulang secara read-only:

```powershell
cd backend
php artisan test tests/Feature/PostRemediationSecurityVerificationTest.php --filter=test_auth_016_teacher_import_commit_cross_tenant_mutation_blocked
php artisan test tests/Unit/Services/TeacherImportCommitDateServiceP1Test.php tests/Feature/TeacherImportCommitP1Test.php tests/Feature/StrictDateImportIntegrationTest.php
```

| Skenario Regression | Status | Hasil Aktual |
|---|:---:|---|
| `AUTH-016` cross-tenant mutation | ✅ **PASS** | `1 passed (8 assertions)` (`2.32s`) |
| Preview-to-commit tampering (ISO lain, slash, kalender, replay user lain, injeksi key baru) | ✅ **PASS** | `TeacherImportCommitP1Test` 6/6 PASS |
| Invalid signature & Missing signature | ✅ **PASS** | `TeacherImportCommitDateServiceP1Test` 3/3 PASS + `StrictDateImportIntegrationTest::test_teacher_import_commit_rejects_invalid_date_and_rolls_back` PASS |
| Invalid ISO date (`2023-02-29`, `2023-04-31`, `2023-13-01`) | ✅ **PASS** | Ditolak oleh `validateIsoDate()` & `NormalizationService::parseIndonesianDate()` |
| Ambiguous numeric date (`11/12/2022`, `11-12-2022`, `2022-12-11`, `44876`) | ✅ **PASS** | `StrictDateImportIntegrationTest` 11/11 PASS (total 20 passed, 132 assertions) |
| Legacy date compatibility (`Nopember`, `Pebruari`, `Agu`, `Ags`, `Agst`, `Aug`/`Oct`/`Dec`, hyphen) | ✅ **PASS** | Seluruh format terverifikasi lulus pada suite terkait |

---

## 5. Daftar Temuan Risiko yang Belum Terselesaikan (Menunggu Keputusan Perbaikan)

1. **[HIGH] F-01 — False-Positive Teacher Collision di `findExistingTeacherForCommit()`:**
   - **Dampak:** Dapat menimpa guru eksisting atau membajak NIM/NUPTK/NIP guru lain jika dua guru di sekolah yang sama memiliki nama identik.
   - **Arah Perbaikan yang Disarankan (menunggu persetujuan):**
     - Jika payload membawa identifier (`nomor_induk_maarif`, `nuptk`, atau `nip`) yang tidak ditemukan di DB, **jangan fall-through ke pencocokan nama** (atau pastikan record kandidat tidak memiliki identifier non-null yang bertentangan).
     - Pada pencocokan fallback nama (hanya ketika tidak ada identifier pada payload), **wajibkan `tanggal_lahir` cocok secara eksak** (atau cocokkan hanya bila `tanggal_lahir` kedua sisi sama-sama non-null dan identik — jangan pernah mencocokkan dua guru hanya dari `LOWER(nama)` ketika `tanggal_lahir` kosong).
2. **[HIGH] F-02 — Concurrent Commit Race Condition:**
   - **Dampak:** Dua request commit identik secara paralel di produksi (PostgreSQL `READ COMMITTED`) dapat membentuk record guru duplikat; di SQLite menyebabkan HTTP 500 `database is locked`.
   - **Arah Perbaikan yang Disarankan (menunggu persetujuan):**
     - Bungkus eksekusi commit per sekolah (`school_id`) dengan transactional lock (di PostgreSQL: `SELECT pg_advisory_xact_lock(hashtext('teacher_import_commit:' || $schoolId))` di dalam `\DB::beginTransaction()`) dan/atau `Cache::lock("teacher_import_commit:{$lockScope}", 30)->block(10)` di layer aplikasi agar dua commit identik pada sekolah yang sama terserialisasi dengan aman tanpa race condition maupun HTTP 500.
3. **[MEDIUM-HIGH] F-03 — Hardcoded Fallback Secret & Fail-Open Empty Secret di `signNormalizedDates()`:**
   - **Dampak:** Melanggar ketentuan *"secret tidak hardcoded"* dan menyebabkan fail-open ke key kosong `''` jika `APP_KEY` tidak terkonfigurasi.
   - **Arah Perbaikan yang Disarankan (menunggu persetujuan):**
     - Hapus literal `'simmaci-fallback-key'`; validasi bahwa `$secret = config('app.key')` harus string non-empty, dan lempar `\RuntimeException('Application key (APP_KEY) tidak terkonfigurasi untuk penandatanganan tanggal.')` bila kosong (fail-closed).
4. **[MEDIUM] F-04 — Cross-Row Signature Transplant & Tanpa Expiry:**
   - **Arah Perbaikan yang Disarankan (opsional / disarankan):** Ikat identitas baris (`nama`, `nomor_induk_maarif`) + `exp` (mis. TTL 60 menit) dalam payload signature (`preview_date_signature` format `{exp}.{hmac}`).
5. **[LOW-MEDIUM] F-05 — `catch (\Exception $e)` vs `\Throwable` di `importCommit()`:**
   - **Arah Perbaikan yang Disarankan:** Ubah ke `catch (\Throwable $e)` agar `\Error`/`TypeError` juga melakukan `\DB::rollBack()` eksplisit.
6. **[LOW] F-06 — Normalisasi `tanggal_surat_permohonan` pada cabang edited-valid `validateCommitRows()`:**
   - **Arah Perbaikan yang Disarankan:** Ikut sertakan `tanggal_surat_permohonan` dalam daftar field yang dinormalisasi ulang pada L555.

---

## 6. Final Acceptance Checklist

| Area Audit | Status | Keterangan |
|---|:---:|---|
| 1. HMAC-SHA256 Security Audit | ❌ **NOT MET** | Gagal di kriteria 1.3 (**F-03**: hardcoded fallback & fail-open empty secret); catatan defense-in-depth **F-04**. |
| 2. Concurrent Idempotency Audit | ❌ **NOT MET** | Gagal di kriteria 2.1, 2.2 (**F-02**: race condition tanpa locking) dan 2.4 (**F-01**: false-positive collision & NIM hijacking). |
| 3. Atomic Persistence Audit | ✅ **MET** (catatan minor **F-05**) | Rollback bekerja untuk 422, 403, dan 500 DB error dengan 0 partial persistence. |
| 4. Security Regression | ✅ **MET** | `AUTH-016` (1/1) & date/tampering suite (20/20, 132 assertions) seluruhnya PASS. |

---

## 7. Final Verdict

### **`P1.2 — NOT YET FULLY ACCEPTED (HARDENING REQUIRED FOR F-01, F-02, F-03)`**

Audit ketat read-only berhasil mendeteksi 3 celah keamanan/integritas nyata (**F-01**, **F-02**, **F-03**) sebelum dinyatakan production-ready. Tidak ada kode yang diubah selama audit ini. Mohon keputusan Anda apakah menyetujui perbaikan terarah atas **F-01 s.d. F-06** (atau subset prioritas F-01, F-02, F-03) diikuti verifikasi ulang sebelum memberikan `P1.2 — FULLY ACCEPTED`.
