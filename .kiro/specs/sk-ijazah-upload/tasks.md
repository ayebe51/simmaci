# Rencana Implementasi: Upload Scan PDF Ijazah pada Revisi SK

## Overview

Implementasi fitur upload scan PDF ijazah pada alur revisi SK. Mencakup migrasi database, validasi backend, komponen frontend baru, dan integrasi ke halaman revisi yang sudah ada.

## Tasks

- [x] 1. Migrasi database dan update model SkDocument
  - Buat file migration Laravel untuk menambah kolom `ijazah_url` (string, nullable, max 500) pada tabel `sk_documents`
  - Tambahkan `ijazah_url` ke array `$fillable` pada model `SkDocument`
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 2. Validasi backend pada FileUploadController dan SkDocumentController
  - [x] 2.1 Update `FileUploadController::upload()` dengan validasi kondisional untuk folder `ijazah`
    - Jika `folder` diawali `"ijazah"`, validasi MIME harus `application/pdf` dan ukuran maks 5120 KB
    - Jika folder lain, gunakan validasi default (maks 10240 KB)
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 2.2 Tulis property test untuk validasi backend PDF (Property 11)
    - **Property 11: Validasi backend PDF bersifat universal**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**

  - [x] 2.3 Update `SkDocumentController::update()` dengan validasi dan penerimaan field `ijazah_url`
    - Tambahkan `'ijazah_url' => 'nullable|string|max:500'` ke validasi request
    - Tambahkan `'ijazah_url'` ke dalam `$request->only([...])`
    - _Requirements: 6.5, 6.6, 3.1, 3.4_

  - [x] 2.4 Tulis property test untuk validasi panjang ijazah_url (Property 12)
    - **Property 12: Validasi panjang ijazah_url di backend**
    - **Validates: Requirements 6.5, 6.6**

  - [x] 2.5 Tulis property test untuk round-trip penyimpanan ijazah_url (Property 7)
    - **Property 7: Penyimpanan ijazah_url adalah round-trip**
    - **Validates: Requirements 3.2**

  - [x] 2.6 Tulis property test untuk update tanpa ijazah_url tidak mengubah nilai tersimpan (Property 8)
    - **Property 8: Update tanpa ijazah_url tidak mengubah nilai tersimpan**
    - **Validates: Requirements 3.4**

- [x] 3. Checkpoint — Pastikan semua test backend lulus
  - Pastikan semua test lulus, tanyakan ke user jika ada pertanyaan.

- [x] 4. Buat utilitas `detectGelarChange` di frontend
  - Buat file `src/features/sk-management/utils/detectGelarChange.ts`
  - Implementasikan fungsi `hasGelar(nama: string): boolean` dengan `GELAR_PATTERN`
  - Implementasikan fungsi `detectGelarChange(currentNama, originalNama, currentPendidikan, originalPendidikan)` yang mengembalikan `{ isGelarChange, isPendidikanChange }`
  - _Requirements: 2.2, 2.1_

  - [x] 4.1 Tulis property test untuk deteksi gelar akademik (Property 4)
    - **Property 4: Deteksi gelar akademik bersifat universal**
    - **Validates: Requirements 2.2**

- [-] 5. Buat komponen `IjazahUploadField`
  - Buat file `src/features/sk-management/components/IjazahUploadField.tsx`
  - Implementasikan props: `value`, `onChange`, `isGelarChange`, `isPendidikanChange`, `schoolId`, `disabled`
  - State internal: `uploadState ('idle' | 'uploading' | 'success' | 'error')`, `fileName`, `errorMessage`
  - Validasi client-side: tipe PDF dan ukuran ≤ 5 MB sebelum upload
  - Upload ke `POST /api/media/upload` dengan `folder = "ijazah/{schoolId}"` via `apiClient`
  - Tampilkan nama file dan tombol hapus saat upload berhasil
  - Tampilkan indikator loading selama upload berlangsung
  - Tampilkan pesan error dan izinkan retry jika upload gagal
  - Tampilkan keterangan format "PDF, maks. 5 MB" di bawah komponen
  - Tampilkan label/peringatan kontekstual berdasarkan `isGelarChange` dan `isPendidikanChange`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 2.1, 2.2, 2.5_

  - [x] 5.1 Tulis property test untuk validasi tipe dan ukuran file (Property 1 & 2)
    - **Property 1: Validasi tipe file PDF bersifat universal**
    - **Property 2: Validasi ukuran file bersifat universal**
    - **Validates: Requirements 1.2, 1.3, 1.4**

  - [x] 5.2 Tulis property test untuk hapus file mereset state form (Property 3)
    - **Property 3: Hapus file mereset state form**
    - **Validates: Requirements 1.8**

  - [x] 5.3 Tulis unit test untuk komponen `IjazahUploadField`
    - Test validasi tipe file (PDF vs non-PDF)
    - Test validasi ukuran file (≤5MB vs >5MB)
    - Test state setelah upload berhasil (nama file ditampilkan)
    - Test state setelah hapus file (kembali ke idle)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

- [x] 6. Checkpoint — Pastikan semua test frontend untuk komponen baru lulus
  - Pastikan semua test lulus, tanyakan ke user jika ada pertanyaan.

- [-] 7. Integrasi ke `SkRevisionPage`
  - Tambahkan state `ijazahUrl` (`useState<string | null>(null)`) pada `SkRevisionPage`
  - Gunakan `detectGelarChange` untuk menghitung `isGelarChange` dan `isPendidikanChange` secara reaktif berdasarkan nilai form
  - Render `<IjazahUploadField>` di bawah field `pendidikan_terakhir` dengan props yang sesuai
  - Update `handleSubmit`: jika `isGelarChange` true dan `ijazahUrl` null, tampilkan error dan blokir submit
  - Sertakan `ijazah_url: ijazahUrl` dalam payload `PATCH /api/sk-documents/{id}` jika tidak null
  - _Requirements: 1.1, 2.3, 2.4, 3.1, 3.3_

  - [x] 7.1 Tulis property test untuk validasi wajib ijazah saat gelar berubah (Property 5)
    - **Property 5: Validasi wajib ijazah saat gelar berubah**
    - **Validates: Requirements 2.3, 2.4**

  - [x] 7.2 Tulis property test untuk payload selalu menyertakan ijazah_url jika ada (Property 6)
    - **Property 6: Payload selalu menyertakan ijazah_url jika ada**
    - **Validates: Requirements 3.1**

- [x] 8. Integrasi ke `SkRevisionListPage`
  - Pada dialog/panel detail revisi yang sudah ada (`isPreviewOpen`), tambahkan section "Dokumen Pendukung"
  - Jika `selectedItem.ijazah_url` tidak kosong: tampilkan tombol "Lihat Ijazah" yang membuka `/api/minio/{path}` di tab baru
  - Jika `selectedItem.ijazah_url` kosong/null: tampilkan teks "Tidak ada ijazah dilampirkan."
  - Pastikan tidak mengubah tata letak utama halaman
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 8.1 Tulis property test untuk tampilan tombol ijazah konsisten dengan keberadaan data (Property 9)
    - **Property 9: Tampilan tombol ijazah konsisten dengan keberadaan data**
    - **Validates: Requirements 4.1, 4.3**

  - [x] 8.2 Tulis property test untuk approval/rejection tidak mengubah ijazah_url (Property 10)
    - **Property 10: Approval/rejection tidak mengubah ijazah_url**
    - **Validates: Requirements 4.5**

- [x] 9. Checkpoint akhir — Pastikan semua test lulus
  - Pastikan semua test lulus, tanyakan ke user jika ada pertanyaan.

## Catatan

- Task bertanda `*` bersifat opsional dan dapat dilewati untuk MVP yang lebih cepat
- Setiap task mereferensikan requirements spesifik untuk keterlacakan
- Property test menggunakan **fast-check** (frontend) dan **PHPUnit custom generators** (backend) dengan minimum 100 iterasi
- Checkpoint memastikan validasi inkremental sebelum melanjutkan ke tahap berikutnya
- Karena `SkDocumentController::update()` menggunakan `$request->only()`, field `ijazah_url` hanya diupdate jika disertakan dalam payload — ini memenuhi Requirement 3.4 secara otomatis tanpa logika tambahan
