# Requirements Document

## Introduction

Fitur SK Pemberhentian menambahkan jenis dokumen Surat Keputusan (SK) baru ke sistem SIMMACI: SK yang memberhentikan seorang guru dari jabatan/tugas mengajarnya di lingkungan LP Ma'arif NU Cilacap. Fitur ini mengikuti alur yang sudah ada pada SK Pengangkatan dan SK Mutasi — yakni submission oleh operator, approval oleh admin yayasan/super_admin, generate dokumen DOCX dengan QR code, lalu verifikasi publik via QR scan.

SK Pemberhentian dapat diterbitkan dengan berbagai alasan: pengunduran diri, pensiun, meninggal dunia, pelanggaran disiplin, atau alasan lain yang ditetapkan oleh kepala sekolah/yayasan. Setiap SK Pemberhentian harus mencantumkan alasan pemberhentian, tanggal efektif pemberhentian, dan mengakibatkan perubahan status guru di master data.

---

## Glossary

- **SK_Pemberhentian**: Surat Keputusan resmi yang memberhentikan seorang guru dari jabatan/tugas mengajarnya, diterbitkan oleh kepala sekolah atau yayasan LP Ma'arif NU Cilacap.
- **Alasan_Pemberhentian**: Kategori sebab terjadinya pemberhentian, meliputi: `pengunduran_diri`, `pensiun`, `meninggal_dunia`, `pelanggaran_disiplin`, `habis_kontrak`, `lainnya`.
- **Tanggal_Efektif**: Tanggal mulai berlakunya keputusan pemberhentian.
- **SkDocument**: Model Eloquent `sk_documents` yang menyimpan semua jenis SK (pengangkatan, mutasi, pemberhentian). Field `jenis_sk` membedakan jenisnya.
- **Status_SK**: Status workflow dokumen SK: `draft` → `pending` → `approved` → `rejected`, atau `archived`.
- **Operator**: Pengguna dengan role `operator`, hanya bisa mengakses data sekolahnya sendiri (`school_id`).
- **Admin_Yayasan**: Pengguna dengan role `admin_yayasan`, bisa approve/reject SK lintas sekolah.
- **Super_Admin**: Pengguna dengan role `super_admin`, akses penuh ke semua data.
- **Generator**: Komponen frontend yang menghasilkan file DOCX dari data SK yang sudah disetujui, menggunakan docxtemplater dengan template DOCX.
- **QR_Code**: Kode QR yang disisipkan ke dalam DOCX hasil generate, berisi URL verifikasi publik SK tersebut.
- **Template_Pemberhentian**: File DOCX yang digunakan sebagai template untuk SK Pemberhentian, dikelola melalui manajemen template SK yang sudah ada (`sk_type = 'pemberhentian'`).
- **NomorSK_Pemberhentian**: Nomor SK yang di-generate mengikuti format yang sama dengan SK lain, dengan placeholder berbeda untuk mencerminkan jenis pemberhentian.
- **Guru_Diberhentikan**: Teacher record yang statusnya diubah menjadi non-aktif setelah SK Pemberhentian di-approve.
- **Verifikasi_Publik**: Halaman publik `/verify/sk/:nomor` yang dapat diakses siapa pun untuk memverifikasi keaslian SK Pemberhentian.

---

## Requirements

### Requirement 1: Pengajuan SK Pemberhentian

**User Story:** Sebagai operator, saya ingin mengajukan SK Pemberhentian untuk seorang guru di sekolah saya, sehingga proses pemberhentian resmi bisa diproses melalui sistem.

#### Acceptance Criteria

1. WHEN operator membuka form pengajuan SK, THE Sistem SHALL menampilkan opsi `jenis_sk = "Pemberhentian"` di samping opsi pengangkatan dan mutasi yang sudah ada.
2. WHEN operator memilih `jenis_sk = "Pemberhentian"`, THE Sistem SHALL menampilkan field tambahan: `alasan_pemberhentian` (pilihan dari daftar baku) dan `tanggal_efektif_pemberhentian`.
3. THE Sistem SHALL menyediakan pilihan `alasan_pemberhentian` berupa: `pengunduran_diri`, `pensiun`, `meninggal_dunia`, `pelanggaran_disiplin`, `habis_kontrak`, dan `lainnya`.
4. WHERE `alasan_pemberhentian = "lainnya"`, THE Sistem SHALL menampilkan field teks bebas `keterangan_pemberhentian` untuk penjelasan tambahan.
5. WHEN operator mengisi `tanggal_efektif_pemberhentian`, THE Sistem SHALL memvalidasi bahwa tanggal tersebut tidak lebih awal dari tanggal hari ini dikurangi 1 tahun.
6. WHEN operator mengajukan SK Pemberhentian, THE Sistem SHALL memvalidasi bahwa field `nama`, `unit_kerja`, `alasan_pemberhentian`, dan `tanggal_efektif_pemberhentian` telah diisi.
7. WHEN operator mengajukan SK Pemberhentian dengan data valid, THE Sistem SHALL membuat record `sk_documents` dengan `jenis_sk = "Pemberhentian"` dan `status = "pending"`.
8. WHEN operator dengan role `operator` mengajukan SK Pemberhentian, THE Sistem SHALL menolak pengajuan jika `unit_kerja` tidak sesuai dengan `school_id` milik operator tersebut.
9. WHEN SK Pemberhentian berhasil diajukan, THE Sistem SHALL mengirimkan notifikasi kepada `admin_yayasan` dan `super_admin` bahwa ada pengajuan baru yang menunggu persetujuan.
10. WHEN operator mencoba mengajukan SK Pemberhentian untuk guru yang sudah memiliki SK Pemberhentian dengan status `pending` atau `approved` di tahun ajaran yang sama, THE Sistem SHALL menolak pengajuan duplikat dan menampilkan pesan error beserta nomor SK yang sudah ada.
11. IF guru berstatus PNS/ASN (berdasarkan field `status_kepegawaian` mengandung "pns" atau "asn", atau `nip` berjumlah 18 digit), THEN THE Sistem SHALL menolak pengajuan SK Pemberhentian dan mencatat record dengan `status = "rejected"` beserta alasan penolakan.

---

### Requirement 2: Persetujuan SK Pemberhentian

**User Story:** Sebagai admin yayasan, saya ingin menyetujui atau menolak pengajuan SK Pemberhentian, sehingga hanya pemberhentian yang sah yang diproses lebih lanjut.

#### Acceptance Criteria

1. WHEN `admin_yayasan` atau `super_admin` membuka halaman daftar SK, THE Sistem SHALL menampilkan SK Pemberhentian dengan status `pending` bersama SK jenis lain yang menunggu persetujuan.
2. WHEN `admin_yayasan` atau `super_admin` menyetujui SK Pemberhentian, THE Sistem SHALL mengubah `status` menjadi `approved` dan mencatat record di `approval_histories`.
3. WHEN `admin_yayasan` atau `super_admin` menolak SK Pemberhentian, THE Sistem SHALL mengubah `status` menjadi `rejected`, menyimpan `rejection_reason`, dan mencatat record di `approval_histories`.
4. WHEN status SK Pemberhentian berubah menjadi `approved` atau `rejected`, THE Sistem SHALL mengirimkan notifikasi ke operator sekolah yang mengajukan.
5. WHEN `operator` mencoba mengubah status SK Pemberhentian menjadi `approved` atau `rejected`, THE Sistem SHALL menolak permintaan dengan HTTP 403.
6. THE Sistem SHALL mengizinkan batch approve atau batch reject untuk beberapa SK Pemberhentian sekaligus, mengikuti pola `PATCH /api/sk-documents/batch-status` yang sudah ada.

---

### Requirement 3: Generate Dokumen SK Pemberhentian

**User Story:** Sebagai admin yayasan atau super admin, saya ingin men-generate file DOCX SK Pemberhentian yang sudah disetujui, sehingga dokumen resmi bisa dicetak dan diserahkan kepada guru.

#### Acceptance Criteria

1. WHEN pengguna membuka halaman Generator SK, THE Sistem SHALL menampilkan SK Pemberhentian yang sudah `approved` dan belum memiliki `file_url` di daftar kandidat generate.
2. WHEN `super_admin` atau `admin_yayasan` memilih SK Pemberhentian untuk di-generate, THE Sistem SHALL menggunakan template DOCX aktif dengan `sk_type = "pemberhentian"`.
3. IF tidak ada template aktif dengan `sk_type = "pemberhentian"`, THEN THE Sistem SHALL menampilkan pesan error yang jelas dan menghentikan proses generate.
4. WHEN Generator mengisi template pemberhentian, THE Sistem SHALL memetakan placeholder berikut: `{NAMA}`, `{JABATAN}`, `{UNIT_KERJA}`, `{NOMOR_SK}`, `{TANGGAL_EFEKTIF}`, `{ALASAN_PEMBERHENTIAN}`, `{KETERANGAN_PEMBERHENTIAN}`, `{TANGGAL_PENETAPAN}`, `{QR_CODE}`.
5. WHEN Generator mengisi placeholder `{NAMA}`, THE Sistem SHALL merender nama guru dengan formatting **bold** di dalam DOCX.
6. WHEN Generator membuat QR code untuk SK Pemberhentian, THE Sistem SHALL menggunakan `getSkVerificationUrl(nomorSk)` yang meng-encode nomor SK tepat satu kali dengan `encodeURIComponent`.
7. WHEN file DOCX berhasil di-generate dan disimpan, THE Sistem SHALL memperbarui field `file_url` pada record `sk_documents` yang bersangkutan.
8. WHEN generate multi-dokumen dilakukan untuk beberapa guru sekaligus, THE Sistem SHALL me-reset counter penomoran tembusan ke 1 untuk setiap dokumen SK Pemberhentian baru.
9. THE Generator SHALL mendukung generate SK Pemberhentian dalam satu file ZIP yang berisi seluruh DOCX individu, mengikuti pola generate SK yang sudah ada.

---

### Requirement 4: Template SK Pemberhentian

**User Story:** Sebagai super admin, saya ingin mengelola template DOCX untuk SK Pemberhentian, sehingga dokumen yang di-generate memiliki format resmi yang sesuai.

#### Acceptance Criteria

1. THE Sistem SHALL mengizinkan `super_admin` mengunggah template DOCX baru dengan `sk_type = "pemberhentian"` melalui halaman manajemen template SK.
2. WHEN `super_admin` mengaktifkan template pemberhentian, THE Sistem SHALL menonaktifkan template pemberhentian lain yang sebelumnya aktif untuk `sk_type = "pemberhentian"`.
3. THE Sistem SHALL memvalidasi bahwa file yang diunggah sebagai template pemberhentian berekstensi `.docx`.
4. WHEN `super_admin` menghapus template pemberhentian yang sedang aktif, THE Sistem SHALL menampilkan konfirmasi sebelum penghapusan dan memberikan peringatan bahwa generate SK Pemberhentian tidak bisa dilakukan sampai template baru diaktifkan.
5. THE Sistem SHALL memperlihatkan template `sk_type = "pemberhentian"` di daftar template SK di samping template GTY, GTT, Kamad, dan Tendik.

---

### Requirement 5: Perubahan Status Guru Setelah Pemberhentian

**User Story:** Sebagai admin yayasan, saya ingin status guru di master data diperbarui otomatis saat SK Pemberhentian disetujui, sehingga data master tetap akurat dan konsisten.

#### Acceptance Criteria

1. WHEN SK Pemberhentian di-approve, THE Sistem SHALL menandai record `teachers` terkait dengan field `is_active = false` (atau setara berdasarkan implementasi model yang ada).
2. WHEN SK Pemberhentian di-approve dengan `alasan_pemberhentian = "meninggal_dunia"`, THE Sistem SHALL mencatat informasi tersebut dalam activity log dengan keterangan yang sesuai.
3. WHEN SK Pemberhentian di-reject, THE Sistem SHALL mempertahankan status guru yang sudah ada tanpa perubahan.
4. WHEN SK Pemberhentian di-approve, THE Sistem SHALL mencatat riwayat pemberhentian di tabel `teacher_mutations` dengan kolom `reason` berisi alasan pemberhentian dan `sk_number` berisi nomor SK.
5. WHEN operator mencoba mengajukan SK baru (pengangkatan/mutasi) untuk guru yang sudah diberhentikan (`is_active = false`), THE Sistem SHALL menampilkan peringatan bahwa guru tersebut sudah diberhentikan dan meminta konfirmasi eksplisit sebelum melanjutkan.

---

### Requirement 6: Verifikasi Publik SK Pemberhentian

**User Story:** Sebagai pihak eksternal (instansi lain, calon sekolah baru), saya ingin memverifikasi keaslian SK Pemberhentian dengan men-scan QR code, sehingga saya dapat memastikan status pemberhentian seorang guru.

#### Acceptance Criteria

1. WHEN seseorang men-scan QR code pada dokumen SK Pemberhentian yang dicetak, THE Sistem SHALL membuka halaman verifikasi publik `/verify/sk/:nomor` yang menampilkan detail SK tersebut.
2. WHEN halaman verifikasi diakses dengan nomor SK Pemberhentian yang valid dan berstatus `approved`, THE Sistem SHALL menampilkan informasi: nama guru, unit kerja, alasan pemberhentian, tanggal efektif, dan badge status "SK VALID & AKTIF".
3. WHEN halaman verifikasi diakses dengan nomor SK Pemberhentian yang sudah diarsipkan, THE Sistem SHALL menampilkan badge "SK KADALUARSA" atau "SK DIARSIPKAN".
4. WHEN nomor SK Pemberhentian mengandung karakter `/` di URL verifikasi, THE Sistem SHALL men-decode nomor tersebut dengan benar sehingga halaman tidak menampilkan 404.
5. WHEN halaman verifikasi diakses dengan nomor SK yang tidak ditemukan di database, THE Sistem SHALL menampilkan pesan "SK tidak ditemukan" tanpa error 500.
6. THE halaman verifikasi publik SHALL dapat diakses tanpa login (tidak memerlukan autentikasi).

---

### Requirement 7: Laporan dan Rekap SK Pemberhentian

**User Story:** Sebagai admin yayasan, saya ingin melihat rekap SK Pemberhentian yang sudah diterbitkan, sehingga saya dapat memantau dan menganalisis tren pemberhentian guru di seluruh unit.

#### Acceptance Criteria

1. WHEN `admin_yayasan` atau `super_admin` memfilter daftar SK berdasarkan `jenis_sk = "Pemberhentian"`, THE Sistem SHALL menampilkan hanya SK Pemberhentian dari semua sekolah.
2. WHEN `operator` memfilter daftar SK berdasarkan `jenis_sk = "Pemberhentian"`, THE Sistem SHALL menampilkan hanya SK Pemberhentian dari sekolah milik operator tersebut.
3. THE Sistem SHALL menyertakan SK Pemberhentian dalam laporan ekspor Excel yang sudah ada, dengan kolom `alasan_pemberhentian` sebagai kolom tambahan.
4. WHEN `admin_yayasan` atau `super_admin` mengekspor laporan SK, THE Sistem SHALL mengizinkan filter berdasarkan `alasan_pemberhentian` untuk menyaring hasil ekspor.
5. THE Sistem SHALL menampilkan jumlah SK Pemberhentian di halaman laporan "SK Belum Mengajukan" sebagai data pendamping, sehingga dapat dibedakan antara guru yang belum mengajukan SK pengangkatan dengan guru yang sudah diberhentikan.

---

### Requirement 8: Integritas Data dan Audit Trail

**User Story:** Sebagai super admin, saya ingin semua operasi SK Pemberhentian tercatat dalam activity log, sehingga setiap perubahan dapat ditelusuri dan diaudit.

#### Acceptance Criteria

1. WHEN SK Pemberhentian diajukan, THE Sistem SHALL membuat record di `activity_logs` dengan event `submit_sk` dan metadata yang mencantumkan `jenis_sk = "Pemberhentian"`.
2. WHEN SK Pemberhentian di-approve atau di-reject, THE Sistem SHALL membuat record di `activity_logs` dengan event `approve_sk` atau `reject_sk` beserta nama approver dan timestamp.
3. WHEN file DOCX SK Pemberhentian di-generate, THE Sistem SHALL membuat record di `activity_logs` dengan event `generate_sk` beserta informasi guru dan nomor SK.
4. THE Sistem SHALL menyimpan semua perubahan status SK Pemberhentian di tabel `approval_histories` dengan `document_type = "sk_document"`, mengikuti pola yang sudah ada.
5. IF SK Pemberhentian di-soft-delete, THEN THE Sistem SHALL mempertahankan record di database (menggunakan `SoftDeletes`) sehingga data historis tetap dapat ditelusuri.
6. FOR ALL operasi yang mengubah status SK Pemberhentian, THE Sistem SHALL menyertakan `performed_by` (user ID), `performed_at` (timestamp), dan `metadata` (nama, role) dalam record `approval_histories`.

---

### Requirement 9: Isolasi Tenant dan Keamanan Akses

**User Story:** Sebagai operator, saya ingin data SK Pemberhentian sekolah saya tidak bisa diakses oleh operator sekolah lain, sehingga privasi dan integritas data terjaga.

#### Acceptance Criteria

1. WHILE seorang pengguna dengan role `operator` mengakses endpoint SK Pemberhentian, THE Sistem SHALL membatasi data yang dikembalikan hanya untuk `school_id` milik operator tersebut.
2. WHILE `admin_yayasan` atau `super_admin` mengakses endpoint SK Pemberhentian, THE Sistem SHALL mengembalikan data dari semua sekolah tanpa pembatasan `school_id`.
3. WHEN `operator` mencoba mengakses atau memodifikasi SK Pemberhentian milik sekolah lain, THE Sistem SHALL menolak permintaan dengan HTTP 403.
4. THE Sistem SHALL menerapkan Row-Level Security (RLS) PostgreSQL pada tabel `sk_documents` yang sudah ada untuk SK Pemberhentian, mengikuti policy `tenant_isolation_sk` yang sudah terdefinisi.
5. WHEN `operator` mengajukan SK Pemberhentian, THE Sistem SHALL secara otomatis mengisi `school_id` dari `school_id` operator yang sedang login, bukan dari input pengguna.

---

### Requirement 10: Format Nomor SK Pemberhentian

**User Story:** Sebagai admin yayasan, saya ingin nomor SK Pemberhentian mengikuti format penomoran yang konsisten, sehingga dokumen mudah diidentifikasi dan diarsipkan.

#### Acceptance Criteria

1. THE Sistem SHALL men-generate nomor SK Pemberhentian menggunakan format yang dapat dikonfigurasi oleh pengguna di halaman Generator, sama seperti SK jenis lain.
2. WHEN pengguna mengatur format nomor SK di halaman Generator, THE Sistem SHALL mendukung placeholder `{NOMOR}`, `{PERIODE}`, `{BULAN}`, `{BL_ROMA}`, dan `{TAHUN}` untuk SK Pemberhentian.
3. WHEN nomor SK Pemberhentian yang sudah di-generate disimpan ke database, THE Sistem SHALL memastikan nomor tersebut unik di seluruh tabel `sk_documents` (bukan hanya per sekolah).
4. WHEN sistem men-generate nomor SK berikutnya, THE Sistem SHALL menghitung nomor urut dari nomor SK tertinggi yang sudah ada di database, termasuk SK Pemberhentian, untuk menghindari tabrakan nomor.
5. IF nomor SK Pemberhentian mengandung karakter `/`, THEN THE Sistem SHALL menggunakan encoding URL yang konsisten — nomor di-encode tepat satu kali saat QR code di-generate — sehingga URL verifikasi tidak mengalami double-encoding.
