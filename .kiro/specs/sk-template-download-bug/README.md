# SK Template Download Bug Fix

## Ringkasan Masalah

Template surat permohonan SK menampilkan status "AKTIF" tetapi tombol download tidak berfungsi atau menunjukkan "BELUM TERSEDIA".

## Root Cause

**Frontend mengakses nested data yang salah** setelah response interceptor mengekstrak `data` field.

```typescript
// ❌ SALAH
const fileUrl = suratPermohonanTemplate?.data?.file_url

// ✅ BENAR
const fileUrl = suratPermohonanTemplate?.file_url
```

## Quick Fix

### 1. Update Frontend
File: `src/features/sk-management/SkSubmissionPage.tsx`

```typescript
// Line ~62
const fileUrl = suratPermohonanTemplate?.file_url  // Hapus .data

// Line ~215
disabled={!suratPermohonanTemplate?.file_url || isLoadingTemplate}  // Hapus .data
```

### 2. Test
```bash
# 1. Jalankan debug command
cd backend
php artisan sk-template:debug surat_permohonan

# 2. Pastikan output:
#    ✅ Is Active: YES
#    ✅ File Exists: YES
#    ✅ Generated URL: http://...

# 3. Test di browser
# - Buka halaman Pengajuan SK
# - Klik "Unduh Template"
# - File harus terdownload
```

## Troubleshooting Cepat

### Tombol Masih Disabled?

**Cek 1: Template aktif?**
```bash
php artisan tinker
\App\Models\SkTemplate::where('sk_type', 'surat_permohonan')->where('is_active', true)->first()
```

Jika `null`, aktifkan template:
```bash
$template = \App\Models\SkTemplate::where('sk_type', 'surat_permohonan')->first();
$template->update(['is_active' => true]);
```

**Cek 2: File ada?**
```bash
ls -la backend/storage/app/public/sk-templates/
```

Jika kosong, upload template baru via UI.

**Cek 3: Symlink ada?**
```bash
ls -la backend/public/storage
```

Jika tidak ada:
```bash
php artisan storage:link
```

### Error 404 Saat Download?

**Cek APP_URL:**
```bash
# backend/.env
APP_URL=http://localhost:8000  # Harus sesuai dengan backend URL
```

**Restart server:**
```bash
php artisan serve
```

### Masih Tidak Bisa?

**Lihat log:**
```bash
tail -f backend/storage/logs/laravel.log
```

**Cek browser console:**
- Buka DevTools → Console
- Lihat output: `Template data:` dan `File URL:`
- Jika `File URL: undefined`, backend tidak mengembalikan `file_url`

**Cek network:**
- Buka DevTools → Network
- Cari request: `/api/sk-templates/active?sk_type=surat_permohonan`
- Periksa response body

## Files Changed

1. ✅ `src/features/sk-management/SkSubmissionPage.tsx` - Fix data access
2. ✅ `backend/app/Services/SkTemplateService.php` - Add logging
3. ✅ `backend/app/Http/Controllers/Api/SkTemplateController.php` - Add logging
4. ✅ `backend/app/Console/Commands/DebugSkTemplate.php` - New debug tool

## Dokumentasi Lengkap

- **Diagnosis**: `.kiro/specs/sk-template-download-bug/diagnosis.md`
- **Solution**: `.kiro/specs/sk-template-download-bug/solution.md`

## Kontak

Jika masalah masih berlanjut setelah mengikuti panduan ini, hubungi tim development dengan informasi:
1. Output dari `php artisan sk-template:debug surat_permohonan`
2. Screenshot browser console
3. Screenshot network tab (request/response)
4. Laravel log (last 50 lines)
