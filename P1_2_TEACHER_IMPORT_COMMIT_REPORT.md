# Laporan Implementasi & Verifikasi P1.2 — Teacher Import Commit

- **Proyek:** SIMMACI (`simmaci.com`)
- **Tahap:** **P1.2 — Teacher Import Commit** (Staged Remediation berdasarkan `SK_SUBMISSION_DATE_VALIDATION_RCA.md`)
- **Tanggal:** 26 November 2026
- **Commit:** Belum di-commit (menunggu evaluasi & acceptance)
- **Status:** **SELESAI — MENUNGGU EVALUASI & ACCEPTANCE**

---

## 1. Analisis Implementasi Aktual & Desain Solusi Minimal

### 1.1. Akar Masalah pada `importPreview()` → `importCommit()`
1. `TeacherController::importPreview()` memvalidasi tanggal mentah Excel melalui `StrictDateValidationService::validateRows()`, lalu `parseImportRow()` menormalisasi `tanggal_lahir` dan `tmt` menjadi format internal ISO `YYYY-MM-DD` di dalam `previews[].payload`.
2. Ketika frontend (`ImportPreviewModal.tsx` → `TeacherListPage.tsx`) mengirim baris `previews` terpilih ke `POST /api/teachers/import/commit`, `TeacherController::importCommit()` memanggil ulang `StrictDateValidationService::validateRows()` pada `$row['payload']` — sehingga tanggal valid hasil normalisasi preview (`1992-08-03`, `2013-07-15`) langsung ditolak HTTP 422 sebagai format numerik bertanda hubung.
3. Selain itu, `importCommit()` pada jalur `INSERT` tidak memeriksa guru eksisting sehingga retry/resubmit payload identik berpotensi membuat baris `teachers` duplikat, dan `NormalizationService::parseIndonesianDate()` menerima string `YYYY-MM-DD` tanpa `checkdate()` (sehingga tanggal kalender mustahil seperti `2023-02-29` lolos).

### 1.2. Arsitektur Solusi: Tamper-Evident HMAC Preview Date Attestation (Tanpa Bypass & Tanpa Migration)
Untuk memenuhi seluruh 9 persyaratan wajib tanpa melemahkan validasi maupun membuat bypass di `importCommit()`:
- **Saat `importPreview()`:** Setelah `validateRows()` lolos dan `parseImportRow()` menormalisasi tanggal ke `YYYY-MM-DD`, backend menandatangani seluruh field tanggal pada `$parsedData` + `user_id` + `school_id` dengan **HMAC-SHA256** (`preview_date_signature`) menggunakan `config('app.key')`. Frontend `ImportPreviewModal.tsx` otomatis mempertahankan properti ini saat mengirim baris terpilih ke `importCommit()`.
- **Saat `importCommit()`:** Setiap baris **tetap divalidasi ulang** oleh `StrictDateValidationService::validateCommitRows()`:
  - **Jalur 1 — Signature Preview Valid & Utuh (`hash_equals` PASS):** Seluruh field tanggal tetap divalidasi ulang dengan `validateIsoDate()` (regex tepat `^\d{4}-\d{2}-\d{2}$` + `checkdate()`, bebas timezone).
  - **Jalur 2 — Tanpa Signature / Signature Salah / Data Tanggal Dimanipulasi Pasca-Preview (atau Replay User/Sekolah Lain):** HMAC gagal → baris **wajib melewati validasi ketat penuh `validateRows()`** (menolak ISO `2022-12-11` yang ditempa, menolak `11/12/2022`, menolak serial/kalender invalid). Jika user mengedit tanggal secara sah menggunakan nama bulan (misal `21 Agst 1995` atau `11-Mei-2020`), validasi meloloskan dan menormalisasinya ulang ke `YYYY-MM-DD` sebelum disimpan.
- **Idempotency / Duplicate Guard pada `importCommit()`:** Pada aksi `INSERT` / `MANUAL (!$targetId)`, `findExistingTeacherForCommit()` memeriksa guru eksisting pada sekolah yang sama (via `nomor_induk_maarif`, `nuptk`, `nip`, atau `nama` + `school_id` + `tanggal_lahir`) sehingga retry/resubmit melakukan update aman (tetap menjaga isolasi tenant operator) dan **tidak pernah membuat duplikat**.

---

## 2. Daftar File yang Diubah / Ditambahkan (Khusus Scope P1.2)

| Jenis | File | Perubahan Minimal |
|---|---|---|
| **Backend (Modified)** | `backend/app/Services/NormalizationService.php` | Menambahkan verifikasi kalender `checkdate()` pada cabang ISO `YYYY-MM-DD` di `parseIndonesianDate()` (L977–980) agar tanggal mustahil (`2023-02-29`, `2023-04-31`, `2023-13-01`) mengembalikan `null`. |
| **Backend (Modified)** | `backend/app/Services/StrictDateValidationService.php` | Menambahkan `validateIsoDate()`, `extractDateFieldsFromRow()`, `signNormalizedDates()`, `verifyNormalizedDates()`, dan `validateCommitRows()` untuk validasi ulang ketat dan deteksi tampering pada tahap commit tanpa bypass. |
| **Backend (Modified)** | `backend/app/Http/Controllers/Api/TeacherController.php` | (1) `importPreview()` menyertakan `preview_date_signature` pada setiap item preview. (2) `importCommit()` memanggil `validateCommitRows()`, menerapkan tanggal ternormalisasi, serta menambahkan `findExistingTeacherForCommit()` untuk mencegah duplikasi pada retry/resubmit sambil menjaga isolasi tenant. |
| **Backend Unit Test (Added)** | `backend/tests/Unit/Services/TeacherImportCommitDateServiceP1Test.php` | 3 unit test: `validateIsoDate()`, `signNormalizedDates()`/`verifyNormalizedDates()` (tampering value, injeksi field baru, replay user/school lain, signature palsu), dan penolakan kalender mustahil di `NormalizationService`. |
| **Backend Feature Test (Added)** | `backend/tests/Feature/TeacherImportCommitP1Test.php` | 6 feature test: preview→commit INSERT (semua format P1.1 & TTL), 5 skenario tampering (ISO ditempa, slash ambigu, kalender invalid, replay user lain, injeksi field tanggal baru) dengan 0 partial persistence, preview→commit UPDATE, edit manual teks bulan valid pasca-preview, idempotency retry/resubmit (0 duplikat), dan invarian 4 timezone. |

> **Scope Guard:** Tidak ada migration database, tidak ada perubahan frontend/UI, tidak ada deployment, dan tidak ada perubahan pada fitur di luar scope P1.2.

---

## 3. Analisis Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| **Client/integrasi langsung memanggil `/api/teachers/import/commit` tanpa preview** dengan tanggal ISO palsu (`2022-12-11`) atau numerik ambigu (`11/12/2022`) | Tanpa `preview_date_signature` valid, `validateCommitRows()` menjalankan `validateRows()` penuh sehingga semua format numerik/ISO tanpa provenance preview tetap ditolak HTTP 422 (`test_teacher_import_commit_rejects_invalid_date_and_rolls_back` tetap PASS). |
| **Replay `preview_date_signature` lintas user atau lintas madrasah** | HMAC mengikat `user_id` dan `school_id` ke dalam payload kanonik signature, sehingga replay oleh operator lain langsung gagal dan ditolak 422. |
| **Manipulasi sebagian payload tanggal atau penyisipan field tanggal baru** | `extractDateFieldsFromRow()` mengekstrak seluruh field bertema tanggal secara deterministik (`ksort`); perubahan 1 karakter atau penambahan 1 key tanggal membatalkan HMAC dan memicu validasi ulang ketat. |
| **Kebocoran isolasi tenant pada duplicate guard saat retry** | `findExistingTeacherForCommit()` membatasi pencarian dengan `school_id`, ditambah verifikasi ulang `(int) $existingTeacher->school_id !== $operatorSchoolId` → HTTP 403 + rollback (`AUTH-016` tetap PASS). |

---

## 4. Bukti Pengujian Sebelum & Sesudah Perbaikan (Before / After)

### 4.1. Pengujian SEBELUM Perbaikan (RED Baseline)

```powershell
cd backend; php artisan test tests/Unit/Services/TeacherImportCommitDateServiceP1Test.php tests/Feature/TeacherImportCommitP1Test.php
```
- **Hasil:** **7 failed, 1 passed (27 assertions)** (`2.54s`):
  - `validateIsoDate()` & `signNormalizedDates()` belum tersedia.
  - `NormalizationService::parseIndonesianDate('2023-02-29')` mengembalikan `'2023-02-29'` alih-alih `null`.
  - Seluruh test round-trip `importPreview()` → `importCommit()` gagal HTTP 422 dengan error: `Format tanggal numerik dengan tanda hubung ('1992-08-03') tidak diterima`.

### 4.2. Pengujian SESUDAH Perbaikan (GREEN Verification)

1. **Backend P1.2 Unit + Integration + Tampering + Integrity + Full Regression Suite:**
   ```powershell
   cd backend; php artisan test tests/Unit/Services/TeacherImportCommitDateServiceP1Test.php tests/Feature/TeacherImportCommitP1Test.php tests/Feature/StrictDateImportIntegrationTest.php tests/Unit/Services/StrictDateValidationServiceTest.php tests/Unit/Services/ExcelDateParserP1Test.php tests/Feature/ExcelDateParserP1IntegrationTest.php tests/Feature/BulkSkDateValidationP0Test.php tests/Feature/BulkSkRequestTest.php tests/Feature/NormalizationIntegrationTest.php tests/Feature/BulkSkImportPreservationTest.php
   ```
   - **Hasil Aktual:** **`94 passed (605 assertions), 0 failed`** (`8.74s`):
     - `Tests\Unit\Services\TeacherImportCommitDateServiceP1Test`: **3/3 passed**
     - `Tests\Feature\TeacherImportCommitP1Test`: **6/6 passed**
     - `Tests\Feature\StrictDateImportIntegrationTest`: **11/11 passed** (termasuk `test_teacher_import_commit_rejects_invalid_date_and_rolls_back`)
     - `Tests\Unit\Services\StrictDateValidationServiceTest`: **27/27 passed**
     - `Tests\Unit\Services\ExcelDateParserP1Test`: **7/7 passed**
     - `Tests\Feature\ExcelDateParserP1IntegrationTest`: **2/2 passed**
     - `Tests\Feature\BulkSkDateValidationP0Test`: **6/6 passed**
     - `Tests\Feature\BulkSkRequestTest`: **10/10 passed**
     - `Tests\Feature\NormalizationIntegrationTest`: **12/12 passed**
     - `Tests\Feature\BulkSkImportPreservationTest`: **10/10 passed**

2. **Security Regression (`AUTH-016` Cross-Tenant Mutation Blocked on `importCommit`):**
   ```powershell
   cd backend; php artisan test tests/Feature/PostRemediationSecurityVerificationTest.php --filter=test_auth_016_teacher_import_commit_cross_tenant_mutation_blocked
   ```
   - **Hasil Aktual:** **`1 passed (8 assertions), 0 failed`** (`1.63s`).

3. **Frontend Vitest Regression Suite:**
   ```powershell
   npx vitest run src/features/sk-management/utils/excelDateParser.p1.test.ts src/features/sk-management/utils/parseIndonesianDate.test.ts src/features/sk-management/components/BulkSkSubmission.p0.test.tsx
   ```
   - **Hasil Aktual:** **`56 passed (3 test files), 0 failed`** (`5.40s`).

---

## 5. Acceptance Checklist P1.2

| No | Persyaratan Wajib | Status | Bukti Pengujian |
|---|---|---|---|
| 1 | Preview menerima tanggal valid sesuai kebijakan | ✅ PASS | `test_preview_to_commit_succeeds_with_normalized_iso_dates_and_all_p1_formats` (`03 Agustus 1992`, `03 Aug 1992`, `02 Dec 2018`, `21 Agst 1990`, `11-Mei-2022`, `11 Nopember 1988`, `15 Oct 2019`). |
| 2 | Normalisasi menghasilkan format internal standar (`YYYY-MM-DD`) | ✅ PASS | Seluruh payload preview & DB menyimpan format `YYYY-MM-DD` valid (`1992-08-03`, `2013-07-15`, `2022-05-11`, dll.). |
| 3 | Commit tidak menolak tanggal valid hanya karena sudah dinormalisasi ke `YYYY-MM-DD` | ✅ PASS | Preview → Commit untuk INSERT (4 guru) dan UPDATE (1 guru eksisting) keduanya mengembalikan HTTP 200. |
| 4 | Validasi ulang pada commit tetap dipertahankan | ✅ PASS | `validateCommitRows()` memverifikasi HMAC + `validateIsoDate()` untuk baris preview sah, dan `validateRows()` penuh untuk baris lain. |
| 5 | Data yang berubah setelah preview wajib diperiksa kembali | ✅ PASS | 5 skenario tampering (ISO lain, slash ambigu, kalender invalid, replay user lain, injeksi field tanggal baru) seluruhnya ditolak 422; edit manual teks bulan valid (`21 Agst 1995`, `11-Mei-2020`) divalidasi & dinormalisasi ke `1995-08-21`, `2020-05-11`. |
| 6 | Tanggal numerik ambigu tetap ditolak | ✅ PASS | `11/12/2022`, `11-12-2022`, `2022-12-11` (forged/tampered), `44876` ditolak 422 di preview maupun commit. |
| 7 | Tidak ada pergeseran tanggal akibat timezone | ✅ PASS | `test_preview_to_commit_has_no_timezone_shift_across_timezones` lulus lintas 4 zona waktu (`UTC`, `Asia/Jakarta`, `America/New_York`, `Pacific/Kiritimati`). |
| 8 | Kegagalan validasi tidak menghasilkan partial persistence | ✅ PASS | Batch campuran valid + tampered menghasilkan HTTP 422 dengan `teachers = 0`. |
| 9 | Tidak ada duplikasi data akibat retry atau submit ulang | ✅ PASS | `test_commit_retry_or_resubmit_does_not_create_duplicate_teachers` membuktikan 2× commit payload `INSERT` identik menghasilkan tepat 2 guru (0 duplikat). |

---

## 6. Status Tahap

Tahap **P1.2 — Teacher Import Commit** telah selesai dan seluruh pengujian terverifikasi hijau. Pengerjaan berhenti di sini menunggu evaluasi dan acceptance Anda (tanpa melanjutkan pekerjaan lain, commit, maupun deployment sebelum ada instruksi).
