# Laporan Implementasi & Verifikasi P1.1 — Excel Date Parser

- **Proyek:** SIMMACI (`simmaci.com`)
- **Tahap:** **P1.1 — Excel Date Parser** (Staged Remediation berdasarkan `SK_SUBMISSION_DATE_VALIDATION_RCA.md`)
- **Tanggal:** 26 November 2026
- **Commit:** Belum di-commit (menunggu acceptance & instruksi)
- **Status:** **SELESAI — MENUNGGU ACCEPTANCE SEBELUM MEMULAI P1.2 (TEACHER IMPORT COMMIT)**

---

## 1. Ringkasan Perubahan Minimal (Scope Khusus P1.1)

Perubahan dilakukan secara minimal pada **3 file produksi** dan menambahkan **3 file test baru** (tanpa migration, tanpa menyentuh `TeacherController::importPreview()`/`importCommit()`, tanpa mengubah kebijakan penolakan format numerik ambigu):

| Jenis | File | Ringkasan Perubahan |
|---|---|---|
| **Backend (Modified)** | `backend/app/Services/NormalizationService.php` | (1) Mempromosikan `BULAN_MAP` dari `private const` menjadi `public const` sebagai **single source of truth** pemetaan nama bulan → nomor bulan di backend. (2) Menambahkan dukungan singkatan Inggris output SheetJS (`aug`, `oct`, `dec`) dan variasi Indonesia `agst`. (3) Memperbarui regex `parseIndonesianDate()` (L988) dari `\s+` menjadi `[\s\-]+` agar format bertanda hubung (`11-Mei-2022`, `11-Agu-2022`, `11-Okt-2022`, `11-Des-2022`, dll.) diparsing eksplisit ke `YYYY-MM-DD` via `sprintf()` tanpa fallback `Carbon::parse()` dan bebas pergeseran timezone. |
| **Backend (Modified)** | `backend/app/Services/StrictDateValidationService.php` | (1) Menghapus duplikasi `private const MONTH_MAP` dan langsung menggunakan `NormalizationService::BULAN_MAP` (eliminasi duplikasi map di backend). (2) Menambahkan alias standardisasi `agst => 'Agu'`, `aug => 'Agu'`, `oct => 'Okt'`, `dec => 'Des'` pada `MONTH_ALIASES`. (3) Menyertakan `new \DateTimeZone('UTC')` secara eksplisit pada `ExcelDate::excelToDateTimeObject((float) $val, new \DateTimeZone('UTC'))` di `validateCell()` untuk menjamin nol pergeseran timezone di seluruh konfigurasi zona waktu PHP/server. |
| **Frontend (Modified)** | `src/features/sk-management/utils/skDateUtils.ts` | (1) Menyelaraskan `BULAN_MAP` frontend dengan backend (`agst`, `aug`, `oct`, `dec`, serta nama bulan Inggris lengkap output SheetJS `dd mmmm yyyy`). (2) Memperbarui regex `parseIndonesianDate()` (L96) dari `\s+` menjadi `[\s-]+` agar konsisten dengan backend untuk format bertanda hubung, tetap menggunakan `toIso()` murni tanpa `new Date()` (bebas pergeseran timezone browser). |
| **Backend Unit Test (Added)** | `backend/tests/Unit/Services/ExcelDateParserP1Test.php` | 7 unit test: `Aug`/`Oct`/`Dec`, `Agst`, format hyphen Indonesia/Inggris, kesetaraan Excel Date Cell vs Text Cell, invarian timezone lintas 5 timezone (`UTC`, `Asia/Jakarta`, `America/New_York`, `Pacific/Kiritimati`, `Pacific/Honolulu`), verifikasi single source of truth `BULAN_MAP` (tanpa duplikasi `MONTH_MAP`), dan preservation penolakan tanggal numerik ambigu / kalender invalid. |
| **Backend Feature Test (Added)** | `backend/tests/Feature/ExcelDateParserP1IntegrationTest.php` | 2 feature integration test: end-to-end `/api/sk-documents/bulk-request`, `/api/teachers/import`, `/api/students/import` dengan `Aug`/`Oct`/`Dec`, `Agst`, `11-Mei-2022`, `11-Agu-1992`, `11-Okt-2022`, `11-Des-2022`, serta verifikasi penolakan ketat `11/12/2022` tanpa partial persistence. |
| **Frontend Test (Added)** | `src/features/sk-management/utils/excelDateParser.p1.test.ts` | 5 Vitest test termasuk round-trip workbook `.xlsx` nyata via SheetJS (`xlsx@0.18.5`, `cellDates: false, cellNF: true`, `raw: false`) yang membuktikan kesetaraan hasil parsing antara Excel Date Cell (`dd mmm yyyy`, `[$-id-ID]dd mmm yyyy`, `[$-421]dd mmmm yyyy`) dan Excel Text Cell. |

---

## 2. Bukti Pengujian Sebelum & Sesudah Perbaikan (Before / After)

### 2.1. Hasil Pengujian SEBELUM Perbaikan (RED Baseline)

1. **Backend (`php artisan test tests/Unit/Services/ExcelDateParserP1Test.php tests/Feature/ExcelDateParserP1IntegrationTest.php`):**
   - **Hasil:** **8 failed, 1 passed** (`4.10s`)
   - Gagal tepat pada:
     - `03 Aug 1992` → `Nama bulan 'Aug' tidak dikenali.`
     - `03 Agst 1992` → `Nama bulan 'Agst' tidak dikenali.`
     - `11-Mei-2022`, `11-Agu-1992`, `11-Okt-2022` → `Gagal menormalisasi tanggal '...' menggunakan mekanisme baku sistem.`
     - `02 Dec 2018` → `Nama bulan 'Dec' tidak dikenali.`
     - `StrictDateValidationService` masih menduplikasi konstanta `MONTH_MAP`.
   - 1 test yang lulus adalah preservation test penolakan tanggal numerik ambigu.

2. **Frontend (`npx vitest run src/features/sk-management/utils/excelDateParser.p1.test.ts`):**
   - **Hasil:** **5 failed / 5 tests** (`4.04s`)
   - `parseIndonesianDate()` mengembalikan string mentah (gagal parse) untuk `03 Aug 1992`, `03 August 1992`, `03 Agst 1992`, `11-Mei-2022`, dan hasil SheetJS Excel Date Cell.

### 2.2. Hasil Pengujian SESUDAH Perbaikan (GREEN Verification)

1. **Backend P1.1 Unit + Feature + Full Regression Suite:**
   ```powershell
   cd backend; php artisan test tests/Unit/Services/ExcelDateParserP1Test.php tests/Feature/ExcelDateParserP1IntegrationTest.php tests/Unit/Services/StrictDateValidationServiceTest.php tests/Feature/StrictDateImportIntegrationTest.php tests/Feature/BulkSkDateValidationP0Test.php tests/Feature/BulkSkRequestTest.php tests/Feature/NormalizationIntegrationTest.php tests/Feature/BulkSkImportPreservationTest.php
   ```
   - **Hasil Aktual:** **`85 passed (524 assertions), 0 failed`** (`14.38s`):
     - `Tests\Unit\Services\ExcelDateParserP1Test`: **7/7 passed**
     - `Tests\Feature\ExcelDateParserP1IntegrationTest`: **2/2 passed**
     - `Tests\Unit\Services\StrictDateValidationServiceTest`: **27/27 passed**
     - `Tests\Feature\StrictDateImportIntegrationTest`: **11/11 passed**
     - `Tests\Feature\BulkSkDateValidationP0Test`: **6/6 passed**
     - `Tests\Feature\BulkSkRequestTest`: **10/10 passed**
     - `Tests\Feature\NormalizationIntegrationTest`: **12/12 passed**
     - `Tests\Feature\BulkSkImportPreservationTest`: **10/10 passed**

2. **Frontend P1.1 + Date Util + P0 Regression Suite:**
   ```powershell
   npx vitest run src/features/sk-management/utils/excelDateParser.p1.test.ts src/features/sk-management/utils/parseIndonesianDate.test.ts src/features/sk-management/components/BulkSkSubmission.p0.test.tsx
   ```
   - **Hasil Aktual:** **`56 passed (3 test files), 0 failed`** (`7.88s`):
     - `src/features/sk-management/utils/excelDateParser.p1.test.ts`: **5/5 passed**
     - `src/features/sk-management/utils/parseIndonesianDate.test.ts`: **47/47 passed**
     - `src/features/sk-management/components/BulkSkSubmission.p0.test.tsx`: **4/4 passed**

3. **Verifikasi Cross-Layer Terkontrol (Excel `.xlsx` → SheetJS `xlsx@0.18.5` → Laravel `StrictDateValidationService`):**

| Skenario Sel Excel | Nilai SheetJS (`raw: false`) | Valid Sebelum P1.1 | Valid Sesudah P1.1 | Hasil Normalisasi Backend | Hasil `parseIndonesianDate()` Frontend |
|---|---|:---:|:---:|---|---|
| Text Cell: `03 Agustus 1992` | `"03 Agustus 1992"` | ✅ | ✅ | `1992-08-03` | `1992-08-03` |
| Text Cell: `03 Agst 1992` | `"03 Agst 1992"` | ❌ | ✅ | `1992-08-03` | `1992-08-03` |
| Text Cell: `11-Mei-2022` | `"11-Mei-2022"` | ❌ | ✅ | `2022-05-11` | `2022-05-11` |
| Text Cell: `11-Agu-2022` / `11-Okt-2022` / `11-Des-2022` | *(sama)* | ❌ | ✅ | `2022-08-11` / `2022-10-11` / `2022-12-11` | `2022-08-11` / `2022-10-11` / `2022-12-11` |
| Excel Date Cell: `[$-421]dd mmmm yyyy` (`33819`) | `"03 August 1992"` | ✅ | ✅ | `1992-08-03` | `1992-08-03` |
| Excel Date Cell: `dd mmm yyyy` (`33819`) | `"03 Aug 1992"` | ❌ | ✅ | `1992-08-03` | `1992-08-03` |
| Excel Date Cell: `[$-id-ID]dd mmm yyyy` (`33161`) | `"15 Oct 1990"` | ❌ | ✅ | `1990-10-15` | `1990-10-15` |
| Excel Date Cell: `dd mmm yyyy` (`43436`) | `"02 Dec 2018"` | ❌ | ✅ | `2018-12-02` | `2018-12-02` |
| Excel Date Cell: `d-mmm-yy` (tahun 2 digit) | `"11-Nov-22"` | ❌ (ditolak) | ❌ (tetap ditolak) | `null` | — |
| Excel Date Cell: `dd/mm/yyyy` (numerik ambigu) | `"03/08/1992"` | ❌ (ditolak) | ❌ (tetap ditolak) | `null` | — |
| Excel Date Cell: `General` (serial mentah) | `"43436"` | ❌ (ditolak) | ❌ (tetap ditolak) | `null` | — |

4. **Verifikasi Invarian Timezone (5 Zona Waktu):**
   - Pengujian `UTC`, `Asia/Jakarta` (UTC+7), `America/New_York` (UTC-5), `Pacific/Kiritimati` (UTC+14), dan `Pacific/Honolulu` (UTC-10) menghasilkan tanggal identik (`1992-08-03`, `2022-05-11`, `2018-12-02`) pada `validateCell()` maupun `validateDateString()` dengan **0 hari pergeseran**.

---

## 3. Checklist Ketentuan & Governance P1.1

- [x] Dukungan singkatan Inggris output SheetJS: `Aug`, `Oct`, `Dec`
- [x] Dukungan variasi Indonesia: `Agst`
- [x] Dukungan pemisah tanda hubung: `11-Mei-2022`, `11-Agu-2022`, `11-Okt-2022`, `11-Des-2022` (serta seluruh bulan valid lainnya)
- [x] Konsistensi Excel Date Cell, Excel Text Cell, SheetJS, normalisasi backend, dan helper frontend
- [x] Kebijakan penolakan tanggal numerik ambigu (`11/12/2022`, `2022-12-11`, `44876`, tahun 2 digit, kalender invalid) tetap utuh 100%
- [x] Duplikasi `MONTH_MAP` di backend dieliminasi (single source of truth di `NormalizationService::BULAN_MAP`)
- [x] Bebas pergeseran timezone lintas 5 zona waktu
- [x] **P1.2 (`TeacherController::importPreview()` / `importCommit()`) belum disentuh** sesuai Acceptance Gate

---

## 4. Langkah Selanjutnya

Tahap **P1.1 — Excel Date Parser** telah selesai dan terverifikasi penuh. Mohon evaluasi dan konfirmasi acceptance P1.1 sebelum kita melanjutkan ke tahap **P1.2 — Teacher Import Commit**.
