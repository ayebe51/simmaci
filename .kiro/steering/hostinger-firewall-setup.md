# Buka Port 9000 dan 9001 di Hostinger

## Info Anda
- **Hosting Provider**: Hostinger
- **IP Server**: 76.13.193.161
- **Port yang perlu dibuka**: 9000, 9001

---

## Langkah-Langkah

### Langkah 1: Login ke Hostinger hPanel

1. Buka https://hpanel.hostinger.com
2. Login dengan email dan password Hostinger Anda

---

### Langkah 2: Cari VPS atau Server Anda

Di dashboard Hostinger:

1. Cari menu **VPS** atau **Servers** (di sidebar kiri)
2. Pilih VPS/server dengan IP `76.13.193.161`
3. Klik untuk masuk ke detail server

---

### Langkah 3: Cari Firewall Settings

Di halaman detail server:

1. Cari tab atau menu **Firewall** atau **Security**
2. Atau cari **Network** → **Firewall**
3. Klik untuk buka firewall settings

---

### Langkah 4: Tambah Rule untuk Port 9000

Di Firewall settings:

1. Klik **Add Rule** atau **+ Add Firewall Rule**
2. Isi form:
   ```
   Protocol: TCP
   Port: 9000
   Source: 0.0.0.0/0 (Allow All)
   Action: Allow
   ```
3. Klik **Save** atau **Add**

---

### Langkah 5: Tambah Rule untuk Port 9001

1. Klik **Add Rule** atau **+ Add Firewall Rule** lagi
2. Isi form:
   ```
   Protocol: TCP
   Port: 9001
   Source: 0.0.0.0/0 (Allow All)
   Action: Allow
   ```
3. Klik **Save** atau **Add**

---

### Langkah 6: Verifikasi Rules Sudah Tersimpan

Setelah tambah kedua rules:

1. Pastikan kedua rule muncul di list firewall rules
2. Status seharusnya **Active** atau **Enabled**
3. Tunggu 1-2 menit untuk propagation

---

## Verifikasi Port Sudah Terbuka

Setelah setup firewall, verifikasi dengan salah satu cara:

### Cara 1: Gunakan Online Tool

1. Buka https://www.canyouseeme.org/
2. Masukkan:
   - IP: `76.13.193.161`
   - Port: `9000`
3. Klik **Check**
4. Hasil seharusnya: **"Success: I can see your service on 76.13.193.161 : 9000"**

Ulangi untuk port 9001.

### Cara 2: Gunakan Command Line

Jika Anda bisa akses terminal:

```bash
telnet 76.13.193.161 9000
```

Hasil yang benar:
```
Trying 76.13.193.161...
Connected to 76.13.193.161.
Escape character is '^]'.
```

---

## Troubleshooting

### Port masih tidak terbuka
- Pastikan rule sudah **Active/Enabled**
- Tunggu 2-3 menit untuk propagation
- Refresh browser dan coba lagi

### Masih error setelah buka port
- Cek apakah MinIO service running di Coolify
- Cek Coolify logs untuk error
- Verifikasi docker-compose.coolify.yml

### Tidak bisa akses hPanel
- Pastikan email dan password benar
- Coba reset password di https://hpanel.hostinger.com/forgot-password

---

## Checklist

- [ ] Login ke hPanel Hostinger
- [ ] Pilih VPS/server dengan IP 76.13.193.161
- [ ] Buka Firewall settings
- [ ] Tambah rule untuk port 9000 (TCP, Allow All)
- [ ] Tambah rule untuk port 9001 (TCP, Allow All)
- [ ] Verifikasi rules sudah Active
- [ ] Tunggu 1-2 menit
- [ ] Verifikasi port terbuka dengan online tool
- [ ] Coba akses `http://76.13.193.161:9000`

---

## Setelah Port Terbuka

Setelah port 9000 dan 9001 terbuka:

1. **Coba akses MinIO via IP**
   - URL: `http://76.13.193.161:9000`
   - Seharusnya bisa diakses

2. **Coba akses MinIO Console**
   - URL: `http://76.13.193.161:9001`
   - Login dengan credentials MinIO

3. **Jika berhasil, lanjut ke setup domain**
   - MinIO API: `https://minio.simmaci.com`
   - MinIO Console: `https://minio-console.simmaci.com`

