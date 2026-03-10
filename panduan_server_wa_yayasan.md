# Buku Panduan: Pembuatan Server WhatsApp Terpusat (Yayasan)

Panduan ini berisi langkah-langkah untuk mengubah 1 PC di kantor Yayasan menjadi Pusat Pengirim Notifikasi WhatsApp (Multi-Device) untuk seluruh madrasah di bawah naungannya.

## Persiapan Server (Satu Kali Saja)

1. **Pastikan Docker Desktop Berjalan**
   Pastikan aplikasi Docker Desktop di PC Yayasan sudah dalam keadaan terbuka (ikon paus di sudut kanan bawah berwana putih/hijau solid).

2. **Copy File Konfigurasi ke PC Yayasan**
   Buat folder baru bernama `SIMMACI` di Local Disk `D:\` (misal: `D:\SIMMACI`).
   Copy 2 file berikut dari komputer developer ke folder `D:\SIMMACI` di PC Yayasan:
   - `docker-compose.yml`
   - `START-WA-GATEWAY.bat`

> [!IMPORTANT]
> **PENTING: Mencegah File Terhapus (Antivirus)**
> Agar file `.bat` tidak terhapus otomatis oleh Windows Defender/Antivirus, Bapak **WAJIB** mengecualikan folder `D:\SIMMACI` dari scan:
> 1. Buka **Windows Security** (klik tombol Windows, ketik "Security").
> 2. Pilih **Virus & threat protection** -> **Manage settings**.
> 3. Scroll ke bawah, klik **Add or remove exclusions**.
> 4. Klik **Add an exclusion** -> **Folder**.
> 5. Pilih folder **`D:\SIMMACI`**.

3. **Menyalakan Server Gateway**
   - Buka folder `D:\SIMMACI` tadi.
   - Klik 2x (*double-click*) pada file **`START-WA-GATEWAY.bat`**.
   - Akan muncul jendela hitam (*Command Prompt*). Jendela ini akan secara otomatis:
     - Mendownload & menyalakan mesin WhatsApp (GoWA) di Docker.
     - Membuka terowongan internet permanen (`https://simmaci-pusat-wa.loca.lt`).
   - **PENTING:** Biarkan jendela hitam ini selalu terbuka. Jika ditutup, absensi tidak akan terhubung ke WhatsApp.

---

## Mendaftarkan Nomor WhatsApp Madrasah (Tahap Login)

Karena kita menggunakan sistem "Satu PC untuk Banyak Madrasah", Anda harus login nomor WhatsApp masing-masing sekolah secara bergantian di dalam mesin server ini.

1. Buka browser (Google Chrome/Edge) di PC Yayasan.
2. Ketikkan alamat: **`http://localhost:3000`**
3. Di halaman *dashboard* GoWA yang muncul:
   - Klik tombol **"Add Device"** (atau ikon tambah/plug).
   - Masukkan ID Unik untuk madrasah tersebut (misal: `migandrung` atau `mtsalfalah`). **Ingat ID ini baik-baik!**
   - Klik tombol biru **"Generate QR"** (atau "Login").
4. Minta admin madrasah terkait untuk membuka WhatsApp di HP Official mereka -> Titik 3 -> **Perangkat Tertaut (Linked Devices)** -> **Tautkan Perangkat**.
5. Scan QR Code yang muncul di layar PC Yayasan.
6. Tunggu hingga statusnya berubah menjadi **Connected**.
7. Ulangi Langkah 3-6 untuk mendaftarkan madrasah-madrasah lainnya secara bergantian.

---

## Mendaftarkan Nomor WhatsApp Madrasah dari Jarak Jauh (Remote)

Jika Teknisi/Admin Madrasah berada jauh dari Kantor Yayasan, mereka tetap bisa melakukan Pendaftaran (Scan QR) sendiri dari sekolah masing-masing tanpa harus datang ke Yayasan.

1. **Pastikan Server Yayasan Sudah Aktif:**
   Server di Yayasan harus dalam keadaan menyala dan memunculkan tulisan `SERVER SUDAH MENYALA DI LATAR BELAKANG!`.
2. **Bagikan Link Terowongan:**
   Admin Yayasan membagikan link Terowongan Internet (Localtunnel) ke Teknisi Cabang Madrasah. Linknya adalah: `https://simmaci-pusat-wa.loca.lt`
3. **Instruksi untuk Teknisi Cabang (Di Lokasi Masing-Masing):**
   - Buka link `https://simmaci-pusat-wa.loca.lt` di browser laptop/komputer.
   - Klik tombol hijau **Proceed** (jika ada peringatan keamanan dari Localtunnel).
   - Di halaman Dashboard GoWA, klik ikon **Add Device**.
   - Masukkan ID Unik untuk madrasah mereka (misal: `migandrung` atau `mtsalfalah`). **Catat baik-baik nama ID ini**.
   - Klik **Generate QR**.
   - Scan QR Code yang muncul di layar tersebut menggunakan HP WhatsApp Official sekolah mereka.
   - Jika berhasil, nama Device ID tersebut akan tersimpan otomatis langsung ke dalam Server Yayasan.

---

## Menyambungkan SIMMACI ke Server WhatsApp

Setelah nomor WhatsApp terhubung, langkah terakhir adalah memberitahu aplikasi SIMMACI Admin agar mengirim notifikasi melalui "Device ID" yang benar.

1. Buka aplikasi **SIMMACI Admin** (web).
2. Login sebagai Admin dari salah satu Madrasah.
3. Masuk ke menu **Master Data** -> **Pengaturan Absensi**.
4. Isi konfigurasi berikut:
   - **URL Server GoWA:** Isi dengan `https://simmaci-pusat-wa.loca.lt` *(Sama untuk semua madrasah)*
   - **Device ID Madrasah:** Isi dengan ID yang dibuat pada Langkah Kedua tadi untuk sekolah yang bersangkutan (misal: `migandrung`).
5. Klik **Simpan Pengaturan**.
6. Ulangi langkah di atas untuk Madrasah lainnya.

---

## Pengaturan Lanjutan: Menyala 06.00 dan Mati 18.00 Otomatis

Agar PC Yayasan beroperasi layaknya peladen (server) mandiri yang menyala jam 6 pagi dan mati jam 6 sore, ikuti 4 tahap berikut:

### 1. Menyala Otomatis Jam 06.00 Pagi (via BIOS)
- Saat PC baru dinyalakan, segera tekan tombol **F2/Delete/F10** berulang kali.
- Masuk ke menu "Power Management" -> Aktifkan fitur "Resume by Alarm" / "Power On By RTC Alarm".
- Set jadwal alarm ke jam **06:00** setiap hari. Save & Exit.

### 2. Auto-Login Windows (Tanpa Password)
Agar setelah menyala otomatis PC tidak tersangkut di layar password:
- Masuk ke Desktop Windows -> Tekan logo Windows, ketik `netplwiz`, lalu Enter.
- Hilangkan centang pada: *"Users must enter a user name and password..."*. Klik OK.
- Masukkan password Anda 2x untuk konfirmasi.

### 3. Otomatis Menjalankan Server WA Saat Menyala
Agar jendela hitam server langsung jalan sendiri saat PC masuk Desktop:
- Tekan **Windows + R**, ketik `shell:startup`, Enter.
- Copy file `START-WA-GATEWAY.bat` (JANGAN di-cut).
- Di dalam folder *startup* tadi, klik kanan -> **Paste Shortcut** (Tempel Pintasan).

### 4. Mati Otomatis Jam 18.00 Sore (via Task Scheduler)
Agar PC hemat listrik dan mati sendiri secara rapi di sore hari:
- Klik lambang Windows (Start), ketik **Task Scheduler**, lalu buka aplikasinya.
- Di sebelah kanan klik **Create Basic Task...**
- Beri nama: `Mati Otomatis 18.00`, klik Next.
- Pilih **Daily** (Setiap Hari), klik Next.
- Atur jamnya ke **18:00:00**, klik Next.
- Pilih **Start a program**, klik Next.
- Di kotak *Program/script*, ketik: `shutdown`
- Di kotak *Add arguments*, ketik: `/s /f /t 0` (Artinya: Shutdown Force dalam 0 detik)
- Klik Next -> Finish.

Selesai! Sekarang PC Yayasan akan menyala jam 6 pagi, menjalankan mesin WhatsApp diam-diam, melayani seluruh madrasah seharian penuh, lalu mati sendiri teratur pada jam 6 sore! 🚀
