# 📁 Scripts Directory - SIMMACI

Kumpulan script dan tools untuk maintenance dan troubleshooting SIMMACI.

---

## 🔍 Mencari Sekolah dengan Status Jamiyyah "Tidak Terdefinisi"

### 📄 File yang Tersedia:

| File | Deskripsi | Cara Pakai |
|------|-----------|------------|
| **QUICK-START.md** | 🚀 Panduan cepat (mulai dari sini!) | Baca dulu file ini |
| **PRODUCTION-GUIDE.md** | 📖 Panduan lengkap semua metode | Referensi detail |
| **run-production-command.ps1** | 💻 Script PowerShell (Windows) | `.\scripts\run-production-command.ps1` |
| **run-production-command.sh** | 🐧 Script Bash (Linux/Mac) | `bash scripts/run-production-command.sh` |
| **find-undefined-jamiyyah.php** | 🐘 Standalone PHP script | `php scripts/find-undefined-jamiyyah.php` |
| **find-undefined-jamiyyah.sql** | 🗄️ SQL query langsung | Copy-paste ke psql/pgAdmin |
| **README-find-undefined-jamiyyah.md** | 📚 Dokumentasi teknis | Penjelasan logika & solusi |

### 🎯 Cara Tercepat:

**Opsi 1: Via Coolify Dashboard** (Paling Mudah!)
```
1. Login Coolify → Pilih SIMMACI
2. Klik "backend" → Klik "Terminal"
3. Jalankan: php artisan school:find-undefined-jamiyyah
```

**Opsi 2: Via SSH**
```bash
ssh user@server.com
docker exec simmaci-backend php artisan school:find-undefined-jamiyyah
```

**Opsi 3: Via Script Otomatis**
```powershell
# Windows
.\scripts\run-production-command.ps1

# Linux/Mac
bash scripts/run-production-command.sh
```

---

## 📊 Script Lainnya

### `generate_excel_template.js`
Generate template Excel untuk import data.

```bash
node scripts/generate_excel_template.js
```

---

## 🛠️ Menambahkan Script Baru

1. Buat file di folder `scripts/`
2. Tambahkan dokumentasi di `README.md` ini
3. Commit dan push ke repository

---

## 📝 Konvensi Penamaan

- **`.sh`** - Bash script (Linux/Mac)
- **`.ps1`** - PowerShell script (Windows)
- **`.php`** - PHP script (standalone atau via artisan)
- **`.sql`** - SQL query
- **`.js`** - Node.js script
- **`.md`** - Dokumentasi

---

## 🔐 Keamanan

⚠️ **PENTING:**
- Jangan commit kredensial (password, API key, dll) ke repository
- Gunakan environment variables untuk data sensitif
- Backup database sebelum menjalankan script yang mengubah data
- Test di local/staging sebelum production

---

## 📞 Support

Jika ada masalah atau pertanyaan:
1. Baca dokumentasi di folder `scripts/`
2. Cek troubleshooting di `PRODUCTION-GUIDE.md`
3. Hubungi tim DevOps/sysadmin

---

**Last Updated:** 2026-05-04
