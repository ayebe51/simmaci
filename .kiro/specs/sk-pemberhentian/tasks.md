# Implementation Plan: SK Pemberhentian

## Overview

Implementasi fitur SK Pemberhentian yang menambahkan jenis dokumen baru (`jenis_sk = "Pemberhentian"`) ke dalam modul SK Management yang sudah ada. Fitur mengikuti alur kerja yang identik dengan SK Pengangkatan dan Mutasi: operator mengajukan → admin yayasan menyetujui/menolak → dokumen DOCX di-generate → verifikasi via QR code.

Perbedaan utama:
- Field tambahan: `alasan_pemberhentian`, `keterangan_pemberhentian`, `tanggal_efektif_pemberhentian`
- Side effect saat approve: `teachers.is_active = false` + record `teacher_mutations`
- Template DOCX tersendiri: `sk_type = "pemberhentian"`
- Service baru: `SkPemberhentianService`

Pendekatan implementasi:
1. **Database** — migration menambah 3 kolom ke `sk_documents`
2. **Backend Service** — `SkPemberhentianService` enkapsulasi logika bisnis pemberhentian
3. **Backend Controller** — integrasi service ke `SkDocumentController` (submit, update, batch)
4. **Frontend Submission** — field pemberhentian di `SkSubmissionPage`
5. **Frontend Generator** — template + placeholder di `SkGeneratorPage`
6. **Frontend Template** — opsi pemberhentian di `SkTemplateManagementPage`
7. **Frontend Verification** — tampil field pemberhentian di `VerifySkPage`
8. **Tests** — unit, property-based, dan integrasi

---

## Tasks

- [ ] 1. Database Migration — Tambah Kolom Pemberhentian ke `sk_documents`
  - [ ] 1.1 Buat migration file baru
    - Buat file `backend/database/migrations/2026_xx_xx_000001_add_pemberhentian_fields_to_sk_documents_table.php`
    - Tambahkan kolom `alasan_pemberhentian` (string, nullable) dengan comment enum valid
    - Tambahkan kolom `keterangan_pemberhentian` (text, nullable) setelah `alasan_pemberhentian`
    - Tambahkan kolom `tanggal_efektif_pemberhentian` (date, nullable) setelah `keterangan_pemberhentian`
    - Implementasikan method `down()` yang drop ketiga kolom tersebut
    - _Requirements: 1.2, 1.3, 1.4_

  - [ ] 1.2 Update model `SkDocument`
    - Tambahkan `alasan_pemberhentian`, `keterangan_pemberhentian`, `tanggal_efektif_pemberhentian` ke array `$fillable` di `backend/app/Models/SkDocument.php`
    - Tambahkan cast `'tanggal_efektif_pemberhentian' => 'date'` ke method `casts()`
    - _Requirements: 1.7_

- [ ] 2. Backend — `SkPemberhentianService`
  - [ ] 2.1 Buat class `SkPemberhentianService`
    - Buat file `backend/app/Services/SkPemberhentianService.php`
    - Implementasikan method `validateSubmission(array $data, int $schoolId, string $tahunAjaran): ?array` sebagai extension point (mengembalikan `null` jika valid)
    - Implementasikan method `onApproved(SkDocument $sk, User $approver): void`:
      - Guard awal: jika `$sk->teacher_id` null atau `$sk->teacher` null, `return` dini
      - `$teacher->update(['is_active' => false])`
      - `TeacherMutation::create(['teacher_id', 'school_id', 'from_unit', 'to_unit' => null, 'reason', 'sk_number', 'effective_date', 'performed_by'])`
      - `ActivityLog::log(...)` — pesan berbeda untuk alasan `meninggal_dunia` vs alasan lain, event `deactivate_teacher_pemberhentian`
    - Pastikan service tidak melempar exception ketika `teacher_id` null
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 8.2_

  - [ ] 2.2 Buat Form Request `StoreSkPemberhentianRequest`
    - Buat file `backend/app/Http/Requests/SkDocument/StoreSkPemberhentianRequest.php`
    - Implementasikan rules:
      - `alasan_pemberhentian`: `required|string|in:pengunduran_diri,pensiun,meninggal_dunia,pelanggaran_disiplin,habis_kontrak,lainnya`
      - `keterangan_pemberhentian`: `nullable|required_if:alasan_pemberhentian,lainnya|string|max:1000`
      - `tanggal_efektif_pemberhentian`: `required|date|after_or_equal:` + `now()->subYear()->toDateString()`
      - Field umum (nama, unit_kerja, nuptk, nip, dll.) sesuai desain
    - Implementasikan messages() dengan pesan error dalam Bahasa Indonesia
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ] 3. Backend — Integrasi ke `SkDocumentController`
  - [ ] 3.1 Inject `SkPemberhentianService` ke constructor
    - Tambahkan `private \App\Services\SkPemberhentianService $pemberhentianService` ke constructor `SkDocumentController`
    - _Requirements: 1.7_

  - [ ] 3.2 Update method `submitRequest` — validasi dan simpan field pemberhentian
    - Setelah blok PNS auto-rejection yang sudah ada, tambahkan blok kondisional `if ($data['jenis_sk'] === 'Pemberhentian')`
    - Di dalam blok: buat instance `StoreSkPemberhentianRequest` via `createFrom($request)` dan panggil `validateResolved()`
    - Tambahkan `alasan_pemberhentian`, `keterangan_pemberhentian`, `tanggal_efektif_pemberhentian` ke `$data`
    - Saat `SkDocument::create()`, sertakan tiga field pemberhentian tersebut (null-safe dengan `?? null`)
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11_

  - [ ] 3.3 Update method `update` — trigger deaktivasi guru saat approve
    - Setelah blok pembuatan `ApprovalHistory` yang sudah ada, tambahkan:
      ```php
      if ($oldStatus !== $newStatus && $newStatus === 'approved' && $skDocument->jenis_sk === 'Pemberhentian') {
          $this->pemberhentianService->onApproved($skDocument->fresh()->load('teacher'), $request->user());
      }
      ```
    - _Requirements: 5.1, 5.2, 5.4, 8.2_

  - [ ] 3.4 Update method `batchUpdateStatus` — trigger deaktivasi guru (batch)
    - Di dalam `DB::transaction`, setelah `$succeeded[] = $sk->id`, tambahkan:
      ```php
      if ($isApproved && $sk->jenis_sk === 'Pemberhentian') {
          $this->pemberhentianService->onApproved($sk, $user);
      }
      ```
    - _Requirements: 2.6, 5.1, 5.4_

  - [ ] 3.5 Update method `update` — sertakan field pemberhentian di `$skDocument->update()`
    - Tambahkan `alasan_pemberhentian`, `keterangan_pemberhentian`, `tanggal_efektif_pemberhentian` ke array `$request->only([...])` yang sudah ada
    - _Requirements: 1.7_

- [ ] 4. Backend — Tests
  - [ ] 4.1 Buat unit test `SkPemberhentianServiceTest`
    - Buat file `backend/tests/Unit/Services/SkPemberhentianServiceTest.php`
    - Test `onApproved_sets_teacher_inactive_and_creates_mutation`: SK approve → `is_active = false`, `TeacherMutation` dibuat dengan field yang benar
    - Test `onApproved_does_nothing_when_teacher_id_is_null`: SK tanpa teacher_id → tidak ada exception, tidak ada mutation dibuat
    - Test `onApproved_logs_meninggal_dunia_with_special_description`: alasan `meninggal_dunia` → activity log mengandung "meninggal dunia"
    - Test `reject_does_not_change_teacher_is_active`: reject SK → `is_active` teacher tidak berubah (diverifikasi di controller test, bukan service)
    - _Requirements: 5.1, 5.2, 5.4, 8.2_

  - [ ] 4.2 Buat property-based test `SkPemberhentianServicePropertyTest`
    - Buat file `backend/tests/Unit/Services/SkPemberhentianServicePropertyTest.php`
    - Gunakan library `eris/eris` untuk PHP property-based testing
    - **Property 6** (`test_property_approve_sets_inactive_reject_preserves`): untuk semua kombinasi `initial_is_active` (bool) dan `alasan` (dari enum), setelah `onApproved()` dipanggil, `teacher.is_active` harus selalu `false`
    - **Property 7** (`test_property_approve_creates_teacher_mutation`): untuk semua kombinasi `alasan` dan `tanggal_efektif`, setelah `onApproved()`, harus ada tepat satu `TeacherMutation` dengan `teacher_id`, `sk_number`, `reason`, `effective_date` yang cocok
    - _Requirements: 5.1, 5.4_

  - [ ] 4.3 Buat feature test `SkPemberhentianSubmissionTest`
    - Buat file `backend/tests/Feature/SkPemberhentianSubmissionTest.php`
    - Test: submit dengan data valid → HTTP 201, record dibuat dengan `jenis_sk = "Pemberhentian"` dan field pemberhentian terisi
    - Test: submit tanpa `alasan_pemberhentian` → HTTP 422
    - Test: submit dengan `alasan_pemberhentian = "lainnya"` tanpa `keterangan_pemberhentian` → HTTP 422
    - Test: submit dengan `tanggal_efektif` lebih dari 1 tahun ke belakang → HTTP 422
    - Test: submit dengan `alasan_pemberhentian` di luar enum → HTTP 422
    - Test: submit PNS (nip 18 digit) → pengajuan ditolak otomatis
    - Test: operator submit ke sekolah lain → HTTP 403
    - Test: duplikat pending ditolak → HTTP 422 dengan `existing_nomor_sk` di response
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.10, 1.11_

  - [ ] 4.4 Buat feature test `SkPemberhentianApprovalTest`
    - Buat file `backend/tests/Feature/SkPemberhentianApprovalTest.php`
    - Test: approve SK Pemberhentian → `teacher.is_active = false`, `TeacherMutation` dibuat, `ApprovalHistory` dibuat, notifikasi ke operator dibuat
    - Test: reject SK Pemberhentian → status `rejected`, `teacher.is_active` tidak berubah, `ApprovalHistory` dibuat
    - Test: operator mencoba approve/reject → HTTP 403
    - Test: batch approve beberapa SK Pemberhentian → semua guru terkait di-nonaktifkan
    - Test: approve SK Pemberhentian tanpa teacher_id → tidak ada error, tidak ada mutation
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 5.1, 5.3, 5.4, 8.2, 8.4_

  - [ ] 4.5 Buat property-based feature test `SkPemberhentianSubmissionPropertyTest`
    - Buat file `backend/tests/Feature/SkPemberhentianSubmissionPropertyTest.php`
    - **Property 3** (`test_property_pns_always_rejected`): untuk semua NIP 18 digit, pengajuan selalu ditolak
    - **Property 4** (`test_property_tanggal_efektif_boundary`): tanggal `< today - 365 hari` → HTTP 422; tanggal `>= today - 365 hari` → lolos validasi tanggal
    - **Property 5** (`test_property_alasan_enum_validation`): nilai di luar enum → HTTP 422; nilai dalam enum → lolos
    - _Requirements: 1.3, 1.5, 1.11_

- [ ] 5. Checkpoint — Verifikasi Backend
  - Jalankan `php artisan test` dari direktori `backend/`, pastikan semua test lulus
  - Jalankan migration: `php artisan migrate`

- [ ] 6. Frontend — `SkSubmissionPage.tsx` — Field Pemberhentian
  - [ ] 6.1 Tambahkan konstanta dan tipe `AlasanPemberhentian`
    - Tambahkan konstanta `ALASAN_PEMBERHENTIAN_OPTIONS` dengan 6 opsi (pengunduran_diri, pensiun, meninggal_dunia, pelanggaran_disiplin, habis_kontrak, lainnya) dan label Bahasa Indonesia
    - Tambahkan tipe `AlasanPemberhentian` (union type dari 6 nilai enum)
    - _Requirements: 1.3_

  - [ ] 6.2 Perbarui Zod schema form dengan field pemberhentian
    - Tambahkan `alasan_pemberhentian`, `keterangan_pemberhentian`, `tanggal_efektif_pemberhentian` ke schema
    - Tambahkan tiga `.refine()` rule:
      - Jika `jenis_sk === "Pemberhentian"`, maka `alasan_pemberhentian` wajib
      - Jika `jenis_sk === "Pemberhentian"`, maka `tanggal_efektif_pemberhentian` wajib
      - Jika `alasan_pemberhentian === "lainnya"`, maka `keterangan_pemberhentian` wajib
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6_

  - [ ] 6.3 Tambahkan opsi `"Pemberhentian"` ke dropdown `jenis_sk`
    - Temukan dropdown `jenis_sk` yang sudah ada dan tambahkan `<SelectItem value="Pemberhentian">Pemberhentian</SelectItem>`
    - _Requirements: 1.1_

  - [ ] 6.4 Tambahkan blok JSX field pemberhentian (conditional)
    - Tambahkan blok `{watchedJenisSk === 'Pemberhentian' && (...)}` setelah dropdown jenis_sk
    - Blok berisi: `FormField` untuk `alasan_pemberhentian` (Select dengan 6 opsi), `FormField` untuk `keterangan_pemberhentian` (Textarea, tampil hanya saat alasan = lainnya), `FormField` untuk `tanggal_efektif_pemberhentian` (Input type="date" dengan min attribute = today-365 hari)
    - Tambahkan styling `border-l-2 border-red-200 pl-4` pada wrapper div untuk pembeda visual
    - _Requirements: 1.2, 1.3, 1.4, 1.5_

  - [ ] 6.5 Sertakan field pemberhentian di payload POST
    - Pastikan `alasan_pemberhentian`, `keterangan_pemberhentian`, `tanggal_efektif_pemberhentian` ikut disertakan dalam payload submit ke `/api/sk-documents/submit-request` hanya ketika `jenis_sk === "Pemberhentian"`
    - _Requirements: 1.7_

  - [ ] 6.6 Tambahkan peringatan guru non-aktif saat submit SK baru
    - Saat operator submit SK (jenis apapun), jika data guru yang dipilih memiliki `is_active = false` di response teacher lookup, tampilkan Dialog konfirmasi dengan peringatan bahwa guru sudah diberhentikan
    - Lanjutkan submit hanya jika operator mengklik "Konfirmasi Tetap Ajukan"
    - _Requirements: 5.5_

- [ ] 7. Frontend — `SkGeneratorPage.tsx` — Template dan Placeholder Pemberhentian
  - [ ] 7.1 Tambahkan hook `useSkTemplate('pemberhentian')`
    - Deklarasikan `const skTemplatePemberhentian = useSkTemplate('pemberhentian')` di samping hook template yang sudah ada
    - Tambahkan `sk_template_pemberhentian: skTemplatePemberhentian` ke record `skTemplateByType`
    - _Requirements: 3.2_

  - [ ] 7.2 Tambahkan logika pemilihan template untuk Pemberhentian
    - Di blok penentuan `templateId`, tambahkan pengecekan di awal (sebelum logika GTY/GTT/Tendik):
      ```tsx
      if (jenis.includes('pemberhentian')) {
        templateId = 'sk_template_pemberhentian'
      }
      ```
    - _Requirements: 3.2, 3.3_

  - [ ] 7.3 Tambahkan helper `formatAlasanPemberhentian`
    - Tambahkan fungsi helper `formatAlasanPemberhentian(alasan?: string): string` dengan mapping dari 6 nilai enum ke label Bahasa Indonesia
    - Fallback ke nilai asli jika tidak ada di mapping, atau `"-"` jika undefined
    - _Requirements: 3.4_

  - [ ] 7.4 Tambahkan placeholder pemberhentian ke `renderData`
    - Di dalam blok `renderData`, tambahkan:
      - `"ALASAN_PEMBERHENTIAN"`: `formatAlasanPemberhentian(t.alasan_pemberhentian)`
      - `"KETERANGAN_PEMBERHENTIAN"`: `t.keterangan_pemberhentian || "-"`
      - `"TANGGAL_EFEKTIF"`: `formatDateIndo(t.tanggal_efektif_pemberhentian) || "-"`
      - `"TANGGAL EFEKTIF"`: alias dengan spasi
      - `"TANGGAL_EFEKTIF_PEMBERHENTIAN"`: alias lengkap
    - _Requirements: 3.4, 3.5, 3.6_

  - [ ] 7.5 Tampilkan error saat template pemberhentian tidak tersedia
    - Di dalam blok generate, setelah pemilihan template, tambahkan pengecekan: jika `templateId === 'sk_template_pemberhentian'` dan `hookResult?.error` ada atau `templateUrl` null, tampilkan `toast.error("Template SK Pemberhentian tidak tersedia. Unggah dan aktifkan template terlebih dahulu.")`
    - _Requirements: 3.3_

- [ ] 8. Frontend — `SkTemplateManagementPage.tsx` — Tambah Tipe Pemberhentian
  - [ ] 8.1 Tambahkan `pemberhentian` ke konstanta `SK_TYPES`
    - Tambahkan `{ value: 'pemberhentian', label: 'Pemberhentian', fullLabel: 'SK Pemberhentian' }` ke array `SK_TYPES`
    - _Requirements: 4.1, 4.5_

  - [ ] 8.2 Tambahkan `'pemberhentian'` ke Zod enum `uploadFormSchema`
    - Perbarui `z.enum(['gty', 'gtt', 'kamad', 'tendik', 'surat_permohonan'])` menjadi `z.enum(['gty', 'gtt', 'kamad', 'tendik', 'surat_permohonan', 'pemberhentian'])`
    - _Requirements: 4.1, 4.3_

- [ ] 9. Frontend — `VerifySkPage.tsx` — Tampil Field Pemberhentian
  - [ ] 9.1 Tambahkan rendering kondisional untuk field pemberhentian
    - Tambahkan helper `formatAlasanPemberhentian` (atau import dari lokasi shared) ke file `VerifySkPage.tsx`
    - Tambahkan blok kondisional: jika `skData.alasan_pemberhentian` ada, tampilkan label "Alasan Pemberhentian" dengan nilai yang sudah diformat
    - Tambahkan blok kondisional: jika `skData.tanggal_efektif_pemberhentian` ada, tampilkan label "Tanggal Efektif" dengan format tanggal Indonesia
    - _Requirements: 6.1, 6.2_

- [ ] 10. Frontend — TypeScript Types
  - [ ] 10.1 Update interface `SkDocument` dengan field pemberhentian
    - Tambahkan ke interface `SkDocument` (di `src/types/` atau file terkait):
      - `alasan_pemberhentian?: AlasanPemberhentian | null`
      - `keterangan_pemberhentian?: string | null`
      - `tanggal_efektif_pemberhentian?: string | null`
    - Definisikan type `AlasanPemberhentian` jika belum ada di level types
    - _Requirements: 1.2, 1.3, 1.4_

- [ ] 11. Frontend — Tests
  - [ ] 11.1 Buat unit test `SkSubmissionPage.test.tsx`
    - Buat atau update file `src/features/sk-management/__tests__/SkSubmissionPage.test.tsx`
    - Test: render form dengan `jenis_sk = "Pemberhentian"` → field alasan, keterangan, tanggal_efektif muncul
    - Test: render form dengan `jenis_sk = "GTY"` → field pemberhentian tidak muncul
    - Test: pilih alasan = `"lainnya"` → field keterangan muncul; pilih alasan lain → field keterangan disembunyikan
    - Test: submit form tanpa `alasan_pemberhentian` saat `jenis_sk = "Pemberhentian"` → error validasi muncul
    - Test: submit form tanpa `tanggal_efektif_pemberhentian` → error validasi muncul
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6_

  - [ ] 11.2 Buat property-based test `skPemberhentianGenerator.property.test.ts`
    - Buat file `src/features/sk-management/__tests__/skPemberhentianGenerator.property.test.ts`
    - Gunakan `fast-check` (sudah tersedia sebagai dependency)
    - **Property 8** (`selalu memilih template pemberhentian untuk jenis Pemberhentian`): untuk semua kombinasi jenis_sk yang mengandung "pemberhentian" (case-insensitive), `pendidikan_terakhir`, `tmt`, `nama` — template selection harus selalu menghasilkan `"sk_template_pemberhentian"`, bukan GTY/GTT/Tendik
    - **Property 9** (`filter jenis_sk tidak mengandung jenis lain`): untuk semua array SK dengan jenis_sk campuran, filter `jenis_sk === "Pemberhentian"` tidak boleh mengembalikan record jenis lain
    - _Requirements: 3.2, 7.1, 7.2_

- [ ] 12. Checkpoint Akhir — Verifikasi Fitur Lengkap
  - Jalankan `php artisan test` dari direktori `backend/` — semua test harus lulus
  - Jalankan `npm run test` di root — semua test frontend harus lulus
  - Jalankan `npm run lint` — tidak ada ESLint error
  - Verifikasi alur lengkap secara manual jika environment tersedia: submit → approve → generate → verify

---

## Notes

- Tidak ada perubahan DDL pada tabel `teachers` (field `is_active` sudah ada) dan `teacher_mutations` (semua kolom sudah ada)
- `sk_templates`: tidak ada migration — `sk_type = 'pemberhentian'` adalah nilai data, ditambahkan via UI upload template
- Format penomoran SK Pemberhentian menggunakan format yang sama dengan SK lain — tidak ada state baru di Generator
- Template pemberhentian fallback ke `/templates/sk-pemberhentian-template.docx` jika tidak ada template aktif di database
- Helper `formatAlasanPemberhentian` dibutuhkan di dua tempat (SkGeneratorPage dan VerifySkPage) — pertimbangkan extract ke `src/features/sk-management/utils/formatAlasan.ts` untuk reuse
- Properti `{PERIODE}` di template pemberhentian akan bernilai `0` jika `tmt` kosong — ini aman, template pemberhentian cukup tidak menyertakan placeholder `{PERIODE}`
- Validasi duplikat menggunakan kombinasi `(nama + jenis_sk + school_id + tahun_ajaran)` — sudah diimplementasikan di `submitRequest` yang ada, tinggal memastikan logika ini juga meng-cover jenis_sk = "Pemberhentian"
- Property-based test backend menggunakan `eris/eris`; pastikan sudah ada di `composer.json` dev-dependencies sebelum task 4.2

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1", "2.2"] },
    { "id": 2, "tasks": ["3.1"] },
    { "id": 3, "tasks": ["3.2", "3.5"] },
    { "id": 4, "tasks": ["3.3", "3.4"] },
    { "id": 5, "tasks": ["4.1", "4.2", "4.3"] },
    { "id": 6, "tasks": ["4.4", "4.5", "10.1"] },
    { "id": 7, "tasks": ["5"] },
    { "id": 8, "tasks": ["6.1", "6.2", "6.3"] },
    { "id": 9, "tasks": ["6.4", "6.5", "6.6", "7.1", "7.2", "7.3", "8.1", "8.2", "9.1"] },
    { "id": 10, "tasks": ["7.4", "7.5"] },
    { "id": 11, "tasks": ["11.1", "11.2"] },
    { "id": 12, "tasks": ["12"] }
  ]
}
```
