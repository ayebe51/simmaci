# MinIO Proxy Route Fix - Langkah Selanjutnya

## Status: Code Changes Pushed ✅

Semua code changes sudah di-push ke GitHub:
- ✅ Fixed MinIO proxy route di `backend/routes/api.php`
- ✅ Updated MinioProxyController untuk handle path parameter dengan benar
- ✅ Commit: `Fix MinIO proxy route - handle path parameter correctly`

---

## Masalah yang Diperbaiki

**Sebelumnya:**
```php
Route::get('minio/{path?}', [MinioProxyController::class, 'proxy'])->where('path', '.*');
```
- Route parameter tidak di-handle dengan benar di controller
- Path extraction menggunakan string manipulation yang error-prone

**Sekarang:**
```php
Route::get('minio', [MinioProxyController::class, 'proxy']);
Route::get('minio/{path}', [MinioProxyController::class, 'proxy'])->where('path', '.*');
```
- Dua route terpisah untuk clarity
- Controller menerima `$path` sebagai parameter langsung
- Error handling lebih baik

---

## Langkah Berikutnya: Redeploy di Coolify

### 1. Login ke Coolify Dashboard
- URL: `http://76.13.193.161:8000`
- Atau: `https://coolify.simmaci.com`

### 2. Buka SIMMACI Project
- Klik project **SIMMACI**

### 3. Redeploy Backend
- Cari service **backend**
- Klik tombol **Redeploy**
- Tunggu 5-10 menit untuk rebuild

### 4. Verifikasi Deployment
- Cek logs backend untuk error
- Pastikan status service menjadi **running** (hijau)

---

## Test MinIO Proxy Setelah Redeploy

### Test 1: Health Check
```bash
curl https://simmaci.com/api/minio
```

**Expected response:**
```json
{"status":"ok","message":"MinIO proxy is working"}
```

### Test 2: File Access
```bash
curl https://simmaci.com/api/minio/simmaci-storage/[filename]
```

**Expected:**
- Jika file ada: File content dengan Content-Type yang benar
- Jika file tidak ada: `{"error":"File not found","path":"..."}`

### Test 3: SK Generation
1. Buka aplikasi: `https://simmaci.com`
2. Coba generate SK document
3. Seharusnya berhasil tanpa error "Failed to fetch"

---

## Troubleshooting

### Masih 404?
1. Pastikan backend sudah di-redeploy (bukan hanya code push)
2. Cek backend logs di Coolify untuk error
3. Verifikasi MinIO service running: `docker logs simmaci-minio`
4. Cek nginx config: `docker logs simmaci-frontend`

### Error "File not found"?
1. Pastikan file sudah di-upload ke MinIO
2. Cek bucket `simmaci-storage` di MinIO console
3. Verifikasi path file benar

### Error 500?
1. Cek backend logs untuk exception detail
2. Verifikasi AWS credentials di environment variables
3. Pastikan MinIO accessible dari backend: `docker exec simmaci-backend curl http://minio:9000`

---

## Checklist

- [ ] Code changes pushed ke GitHub ✅
- [ ] Redeploy backend di Coolify
- [ ] Tunggu 5-10 menit untuk rebuild
- [ ] Test health check: `curl https://simmaci.com/api/minio`
- [ ] Lihat response: `{"status":"ok","message":"MinIO proxy is working"}`
- [ ] Test SK generation di aplikasi
- [ ] Verifikasi tidak ada error di logs

---

## Summary

✅ **Code**: Fixed dan pushed
⏳ **Deployment**: Perlu redeploy backend di Coolify
⏳ **Testing**: Setelah redeploy, test endpoints

**Next Action**: Redeploy backend di Coolify dashboard.
