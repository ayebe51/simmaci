# Panduan Menghapus Data Test SK

Setelah testing pengajuan SK berhasil, gunakan tools ini untuk menghapus data test dari production.

## 🎯 Cara Penggunaan

### Option 1: Script Interaktif (Recommended)

**Di Server Linux/Mac:**
```bash
# SSH ke server production
ssh user@your-server.com

# Masuk ke direktori project
cd /path/to/simmaci

# Pull latest code
git pull origin main

# Jalankan script
./delete-test-sk.sh
```

**Di Server Windows:**
```powershell
# Remote ke server production
# Masuk ke direktori project
cd C:\path\to\simmaci

# Pull latest code
git pull origin main

# Jalankan script
.\delete-test-sk.ps1
```

Script akan menampilkan menu interaktif:
1. **Dry-run** - Preview data yang akan dihapus (tidak menghapus apapun)
2. **Delete pending test SK** - Hapus semua SK dengan status pending dan nomor_sk REQ/*
3. **Delete specific SK** - Hapus SK berdasarkan nomor_sk tertentu
4. **Delete by date** - Hapus SK yang dibuat setelah tanggal tertentu

---

### Option 2: Command Manual

**Dry-run (Preview saja, tidak menghapus):**
```bash
docker exec simmaci-backend php artisan sk:delete-test-submissions --dry-run
```

**Hapus semua pending test SK (nomor_sk REQ/*):**
```bash
docker exec simmaci-backend php artisan sk:delete-test-submissions --force
```

**Hapus SK spesifik berdasarkan nomor_sk:**
```bash
docker exec simmaci-backend php artisan sk:delete-test-submissions \
  --nomor_sk="REQ/2026/0001" \
  --force
```

**Hapus SK yang dibuat setelah tanggal tertentu:**
```bash
docker exec simmaci-backend php artisan sk:delete-test-submissions \
  --created-after="2026-04-15" \
  --force
```

**Hapus SK dengan status tertentu:**
```bash
docker exec simmaci-backend php artisan sk:delete-test-submissions \
  --status="pending" \
  --force
```

---

## 🔍 Command Options

| Option | Description | Example |
|--------|-------------|---------|
| `--nomor_sk` | Hapus SK dengan nomor_sk spesifik | `--nomor_sk="REQ/2026/0001"` |
| `--status` | Filter berdasarkan status (default: pending) | `--status="pending"` |
| `--created-after` | Hapus SK yang dibuat setelah tanggal ini | `--created-after="2026-04-15"` |
| `--dry-run` | Preview saja, tidak menghapus | `--dry-run` |
| `--force` | Skip confirmation prompt | `--force` |

---

## ⚠️ Catatan Penting

1. **Soft Delete**: SK documents akan di-soft delete (tidak dihapus permanen)
   - Data masih ada di database dengan `deleted_at` timestamp
   - Bisa di-restore jika diperlukan

2. **Activity Logs**: Activity logs terkait SK akan dihapus permanen

3. **Default Behavior**: 
   - Tanpa options, command akan hapus semua SK dengan:
     - Status: `pending`
     - Nomor SK: dimulai dengan `REQ/` (temporary SK number)

4. **Safety First**: 
   - Selalu jalankan `--dry-run` dulu untuk preview
   - Gunakan `--force` hanya jika yakin

---

## 📊 Contoh Output

**Dry-run:**
```
Found 3 SK document(s) to delete:

+----+---------------+------------------+------------------+---------+---------------------+
| ID | Nomor SK      | Nama             | Unit Kerja       | Status  | Created At          |
+----+---------------+------------------+------------------+---------+---------------------+
| 45 | REQ/2026/0001 | Test Guru 1      | MI Test School   | pending | 2026-04-15 10:30:00 |
| 46 | REQ/2026/0002 | Test Guru 2      | MI Test School   | pending | 2026-04-15 10:35:00 |
| 47 | REQ/2026/0003 | Test Guru 3      | MI Test School   | pending | 2026-04-15 10:40:00 |
+----+---------------+------------------+------------------+---------+---------------------+

DRY RUN: No data was deleted.
```

**Actual Deletion:**
```
Found 3 SK document(s) to delete:
[table shown]

Are you sure you want to delete these SK documents? (yes/no):
> yes

Deleting related activity logs...
Deleted 6 activity log(s).

Deleting SK documents...
Successfully deleted 3 SK document(s).

Note: SK documents are soft-deleted. Use --force-delete to permanently delete.
```

---

## 🔄 Restore Data (Jika Diperlukan)

Jika perlu restore SK yang sudah dihapus:

```bash
docker exec simmaci-backend php artisan tinker
```

Kemudian di tinker:
```php
// Lihat SK yang sudah dihapus
$deleted = App\Models\SkDocument::onlyTrashed()->get();

// Restore SK tertentu
App\Models\SkDocument::onlyTrashed()->where('nomor_sk', 'REQ/2026/0001')->restore();

// Restore semua
App\Models\SkDocument::onlyTrashed()->restore();
```

---

## 🆘 Troubleshooting

**Error: "Backend container not running"**
```bash
# Check container status
docker ps | grep simmaci

# Start containers if needed
docker compose up -d
```

**Error: "Command not found"**
```bash
# Pull latest code
git pull origin main

# Check if command exists
docker exec simmaci-backend php artisan list | grep sk:
```

**Error: "Permission denied"**
```bash
# Make script executable (Linux/Mac)
chmod +x delete-test-sk.sh
```

---

## 📞 Support

Jika ada pertanyaan atau masalah:
1. Check Laravel logs: `docker exec simmaci-backend tail -f storage/logs/laravel.log`
2. Check command help: `docker exec simmaci-backend php artisan sk:delete-test-submissions --help`
3. Contact system administrator
