# 🔐 Panduan SSH ke Server Production

## Container yang Anda Miliki:
```
backend-yam0yy9a6l424v8j89hv7pqr-025135358293
```

Container ini ada di **server production** (bukan di komputer lokal Anda).

---

## 📋 Langkah-Langkah:

### **Step 1: Dapatkan Kredensial SSH**

Anda perlu informasi berikut:
- **Host/IP Server**: Contoh: `123.456.789.0` atau `server.simmaci.com`
- **Username**: Contoh: `root`, `ubuntu`, `admin`, dll
- **Port**: Biasanya `22` (default)
- **Password** atau **SSH Key**

**Cara mendapatkan:**
1. Buka **Coolify Dashboard**
2. Pilih project **SIMMACI**
3. Cari menu **"Server"** atau **"Settings"**
4. Lihat **"SSH Connection"** atau **"Server Details"**

Atau tanya ke DevOps/sysadmin yang setup Coolify.

---

### **Step 2: Connect via SSH**

#### **Opsi A: Via PowerShell (Windows)**

```powershell
# Format:
ssh username@server-ip-or-domain

# Contoh:
ssh root@123.456.789.0
# atau
ssh ubuntu@server.simmaci.com

# Jika port bukan 22:
ssh -p 2222 root@server.simmaci.com
```

#### **Opsi B: Via PuTTY (Windows)**

1. Download PuTTY: https://www.putty.org/
2. Buka PuTTY
3. Isi:
   - **Host Name**: IP atau domain server
   - **Port**: 22 (atau sesuai)
   - **Connection Type**: SSH
4. Klik **"Open"**
5. Login dengan username dan password

#### **Opsi C: Via VS Code Remote SSH**

1. Install extension: **"Remote - SSH"**
2. Tekan `Ctrl+Shift+P`
3. Pilih **"Remote-SSH: Connect to Host"**
4. Masukkan: `username@server-ip`
5. Pilih platform: Linux
6. Masukkan password

---

### **Step 3: Jalankan Command**

Setelah berhasil SSH ke server, jalankan:

```bash
# Cek apakah container berjalan
docker ps | grep backend

# Jalankan command
docker exec backend-yam0yy9a6l424v8j89hv7pqr-025135358293 php artisan school:find-undefined-jamiyyah
```

**Atau gunakan script yang sudah saya buat:**

```bash
# Upload script ke server dulu (via scp atau copy-paste)
# Kemudian jalankan:
bash scripts/run-on-coolify-backend.sh
```

---

### **Step 4: Copy Hasilnya**

Command akan menampilkan output seperti:

```
All unique status_jamiyyah values in database:
  - '(NULL/kosong)' (4 sekolah)
  - 'Jama'ah' (100 sekolah)
  - 'Jam'iyyah' (96 sekolah)

Found 4 schools with undefined status_jamiyyah:

ID: 123
Nama: MI Contoh 1
NPSN: 12345678
Jenjang: MI
Kecamatan: Cilacap Tengah
Status Jamiyyah: (NULL/kosong)

...
```

**Copy semua output** dan simpan untuk referensi.

---

## 🔧 Troubleshooting

### Error: "Permission denied (publickey)"
```bash
# Anda perlu SSH key atau password
# Tanya ke DevOps untuk mendapatkan akses
```

### Error: "Connection refused"
```bash
# Cek apakah IP/domain benar
# Cek apakah port benar (default 22)
# Cek apakah firewall mengizinkan SSH
```

### Error: "No such container"
```bash
# Cek nama container yang benar:
docker ps

# Mungkin nama container berbeda atau container tidak berjalan
# Restart container jika perlu:
docker restart backend-yam0yy9a6l424v8j89hv7pqr-025135358293
```

### Tidak punya akses SSH
**Alternatif: Via Coolify Dashboard**
1. Login ke Coolify
2. Pilih project SIMMACI
3. Klik service "backend"
4. Klik tombol "Terminal" atau "Execute Command"
5. Jalankan: `php artisan school:find-undefined-jamiyyah`

---

## 📝 Upload Script ke Server

Jika ingin menggunakan script yang sudah dibuat:

### Via SCP (dari komputer lokal):
```bash
# Upload script
scp scripts/run-on-coolify-backend.sh username@server:/tmp/

# SSH ke server
ssh username@server

# Jalankan script
bash /tmp/run-on-coolify-backend.sh
```

### Via Copy-Paste:
```bash
# SSH ke server dulu
ssh username@server

# Buat file
nano /tmp/run-command.sh

# Copy-paste isi dari scripts/run-on-coolify-backend.sh
# Tekan Ctrl+X, Y, Enter untuk save

# Jalankan
bash /tmp/run-command.sh
```

---

## 🎯 Ringkasan Command

Setelah SSH ke server, jalankan salah satu:

```bash
# Cara 1: Langsung
docker exec backend-yam0yy9a6l424v8j89hv7pqr-025135358293 php artisan school:find-undefined-jamiyyah

# Cara 2: Masuk ke container dulu
docker exec -it backend-yam0yy9a6l424v8j89hv7pqr-025135358293 bash
php artisan school:find-undefined-jamiyyah
exit

# Cara 3: Via script
bash scripts/run-on-coolify-backend.sh
```

---

## 💡 Tips

- Simpan kredensial SSH di password manager (LastPass, 1Password, dll)
- Gunakan SSH key untuk keamanan lebih baik (bukan password)
- Jika sering SSH, buat alias di `~/.ssh/config`:
  ```
  Host simmaci-prod
      HostName server.simmaci.com
      User root
      Port 22
  ```
  Kemudian cukup: `ssh simmaci-prod`

---

## 🆘 Butuh Bantuan?

Jika masih kesulitan, berikan informasi:
1. ✅ Apakah Anda punya akses SSH? (ya/tidak)
2. ✅ Apakah Anda punya akses Coolify dashboard? (ya/tidak)
3. ✅ Error message yang muncul (jika ada)
4. ✅ Screenshot dari Coolify (jika memungkinkan)

Saya akan bantu dengan metode alternatif! 🚀
