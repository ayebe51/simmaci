# Diagnosis: Template Surat Permohonan SK Tidak Bisa Didownload

## Masalah
Template surat permohonan SK menampilkan status "AKTIF" di UI, tetapi tombol download tidak berfungsi atau menunjukkan "BELUM TERSEDIA".

## Analisis Kode

### Frontend (SkSubmissionPage.tsx)
```typescript
const { data: suratPermohonanTemplate, isLoading: isLoadingTemplate, error: templateError } = useQuery({
  queryKey: ['sk-template-surat-permohonan'],
  queryFn: () => skTemplateApi.getActiveSuratPermohonan(),
  retry: false,
})

const handleDownloadTemplate = () => {
  const fileUrl = suratPermohonanTemplate?.data?.file_url
  if (!fileUrl) {
    toast.error("Template surat permohonan belum tersedia...")
    return
  }
  window.open(fileUrl, '_blank', 'noopener,noreferrer')
  toast.success("Template berhasil diunduh")
}
```

**Masalah**: Frontend mengharapkan `suratPermohonanTemplate?.data?.file_url`, tetapi response dari backend mungkin tidak memiliki struktur ini.

### Backend (SkTemplateController.php)
```php
public function active(Request $request): JsonResponse
{
    $template = $this->service->resolveActiveTemplate($skType);
    
    if (!$template) {
        return $this->errorResponse('Tidak ada template aktif...', null, 404);
    }
    
    $data = $template->only([...]);
    
    try {
        $data['file_url'] = $this->service->getDownloadUrl($template);
    } catch (HttpException $e) {
        return $this->errorResponse('File template tidak ditemukan di storage.', null, 404);
    }
    
    return $this->successResponse($data);
}
```

### API Response Interceptor (api.ts)
```typescript
apiClient.interceptors.response.use(
  (response) => {
    if (response.data && response.data.success === true && response.data.data !== undefined) {
      return {
        ...response,
        data: response.data.data  // ← Ekstrak nested 'data'
      };
    }
    return response;
  }
)
```

## Kemungkinan Penyebab

### 1. **Double Nesting Response Structure**
Backend mengembalikan:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "sk_type": "surat_permohonan",
    "file_url": "http://..."
  }
}
```

Interceptor mengekstrak menjadi:
```typescript
response.data = { id: 1, sk_type: "surat_permohonan", file_url: "http://..." }
```

Tetapi frontend mengakses `suratPermohonanTemplate?.data?.file_url`, yang seharusnya `suratPermohonanTemplate?.file_url`.

### 2. **File Tidak Ada di Storage**
- Template record ada di database dengan `is_active = true`
- Tetapi file fisik tidak ada di `storage/app/public/sk-templates/`
- Backend throw 404 di `getDownloadUrl()`

### 3. **Storage Link Belum Dibuat**
- File ada di `storage/app/public/sk-templates/`
- Tetapi symlink `public/storage` belum dibuat dengan `php artisan storage:link`
- URL yang di-generate tidak bisa diakses

### 4. **Disk Configuration Salah**
- Template di-upload ke disk 's3' tetapi konfigurasi S3/MinIO tidak valid
- Atau template di-upload ke 'public' tetapi `APP_URL` tidak sesuai

## Langkah Debugging

1. **Cek Response API di Browser DevTools**
   - Buka Network tab
   - Lihat response dari `/api/sk-templates/active?sk_type=surat_permohonan`
   - Periksa apakah `file_url` ada dalam response

2. **Cek Database**
   ```sql
   SELECT id, sk_type, original_filename, file_path, disk, is_active 
   FROM sk_templates 
   WHERE sk_type = 'surat_permohonan' AND deleted_at IS NULL;
   ```

3. **Cek File di Storage**
   ```bash
   ls -la backend/storage/app/public/sk-templates/
   ```

4. **Cek Symlink**
   ```bash
   ls -la backend/public/storage
   ```

5. **Test Backend Endpoint Langsung**
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
     "http://localhost:8000/api/sk-templates/active?sk_type=surat_permohonan"
   ```

## Solusi yang Akan Diterapkan

1. **Fix Frontend Access Pattern** - Sesuaikan akses data dengan struktur response setelah interceptor
2. **Add Error Logging** - Tambahkan console.log untuk debugging
3. **Validate Storage** - Pastikan file ada dan accessible
4. **Add Fallback** - Jika file tidak ada, berikan opsi upload ulang
