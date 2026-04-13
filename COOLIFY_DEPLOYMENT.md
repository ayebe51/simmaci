# Panduan Deployment ke Coolify

## Strategi

Deploy sebagai **satu Docker Compose stack** menggunakan `docker-compose.coolify.yml`.
Semua service (frontend, backend, db, redis, minio) berjalan dalam satu network.

---

## Langkah-langkah di Coolify

### 1. Buat Project Baru

- Buka Coolify dashboard → **New Resource** → **Docker Compose**
- Pilih server VPS kamu
- Source: **Git Repository** (atau paste langsung isi file)

### 2. Konfigurasi Docker Compose

- Set **Docker Compose File** ke: `docker-compose.coolify.yml`
- Coolify akan otomatis detect semua services

### 3. Set Environment Variables

Di Coolify dashboard, tambahkan env vars berikut (tab **Environment Variables**):

```env
# Database
DB_DATABASE=sim_maarif
DB_USERNAME=sim_user
DB_PASSWORD=password_super_aman_ganti_ini

# Laravel
APP_KEY=base64:GENERATE_DENGAN_php_artisan_key:generate
APP_URL=https://api.yourdomain.com

# MinIO
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=password_minio_ganti_ini

# CORS & Sanctum (sesuaikan domain frontend kamu)
FRONTEND_DOMAIN=yourdomain.com
FRONTEND_URL=https://yourdomain.com

# Optional
VITE_SENTRY_DSN=
```

> **Cara generate APP_KEY:**
> Jalankan di lokal: `php artisan key:generate --show`
> Atau: `echo "base64:$(openssl rand -base64 32)"`

### 4. Set Domain di Coolify

Untuk service **frontend**:
- Tambahkan domain: `yourdomain.com` → port `80`

Untuk service **backend** (opsional, jika butuh akses langsung):
- Tambahkan domain: `api.yourdomain.com` → port `80`

> **Catatan:** Jika frontend dan backend di domain yang sama (misal `/api` di-proxy oleh nginx frontend), kamu **tidak perlu** expose backend ke domain publik. Cukup frontend saja.

### 5. Deploy

Klik **Deploy** dan tunggu build selesai.

---

## Troubleshooting

### Build "degraded" / gagal

**Cek build log** di Coolify. Kemungkinan penyebab:

1. **`npm ci` gagal** — pastikan `package-lock.json` ada di repo dan tidak di `.gitignore`
2. **File tidak ditemukan saat COPY** — pastikan `nginx/default.conf` dan `nginx/entrypoint.sh` ada di repo
3. **composer install gagal** — pastikan `vendor/` ada di `backend/.gitignore` (tidak di-commit)

### Frontend 404

Penyebab paling umum:
- Coolify expose port yang salah. Pastikan domain diarahkan ke **port 80** container frontend
- Nginx config salah. Cek dengan: `docker exec simmaci-frontend cat /etc/nginx/conf.d/default.conf`

### API tidak bisa diakses (CORS / 502)

- Cek `BACKEND_URL` env var di container frontend sudah `http://backend`
- Cek backend container running: `docker ps | grep backend`
- Cek log backend: `docker logs simmaci-backend --tail 50`

### Database connection error

- Pastikan `DB_HOST=db` (nama service di docker-compose, bukan `localhost`)
- Pastikan `DB_PASSWORD` sama antara service `db` dan `backend`

---

## Verifikasi Deployment

Setelah deploy berhasil, cek:

```bash
# Semua container running
docker ps

# Log backend (cek migrasi berhasil)
docker logs simmaci-backend --tail 100

# Test API
curl https://yourdomain.com/api/health
# atau
curl https://yourdomain.com/api/v1/auth/login -X POST -H "Content-Type: application/json"
```

---

## Update / Redeploy

Setiap push ke branch yang dikonfigurasi di Coolify akan trigger auto-deploy.
Atau klik **Redeploy** manual di dashboard.
