# Cara Mencari SK Hasan Puro via Docker VPS

SSH ke server dulu, lalu jalankan salah satu cara di bawah.

---

## CARA 1 — One-liner Langsung (Paling Cepat)

Tidak perlu copy file apapun. Jalankan langsung dari SSH:

```bash
# Cari di sk_documents (aktif + soft-deleted)
docker exec simmaci-db psql -U sim_user -d sim_maarif -c "
SELECT id, nomor_sk, nama, jabatan, unit_kerja, jenis_sk, status,
       tanggal_penetapan, teacher_id, created_at, deleted_at,
       CASE WHEN deleted_at IS NOT NULL THEN '*** SOFT-DELETED ***' ELSE 'aktif' END AS kondisi
FROM sk_documents
WHERE LOWER(nama) LIKE '%hasan%puro%'
ORDER BY created_at DESC;
"
```

```bash
# Cari juga di tabel teachers
docker exec simmaci-db psql -U sim_user -d sim_maarif -c "
SELECT id, nama, nuptk, nomor_induk_maarif, unit_kerja, status,
       created_at, deleted_at,
       CASE WHEN deleted_at IS NOT NULL THEN '*** SOFT-DELETED ***' ELSE 'aktif' END AS kondisi
FROM teachers
WHERE LOWER(nama) LIKE '%hasan%puro%'
ORDER BY created_at DESC;
"
```

```bash
# Cari di activity_log (jejak siapa yang menghapus)
docker exec simmaci-db psql -U sim_user -d sim_maarif -c "
SELECT id, description, event, subject_type, subject_id, causer_id, created_at
FROM activity_log
WHERE LOWER(description) LIKE '%hasan%puro%'
   OR LOWER(properties::text) LIKE '%hasan%puro%'
ORDER BY created_at DESC
LIMIT 20;
"
```

---

## CARA 2 — Script PHP Lengkap (Output Lebih Detail)

```bash
# Step 1: Copy script ke container backend
docker cp /path/di/server/cari_sk_hasan_puro.php simmaci-backend:/var/www/html/

# Step 2: Jalankan
docker exec simmaci-backend php /var/www/html/cari_sk_hasan_puro.php
```

> Jika file sudah ada di repo dan ter-deploy, langsung jalankan:
> ```bash
> docker exec simmaci-backend php /var/www/html/cari_sk_hasan_puro.php
> ```

---

## CARA 3 — Artisan Tinker (Interaktif)

```bash
docker exec -it simmaci-backend php artisan tinker
```

Setelah masuk tinker, paste:

```php
// Cari SK (aktif + soft-deleted)
DB::table('sk_documents')
  ->whereRaw("LOWER(nama) LIKE '%hasan%puro%'")
  ->get(['id','nomor_sk','nama','unit_kerja','jenis_sk','status','created_at','deleted_at']);
```

```php
// Cari guru (aktif + soft-deleted)
DB::table('teachers')
  ->whereRaw("LOWER(nama) LIKE '%hasan%puro%'")
  ->get(['id','nama','nuptk','nomor_induk_maarif','unit_kerja','status','deleted_at']);
```

---

## JIKA DITEMUKAN SOFT-DELETED — Restore

### Cara cepat via psql (ganti 123 dengan ID yang ditemukan):
```bash
docker exec simmaci-db psql -U sim_user -d sim_maarif -c "
UPDATE sk_documents SET deleted_at = NULL WHERE id = 123;
"
```

### Restore via tinker:
```php
// Di dalam tinker — ganti 123 dengan ID yang ditemukan
DB::table('sk_documents')->where('id', 123)->update(['deleted_at' => null]);

// Verifikasi
DB::table('sk_documents')->where('id', 123)->first();
```

### Restore via script PHP (dengan dry-run & konfirmasi):
```bash
# Edit $targetIds terlebih dahulu, lalu:
docker cp restore_sk_hasan_puro.php simmaci-backend:/var/www/html/
docker exec -it simmaci-backend php /var/www/html/restore_sk_hasan_puro.php
```

---

## Cek Semua SK dari Sekolah yang Mengandung "Puro"

Kalau nama gurunya berbeda tapi sekolahnya sama:

```bash
docker exec simmaci-db psql -U sim_user -d sim_maarif -c "
SELECT id, nomor_sk, nama, unit_kerja, jenis_sk, status, created_at, deleted_at
FROM sk_documents
WHERE LOWER(unit_kerja) LIKE '%puro%'
ORDER BY nama, created_at DESC;
"
```
