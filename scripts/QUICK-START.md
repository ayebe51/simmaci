# 🚀 Quick Start - Mencari Sekolah "Tidak Terdefinisi"

## Pilih Metode Tercepat Anda:

### 1️⃣ Via Coolify Dashboard (TERMUDAH) ⭐

```
1. Login ke Coolify → Pilih project SIMMACI
2. Klik service "backend" → Klik "Terminal" atau "Shell"
3. Jalankan: php artisan school:find-undefined-jamiyyah
4. Copy hasilnya!
```

---

### 2️⃣ Via SSH (Jika punya akses SSH)

**Windows (PowerShell):**
```powershell
# Edit dulu: scripts/run-production-command.ps1
# Ubah SSH_HOST, SSH_USER, SSH_PORT

# Kemudian jalankan:
.\scripts\run-production-command.ps1
```

**Linux/Mac (Bash):**
```bash
# Edit dulu: scripts/run-production-command.sh
# Ubah SSH_HOST, SSH_USER, SSH_PORT

# Kemudian jalankan:
bash scripts/run-production-command.sh
```

**Manual SSH:**
```bash
ssh user@server.com
docker exec simmaci-backend php artisan school:find-undefined-jamiyyah
```

---

### 3️⃣ Via Database Query (Jika punya akses DB)

```sql
-- Connect ke PostgreSQL production, lalu jalankan:

SELECT 
    id, nama, npsn, 
    COALESCE(status_jamiyyah, '(NULL)') as status_jamiyyah,
    jenjang, kecamatan
FROM schools
WHERE deleted_at IS NULL
  AND CASE
        WHEN LOWER(status_jamiyyah) LIKE '%jama%ah%'
          OR LOWER(status_jamiyyah) LIKE '%afiliasi%' THEN 'jamaah'
        WHEN LOWER(status_jamiyyah) LIKE '%jam%iyyah%' THEN 'jamiyyah'
        ELSE 'undefined'
      END = 'undefined';
```

---

## 📊 Output yang Akan Muncul:

```
All unique status_jamiyyah values in database:
  - '(NULL/kosong)' (4 sekolah)
  - 'Jama'ah' (100 sekolah)
  - 'Jam'iyyah' (96 sekolah)

Found 4 schools with undefined status_jamiyyah:

ID: 123
Nama: MI Contoh 1
NPSN: 12345678
Status Jamiyyah: (NULL/kosong)
...
```

---

## 🔧 Setelah Menemukan 4 Sekolah:

**Update via Filament Admin:**
1. Login ke admin panel
2. Buka menu Schools
3. Edit sekolah tersebut
4. Isi field "Status Jamiyyah" dengan "Jama'ah" atau "Jam'iyyah"

**Atau update via SQL:**
```sql
UPDATE schools 
SET status_jamiyyah = 'Jama''ah'  -- atau 'Jam''iyyah'
WHERE id IN (123, 124, 125, 126);  -- ganti dengan ID yang ditemukan
```

---

## 📚 Dokumentasi Lengkap:

- **Panduan Detail**: `scripts/PRODUCTION-GUIDE.md`
- **SQL Query**: `scripts/find-undefined-jamiyyah.sql`
- **PHP Script**: `scripts/find-undefined-jamiyyah.php`

---

## 🆘 Troubleshooting:

| Masalah | Solusi |
|---------|--------|
| Command not found | Deploy ulang atau copy file `FindUndefinedJamiyyah.php` |
| Container not found | Cek nama container: `docker ps \| grep backend` |
| SSH connection failed | Cek kredensial SSH atau gunakan Coolify dashboard |
| Database error | Cek apakah container db berjalan: `docker ps \| grep db` |

---

**💡 Tip:** Metode #1 (Coolify Dashboard) adalah yang paling mudah dan tidak perlu setup apapun!
