# Setup MinIO di Coolify - Panduan Lengkap

## Prasyarat
- Sudah punya Coolify project untuk SIMMACI
- Sudah punya domain (misal: `yourdomain.com`) atau IP address Coolify

## Langkah 1: Akses Coolify Dashboard

1. Buka browser → `https://coolify.yourdomain.com` (atau IP Coolify Anda)
2. Login dengan akun Coolify Anda
3. Pilih project **SIMMACI**

## Langkah 2: Tambah Environment Variables

Di Coolify dashboard, cari section **Environment Variables** atau **Settings**:

### Untuk MinIO Service:
```
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=YourSecurePassword123!
MINIO_PUBLIC_URL=https://minio.yourdomain.com
```

**Penjelasan:**
- `MINIO_ROOT_USER` = username untuk login MinIO console
- `MINIO_ROOT_PASSWORD` = password (gunakan yang kuat!)
- `MINIO_PUBLIC_URL` = URL yang bisa diakses dari internet (untuk aplikasi Anda)

### Untuk Backend Service:
```
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=YourSecurePassword123!
AWS_ENDPOINT=https://minio.yourdomain.com
AWS_BUCKET=simmaci-storage
AWS_USE_PATH_STYLE_ENDPOINT=true
FILESYSTEM_DISK=s3
```

### Untuk Frontend Service:
```
VITE_STORAGE_URL=https://minio.yourdomain.com/simmaci-storage
```

## Langkah 3: Deploy/Redeploy

1. Di Coolify, klik tombol **Deploy** atau **Redeploy**
2. Tunggu sampai semua service running (hijau)
3. Cek logs untuk memastikan tidak ada error

## Langkah 4: Verifikasi MinIO

1. Buka `https://minio.yourdomain.com` di browser
2. Login dengan:
   - Username: `minioadmin`
   - Password: `YourSecurePassword123!`
3. Pastikan bucket `simmaci-storage` sudah ada dan public

## Langkah 5: Test Upload File

Di aplikasi SIMMACI, coba upload file (misal: SK document):
- File seharusnya tersimpan di MinIO
- URL file seharusnya bisa diakses: `https://minio.yourdomain.com/simmaci-storage/[filename]`

---

## Troubleshooting

### MinIO tidak bisa diakses
- Pastikan domain sudah pointing ke IP Coolify
- Cek firewall/security group allow port 443 (HTTPS)
- Cek logs MinIO di Coolify

### File tidak bisa diupload
- Pastikan `AWS_ENDPOINT` di backend benar
- Cek credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
- Cek bucket permissions (harus public)

### URL file tidak bisa diakses
- Pastikan `VITE_STORAGE_URL` di frontend benar
- Cek bucket policy di MinIO console

---

## Catatan Penting

- Ganti `yourdomain.com` dengan domain Anda yang sebenarnya
- Ganti `YourSecurePassword123!` dengan password yang kuat
- Jangan share credentials di public repository
- Untuk production, gunakan SSL certificate yang valid
