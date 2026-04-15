# Hapus SK Test dari MTs Ma'arif NU 02 Gandrungmangu

## 🎯 Quick Commands

### 1. Preview Dulu (Dry-Run) - WAJIB!

```bash
docker exec simmaci-backend php artisan sk:delete-test-submissions \
  --school="MTs Ma'arif NU 02 Gandrungmangu" \
  --dry-run
```

Atau dengan partial match:
```bash
docker exec simmaci-backend php artisan sk:delete-test-submissions \
  --school="Gandrungmangu" \
  --dry-run
```

### 2. Hapus Setelah Konfirmasi

Setelah yakin dengan preview di atas, jalankan:

```bash
docker exec simmaci-backend php artisan sk:delete-test-submissions \
  --school="MTs Ma'arif NU 02 Gandrungmangu" \
  --force
```

---

## 📋 Contoh Output

**Preview (Dry-Run):**
```
Found 2 SK document(s) to delete:

+----+---------------+------------------+----------------------------------+---------+---------------------+
| ID | Nomor SK      | Nama             | Unit Kerja                       | Status  | Created At          |
+----+---------------+------------------+----------------------------------+---------+---------------------+
| 48 | REQ/2026/0004 | Test Guru A      | MTs Ma'arif NU 02 Gandrungmangu  | pending | 2026-04-15 14:30:00 |
| 49 | REQ/2026/0005 | Test Guru B      | MTs Ma'arif NU 02 Gandrungmangu  | pending | 2026-04-15 14:35:00 |
+----+---------------+------------------+----------------------------------+---------+---------------------+

DRY RUN: No data was deleted.
```

**Actual Deletion:**
```
Found 2 SK document(s) to delete:
[table shown above]

Are you sure you want to delete these SK documents? (yes/no):
> yes

Deleting related activity logs...
Deleted 4 activity log(s).

Deleting SK documents...
Successfully deleted 2 SK document(s).

Note: SK documents are soft-deleted.
```

---

## 🔧 Filter Tambahan (Optional)

**Hapus hanya SK dengan status tertentu:**
```bash
docker exec simmaci-backend php artisan sk:delete-test-submissions \
  --school="Gandrungmangu" \
  --status="pending" \
  --dry-run
```

**Hapus SK yang dibuat setelah tanggal tertentu:**
```bash
docker exec simmaci-backend php artisan sk:delete-test-submissions \
  --school="Gandrungmangu" \
  --created-after="2026-04-15" \
  --dry-run
```

**Kombinasi filter:**
```bash
docker exec simmaci-backend php artisan sk:delete-test-submissions \
  --school="Gandrungmangu" \
  --status="pending" \
  --created-after="2026-04-15" \
  --dry-run
```

---

## ⚠️ Catatan Penting

1. **Selalu jalankan `--dry-run` dulu** untuk memastikan data yang akan dihapus sudah benar
2. Data akan di-**soft delete** (bisa di-restore jika diperlukan)
3. Activity logs terkait akan dihapus permanen
4. Gunakan `--force` untuk skip confirmation prompt

---

## 🔄 Restore Jika Salah Hapus

Jika tidak sengaja menghapus data yang salah:

```bash
docker exec simmaci-backend php artisan tinker
```

Di tinker console:
```php
// Lihat SK yang sudah dihapus dari sekolah ini
$deleted = App\Models\SkDocument::onlyTrashed()
    ->where('unit_kerja', 'like', '%Gandrungmangu%')
    ->get();

// Tampilkan
$deleted->each(fn($sk) => print_r([
    'id' => $sk->id,
    'nomor_sk' => $sk->nomor_sk,
    'nama' => $sk->nama,
    'deleted_at' => $sk->deleted_at
]));

// Restore semua SK dari sekolah ini
App\Models\SkDocument::onlyTrashed()
    ->where('unit_kerja', 'like', '%Gandrungmangu%')
    ->restore();

// Atau restore SK spesifik berdasarkan ID
App\Models\SkDocument::onlyTrashed()->find(48)->restore();
```

---

## 📞 Troubleshooting

**Tidak ada data yang muncul:**
- Cek nama sekolah sudah benar: `--school="MTs Ma'arif NU 02 Gandrungmangu"`
- Atau gunakan partial match: `--school="Gandrungmangu"`
- Coba tanpa filter status: hapus `--status="pending"`

**Error "Backend container not running":**
```bash
docker ps | grep simmaci-backend
docker compose up -d
```

---

## ✅ Checklist

- [ ] SSH ke server production
- [ ] Pull latest code: `git pull origin main`
- [ ] Jalankan dry-run untuk preview
- [ ] Verifikasi data yang akan dihapus sudah benar
- [ ] Jalankan command dengan `--force` untuk hapus
- [ ] Verifikasi data sudah terhapus
