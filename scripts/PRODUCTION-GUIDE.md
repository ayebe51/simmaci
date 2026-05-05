# Panduan Menjalankan Command di Production

## 🎯 Tujuan
Mencari 4 madrasah/sekolah dengan status jamiyyah "Tidak Terdefinisi" di database production.

---

## 📋 Pilihan Metode

### **Metode 1: Via Coolify Dashboard (Paling Mudah)** ⭐

1. **Login ke Coolify Dashboard**
   - Buka dashboard Coolify Anda
   - Pilih project SIMMACI

2. **Buka Terminal Container Backend**
   - Klik pada service `backend` (simmaci-backend)
   - Cari menu "Terminal" atau "Execute Command"
   - Atau klik tombol "Shell" / "Console"

3. **Jalankan Command**
   ```bash
   php artisan school:find-undefined-jamiyyah
   ```

4. **Copy Hasilnya**
   - Command akan menampilkan daftar 4 sekolah
   - Copy ID, nama, dan detail sekolah tersebut

---

### **Metode 2: Via SSH ke Server** 🔧

#### A. Jika Anda sudah tahu detail SSH server:

```bash
# Edit file ini terlebih dahulu:
nano scripts/run-production-command.sh

# Ubah:
# SSH_HOST="your-production-server.com"
# SSH_USER="root"
# SSH_PORT="22"

# Kemudian jalankan:
bash scripts/run-production-command.sh
```

#### B. Manual via SSH:

```bash
# 1. SSH ke server production
ssh user@your-server.com

# 2. Cek container yang berjalan
docker ps | grep backend

# 3. Jalankan command di container
docker exec simmaci-backend php artisan school:find-undefined-jamiyyah

# Atau masuk ke container dulu:
docker exec -it simmaci-backend bash
php artisan school:find-undefined-jamiyyah
exit
```

---

### **Metode 3: Via Database Query Langsung** 💾

Jika Anda memiliki akses ke PostgreSQL production:

#### A. Via pgAdmin / DBeaver / TablePlus:

1. Connect ke database production:
   - Host: (server production Anda)
   - Port: 5432
   - Database: sim_maarif
   - User: sim_user
   - Password: (dari environment variable)

2. Jalankan query dari file:
   ```sql
   -- Copy isi dari scripts/find-undefined-jamiyyah.sql
   ```

#### B. Via psql command line:

```bash
# SSH ke server dulu
ssh user@your-server.com

# Connect ke PostgreSQL di container
docker exec -it simmaci-db psql -U sim_user -d sim_maarif

# Jalankan query:
SELECT 
    id,
    nama,
    npsn,
    COALESCE(status_jamiyyah, '(NULL/kosong)') as status_jamiyyah,
    jenjang,
    kecamatan
FROM schools
WHERE deleted_at IS NULL
  AND CASE
        WHEN LOWER(status_jamiyyah) LIKE '%jama%ah%'
          OR LOWER(status_jamiyyah) LIKE '%afiliasi%' THEN 'jamaah'
        WHEN LOWER(status_jamiyyah) LIKE '%jam%iyyah%' THEN 'jamiyyah'
        ELSE 'undefined'
      END = 'undefined'
ORDER BY nama;

# Keluar dari psql
\q
```

---

### **Metode 4: Via Coolify API** 🚀

Jika Coolify Anda support API:

```bash
# Dapatkan API token dari Coolify dashboard
# Kemudian jalankan:

curl -X POST https://your-coolify.com/api/v1/applications/{app-id}/execute \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "php artisan school:find-undefined-jamiyyah",
    "service": "backend"
  }'
```

---

## 📊 Output yang Diharapkan

Command akan menampilkan:

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

ID: 124
Nama: MTs Contoh 2
NPSN: 87654321
Jenjang: MTs
Kecamatan: Cilacap Selatan
Status Jamiyyah: (NULL/kosong)

...
```

---

## 🔍 Troubleshooting

### Error: "Command not found"
```bash
# Pastikan command sudah di-deploy ke production
# Cek apakah file ada:
docker exec simmaci-backend ls -la app/Console/Commands/FindUndefinedJamiyyah.php

# Jika tidak ada, deploy ulang atau copy file manual
```

### Error: "Database connection failed"
```bash
# Cek apakah container db berjalan:
docker ps | grep simmaci-db

# Cek environment variables:
docker exec simmaci-backend env | grep DB_
```

### Container tidak ditemukan
```bash
# Lihat semua container yang berjalan:
docker ps

# Cari nama container backend yang benar
# Mungkin namanya berbeda, misalnya:
# - simmaci-backend-1
# - simmaci_backend_1
# - coolify-simmaci-backend
```

---

## 📝 Langkah Selanjutnya

Setelah menemukan 4 sekolah tersebut:

1. **Catat detail sekolah** (ID, nama, NPSN)
2. **Tentukan status yang benar** untuk masing-masing sekolah
3. **Update via Filament admin panel** atau via SQL:

```sql
-- Update satu per satu
UPDATE schools 
SET status_jamiyyah = 'Jama''ah'  -- atau 'Jam''iyyah'
WHERE id = 123;

-- Atau batch update
UPDATE schools 
SET status_jamiyyah = 'Jama''ah'
WHERE id IN (123, 124, 125, 126);
```

4. **Verifikasi** di dashboard bahwa angka "Tidak Terdefinisi" sudah 0

---

## 💡 Tips

- **Backup database** sebelum melakukan update massal
- **Screenshot** hasil command untuk dokumentasi
- Jika tidak bisa akses SSH, minta bantuan DevOps/sysadmin
- Simpan kredensial SSH di password manager yang aman

---

## 🆘 Butuh Bantuan?

Jika semua metode di atas tidak berhasil, berikan informasi berikut:

1. Platform hosting yang digunakan (VPS, cloud provider, dll)
2. Apakah punya akses SSH? (ya/tidak)
3. Apakah punya akses Coolify dashboard? (ya/tidak)
4. Error message yang muncul (jika ada)
5. Screenshot dari Coolify dashboard (jika memungkinkan)
