# Root Cause Analysis (RCA): Kegagalan Submit Pengajuan Permohonan SK Akibat Validasi Tanggal

- **Proyek:** SIMMACI (`simmaci.com`)
- **Fitur:** Pengajuan Permohonan SK Kolektif (Bulk SK Submission) & Import Excel Data Guru
- **Tanggal Investigasi:** 26 November 2026
- **Status Investigasi:** Selesai (Read-Only Investigation — Tanpa Perubahan Source Code)
- **Verdict:** **ROOT CAUSE IDENTIFIED**

---

## A. Executive Summary

Proses submit **Pengajuan Permohonan SK Kolektif (Bulk SK)** melalui Excel **pasti gagal 100% di produksi** dengan modal error **"Format Tanggal Tidak Sesuai!"** (HTTP 422), meskipun seluruh tanggal pada file Excel (`Tanggal Lahir` dan `TMT`) sudah ditulis dengan benar menggunakan nama bulan bahasa Indonesia (misalnya `03 Agustus 1992`, `20 Februari 1984`, `15 Juli 2013`, `02 Desember 2018`).

**Akar masalah utama (Primary Root Cause)** bukan berasal dari isi file Excel pengguna, melainkan dari **injeksi field metadata form UI (`tanggal_permohonan`) ke dalam setiap baris array `documents[]` sebelum dikirim ke validator ketat Excel**:

1. Pada komponen frontend `BulkSkSubmission.tsx`, pengguna wajib mengisi **Langkah 3 — Tgl. Surat** menggunakan native HTML `<input type="date">`. Sesuai spesifikasi HTML5, nilai kontrol ini **selalu** berformat ISO numerik `YYYY-MM-DD` (misalnya `2026-08-11`), dan tombol submit dinonaktifkan jika field ini kosong.
2. Saat tombol **Proses Data** ditekan (`handleSubmit()`), frontend menyalin `tanggal_permohonan: "2026-08-11"` ke **setiap objek baris guru** di dalam payload `documents[]` (untuk 8 guru → 8 objek dengan `tanggal_permohonan: "2026-08-11"`).
3. Di backend, `SkDocumentController::bulkRequest()` memanggil `StrictDateValidationService::validateRows($request->documents)` tanpa mengecualikan field metadata UI.
4. `StrictDateValidationService::validateRows()` memiliki deteksi wildcard `str_contains($cleanKey, 'tanggal')`, sehingga secara otomatis menangkap key `tanggal_permohonan`, memberinya label **`Tanggal Permohonan`**, lalu memvalidasi nilainya (`2026-08-11`) dengan `validateDateString()` — yang memang dirancang untuk **menolak format numerik `YYYY-MM-DD`**.
5. Akibatnya, seluruh 8 baris ditolak secara identik pada kolom **`Tanggal Permohonan`** dengan nilai **`2026-08-11`** (baris 2 sampai 9 — baris 8 dan 9 terlihat di bagian bawah tabel modal error), lalu `DateValidationErrorDialog.tsx` menampilkan teks yang menyesatkan seolah-olah kesalahan tersebut berasal dari *"file Excel"* (*"Ditemukan 8 kesalahan tanggal pada file Excel"* / *"Nilai di Excel"*).

Selain akar masalah utama di atas, investigasi berbasis bukti ini juga mengidentifikasi **4 cacat laten / berkontribusi (secondary/latent defects)** yang berpotensi menyebabkan penolakan tanggal yang tampak benar di Excel maupun kegagalan import data guru:
1. **Excel Date Cell berformat 3-huruf (`dd mmm yyyy` / `[$-id-ID]dd mmm yyyy`) ditolak untuk bulan Agustus, Oktober, dan Desember** karena pembacaan Excel dilakukan di browser oleh SheetJS (`xlsx@0.18.5`) yang mengabaikan locale Indonesia dan menghasilkan singkatan Inggris (`Aug`, `Oct`, `Dec`), sementara `StrictDateValidationService::MONTH_MAP` hanya memuat nama lengkap Inggris (`august`, `october`, `december`) dan tidak memuat singkatan Inggris `aug`, `oct`, `dec`.
2. **Alias `Agst` tidak didukung dan format bertanda hubung bulan Indonesia (`11-Mei-2022`, `11-Agu-2022`, `11-Okt-2022`, `11-Des-2022`) gagal dinormalisasi** karena ketidaksinkronan regex antara `StrictDateValidationService` dan `NormalizationService::parseIndonesianDate()`.
3. **Bug normalisasi-sebelum-validasi pada alur Import Guru (`importPreview` → `importCommit`)**: `TeacherController::importPreview()` menormalisasi `tanggal_lahir` dan `tmt` menjadi `YYYY-MM-DD` di dalam `payload`, tetapi `TeacherController::importCommit()` menjalankan ulang `StrictDateValidationService::validateRows()` terhadap `payload` yang sudah berformat `YYYY-MM-DD` tersebut, sehingga commit selalu ditolak dengan HTTP 422.
4. **Dead code pada `validateCell()` / `validateSpreadsheet()` & potensi drift nomor baris** ketika baris header Excel tidak berada di baris 1 atau terdapat baris kosong yang disaring di frontend.

---

## B. Actual Technical Flow

### B.1. Alur End-to-End Pengajuan SK Kolektif (Bulk SK)

Validasi tanggal yang gagal terjadi pada **tahap final submission** (`POST /api/sk-documents/bulk-request`), **bukan** saat memilih/upload file Excel dan **bukan** saat preview tabel di frontend.

```
[1. User Download / Isi Excel]
    Template_Bulk_SK.xlsx:
    Headers: Nama | Tempat Lahir | Tanggal Lahir | NIM | Pendidikan Terakhir | Unit Kerja | TMT | Status | PDPKPNU | Kecamatan | Baru/Perpanjangan
    (Catatan: TIDAK ADA kolom "Tanggal Permohonan" di template Excel)
         │
         ▼
[2. User Pilih File Excel di Browser]
    src/features/sk-management/components/BulkSkSubmission.tsx :: handleExcelUpload() (L80–230)
    ├─ FileReader.readAsBinaryString(file)
    ├─ SheetJS (xlsx@0.18.5): XLSX.read(result, { type: "binary", cellDates: false, cellNF: true })
    ├─ XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" })
    │   └─ Mengambil formatted text (`cell.w`) dari SheetJS SSF (engine format berbahasa Inggris)
    ├─ Deteksi baris header berbasis skor (`bestRowIndex`, L94–109)
    ├─ Mapping kolom via `HEADER_MAP` (L56–70):
    │   ├─ "tanggal_lahir" ← ["tanggal lahir", "tgl lahir", "ttl", ...]
    │   └─ "tmt"           ← ["tanggal mulai tugas", "tmt", ...]
    │   (TIDAK ADA mapping "tanggal_permohonan" dari Excel)
    ├─ TIDAK ada validasi format tanggal di frontend (L158–174 hanya trim & split TTL)
    └─ Simpan hasil ke state `candidates` (8 guru → 8 elemen array; baris kosong di-filter)
         │
         ▼
[3. User Isi Langkah 3 — Berkas Permohonan Resmi (Form UI)]
    BulkSkSubmission.tsx (L398–415)
    ├─ Upload Surat Permohonan (PDF) → `suratPermohonanFile`
    ├─ Input No. Surat (text)        → `nomorPermohonanUi`
    └─ Input Tgl. Surat (<Input type="date">) → `tanggalPermohonanUi`
        └─ HTML5 <input type="date"> SELALU menghasilkan string ISO: "2026-08-11"
         │
         ▼
[4. User Klik "Proses 8 Data" (Final Submission)]
    BulkSkSubmission.tsx :: handleSubmit() (L280–364)
    ├─ Step 1: Upload PDF via `mediaApi.upload(suratPermohonanFile, 'permohonan-kolektif')`
    ├─ Step 2: Konstruksi payload `documents` (L319–324):
    │     documents = candidates.map(c => ({
    │       ...c,
    │       status_kepegawaian: c.status || 'GTY',
    │       nomor_permohonan:   nomorPermohonanUi || undefined,
    │       tanggal_permohonan: tanggalPermohonanUi || undefined   // <-- "2026-08-11" disuntikkan ke SEMUA 8 baris!
    │     }))
    └─ Step 3: POST /api/sk-documents/bulk-request via `skApi.bulkRequest({ documents, surat_permohonan_url, meta })`
         │
         ▼
[5. Backend Validation Gate]
    backend/app/Http/Controllers/Api/SkDocumentController.php :: bulkRequest() (L1204–1251)
    ├─ Laravel validation: documents (required|array), surat_permohonan_url (required|string)
    └─ Line 1217: $dateErrors = $this->strictDateValidationService->validateRows($request->documents);
         │
         ▼
[6. Strict Date Validator Memeriksa Setiap Key di Setiap Baris]
    backend/app/Services/StrictDateValidationService.php :: validateRows() (L436–540)
    ├─ Loop setiap baris ($idx = 0..7) → $excelRowNum = 2 + $idx (menghasilkan row 2..9)
    ├─ Key "tanggal_lahir" ("03 Agustus 1992") → validateDateString() → VALID ✅
    ├─ Key "tmt" ("15 Juli 2013")              → validateDateString() → VALID ✅
    └─ Key "tanggal_permohonan" ("2026-08-11"):
        ├─ Tidak ada di `$dateColumnLabels` default (L443–456)
        ├─ TERTANGKAP oleh deteksi wildcard L510–519: str_contains('tanggal_permohonan', 'tanggal') === true
        ├─ Label disintesis: ucwords(str_replace('_', ' ', 'tanggal_permohonan')) → "Tanggal Permohonan"
        └─ validateDateString('2026-08-11') → cocok regex `/^\d{1,4}-\d{1,2}-\d{1,4}$/` (L162) → DITOLAK ❌
         │
         ▼
[7. HTTP 422 Response & Modal Error]
    ├─ Backend mengembalikan HTTP 422 dengan 8 item di `date_errors` (row 2..9, column: "Tanggal Permohonan", value: "2026-08-11")
    ├─ Tidak ada data yang disimpan dan queue `ProcessBulkSkSubmission` tidak pernah di-dispatch
    └─ BulkSkSubmission.tsx (L350–352) membuka <DateValidationErrorDialog>
        └─ Menampilkan: "Format Tanggal Tidak Sesuai!" / "Ditemukan 8 kesalahan tanggal pada file Excel:"
```

### B.2. Perbandingan Alur Pengajuan SK Individual vs Bulk SK vs Import Guru

| Alur Fitur | Komponen Frontend | Endpoint Backend | Sumber Nilai Tanggal | Melewati `StrictDateValidationService::validateRows()`? | Dampak Aktual |
|---|---|---|---|---|---|
| **Pengajuan SK Individual** | `SkSubmissionPage.tsx` (L671: `<Input type="date">`) | `POST /api/sk-documents/submit-request` (`SkDocumentController::submitRequest`) | Form UI `<input type="date">` (`YYYY-MM-DD`) | **Tidak** | Berhasil disimpan langsung ke kolom SQL `DATE` (`tanggal_permohonan`). |
| **Pengajuan SK Kolektif (Bulk SK)** | `BulkSkSubmission.tsx` (Excel via SheetJS + `<Input type="date">` L411) | `POST /api/sk-documents/bulk-request` (`SkDocumentController::bulkRequest`) | Excel (`tanggal_lahir`, `tmt`) **dicampur** Form UI (`tanggal_permohonan = YYYY-MM-DD`) | **Ya** (L1217, seluruh key pada `$request->documents`) | **SELALU GAGAL 422** pada kolom `Tanggal Permohonan` untuk seluruh N baris. |
| **Import Data Guru (Direct)** | `ExcelImportModal.tsx` → `FileUploadStep.tsx` (SheetJS) | `POST /api/teachers/import` (`TeacherController::import`) | Excel via SheetJS (`raw: false`) | **Ya** (L576) | Berhasil untuk teks Indonesia baku; **gagal** untuk Excel Date Cell `dd mmm yyyy` bulan Agu/Okt/Des (`Aug`/`Oct`/`Dec`), `Agst`, atau `11-Mei-2022`. |
| **Import Data Guru (Preview → Commit)** | `TeacherListPage.tsx` (L1069 `importPreview` → L1111 `importCommit`) | `POST /api/teachers/import/preview` → `POST /api/teachers/import/commit` | Preview menerima raw Excel lalu menormalisasi ke `YYYY-MM-DD` di `payload`; Commit menerima `payload` hasil preview | **Ya di keduanya** (L1778 & L1884) | **SELALU GAGAL 422 saat Commit** karena `importCommit` memvalidasi ulang `payload` yang sudah dinormalisasi menjadi `YYYY-MM-DD` oleh `importPreview`. |
| **Import Data Siswa** | `ExcelImportModal.tsx` → `FileUploadStep.tsx` (SheetJS) | `POST /api/students/import` (`StudentController::import`) | Excel via SheetJS (`raw: false`) | **Ya** (L104) | Sama seperti Import Guru Direct (rentan pada SheetJS `Aug`/`Oct`/`Dec`, `Agst`, hyphen Indonesia). |

---

## C. Evidence and Findings

### C.1. Daftar File & Fungsi yang Diperiksa

| No | File | Fungsi / Bagian | Temuan Kunci |
|---|---|---|---|
| 1 | `src/features/sk-management/components/BulkSkSubmission.tsx` | `HEADER_MAP` (L56–70), `handleDownloadTemplate` (L71–78), `handleExcelUpload` (L80–230), `handleSubmit` (L280–364), Form Langkah 3 (L409–412), Button disabled (L481) | Menggunakan SheetJS `xlsx@0.18.5`; tidak memetakan `tanggal_permohonan` dari Excel; wajib input `<Input type="date">` (`YYYY-MM-DD`) lalu menyuntikkannya ke setiap item `documents[]`. |
| 2 | `src/components/common/DateValidationErrorDialog.tsx` | `DateValidationErrorDialog` (L36–110) | Hardcode teks *"kesalahan tanggal pada file Excel"* dan header tabel *"Nilai di Excel"* bahkan ketika field berasal dari form UI. |
| 3 | `src/components/common/DateFormatInfoAlert.tsx` | `DateFormatInfoAlert` (L9–63) | Secara eksplisit menyatakan format Excel `dd mmm yyyy` diterima (L41), padahal SheetJS memformat `dd mmm yyyy` dalam bahasa Inggris (`Aug`, `Oct`, `Dec`) yang ditolak backend. |
| 4 | `backend/app/Http/Controllers/Api/SkDocumentController.php` | `submitRequest` (L737–1198), `bulkRequest` (L1204–1251), `processBulkRequestSync` (L1256–1750) | `bulkRequest()` memanggil `validateRows($request->documents)` (L1217). `processBulkRequestSync()` hanya menormalisasi `['tanggal_lahir', 'tmt']` (L1429) dan langsung menyimpan `$doc['tanggal_permohonan']` (L1656, L1694) ke kolom SQL `DATE`. |
| 5 | `backend/app/Jobs/ProcessBulkSkSubmission.php` | `handle` (L41–544) | Sama dengan jalur sync: hanya menormalisasi `['tanggal_lahir', 'tmt']` (L194–199) dan langsung menyimpan `$doc['tanggal_permohonan']` (L424) ke kolom SQL `DATE`. |
| 6 | `backend/app/Services/StrictDateValidationService.php` | `MONTH_MAP` (L16–61), `validateDateString` (L124–289), `validateCell` (L323–395), `validateRows` (L436–540), `validateSpreadsheet` (L548–620) | Wildcard `str_contains($cleanKey, 'tanggal')` (L510–519) menangkap `tanggal_permohonan` dan menolaknya sebagai `YYYY-MM-DD`. `MONTH_MAP` tidak memuat `agst`, `aug`, `oct`, `dec`. `validateCell()` dan `validateSpreadsheet()` tidak pernah dipanggil di mana pun di controller/job. |
| 7 | `backend/app/Services/NormalizationService.php` | `BULAN_MAP` (L935–948), `parseIndonesianDate` (L964–1016) | Regex L984 (`/^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})$/u`) hanya menerima spasi, bukan tanda hubung `-`; tidak memiliki `agst`, `aug`, `oct`, `dec`. |
| 8 | `backend/app/Models/SkDocument.php` & `backend/database/migrations/2026_04_10_000002_add_permohonan_to_sk_documents.php` | Schema & `$fillable` | Kolom `sk_documents.tanggal_permohonan` bertipe SQL `DATE` (`$row->date('tanggal_permohonan')->nullable()`), yang memang memerlukan format ISO `YYYY-MM-DD` saat insert ke PostgreSQL. |
| 9 | `src/features/emis-import/components/FileUploadStep.tsx` | `processFile` (L24–110) | Membaca Excel di client dengan `XLSX.read(data, { type: 'binary', cellDates: false, cellNF: true })` dan `sheet_to_json(sheet, { defval: "", raw: false })`. |
| 10 | `backend/app/Http/Controllers/Api/TeacherController.php` & `src/features/master-data/TeacherListPage.tsx` | `import` (L572), `parseImportRow` (L1650–1684), `importPreview` (L1774–1871), `importCommit` (L1876–1925), `TeacherListPage.tsx` (L1061–1124) | `importPreview` menormalisasi tanggal ke ISO `YYYY-MM-DD` di `payload`, lalu `importCommit` memvalidasi ulang `payload` dengan `validateRows()` → selalu gagal 422. |
| 11 | `backend/tests/Feature/StrictDateImportIntegrationTest.php` & `backend/tests/Unit/Services/StrictDateValidationServiceTest.php` | Suite test eksisting (38 tests) | Semua 38 test lulus, tetapi test `test_sk_bulk_request_accepts_valid_month_name_dates` (L352–370) **tidak menyertakan** `tanggal_permohonan` dalam payload, sehingga bug fatal di produksi lolos dari pengujian. |

---

### C.2. Potongan Kode Relevan

#### 1) Injeksi `tanggal_permohonan` dari `<Input type="date">` ke Setiap Baris Excel (`BulkSkSubmission.tsx`)
```tsx
// src/features/sk-management/components/BulkSkSubmission.tsx (L409-412)
<div className="space-y-1.5">
    <Label className="text-[9px] font-black uppercase text-slate-400">Tgl. Surat</Label>
    <Input type="date" value={tanggalPermohonanUi} onChange={e => setTanggalPermohonanUi(e.target.value)} className="h-10 rounded-xl bg-white" />
</div>

// L481 — tombol submit wajib menunggu tanggalPermohonanUi terisi
<Button onClick={handleSubmit} disabled={isProcessing || candidates.length === 0 || !suratPermohonanFile || !nomorPermohonanUi || !tanggalPermohonanUi} ...>

// L319-324 — nilai ISO YYYY-MM-DD disalin ke SEMUA dokumen
const documents = candidates.map(c => ({
  ...c,
  status_kepegawaian: c.status || 'GTY',
  nomor_permohonan:   nomorPermohonanUi || undefined,
  tanggal_permohonan: tanggalPermohonanUi || undefined
}))
```

#### 2) Pemanggilan Validator Ketat pada Seluruh Array `documents` (`SkDocumentController.php`)
```php
// backend/app/Http/Controllers/Api/SkDocumentController.php (L1217-1225)
$dateErrors = $this->strictDateValidationService->validateRows($request->documents);
if (!empty($dateErrors)) {
    return response()->json([
        'success'     => false,
        'message'     => $this->strictDateValidationService->formatErrorMessage($dateErrors),
        'errors'      => $dateErrors,
        'date_errors' => $dateErrors,
    ], 422);
}
```

#### 3) Deteksi Wildcard `tanggal` dan Penolakan Format ISO `YYYY-MM-DD` (`StrictDateValidationService.php`)
```php
// backend/app/Services/StrictDateValidationService.php (L510-535)
if (!$isDateCol && (
    str_contains($cleanKey, 'tgl') ||
    str_contains($cleanKey, 'tanggal') ||
    $cleanKey === 'tmt' ||
    str_contains($cleanKey, '_tmt') ||
    str_contains($cleanKey, 'tmt_')
)) {
    $isDateCol = true;
    $colLabel  = ucwords(str_replace('_', ' ', $cleanKey)); // "tanggal_permohonan" -> "Tanggal Permohonan"
}

if ($isDateCol) {
    $valStr = is_string($rawVal) ? $rawVal : (is_numeric($rawVal) ? (string) $rawVal : null);
    if ($valStr !== null) {
        $res = $this->validateDateString($valStr); // L162: menolak '/^\d{1,4}-\d{1,2}-\d{1,4}$/'
        if (!$res['valid']) {
            $errors[] = [
                'sheet'  => $sheetName,
                'row'    => $excelRowNum, // 2 + $idx
                'column' => $colLabel,    // "Tanggal Permohonan"
                'value'  => (string) $rawVal, // "2026-08-11"
                'reason' => $res['reason'],
            ];
        }
    }
}
```

#### 4) Kontradiksi Penyimpanan `tanggal_permohonan` di Backend (Catch-22)
```php
// SkDocumentController.php (L1429-1437 & L1656) & ProcessBulkSkSubmission.php (L194-199 & L424)
// Hanya 'tanggal_lahir' dan 'tmt' yang dinormalisasi dari teks Indonesia ke ISO YYYY-MM-DD:
foreach (['tanggal_lahir', 'tmt'] as $dateField) {
    if (isset($teacherData[$dateField]) && is_string($teacherData[$dateField])) {
        $parsed = $this->strictDateValidationService->parseAndNormalize($teacherData[$dateField]);
        ...
        $teacherData[$dateField] = $parsed;
    }
}

// 'tanggal_permohonan' langsung disimpan apa adanya ke kolom PostgreSQL DATE:
'tanggal_permohonan' => $doc['tanggal_permohonan'] ?? null,
```
> **Konsekuensi Catch-22:** Jika `tanggal_permohonan` berformat `2026-08-11` (dari `<input type="date">`), `validateRows()` menolaknya dengan HTTP 422. Sebaliknya, jika `tanggal_permohonan` berformat `"11 Agustus 2026"`, `validateRows()` akan meloloskannya namun insert ke kolom PostgreSQL `DATE` (`sk_documents.tanggal_permohonan`) akan gagal karena tidak pernah dinormalisasi!

#### 5) Kontradiksi Pembacaan Excel di Frontend vs Backend (`BulkSkSubmission.tsx` vs `StrictDateValidationService.php`)
```ts
// BulkSkSubmission.tsx (L87-89) & FileUploadStep.tsx (L68-71)
const wb = XLSX.read(evt.target?.result, { type: "binary", cellDates: false, cellNF: true })
const ws = wb.Sheets[wb.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" }) as any[][]
```
Meskipun `StrictDateValidationService` memiliki `validateCell(Cell $cell)` dan `validateSpreadsheet(Spreadsheet $spreadsheet)` berbasis PhpSpreadsheet, **seluruh alur import SIMMACI membaca file `.xlsx` di frontend memakai SheetJS (`xlsx@0.18.5`) dan mengirim JSON ke backend**. Backend tidak pernah menerima file `.xlsx` maupun objek `Cell` PhpSpreadsheet pada endpoint `/api/sk-documents/bulk-request`, `/api/teachers/import*`, maupun `/api/students/import`.

#### 6) Git History Penyebab Regresi
- Commit `19556df5` (13 Nov 2026): Menambahkan `$this->strictDateValidationService->validateRows($request->documents)` ke `SkDocumentController::bulkRequest()`.
- Commit `2e174b73` (17 Nov 2026): Menghapus konversi `parseIndonesianDate()` di frontend `BulkSkSubmission.tsx` (agar string tanggal Excel dikirim mentah ke backend), menambahkan `DateFormatInfoAlert` & `DateValidationErrorDialog`, **tetapi tidak memisahkan `tanggal_permohonan` (yang berasal dari `<Input type="date">`) dari array `documents[]`**.
- Commit `773569db`: Menambahkan integration test `test_sk_bulk_request_accepts_valid_month_name_dates`, tetapi fixture test tidak menyertakan field `tanggal_permohonan`.

---

### C.3. Hasil Pengujian Eksisting (Baseline)

Menjalankan suite test eksisting pada repository (tanpa perubahan kode):
```powershell
cd backend; php artisan test tests/Unit/Services/StrictDateValidationServiceTest.php tests/Feature/StrictDateImportIntegrationTest.php
```
- **Hasil:** `38 passed (151 assertions)` dalam `3.42s`.
- **Analisis Gap Test:** Seluruh 38 test lulus karena `StrictDateImportIntegrationTest::test_sk_bulk_request_accepts_valid_month_name_dates()` (L352–370) hanya mengirim:
  ```php
  ['nama' => 'Guru SK Valid Date', 'unit_kerja' => ..., 'status' => 'GTY', 'nomor_induk_maarif' => '113400889', 'tmt' => '11 November 2022']
  ```
  Test tersebut tidak merepresentasikan payload nyata dari `BulkSkSubmission.tsx`, yang **selalu** mengirim `tanggal_permohonan: "YYYY-MM-DD"` dan `nomor_permohonan`. Selain itu, tidak ada satu pun test integration yang menguji round-trip `importPreview` → `importCommit` atau menguji file `.xlsx` nyata yang dibaca melalui SheetJS `xlsx@0.18.5`.

---

### C.4. Hasil Eksperimen Reproduksi Terkontrol (Excel Mentah → SheetJS → Normalisasi → Validator)

Pengujian reproduksi dijalankan menggunakan file `.xlsx` terkontrol yang dibuat dengan PhpSpreadsheet (membedakan **Text Cell** dan **Excel Numeric Date Serial Cell** dengan berbagai format tampilan) dan dibaca menggunakan library aktual `xlsx@0.18.5` (`cellDates: false, cellNF: true`, `sheet_to_json(..., { header: 1, raw: false, defval: "" })`) lalu divalidasi oleh `StrictDateValidationService` pada aplikasi Laravel yang di-bootstrap penuh.

#### Tabel 1 — Reproduksi Persis Kasus Pengguna (8 Baris Guru dengan Format Teks Indonesia Valid + UI `tanggal_permohonan = 2026-08-11`)

| Baris Excel | Kolom `Tanggal Lahir` (Excel) | Kolom `TMT` (Excel) | Field UI `tanggal_permohonan` (diinjeksi ke `documents[]`) | Hasil Validasi `Tanggal Lahir` & `TMT` | Hasil Validasi `tanggal_permohonan` | Error yang Dikembalikan Backend |
|---|---|---|---|---|---|---|
| Baris 2 | `03 Agustus 1992` | `15 Juli 2013` | `2026-08-11` | ✅ Valid | ❌ Ditolak | Row 2 \| **Tanggal Permohonan** \| `2026-08-11` \| *Format tanggal numerik dengan tanda hubung ('2026-08-11') tidak diterima...* |
| Baris 3 | `20 Februari 1984` | `02 Desember 2018` | `2026-08-11` | ✅ Valid | ❌ Ditolak | Row 3 \| **Tanggal Permohonan** \| `2026-08-11` \| *(idem)* |
| Baris 4 | `11 Nov 2022` | `01 Juli 2015` | `2026-08-11` | ✅ Valid | ❌ Ditolak | Row 4 \| **Tanggal Permohonan** \| `2026-08-11` \| *(idem)* |
| Baris 5 | `11 November 2022` | `05 Januari 2023` | `2026-08-11` | ✅ Valid | ❌ Ditolak | Row 5 \| **Tanggal Permohonan** \| `2026-08-11` \| *(idem)* |
| Baris 6 | `11 Nopember 2022` | `21 Agu 2024` | `2026-08-11` | ✅ Valid | ❌ Ditolak | Row 6 \| **Tanggal Permohonan** \| `2026-08-11` \| *(idem)* |
| Baris 7 | `12 Mei 1990` | `21 Agustus 2024` | `2026-08-11` | ✅ Valid | ❌ Ditolak | Row 7 \| **Tanggal Permohonan** \| `2026-08-11` \| *(idem)* |
| **Baris 8** | `03 Agustus 1992` | `15 Juli 2013` | `2026-08-11` | ✅ Valid | ❌ Ditolak | **Row 8 \| Tanggal Permohonan \| `2026-08-11`** |
| **Baris 9** | `20 Februari 1984` | `02 Desember 2018` | `2026-08-11` | ✅ Valid | ❌ Ditolak | **Row 9 \| Tanggal Permohonan \| `2026-08-11`** |

> **Kecocokan 100% dengan laporan pengguna:** Total kesalahan = **8 kesalahan tanggal**, kolom bermasalah = **`Tanggal Permohonan`**, nilai ditampilkan = **`2026-08-11`**, rentang baris = **2 s.d. 9** (baris 8 dan 9 merupakan dua baris terakhir pada modal error yang digulir ke bawah).

#### Tabel 2 — Perbandingan Nilai Mentah Excel vs SheetJS (`xlsx@0.18.5`) vs `StrictDateValidationService::validateRows()` (Text Cell vs Excel Date Cell)

| Skenario Sel Excel | Tipe Sel (`cell.t`) | Nilai Mentah Excel (`cell.v`) | Number Format Excel (`cell.z`) | Tampilan Visual di Excel (Locale ID) | Nilai Dibaca SheetJS (`raw: false` / `cell.w`) | Nilai Masuk Validator | Hasil `validateDateString()` | Nilai Normalisasi | Alasan Penolakan (Jika Gagal) |
|---|---|---|---|---|---|---|---|---|---|
| Teks: `03 Agustus 1992` | `s` (String) | `"03 Agustus 1992"` | `General` | `03 Agustus 1992` | `"03 Agustus 1992"` | `"03 Agustus 1992"` | ✅ **VALID** | `1992-08-03` | — |
| Teks: `20 Februari 1984` | `s` (String) | `"20 Februari 1984"` | `General` | `20 Februari 1984` | `"20 Februari 1984"` | `"20 Februari 1984"` | ✅ **VALID** | `1984-02-20` | — |
| Teks: `15 Juli 2013` | `s` (String) | `"15 Juli 2013"` | `General` | `15 Juli 2013` | `"15 Juli 2013"` | `"15 Juli 2013"` | ✅ **VALID** | `2013-07-15` | — |
| Teks: `02 Desember 2018` | `s` (String) | `"02 Desember 2018"` | `General` | `02 Desember 2018` | `"02 Desember 2018"` | `"02 Desember 2018"` | ✅ **VALID** | `2018-12-02` | — |
| Teks: `11 Nopember 1990` | `s` (String) | `"11 Nopember 1990"` | `General` | `11 Nopember 1990` | `"11 Nopember 1990"` | `"11 Nopember 1990"` | ✅ **VALID** | `1990-11-11` | — (distandardisasi ke `November`) |
| Teks: `21 Agu 2024` / `21 Ags 2024` | `s` (String) | `"21 Agu 2024"` | `General` | `21 Agu 2024` | `"21 Agu 2024"` | `"21 Agu 2024"` | ✅ **VALID** | `2024-08-21` | — |
| Teks: `03 Agst 1992` | `s` (String) | `"03 Agst 1992"` | `General` | `03 Agst 1992` | `"03 Agst 1992"` | `"03 Agst 1992"` | ❌ **DITOLAK** | `null` | `Nama bulan 'Agst' tidak dikenali.` |
| Teks: `11-Nov-2022` | `s` (String) | `"11-Nov-2022"` | `General` | `11-Nov-2022` | `"11-Nov-2022"` | `"11-Nov-2022"` | ✅ **VALID** | `2022-11-11` | — (lolos lewat fallback `Carbon::parse`) |
| Teks: `11-Mei-2022` / `11-Agu-2022` / `11-Okt-2022` / `11-Des-2022` | `s` (String) | `"11-Mei-2022"` | `General` | `11-Mei-2022` | `"11-Mei-2022"` | `"11-Mei-2022"` | ❌ **DITOLAK** | `null` | `Gagal menormalisasi tanggal '11-Mei-2022' menggunakan mekanisme baku sistem.` |
| **Excel Date Cell** (`[$-421]dd mmmm yyyy`) | `n` (Serial) | `33819` | `[$-421]dd mmmm yyyy` | `03 Agustus 1992` | `"03 August 1992"` *(Inggris!)* | `"03 August 1992"` | ✅ **VALID** | `1992-08-03` | — (kebetulan lolos karena `august` ada di `MONTH_MAP`) |
| **Excel Date Cell** (`dd mmmm yyyy`) | `n` (Serial) | `30732` | `dd mmmm yyyy` | `20 Februari 1984` | `"20 February 1984"` *(Inggris!)* | `"20 February 1984"` | ✅ **VALID** | `1984-02-20` | — (kebetulan lolos karena `february` ada di `MONTH_MAP`) |
| **Excel Date Cell** (`dd mmm yyyy` — Agustus) | `n` (Serial) | `33819` | `dd mmm yyyy` | `03 Agu 1992` | `"03 Aug 1992"` *(Inggris!)* | `"03 Aug 1992"` | ❌ **DITOLAK** | `null` | `Nama bulan 'Aug' tidak dikenali.` |
| **Excel Date Cell** (`dd mmm yyyy` — Desember) | `n` (Serial) | `43436` | `dd mmm yyyy` | `02 Des 2018` | `"02 Dec 2018"` *(Inggris!)* | `"02 Dec 2018"` | ❌ **DITOLAK** | `null` | `Nama bulan 'Dec' tidak dikenali.` |
| **Excel Date Cell** (`[$-id-ID]dd mmm yyyy` — Oktober) | `n` (Serial) | `33161` | `[$-id-ID]dd mmm yyyy` | `15 Okt 1990` | `"15 Oct 1990"` *(Inggris!)* | `"15 Oct 1990"` | ❌ **DITOLAK** | `null` | `Nama bulan 'Oct' tidak dikenali.` |
| **Excel Date Cell** (`d-mmm-yy` — default Excel) | `n` (Serial) | `44876` | `d-mmm-yy` | `11-Nov-22` | `"11-Nov-22"` | `"11-Nov-22"` | ❌ **DITOLAK** | `null` | `Tahun harus terdiri dari 4 digit ('11-Nov-22').` |
| **Excel Date Cell** (`dd/mm/yyyy`) | `n` (Serial) | `33819` | `dd/mm/yyyy` | `03/08/1992` | `"03/08/1992"` | `"03/08/1992"` | ❌ **DITOLAK** | `null` | `Format tanggal numerik dengan garis miring ('03/08/1992') tidak diterima...` |
| **Excel Date Cell** (`General`) | `n` (Serial) | `43436` | `General` | `43436` | `"43436"` | `"43436"` | ❌ **DITOLAK** | `null` | `Format tanggal numerik atau angka serial Excel tanpa nama bulan tidak diterima ('43436').` |

#### Tabel 3 — Reproduksi Normalisasi-Sebelum-Validasi pada Import Guru (`TeacherController::importPreview` → `importCommit`)

| Tahap | Input Masuk | Proses Backend | Output / Hasil |
|---|---|---|---|
| 1. `POST /api/teachers/import/preview` | `{"nama":"Guru Contoh","tanggal_lahir":"03 Agustus 1992","tmt":"15 Juli 2013"}` | `validateRows()` (0 error) → `parseImportRow()` menormalisasi ke ISO | `previews[0].payload = {"nama":"Guru Contoh","tanggal_lahir":"1992-08-03","tmt":"2013-07-15"}` |
| 2. `POST /api/teachers/import/commit` | `[{"action":"INSERT","payload":{"nama":"Guru Contoh","tanggal_lahir":"1992-08-03","tmt":"2013-07-15"}}]` | `validateRows([$row['payload']])` (L1884) | ❌ **HTTP 422 (2 error)**: menolak `1992-08-03` (Tanggal Lahir) dan `2013-07-15` (TMT) sebagai format numerik bertanda hubung! |

---

## D. Root Cause

### 1. Primary Root Cause (Penyebab Utama Insiden yang Dilaporkan)
**Pencampuran metadata form UI berformat ISO (`tanggal_permohonan` dari `<input type="date">`) ke dalam setiap baris data Excel (`documents[]`) yang kemudian divalidasi secara membabi-buta oleh `StrictDateValidationService::validateRows()` melalui aturan wildcard `str_contains($cleanKey, 'tanggal')`.**

Secara teknis, terdapat tiga mata rantai langsung yang membentuk bug deterministik ini:
1. `BulkSkSubmission.tsx` (L319–324, L411, L481) mewajibkan pengisian `<Input type="date">` (`tanggalPermohonanUi` → selalu menghasilkan ISO `YYYY-MM-DD`, misal `2026-08-11`) dan menyalinnya sebagai properti `tanggal_permohonan` ke setiap elemen array `documents[]`.
2. `SkDocumentController::bulkRequest()` (L1217) meneruskan `$request->documents` langsung ke `StrictDateValidationService::validateRows()` tanpa memisahkan atau mengecualikan field metadata form `tanggal_permohonan` yang bukan berasal dari Excel.
3. `StrictDateValidationService::validateRows()` (L510–519) menggunakan pencocokan substring `str_contains($cleanKey, 'tanggal')`, sehingga otomatis menganggap `tanggal_permohonan` sebagai kolom tanggal Excel, menyintesis label `"Tanggal Permohonan"`, dan menolak nilai ISO `2026-08-11` pada setiap baris (8 baris → 8 error, baris 2 s.d. 9).

### 2. Contributing Factors (Faktor Pendukung & Cacat Laten)
1. **Test coverage blind spot (`StrictDateImportIntegrationTest.php` L352–370):** Integration test untuk `POST /api/sk-documents/bulk-request` tidak menyertakan field `tanggal_permohonan` sebagaimana yang selalu dikirim frontend, sehingga bug 100%-reproducible ini lolos CI/test suite.
2. **Pesan modal error yang menyesatkan (`DateValidationErrorDialog.tsx` L62–75):** UI selalu menampilkan *"Ditemukan N kesalahan tanggal pada file Excel"* dan *"Nilai di Excel"* meskipun kolom yang ditolak (`Tanggal Permohonan`) sama sekali tidak ada di file Excel dan berasal dari `<input type="date">` pada Langkah 3.
3. **Kesenjangan SheetJS vs `MONTH_MAP` pada Excel Date Cell:** Pembacaan Excel dilakukan di browser memakai SheetJS (`raw: false`), yang memformat Excel Date Cell menggunakan nama bulan bahasa Inggris tanpa memperhatikan locale `[$-421]`/`[$-id-ID]`. Karena `StrictDateValidationService::MONTH_MAP` tidak memiliki singkatan Inggris `aug`, `oct`, `dec`, Excel Date Cell berformat `dd mmm yyyy` (yang justru direkomendasikan di `DateFormatInfoAlert.tsx` L41) gagal untuk bulan Agustus, Oktober, dan Desember.
4. **Ketidaksinkronan alias & separator (`Agst` dan `11-Mei-2022`):** `MONTH_MAP` dan `BULAN_MAP` belum mendukung variasi `agst`, dan `NormalizationService::parseIndonesianDate()` hanya mencocokkan pemisah spasi (`\s+`) padahal `StrictDateValidationService` menerima tanda hubung (`[\s\-]+`).
5. **Validasi ulang atas data yang sudah dinormalisasi pada `TeacherController::importCommit()` (L1880–1884):** `importPreview()` menormalisasi tanggal ke `YYYY-MM-DD`, lalu `importCommit()` memvalidasi ulang `payload` hasil preview tersebut dengan `StrictDateValidationService::validateRows()`, sehingga memicu penolakan `YYYY-MM-DD` pada alur Import Guru.
6. **Ketidakakuratan nomor baris potensial:** `validateRows()` mem-hardcode `$startRowIndex = 2`, sementara `BulkSkSubmission.tsx` mendukung header dinamis (`bestRowIndex` 0..14) dan memfilter baris kosong.

### 3. Gejala yang Terlihat oleh Pengguna (User-Visible Symptoms)
- Pengguna mengunggah file Excel `Template_Bulk_SK.xlsx` berisi 8 guru dengan kolom `Tanggal Lahir` dan `TMT` yang seluruhnya sudah berformat nama bulan Indonesia (`03 Agustus 1992`, `20 Februari 1984`, `15 Juli 2013`, `02 Desember 2018`).
- Upload Excel berhasil dan tabel preview 5 guru pertama tampil normal tanpa error.
- Pengguna mengisi Langkah 3 (upload PDF, No. Surat, dan Tgl. Surat = `11/08/2026` pada date picker, yang oleh browser disimpan sebagai `2026-08-11`), lalu menekan **Proses 8 Data**.
- Sistem memunculkan modal **"Format Tanggal Tidak Sesuai!"** yang menyebut *"Ditemukan 8 kesalahan tanggal pada file Excel"*, dengan kolom **`Tanggal Permohonan`**, nilai **`2026-08-11`**, pada baris 2 sampai 9 (baris 8 dan 9 tampak pada tangkapan layar).
- Pengguna kebingungan karena di file Excel tidak ada nilai `2026-08-11` dan seluruh tanggal di kolom `Tanggal Lahir` serta `TMT` sudah menggunakan nama bulan.

---

## E. Why Existing Validation Fails (Jawaban Atas 7 Pertanyaan Investigasi)

1. **Mengapa pesan error menampilkan `2026-08-11` ketika pengguna merasa sudah memasukkan format tanggal dengan nama bulan?**
   Karena `2026-08-11` **tidak berasal dari file Excel**, melainkan dari input UI **Langkah 3 → Tgl. Surat** (`<Input type="date" value={tanggalPermohonanUi} />` di `BulkSkSubmission.tsx` L411). Native `<input type="date">` selalu menghasilkan string ISO `YYYY-MM-DD`, yang kemudian disuntikkan frontend ke properti `tanggal_permohonan` di setiap baris `documents[]` (L323) dan ditangkap oleh wildcard `str_contains($cleanKey, 'tanggal')` di `StrictDateValidationService::validateRows()` (L512).

2. **Apakah terdapat kesalahan pemetaan kolom sehingga validator memeriksa kolom yang tidak semestinya?**
   **Ya.** Pada `BulkSkSubmission.tsx`, `HEADER_MAP` tidak memetakan `tanggal_permohonan` dari Excel; kolom tersebut adalah metadata tingkat form/surat permohonan yang seharusnya berada di root payload request (setara dengan `surat_permohonan_url`), bukan disisipkan ke tiap baris Excel lalu diperiksa oleh validator kolom Excel. Di backend, `validateRows()` memeriksa *semua* key yang mengandung kata `tanggal`, sehingga ikut memvalidasi `tanggal_permohonan` yang memang seharusnya bertipe ISO `YYYY-MM-DD` untuk kolom SQL `DATE`.

3. **Mengapa tanggal yang ditampilkan dalam format nama bulan di Excel masih berpotensi ditolak (di luar kasus `tanggal_permohonan`)?**
   Ada tiga jalur kegagalan yang terbukti secara empiris:
   - **Excel Date Cell berformat `dd mmm yyyy` / `[$-id-ID]dd mmm yyyy`:** Tampilan visual di Excel ber-locale Indonesia adalah `03 Agu 1992`, `15 Okt 1990`, `02 Des 2018`, namun SheetJS `xlsx@0.18.5` (`raw: false`) memformat serial tanggal menggunakan nama bulan Inggris singkat (`03 Aug 1992`, `15 Oct 1990`, `02 Dec 2018`). `StrictDateValidationService::MONTH_MAP` tidak memiliki `aug`, `oct`, `dec`, sehingga ketiganya ditolak.
   - **Variasi ejaan `Agst`:** Meskipun `Agustus`, `Agu`, `Ags`, dan `Nopember` didukung, variasi `Agst` tidak ada di `MONTH_MAP` maupun `BULAN_MAP` sehingga ditolak.
   - **Format bertanda hubung dengan bulan Indonesia (`11-Mei-2022`, `11-Agu-2022`, `11-Okt-2022`, `11-Des-2022`):** Lolos regex struktur di `StrictDateValidationService`, tetapi gagal di `NormalizationService::parseIndonesianDate()` karena regex hanya menerima spasi (`\s+`) dan fallback `Carbon::parse()` tidak mengenal singkatan/nama bulan Indonesia tersebut.

4. **Apakah nilai tanggal yang dibaca backend berbeda dengan tampilan tanggal di Excel?**
   - Untuk **sel bertipe Teks (`cell.t === 's'`)** (seperti `03 Agustus 1992`): **Tidak berbeda** — SheetJS meneruskan string identik ke backend, dan backend menerima format tersebut.
   - Untuk **sel bertipe Excel Date Serial (`cell.t === 'n'`)**: **Ya, berbeda jika bergantung pada locale Indonesia.** Excel menyimpan angka serial (misal `33819`) + format kode (misal `[$-421]dd mmmm yyyy` atau `[$-id-ID]dd mmm yyyy`), lalu merendernya dalam bahasa Indonesia di desktop Excel. SheetJS mengabaikan locale code tersebut dan merendernya dalam bahasa Inggris (`03 August 1992`, `03 Aug 1992`, `15 Oct 1990`, `02 Dec 2018`).

5. **Apakah library Excel mengembalikan nilai tanggal dalam bentuk Date object, serial number Excel, atau string?**
   Pada implementasi aktual (`BulkSkSubmission.tsx` L87–89 & `FileUploadStep.tsx` L68–71), library **SheetJS (`xlsx@0.18.5`)** dipanggil dengan `cellDates: false, cellNF: true` dan `sheet_to_json(..., { raw: false, defval: "" })`:
   - Ia **tidak** mengembalikan JS `Date` object.
   - Ia mengembalikan **formatted string (`cell.w`)** hasil evaluasi `cell.z` oleh SSF engine bawaan SheetJS.
   - Hanya jika format sel adalah `General` (tanpa format tanggal), ia mengembalikan string angka serial mentah (misal `"43436"`).
   - Sementara itu, `maatwebsite/excel` / `PhpSpreadsheet` di backend **tidak digunakan sama sekali** untuk membaca file Excel pada fitur Bulk SK maupun Import Guru/Siswa.

6. **Apakah proses normalisasi tanggal mengubah tanggal menjadi format ISO `YYYY-MM-DD` sebelum validator melakukan pemeriksaan?**
   - **Pada Bulk SK (`BulkSkSubmission.tsx` → `SkDocumentController::bulkRequest`):** **Tidak** untuk kolom Excel (`tanggal_lahir`, `tmt`) — sejak commit `2e174b73`, pemanggilan `parseIndonesianDate()` di frontend sudah dihapus. Nilai `2026-08-11` yang masuk ke validator berasal dari `<input type="date">` (`tanggal_permohonan`), bukan dari normalisasi Excel.
   - **Pada Import Guru (`TeacherController::importPreview` → `importCommit`):** **YA!** `importPreview()` menjalankan `parseImportRow()` yang menormalisasi `tanggal_lahir` dan `tmt` menjadi `YYYY-MM-DD` di dalam `previews[].payload`, lalu `importCommit()` menjalankan `StrictDateValidationService::validateRows()` pada `payload` yang sudah berformat ISO tersebut sehingga validasi pasti gagal 422!

7. **Apakah validasi tanggal menggunakan aturan yang berbeda antara frontend, backend, dan proses import Excel?**
   **Ya, tidak konsisten di 3 titik:**
   - **Frontend Bulk SK (`BulkSkSubmission.tsx`)**: Tidak melakukan validasi format tanggal sama sekali saat upload/preview; hanya mengecek kolom tidak kosong.
   - **Backend Bulk SK (`SkDocumentController::bulkRequest`) vs Individual SK (`submitRequest`)**: Bulk SK memaksakan `StrictDateValidationService::validateRows()` termasuk ke field form `tanggal_permohonan`, sedangkan Individual SK menerima `tanggal_surat_permohonan` berformat ISO `YYYY-MM-DD` langsung dari `<input type="date">` tanpa melewati `StrictDateValidationService`.
   - **Backend `StrictDateValidationService` vs `NormalizationService`**: `StrictDateValidationService::validateCell()` (PhpSpreadsheet) siap menerima Excel Date Cell `dd mmm yyyy` secara langsung, tetapi tidak pernah dipakai karena parsing dilakukan di client via SheetJS; dan regex separator dash `[\s\-]+` di validator tidak didukung oleh regex `\s+` di `NormalizationService::parseIndonesianDate()`.

---

## F. Recommended Remediation

Rekomendasi perbaikan berikut bersifat **minimal, tepat sasaran, dan aman**, **tanpa** menghapus atau melemahkan kebijakan penolakan format tanggal numerik ambigu untuk data Excel.

### Prioritas 1 — Memperbaiki Primary Root Cause (Wajib / P0)
1. **Pisahkan metadata surat permohonan dari per-row Excel payload (atau kecualikan secara eksplisit pada validasi baris Excel):**
   - **Backend (`SkDocumentController::bulkRequest()`):**
     - Terima `tanggal_permohonan` dan `nomor_permohonan` di level root request (dengan validasi Laravel `'tanggal_permohonan' => 'nullable|date_format:Y-m-d'`) sebagai prioritas utama, tetap mempertahankan backward compatibility fallback ke `$doc['tanggal_permohonan']` untuk payload lama.
     - Saat memanggil `$this->strictDateValidationService->validateRows(...)`, berikan parameter/opsi atau filter agar **hanya kolom tanggal yang berasal dari Excel** (`tanggal_lahir`, `tmt`, `tempat_tanggal_lahir`, `ttl`, dll.) yang divalidasi dengan aturan ketat teks-nama-bulan, sedangkan `tanggal_permohonan` (metadata dari `<input type="date">`) divalidasi secara ketat dengan `date_format:Y-m-d` (ISO 8601 yang tidak ambigu dari native date picker).
     - Pastikan juga jika `tanggal_permohonan` masih dikirim di dalam setiap item `$doc`, nilainya divalidasi sebagai `Y-m-d` dan **tidak** diteruskan ke `StrictDateValidationService::validateRows()`.
   - **Frontend (`BulkSkSubmission.tsx`):**
     - Kirim `nomor_permohonan` dan `tanggal_permohonan` di root payload `skApi.bulkRequest({ documents, surat_permohonan_url, nomor_permohonan, tanggal_permohonan, meta })` (bukan diduplikasi ke dalam setiap baris `documents[]`), sehingga batas antara *data Excel* dan *metadata form UI* menjadi bersih dan eksplisit.

### Prioritas 2 — Memperbaiki Cacat Laten yang Terverifikasi (P1)
2. **Dukung singkatan bulan Inggris 3 huruf (`aug`, `oct`, `dec`) & variasi `agst` pada `StrictDateValidationService` & `NormalizationService`:**
   - Tambahkan `'aug' => 8`, `'oct' => 10`, `'dec' => 12`, dan `'agst' => 8` ke `StrictDateValidationService::MONTH_MAP`, `MONTH_ALIASES` (`'aug' => 'Agu'`, `'oct' => 'Okt'`, `'dec' => 'Des'`, `'agst' => 'Agu'`), dan `NormalizationService::BULAN_MAP`.
   - Ini menjaga kebijakan *wajib mencantumkan nama bulan* tetap 100% ketat (tetap menolak `11/12/2022`, `2022-12-11`, serial polos, tahun 2 digit), sekaligus memastikan Excel Date Cell berformat `dd mmm yyyy` yang dibaca SheetJS (yang merender `Aug`/`Oct`/`Dec`) tidak ditolak secara keliru.
3. **Sinkronkan pemisah tanda hubung pada `NormalizationService::parseIndonesianDate()`:**
   - Ubah regex L984 dari `/^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})$/u` menjadi `/^(\d{1,2})[\s\-]+([a-zA-Z]+)[\s\-]+(\d{4})$/u` agar format yang secara eksplisit diizinkan oleh `StrictDateValidationService` (`11-Mei-2022`, `11-Agu-2022`, `11-Okt-2022`, `11-Des-2022`) berhasil dinormalisasi tanpa bergantung pada `Carbon::parse()`.
4. **Perbaiki Normalisasi-Sebelum-Validasi pada `TeacherController::importCommit()`:**
   - Karena `importPreview()` telah memvalidasi format tanggal Excel mentah via `StrictDateValidationService::validateRows()` dan menormalisasinya ke `YYYY-MM-DD` di `payload`, `importCommit()` tidak boleh menjalankan `validateRows()` ulang pada `payload` yang sudah ter-ISO-kan. Sebagai gantinya, validasi `tanggal_lahir` dan `tmt` di `importCommit()` harus menerima ISO `Y-m-d` valid (hasil preview yang sah) atau menandatangani/mempertahankan raw value jika perlu re-validasi, serta pastikan `TeacherListPage.tsx` (L1091) meneruskan error 422 `date_errors` agar `DateValidationErrorDialog` muncul dengan benar.

### Prioritas 3 — Peningkatan Akurasi Laporan Error (P2)
5. **Kirim `header_row_index` / nomor baris fisik Excel dari frontend (`BulkSkSubmission.tsx`):**
   - Sertakan metadata nomor baris fisik Excel (`bestRowIndex + index + 2`) agar saat header tidak berada di baris 1 atau terdapat baris kosong, nomor baris pada tabel error backend selalu 100% akurat terhadap nomor baris fisik di Excel.

---

## G. Regression Test Plan

Setelah perbaikan disetujui dan diterapkan, seluruh skenario pengujian berikut wajib ditambahkan dan lulus:

1. **Feature Test — Bulk SK dengan Payload Realistis Frontend (`StrictDateImportIntegrationTest`):**
   - Submit `POST /api/sk-documents/bulk-request` dengan 8 dokumen berisi `tanggal_lahir` dan `tmt` berformat nama bulan Indonesia (`03 Agustus 1992`, `20 Februari 1984`, `15 Juli 2013`, `02 Desember 2018`, `11 Nopember 2022`, `21 Agst 2024`, `11 Nov 2022`, `11-Mei-2022`) **DAN** `tanggal_permohonan: '2026-08-11'` (baik di root payload maupun fallback per-dokumen) → **HARUS BERHASIL** (HTTP 200 untuk <=3 baris / HTTP 202 queued untuk >3 baris), dan `sk_documents.tanggal_permohonan` tersimpan sebagai `2026-08-11`.
   - Submit `POST /api/sk-documents/bulk-request` dengan `tanggal_permohonan` valid (`2026-08-11`), tetapi 1 baris memiliki `tanggal_lahir: '11/12/2022'` atau `tmt: '2022-12-11'` → **HARUS DITOLAK HTTP 422**, melaporkan hanya 1 kesalahan pada kolom `Tanggal Lahir`/`TMT` (bukan `Tanggal Permohonan`), dan 0 record tersimpan.
   - Submit `POST /api/sk-documents/bulk-request` dengan `tanggal_permohonan` tidak valid (misal `'invalid-date'` atau `'11/08/2026'`) → **HARUS DITOLAK HTTP 422** oleh validasi `date_format:Y-m-d`.

2. **Unit Test — Variasi Bulan & Format (`StrictDateValidationServiceTest`):**
   - Verifikasi `03 Agst 1992`, `21 Agst 2024` → valid, normalized `1992-08-03` / `2024-08-21`.
   - Verifikasi singkatan Inggris hasil SheetJS (`03 Aug 1992`, `15 Oct 1990`, `02 Dec 2018`) → valid, normalized.
   - Verifikasi format bertanda hubung dengan bulan Indonesia (`11-Mei-2022`, `11-Agu-2022`, `11-Okt-2022`, `11-Des-2022`) → valid, normalized.
   - **Preservation Test (Kebijakan Penolakan Tetap Ketat):** Pastikan `11/12/2022`, `11-12-2022`, `11.12.2022`, `2022-12-11`, `12/11/22`, `11 Nov 22`, `11122022`, `44876`, `31 Februari 2023`, `29 Februari 2023`, dan `31 April 2023` **tetap ditolak 100%**.

3. **Frontend / Integration Test — SheetJS Text Cell vs Excel Date Cell (Vitest + Fixture `.xlsx`):**
   - Buat fixture `.xlsx` yang berisi:
     * Text cell: `03 Agustus 1992`, `20 Februari 1984`, `15 Juli 2013`, `02 Desember 2018`, `11 Nopember 2022`, `21 Agst 2024`
     * Excel Date Cell: `[$-421]dd mmmm yyyy`, `dd mmmm yyyy`, `dd mmm yyyy`, `[$-id-ID]dd mmm yyyy` (termasuk bulan Agustus, Oktober, Desember)
     * Excel Date Cell yang wajib ditolak: `dd/mm/yyyy`, `d-mmm-yy`, `General`
   - Verifikasi hasil pembacaan `BulkSkSubmission` dan `FileUploadStep` terhadap kontrak backend.

4. **Feature Test — Round-Trip Import Guru (`importPreview` → `importCommit`):**
   - Panggil `POST /api/teachers/import/preview` dengan tanggal valid (`03 Agustus 1992`, `15 Juli 2013`), ambil `response.json('previews')`, lalu kirim langsung ke `POST /api/teachers/import/commit` → **HARUS BERHASIL HTTP 200** dan tersimpan di database sebagai `1992-08-03` dan `2013-07-15`.

5. **End-to-End Verification (Playwright / Manual Staging):**
   - Upload `Template_Bulk_SK.xlsx` (8 guru), unggah PDF surat permohonan, isi No. Surat dan Tgl. Surat melalui date picker, klik **Proses 8 Data**, dan pastikan pengajuan masuk ke daftar SK tanpa modal error tanggal.

---

## H. Final Verdict

- **Status:** **`ROOT CAUSE IDENTIFIED`**
- **Tingkat Keyakinan:** **Sangat Tinggi (99% — Terbukti secara langsung di kode sumber dan direproduksi 100% identik dengan gejala yang dilaporkan)**
- **Ringkasan Bukti Pendukung:**
  1. Bukti kode langsung di `src/features/sk-management/components/BulkSkSubmission.tsx` (L319–324, L411, L481), `backend/app/Http/Controllers/Api/SkDocumentController.php` (L1217, L1429, L1656), dan `backend/app/Services/StrictDateValidationService.php` (L162–169, L510–535).
  2. Reproduksi terkontrol menghasilkan **tepat 8 error** pada baris **2–9** (termasuk baris 8 dan 9), kolom **`Tanggal Permohonan`**, nilai **`2026-08-11`**, dengan pesan penolakan identik meskipun seluruh tanggal di file Excel (`03 Agustus 1992`, `20 Februari 1984`, `15 Juli 2013`, `02 Desember 2018`) dinyatakan valid oleh validator.
  3. Eksperimen terkontrol pada workbook `.xlsx` (Text Cell vs Excel Date Cell) menggunakan SheetJS `xlsx@0.18.5` dan Laravel bootstrapped membuktikan pula cacat laten terkait `dd mmm yyyy` (`Aug`/`Oct`/`Dec`), `Agst`, `11-Mei-2022`, dan double-validation pada `TeacherController::importPreview` → `importCommit`.
