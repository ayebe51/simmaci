# Requirements Document

## Introduction

Fitur laporan madrasah/sekolah yang belum mengajukan SK, difilter khusus untuk sekolah dengan status jam'iyyah. Fitur ini merupakan bagian dari modul laporan SK per madrasah yang sudah ada, dengan tambahan kemampuan melihat daftar sekolah yang belum submit pengajuan SK serta mengekspor data tersebut ke format Excel dan PDF.

Fitur ini membantu LP Ma'arif NU Cilacap memantau kepatuhan madrasah berstatus jam'iyyah dalam mengajukan SK, sehingga dapat dilakukan tindak lanjut terhadap madrasah yang belum mengajukan.

## Glossary

- **Sistem_Laporan**: Modul laporan SK per madrasah dalam aplikasi SIMMACI
- **Madrasah**: Sekolah/lembaga pendidikan yang terdaftar dalam sistem SIMMACI (model `School`)
- **SK**: Surat Keputusan — dokumen resmi yang diterbitkan oleh LP Ma'arif NU (model `SkDocument`)
- **Status_Jamiyyah**: Klasifikasi hubungan organisasi madrasah dengan NU, bernilai "Jam'iyyah" yang menandakan madrasah milik organisasi NU secara langsung
- **Pengajuan_SK**: Proses submit dokumen SK oleh operator madrasah ke sistem (record di tabel `sk_documents` dengan `school_id` terkait)
- **Madrasah_Belum_Mengajukan**: Madrasah berstatus jam'iyyah yang tidak memiliki record pengajuan SK dalam periode tertentu
- **Export_Service**: Layanan yang menghasilkan file Excel (via Maatwebsite Excel) atau PDF dari data laporan

## Requirements

### Requirement 1: Menampilkan Daftar Madrasah Jam'iyyah yang Belum Mengajukan SK

**User Story:** Sebagai super_admin atau admin_yayasan, saya ingin melihat daftar madrasah berstatus jam'iyyah yang belum mengajukan SK, sehingga saya dapat menindaklanjuti madrasah yang belum patuh.

#### Acceptance Criteria

1. WHEN pengguna mengakses halaman laporan madrasah belum mengajukan SK, THE Sistem_Laporan SHALL menampilkan daftar Madrasah yang memiliki Status_Jamiyyah "Jam'iyyah" dan tidak memiliki Pengajuan_SK
2. THE Sistem_Laporan SHALL menampilkan informasi berikut untuk setiap Madrasah_Belum_Mengajukan: nama madrasah, NPSN, jenjang, kecamatan, dan nama kepala madrasah
3. THE Sistem_Laporan SHALL menampilkan jumlah total Madrasah_Belum_Mengajukan di bagian ringkasan halaman
4. WHEN pengguna dengan role operator mengakses endpoint laporan, THE Sistem_Laporan SHALL menolak akses dengan HTTP 403

### Requirement 2: Filter dan Pencarian Data Laporan

**User Story:** Sebagai super_admin atau admin_yayasan, saya ingin memfilter daftar madrasah yang belum mengajukan SK berdasarkan kriteria tertentu, sehingga saya dapat fokus pada kelompok madrasah tertentu.

#### Acceptance Criteria

1. WHEN pengguna memilih filter jenjang, THE Sistem_Laporan SHALL menampilkan hanya Madrasah_Belum_Mengajukan yang sesuai dengan jenjang yang dipilih (RA, MI, MTs, MA)
2. WHEN pengguna memilih filter kecamatan, THE Sistem_Laporan SHALL menampilkan hanya Madrasah_Belum_Mengajukan yang berada di kecamatan yang dipilih
3. WHEN pengguna memasukkan kata kunci pencarian, THE Sistem_Laporan SHALL memfilter Madrasah_Belum_Mengajukan berdasarkan nama madrasah atau NPSN yang mengandung kata kunci tersebut (case-insensitive)
4. WHEN pengguna memilih filter periode, THE Sistem_Laporan SHALL menentukan "belum mengajukan" berdasarkan tidak adanya Pengajuan_SK dalam rentang tanggal yang dipilih

### Requirement 3: Export Data ke Excel

**User Story:** Sebagai super_admin atau admin_yayasan, saya ingin mengunduh daftar madrasah yang belum mengajukan SK dalam format Excel, sehingga saya dapat mengolah data lebih lanjut atau membagikannya.

#### Acceptance Criteria

1. WHEN pengguna menekan tombol "Download Excel", THE Export_Service SHALL menghasilkan file Excel (.xlsx) yang berisi daftar Madrasah_Belum_Mengajukan sesuai filter yang sedang aktif
2. THE Export_Service SHALL menyertakan kolom berikut dalam file Excel: No, Nama Madrasah, NPSN, Jenjang, Kecamatan, Kepala Madrasah, dan Nomor Telepon
3. THE Export_Service SHALL menyertakan header laporan yang berisi judul "Laporan Madrasah Belum Mengajukan SK", tanggal cetak, dan filter yang digunakan
4. IF proses export gagal, THEN THE Export_Service SHALL menampilkan pesan error yang informatif kepada pengguna

### Requirement 4: Export Data ke PDF

**User Story:** Sebagai super_admin atau admin_yayasan, saya ingin mengunduh daftar madrasah yang belum mengajukan SK dalam format PDF, sehingga saya dapat mencetak laporan resmi.

#### Acceptance Criteria

1. WHEN pengguna menekan tombol "Download PDF", THE Export_Service SHALL menghasilkan file PDF yang berisi daftar Madrasah_Belum_Mengajukan sesuai filter yang sedang aktif
2. THE Export_Service SHALL memformat PDF dengan orientasi landscape, header kop LP Ma'arif NU Cilacap, dan tabel data yang rapi
3. THE Export_Service SHALL menyertakan kolom berikut dalam tabel PDF: No, Nama Madrasah, NPSN, Jenjang, Kecamatan, Kepala Madrasah
4. THE Export_Service SHALL menyertakan footer yang berisi tanggal cetak dan nomor halaman
5. IF proses export gagal, THEN THE Export_Service SHALL menampilkan pesan error yang informatif kepada pengguna

### Requirement 5: Integrasi dengan Halaman Laporan SK yang Sudah Ada

**User Story:** Sebagai super_admin atau admin_yayasan, saya ingin mengakses laporan madrasah belum mengajukan SK dari halaman laporan SK yang sudah ada, sehingga navigasi tetap konsisten.

#### Acceptance Criteria

1. THE Sistem_Laporan SHALL menyediakan tab atau link navigasi "Belum Mengajukan" pada halaman laporan SK per madrasah yang sudah ada
2. WHEN pengguna berpindah antara tab laporan SK yang sudah ada dan tab "Belum Mengajukan", THE Sistem_Laporan SHALL mempertahankan konteks filter periode jika berlaku
3. THE Sistem_Laporan SHALL menampilkan badge atau indikator jumlah madrasah yang belum mengajukan pada tab navigasi
