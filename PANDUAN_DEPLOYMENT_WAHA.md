# Panduan Eksekusi Rilis & Pairing WAHA di Server Produksi (Coolify / VPS)

Dokumen ini adalah panduan operasional langkah-demi-langkah untuk melakukan deployment, inisialisasi sesi, pairing WhatsApp (Scan QR Code), dan pengujian integrasi gateway **WAHA** (*WhatsApp HTTP API* - `devlikeapro/waha`) pada lingkungan produksi **SIMMACI**.

---

## 1. Arsitektur & Spesifikasi Layanan

* **Image:** `devlikeapro/waha:latest`
* **Container Name:** `simmaci-waha`
* **Engine:** `NOWEB` (ringan, hemat RAM/CPU, tanpa browser Chromium headless)
* **Port Internal:** `3000`
* **Network Internal:** `simmaci-network` (alias DNS: `waha` dan `gowa`)
* **Network Reverse Proxy:** `coolify`
* **Domain Publik:** `https://waha.simmaci.com` (dan alias `https://gowa.simmaci.com`)
* **Volume Persistensi Sesi:** `waha-data` di-mount ke `/app/.sessions` (menjamin sesi WhatsApp **tidak terputus/logout** saat container di-restart atau di-redeploy).

---

## 2. Persiapan DNS & Environment Variables di Coolify

### A. Pengaturan DNS
Pastikan subdomain sudah mengarah ke IP Server VPS Anda:
* **Tipe:** `A`
* **Name:** `waha` (untuk `waha.simmaci.com`)
* **Target:** `<IP_SERVER_VPS>`
* **Proxy Status:** DNS Only / Proxied (jika menggunakan Cloudflare, SSL di-set *Full*)

---

### B. Environment Variables di Dashboard Coolify
Buka Dashboard Coolify → Pilih Project **SIMMACI** → Buka tab **Environment Variables**, pastikan variabel berikut telah diset:

| Variabel | Contoh Nilai | Deskripsi |
| :--- | :--- | :--- |
| **`WAHA_API_KEY`** | `WahaSecKey_9f8a7b6c5d4e3f2nd74` | Kunci otentikasi API antara Laravel SIMMACI dan WAHA |
| **`WAHA_DASHBOARD_USERNAME`** | `admin` | Username login ke Dashboard Web WAHA |
| **`WAHA_DASHBOARD_PASSWORD`** | `AdminWaha_M44r1f_2026!` | Password login ke Dashboard Web WAHA |
| **`GOWA_BASIC_AUTH`** | *(opsional / sama dengan API Key)* | Fallback kompatibilitas konfigurasi lama |

> [!IMPORTANT]
> Catat nilai `WAHA_API_KEY` dan `WAHA_DASHBOARD_PASSWORD` karena akan digunakan untuk login ke Dashboard WAHA dan konfigurasi di aplikasi SIMMACI.

---

## 3. Eksekusi Deployment di Coolify

1. **Push ke Git:** Seluruh pembaruan konfigurasi `docker-compose.coolify.yml` sudah ter-push di branch `main`.
2. **Buka Coolify:** Masuk ke dashboard Coolify pada project SIMMACI.
3. **Trigger Deploy:** Klik tombol **Redeploy** pada Docker Compose resource SIMMACI.
4. **Pantau Log Deploy:** Pastikan container `simmaci-waha` berhasil di-pull dan berstatus `Running`.
5. **Verifikasi via Terminal / SSH (Opsional):**
   ```bash
   docker ps --filter "name=simmaci-waha"
   ```
   Output harus menampilkan status `Up` dan port `3000` aktif.

---

## 4. Langkah Pairing WhatsApp (Scan QR Code)

Ikuti langkah-langkah berikut untuk menghubungkan nomor WhatsApp resmi Yayasan ke sistem:

### Langkah 1: Akses Dashboard WAHA
Buka browser dan akses URL dashboard:
```
https://waha.simmaci.com/dashboard
```
*(Atau via IP internal VPS jika domain belum aktif: `http://<IP_VPS>:3000/dashboard`)*

### Langkah 2: Login Dashboard
Masukkan kredensial yang telah dikonfigurasi:
* **Username:** `admin` (atau sesuai `WAHA_DASHBOARD_USERNAME`)
* **Password:** Password yang diatur pada `WAHA_DASHBOARD_PASSWORD`

### Langkah 3: Inisialisasi Sesi `default`
1. Pada menu **Sessions**, periksa apakah sesi bernama **`default`** sudah ada.
2. Jika belum ada, klik tombol **+ New Session**:
   * **Name:** `default`
   * Klik **Create**.
3. Klik tombol **Start** pada sesi `default`.
4. Tunggu beberapa detik, status sesi akan berubah menjadi **`SCAN_QR_CODE`** dan kode QR akan muncul di layar.

### Langkah 4: Scan QR Code dari Handphone
1. Buka aplikasi **WhatsApp** pada smartphone dengan nomor resmi Yayasan LP Ma'arif Cilacap.
2. Buka menu:
   * **Android:** Titik tiga di pojok kanan atas → **Perangkat tertaut** (*Linked devices*).
   * **iOS / iPhone:** Pengaturan (*Settings*) → **Perangkat tertaut** (*Linked devices*).
3. Ketuk **Tautkan perangkat** (*Link a device*).
4. Arahkan kamera smartphone ke kode QR yang muncul di Dashboard WAHA.
5. Tunggu proses otentikasi 5–10 detik hingga layar dashboard WAHA memperbarui status.

### Langkah 5: Verifikasi Status Sesi
Status sesi di Dashboard WAHA harus berubah menjadi:
```
🟢 WORKING
```
Jika status sudah `WORKING`, berarti gateway WhatsApp sudah resmi terhubung dan siap mengirimkan pesan.

---

## 5. Konfigurasi Gateway di Dashboard SIMMACI

Setelah WAHA berstatus `WORKING`, hubungkan kredensialnya ke dalam aplikasi SIMMACI:

### A. Pengaturan Modul WA Blast
1. Login ke aplikasi SIMMACI (`https://simmaci.com`) menggunakan akun ber-role **`super_admin`**.
2. Masuk ke menu **WA Blast** → **Konfigurasi Gateway** (`https://simmaci.com/dashboard/wa-blast/config`).
3. Isi parameter form sebagai berikut:
   * **URL Endpoint WAHA:**
     * **Rekomendasi (Internal Docker):** `http://waha:3000`  
       *(Sangat cepat, hemat bandwidth, langsung antar-kontainer tanpa keluar ke internet).*
     * **Alternatif (Domain Publik):** `https://waha.simmaci.com`
   * **API Key (WAHA):** Masukkan nilai token dari `WAHA_API_KEY`.
   * **Nomor Pengirim:** Masukkan nomor WhatsApp yang telah di-pairing dengan format Indonesia tanpa spasi/tanda hubung, contoh: `6281234567890`.
   * **Session ID (WAHA):** `default`
   * **Batas Maksimal Penerima per Sesi:** `500` (atau sesuai kapasitas yang diinginkan).
   * **Batas Pesan Harian:** `3000`
4. Klik tombol **Simpan Konfigurasi**.
5. Klik tombol **Test Koneksi**.
   * Jika sukses, akan muncul alert / toast hijau:  
     `Koneksi ke WAHA berhasil. Status sesi: WORKING.`

---

### B. Sinkronisasi Pengaturan Presensi
1. Buka menu **Presensi** → **Pengaturan** (`https://simmaci.com/dashboard/attendance/settings`).
2. Gulir ke kartu **Integrasi Gateway WhatsApp (WAHA)**:
   * **URL Server Gateway (WAHA):** `http://waha:3000` (atau `https://waha.simmaci.com`)
   * **Session ID (WAHA):** `default`
3. Klik tombol **Cek Koneksi**.
4. Badge status akan berubah menjadi **`ONLINE`** berwarna hijau 🟢.
5. Klik **Simpan Pengaturan Presensi**.

---

## 6. Uji Coba Pengiriman Pesan (Live End-to-End Test)

Lakukan pengujian langsung untuk memastikan seluruh rantai transmisi berfungsi optimal:

### Uji 1: Kirim Pesan Tunggal / Test Blast
1. Buka menu **WA Blast** → **Buat Blast Baru** (`/dashboard/wa-blast/create`).
2. Buat judul pesan: `[Uji Coba Sistem] Gateway WAHA SIMMACI`.
3. Pada bagian pemilih penerima:
   * Pilih kategori penerima khusus atau masukkan nomor WhatsApp internal staf/penguji yayasan.
4. Tulis pesan uji coba:
   ```
   Halo {{nama}}, ini adalah pesan uji coba otomatis dari Gateway WAHA SIMMACI LP Ma'arif NU Cilacap.
   Sistem beroperasi normal.
   ```
5. Pilih **Kirim Sekarang**, lalu klik tombol kirim.
6. Pantau di halaman **Detail Blast**:
   * Status berpindah dari `scheduled` → `sending` → `completed`.
   * Progress bar mencapai `100%`.
   * Pesan berhasil masuk ke WhatsApp penerima.

### Uji 2: Pengiriman Berkas / Lampiran PDF
1. Ulangi langkah di atas dengan menyertakan lampiran file PDF (misal dokumen surat atau juknis < 10 MB).
2. Verifikasi bahwa pesan teks terkirim bersamaan dengan dokumen PDF yang dapat diunduh langsung di WhatsApp penerima.

---

## 7. Pemeliharaan, Backup & Tips Stabilitas Operasional

### A. Menjaga Sesi WhatsApp Tetap Aktif (*Anti-Unlink*)
* **Jaringan Smartphone Pengirim:** Pastikan smartphone yang nomornya terhubung memiliki koneksi internet yang stabil (Wi-Fi/Paket Data).
* **Mode Hemat Daya:** Matikan fitur *Battery Optimization / Battery Saver* khusus untuk aplikasi WhatsApp di Android/iPhone agar background service WhatsApp tidak dimatikan OS.
* **Aktivitas Berkala:** WhatsApp dapat memutus sesi web jika tidak ada aktivitas selama 14–30 hari. Menjadwalkan pengiriman notifikasi rutin (presensi/pengumuman) akan menjaga sesi tetap aktif.

### B. Backup Volume Sesi WAHA
Direktori `/app/.sessions` disimpan di volume Docker bernama `waha-data`. Untuk melakukan backup manual di server:
```bash
# Backup sesi ke file tar
docker run --rm -v waha-data:/data -v $(pwd):/backup alpine tar czf /backup/waha_sessions_backup_$(date +%Y%m%d).tar.gz -C /data .

# Restore sesi jika diperlukan
docker run --rm -v waha-data:/data -v $(pwd):/backup alpine tar xzf /backup/waha_sessions_backup_YYYYMMDD.tar.gz -C /data
```

### C. Penanganan Masalah (*Troubleshooting*)

| Gejala | Penyebab Umum | Solusi |
| :--- | :--- | :--- |
| **Status Sesi `STOPPED`** | Sesi belum distart di dashboard WAHA | Buka `https://waha.simmaci.com/dashboard`, klik **Start** pada sesi `default`. |
| **Status Sesi `FAILED` / `SCAN_QR_CODE` berulang** | Sesi di-logout dari smartphone | Buka dashboard WAHA, lakukan scan ulang QR code dari WhatsApp smartphone. |
| **Error 401 Unauthorized saat Test Koneksi** | `WAHA_API_KEY` tidak cocok | Pastikan token di menu SIMMACI sama persis dengan variabel `WAHA_API_KEY` di Coolify. |
| **Error Connection Timeout** | URL endpoint salah atau network tidak terhubung | Gunakan `http://waha:3000` jika di server Coolify yang sama. |
| **502 Bad Gateway saat buka waha.simmaci.com** | Traefik belum mengenali routing port | Pastikan label `traefik.docker.network=coolify` aktif dan container dalam status running. |
