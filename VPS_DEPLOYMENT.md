# Panduan Deploy SIMMACI ke VPS dengan Docker

Deploy seluruh stack (frontend, backend, database, redis, minio) ke VPS Ubuntu menggunakan Docker Compose.

**Prasyarat:**
- VPS Ubuntu 22.04 LTS (min. 2GB RAM, 20GB disk)
- Domain yang sudah diarahkan A Record ke IP VPS
- Akses SSH ke server

---

## 1. Persiapan Server

```bash
ssh root@IP_VPS_KAMU
```

Update sistem dan install tools dasar:

```bash
apt update && apt upgrade -y
apt install -y curl git ufw
```

Setup firewall:

```bash
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw --force enable
```

---

## 2. Install Docker

```bash
curl -fsSL https://get.docker.com | sh
```

Verifikasi:

```bash
docker --version
docker compose version
```

---

## 3. Clone Repository

```bash
mkdir -p /var/www
cd /var/www
git clone https://github.com/USERNAME/REPO_NAME.git simmaci
cd simmaci
```

> Jika repo private, gunakan SSH key atau personal access token:
> `git clone https://TOKEN@github.com/USERNAME/REPO_NAME.git simmaci`

---

## 4. Buat File `.env`

Buat file `.env` di root project:

```bash
cp /dev/null .env
nano .env
```

Isi dengan konfigurasi berikut (sesuaikan semua nilai yang ada komentar `# GANTI`):

```env
# ── Database ──────────────────────────────────────────────
DB_DATABASE=sim_maarif
DB_USERNAME=sim_user
DB_PASSWORD=password_db_super_aman_ganti_ini   # GANTI

# ── Laravel ───────────────────────────────────────────────
# Generate dengan: php artisan key:generate --show
# Atau: echo "base64:$(openssl rand -base64 32)"
APP_KEY=base64:GENERATE_DAN_GANTI_INI          # GANTI
APP_URL=https://sim.yourdomain.com             # GANTI domain kamu

# ── MinIO (S3 Storage) ────────────────────────────────────
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=password_minio_ganti_ini   # GANTI

# ── CORS & Sanctum ────────────────────────────────────────
FRONTEND_DOMAIN=sim.yourdomain.com             # GANTI domain kamu
FRONTEND_URL=https://sim.yourdomain.com        # GANTI domain kamu

# ── Port frontend container (gunakan 8080 agar tidak konflik dengan Nginx host) ──
FRONTEND_PORT=8080

# ── Optional ──────────────────────────────────────────────
VITE_SENTRY_DSN=
```

Simpan dengan `Ctrl+X`, `Y`, `Enter`.

### Generate APP_KEY

Jika belum punya APP_KEY, generate sekarang:

```bash
echo "base64:$(openssl rand -base64 32)"
```

Copy hasilnya dan paste ke `.env` di bagian `APP_KEY=`.

---

## 5. Build dan Jalankan

```bash
docker compose -f docker-compose.coolify.yml up -d --build
```

Proses ini akan:
- Build image frontend (React + Nginx) — ~3-5 menit
- Build image backend (Laravel + PHP-FPM) — ~5-10 menit
- Pull image postgres, redis, minio
- Jalankan semua container
- Otomatis buat bucket MinIO
- Otomatis jalankan migrasi database

Pantau progress:

```bash
docker compose -f docker-compose.coolify.yml logs -f
```

Tekan `Ctrl+C` untuk stop memantau log (container tetap berjalan).

---

## 6. Verifikasi Container Berjalan

```bash
docker ps
```

Semua container harus berstatus `Up`:

```
simmaci-frontend   Up   0.0.0.0:8080->80/tcp
simmaci-backend    Up
simmaci-db         Up (healthy)
simmaci-redis      Up (healthy)
simmaci-minio      Up (healthy)
```

Test akses:

```bash
# Cek frontend (via port 8080 langsung ke container)
curl -I http://localhost:8080
# Harus return: HTTP/1.1 200 OK

# Cek backend API
curl http://localhost/api/v1/auth/login -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"wrong"}'
# Harus return JSON (bukan 404/502)
```

---

## 7. Setup SSL dengan Nginx + Certbot (HTTPS)

Kita akan install Nginx di host sebagai reverse proxy dengan SSL, lalu forward ke container frontend di port 80.

### Install Nginx dan Certbot

```bash
apt install -y nginx certbot python3-certbot-nginx
```

### Buat konfigurasi Nginx

```bash
nano /etc/nginx/sites-available/simmaci
```

Isi:

```nginx
server {
    listen 80;
    server_name sim.yourdomain.com;  # GANTI domain kamu

    location / {
        proxy_pass http://127.0.0.1:8080;  # port 8080 = FRONTEND_PORT di .env
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
```

> **Kenapa port 8080?** Container frontend listen di port 8080 di host (via `FRONTEND_PORT=8080` di `.env`), sementara Nginx host pakai port 80/443 untuk SSL termination. Ini menghindari konflik port.

Aktifkan dan test:

```bash
ln -s /etc/nginx/sites-available/simmaci /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### Request SSL Certificate

```bash
certbot --nginx -d sim.yourdomain.com
```

Ikuti instruksi, pilih opsi redirect HTTP → HTTPS.

Certbot akan otomatis update konfigurasi Nginx dan setup auto-renewal.

---

## 8. Selesai

Buka `https://sim.yourdomain.com` di browser.

---

## Perintah Berguna

```bash
# Lihat semua container
docker ps

# Lihat log backend (Laravel)
docker logs simmaci-backend --tail 100 -f

# Lihat log frontend (Nginx)
docker logs simmaci-frontend --tail 50

# Masuk ke container backend (untuk artisan commands)
docker exec -it simmaci-backend bash

# Jalankan artisan command
docker exec simmaci-backend php artisan migrate:status
docker exec simmaci-backend php artisan cache:clear

# Restart semua service
docker compose -f docker-compose.coolify.yml restart

# Stop semua service
docker compose -f docker-compose.coolify.yml down

# Update ke versi terbaru (setelah git pull)
git pull
docker compose -f docker-compose.coolify.yml up -d --build
```

---

## Update Aplikasi

Setiap kali ada perubahan kode:

```bash
cd /var/www/simmaci
git pull
docker compose -f docker-compose.coolify.yml up -d --build
```

Docker hanya rebuild image yang berubah, jadi proses update lebih cepat dari deploy pertama.

---

## Troubleshooting

### Container langsung exit / restart loop

```bash
docker logs simmaci-backend --tail 50
```

Penyebab umum:
- `APP_KEY` kosong atau salah format → generate ulang
- `DB_PASSWORD` tidak cocok antara service `db` dan `backend`
- Port sudah dipakai proses lain di host

### Frontend 404

```bash
# Cek nginx config di dalam container
docker exec simmaci-frontend cat /etc/nginx/conf.d/default.conf

# Cek BACKEND_URL sudah ter-replace
docker exec simmaci-frontend grep proxy_pass /etc/nginx/conf.d/default.conf
# Harus menampilkan: proxy_pass http://backend;
```

### API 502 Bad Gateway

Backend belum ready atau crash:

```bash
docker logs simmaci-backend --tail 100
docker exec -it simmaci-backend php artisan migrate:status
```

### Database connection refused

```bash
# Cek postgres healthy
docker inspect simmaci-db | grep -A5 Health

# Test koneksi dari backend
docker exec simmaci-backend php artisan tinker --execute="DB::connection()->getPdo(); echo 'OK';"
```

### MinIO / storage tidak bisa upload

```bash
# Cek bucket sudah dibuat
docker exec simmaci-minio mc ls local/

# Atau akses MinIO console di browser
# http://IP_VPS:9001 (perlu buka port 9001 dulu di firewall)
ufw allow 9001
```
