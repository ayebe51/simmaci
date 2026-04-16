# Hapus SK dari MI Darwata Glempang (Kecuali 2 Nama)

## 🎯 Tujuan

Menghapus semua pengajuan SK dari **MI Darwata Glempang** KECUALI 2 nama berikut:
1. **WARDAH URJUWAN ARIBAH, S.Pd.**
2. **NILNA FAIZALLUQYANA, S.Pd.**

---

## 📋 Command

### 1. Preview Dulu (Dry-Run) - WAJIB!

```bash
docker exec <backend-container-id> php artisan sk:delete-test-submissions \
  --school="MI Darwata Glempang" \
  --exclude-names="WARDAH URJUWAN ARIBAH,NILNA FAIZALLUQYANA" \
  --dry-run
```

**Ganti `<backend-container-id>` dengan container ID yang benar.**

Untuk mendapatkan container ID:
```bash
docker ps | grep backend
```

---

### 2. Hapus Setelah Konfirmasi

Setelah yakin dengan preview di atas, jalankan:

```bash
docker exec <backend-container-id> php artisan sk:delete-test-submissions \
  --school="MI Darwata Glempang" \
  --exclude-names="WARDAH URJUWAN ARIBAH,NILNA FAIZALLUQYANA" \
  --force
```

---

## 📊 Contoh Output

### Dry-Run (Preview):

```
Found 18 SK document(s) to delete:

+----+---------------+---------------------------+---------------------------+---------+---------------------+
| ID | Nomor SK      | Nama                      | Unit Kerja                | Status  | Created At          |
+----+---------------+---------------------------+---------------------------+---------+---------------------+
| 10 | REQ/2026/0010 | GURU A                    | MI Darwata Glempang       | pending | 2026-04-16 10:00:00 |
| 11 | REQ/2026/0011 | GURU B                    | MI Darwata Glempang       | pending | 2026-04-16 10:01:00 |
| 12 | REQ/2026/0012 | GURU C                    | MI Darwata Glempang       | pending | 2026-04-16 10:02:00 |
...
+----+---------------+---------------------------+---------------------------+---------+---------------------+

DRY RUN: No data was deleted.
```

**Note**: WARDAH URJUWAN ARIBAH dan NILNA FAIZALLUQYANA **TIDAK** muncul di list (sudah di-exclude).

---

### Actual Deletion:

```
Found 18 SK document(s) to delete:
[table shown above]

Are you sure you want to delete these SK documents? (yes/no):
> yes

Deleting related activity logs...
Deleted 36 activity log(s).

Deleting SK documents...
Successfully deleted 18 SK document(s).

Note: SK documents are soft-deleted.
```

---

## ⚠️ Catatan Penting

### Yang Akan Dihapus:
- ✅ Semua SK dari MI Darwata Glempang
- ✅ Status: pending
- ✅ Nomor SK: REQ/* (temporary)
- ❌ **KECUALI**: WARDAH URJUWAN ARIBAH dan NILNA FAIZALLUQYANA

### Yang Dipertahankan:
- ✅ WARDAH URJUWAN ARIBAH, S.Pd. (REQ/2026/0009)
- ✅ NILNA FAIZALLUQYANA, S.Pd. (REQ/2026/0008)

---

## 🔍 Verifikasi Setelah Hapus

### Cek SK yang Tersisa:

```bash
docker exec <backend-container-id> php artisan tinker
```

Di tinker:
```php
// Cek SK dari MI Darwata Glempang yang masih ada
$remaining = App\Models\SkDocument::withoutTenantScope()
    ->where('unit_kerja', 'like', '%Glempang%')
    ->where('status', 'pending')
    ->get(['id', 'nomor_sk', 'nama', 'unit_kerja']);

// Tampilkan
$remaining->each(fn($sk) => print_r([
    'id' => $sk->id,
    'nomor_sk' => $sk->nomor_sk,
    'nama' => $sk->nama,
]));

// Expected: Hanya 2 SK (WARDAH dan NILNA)
```

---

## 🔄 Jika Perlu Restore

Jika tidak sengaja menghapus yang salah:

```bash
docker exec <backend-container-id> php artisan tinker
```

```php
// Restore SK yang terhapus dari MI Darwata Glempang
App\Models\SkDocument::onlyTrashed()
    ->where('unit_kerja', 'like', '%Glempang%')
    ->restore();
```

---

## 🎯 Alternative: Hapus Berdasarkan Nomor SK

Jika ingin lebih spesifik, bisa hapus berdasarkan nomor SK satu per satu:

```bash
# Preview SK tertentu
docker exec <backend-container-id> php artisan sk:delete-test-submissions \
  --nomor_sk="REQ/2026/0010" \
  --dry-run

# Hapus jika yakin
docker exec <backend-container-id> php artisan sk:delete-test-submissions \
  --nomor_sk="REQ/2026/0010" \
  --force
```

---

## 📞 Troubleshooting

### Issue: Nama tidak ter-exclude

**Penyebab**: Nama di database berbeda dengan yang di-exclude (typo, spasi, gelar)

**Solusi**: Cek nama exact di database dulu:

```bash
docker exec <backend-container-id> php artisan tinker
```

```php
// Cek nama exact
App\Models\SkDocument::withoutTenantScope()
    ->where('unit_kerja', 'like', '%Glempang%')
    ->pluck('nama');
```

Kemudian gunakan nama exact untuk exclude.

---

### Issue: Masih ada SK yang tidak terhapus

**Cek status SK:**

```bash
docker exec <backend-container-id> php artisan tinker
```

```php
// Cek status SK
App\Models\SkDocument::withoutTenantScope()
    ->where('unit_kerja', 'like', '%Glempang%')
    ->pluck('status', 'nama');
```

Jika status bukan `pending`, tambahkan `--status=<status>` di command.

---

## ✅ Checklist

- [ ] SSH ke server production
- [ ] Pull latest code: `git pull origin main`
- [ ] Get backend container ID: `docker ps | grep backend`
- [ ] Run dry-run untuk preview
- [ ] Verifikasi WARDAH dan NILNA TIDAK muncul di list
- [ ] Jalankan command dengan `--force` untuk hapus
- [ ] Verifikasi hanya 2 SK yang tersisa (WARDAH dan NILNA)
- [ ] Cek di aplikasi web bahwa SK lain sudah terhapus

---

**Last Updated**: 2026-04-16
**Commit**: e71aecd
