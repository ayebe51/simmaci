# Requirements Document

## Introduction

Fitur WA Blast memungkinkan pengguna SIMMACI dengan role `super_admin` dan `admin_yayasan` untuk mengirim pesan WhatsApp secara massal kepada kepala sekolah dan/atau guru (GTK) di jaringan madrasah LP Ma'arif NU Cilacap. Pesan dapat dikirim ke satu sekolah tertentu maupun lintas sekolah. Pengiriman dapat dijadwalkan pada waktu tertentu untuk menghindari risiko pemblokiran akibat pengiriman massal sekaligus. Fitur ini mendukung pengiriman teks dan lampiran file PDF (misalnya surat edaran). Integrasi dilakukan melalui **Go-WA** sebagai WhatsApp Gateway.

---

## Glossary

- **WA_Blast_System**: Sistem pengiriman pesan WhatsApp massal dalam SIMMACI
- **Blast_Session**: Satu sesi pengiriman pesan massal yang mencakup pesan, lampiran, daftar penerima, jadwal, dan status pengiriman
- **Recipient**: Individu yang menjadi target pengiriman pesan (kepala sekolah atau guru)
- **Recipient_List**: Daftar penerima yang dipilih untuk satu Blast_Session
- **Go_WA**: Layanan WhatsApp Gateway pihak ketiga (Go-WA) yang menyediakan API untuk mengirim pesan dan file WhatsApp
- **Blast_Status**: Status keseluruhan sebuah Blast_Session (`draft`, `scheduled`, `sending`, `completed`, `failed`)
- **Delivery_Status**: Status pengiriman pesan ke satu Recipient (`pending`, `sent`, `failed`, `invalid_number`)
- **Message_Template**: Template pesan yang dapat disimpan, dikelola, dan digunakan ulang dalam pembuatan Blast_Session
- **Template_Variable**: Placeholder dinamis dalam isi template menggunakan sintaks `{{nama_variabel}}` yang digantikan dengan data aktual penerima saat pengiriman
- **Template_Name**: Nama unik yang diberikan pengguna untuk mengidentifikasi sebuah Message_Template
- **Scheduled_Blast**: Blast_Session yang dijadwalkan untuk dikirim pada waktu tertentu di masa mendatang
- **super_admin**: Pengguna dengan akses penuh ke seluruh data lintas sekolah
- **admin_yayasan**: Pengguna dengan akses pengawasan lintas sekolah
- **GTK**: Guru dan Tenaga Kependidikan — merujuk pada data di tabel `teachers`
- **Kepala_Sekolah**: Kepala madrasah yang datanya tersimpan di kolom `kepala_whatsapp` pada tabel `schools`
- **phone_number**: Kolom nomor telepon/WhatsApp pada tabel `teachers`
- **kepala_whatsapp**: Kolom nomor WhatsApp kepala sekolah pada tabel `schools`
- **Jenjang**: Tingkatan satuan pendidikan madrasah yang tersimpan di kolom `jenjang` pada tabel `schools` — nilai yang umum digunakan: `MI` (Madrasah Ibtidaiyah), `MTs` (Madrasah Tsanawiyah), `MA` (Madrasah Aliyah)

---

## Requirements

### Requirement 1: Pemilihan Penerima Pesan

**User Story:** Sebagai `super_admin` atau `admin_yayasan`, saya ingin memilih penerima pesan dari seluruh jaringan sekolah dengan filter berdasarkan jenjang dan sekolah tertentu, sehingga saya dapat mengirim pengumuman atau informasi penting secara massal tanpa harus menghubungi satu per satu.

#### Acceptance Criteria

1. THE `WA_Blast_System` SHALL menyediakan antarmuka pemilihan penerima berdasarkan kategori: **Kepala Sekolah**, **Guru (GTK)**, atau **Keduanya**.
2. WHEN pengguna memilih kategori **Kepala Sekolah**, THE `WA_Blast_System` SHALL mengambil daftar nomor dari kolom `kepala_whatsapp` pada tabel `schools` yang nilainya tidak kosong (`NOT NULL` dan tidak berupa string kosong).
3. WHEN pengguna memilih kategori **Guru (GTK)**, THE `WA_Blast_System` SHALL mengambil daftar nomor dari kolom `phone_number` pada tabel `teachers` yang nilainya tidak kosong dan `is_active = true`.
4. THE `WA_Blast_System` SHALL memungkinkan pemfilteran penerima berdasarkan **jenjang sekolah** (`jenjang` pada tabel `schools`), dengan pilihan: **MI**, **MTs**, **MA**, atau **Semua Jenjang**.
5. WHEN pengguna memilih satu atau lebih jenjang, THE `WA_Blast_System` SHALL hanya mengambil penerima dari sekolah yang kolom `jenjang`-nya cocok dengan jenjang yang dipilih.
6. THE `WA_Blast_System` SHALL memungkinkan pemfilteran penerima berdasarkan satu atau lebih sekolah tertentu, atau memilih semua sekolah sekaligus. Filter sekolah ini bersifat opsional dan dapat dikombinasikan dengan filter jenjang.
7. THE `WA_Blast_System` SHALL menampilkan jumlah penerima yang valid (memiliki nomor WhatsApp) sebelum pengiriman dilakukan.
8. WHEN daftar penerima dikompilasi, THE `WA_Blast_System` SHALL menghapus duplikasi nomor WhatsApp yang sama dalam satu Blast_Session.
9. THE `WA_Blast_System` SHALL memungkinkan pengguna untuk menghapus penerima tertentu dari Recipient_List sebelum pengiriman dikonfirmasi.

---

### Requirement 2: Komposisi Pesan

**User Story:** Sebagai pengguna, saya ingin menulis pesan yang akan dikirim, melampirkan file PDF, dan menggunakan template pesan yang tersimpan, sehingga saya dapat mengirim surat edaran beserta isi pesan tanpa mengetik ulang setiap kali.

#### Acceptance Criteria

1. THE `WA_Blast_System` SHALL menyediakan kolom teks untuk menulis isi pesan dengan panjang maksimal 4.096 karakter.
2. THE `WA_Blast_System` SHALL mendukung Template_Variable dalam pesan menggunakan sintaks `{{nama}}` dan `{{nama_sekolah}}`, di mana `{{nama}}` digantikan dengan nama penerima dan `{{nama_sekolah}}` digantikan dengan nama sekolah penerima saat pengiriman.
3. WHEN pesan mengandung Template_Variable, THE `WA_Blast_System` SHALL menampilkan pratinjau pesan dengan nilai variabel yang sudah disubstitusi menggunakan data penerima pertama dalam Recipient_List.
4. THE `WA_Blast_System` SHALL memungkinkan pengguna melampirkan satu file PDF per Blast_Session dengan ukuran maksimal 10 MB.
5. IF file yang diunggah bukan bertipe PDF atau ukurannya melebihi 10 MB, THEN THE `WA_Blast_System` SHALL menampilkan pesan validasi yang sesuai dan menolak file tersebut.
6. WHEN pengguna memilih Message_Template yang tersimpan saat membuat Blast_Session, THE `WA_Blast_System` SHALL mengisi kolom pesan dengan isi template tersebut tanpa menimpa lampiran yang sudah dipilih.
7. IF isi pesan kosong saat pengguna mencoba mengirim, THEN THE `WA_Blast_System` SHALL menampilkan pesan validasi "Isi pesan tidak boleh kosong." dan mencegah pengiriman.
8. IF panjang pesan melebihi 4.096 karakter, THEN THE `WA_Blast_System` SHALL menampilkan pesan validasi "Pesan terlalu panjang. Maksimal 4.096 karakter." dan mencegah pengiriman.

---

### Requirement 3: Penjadwalan Pengiriman

**User Story:** Sebagai pengguna, saya ingin menjadwalkan pengiriman pesan pada waktu tertentu, sehingga pesan terkirim secara bertahap dan risiko pemblokiran nomor WhatsApp akibat pengiriman massal sekaligus dapat diminimalkan.

#### Acceptance Criteria

1. THE `WA_Blast_System` SHALL menyediakan opsi untuk mengirim pesan **segera** atau **terjadwal** pada tanggal dan waktu tertentu di masa mendatang.
2. WHEN pengguna memilih opsi terjadwal, THE `WA_Blast_System` SHALL menyimpan Blast_Session dengan Blast_Status `scheduled` dan waktu pengiriman yang ditentukan.
3. WHEN waktu yang dijadwalkan tiba, THE `WA_Blast_System` SHALL secara otomatis memulai proses pengiriman dan memperbarui Blast_Status menjadi `sending`.
4. IF waktu yang dijadwalkan sudah lewat (di masa lalu) saat pengguna menyimpan, THEN THE `WA_Blast_System` SHALL menampilkan pesan validasi "Waktu pengiriman harus di masa mendatang." dan mencegah penyimpanan.
5. WHEN Blast_Session berstatus `scheduled`, THE `WA_Blast_System` SHALL memungkinkan pengguna untuk membatalkan atau mengubah jadwal pengiriman selama pengiriman belum dimulai.
6. THE `WA_Blast_System` SHALL menampilkan waktu pengiriman yang dijadwalkan pada daftar dan detail Blast_Session.

---

### Requirement 4: Eksekusi Pengiriman

**User Story:** Sebagai pengguna, saya ingin pesan terkirim ke semua penerima yang dipilih secara massal di latar belakang, sehingga proses pengiriman tidak memblokir aktivitas saya di aplikasi.

#### Acceptance Criteria

1. WHEN pengguna mengkonfirmasi pengiriman, THE `WA_Blast_System` SHALL membuat satu Blast_Session baru dengan status `sending` dan mendelegasikan proses pengiriman ke antrian (queue) latar belakang.
2. WHILE Blast_Session berstatus `sending`, THE `WA_Blast_System` SHALL mengirim pesan ke setiap Recipient secara berurutan melalui Go_WA API dengan jeda minimal 2 detik antar pengiriman untuk menghindari rate limiting dan risiko pemblokiran.
3. WHEN Go_WA API mengembalikan respons sukses untuk satu Recipient, THE `WA_Blast_System` SHALL memperbarui Delivery_Status Recipient tersebut menjadi `sent`.
4. IF Go_WA API mengembalikan respons error untuk satu Recipient, THEN THE `WA_Blast_System` SHALL memperbarui Delivery_Status Recipient tersebut menjadi `failed` dan mencatat pesan error dari API, lalu melanjutkan pengiriman ke Recipient berikutnya.
5. IF nomor WhatsApp Recipient tidak valid (format tidak sesuai atau ditolak Go_WA), THEN THE `WA_Blast_System` SHALL memperbarui Delivery_Status Recipient tersebut menjadi `invalid_number` tanpa menghentikan pengiriman ke Recipient lain.
6. WHEN semua Recipient dalam satu Blast_Session telah diproses, THE `WA_Blast_System` SHALL memperbarui Blast_Status menjadi `completed`.
7. IF Go_WA tidak dapat dihubungi selama lebih dari 30 detik, THEN THE `WA_Blast_System` SHALL menandai Blast_Session sebagai `failed` dan mencatat pesan error "Go-WA Gateway tidak dapat dihubungi."
8. WHEN Blast_Session menyertakan lampiran PDF, THE `WA_Blast_System` SHALL mengirim file PDF tersebut bersama pesan teks ke setiap Recipient melalui Go_WA API.

---

### Requirement 5: Batas Pengiriman (Rate Limiting)

**User Story:** Sebagai `super_admin`, saya ingin membatasi jumlah penerima per sesi dan per hari, sehingga risiko pemblokiran nomor WhatsApp pengirim dapat dikendalikan.

#### Acceptance Criteria

1. THE `WA_Blast_System` SHALL membatasi jumlah Recipient dalam satu Blast_Session maksimal 500 penerima.
2. IF jumlah Recipient yang dipilih melebihi 500, THEN THE `WA_Blast_System` SHALL menampilkan pesan peringatan "Jumlah penerima melebihi batas maksimal 500 per sesi." dan mencegah pembuatan Blast_Session.
3. THE `WA_Blast_System` SHALL membatasi total pengiriman pesan per hari (dihitung dari pukul 00:00 hingga 23:59 WIB) maksimal 1.000 pesan.
4. IF total pesan yang akan dikirim pada hari yang sama akan melebihi 1.000, THEN THE `WA_Blast_System` SHALL menampilkan peringatan kepada pengguna beserta sisa kuota harian yang tersedia.
5. WHERE `super_admin` mengubah batas maksimal penerima per sesi atau batas harian, THE `WA_Blast_System` SHALL menyimpan nilai batas baru tersebut dan menerapkannya pada semua Blast_Session berikutnya.

---

### Requirement 6: Riwayat dan Monitoring Blast

**User Story:** Sebagai pengguna, saya ingin melihat riwayat semua sesi pengiriman beserta statusnya, sehingga saya dapat memantau keberhasilan pengiriman dan mengidentifikasi penerima yang gagal.

#### Acceptance Criteria

1. THE `WA_Blast_System` SHALL menampilkan daftar Blast_Session yang pernah dibuat, diurutkan dari yang terbaru, dengan informasi: judul sesi, tanggal pengiriman (atau jadwal), total penerima, jumlah `sent`, jumlah `failed`, dan Blast_Status.
2. WHEN pengguna membuka detail satu Blast_Session, THE `WA_Blast_System` SHALL menampilkan daftar seluruh Recipient beserta nama, nama sekolah, nomor WhatsApp, dan Delivery_Status masing-masing.
3. THE `WA_Blast_System` SHALL menyediakan filter pada daftar Blast_Session berdasarkan Blast_Status dan rentang tanggal pengiriman.
4. WHEN Blast_Session berstatus `sending`, THE `WA_Blast_System` SHALL memperbarui tampilan progres pengiriman secara otomatis setiap 5 detik tanpa perlu reload halaman.
5. THE `WA_Blast_System` SHALL menampilkan isi pesan dan nama file lampiran (jika ada) pada halaman detail Blast_Session.

---

### Requirement 7: Konfigurasi Go-WA Gateway

**User Story:** Sebagai `super_admin`, saya ingin mengkonfigurasi kredensial Go-WA yang digunakan sistem, sehingga integrasi dengan layanan pengiriman WhatsApp dapat dikelola tanpa mengubah kode aplikasi.

#### Acceptance Criteria

1. THE `WA_Blast_System` SHALL menyediakan halaman konfigurasi Go_WA yang hanya dapat diakses oleh pengguna dengan role `super_admin`.
2. THE `WA_Blast_System` SHALL menyimpan konfigurasi berikut: URL endpoint API Go_WA, API Token, dan nomor pengirim (device/sender number).
3. WHEN `super_admin` menyimpan konfigurasi baru, THE `WA_Blast_System` SHALL mengenkripsi nilai API Token sebelum disimpan ke database.
4. THE `WA_Blast_System` SHALL menyediakan tombol "Test Koneksi" yang mengirim permintaan uji ke Go_WA menggunakan konfigurasi yang tersimpan dan menampilkan hasilnya kepada pengguna.
5. IF konfigurasi Go_WA belum diisi, THEN THE `WA_Blast_System` SHALL menampilkan peringatan "Konfigurasi Go-WA Gateway belum diatur." pada halaman WA Blast dan menonaktifkan tombol kirim.

---

### Requirement 8: Validasi Nomor WhatsApp

**User Story:** Sebagai pengguna, saya ingin sistem secara otomatis memvalidasi dan menormalisasi format nomor WhatsApp penerima sebelum pengiriman, sehingga pesan tidak gagal dikirim karena format nomor yang salah.

#### Acceptance Criteria

1. WHEN `WA_Blast_System` mengompilasi Recipient_List, THE `WA_Blast_System` SHALL menormalisasi setiap nomor telepon ke format internasional Indonesia (diawali `62`, tanpa karakter `+`, spasi, atau tanda hubung).
2. WHEN nomor diawali dengan `0`, THE `WA_Blast_System` SHALL mengganti awalan `0` dengan `62` secara otomatis.
3. WHEN nomor diawali dengan `+62`, THE `WA_Blast_System` SHALL menghapus karakter `+` sehingga menjadi `62...`.
4. IF nomor setelah normalisasi tidak memenuhi pola `62[0-9]{9,13}`, THEN THE `WA_Blast_System` SHALL menandai Recipient tersebut dengan Delivery_Status `invalid_number` dan tidak mengirim pesan ke nomor tersebut.
5. THE `WA_Blast_System` SHALL menampilkan jumlah nomor yang tidak valid pada ringkasan sebelum pengiriman dikonfirmasi, beserta daftar nama penerima dengan nomor tidak valid.

---

### Requirement 9: Kontrol Akses Berbasis Role

**User Story:** Sebagai `super_admin`, saya ingin memastikan bahwa hanya pengguna yang berwenang yang dapat menggunakan fitur WA Blast, sehingga pengiriman pesan massal tidak disalahgunakan.

#### Acceptance Criteria

1. THE `WA_Blast_System` SHALL membatasi akses fitur WA Blast hanya kepada pengguna dengan role `super_admin` atau `admin_yayasan`.
2. IF pengguna dengan role `operator` atau tanpa autentikasi mencoba mengakses endpoint WA Blast, THEN THE `WA_Blast_System` SHALL mengembalikan respons HTTP 403 dengan pesan "Aksi ini tidak diizinkan."
3. WHERE pengguna memiliki role `admin_yayasan`, THE `WA_Blast_System` SHALL mengizinkan pembuatan dan pemantauan Blast_Session tetapi tidak mengizinkan perubahan konfigurasi Go_WA.
4. THE `WA_Blast_System` SHALL mencatat setiap pembuatan Blast_Session ke dalam `activity_logs` dengan informasi: `causer_id`, jumlah penerima, waktu pembuatan, dan Blast_Status awal.

---

### Requirement 10: Penanganan Kegagalan dan Retry

**User Story:** Sebagai pengguna, saya ingin dapat mencoba ulang pengiriman ke penerima yang gagal, sehingga saya tidak perlu membuat sesi baru hanya untuk mengirim ulang ke sebagian kecil penerima.

#### Acceptance Criteria

1. WHEN Blast_Session berstatus `completed` dan terdapat Recipient dengan Delivery_Status `failed`, THE `WA_Blast_System` SHALL menampilkan tombol "Kirim Ulang ke yang Gagal".
2. WHEN pengguna mengklik "Kirim Ulang ke yang Gagal", THE `WA_Blast_System` SHALL membuat Blast_Session baru yang Recipient_List-nya hanya berisi Recipient dengan Delivery_Status `failed` dari sesi sebelumnya, dengan referensi ke sesi asal.
3. IF semua Recipient dalam satu Blast_Session memiliki Delivery_Status `failed`, THEN THE `WA_Blast_System` SHALL memperbarui Blast_Status menjadi `failed`.
4. THE `WA_Blast_System` SHALL menyimpan pesan error dari Go_WA untuk setiap Recipient yang gagal, sehingga dapat ditampilkan pada halaman detail Blast_Session.

---

### Requirement 11: Manajemen Template Pesan

**User Story:** Sebagai `super_admin` atau `admin_yayasan`, saya ingin membuat, mengelola, dan menggunakan kembali beberapa template pesan secara mandiri, sehingga saya dapat menyiapkan berbagai format pesan standar dan memilihnya dengan cepat saat membuat Blast_Session baru.

#### Acceptance Criteria

1. THE `WA_Blast_System` SHALL menyediakan halaman manajemen Message_Template yang dapat diakses oleh pengguna dengan role `super_admin` atau `admin_yayasan`.
2. WHEN pengguna membuat Message_Template baru, THE `WA_Blast_System` SHALL menyimpan template dengan Template_Name dan isi pesan yang diberikan, lalu menampilkannya dalam daftar template.
3. THE `WA_Blast_System` SHALL menampilkan daftar seluruh Message_Template yang tersimpan, dengan informasi: Template_Name, cuplikan isi pesan (maksimal 100 karakter pertama), dan tanggal terakhir diubah.
4. WHEN pengguna mengedit Message_Template yang sudah ada, THE `WA_Blast_System` SHALL memperbarui Template_Name dan isi pesan sesuai perubahan yang diberikan, tanpa memengaruhi Blast_Session yang sudah menggunakan template tersebut sebelumnya.
5. WHEN pengguna menghapus Message_Template, THE `WA_Blast_System` SHALL menghapus template tersebut dari daftar dan tidak lagi menampilkannya sebagai pilihan saat membuat Blast_Session baru.
6. IF Template_Name yang dimasukkan sudah digunakan oleh Message_Template lain, THEN THE `WA_Blast_System` SHALL menampilkan pesan validasi "Nama template sudah digunakan. Gunakan nama yang berbeda." dan mencegah penyimpanan.
7. IF Template_Name kosong saat pengguna menyimpan Message_Template, THEN THE `WA_Blast_System` SHALL menampilkan pesan validasi "Nama template tidak boleh kosong." dan mencegah penyimpanan.
8. IF isi pesan kosong saat pengguna menyimpan Message_Template, THEN THE `WA_Blast_System` SHALL menampilkan pesan validasi "Isi template tidak boleh kosong." dan mencegah penyimpanan.
9. THE `WA_Blast_System` SHALL mendukung penggunaan Template_Variable `{{nama}}` dan `{{nama_sekolah}}` dalam isi Message_Template, dan menampilkan keterangan variabel yang tersedia pada halaman pembuatan/pengeditan template.
10. WHEN pengguna memilih Message_Template saat membuat Blast_Session baru, THE `WA_Blast_System` SHALL menampilkan daftar template dalam bentuk dropdown atau modal yang dapat dicari berdasarkan Template_Name.
11. WHERE pengguna memiliki role `admin_yayasan`, THE `WA_Blast_System` SHALL mengizinkan pembuatan, pengeditan, dan penghapusan Message_Template dengan cakupan yang sama dengan `super_admin` untuk fitur template.
12. IF pengguna dengan role `operator` mencoba mengakses endpoint manajemen Message_Template, THEN THE `WA_Blast_System` SHALL mengembalikan respons HTTP 403 dengan pesan "Aksi ini tidak diizinkan."
