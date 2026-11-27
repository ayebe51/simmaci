# Laporan Implementasi P0 — Remediation Validasi Tanggal Bulk SK Submission

- **Proyek:** SIMMACI (`simmaci.com`)
- **Tahap:** **P0 — Bulk SK Submission** (Staged Remediation berdasarkan `SK_SUBMISSION_DATE_VALIDATION_RCA.md`)
- **Tanggal:** 26 November 2026
- **Status:** **SELESAI — MENUNGGU EVALUASI & ACCEPTANCE SEBELUM LANJUT KE P1**

---

## 1. Rencana Perubahan Minimal, Daftar File, & Analisis Risiko

### 1.1. Daftar File yang Diubah / Ditambahkan (Khusus Scope P0)

| Jenis | File | Perubahan Minimal |
|---|---|---|
| **Backend (Modified)** | `backend/app/Services/StrictDateValidationService.php` | Menambahkan parameter opsional `array $excludedKeys = []` pada `validateRows()` agar key metadata non-Excel yang sudah divalidasi terpisah tidak ikut tertangkap wildcard `str_contains($cleanKey, 'tanggal')`. |
| **Backend (Modified)** | `backend/app/Http/Controllers/Api/SkDocumentController.php` | (1) Memvalidasi `nomor_permohonan`, `tanggal_permohonan`, dan fallback `documents.*.tanggal_permohonan` secara terpisah menggunakan `nullable|date_format:Y-m-d` dengan pesan khusus formulir. (2) Memanggil `validateRows($request->documents, excludedKeys: ['tanggal_permohonan'])` dan menyertakan `'source' => 'excel'` pada respons 422 Excel. (3) Meneruskan `nomor_permohonan` & `tanggal_permohonan` root ke jalur sync dan queue `ProcessBulkSkSubmission`, dengan fallback ke `$doc[...]` untuk backward compatibility. |
| **Backend (Modified)** | `backend/app/Jobs/ProcessBulkSkSubmission.php` | (1) Menambahkan parameter konstruktor opsional `?string $nomorPermohonan = null` dan `?string $tanggalPermohonan = null` dengan fallback `$doc[...] ?? $this->...`. (2) Memperbaiki bug crash `{$this->documents->count()}` pada baris 444 (ketika `$created % 10 === 0`, `array` tidak memiliki method `count()`) menjadi `count($this->documents)` agar pengajuan 8, 10, 12+ guru diproses tuntas tanpa error. |
| **Frontend (Modified)** | `src/lib/api.ts` | Memperluas tipe `skApi.bulkRequest()` untuk menerima `nomor_permohonan?`, `tanggal_permohonan?`, dan `meta?` pada root payload. |
| **Frontend (Modified)** | `src/features/sk-management/components/BulkSkSubmission.tsx` | (1) Menghapus injeksi `nomor_permohonan` dan `tanggal_permohonan` ke dalam tiap elemen `documents[]`, memindahkannya ke root payload. (2) Menambahkan validasi defensif format `YYYY-MM-DD` pada input form. (3) Membedakan penanganan error 422 formulir (objek validasi Laravel → toast khusus formulir, **tidak** menyalahkan Excel) vs `date_errors` Excel (`source: 'excel'` → modal tabel error Excel). |
| **Frontend (Modified)** | `src/components/common/DateValidationErrorDialog.tsx` | Menambahkan prop opsional `source?: "excel" \| "form"` (default `"excel"` untuk backward compatibility) agar teks dialog, header kolom (`Nilai Input` vs `Nilai di Excel`), dan tombol tidak pernah menyalahkan file Excel bila sumber error adalah formulir. |
| **Backend Test (Added)** | `backend/tests/Feature/BulkSkDateValidationP0Test.php` | 6 feature test baru yang mencakup sync root payload, backward compatibility legacy per-row payload, batch 8 guru (queue + eksekusi job), batch 12 guru (verifikasi bebas crash progress log), penolakan tanggal form tidak valid tanpa menyalahkan Excel, dan preservation penolakan ketat tanggal numerik Excel. |
| **Frontend Test (Added)** | `src/features/sk-management/components/BulkSkSubmission.p0.test.tsx` | 4 Vitest component test baru yang memverifikasi pemisahan root payload 8 guru, sumber pesan `DateValidationErrorDialog` (`source="form"` vs `source="excel"`), dan tampilan toast formulir saat backend mengembalikan 422 pada `tanggal_permohonan`. |

> **Scope Guard:** Tidak ada perubahan pada migration/database, template Excel, P1 Excel Date Parser (`Aug`/`Oct`/`Dec`/`Agst`/dash), maupun P1 Teacher Import Commit (`importPreview`/`importCommit`).

### 1.2. Analisis Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| **Backward compatibility client lama / cache browser** yang masih mengirim `tanggal_permohonan` di dalam tiap elemen `documents[]` | Backend memvalidasi `documents.*.tanggal_permohonan` (`nullable\|date_format:Y-m-d`), mengecualikan `tanggal_permohonan` dari `validateRows()`, dan mempertahankan fallback `$doc['tanggal_permohonan'] ?? $request->input('tanggal_permohonan')` baik di sync maupun queue job. |
| **Job lama di antrian Redis/DB** yang ter-serialize sebelum konstruktor `ProcessBulkSkSubmission` memiliki 2 parameter baru | Kedua parameter baru diletakkan di akhir konstruktor dengan nilai default `= null`, sehingga sepenuhnya backward-compatible. |
| **Pelemahan validasi tanggal Excel** | Aturan `StrictDateValidationService::validateDateString()` tidak diubah sama sekali. Format numerik ambigu (`11/12/2022`, `2022-12-11`, serial polos) pada kolom Excel guru (`Tanggal Lahir`, `TMT`, `TTL`, dll.) tetap ditolak 100% tanpa partial import. |

---

## 2. Bukti Pengujian Sebelum & Sesudah Perbaikan (Before / After)

### 2.1. Pengujian SEBELUM Perbaikan (RED Baseline)

1. **Backend (`php artisan test tests/Feature/BulkSkDateValidationP0Test.php`):**
   - **Hasil:** **6 failed / 6 tests**
   - `test_bulk_sk_sync_accepts_root_tanggal_permohonan_with_valid_indonesian_excel_dates` → **FAIL** (`tanggal_permohonan` dan `nomor_permohonan` tersimpan `null` karena root payload tidak dibaca).
   - `test_bulk_sk_backward_compatible_per_row_tanggal_permohonan_does_not_trigger_excel_error` → **FAIL** (HTTP 422 — menolak `Tanggal Permohonan` = `2026-08-11` pada baris 2 & 3, mereproduksi bug produksi secara eksak).
   - `test_bulk_sk_with_8_teachers_and_tanggal_permohonan_queues_and_processes_all_8_rows` → **FAIL** (`ProcessBulkSkSubmission` belum memiliki properti `nomorPermohonan`/`tanggalPermohonan`).
   - `test_bulk_sk_with_12_teachers_processes_all_without_progress_log_crash` → **FAIL** (`ActivityLog` mencatat `"12 permohonan dibuat, 1 dilewati"` akibat crash `$this->documents->count()` pada guru ke-10).
   - `test_bulk_sk_rejects_invalid_form_tanggal_permohonan_as_form_error_not_excel_error` → **FAIL** (HTTP 200 alih-alih 422 karena root `tanggal_permohonan` tidak divalidasi).
   - `test_bulk_sk_still_strictly_rejects_ambiguous_numeric_dates_in_excel_teacher_rows` → **FAIL** (respons 422 belum menyertakan `'source' => 'excel'`).

2. **Frontend (`npx vitest run src/features/sk-management/components/BulkSkSubmission.p0.test.tsx`):**
   - **Hasil:** **2 failed | 2 passed (4 tests)**
   - `does NOT blame Excel when source='form'` → **FAIL** (dialog tetap menampilkan teks *"kesalahan tanggal pada file Excel"*).
   - `sends tanggal_permohonan and nomor_permohonan at root level` → **FAIL** (`sentPayload.nomor_permohonan` adalah `undefined` karena disuntikkan ke tiap elemen `documents[]`).

### 2.2. Pengujian SESUDAH Perbaikan (GREEN Verification)

1. **Backend P0 + Full Related Regression Suite:**
   ```powershell
   cd backend; php artisan test tests/Feature/BulkSkDateValidationP0Test.php tests/Feature/BulkSkRequestTest.php tests/Feature/StrictDateImportIntegrationTest.php tests/Unit/Services/StrictDateValidationServiceTest.php tests/Unit/SkDocumentNotificationTest.php tests/Feature/BulkSkImportPreservationTest.php tests/Feature/NormalizationIntegrationTest.php
   ```
   - **Hasil:** **79 passed (342 assertions), 0 failed** (`12.87s`):
     - `Tests\Feature\BulkSkDateValidationP0Test`: **6/6 passed**
     - `Tests\Feature\BulkSkRequestTest`: **10/10 passed**
     - `Tests\Feature\StrictDateImportIntegrationTest`: **11/11 passed**
     - `Tests\Unit\Services\StrictDateValidationServiceTest`: **27/27 passed**
     - `Tests\Unit\SkDocumentNotificationTest`: **3/3 passed**
     - `Tests\Feature\BulkSkImportPreservationTest`: **10/10 passed**
     - `Tests\Feature\NormalizationIntegrationTest`: **12/12 passed**

2. **Frontend P0 + Date Utility Regression Suite:**
   ```powershell
   npx vitest run src/features/sk-management/components/BulkSkSubmission.p0.test.tsx src/features/sk-management/utils/parseIndonesianDate.test.ts
   ```
   - **Hasil:** **51 passed (2 test files), 0 failed** (`7.17s`):
     - `src/features/sk-management/components/BulkSkSubmission.p0.test.tsx`: **4/4 passed**
     - `src/features/sk-management/utils/parseIndonesianDate.test.ts`: **47/47 passed**

3. **TypeScript Verification pada File P0:**
   - Menjalankan `npx tsc -p tsconfig.app.json --noEmit` dan memverifikasi tidak ada satu pun error TypeScript pada file yang diubah/ditambahkan (`BulkSkSubmission.tsx`, `DateValidationErrorDialog.tsx`, `src/lib/api.ts`, `BulkSkSubmission.p0.test.tsx`).

---

## 3. Verifikasi Acceptance Criteria P0

| No | Acceptance Criteria | Status | Bukti |
|---|---|---|---|
| 1 | Root cause telah ditangani | ✅ Terpenuhi | `tanggal_permohonan` dipisahkan ke root payload & dikecualikan dari `validateRows()` Excel; divalidasi terpisah sebagai `date_format:Y-m-d`; bug crash progress log 10+ guru di `ProcessBulkSkSubmission` ikut diperbaiki. |
| 2 | Test sebelum dan sesudah perbaikan tersedia | ✅ Terpenuhi | 6 backend tests & 4 frontend tests diverifikasi RED sebelum fix dan GREEN seluruhnya sesudah fix. |
| 3 | Regression test terkait lulus | ✅ Terpenuhi | 79/79 backend tests (342 assertions) & 51/51 frontend tests lulus tanpa kegagalan. |
| 4 | Tidak ada perubahan perilaku pada fitur di luar scope | ✅ Terpenuhi | `git diff --stat` menunjukkan tepat 6 file P0 diubah (`+97 / -25` baris); tidak menyentuh P1, migration, template Excel, maupun fitur lain. |
| 5 | Tidak ada penurunan kualitas validasi keamanan maupun integritas data | ✅ Terpenuhi | Format numerik ambigu (`11/12/2022`, `2022-12-11`) di Excel tetap ditolak HTTP 422 tanpa partial import; input form `tanggal_permohonan` tidak valid (`11/08/2026`, `2026-02-30`, teks) ditolak HTTP 422 sebagai error formulir. |

---

## 4. Keputusan Selanjutnya

Tahap **P0 — Bulk SK Submission** telah selesai dan seluruh pengujian terverifikasi hijau. Sesuai tata kelola **Staged Remediation**, pengerjaan **P1 (Excel Date Parser & Teacher Import Commit)** belum dimulai. Mohon evaluasi dan konfirmasi acceptance P0 sebelum melanjutkan ke tahap P1.
