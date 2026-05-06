# Troubleshooting: Template Surat Permohonan Belum Tersedia

## Masalah
Template surat permohonan SK menampilkan status "BELUM TERSEDIA" meskipun sudah diupload.

## Kemungkinan Penyebab

### 1. Template Belum Diaktifkan
Template sudah diupload tapi `is_active = false`

### 2. File Tidak Ada di Storage
Record ada di database tapi file fisiknya hilang

### 3. sk_type Tidak Cocok
Frontend mencari `'surat_permohonan'` tapi yang diupload dengan nama berbeda

## Cara Diagnosa

### Opsi 1: Menggunakan Artisan Command (Recommended)

```bash
# Di dalam container Docker
docker exec simmaci-backend php artisan sk:check-templates

# Atau jika menjalankan Laravel langsung
cd backend
php artisan sk:check-templates
```

### Opsi 2: Menggunakan Script PHP

```bash
cd backend
php troubleshoot-template.php
```

### Opsi 3: Query Database Langsung

```sql
-- Cek semua template surat permohonan
SELECT 
    id,
    sk_type,
    original_filename,
    is_active,
    file_path,
    disk,
    uploaded_by,
    created_at,
    deleted_at
FROM sk_templates
WHERE sk_type = 'surat_permohonan'
ORDER BY created_at DESC;

-- Cek template yang aktif
SELECT * FROM sk_templates 
WHERE sk_type = 'surat_permohonan' 
AND is_active = true 
AND deleted_at IS NULL;
```

### Opsi 4: Test API Endpoint

```bash
# Test endpoint dari terminal
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:8000/api/sk-templates/active?sk_type=surat_permohonan"

# Atau buka di browser (jika sudah login)
http://localhost:8000/api/sk-templates/active?sk_type=surat_permohonan
```

## Solusi

### Solusi 1: Aktifkan Template yang Sudah Ada

Jika template sudah ada tapi belum aktif:

```bash
# Menggunakan artisan command
php artisan sk:activate-template <TEMPLATE_ID>

# Atau menggunakan auto-fix
php artisan sk:fix-templates --auto-activate
```

Atau via SQL:

```sql
-- Nonaktifkan semua template surat permohonan
UPDATE sk_templates 
SET is_active = false 
WHERE sk_type = 'surat_permohonan';

-- Aktifkan template tertentu (ganti <ID> dengan ID template)
UPDATE sk_templates 
SET is_active = true 
WHERE id = <ID>;
```

### Solusi 2: Upload Ulang Template

Jika file hilang dari storage:

1. Login sebagai `super_admin`
2. Buka menu Admin Panel → SK Templates
3. Upload file template baru
4. Klik "Activate" pada template yang baru diupload

### Solusi 3: Perbaiki sk_type

Jika template diupload dengan sk_type yang salah:

```sql
-- Cek semua sk_type yang ada
SELECT DISTINCT sk_type FROM sk_templates;

-- Update sk_type jika salah (misalnya dari 'surat-permohonan' ke 'surat_permohonan')
UPDATE sk_templates 
SET sk_type = 'surat_permohonan' 
WHERE sk_type = 'surat-permohonan';
```

### Solusi 4: Verifikasi File Storage

Jika menggunakan MinIO/S3:

```bash
# Cek bucket MinIO
docker exec simmaci-mc mc ls local/simmaci-storage/sk-templates/

# Atau cek storage lokal
ls -la backend/storage/app/public/sk-templates/
```

## Artisan Commands yang Tersedia

```bash
# Diagnosa masalah template
php artisan sk:check-templates [--type=surat_permohonan]

# Aktifkan template tertentu
php artisan sk:activate-template <template_id>

# Auto-fix masalah umum
php artisan sk:fix-templates [--type=surat_permohonan] [--auto-activate]
```

## Verifikasi Setelah Perbaikan

1. **Test API Endpoint**
   ```bash
   curl "http://localhost:8000/api/sk-templates/active?sk_type=surat_permohonan"
   ```
   
   Response yang benar:
   ```json
   {
     "success": true,
     "message": "Berhasil.",
     "data": {
       "id": 1,
       "sk_type": "surat_permohonan",
       "original_filename": "Template Surat Permohonan.docx",
       "is_active": true,
       "file_url": "https://..."
     }
   }
   ```

2. **Test di Frontend**
   - Refresh halaman pengajuan SK
   - Button "Unduh Template" seharusnya tidak disabled
   - Klik button untuk download template

3. **Cek Browser Console**
   - Buka Developer Tools (F12)
   - Cek tab Console untuk error
   - Cek tab Network untuk response API

## Debugging Frontend

Jika backend sudah OK tapi frontend masih error:

1. **Clear Cache**
   ```bash
   # Clear browser cache atau hard refresh
   Ctrl + Shift + R (Windows/Linux)
   Cmd + Shift + R (Mac)
   ```

2. **Cek React Query Cache**
   - Install React Query Devtools
   - Cek query key: `['sk-template-surat-permohonan']`
   - Invalidate query jika perlu

3. **Cek API Response**
   ```javascript
   // Di browser console
   fetch('/api/sk-templates/active?sk_type=surat_permohonan', {
     headers: {
       'Authorization': 'Bearer ' + localStorage.getItem('auth_token')
     }
   })
   .then(r => r.json())
   .then(console.log)
   ```

## Pencegahan

1. **Selalu aktifkan template setelah upload**
   - Jangan lupa klik tombol "Activate" di admin panel

2. **Backup template files**
   - Simpan copy template di tempat aman
   - Dokumentasikan lokasi file di storage

3. **Monitoring**
   - Set up alert untuk missing files
   - Log semua aktivitas upload/delete template

## Kontak Support

Jika masalah masih berlanjut:
1. Jalankan `php artisan sk:check-templates` dan simpan outputnya
2. Screenshot error di browser console
3. Hubungi tim development dengan informasi di atas
