# Solusi: Template Surat Permohonan SK Tidak Bisa Didownload

## Perubahan yang Dilakukan

### 1. Frontend Fix (SkSubmissionPage.tsx)

**Masalah**: Frontend mengakses `suratPermohonanTemplate?.data?.file_url` padahal response interceptor sudah mengekstrak nested `data`.

**Solusi**: Ubah akses menjadi `suratPermohonanTemplate?.file_url`

```typescript
// BEFORE
const fileUrl = suratPermohonanTemplate?.data?.file_url
disabled={!suratPermohonanTemplate?.data || isLoadingTemplate}

// AFTER
const fileUrl = suratPermohonanTemplate?.file_url
disabled={!suratPermohonanTemplate?.file_url || isLoadingTemplate}
```

**Penjelasan**: 
- API response: `{ success: true, data: { id: 1, file_url: "..." } }`
- Setelah interceptor: `{ id: 1, file_url: "..." }`
- Akses langsung: `suratPermohonanTemplate.file_url` ✅

### 2. Backend Logging (SkTemplateService.php & SkTemplateController.php)

**Masalah**: Tidak ada logging untuk debugging ketika file tidak ditemukan.

**Solusi**: Tambahkan logging di:
- `getDownloadUrl()` - Log ketika file tidak ada dan ketika URL berhasil di-generate
- `active()` - Log ketika template tidak ditemukan atau file missing

```php
\Log::error('SK Template file not found in storage', [
    'template_id' => $template->id,
    'file_path' => $template->file_path,
    'disk' => $template->disk,
]);
```

### 3. Debug Command (DebugSkTemplate.php)

**Masalah**: Sulit untuk mendiagnosis masalah tanpa tool.

**Solusi**: Buat Artisan command untuk debugging:

```bash
php artisan sk-template:debug surat_permohonan
```

Command ini akan menampilkan:
- ✅ Database records (semua template untuk sk_type)
- ✅ File existence check
- ✅ Active template status
- ✅ Storage configuration
- ✅ Symlink status
- ✅ Generated URL

## Cara Troubleshooting

### Step 1: Jalankan Debug Command

```bash
cd backend
php artisan sk-template:debug surat_permohonan
```

Output akan menunjukkan:
- Apakah ada template di database
- Apakah template aktif
- Apakah file fisik ada di storage
- URL yang di-generate

### Step 2: Cek Browser DevTools

1. Buka halaman Pengajuan SK
2. Buka DevTools → Network tab
3. Cari request ke `/api/sk-templates/active?sk_type=surat_permohonan`
4. Periksa response:

**Response yang benar:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "sk_type": "surat_permohonan",
    "original_filename": "PERMOHONAN SK 2026-2027.docx",
    "is_active": true,
    "file_url": "http://localhost:8000/storage/sk-templates/xxx.docx"
  }
}
```

**Response error (template tidak ada):**
```json
{
  "success": false,
  "message": "Tidak ada template aktif untuk jenis SK ini."
}
```

**Response error (file tidak ada):**
```json
{
  "success": false,
  "message": "File template tidak ditemukan di storage."
}
```

### Step 3: Cek Console Log

Setelah fix, frontend akan log:
```
Template data: { id: 1, sk_type: "surat_permohonan", file_url: "..." }
File URL: http://localhost:8000/storage/sk-templates/xxx.docx
```

Jika `File URL: undefined`, berarti backend tidak mengembalikan `file_url`.

### Step 4: Cek Laravel Log

```bash
tail -f backend/storage/logs/laravel.log
```

Cari log entries:
- `SK Template file not found in storage` - File tidak ada
- `Successfully resolved active SK template` - Berhasil
- `No active SK template found` - Tidak ada template aktif

## Skenario Masalah & Solusi

### Skenario 1: Template Tidak Ada di Database

**Gejala**: 
- Debug command: "No templates found"
- API response: 404 "Tidak ada template aktif"

**Solusi**:
1. Upload template baru melalui halaman Template Management
2. Atau insert manual ke database (tidak disarankan)

### Skenario 2: Template Ada Tapi Tidak Aktif

**Gejala**:
- Debug command: "Is Active: ❌ NO"
- API response: 404 "Tidak ada template aktif"

**Solusi**:
1. Buka halaman Template Management
2. Klik tombol "Aktifkan" pada template yang diinginkan
3. Atau via Artisan:
   ```bash
   php artisan tinker
   $template = \App\Models\SkTemplate::where('sk_type', 'surat_permohonan')->first();
   $template->update(['is_active' => true]);
   ```

### Skenario 3: Template Aktif Tapi File Tidak Ada

**Gejala**:
- Debug command: "Is Active: ✅ YES", "File Exists: ❌ NO"
- API response: 404 "File template tidak ditemukan di storage"
- Laravel log: "SK Template file not found in storage"

**Solusi**:
1. **Jika file hilang**: Upload ulang template
2. **Jika file ada tapi path salah**: 
   ```bash
   # Cek lokasi file
   ls -la backend/storage/app/public/sk-templates/
   
   # Update path di database jika perlu
   php artisan tinker
   $template = \App\Models\SkTemplate::find(1);
   $template->file_path = 'sk-templates/correct-filename.docx';
   $template->save();
   ```

### Skenario 4: File Ada Tapi Symlink Belum Dibuat

**Gejala**:
- Debug command: "File Exists: ✅ YES", "Symlink Exists: ❌ NO"
- Browser: 404 ketika akses URL
- URL: `http://localhost:8000/storage/sk-templates/xxx.docx` → 404

**Solusi**:
```bash
cd backend
php artisan storage:link
```

Verifikasi:
```bash
ls -la backend/public/storage
# Should show: storage -> ../storage/app/public
```

### Skenario 5: APP_URL Tidak Sesuai

**Gejala**:
- Debug command: "File Exists: ✅ YES"
- Generated URL: `http://localhost:8000/storage/...`
- Tapi aplikasi berjalan di `http://localhost:5173` (Vite dev server)

**Solusi**:
1. Pastikan `APP_URL` di `.env` sesuai dengan backend URL:
   ```env
   APP_URL=http://localhost:8000
   ```
2. Restart Laravel server:
   ```bash
   php artisan serve
   ```

### Skenario 6: CORS Issue

**Gejala**:
- File URL benar
- Browser console: "CORS policy blocked"

**Solusi**:
1. Cek `config/cors.php`
2. Pastikan frontend origin allowed:
   ```php
   'allowed_origins' => ['http://localhost:5173'],
   ```

## Verifikasi Setelah Fix

### 1. Test Manual
1. Buka halaman Pengajuan SK
2. Lihat banner "Template Surat Permohonan SK"
3. Tombol "Unduh Template" harus enabled (tidak disabled)
4. Klik tombol → File harus terdownload
5. Toast notification: "Template berhasil diunduh"

### 2. Test via cURL
```bash
# Get active template
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:8000/api/sk-templates/active?sk_type=surat_permohonan"

# Should return:
# {
#   "success": true,
#   "data": {
#     "id": 1,
#     "file_url": "http://..."
#   }
# }
```

### 3. Test Download URL
```bash
# Copy file_url from above response
curl -I "http://localhost:8000/storage/sk-templates/xxx.docx"

# Should return:
# HTTP/1.1 200 OK
# Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document
```

## Maintenance

### Upload Template Baru
1. Login sebagai super_admin
2. Buka "Manajemen Template SK"
3. Scroll ke section "Template Surat Permohonan SK"
4. Upload file .docx
5. Template otomatis diaktifkan setelah upload

### Replace Template
1. Upload template baru (akan otomatis non-aktif)
2. Klik "Aktifkan" pada template baru
3. Template lama otomatis di-deactivate

### Backup Template
```bash
# Backup database records
php artisan db:dump --table=sk_templates

# Backup files
tar -czf sk-templates-backup.tar.gz backend/storage/app/public/sk-templates/
```

## Monitoring

### Check Template Status
```bash
# Via command
php artisan sk-template:debug surat_permohonan

# Via database
php artisan tinker
\App\Models\SkTemplate::where('sk_type', 'surat_permohonan')->get(['id', 'original_filename', 'is_active']);
```

### Check Logs
```bash
# Real-time monitoring
tail -f backend/storage/logs/laravel.log | grep "SK template"

# Search for errors
grep "SK Template file not found" backend/storage/logs/laravel.log
```
