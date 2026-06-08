# Requirements Document: Absensi Siswa Berbasis QR Code

## Introduction

Fitur absensi siswa berbasis QR code untuk SIMMACI memungkinkan operator sekolah mencatat kehadiran siswa per kelas dan mata pelajaran menggunakan QR code yang sudah tercetak di Kartu Tanda Siswa (KTS/KTA). Sesi scan dilakukan oleh operator atau guru piket melalui halaman scanner yang dilindungi PIN. Setelah sesi scan selesai, operator dapat mengedit status absensi secara manual untuk koreksi. Fitur ini merupakan perluasan dari infrastruktur absensi yang sudah ada (`StudentAttendanceLog`, `PublicScannerPage`, `QrScannerPage`) dan mengikuti pola multi-tenancy yang berlaku di SIMMACI.

## Glossary

- **Attendance_System**: Sistem absensi siswa berbasis QR code
- **Operator**: User dengan role `operator` yang mengelola absensi untuk sekolahnya sendiri (`school_id`)
- **Admin_Yayasan**: User dengan role `admin_yayasan` yang dapat melihat data absensi lintas sekolah
- **Super_Admin**: User dengan role `super_admin` yang memiliki akses penuh ke semua data
- **Siswa**: Peserta didik yang terdaftar di sekolah dengan data tersimpan di tabel `students`
- **KTS**: Kartu Tanda Siswa — kartu identitas fisik siswa yang memuat QR code unik
- **QR_Siswa**: QR code yang tercetak di KTS, berisi nilai dari kolom `qr_code` pada tabel `students`
- **Sesi_Scan**: Periode waktu satu sesi absensi untuk satu kelas, satu mata pelajaran, dan satu tanggal tertentu
- **Log_Absensi**: Record `StudentAttendanceLog` yang menyimpan status kehadiran seluruh siswa dalam satu sesi
- **Status_Absensi**: Status kehadiran siswa: `Hadir`, `Sakit`, `Izin`, atau `Alpa`
- **Scanner_PIN**: PIN numerik 4–6 digit yang dikonfigurasi per sekolah untuk mengakses halaman scanner publik
- **Edit_Manual**: Proses koreksi status absensi oleh operator setelah sesi scan selesai
- **Laporan_Absensi**: Rekap kehadiran siswa per kelas dan mata pelajaran dalam rentang waktu tertentu
- **Kelas**: Unit kelas sekolah yang tersimpan di tabel `school_classes`
- **Mata_Pelajaran**: Subjek pelajaran yang tersimpan di tabel `subjects`
- **Jam_Ke**: Urutan jam pelajaran dalam satu hari sesuai jadwal di tabel `lesson_schedules`

## Requirements

### Requirement 1: Konfigurasi Sesi Scan

**User Story:** Sebagai operator atau guru piket, saya ingin mengkonfigurasi sesi scan sebelum memulai absensi, sehingga data absensi tersimpan dengan konteks yang tepat (kelas, mata pelajaran, tanggal, jam ke).

#### Acceptance Criteria

1. WHEN operator mengakses halaman scanner dan berhasil memasukkan PIN yang valid, THE Attendance_System SHALL menampilkan form konfigurasi sesi dengan field: kelas, mata pelajaran, jam ke, dan tanggal
2. WHEN form konfigurasi sesi ditampilkan, THE Attendance_System SHALL mengisi field tanggal secara otomatis dengan tanggal hari ini dan membatasi pilihan tanggal dalam rentang 30 hari ke belakang hingga hari ini
3. WHEN form konfigurasi sesi ditampilkan, THE Attendance_System SHALL memuat daftar kelas aktif dari sekolah yang sesuai dengan `school_id` yang dipilih
4. WHEN form konfigurasi sesi ditampilkan, THE Attendance_System SHALL memuat daftar mata pelajaran aktif dari sekolah yang sesuai dengan `school_id` yang dipilih
5. WHEN form konfigurasi sesi ditampilkan, THE Attendance_System SHALL memuat daftar jam pelajaran dari tabel `lesson_schedules` sesuai `school_id`
6. WHEN operator memilih kelas, THE Attendance_System SHALL memuat daftar siswa aktif dari kelas tersebut sebagai referensi
7. IF salah satu dari field kelas, mata pelajaran, atau jam ke belum dipilih, THEN THE Attendance_System SHALL menonaktifkan tombol mulai scan
8. IF kelas yang dipilih tidak memiliki siswa terdaftar, THEN THE Attendance_System SHALL menampilkan pesan "Tidak ada siswa terdaftar di kelas ini"
9. IF pemuatan data kelas, mata pelajaran, atau jam ke gagal karena kesalahan jaringan atau server, THEN THE Attendance_System SHALL menampilkan pesan error dan menyediakan tombol "Coba Lagi"

### Requirement 2: Scan QR Code Siswa

**User Story:** Sebagai operator atau guru piket, saya ingin melakukan scan QR code dari KTS siswa untuk mencatat kehadiran secara cepat, sehingga proses absensi lebih efisien dibanding pencatatan manual.

#### Acceptance Criteria

1. WHEN operator menekan tombol "Mulai Scan", THE Attendance_System SHALL mengaktifkan kamera perangkat menggunakan infrastruktur `Html5Qrcode` yang sudah ada
2. WHEN QR code dari KTS siswa berhasil terbaca, THE Attendance_System SHALL mencocokkan nilai QR secara case-sensitive dengan kolom `qr_code` pada tabel `students` yang memiliki `school_id` yang sama
3. WHEN QR code cocok dengan siswa yang terdaftar di sekolah tersebut, THE Attendance_System SHALL mencatat status siswa sebagai `Hadir` di memori lokal sesi dan menampilkan Sonner toast sukses dengan nama siswa
4. WHEN QR code tidak cocok dengan siswa manapun di sekolah tersebut, THE Attendance_System SHALL menampilkan pesan "Siswa tidak ditemukan di sekolah ini" tanpa menghentikan sesi scan
5. WHEN siswa yang sama di-scan lebih dari satu kali dalam sesi yang sama, THE Attendance_System SHALL menampilkan pesan "Siswa sudah tercatat hadir" dan tidak mengubah status di memori lokal
6. THE Attendance_System SHALL menerapkan cooldown 2,5 detik setelah setiap pembacaan QR berhasil, di mana semua pembacaan QR berikutnya diabaikan selama periode tersebut
7. THE Attendance_System SHALL menampilkan riwayat scan dalam sesi berjalan, berisi: nama siswa, status, dan waktu scan dalam format HH:MM:SS
8. WHILE sesi scan aktif, THE Attendance_System SHALL menampilkan jumlah siswa yang sudah ter-scan dari total siswa di kelas tersebut
9. IF kamera tidak dapat diakses karena izin browser ditolak, THEN THE Attendance_System SHALL menampilkan pesan "Gagal membuka kamera. Periksa izin browser." dan tombol yang mengarahkan ke halaman edit manual
10. IF kamera membaca nilai QR yang kosong atau tidak dapat diparse, THEN THE Attendance_System SHALL mengabaikan pembacaan tersebut tanpa menampilkan notifikasi error

### Requirement 3: Pengelolaan Status Default Siswa yang Tidak Hadir

**User Story:** Sebagai operator, saya ingin siswa yang tidak di-scan otomatis mendapat status `Alpa`, sehingga saya tidak perlu mengisi satu per satu untuk siswa yang tidak hadir.

#### Acceptance Criteria

1. WHEN operator menekan tombol "Selesai & Simpan", THE Attendance_System SHALL menetapkan status `Alpa` untuk semua siswa di kelas tersebut yang statusnya masih `Alpa` di memori lokal sesi (belum ter-scan sebagai `Hadir`)
2. WHEN operator menekan tombol "Selesai & Simpan", THE Attendance_System SHALL menyimpan seluruh data absensi sesi sebagai satu record `StudentAttendanceLog`
3. THE Attendance_System SHALL menggunakan pola `updateOrCreate` berdasarkan kombinasi `school_id`, `class_id`, `subject_id`, dan `tanggal` untuk mencegah duplikasi log
4. WHEN penyimpanan berhasil, THE Attendance_System SHALL menampilkan dialog ringkasan yang memuat: jumlah hadir, sakit, izin, dan alpa
5. IF penyimpanan gagal karena kesalahan jaringan atau server, THEN THE Attendance_System SHALL menampilkan pesan error dan mempertahankan data sesi di memori agar operator dapat mencoba ulang
6. IF kelas yang dipilih tidak memiliki siswa terdaftar saat tombol "Selesai & Simpan" ditekan, THEN THE Attendance_System SHALL menampilkan pesan "Tidak ada siswa untuk disimpan" dan tidak melakukan penyimpanan

### Requirement 4: Edit Manual Status Absensi

**User Story:** Sebagai operator, saya ingin mengedit status absensi siswa secara manual setelah sesi scan selesai, sehingga saya dapat melakukan koreksi untuk siswa yang sakit atau izin namun tidak hadir saat scan.

#### Acceptance Criteria

1. WHEN operator mengakses halaman edit absensi untuk satu sesi, THE Attendance_System SHALL menampilkan tabel seluruh siswa di kelas tersebut beserta status absensi terakhir yang tersimpan di `StudentAttendanceLog`
2. THE Attendance_System SHALL menyediakan dropdown untuk mengubah status setiap siswa menjadi: `Hadir`, `Sakit`, `Izin`, atau `Alpa`
3. WHEN operator mengubah status satu atau lebih siswa dan menekan tombol "Simpan Perubahan", THE Attendance_System SHALL memperbarui array `logs` dalam record `StudentAttendanceLog` yang sesuai
4. WHEN operator mengubah status siswa, THE Attendance_System SHALL menampilkan indikator visual (misalnya badge "Diubah Manual") pada baris tersebut, dan indikator ini tetap tampil setelah penyimpanan berhasil
5. WHEN perubahan berhasil disimpan, THE Attendance_System SHALL menampilkan notifikasi "Absensi berhasil diperbarui"
6. THE Attendance_System SHALL mengizinkan operator menambahkan keterangan teks bebas maksimal 255 karakter per siswa
7. IF operator mencoba menyimpan tanpa ada perubahan, THEN THE Attendance_System SHALL menampilkan pesan "Tidak ada perubahan yang perlu disimpan"
8. IF penyimpanan perubahan gagal, THEN THE Attendance_System SHALL menampilkan pesan error dan mempertahankan perubahan yang belum tersimpan di form agar operator dapat mencoba ulang

### Requirement 5: Kontrol Akses dan Autentikasi Scanner

**User Story:** Sebagai sistem, saya ingin memastikan hanya petugas yang berwenang yang dapat mengakses halaman scanner, sehingga data absensi tidak dapat dimanipulasi oleh pihak yang tidak berwenang.

#### Acceptance Criteria

1. THE Attendance_System SHALL melindungi halaman scanner publik dengan Scanner_PIN berformat numerik 4–6 digit yang dikonfigurasi per sekolah di tabel `attendance_settings`
2. WHEN petugas memasukkan PIN yang benar untuk sekolah yang dipilih, THE Attendance_System SHALL mengizinkan akses ke form konfigurasi sesi
3. WHEN petugas memasukkan PIN yang salah, THE Attendance_System SHALL menampilkan pesan "PIN salah. Coba lagi." dan tidak memberikan akses
4. IF petugas memasukkan PIN yang salah sebanyak 5 kali berturut-turut, THEN THE Attendance_System SHALL mengunci akses selama 5 menit dan menampilkan pesan "Terlalu banyak percobaan. Coba lagi dalam 5 menit."
5. IF Scanner_PIN belum dikonfigurasi untuk sekolah tersebut, THEN THE Attendance_System SHALL menampilkan pesan "PIN scanner belum dikonfigurasi. Hubungi operator sekolah."
6. WHEN operator menekan tombol "Selesai & Simpan", THE Attendance_System SHALL menyertakan PIN dalam payload request ke endpoint publik sebagai validasi ulang sebelum data disimpan
7. THE Attendance_System SHALL menggunakan endpoint publik (`/api/public/attendance/*`) yang tidak memerlukan token Sanctum untuk operasi scanner, sesuai pola `PublicAttendanceController`

### Requirement 6: Kontrol Akses Berbasis Role untuk Manajemen Absensi

**User Story:** Sebagai sistem, saya ingin membatasi akses manajemen absensi berdasarkan role pengguna, sehingga operator hanya dapat mengakses data sekolahnya sendiri.

#### Acceptance Criteria

1. WHEN Operator mengakses halaman manajemen absensi siswa, THE Attendance_System SHALL menampilkan hanya data absensi dari `school_id` milik operator tersebut
2. WHEN Admin_Yayasan atau Super_Admin mengakses halaman manajemen absensi, THE Attendance_System SHALL menampilkan data absensi dari semua sekolah dengan filter sekolah
3. THE Attendance_System SHALL melindungi semua endpoint API manajemen absensi (bukan endpoint publik scanner) dengan middleware `auth:sanctum`
4. WHEN Operator mencoba mengakses atau memodifikasi data absensi sekolah lain melalui API (GET, POST, PUT, DELETE), THE Attendance_System SHALL menolak akses dengan response 403 dan pesan error yang menjelaskan alasan penolakan
5. THE Attendance_System SHALL secara otomatis membatasi semua query data absensi ke `school_id` milik operator yang sedang login, tanpa memerlukan filter manual dari operator
6. WHEN Operator mencoba membuat atau mengubah data absensi untuk `school_id` yang bukan miliknya, THE Attendance_System SHALL menolak operasi tersebut dengan response 403

### Requirement 7: Daftar dan Filter Sesi Absensi

**User Story:** Sebagai operator, saya ingin melihat daftar sesi absensi yang sudah dibuat dengan filter, sehingga saya dapat menemukan dan mengelola data absensi dengan mudah.

#### Acceptance Criteria

1. WHEN operator mengakses halaman daftar absensi, THE Attendance_System SHALL menampilkan daftar sesi absensi dalam bentuk tabel dengan kolom: tanggal, kelas, mata pelajaran, jam ke, jumlah hadir, jumlah alpa, dan aksi, diurutkan dari terbaru ke terlama
2. WHEN operator mengakses halaman daftar absensi, THE Attendance_System SHALL menampilkan filter berdasarkan: tanggal (rentang), kelas, dan mata pelajaran
3. THE Attendance_System SHALL menyediakan pagination dengan 20 sesi per halaman
4. WHEN Operator mengakses daftar absensi, THE Attendance_System SHALL menampilkan hanya sesi dari sekolah operator tersebut
5. WHEN sesi absensi memiliki setidaknya satu siswa dengan status `Alpa` dan belum pernah diubah melalui Edit Manual, THE Attendance_System SHALL menampilkan badge "Belum Ditinjau" pada baris sesi tersebut
6. WHEN operator mengklik tombol "Edit" pada satu sesi, THE Attendance_System SHALL mengarahkan ke halaman edit manual untuk sesi tersebut
7. IF filter yang diterapkan tidak menghasilkan data, THEN THE Attendance_System SHALL menampilkan pesan "Tidak ada data absensi untuk filter yang dipilih"

### Requirement 8: Laporan Rekap Absensi Siswa

**User Story:** Sebagai operator atau admin, saya ingin melihat laporan rekap absensi siswa per kelas dan mata pelajaran dalam satu bulan, sehingga saya dapat memantau tingkat kehadiran dan mengidentifikasi siswa yang sering tidak hadir.

#### Acceptance Criteria

1. WHEN operator mengakses halaman laporan absensi, THE Attendance_System SHALL menampilkan form filter dengan field: kelas, mata pelajaran, dan bulan (format YYYY-MM)
2. IF salah satu field filter belum diisi, THEN THE Attendance_System SHALL menonaktifkan tombol submit
3. WHEN filter disubmit, THE Attendance_System SHALL menampilkan matriks absensi dengan baris berisi nama siswa dan kolom berisi tanggal dalam bulan tersebut yang memiliki sesi absensi
4. THE Attendance_System SHALL menampilkan status absensi per sel matriks dengan kode warna: Hadir (hijau), Sakit (kuning), Izin (biru), Alpa (merah), dan kosong untuk hari tanpa sesi
5. THE Attendance_System SHALL menampilkan ringkasan per siswa: total hadir, sakit, izin, alpa, dan persentase kehadiran dihitung sebagai (jumlah Hadir / total sesi yang ada di bulan tersebut) × 100%
6. WHEN tidak ada data absensi untuk filter yang dipilih, THE Attendance_System SHALL menampilkan pesan "Belum ada data absensi untuk periode ini"
7. WHILE data laporan sedang dimuat, THE Attendance_System SHALL menampilkan indikator loading

### Requirement 9: Validasi QR Code Siswa

**User Story:** Sebagai sistem, saya ingin memvalidasi QR code yang di-scan dengan data siswa yang terdaftar, sehingga hanya QR code yang valid dan sesuai sekolah yang dapat mencatat kehadiran.

#### Acceptance Criteria

1. WHEN QR code di-scan, THE Attendance_System SHALL mencocokkan nilai QR secara case-sensitive dengan kolom `qr_code` pada tabel `students` menggunakan query yang di-scope ke `school_id` yang aktif
2. IF nilai QR yang di-scan kosong atau tidak dapat diparse, THEN THE Attendance_System SHALL mengabaikan pembacaan tersebut tanpa menampilkan notifikasi error
3. WHEN QR code cocok dengan siswa di sekolah tersebut, THE Attendance_System SHALL memvalidasi bahwa siswa memiliki status `Aktif` di kolom `status`
4. IF siswa ditemukan namun berstatus selain `Aktif` (misalnya `Lulus` atau `Keluar`), THEN THE Attendance_System SHALL menampilkan pesan "Siswa tidak aktif: [nama siswa]", tidak mencatat kehadiran, dan melanjutkan sesi scan
5. IF siswa ditemukan dan berstatus `Aktif` namun tidak terdaftar di kelas yang dipilih, THEN THE Attendance_System SHALL menampilkan pesan "Siswa [nama] bukan anggota kelas ini", tidak mencatat kehadiran, dan melanjutkan sesi scan
6. THE Attendance_System SHALL menjalankan validasi secara berurutan: (1) cocokkan QR dengan school_id → (2) validasi status Aktif → (3) validasi keanggotaan kelas

### Requirement 10: Sinkronisasi Data Siswa dengan Kelas

**User Story:** Sebagai sistem, saya ingin memastikan daftar siswa yang ditampilkan dalam sesi scan sesuai dengan kelas yang dipilih, sehingga operator dapat memverifikasi siapa saja yang seharusnya hadir.

#### Acceptance Criteria

1. WHEN operator memilih kelas dalam konfigurasi sesi, THE Attendance_System SHALL memuat daftar siswa aktif yang terdaftar di kelas tersebut
2. WHILE sesi scan berlangsung, THE Attendance_System SHALL menampilkan jumlah total siswa di kelas tersebut sebagai referensi
3. WHEN sesi scan dimulai, THE Attendance_System SHALL menginisialisasi semua siswa di kelas tersebut dengan status default `Alpa`
4. WHEN QR code siswa berhasil di-scan dan divalidasi, THE Attendance_System SHALL memperbarui status siswa tersebut menjadi `Hadir` dalam waktu ≤1 detik
5. WHILE sesi scan berlangsung, THE Attendance_System SHALL menampilkan daftar siswa yang belum berstatus `Hadir` agar operator dapat memantau siapa yang belum hadir
6. IF pemuatan daftar siswa untuk kelas yang dipilih gagal, THEN THE Attendance_System SHALL menampilkan pesan error dan menonaktifkan tombol "Mulai Scan" hingga data berhasil dimuat

### Requirement 11: Notifikasi dan Feedback Scan Real-Time

**User Story:** Sebagai operator yang melakukan scan, saya ingin mendapatkan feedback visual dan audio yang jelas setiap kali scan berhasil atau gagal, sehingga saya dapat melakukan scan dengan cepat tanpa harus melihat layar terus-menerus.

#### Acceptance Criteria

1. WHEN scan QR code berhasil dan siswa ditemukan, THE Attendance_System SHALL menampilkan Sonner toast sukses dengan teks "[nama siswa] — Hadir"
2. WHEN scan QR code gagal karena siswa tidak ditemukan di sekolah tersebut, THE Attendance_System SHALL menampilkan Sonner toast error dengan teks "Siswa tidak ditemukan di sekolah ini"
3. WHEN scan QR code menghasilkan duplikasi (siswa sudah berstatus Hadir), THE Attendance_System SHALL menampilkan Sonner toast peringatan dengan teks "[nama siswa] sudah tercatat hadir"
4. WHEN scan QR code berhasil, THE Attendance_System SHALL memutar suara beep pendek (≤500ms) sebagai feedback audio
5. WHEN scan QR code berhasil, THE Attendance_System SHALL mengubah warna border area scanner menjadi hijau selama 1 detik
6. WHEN scan QR code gagal (siswa tidak ditemukan atau tidak valid), THE Attendance_System SHALL mengubah warna border area scanner menjadi merah selama 1 detik
7. WHEN scan QR code berhasil, THE Attendance_System SHALL memperbarui counter "X dari Y siswa hadir" dalam waktu ≤1 detik

### Requirement 12: Penanganan Siswa Tanpa QR Code

**User Story:** Sebagai operator, saya ingin tetap dapat mencatat kehadiran siswa yang tidak memiliki QR code di KTS-nya, sehingga tidak ada siswa yang terlewat dalam pencatatan absensi.

#### Acceptance Criteria

1. WHEN operator mengakses halaman edit manual, THE Attendance_System SHALL menampilkan seluruh siswa di kelas tersebut termasuk siswa yang kolom `qr_code`-nya bernilai null atau string kosong
2. WHEN operator mengubah status siswa yang tidak memiliki QR code, THE Attendance_System SHALL mengizinkan pemilihan status melalui dropdown dengan pilihan: `Hadir`, `Sakit`, `Izin`, atau `Alpa`
3. WHEN operator mengakses halaman edit manual, THE Attendance_System SHALL menampilkan ikon peringatan pada setiap baris siswa yang tidak memiliki QR code agar operator mengetahui siswa tersebut tidak dapat di-scan
4. IF semua siswa di kelas tidak memiliki QR code, THEN THE Attendance_System SHALL menampilkan pesan informatif "Siswa di kelas ini belum memiliki QR code. Gunakan mode edit manual."
5. WHEN operator menyimpan perubahan status siswa tanpa QR code, THE Attendance_System SHALL menampilkan notifikasi "Absensi berhasil diperbarui" jika penyimpanan berhasil, atau pesan error yang menjelaskan kegagalan jika penyimpanan gagal

### Requirement 13: Integrasi dengan Infrastruktur yang Sudah Ada

**User Story:** Sebagai sistem, saya ingin fitur absensi QR siswa menggunakan komponen dan pola yang sudah ada, sehingga konsistensi codebase terjaga dan tidak ada duplikasi kode.

#### Acceptance Criteria

1. THE Attendance_System SHALL menggunakan model `StudentAttendanceLog` yang sudah ada dengan kolom `logs` berformat JSON array, di mana setiap elemen array memuat minimal: `student_id`, `status`, dan opsional `keterangan`
2. THE Attendance_System SHALL menggunakan endpoint publik `PublicAttendanceController` yang sudah ada untuk operasi scanner: verifikasi PIN, ambil kelas, ambil siswa, dan simpan log absensi
3. THE Attendance_System SHALL menggunakan endpoint Sanctum-protected `/api/attendance/*` untuk operasi manajemen absensi: daftar sesi, edit manual, dan laporan
4. THE Attendance_System SHALL menggunakan library `Html5Qrcode` yang sudah terpasang untuk fungsi kamera scanner
5. THE Attendance_System SHALL menggunakan komponen UI Shadcn/UI yang sudah ada (Card, Button, Select, Badge, Input) untuk konsistensi tampilan
6. THE Attendance_System SHALL menggunakan `apiClient` dari `src/lib/api.ts` untuk semua pemanggilan API yang memerlukan autentikasi Sanctum
7. WHEN halaman manajemen absensi (daftar, edit, laporan) memuat data, THE Attendance_System SHALL menggunakan TanStack Query untuk data fetching dan caching

### Requirement 14: Navigasi dan Routing

**User Story:** Sebagai operator, saya ingin mengakses fitur absensi siswa QR dari menu navigasi yang sudah ada, sehingga saya dapat menemukan fitur ini dengan mudah.

#### Acceptance Criteria

1. THE Attendance_System SHALL menambahkan akses ke halaman scanner siswa QR dari menu atau halaman absensi yang sudah ada di `src/features/attendance/`
2. THE Attendance_System SHALL mendaftarkan route untuk halaman edit manual absensi siswa yang dilindungi autentikasi Sanctum
3. THE Attendance_System SHALL mendaftarkan route publik untuk halaman scanner yang hanya dilindungi PIN (tanpa Sanctum), konsisten dengan pola `/scan` yang sudah ada
4. WHEN user yang tidak terautentikasi mengakses halaman manajemen absensi, THE Attendance_System SHALL mengarahkan ke halaman login

### Requirement 15: Responsive Design untuk Perangkat Mobile

**User Story:** Sebagai operator yang melakukan scan di lapangan, saya ingin halaman scanner dapat digunakan dengan nyaman di perangkat mobile, sehingga proses absensi dapat dilakukan di mana saja.

#### Acceptance Criteria

1. WHEN halaman scanner diakses pada viewport width ≤768px dalam orientasi portrait, THE Attendance_System SHALL menampilkan layout single-column dengan area kamera di atas dan kontrol di bawah
2. WHEN halaman scanner diakses pada viewport width ≤768px, THE Attendance_System SHALL memastikan area kamera scanner memiliki ukuran minimal 280×280 piksel
3. WHEN halaman scanner diakses pada viewport width ≤768px, THE Attendance_System SHALL memastikan tombol aksi (Mulai Scan, Selesai & Simpan) memiliki tinggi minimal 56 piksel
4. WHEN halaman edit manual diakses pada viewport width ≤768px, THE Attendance_System SHALL menampilkan tabel dalam container yang dapat di-scroll secara horizontal
5. WHEN halaman scanner diakses pada viewport width ≤768px dalam orientasi landscape, THE Attendance_System SHALL menampilkan area kamera di sisi kiri dan riwayat scan di sisi kanan dalam layout dua kolom
6. THE Attendance_System SHALL menggunakan Tailwind CSS responsive utilities (`sm:`, `md:`) untuk semua penyesuaian layout antar breakpoint

### Requirement 16: Error Handling dan Ketahanan Sistem

**User Story:** Sebagai operator, saya ingin sistem menangani error dengan baik dan tidak kehilangan data absensi yang sudah di-scan, sehingga proses absensi tidak terganggu oleh masalah teknis.

#### Acceptance Criteria

1. WHEN koneksi jaringan terputus saat sesi scan berlangsung, THE Attendance_System SHALL mempertahankan data scan di persistent local storage (survive page refresh) dan menampilkan indikator "Mode Offline" beserta jumlah scan yang tertunda
2. WHEN koneksi jaringan pulih setelah mode offline, THE Attendance_System SHALL menampilkan notifikasi "Koneksi pulih" dan mengaktifkan tombol "Simpan Data Tertunda"
3. IF sinkronisasi data tertunda gagal setelah koneksi pulih, THEN THE Attendance_System SHALL menampilkan pesan error dan mempertahankan data di local storage untuk percobaan ulang berikutnya
4. WHEN validasi form gagal saat konfigurasi sesi, THE Attendance_System SHALL menampilkan pesan error di bawah field yang bermasalah
5. IF server mengembalikan error 5xx, THEN THE Attendance_System SHALL menampilkan Sonner toast error dengan pesan "Terjadi kesalahan pada server. Silakan coba lagi."
6. THE Attendance_System SHALL mencatat error yang terjadi menggunakan Sentry (`@sentry/react`) untuk monitoring

### Requirement 17: Activity Logging

**User Story:** Sebagai sistem, saya ingin mencatat semua aktivitas terkait absensi siswa, sehingga ada audit trail yang dapat ditelusuri.

#### Acceptance Criteria

1. WHEN sesi absensi baru disimpan melalui scanner, THE Attendance_System SHALL mencatat aktivitas pembuatan record melalui `AuditLogTrait` yang sudah ada pada model `StudentAttendanceLog`
2. WHEN operator mengedit status absensi secara manual, THE Attendance_System SHALL mencatat aktivitas perubahan di `ActivityLog` dengan informasi: `causer_id` (ID operator yang mengubah), field yang diubah, nilai lama, dan nilai baru
3. WHEN sesi absensi disimpan melalui scanner, THE Attendance_System SHALL menyimpan informasi `scanned_by` (nama petugas atau "Scanner Publik") di dalam setiap elemen array `logs` pada record `StudentAttendanceLog`
4. WHEN record `StudentAttendanceLog` dihapus (soft delete), THE Attendance_System SHALL mencatat aktivitas penghapusan secara otomatis melalui `AuditLogTrait`
