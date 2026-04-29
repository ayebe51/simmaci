# Requirements Document

## Introduction

Fitur **Upload Scan PDF Ijazah pada Revisi SK** menambahkan kemampuan bagi operator sekolah untuk melampirkan scan PDF ijazah saat mengajukan revisi data guru pada halaman Revisi SK (`SkRevisionPage`). Lampiran ini berfungsi sebagai bukti pendukung yang wajib disertakan ketika perubahan yang diajukan menyangkut gelar akademik (misalnya: S.Pd, M.Pd, S.Ag, dll.) pada field `pendidikan_terakhir` atau `nama` guru.

File ijazah disimpan di storage S3-compatible (MinIO) melalui endpoint upload yang sudah ada (`POST /api/media/upload`). Referensi path file disimpan pada kolom baru `ijazah_url` di tabel `sk_documents`. Admin yayasan dapat melihat dan mengunduh file ijazah tersebut saat meninjau pengajuan revisi di halaman Daftar Revisi SK (`SkRevisionListPage`).

---

## Glossary

- **Ijazah_Upload_System**: Subsistem dalam alur Revisi SK yang menangani upload, penyimpanan, dan tampilan scan PDF ijazah
- **Revision_Form**: Form pengajuan revisi profil guru pada halaman `SkRevisionPage`
- **Revision_List**: Halaman daftar pengajuan revisi SK yang dapat diakses oleh admin (`SkRevisionListPage`)
- **Ijazah_File**: File scan PDF ijazah yang diunggah oleh operator sebagai bukti perubahan gelar
- **Gelar_Change**: Kondisi di mana field `pendidikan_terakhir` atau `nama` pada Revision_Form mengandung perubahan yang menyertakan gelar akademik (S.Pd, M.Pd, S.Ag, S.T, dll.)
- **ijazah_url**: Kolom baru pada tabel `sk_documents` yang menyimpan path/URL file Ijazah_File di storage
- **operator**: Pengguna dengan role `operator` yang hanya dapat mengakses data sekolahnya sendiri
- **admin_yayasan**: Pengguna dengan role `admin_yayasan` yang memiliki akses pengawasan lintas sekolah
- **super_admin**: Pengguna dengan akses penuh ke seluruh data lintas sekolah
- **SkDocument**: Model Eloquent yang merepresentasikan dokumen SK di tabel `sk_documents`
- **Teacher**: Model Eloquent yang merepresentasikan data guru di tabel `teachers`
- **MinIO**: Layanan object storage S3-compatible yang digunakan untuk menyimpan file
- **ApiResponse**: Trait Laravel yang digunakan di semua controller API untuk menghasilkan respons JSON dengan shape `{ success, message, data }`

---

## Requirements

### Requirement 1: Upload Ijazah pada Form Revisi SK

**User Story:** Sebagai operator sekolah, saya ingin dapat mengunggah scan PDF ijazah saat mengajukan revisi data guru, sehingga admin dapat memverifikasi keabsahan perubahan gelar yang saya ajukan.

#### Acceptance Criteria

1. THE `Ijazah_Upload_System` SHALL menampilkan komponen upload file PDF pada Revision_Form di halaman `SkRevisionPage`.
2. WHEN pengguna memilih file untuk diunggah, THE `Ijazah_Upload_System` SHALL memvalidasi bahwa tipe file adalah `application/pdf` sebelum mengirim ke server.
3. IF file yang dipilih bukan bertipe PDF, THEN THE `Ijazah_Upload_System` SHALL menampilkan pesan validasi "File harus berformat PDF." dan menolak file tersebut.
4. IF ukuran file melebihi 5 MB, THEN THE `Ijazah_Upload_System` SHALL menampilkan pesan validasi "Ukuran file maksimal 5 MB." dan menolak file tersebut.
5. WHEN pengguna mengunggah file PDF yang valid, THE `Ijazah_Upload_System` SHALL mengirim file ke endpoint `POST /api/media/upload` dengan parameter `folder = "ijazah"` dan menampilkan indikator loading selama proses upload berlangsung.
6. WHEN upload berhasil, THE `Ijazah_Upload_System` SHALL menampilkan nama file yang berhasil diunggah beserta tombol untuk menghapus pilihan file tersebut.
7. IF upload gagal karena kesalahan jaringan atau server, THEN THE `Ijazah_Upload_System` SHALL menampilkan pesan error "Gagal mengunggah file. Silakan coba lagi." dan memungkinkan pengguna untuk mencoba ulang.
8. WHEN pengguna menghapus file yang sudah diunggah melalui tombol hapus, THE `Ijazah_Upload_System` SHALL menghapus referensi file dari state form dan menampilkan kembali komponen upload dalam kondisi kosong.

---

### Requirement 2: Kewajiban Upload Ijazah saat Perubahan Gelar

**User Story:** Sebagai operator sekolah, saya ingin mendapat panduan yang jelas kapan upload ijazah diwajibkan, sehingga pengajuan revisi saya tidak ditolak karena kurangnya dokumen pendukung.

#### Acceptance Criteria

1. WHEN nilai field `pendidikan_terakhir` pada Revision_Form berubah dari nilai awal yang tersimpan di database, THE `Ijazah_Upload_System` SHALL menampilkan label atau keterangan "Upload ijazah diperlukan jika ada perubahan gelar/pendidikan." di dekat komponen upload.
2. WHEN nilai field `nama` pada Revision_Form mengandung gelar akademik (dideteksi dengan pola: `S\.Pd`, `M\.Pd`, `S\.Ag`, `M\.Ag`, `S\.T`, `S\.Kom`, `S\.E`, `S\.H`, `S\.Sos`, `M\.M`, `M\.Si`, `Dr\.`, `Prof\.`) dan berbeda dari nilai awal, THE `Ijazah_Upload_System` SHALL menampilkan peringatan "Perubahan gelar pada nama memerlukan scan ijazah sebagai bukti." di dekat komponen upload.
3. WHEN kondisi Gelar_Change terdeteksi dan pengguna mencoba mengirim form tanpa melampirkan Ijazah_File, THE `Ijazah_Upload_System` SHALL menampilkan pesan validasi "Scan ijazah wajib dilampirkan untuk perubahan gelar." dan mencegah pengiriman form.
4. WHEN kondisi Gelar_Change tidak terdeteksi, THE `Ijazah_Upload_System` SHALL menjadikan upload ijazah sebagai opsional dan memungkinkan pengiriman form tanpa Ijazah_File.
5. THE `Ijazah_Upload_System` SHALL menampilkan keterangan format yang diterima ("PDF, maks. 5 MB") di bawah komponen upload pada semua kondisi.

---

### Requirement 3: Penyimpanan Referensi Ijazah pada Pengajuan Revisi

**User Story:** Sebagai sistem, saya ingin menyimpan referensi file ijazah bersama data pengajuan revisi, sehingga admin dapat mengakses file tersebut saat meninjau pengajuan.

#### Acceptance Criteria

1. WHEN operator mengirim Revision_Form dengan Ijazah_File yang sudah diunggah, THE `Ijazah_Upload_System` SHALL menyertakan `ijazah_url` (path file dari respons upload) dalam payload `PATCH /api/sk-documents/{id}` bersama `revision_status`, `revision_reason`, dan `revision_data`.
2. THE `SkDocument` SHALL menyimpan nilai `ijazah_url` pada kolom `ijazah_url` di tabel `sk_documents`.
3. WHEN operator mengirim Revision_Form tanpa Ijazah_File, THE `Ijazah_Upload_System` SHALL mengirim payload tanpa field `ijazah_url` sehingga nilai kolom `ijazah_url` pada SkDocument tetap `NULL`.
4. THE `SkDocument` SHALL mempertahankan nilai `ijazah_url` yang sudah tersimpan ketika update dilakukan tanpa menyertakan field `ijazah_url` dalam payload.
5. WHEN `SkDocument` diperbarui dengan `ijazah_url` baru, THE `Ijazah_Upload_System` SHALL mencatat perubahan tersebut dalam `activity_logs` dengan event `update_sk` yang sudah ada.

---

### Requirement 4: Tampilan Ijazah pada Daftar Revisi untuk Admin

**User Story:** Sebagai admin yayasan atau super admin, saya ingin dapat melihat dan mengunduh scan ijazah yang dilampirkan operator saat meninjau pengajuan revisi, sehingga saya dapat memverifikasi keabsahan perubahan gelar sebelum menyetujui atau menolak revisi.

#### Acceptance Criteria

1. WHEN admin membuka detail pengajuan revisi pada Revision_List, THE `Ijazah_Upload_System` SHALL menampilkan tombol atau tautan "Lihat Ijazah" jika `ijazah_url` pada SkDocument tidak kosong.
2. WHEN admin mengklik "Lihat Ijazah", THE `Ijazah_Upload_System` SHALL membuka file PDF ijazah di tab browser baru menggunakan URL yang dapat diakses melalui MinIO proxy (`/api/minio/{path}`).
3. WHEN `ijazah_url` pada SkDocument bernilai `NULL` atau kosong, THE `Ijazah_Upload_System` SHALL menampilkan teks "Tidak ada ijazah dilampirkan." pada bagian dokumen pendukung di detail revisi.
4. THE `Ijazah_Upload_System` SHALL menampilkan informasi ijazah (ada/tidak ada) pada panel detail revisi yang sudah ada di `SkRevisionListPage`, tanpa mengubah tata letak utama halaman tersebut.
5. WHEN admin menyetujui atau menolak revisi, THE `Ijazah_Upload_System` SHALL mempertahankan nilai `ijazah_url` pada SkDocument tanpa mengubahnya sebagai bagian dari proses approval/rejection.

---

### Requirement 5: Keamanan dan Kontrol Akses File Ijazah

**User Story:** Sebagai sistem, saya ingin memastikan bahwa file ijazah hanya dapat diakses oleh pengguna yang berwenang, sehingga data pribadi guru terlindungi dari akses tidak sah.

#### Acceptance Criteria

1. THE `Ijazah_Upload_System` SHALL menyimpan Ijazah_File di folder `ijazah/` pada storage MinIO menggunakan endpoint `POST /api/media/upload` yang sudah dilindungi middleware `auth:sanctum`.
2. IF pengguna yang tidak terautentikasi mencoba mengakses endpoint upload, THEN THE `Ijazah_Upload_System` SHALL mengembalikan respons HTTP 401.
3. WHEN operator dengan role `operator` mengunggah Ijazah_File, THE `Ijazah_Upload_System` SHALL memastikan file disimpan dalam konteks `school_id` operator tersebut dengan menyertakan `school_id` sebagai bagian dari path folder (`ijazah/{school_id}/`).
4. THE `Ijazah_Upload_System` SHALL membatasi akses endpoint upload hanya untuk pengguna dengan role `operator`, `admin_yayasan`, atau `super_admin`.
5. WHEN file ijazah diakses melalui MinIO proxy, THE `Ijazah_Upload_System` SHALL menggunakan mekanisme proxy yang sudah ada (`MinioProxyController`) tanpa membuat endpoint baru.

---

### Requirement 6: Validasi Backend untuk Upload Ijazah

**User Story:** Sebagai sistem, saya ingin memvalidasi file ijazah di sisi server, sehingga file yang tidak sesuai tidak tersimpan di storage meskipun validasi frontend dilewati.

#### Acceptance Criteria

1. WHEN endpoint `POST /api/media/upload` menerima file dengan parameter `folder = "ijazah"`, THE `Ijazah_Upload_System` SHALL memvalidasi bahwa tipe MIME file adalah `application/pdf`.
2. IF tipe MIME file bukan `application/pdf`, THEN THE `Ijazah_Upload_System` SHALL mengembalikan respons HTTP 422 dengan pesan "File ijazah harus berformat PDF.".
3. THE `Ijazah_Upload_System` SHALL memvalidasi bahwa ukuran file tidak melebihi 5.120 KB (5 MB) pada sisi server.
4. IF ukuran file melebihi 5.120 KB, THEN THE `Ijazah_Upload_System` SHALL mengembalikan respons HTTP 422 dengan pesan "Ukuran file ijazah maksimal 5 MB.".
5. WHEN `PATCH /api/sk-documents/{id}` menerima field `ijazah_url`, THE `Ijazah_Upload_System` SHALL memvalidasi bahwa nilai `ijazah_url` adalah string dengan panjang maksimal 500 karakter.
6. IF nilai `ijazah_url` tidak valid, THEN THE `Ijazah_Upload_System` SHALL mengembalikan respons HTTP 422 dengan pesan validasi yang sesuai.

---

### Requirement 7: Migrasi Database

**User Story:** Sebagai developer, saya ingin ada migrasi database yang menambahkan kolom `ijazah_url` pada tabel `sk_documents`, sehingga referensi file ijazah dapat disimpan secara persisten.

#### Acceptance Criteria

1. THE `Ijazah_Upload_System` SHALL menyediakan migration Laravel yang menambahkan kolom `ijazah_url` bertipe `string` dengan panjang 500 karakter dan nilai default `NULL` pada tabel `sk_documents`.
2. WHEN migration dijalankan, THE `Ijazah_Upload_System` SHALL tidak mengubah atau menghapus kolom yang sudah ada pada tabel `sk_documents`.
3. THE `Ijazah_Upload_System` SHALL menambahkan `ijazah_url` ke dalam array `$fillable` pada model `SkDocument`.
4. WHEN migration di-rollback, THE `Ijazah_Upload_System` SHALL menghapus kolom `ijazah_url` dari tabel `sk_documents` tanpa memengaruhi kolom lain.
