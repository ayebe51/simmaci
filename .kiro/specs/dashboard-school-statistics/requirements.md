# Requirements Document

## Introduction

Fitur ini menambahkan dua statistik baru pada halaman dashboard SIMMACI untuk memberikan insight yang lebih mendalam tentang distribusi sekolah dalam jaringan LP Ma'arif NU Cilacap. Statistik yang ditambahkan adalah:

1. **Statistik Afiliasi Sekolah**: Menampilkan jumlah madrasah/sekolah berdasarkan status afiliasi (Jama'ah vs Jam'iyyah)
2. **Statistik Jenjang Pendidikan**: Menampilkan jumlah sekolah berdasarkan jenjang pendidikan (MI/SD, MTs/SMP, MA/SMA/SMK)

Fitur ini akan meningkatkan kemampuan monitoring dan analisis data sekolah bagi super admin dan admin yayasan.

## Glossary

- **Dashboard_System**: Sistem dashboard SIMMACI yang menampilkan statistik dan informasi ringkasan
- **School_Repository**: Repository yang mengelola akses data sekolah dari database
- **Dashboard_API**: API endpoint yang menyediakan data statistik untuk dashboard
- **Frontend_Dashboard**: Komponen React yang menampilkan dashboard kepada pengguna
- **Afiliasi_Jama'ah**: Status sekolah yang berafiliasi langsung dengan organisasi (nilai: "Jama'ah" atau "Afiliasi")
- **Afiliasi_Jam'iyyah**: Status sekolah yang berafiliasi dengan jam'iyyah (nilai: "Jam'iyyah")
- **Jenjang_MI_SD**: Jenjang pendidikan Madrasah Ibtidaiyah atau Sekolah Dasar
- **Jenjang_MTs_SMP**: Jenjang pendidikan Madrasah Tsanawiyah atau Sekolah Menengah Pertama
- **Jenjang_MA_SMA_SMK**: Jenjang pendidikan Madrasah Aliyah, Sekolah Menengah Atas, atau Sekolah Menengah Kejuruan
- **Super_Admin**: Pengguna dengan role super_admin yang memiliki akses penuh ke semua data
- **Admin_Yayasan**: Pengguna dengan role admin_yayasan yang memiliki akses oversight ke semua sekolah
- **Operator**: Pengguna dengan role operator yang hanya dapat melihat data sekolahnya sendiri

## Requirements

### Requirement 1: Statistik Afiliasi Sekolah

**User Story:** Sebagai super admin atau admin yayasan, saya ingin melihat jumlah sekolah berdasarkan status afiliasi, sehingga saya dapat memahami distribusi afiliasi dalam jaringan sekolah.

#### Acceptance Criteria

1. THE Dashboard_API SHALL menyediakan endpoint yang mengembalikan jumlah sekolah berdasarkan status afiliasi
2. WHEN Super_Admin atau Admin_Yayasan mengakses dashboard, THE Dashboard_System SHALL menampilkan statistik afiliasi sekolah
3. THE Dashboard_System SHALL mengelompokkan sekolah ke dalam dua kategori: Afiliasi_Jama'ah dan Afiliasi_Jam'iyyah
4. WHEN field status_jamiyyah bernilai "Jama'ah" atau "Afiliasi", THE Dashboard_System SHALL menghitung sekolah tersebut sebagai Afiliasi_Jama'ah
5. WHEN field status_jamiyyah bernilai "Jam'iyyah", THE Dashboard_System SHALL menghitung sekolah tersebut sebagai Afiliasi_Jam'iyyah
6. THE Frontend_Dashboard SHALL menampilkan statistik afiliasi dalam bentuk visual yang mudah dipahami
7. THE Dashboard_System SHALL menghitung statistik afiliasi berdasarkan data real-time dari database
8. WHEN Operator mengakses dashboard, THE Dashboard_System SHALL menampilkan statistik afiliasi hanya untuk sekolah operator tersebut

### Requirement 2: Statistik Jenjang Pendidikan

**User Story:** Sebagai super admin atau admin yayasan, saya ingin melihat jumlah sekolah berdasarkan jenjang pendidikan, sehingga saya dapat memahami distribusi jenjang dalam jaringan sekolah.

#### Acceptance Criteria

1. THE Dashboard_API SHALL menyediakan endpoint yang mengembalikan jumlah sekolah berdasarkan jenjang pendidikan
2. WHEN Super_Admin atau Admin_Yayasan mengakses dashboard, THE Dashboard_System SHALL menampilkan statistik jenjang pendidikan
3. THE Dashboard_System SHALL mengelompokkan sekolah ke dalam tiga kategori: Jenjang_MI_SD, Jenjang_MTs_SMP, dan Jenjang_MA_SMA_SMK
4. WHEN field jenjang mengandung "MI" atau "SD", THE Dashboard_System SHALL menghitung sekolah tersebut sebagai Jenjang_MI_SD
5. WHEN field jenjang mengandung "MTs" atau "SMP", THE Dashboard_System SHALL menghitung sekolah tersebut sebagai Jenjang_MTs_SMP
6. WHEN field jenjang mengandung "MA" atau "SMA" atau "SMK", THE Dashboard_System SHALL menghitung sekolah tersebut sebagai Jenjang_MA_SMA_SMK
7. THE Frontend_Dashboard SHALL menampilkan statistik jenjang dalam bentuk visual yang mudah dipahami
8. THE Dashboard_System SHALL menghitung statistik jenjang berdasarkan data real-time dari database
9. WHEN Operator mengakses dashboard, THE Dashboard_System SHALL menampilkan statistik jenjang hanya untuk sekolah operator tersebut

### Requirement 3: Integrasi dengan Dashboard Existing

**User Story:** Sebagai pengguna sistem, saya ingin statistik baru terintegrasi dengan dashboard yang sudah ada, sehingga saya mendapatkan pengalaman yang konsisten.

#### Acceptance Criteria

1. THE Dashboard_System SHALL menampilkan statistik afiliasi dan jenjang di halaman dashboard yang sama dengan statistik existing
2. THE Frontend_Dashboard SHALL menggunakan komponen UI yang konsisten dengan desain dashboard existing
3. THE Dashboard_API SHALL mengembalikan data statistik baru dalam format yang konsisten dengan API response existing
4. THE Dashboard_System SHALL memuat statistik baru bersamaan dengan statistik existing tanpa menambah waktu loading yang signifikan
5. WHEN terjadi error dalam memuat statistik baru, THE Dashboard_System SHALL menampilkan pesan error yang informatif tanpa mengganggu tampilan statistik existing
6. THE Dashboard_System SHALL menerapkan RBAC yang sama dengan statistik existing untuk statistik baru

### Requirement 4: Performance dan Scalability

**User Story:** Sebagai pengguna sistem, saya ingin statistik dashboard dimuat dengan cepat, sehingga saya dapat mengakses informasi tanpa penundaan yang mengganggu.

#### Acceptance Criteria

1. WHEN pengguna mengakses dashboard, THE Dashboard_API SHALL mengembalikan data statistik dalam waktu kurang dari 500 milidetik
2. THE School_Repository SHALL menggunakan query aggregation di database untuk menghitung statistik
3. THE Dashboard_API SHALL menghindari loading semua data sekolah ke memory saat menghitung statistik
4. THE Dashboard_System SHALL menggunakan database indexing pada field status_jamiyyah dan jenjang untuk optimasi query
5. WHEN jumlah sekolah mencapai 1000 record, THE Dashboard_API SHALL tetap mengembalikan statistik dalam waktu kurang dari 1 detik

### Requirement 5: Data Accuracy dan Handling

**User Story:** Sebagai pengguna sistem, saya ingin statistik yang ditampilkan akurat dan menangani data yang tidak lengkap dengan baik, sehingga saya dapat membuat keputusan berdasarkan data yang benar.

#### Acceptance Criteria

1. WHEN field status_jamiyyah bernilai NULL atau empty string, THE Dashboard_System SHALL mengkategorikan sekolah tersebut sebagai "Tidak Terdefinisi" dalam statistik afiliasi
2. WHEN field jenjang bernilai NULL atau empty string, THE Dashboard_System SHALL mengkategorikan sekolah tersebut sebagai "Tidak Terdefinisi" dalam statistik jenjang
3. THE Dashboard_System SHALL menghitung total sekolah yang sama dengan penjumlahan semua kategori dalam setiap statistik
4. THE Dashboard_System SHALL menggunakan case-insensitive matching untuk mengelompokkan jenjang pendidikan
5. WHEN field jenjang mengandung nilai yang tidak dikenali, THE Dashboard_System SHALL mengkategorikan sekolah tersebut sebagai "Lainnya"
6. THE Dashboard_API SHALL mengembalikan nilai 0 untuk kategori yang tidak memiliki sekolah

### Requirement 6: Responsive Design

**User Story:** Sebagai pengguna yang mengakses dashboard dari berbagai perangkat, saya ingin statistik ditampilkan dengan baik di semua ukuran layar, sehingga saya dapat mengakses informasi dari perangkat apapun.

#### Acceptance Criteria

1. THE Frontend_Dashboard SHALL menampilkan statistik afiliasi dan jenjang dalam layout yang responsive
2. WHEN layar berukuran mobile (kurang dari 768px), THE Frontend_Dashboard SHALL menampilkan statistik dalam layout vertikal
3. WHEN layar berukuran tablet atau desktop (768px atau lebih), THE Frontend_Dashboard SHALL menampilkan statistik dalam layout grid
4. THE Frontend_Dashboard SHALL menggunakan Tailwind CSS classes yang konsisten dengan komponen dashboard existing
5. THE Frontend_Dashboard SHALL memastikan teks dan angka statistik tetap terbaca di semua ukuran layar

### Requirement 7: Testing dan Quality Assurance

**User Story:** Sebagai developer, saya ingin fitur statistik baru memiliki test coverage yang baik, sehingga saya dapat memastikan kualitas dan mencegah regression bugs.

#### Acceptance Criteria

1. THE Dashboard_API SHALL memiliki unit tests untuk endpoint statistik afiliasi dan jenjang
2. THE School_Repository SHALL memiliki unit tests untuk method aggregation statistik
3. THE Frontend_Dashboard SHALL memiliki component tests untuk rendering statistik baru
4. THE Dashboard_System SHALL memiliki integration tests yang memverifikasi end-to-end flow dari database hingga UI
5. THE Dashboard_System SHALL memiliki tests untuk edge cases seperti data kosong, NULL values, dan kategori tidak dikenali
6. WHEN tests dijalankan, THE Dashboard_System SHALL mencapai minimal 80% code coverage untuk kode baru

