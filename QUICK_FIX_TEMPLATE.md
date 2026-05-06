# Quick Fix: Template Surat Permohonan Belum Tersedia

## Masalah
Tombol "Unduh Template" menampilkan "BELUM TERSEDIA" meskipun sudah upload template.

## Solusi Cepat (Pilih salah satu)

### ✅ Opsi 1: Menggunakan Artisan Command (Paling Mudah)

```bash
# Jalankan di terminal (di dalam folder backend atau container Docker)
php artisan sk:fix-templates --auto-activate
```

Command ini akan:
- ✅ Cek apakah template sudah ada
- ✅ Cek apakah file masih ada di storage
- ✅ Otomatis aktifkan template yang valid
- ✅ Memberikan instruksi jika ada masalah

### ✅ Opsi 2: Menggunakan SQL (Jika punya akses database)

```sql
-- 1. Cek template yang ada
SELECT id, sk_type, original_filename, is_active, created_at
FROM sk_templates
WHERE sk_type = 'surat_permohonan' AND deleted_at IS NULL
ORDER BY created_at DESC;

-- 2. Aktifkan template terbaru (ganti 1 dengan ID dari query di atas)
UPDATE sk_templates SET is_active = false WHERE sk_type = 'surat_permohonan';
UPDATE sk_templates SET is_active = true WHERE id = 1;
```

### ✅ Opsi 3: Via Admin Panel (Paling Aman)

1. Login sebagai `super_admin`
2. Buka menu **Admin Panel** (biasanya di `/admin`)
3. Pilih **SK Templates**
4. Cari template dengan type `surat_permohonan`
5. Klik tombol **"Activate"** pada template yang ingin diaktifkan

## Verifikasi

Setelah menjalankan salah satu solusi di atas:

1. **Refresh halaman** pengajuan SK (Ctrl+Shift+R)
2. Tombol "Unduh Template" seharusnya **tidak disabled** lagi
3. Klik tombol untuk test download

## Jika Masih Belum Berhasil

### Cek 1: Apakah template benar-benar ada?

```bash
php artisan sk:list-templates
```

Jika tidak ada template dengan type `surat_permohonan`, berarti memang belum pernah diupload.

### Cek 2: Apakah file masih ada di storage?

```bash
php artisan sk:check-templates
```

Jika file hilang, upload ulang template via admin panel.

### Cek 3: Test API endpoint

```bash
curl "http://localhost:8000/api/sk-templates/active?sk_type=surat_permohonan"
```

Response yang benar:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "sk_type": "surat_permohonan",
    "file_url": "https://..."
  }
}
```

## Bantuan Lebih Lanjut

Lihat dokumentasi lengkap di: [TROUBLESHOOT_TEMPLATE.md](./TROUBLESHOOT_TEMPLATE.md)

## Commands yang Tersedia

```bash
# List semua template
php artisan sk:list-templates

# Cek status template tertentu
php artisan sk:check-templates --type=surat_permohonan

# Aktifkan template tertentu
php artisan sk:activate-template <ID>

# Auto-fix masalah umum
php artisan sk:fix-templates --auto-activate
```
