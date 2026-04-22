# Setup MinIO di Coolify dengan IP Address - Panduan Konkret

## Info Anda
- **Coolify URL**: `http://76.13.193.161:8000`
- **Project**: SIMMACI (sudah ada)
- **Setup**: MinIO dengan subdomain terpisah

---

## Langkah 1: Akses Coolify Dashboard

1. Buka browser → `http://76.13.193.161:8000`
2. Login dengan akun Coolify Anda
3. Pilih project **SIMMACI**

---

## Langkah 2: Cari Section Environment Variables

Di Coolify dashboard SIMMACI project:
1. Cari menu **Settings** atau **Environment**
2. Atau cari tab **Variables** / **Env Variables**
3. Anda akan melihat form untuk tambah environment variables

---

## Langkah 3: Tambah Environment Variables untuk MinIO

**PENTING**: Karena pakai IP address (bukan domain), kita gunakan IP untuk MinIO juga.

### Tambahkan variables ini:

```
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=SecurePassword123!
MINIO_PUBLIC_URL=http://76.13.193.161:9000
```

**Penjelasan:**
- `MINIO_ROOT_USER` = username login MinIO console
- `MINIO_ROOT_PASSWORD` = password (ganti dengan yang kuat!)
- `MINIO_PUBLIC_URL` = URL MinIO yang bisa diakses dari aplikasi (gunakan IP + port 9000)

---

## Langkah 4: Tambah Environment Variables untuk Backend

```
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=SecurePassword123!
AWS_ENDPOINT=http://76.13.193.161:9000
AWS_BUCKET=simmaci-storage
AWS_USE_PATH_STYLE_ENDPOINT=true
FILESYSTEM_DISK=s3
```

---

## Langkah 5: Tambah Environment Variables untuk Frontend

```
VITE_STORAGE_URL=http://76.13.193.161:9000/simmaci-storage
```

---

## Langkah 6: Deploy/Redeploy

1. Di Coolify, cari tombol **Deploy** atau **Redeploy**
2. Klik untuk deploy dengan environment variables baru
3. Tunggu sampai semua service running (status hijau)
4. Cek logs untuk memastikan tidak ada error

---

## Langkah 7: Verifikasi MinIO

1. Buka browser → `http://76.13.193.161:9000`
2. Login dengan:
   - Username: `minioadmin`
   - Password: `SecurePassword123!`
3. Pastikan bucket `simmaci-storage` sudah ada
4. Pastikan bucket status **public** (bukan private)

---

## Langkah 8: Test Upload File

Di aplikasi SIMMACI:
1. Coba upload file (misal: SK document)
2. Cek apakah file berhasil tersimpan
3. Coba akses file via URL: `http://76.13.193.161:9000/simmaci-storage/[nama-file]`
4. File seharusnya bisa didownload

---

## Troubleshooting

### MinIO console tidak bisa diakses (`http://76.13.193.161:9000`)
- Cek apakah port 9000 sudah di-expose di Coolify
- Cek firewall server allow port 9000
- Cek logs MinIO di Coolify

### File tidak bisa diupload
- Pastikan `AWS_ENDPOINT` di backend benar: `http://76.13.193.161:9000`
- Pastikan credentials benar
- Cek logs backend di Coolify

### URL file tidak bisa diakses
- Pastikan `VITE_STORAGE_URL` di frontend benar
- Pastikan bucket public (bukan private)
- Cek CORS settings di MinIO

---

## Catatan Penting

- Ganti `SecurePassword123!` dengan password yang kuat
- Jangan share credentials di public repository
- Ketika sudah punya domain, update semua URL dari IP ke domain
- Port 9000 = MinIO API, port 9001 = MinIO Console (optional)

---

## Checklist

- [ ] Akses Coolify dashboard
- [ ] Tambah environment variables untuk MinIO
- [ ] Tambah environment variables untuk Backend
- [ ] Tambah environment variables untuk Frontend
- [ ] Deploy/Redeploy
- [ ] Akses MinIO console (`http://76.13.193.161:9000`)
- [ ] Test upload file di aplikasi
- [ ] Verifikasi file bisa diakses via URL
