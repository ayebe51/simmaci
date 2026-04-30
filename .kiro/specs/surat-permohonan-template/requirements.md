# Requirements Document

## Introduction

Fitur **Template Surat Permohonan** memungkinkan LP Ma'arif NU Cilacap menyediakan template dokumen surat permohonan SK yang dapat diunduh oleh operator sekolah (madrasah). Saat ini, operator harus membuat surat permohonan secara manual sebelum mengajukan SK melalui SIMMACI. Dengan fitur ini, sistem menyediakan template resmi yang sudah terformat sesuai standar LP Ma'arif NU Cilacap, sehingga operator cukup mengisi data dan mengunggah kembali dokumen yang sudah dilengkapi.

Fitur ini mengikuti pola yang sudah ada pada SK Template Management (`SkTemplateManagementPage`) — super admin mengelola template di backend, operator mengunduh dan menggunakan template tersebut.

## Glossary

- **Surat_Permohonan**: Dokumen resmi dari sekolah/madrasah yang diajukan kepada LP Ma'arif NU Cilacap sebagai syarat pengajuan SK guru.
- **Template_Surat**: File dokumen (.docx) berisi format baku surat permohonan yang disediakan oleh LP Ma'arif NU Cilacap.
- **Operator**: Pengguna dengan role `operator` yang terikat pada satu sekolah (`school_id`).
- **Super_Admin**: Pengguna dengan role `super_admin` atau `admin_yayasan` yang memiliki akses penuh ke seluruh data.
- **Jenis_Surat**: Kategori surat permohonan, misalnya: `sk_gty` (Guru Tetap Yayasan), `sk_gtt` (Guru Tidak Tetap), `sk_tendik` (Tenaga Kependidikan), `sk_kamad` (Kepala Madrasah), `umum` (Surat Permohonan Umum).
- **Template_Aktif**: Template yang ditandai `is_active = true` untuk jenis surat tertentu dan akan ditampilkan sebagai template yang direkomendasikan untuk diunduh.
- **SIMMACI**: Sistem Informasi Manajemen Pendidikan LP Ma'arif NU Cilacap.

---

## Requirements

### Requirement 1: Manajemen Template Surat Permohonan oleh Super Admin

**User Story:** Sebagai super admin, saya ingin mengunggah dan mengelola template surat permohonan, sehingga operator sekolah dapat mengunduh template resmi yang sudah terstandarisasi.

#### Acceptance Criteria

1. THE Super_Admin SHALL dapat mengunggah file template surat permohonan dalam format `.docx` dengan ukuran maksimal 10 MB.
2. WHEN Super_Admin mengunggah template, THE Sistem SHALL menyimpan file ke storage dan mencatat metadata: `jenis_surat`, `original_filename`, `uploaded_by`, `created_at`.
3. THE Super_Admin SHALL dapat memilih `jenis_surat` saat mengunggah template dari pilihan: `sk_gty`, `sk_gtt`, `sk_tendik`, `sk_kamad`, `umum`.
4. WHEN Super_Admin mengaktifkan sebuah template, THE Sistem SHALL menandai template tersebut sebagai `is_active = true` dan menandai semua template lain dengan `jenis_surat` yang sama sebagai `is_active = false`.
5. THE Super_Admin SHALL dapat mengunduh template yang sudah diunggah untuk verifikasi.
6. THE Super_Admin SHALL dapat menghapus template yang tidak digunakan lagi.
7. IF Super_Admin menghapus template yang sedang aktif, THEN THE Sistem SHALL menghapus template tersebut dan tidak ada template aktif untuk `jenis_surat` tersebut sampai template baru diaktifkan.
8. THE Sistem SHALL menampilkan daftar semua template yang dikelompokkan berdasarkan `jenis_surat`, diurutkan berdasarkan `created_at` terbaru.

---

### Requirement 2: Unduh Template Surat Permohonan oleh Operator

**User Story:** Sebagai operator sekolah, saya ingin mengunduh template surat permohonan resmi, sehingga saya dapat membuat surat permohonan yang sesuai standar LP Ma'arif NU Cilacap sebelum mengajukan SK.

#### Acceptance Criteria

1. THE Operator SHALL dapat melihat daftar template surat permohonan yang tersedia dan aktif.
2. WHEN Operator memilih template untuk diunduh, THE Sistem SHALL menghasilkan URL unduhan yang valid dan mengarahkan browser untuk mengunduh file `.docx`.
3. THE Sistem SHALL menampilkan informasi template: nama file, jenis surat, dan tanggal terakhir diperbarui.
4. IF tidak ada template aktif untuk suatu `jenis_surat`, THEN THE Sistem SHALL menampilkan pesan "Template belum tersedia" untuk jenis surat tersebut.
5. WHERE fitur unduhan template tersedia, THE Sistem SHALL menampilkan tombol unduh yang dapat diakses dari halaman pengajuan SK (`SkSubmissionPage`) sebagai referensi cepat.

---

### Requirement 3: Integrasi dengan Alur Pengajuan SK

**User Story:** Sebagai operator sekolah, saya ingin mendapatkan akses ke template surat permohonan langsung dari halaman pengajuan SK, sehingga saya tidak perlu berpindah halaman untuk mendapatkan format yang benar.

#### Acceptance Criteria

1. WHEN Operator membuka halaman pengajuan SK, THE Sistem SHALL menampilkan tautan atau tombol untuk mengunduh template surat permohonan yang relevan.
2. THE Sistem SHALL menampilkan template yang relevan berdasarkan jenis SK yang dipilih operator (misalnya: jika operator memilih "SK GTY", sistem menampilkan template `sk_gty`).
3. WHEN jenis SK belum dipilih, THE Sistem SHALL menampilkan template `umum` sebagai default.
4. THE Sistem SHALL menampilkan template unduhan dalam format yang tidak memblokir alur pengajuan (misalnya: sebagai panel samping atau link, bukan modal wajib).

---

### Requirement 4: Keamanan dan Kontrol Akses

**User Story:** Sebagai super admin, saya ingin memastikan hanya pengguna yang berwenang yang dapat mengelola template, sehingga integritas dokumen resmi LP Ma'arif NU Cilacap terjaga.

#### Acceptance Criteria

1. WHEN pengguna dengan role `operator` mencoba mengakses endpoint manajemen template (upload, activate, delete), THE Sistem SHALL menolak permintaan dengan HTTP 403 Forbidden.
2. THE Sistem SHALL mengizinkan akses endpoint unduhan template untuk semua pengguna yang sudah terautentikasi (role `operator`, `admin_yayasan`, `super_admin`).
3. WHEN pengguna tidak terautentikasi mencoba mengakses endpoint template, THE Sistem SHALL menolak permintaan dengan HTTP 401 Unauthorized.
4. THE Sistem SHALL mencatat aktivitas upload, aktivasi, dan penghapusan template ke dalam activity log dengan informasi `causer` (pengguna yang melakukan aksi).

---

### Requirement 5: Validasi File Template

**User Story:** Sebagai sistem, saya ingin memvalidasi file yang diunggah sebagai template, sehingga hanya file yang valid yang tersimpan dan dapat diunduh oleh operator.

#### Acceptance Criteria

1. WHEN Super_Admin mengunggah file, THE Sistem SHALL memvalidasi bahwa ekstensi file adalah `.docx`.
2. WHEN Super_Admin mengunggah file, THE Sistem SHALL memvalidasi bahwa ukuran file tidak melebihi 10 MB.
3. IF file yang diunggah bukan `.docx` atau melebihi 10 MB, THEN THE Sistem SHALL mengembalikan pesan error yang deskriptif tanpa menyimpan file.
4. THE Sistem SHALL menyimpan `original_filename` (nama file asli dari pengguna) secara terpisah dari nama file yang disimpan di storage.
5. WHEN template berhasil diunggah, THE Sistem SHALL mengembalikan respons HTTP 201 dengan metadata template yang baru dibuat.

---

### Requirement 6: API Backend untuk Template Surat Permohonan

**User Story:** Sebagai sistem, saya ingin menyediakan API RESTful untuk manajemen template surat permohonan, sehingga frontend dapat berinteraksi dengan data template secara konsisten.

#### Acceptance Criteria

1. THE Sistem SHALL menyediakan endpoint `GET /api/surat-permohonan-templates` yang mengembalikan daftar semua template, dapat difilter dengan query parameter `?jenis_surat=`.
2. THE Sistem SHALL menyediakan endpoint `POST /api/surat-permohonan-templates` untuk mengunggah template baru (hanya `super_admin` dan `admin_yayasan`).
3. THE Sistem SHALL menyediakan endpoint `POST /api/surat-permohonan-templates/{id}/activate` untuk mengaktifkan template (hanya `super_admin` dan `admin_yayasan`).
4. THE Sistem SHALL menyediakan endpoint `DELETE /api/surat-permohonan-templates/{id}` untuk menghapus template (hanya `super_admin` dan `admin_yayasan`).
5. THE Sistem SHALL menyediakan endpoint `GET /api/surat-permohonan-templates/{id}/download` yang mengembalikan URL unduhan file template.
6. THE Sistem SHALL menyediakan endpoint `GET /api/surat-permohonan-templates/active?jenis_surat=` yang mengembalikan template aktif untuk jenis surat tertentu, atau HTTP 404 jika tidak ada.
7. WHEN endpoint API dipanggil, THE Sistem SHALL mengembalikan respons dalam format `{ success, message, data }` sesuai trait `ApiResponse` yang sudah ada.

---

### Requirement 7: Persistensi Data Template

**User Story:** Sebagai sistem, saya ingin menyimpan metadata template surat permohonan di database, sehingga data template dapat dikelola dan diaudit dengan baik.

#### Acceptance Criteria

1. THE Sistem SHALL menyimpan setiap template dengan kolom: `id`, `jenis_surat`, `original_filename`, `storage_path`, `is_active`, `uploaded_by`, `created_at`, `updated_at`, `deleted_at` (soft delete).
2. THE Sistem SHALL menggunakan `SoftDeletes` sehingga template yang dihapus tidak hilang dari database secara permanen.
3. WHEN dua template memiliki `jenis_surat` yang sama dan keduanya `is_active = true`, THE Sistem SHALL memastikan kondisi ini tidak terjadi melalui logika aktivasi yang mengubah template lain menjadi `is_active = false` sebelum mengaktifkan template baru.
4. THE Sistem SHALL menyimpan `storage_path` (path internal di storage) secara terpisah dari `original_filename` untuk keamanan dan fleksibilitas storage.
