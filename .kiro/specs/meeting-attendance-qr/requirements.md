# Requirements Document: Absensi Rapat Yayasan dengan QR Code

## Introduction

Sistem absensi untuk rapat tingkat yayasan/cabang LP Ma'arif NU Cilacap yang melibatkan kepala sekolah, guru dari berbagai sekolah, dan pihak eksternal. Sistem menggunakan QR code untuk check-in, mendukung delegasi dengan surat tugas, peserta walk-in, dan terintegrasi dengan sistem WA blast untuk pengiriman undangan dan reminder.

## Glossary

- **Meeting_System**: Sistem absensi rapat yayasan
- **Admin_Yayasan**: User dengan role `admin_yayasan` yang dapat membuat dan mengelola rapat
- **Super_Admin**: User dengan role `super_admin` yang memiliki akses penuh
- **Operator**: User dengan role `operator` yang memiliki akses read-only
- **Peserta**: Individu yang terdaftar atau hadir dalam rapat (kepala sekolah, guru, atau pihak eksternal)
- **QR_Personal**: QR code unik per peserta terdaftar untuk check-in
- **QR_Umum**: QR code untuk peserta walk-in yang tidak terdaftar sebelumnya
- **Check_In**: Proses pencatatan waktu masuk rapat
- **Delegasi**: Peserta yang hadir mewakili peserta lain dengan surat tugas
- **Walk_In**: Peserta tambahan yang tidak terdaftar sebelumnya
- **WA_Blast_System**: Sistem pengiriman pesan WhatsApp massal yang sudah ada
- **Laporan_PDF**: Dokumen laporan kehadiran rapat dalam format PDF
- **QR_Scanner**: Infrastruktur scanner QR code yang sudah ada di `src/features/attendance/`
- **Signed_Token**: Token yang di-sign dengan Laravel signed URL untuk mencegah forgery
- **One_Time_Token**: Token yang hanya bisa digunakan sekali untuk check-in
- **Device_Info**: Informasi device peserta (IP address, user agent, browser, OS, device type)
- **Geolocation_Validation**: Validasi lokasi peserta saat check-in berdasarkan GPS coordinates
- **Rate_Limiting**: Pembatasan jumlah check-in dari kombinasi IP address dan participant_id yang sama dalam periode waktu tertentu
- **Pessimistic_Locking**: Teknik database locking menggunakan `SELECT FOR UPDATE` untuk mencegah race condition pada operasi concurrent
- **Optimistic_Locking**: Teknik database locking menggunakan kolom `version` untuk mendeteksi konflik pada operasi concurrent

## Requirements

### Requirement 1: Pembuatan Rapat

**User Story:** Sebagai Admin_Yayasan atau Super_Admin, saya ingin membuat rapat yayasan baru dengan detail lengkap dan daftar peserta, sehingga rapat dapat dikelola secara terstruktur.

#### Acceptance Criteria

1. THE Meeting_System SHALL menyimpan data rapat dengan field: judul, tanggal mulai, tanggal selesai, waktu mulai, waktu selesai, lokasi, agenda, status, dan timestamp pembuatan
2. WHEN Admin_Yayasan atau Super_Admin membuat rapat, THE Meeting_System SHALL memvalidasi bahwa tanggal dan waktu selesai lebih besar dari tanggal dan waktu mulai
3. THE Meeting_System SHALL menyimpan daftar peserta terdaftar dengan informasi: nama, jabatan, asal sekolah/instansi, nomor WhatsApp, dan status peserta
4. WHEN rapat dibuat dengan checkbox "Kirim undangan WA" aktif, THE Meeting_System SHALL mengirim undangan via WA_Blast_System segera setelah rapat tersimpan
5. WHEN rapat dibuat dengan checkbox "Kirim reminder WA" aktif, THE Meeting_System SHALL menjadwalkan pengiriman reminder sesuai timing yang dipilih (H-1, 2 jam sebelum, atau custom)
6. THE Meeting_System SHALL menghasilkan QR_Personal unik untuk setiap peserta terdaftar dengan Signed_Token
7. THE Meeting_System SHALL menghasilkan QR_Umum untuk rapat yang dapat digunakan peserta walk-in
8. THE Meeting_System SHALL menyimpan informasi sekolah yang terlibat dalam rapat
9. WHEN peserta dipilih dari sekolah tertentu, THE Meeting_System SHALL menyediakan auto-suggest kepala sekolah dan guru dari sekolah tersebut
10. THE Meeting_System SHALL mengizinkan input manual untuk peserta eksternal (non-sekolah)
11. WHERE Admin_Yayasan atau Super_Admin mengaktifkan checkbox "Validasi Lokasi", THE Meeting_System SHALL menyimpan koordinat lokasi rapat (latitude, longitude) dan radius validasi dalam meter
12. WHERE checkbox "Validasi Lokasi" tidak aktif, THE Meeting_System SHALL melewati validasi geolocation saat check-in

### Requirement 2: Kontrol Akses Pembuatan Rapat

**User Story:** Sebagai sistem, saya ingin membatasi pembuatan rapat hanya untuk role tertentu, sehingga integritas data terjaga.

#### Acceptance Criteria

1. WHEN user dengan role Admin_Yayasan atau Super_Admin mengakses fitur pembuatan rapat, THE Meeting_System SHALL mengizinkan akses
2. WHEN user dengan role Operator mengakses fitur pembuatan rapat, THE Meeting_System SHALL menolak akses dengan response 403
3. THE Meeting_System SHALL mencatat user_id pembuat rapat sebagai `created_by`

### Requirement 3: Akses Read-Only untuk Operator

**User Story:** Sebagai Operator, saya ingin melihat rapat yang melibatkan sekolah saya, sehingga saya dapat memantau kehadiran staf sekolah.

#### Acceptance Criteria

1. WHEN Operator mengakses daftar rapat, THE Meeting_System SHALL menampilkan hanya rapat yang melibatkan sekolah mereka
2. WHEN Operator mengakses detail rapat, THE Meeting_System SHALL menampilkan informasi lengkap rapat dan daftar kehadiran
3. THE Meeting_System SHALL menonaktifkan tombol edit dan hapus untuk Operator
4. WHERE Operator terdaftar sebagai peserta rapat, THE Meeting_System SHALL mengizinkan Operator untuk scan QR_Personal mereka

### Requirement 4: Check-In dengan QR Personal

**User Story:** Sebagai Peserta terdaftar, saya ingin melakukan check-in dengan QR_Personal saya yang aman dan tervalidasi, sehingga kehadiran saya tercatat secara otomatis dengan bukti digital yang kuat.

#### Acceptance Criteria

1. WHEN Peserta scan QR_Personal mereka, THE Meeting_System SHALL memvalidasi Signed_Token menggunakan Laravel signed URL verification
2. WHEN Signed_Token tidak valid atau telah dimodifikasi, THE Meeting_System SHALL menolak check-in dengan pesan "QR Code tidak valid atau telah dimodifikasi"
3. WHEN Signed_Token sudah expired (di luar rentang H-1 sampai H+1 dari waktu rapat), THE Meeting_System SHALL menolak check-in dengan pesan "QR Code sudah tidak berlaku"
4. WHEN QR_Personal valid dan belum pernah check-in, THE Meeting_System SHALL mencatat waktu check-in dengan timestamp presisi tinggi (microseconds)
5. WHEN QR_Personal sudah pernah check-in (One_Time_Token sudah digunakan), THE Meeting_System SHALL menampilkan pesan "Anda sudah check-in pada [timestamp]"
6. WHEN check-in dari IP address yang sama melebihi 5 kali dalam 5 menit, THE Meeting_System SHALL menolak check-in dengan pesan "Terlalu banyak percobaan. Silakan tunggu beberapa menit."
7. WHERE Geolocation_Validation aktif untuk rapat, WHEN Peserta melakukan check-in, THE Meeting_System SHALL meminta geolocation dari browser peserta
8. WHERE Geolocation_Validation aktif, WHEN jarak peserta dari lokasi rapat melebihi radius yang ditentukan, THE Meeting_System SHALL menolak check-in dengan pesan "Anda berada di luar area rapat"
9. WHERE Geolocation_Validation tidak aktif, THE Meeting_System SHALL melewati validasi lokasi
10. WHEN check-in berhasil, THE Meeting_System SHALL menyimpan Device_Info: IP address, user agent (browser, OS, device type), dan timestamp presisi tinggi
11. WHEN check-in berhasil, THE Meeting_System SHALL menandai token sebagai "used" untuk mencegah penggunaan ulang
12. THE Meeting_System SHALL menggunakan infrastruktur QR_Scanner yang sudah ada di `src/features/attendance/`
13. WHEN check-in berhasil, THE Meeting_System SHALL menampilkan konfirmasi dengan nama peserta, waktu check-in, dan device info

### Requirement 5: Delegasi dengan Surat Tugas

**User Story:** Sebagai Peserta yang hadir sebagai delegasi, saya ingin mencatat bahwa saya mewakili orang lain dengan upload surat tugas, sehingga kehadiran delegasi tercatat dengan bukti.

#### Acceptance Criteria

1. WHEN Peserta melakukan check-in, THE Meeting_System SHALL menampilkan opsi "Hadir sebagai delegasi"
2. WHEN opsi delegasi dipilih, THE Meeting_System SHALL menampilkan field untuk memilih peserta yang diwakili dan upload foto surat tugas
3. THE Meeting_System SHALL memvalidasi bahwa file surat tugas adalah gambar (JPEG, PNG) atau PDF dengan ukuran maksimal 5 MB
4. WHEN delegasi berhasil dicatat, THE Meeting_System SHALL menyimpan informasi: peserta yang hadir, peserta yang diwakili, dan URL file surat tugas
5. THE Meeting_System SHALL menampilkan status kehadiran sebagai "Hadir (Delegasi)" dengan keterangan "mewakili [Nama Peserta]"
6. THE Meeting_System SHALL hanya mengizinkan opsi delegasi untuk peserta terdaftar yang check-in via QR_Personal, bukan untuk peserta walk-in

### Requirement 6: Walk-In dengan QR Umum

**User Story:** Sebagai peserta walk-in yang tidak terdaftar, saya ingin melakukan check-in dengan QR_Umum dan mengisi identitas saya, sehingga kehadiran saya tercatat.

#### Acceptance Criteria

1. WHEN peserta scan QR_Umum, THE Meeting_System SHALL menampilkan form identitas dengan field: nama, jabatan, asal sekolah/instansi, nomor WhatsApp
2. THE Meeting_System SHALL memvalidasi bahwa semua field wajib diisi
3. THE Meeting_System SHALL menormalisasi nomor WhatsApp dengan format `62XXXXXXXXX`
4. WHEN form disubmit, THE Meeting_System SHALL mencatat peserta walk-in dengan status "Hadir (Walk-in)" dan waktu check-in saat ini
5. THE Meeting_System SHALL menampilkan konfirmasi check-in berhasil dengan nama peserta
6. THE Meeting_System SHALL menghasilkan QR_Umum sebagai signed URL dengan expiry H-1 sampai H+1 dari waktu mulai rapat
7. WHEN QR_Umum di-scan, THE Meeting_System SHALL memvalidasi signature dan expiry token sebelum menampilkan form identitas
8. WHEN QR_Umum expired, THE Meeting_System SHALL menampilkan pesan "QR Code rapat sudah tidak berlaku"
9. THE Meeting_System SHALL mengizinkan QR_Umum digunakan berkali-kali oleh peserta berbeda (tidak one-time use)
10. WHERE Geolocation_Validation aktif untuk rapat, WHEN peserta walk-in scan QR_Umum, THE Meeting_System SHALL meminta geolocation dari browser peserta dan memvalidasi jarak sebelum menampilkan form identitas
11. WHERE Geolocation_Validation tidak aktif, THE Meeting_System SHALL langsung menampilkan form identitas tanpa validasi lokasi
12. THE Meeting_System SHALL tidak menampilkan opsi delegasi untuk peserta walk-in

### Requirement 7: Check-In Manual oleh Admin

**User Story:** Sebagai Admin_Yayasan atau Super_Admin, saya ingin melakukan check-in manual untuk peserta, sehingga kehadiran tetap tercatat meskipun QR code tidak dapat digunakan.

#### Acceptance Criteria

1. WHEN Admin_Yayasan atau Super_Admin mengakses halaman detail rapat, THE Meeting_System SHALL menampilkan tombol "Check-in Manual" untuk setiap peserta yang belum check-in
2. WHEN tombol check-in manual diklik, THE Meeting_System SHALL mencatat waktu check-in dengan timestamp saat ini
3. THE Meeting_System SHALL menandai kehadiran sebagai "Check-in Manual" dengan informasi admin yang melakukan check-in

### Requirement 8: Integrasi WA Blast untuk Undangan

**User Story:** Sebagai Admin_Yayasan, saya ingin mengirim undangan rapat via WhatsApp secara otomatis, sehingga peserta menerima informasi rapat dan QR_Personal mereka.

#### Acceptance Criteria

1. WHEN rapat dibuat dengan checkbox "Kirim undangan WA" aktif, THE Meeting_System SHALL membuat blast WA via WA_Blast_System
2. THE Meeting_System SHALL menyusun pesan undangan dengan template yang berisi: judul rapat, tanggal, waktu, lokasi, agenda, dan link QR_Personal
3. THE Meeting_System SHALL mengirim undangan ke semua peserta terdaftar yang memiliki nomor WhatsApp valid
4. THE Meeting_System SHALL menyimpan referensi blast_id dari WA_Blast_System untuk tracking
5. WHEN pengiriman undangan gagal untuk peserta tertentu, THE Meeting_System SHALL mencatat status pengiriman sebagai "failed" untuk peserta tersebut

### Requirement 9: Integrasi WA Blast untuk Reminder

**User Story:** Sebagai Admin_Yayasan, saya ingin mengirim reminder rapat via WhatsApp sebelum rapat dimulai, sehingga peserta tidak lupa hadir.

#### Acceptance Criteria

1. WHEN rapat dibuat dengan checkbox "Kirim reminder WA" aktif, THE Meeting_System SHALL menjadwalkan pengiriman reminder sesuai timing yang dipilih
2. THE Meeting_System SHALL mendukung timing reminder: H-1 (24 jam sebelum), 2 jam sebelum, atau custom (input manual)
3. WHEN waktu reminder tiba, THE Meeting_System SHALL membuat blast WA via WA_Blast_System dengan pesan reminder
4. THE Meeting_System SHALL menyusun pesan reminder dengan template yang berisi: pengingat singkat, judul rapat, waktu, dan link QR_Personal
5. THE Meeting_System SHALL mengirim reminder hanya ke peserta yang belum check-in
6. WHEN admin memilih timing custom, THE Meeting_System SHALL memvalidasi bahwa waktu reminder minimal 30 menit sebelum waktu mulai rapat
7. THE Meeting_System SHALL memvalidasi bahwa waktu reminder maksimal 7 hari (168 jam) sebelum waktu mulai rapat
8. WHEN waktu reminder sudah lewat saat rapat dibuat atau diedit, THE Meeting_System SHALL menampilkan pesan error "Waktu reminder sudah lewat. Silakan pilih waktu yang akan datang."

### Requirement 10: Laporan PDF Kehadiran

**User Story:** Sebagai Admin_Yayasan atau Super_Admin, saya ingin mengunduh laporan kehadiran rapat dalam format PDF dengan informasi verifikasi lengkap, sehingga saya memiliki dokumentasi resmi yang dapat dipertanggungjawabkan.

#### Acceptance Criteria

1. WHEN Admin_Yayasan atau Super_Admin mengakses halaman detail rapat, THE Meeting_System SHALL menampilkan tombol "Unduh Laporan PDF"
2. WHEN tombol diklik, THE Meeting_System SHALL menghasilkan PDF dengan header: logo LP Ma'arif NU Cilacap, judul "DAFTAR HADIR RAPAT", nama rapat, tanggal, waktu, lokasi, agenda
3. THE Meeting_System SHALL menampilkan ringkasan statistik dalam PDF: total peserta terdaftar, total hadir dengan persentase, total tidak hadir dengan persentase, total delegasi, total walk-in
4. THE Meeting_System SHALL menampilkan tabel daftar hadir dengan kolom: No, Nama, Jabatan, Asal Sekolah/Instansi, Status, Waktu Check-in, Verifikasi, Keterangan
5. WHERE peserta check-in via QR_Personal, THE Meeting_System SHALL menampilkan di kolom Verifikasi: "✓ Terverifikasi via QR Personal pada [timestamp] dari [device info]"
6. WHERE peserta check-in manual oleh admin, THE Meeting_System SHALL menampilkan di kolom Verifikasi: "✓ Check-in Manual oleh [Admin Name] pada [timestamp]"
7. THE Meeting_System SHALL menampilkan footer dengan: tanggal cetak laporan dan nama admin yang mencetak
8. THE Meeting_System SHALL menggunakan PHPWord untuk generate PDF
9. THE Meeting_System SHALL menggunakan logo dari path `storage/app/public/logo/lp-maarif-nu-cilacap.png` untuk header PDF
10. WHERE file logo tidak ditemukan, THE Meeting_System SHALL menghasilkan PDF tanpa logo dan mencatat warning di log

### Requirement 11: Laporan Excel Kehadiran

**User Story:** Sebagai Admin_Yayasan atau Super_Admin, saya ingin mengunduh laporan kehadiran rapat dalam format Excel, sehingga saya dapat melakukan analisis lebih lanjut.

#### Acceptance Criteria

1. WHEN Admin_Yayasan atau Super_Admin mengakses halaman detail rapat, THE Meeting_System SHALL menampilkan tombol "Unduh Laporan Excel"
2. WHEN tombol diklik, THE Meeting_System SHALL menghasilkan file Excel dengan sheet "Daftar Hadir"
3. THE Meeting_System SHALL menyertakan header informasi rapat di baris pertama
4. THE Meeting_System SHALL menyertakan tabel dengan kolom yang sama seperti PDF
5. THE Meeting_System SHALL menggunakan Maatwebsite Excel untuk generate file

### Requirement 12: Monitoring Progress Real-Time

**User Story:** Sebagai Admin_Yayasan atau Super_Admin, saya ingin melihat progress kehadiran secara real-time, sehingga saya dapat memantau jalannya rapat.

#### Acceptance Criteria

1. WHEN Admin_Yayasan atau Super_Admin mengakses halaman detail rapat, THE Meeting_System SHALL menampilkan statistik kehadiran real-time
2. THE Meeting_System SHALL menampilkan: total peserta, jumlah hadir, jumlah belum hadir, persentase kehadiran
3. THE Meeting_System SHALL memperbarui statistik secara otomatis setiap 10 detik menggunakan polling
4. THE Meeting_System SHALL menampilkan daftar peserta dengan status kehadiran terkini (Hadir, Belum Hadir, Hadir (Delegasi), Hadir (Walk-in))
5. THE Meeting_System SHALL menampilkan waktu check-in untuk peserta yang sudah hadir

### Requirement 13: Daftar Rapat dengan Filter

**User Story:** Sebagai Admin_Yayasan, Super_Admin, atau Operator, saya ingin melihat daftar rapat dengan filter, sehingga saya dapat menemukan rapat yang relevan dengan mudah.

#### Acceptance Criteria

1. THE Meeting_System SHALL menampilkan daftar rapat dalam bentuk tabel dengan kolom: judul, tanggal, waktu, lokasi, total peserta, jumlah hadir, status
2. THE Meeting_System SHALL menyediakan filter berdasarkan: rentang tanggal, status rapat (upcoming, ongoing, completed), dan sekolah yang terlibat
3. WHEN Operator mengakses daftar rapat, THE Meeting_System SHALL menampilkan hanya rapat yang melibatkan sekolah mereka
4. WHEN Admin_Yayasan atau Super_Admin mengakses daftar rapat, THE Meeting_System SHALL menampilkan semua rapat
5. THE Meeting_System SHALL menyediakan pagination dengan 20 rapat per halaman
6. THE Meeting_System SHALL menyediakan search berdasarkan judul rapat

### Requirement 14: Detail Rapat

**User Story:** Sebagai user, saya ingin melihat detail lengkap rapat termasuk informasi device dan verifikasi check-in, sehingga saya memiliki informasi komprehensif dan audit trail yang jelas.

#### Acceptance Criteria

1. WHEN user mengakses halaman detail rapat, THE Meeting_System SHALL menampilkan informasi: judul, tanggal, waktu mulai, waktu selesai, lokasi, agenda, status, pembuat rapat
2. THE Meeting_System SHALL menampilkan daftar sekolah yang terlibat
3. THE Meeting_System SHALL menampilkan statistik kehadiran: total peserta, hadir, tidak hadir, delegasi, walk-in
4. THE Meeting_System SHALL menampilkan tabel daftar peserta dengan status kehadiran, waktu check-in, dan Device_Info untuk peserta yang sudah check-in
5. WHERE peserta sudah check-in via QR_Personal, THE Meeting_System SHALL menampilkan detail: timestamp presisi tinggi, IP address, browser, OS, device type
6. WHERE peserta check-in manual, THE Meeting_System SHALL menampilkan nama admin yang melakukan check-in dan timestamp
7. THE Meeting_System SHALL menampilkan QR_Umum untuk rapat yang dapat di-scan peserta walk-in
8. WHERE user adalah Admin_Yayasan atau Super_Admin, THE Meeting_System SHALL menampilkan tombol: "Unduh Laporan PDF", "Unduh Laporan Excel", "Edit Rapat", "Hapus Rapat"
9. WHERE user adalah Operator, THE Meeting_System SHALL menyembunyikan tombol edit dan hapus

### Requirement 15: Edit Rapat

**User Story:** Sebagai Admin_Yayasan atau Super_Admin, saya ingin mengedit informasi rapat, sehingga saya dapat memperbaiki kesalahan atau memperbarui informasi.

#### Acceptance Criteria

1. WHEN Admin_Yayasan atau Super_Admin mengakses halaman edit rapat, THE Meeting_System SHALL menampilkan form dengan data rapat yang sudah ada
2. THE Meeting_System SHALL mengizinkan perubahan pada: judul, tanggal, waktu, lokasi, agenda, daftar peserta
3. WHEN rapat sudah dimulai (status ongoing atau completed), THE Meeting_System SHALL menonaktifkan perubahan tanggal dan waktu
4. WHEN peserta dihapus dari daftar, THE Meeting_System SHALL menghapus QR_Personal peserta tersebut
5. WHEN peserta baru ditambahkan, THE Meeting_System SHALL menghasilkan QR_Personal baru untuk peserta tersebut
6. THE Meeting_System SHALL mencatat perubahan dalam activity log

### Requirement 16: Hapus Rapat

**User Story:** Sebagai Admin_Yayasan atau Super_Admin, saya ingin menghapus rapat, sehingga rapat yang tidak jadi atau salah dapat dihapus.

#### Acceptance Criteria

1. WHEN Admin_Yayasan atau Super_Admin menghapus rapat, THE Meeting_System SHALL melakukan soft delete pada record rapat
2. THE Meeting_System SHALL melakukan soft delete pada semua peserta terkait
3. THE Meeting_System SHALL melakukan soft delete pada semua record kehadiran terkait
4. WHEN rapat sudah memiliki kehadiran (ada peserta yang sudah check-in), THE Meeting_System SHALL menampilkan konfirmasi sebelum menghapus
5. THE Meeting_System SHALL mencatat penghapusan dalam activity log

### Requirement 17: Validasi Nomor WhatsApp

**User Story:** Sebagai sistem, saya ingin memvalidasi nomor WhatsApp peserta, sehingga pengiriman undangan dan reminder dapat berhasil.

#### Acceptance Criteria

1. WHEN nomor WhatsApp diinput, THE Meeting_System SHALL menormalisasi nomor dengan menghapus spasi, tanda hubung, dan karakter non-digit
2. THE Meeting_System SHALL mengubah awalan `0` menjadi `62`
3. THE Meeting_System SHALL menghapus karakter `+` dari `+62`
4. THE Meeting_System SHALL memvalidasi bahwa nomor hasil normalisasi cocok dengan pola `^62[0-9]{9,13}$`
5. WHEN nomor tidak valid, THE Meeting_System SHALL menampilkan pesan error "Nomor WhatsApp tidak valid"
6. THE Meeting_System SHALL menggunakan PhoneNormalizerService yang sudah ada dari WA_Blast_System

### Requirement 18: Status Rapat Otomatis

**User Story:** Sebagai sistem, saya ingin memperbarui status rapat secara otomatis, sehingga status rapat selalu akurat.

#### Acceptance Criteria

1. WHEN waktu saat ini kurang dari waktu mulai rapat, THE Meeting_System SHALL set status rapat sebagai "upcoming"
2. WHEN waktu saat ini berada di antara waktu mulai dan waktu selesai rapat, THE Meeting_System SHALL set status rapat sebagai "ongoing"
3. WHEN waktu saat ini lebih besar dari waktu selesai rapat, THE Meeting_System SHALL set status rapat sebagai "completed"
4. THE Meeting_System SHALL memperbarui status rapat setiap kali rapat diakses atau ditampilkan

### Requirement 19: Activity Logging

**User Story:** Sebagai sistem, saya ingin mencatat semua aktivitas terkait rapat, sehingga ada audit trail yang lengkap.

#### Acceptance Criteria

1. WHEN rapat dibuat, THE Meeting_System SHALL mencatat aktivitas "meeting_created" dengan detail rapat
2. WHEN rapat diubah, THE Meeting_System SHALL mencatat aktivitas "meeting_updated" dengan perubahan yang dilakukan
3. WHEN rapat dihapus, THE Meeting_System SHALL mencatat aktivitas "meeting_deleted"
4. WHEN peserta check-in, THE Meeting_System SHALL mencatat aktivitas "participant_checked_in" dengan waktu dan metode check-in
5. THE Meeting_System SHALL menggunakan AuditLogTrait yang sudah ada untuk logging otomatis

### Requirement 20: Navigasi dan Menu

**User Story:** Sebagai user, saya ingin mengakses fitur rapat yayasan dari menu navigasi, sehingga saya dapat dengan mudah menemukan fitur ini.

#### Acceptance Criteria

1. THE Meeting_System SHALL menambahkan menu "Rapat Yayasan" di sidebar navigasi
2. WHERE user adalah Admin_Yayasan atau Super_Admin, THE Meeting_System SHALL menampilkan menu "Rapat Yayasan"
3. WHERE user adalah Operator, THE Meeting_System SHALL menampilkan menu "Rapat Yayasan" dengan akses read-only
4. THE Meeting_System SHALL menampilkan ikon yang sesuai untuk menu rapat (misalnya: ikon kalender atau meeting)
5. THE Meeting_System SHALL menyediakan submenu: "Daftar Rapat" dan "Buat Rapat Baru" (hanya untuk Admin_Yayasan dan Super_Admin)

### Requirement 21: Routing dan Proteksi

**User Story:** Sebagai sistem, saya ingin melindungi route rapat dengan autentikasi dan otorisasi, sehingga hanya user yang berwenang dapat mengakses.

#### Acceptance Criteria

1. THE Meeting_System SHALL melindungi semua route rapat dengan middleware `auth:sanctum`
2. THE Meeting_System SHALL melindungi route pembuatan dan edit rapat dengan middleware `role:super_admin,admin_yayasan`
3. THE Meeting_System SHALL mengizinkan akses read-only untuk route daftar dan detail rapat untuk role Operator
4. THE Meeting_System SHALL mendaftarkan route: `/meetings` (list), `/meetings/create` (create), `/meetings/:id` (detail), `/meetings/:id/edit` (edit), `/meetings/:id/scan` (scan QR)
5. THE Meeting_System SHALL redirect user yang tidak terautentikasi ke halaman login

### Requirement 22: Responsive Design

**User Story:** Sebagai user mobile, saya ingin mengakses fitur rapat dari perangkat mobile, sehingga saya dapat melakukan check-in di lokasi rapat.

#### Acceptance Criteria

1. THE Meeting_System SHALL menampilkan halaman scan QR dengan layout yang optimal untuk mobile
2. THE Meeting_System SHALL menampilkan daftar rapat dengan layout responsif yang dapat diakses dari tablet dan mobile
3. THE Meeting_System SHALL menampilkan detail rapat dengan layout yang dapat di-scroll pada layar kecil
4. THE Meeting_System SHALL menggunakan Tailwind CSS responsive utilities untuk semua komponen
5. THE Meeting_System SHALL memastikan tombol dan form input memiliki ukuran yang cukup besar untuk touch interaction

### Requirement 23: Error Handling

**User Story:** Sebagai user, saya ingin menerima pesan error yang jelas ketika terjadi kesalahan, sehingga saya tahu apa yang harus dilakukan.

#### Acceptance Criteria

1. WHEN validasi form gagal, THE Meeting_System SHALL menampilkan pesan error di bawah field yang bermasalah
2. WHEN QR code tidak valid, THE Meeting_System SHALL menampilkan toast notification dengan pesan "QR Code tidak valid"
3. WHEN check-in gagal karena sudah check-in sebelumnya, THE Meeting_System SHALL menampilkan pesan "Anda sudah melakukan check-in"
4. WHEN koneksi ke server gagal, THE Meeting_System SHALL menampilkan pesan "Gagal terhubung ke server. Silakan coba lagi."
5. THE Meeting_System SHALL menggunakan Sonner toast untuk notifikasi error dan sukses

### Requirement 24: Performance dan Optimasi

**User Story:** Sebagai sistem, saya ingin memastikan performa yang baik untuk fitur rapat, sehingga user experience tetap optimal.

#### Acceptance Criteria

1. THE Meeting_System SHALL menggunakan pagination untuk daftar rapat dengan maksimal 20 item per halaman
2. THE Meeting_System SHALL menggunakan eager loading untuk relasi peserta dan sekolah saat query rapat
3. THE Meeting_System SHALL menggunakan index database pada kolom: `meeting_id`, `participant_id`, `check_in_at`
4. THE Meeting_System SHALL menggunakan TanStack Query untuk caching data rapat di frontend
5. THE Meeting_System SHALL menggunakan debounce untuk search input dengan delay 300ms

### Requirement 25: QR Code Security dengan Signed Token

**User Story:** Sebagai sistem, saya ingin mengamankan QR code dengan signed token dan expiry, sehingga QR code tidak dapat dipalsukan atau disalahgunakan.

#### Acceptance Criteria

1. WHEN QR_Personal dihasilkan, THE Meeting_System SHALL membuat Signed_Token menggunakan Laravel signed URL dengan parameter: meeting_id, participant_id, expires_at
2. THE Meeting_System SHALL set expiry token dari H-1 (24 jam sebelum rapat) sampai H+1 (24 jam setelah rapat), dihitung dari waktu MULAI rapat
3. THE Meeting_System SHALL menghasilkan URL format: `https://simmaci.app/meetings/{meeting_id}/check-in?token={signed_token}&participant={participant_id}&expires={timestamp}`
4. WHEN QR_Personal di-scan, THE Meeting_System SHALL memverifikasi signature token menggunakan Laravel URL::hasValidSignature()
5. WHEN signature tidak valid, THE Meeting_System SHALL menolak check-in dengan response 403 dan pesan "QR Code tidak valid atau telah dimodifikasi"
6. WHEN token sudah expired, THE Meeting_System SHALL menolak check-in dengan response 410 dan pesan "QR Code sudah tidak berlaku"
7. WHEN waktu saat ini lebih dari H+1 dari waktu mulai rapat, THE Meeting_System SHALL menolak check-in dengan pesan "QR Code sudah tidak berlaku (rapat telah berakhir lebih dari 24 jam)"
8. THE Meeting_System SHALL menerapkan validasi Signed_Token untuk KEDUA jenis QR (QR_Personal dan QR_Umum)

### Requirement 26: One-Time Use Token

**User Story:** Sebagai sistem, saya ingin memastikan setiap QR code hanya bisa digunakan sekali, sehingga tidak ada duplikasi check-in atau penyalahgunaan QR code.

#### Acceptance Criteria

1. WHEN peserta berhasil check-in dengan QR_Personal, THE Meeting_System SHALL menandai token sebagai "used" dengan menyimpan flag `is_token_used = true` dan `token_used_at = timestamp`
2. WHEN peserta mencoba scan QR_Personal yang sama lagi, THE Meeting_System SHALL memeriksa flag `is_token_used`
3. WHEN flag `is_token_used = true`, THE Meeting_System SHALL menolak check-in dengan pesan "Anda sudah check-in pada [token_used_at timestamp]"
4. THE Meeting_System SHALL menampilkan waktu check-in sebelumnya dalam pesan penolakan
5. WHERE Admin_Yayasan atau Super_Admin mereset check-in peserta, THE Meeting_System SHALL set `is_token_used = false` dan `token_used_at = null` untuk mengizinkan check-in ulang

### Requirement 27: Rate Limiting untuk Check-In

**User Story:** Sebagai sistem, saya ingin membatasi jumlah check-in dari IP yang sama, sehingga sistem terlindungi dari abuse dan bot.

#### Acceptance Criteria

1. WHEN peserta melakukan check-in, THE Meeting_System SHALL mencatat IP address peserta
2. THE Meeting_System SHALL menghitung jumlah check-in dari kombinasi IP address dan participant_id yang sama dalam 5 menit terakhir
3. WHEN jumlah check-in dari kombinasi IP dan participant yang sama melebihi 5 kali dalam 5 menit, THE Meeting_System SHALL menolak check-in dengan response 429
4. THE Meeting_System SHALL menampilkan pesan "Terlalu banyak percobaan check-in dari perangkat Anda. Silakan tunggu beberapa menit."
5. THE Meeting_System SHALL menggunakan Laravel Rate Limiter dengan key: `check-in:{ip_address}:{participant_id}` untuk peserta terdaftar
6. THE Meeting_System SHALL menggunakan key `check-in:{ip_address}:walkin` untuk peserta walk-in
7. THE Meeting_System SHALL menggunakan sliding window algorithm untuk rate limiting

### Requirement 28: Geolocation Validation (Opsional)

**User Story:** Sebagai Admin_Yayasan atau Super_Admin, saya ingin mengaktifkan validasi lokasi untuk rapat tertentu, sehingga hanya peserta yang berada di lokasi rapat yang dapat check-in.

#### Acceptance Criteria

1. WHEN Admin_Yayasan atau Super_Admin membuat atau edit rapat, THE Meeting_System SHALL menampilkan checkbox "Aktifkan Validasi Lokasi"
2. WHERE checkbox "Aktifkan Validasi Lokasi" dicentang, THE Meeting_System SHALL menampilkan field input: latitude (decimal), longitude (decimal), dan radius (integer dalam meter)
3. THE Meeting_System SHALL memvalidasi bahwa latitude berada dalam range -90 sampai 90
4. THE Meeting_System SHALL memvalidasi bahwa longitude berada dalam range -180 sampai 180
5. THE Meeting_System SHALL memvalidasi bahwa radius adalah integer positif minimal 10 meter
6. WHEN rapat dengan Geolocation_Validation aktif, WHEN peserta scan QR_Personal, THE Meeting_System SHALL request geolocation dari browser peserta menggunakan Geolocation API
7. WHEN peserta menolak permission geolocation, THE Meeting_System SHALL menampilkan pesan "Validasi lokasi diperlukan untuk check-in. Silakan izinkan akses lokasi."
8. WHEN geolocation diperoleh, THE Meeting_System SHALL menghitung jarak antara lokasi peserta dan lokasi rapat menggunakan Haversine formula
9. WHEN jarak melebihi radius yang ditentukan, THE Meeting_System SHALL menolak check-in dengan pesan "Anda berada di luar area rapat (jarak: [X] meter, maksimal: [radius] meter)"
10. WHEN jarak dalam radius, THE Meeting_System SHALL melanjutkan proses check-in dan menyimpan koordinat peserta
11. WHERE checkbox "Aktifkan Validasi Lokasi" tidak dicentang, THE Meeting_System SHALL melewati validasi geolocation

### Requirement 29: Device Info Tracking

**User Story:** Sebagai sistem, saya ingin mencatat informasi device peserta saat check-in, sehingga ada audit trail yang lengkap untuk keperluan verifikasi dan keamanan.

#### Acceptance Criteria

1. WHEN peserta melakukan check-in, THE Meeting_System SHALL mengekstrak Device_Info dari HTTP request header `User-Agent`
2. THE Meeting_System SHALL menyimpan informasi: IP address, user agent string lengkap, browser name, browser version, OS name, OS version, device type (mobile/tablet/desktop)
3. THE Meeting_System SHALL menggunakan library user-agent parser (misalnya: `jenssegers/agent` untuk Laravel atau `ua-parser-js` untuk frontend)
4. THE Meeting_System SHALL menyimpan timestamp check-in dengan presisi microseconds menggunakan `Carbon::now()->format('Y-m-d H:i:s.u')`
5. WHEN check-in berhasil, THE Meeting_System SHALL menampilkan konfirmasi yang mencakup device info: "Check-in berhasil pada [timestamp] dari [browser] di [device type]"
6. THE Meeting_System SHALL menyimpan Device_Info dalam kolom JSON `device_info` di tabel `meeting_attendances`

### Requirement 30: Reset Check-In oleh Admin

**User Story:** Sebagai Admin_Yayasan atau Super_Admin, saya ingin mereset check-in peserta yang salah scan atau perlu check-in ulang, sehingga peserta dapat melakukan check-in kembali.

#### Acceptance Criteria

1. WHEN Admin_Yayasan atau Super_Admin mengakses halaman detail rapat, THE Meeting_System SHALL menampilkan tombol "Reset Check-in" untuk setiap peserta yang sudah check-in
2. WHEN tombol "Reset Check-in" diklik, THE Meeting_System SHALL menampilkan dialog konfirmasi dengan pesan "Apakah Anda yakin ingin mereset check-in untuk [Nama Peserta]? Peserta dapat melakukan check-in ulang setelah reset."
3. WHEN admin mengkonfirmasi reset, THE Meeting_System SHALL menghapus record check-in peserta (soft delete) DAN mereset flag `is_token_used = false` dan `token_used_at = null`, sehingga QR code yang sama dapat digunakan kembali
4. THE Meeting_System SHALL mencatat aktivitas reset dalam activity log dengan informasi: admin yang mereset, peserta yang direset, waktu reset, alasan (opsional)
5. WHEN reset berhasil, THE Meeting_System SHALL menampilkan toast notification "Check-in berhasil direset. Peserta dapat menggunakan QR code yang sama untuk check-in ulang."
6. WHEN reset berhasil, THE Meeting_System SHALL menampilkan informasi bahwa peserta dapat menggunakan QR code yang sama untuk check-in ulang
7. WHERE peserta tidak lagi memiliki QR code (hilang atau terhapus), THE Meeting_System SHALL menyarankan admin untuk menggunakan fitur Regenerate QR
8. THE Meeting_System SHALL mengirim notifikasi ke peserta (opsional) bahwa check-in mereka telah direset dan mereka perlu check-in ulang

### Requirement 31: QR Code Regeneration

**User Story:** Sebagai Admin_Yayasan atau Super_Admin, saya ingin meregenerasi QR_Personal untuk peserta tertentu, sehingga peserta dapat menerima QR code baru jika QR lama bermasalah.

#### Acceptance Criteria

1. WHEN Admin_Yayasan atau Super_Admin mengakses halaman detail rapat, THE Meeting_System SHALL menampilkan tombol "Regenerate QR" untuk setiap peserta
2. WHEN tombol "Regenerate QR" diklik, THE Meeting_System SHALL menghasilkan Signed_Token baru dengan expiry yang sama (H-1 sampai H+1)
3. THE Meeting_System SHALL membatalkan token lama dengan menandai sebagai "revoked"
4. THE Meeting_System SHALL menyimpan token baru dan menghasilkan QR_Personal baru
5. WHEN regenerasi berhasil, THE Meeting_System SHALL menampilkan QR code baru dan opsi untuk mengirim ulang via WhatsApp
6. THE Meeting_System SHALL mencatat aktivitas regenerasi dalam activity log


### Requirement 32: Concurrent Check-In Handling

**User Story:** Sebagai sistem, saya ingin menangani concurrent check-in dengan aman, sehingga tidak ada duplikasi check-in akibat race condition.

#### Acceptance Criteria

1. WHEN dua atau lebih request check-in dengan QR_Personal yang sama tiba secara bersamaan, THE Meeting_System SHALL menggunakan database transaction dengan Pessimistic_Locking (`SELECT FOR UPDATE`) untuk memastikan hanya satu check-in yang berhasil
2. THE Meeting_System SHALL menggunakan `Laravel DB::transaction()` dengan `lock()` untuk operasi check-in
3. WHEN check-in pertama berhasil dan check-in kedua gagal karena locking, THE Meeting_System SHALL mengembalikan response yang sama seperti kondisi "sudah check-in" (bukan error 500)
4. THE Meeting_System SHALL menggunakan Optimistic_Locking sebagai fallback dengan kolom `version` di tabel `meeting_attendances`


### Requirement 33: Notulensi Rapat

**User Story:** Sebagai Admin_Yayasan atau Super_Admin, saya ingin membuat dan mengedit notulensi rapat setelah rapat selesai, sehingga ada dokumentasi tertulis tentang hasil dan keputusan rapat.

#### Acceptance Criteria

1. WHEN rapat sudah selesai (status `completed`), THE Meeting_System SHALL menampilkan tab "Notulensi" di halaman detail rapat
2. WHEN tab Notulensi diklik dan belum ada notulensi, THE Meeting_System SHALL menampilkan tombol "Buat Notulensi"
3. WHEN tombol "Buat Notulensi" diklik, THE Meeting_System SHALL membuka editor rich text (menggunakan library seperti TipTap atau Quill)
4. THE Meeting_System SHALL menyediakan field: judul notulensi (auto-filled dari judul rapat), konten notulensi (rich text editor), dan tombol Simpan/Batal
5. WHEN admin menyimpan notulensi, THE Meeting_System SHALL menyimpan konten notulensi dalam format HTML ke database
6. THE Meeting_System SHALL mencatat waktu pembuatan notulensi dan user yang membuat
7. WHEN notulensi sudah ada, THE Meeting_System SHALL menampilkan tombol "Edit Notulensi" untuk admin yang membuat atau super_admin
8. WHEN admin mengklik "Edit Notulensi", THE Meeting_System SHALL membuka editor dengan konten notulensi yang sudah ada
9. WHEN admin menyimpan perubahan, THE Meeting_System SHALL memperbarui konten notulensi dan mencatat waktu update
10. THE Meeting_System SHALL menampilkan riwayat perubahan notulensi (siapa yang edit, kapan) di bawah konten
11. WHEN user dengan role Operator mengakses halaman detail rapat, THE Meeting_System SHALL menampilkan notulensi dalam mode read-only (tidak ada tombol edit)
12. THE Meeting_System SHALL menyediakan tombol "Unduh Notulensi" untuk mengunduh notulensi dalam format PDF atau DOCX
13. THE Meeting_System SHALL menggunakan PHPWord untuk generate file DOCX dengan header rapat dan konten notulensi

### Requirement 34: Foto Kegiatan Rapat

**User Story:** Sebagai Admin_Yayasan atau Super_Admin, saya ingin mengunggah foto kegiatan rapat, sehingga ada dokumentasi visual dari jalannya rapat.

#### Acceptance Criteria

1. WHEN rapat sudah dimulai (status `ongoing` atau `completed`), THE Meeting_System SHALL menampilkan tab "Foto Kegiatan" di halaman detail rapat
2. WHEN tab Foto Kegiatan diklik, THE Meeting_System SHALL menampilkan galeri foto (grid layout) dan tombol "Unggah Foto"
3. WHEN tombol "Unggah Foto" diklik, THE Meeting_System SHALL membuka file picker untuk memilih satu atau lebih file gambar
4. THE Meeting_System SHALL memvalidasi bahwa file adalah gambar dengan format: JPEG, PNG, WebP, atau GIF
5. THE Meeting_System SHALL memvalidasi bahwa ukuran file maksimal 10 MB per foto
6. THE Meeting_System SHALL memvalidasi bahwa total foto per rapat maksimal 50 foto
7. WHEN user mencoba unggah lebih dari 50 foto, THE Meeting_System SHALL menampilkan pesan error "Maksimal 50 foto per rapat. Anda sudah memiliki [X] foto."
8. WHEN file valid, THE Meeting_System SHALL menyimpan foto ke Laravel Storage (path: `meetings/{meeting_id}/photos/`)
9. THE Meeting_System SHALL membuat thumbnail otomatis untuk preview (ukuran: 300x300px)
10. THE Meeting_System SHALL menyimpan metadata foto: nama file original, ukuran file, dimensi gambar, waktu upload, user yang upload
11. WHEN foto berhasil diupload, THE Meeting_System SHALL menampilkan foto di galeri dengan thumbnail
12. THE Meeting_System SHALL menyediakan tombol "Hapus" untuk setiap foto (hanya untuk admin yang upload atau super_admin)
13. WHEN admin mengklik tombol "Hapus", THE Meeting_System SHALL menampilkan dialog konfirmasi sebelum menghapus
14. WHEN admin mengkonfirmasi penghapusan, THE Meeting_System SHALL menghapus file foto dari storage dan record dari database
15. THE Meeting_System SHALL menyediakan fitur lightbox/modal untuk melihat foto dalam ukuran penuh
16. THE Meeting_System SHALL menampilkan informasi foto: nama file, waktu upload, user yang upload di dalam modal
17. WHEN user dengan role Operator mengakses halaman detail rapat, THE Meeting_System SHALL menampilkan galeri foto dalam mode read-only (tidak ada tombol upload/hapus)
18. THE Meeting_System SHALL menyediakan tombol "Unduh Semua Foto" untuk mengunduh semua foto dalam format ZIP
19. THE Meeting_System SHALL menggunakan library seperti `intervention/image` untuk membuat thumbnail otomatis
20. THE Meeting_System SHALL mencatat aktivitas upload dan hapus foto dalam activity log

### Requirement 35: Integrasi Notulensi dan Foto ke Laporan PDF

**User Story:** Sebagai Admin_Yayasan atau Super_Admin, saya ingin laporan PDF rapat mencakup notulensi dan foto kegiatan, sehingga laporan lebih komprehensif.

#### Acceptance Criteria

1. WHEN admin mengunduh laporan PDF, THE Meeting_System SHALL menyertakan halaman notulensi setelah halaman daftar hadir
2. THE Meeting_System SHALL menampilkan judul "NOTULENSI RAPAT" di halaman notulensi
3. THE Meeting_System SHALL menampilkan konten notulensi dalam format yang rapi (preserve formatting dari rich text)
4. WHEN notulensi belum ada, THE Meeting_System SHALL menampilkan pesan "Notulensi belum dibuat" di halaman notulensi
5. WHEN ada foto kegiatan, THE Meeting_System SHALL menyertakan halaman "FOTO KEGIATAN" setelah halaman notulensi
6. THE Meeting_System SHALL menampilkan maksimal 4 foto per halaman dalam grid 2x2
7. THE Meeting_System SHALL menampilkan caption di bawah setiap foto: nama file, waktu upload
8. WHEN ada lebih dari 4 foto, THE Meeting_System SHALL membuat halaman tambahan untuk foto-foto berikutnya
9. WHEN tidak ada foto, THE Meeting_System SHALL melewati halaman foto kegiatan
10. THE Meeting_System SHALL menggunakan PHPWord untuk insert gambar ke dalam dokumen PDF

