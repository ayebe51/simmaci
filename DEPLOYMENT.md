# Panduan Deployment SIM Maarif ke VPS Berbayar (Ubuntu 22.04 LTS)

Panduan ini akan membantu Anda menginstall aplikasi SIM Maarif (Frontend & Backend) ke server VPS (Virtual Private Server) agar bisa diakses secara online menggunakan domain sendiri (contoh: `sim.maarif.nu`).

## 📋 Prasyarat

1. **VPS** dengan OS **Ubuntu 20.04** atau **22.04 LTS** (Min. RAM 2GB disarankan).
2. **Domain** yang sudah diarahkan ke IP VPS Anda (A Record).
3. Akses root/ssh ke server.

---

## 1. Persiapan Server

Login ke server Anda melalui SSH:

```bash
ssh root@ip-vps-anda
```

Update paket sistem:

```bash
sudo apt update && sudo apt upgrade -y
```

Install alat dasar:

```bash
sudo apt install -y curl git unzip build-essential
```

---

## 2. Instalasi PHP, Composer & NodeJS

Kita membutuhkan **PHP 8.2+** untuk Laravel dan **Node.js** untuk build frontend.

```bash
# Install PHP 8.2 dan ekstensi yang dibutuhkan
sudo apt install -y php8.2-fpm php8.2-cli php8.2-pgsql php8.2-mbstring php8.2-xml php8.2-curl php8.2-zip php8.2-bcmath php8.2-gd

# Install Composer (PHP package manager)
curl -sS https://getcomposer.org/installer | php
sudo mv composer.phar /usr/local/bin/composer

# Verifikasi
php -v
# Output: PHP 8.2.x
composer -V

# Install Node.js v20 (untuk build frontend)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

node -v
npm -v
```

---

## 3. Instalasi Database (PostgreSQL)

Aplikasi SIM Maarif direkomendasikan menggunakan PostgreSQL untuk production.

```bash
# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Masuk ke prompt Postgres
sudo -i -u postgres

# Buat Database & User
psql
```

Di dalam prompt SQL (`postgres=#`), jalankan perintah berikut (ubah `password123` dengan password aman):

```sql
CREATE DATABASE sim_maarif;
CREATE USER sim_user WITH ENCRYPTED PASSWORD 'password_super_rahasia';
GRANT ALL PRIVILEGES ON DATABASE sim_maarif TO sim_user;
\q
```

Keluar dari user postgres:

```bash
exit
```

---

## 4. Setup Backend (Laravel)

### A. Clone Repository

Kita akan simpan aplikasi di folder `/var/www/simmaci`.

```bash
mkdir -p /var/www/simmaci
cd /var/www/simmaci

# Clone repo (Ganti URL dengan repo GitHub Anda jika ada, atau upload manual via SFTP)
# Jika upload manual, pastikan folder 'backend' dan folder root frontend terupload.
```

*Asumsi: Folder proyek Anda sudah ada di `/var/www/simmaci` (berisi folder `backend` dan file-file frontend)*.

### B. Install & Build Backend

```bash
cd /var/www/simmaci/backend

# Install dependencies
composer install --optimize-autoloader --no-dev
```

### C. Konfigurasi Environment (.env)

Buat file `.env` untuk production:

```bash
cp .env.example .env
nano .env
```

Isi dengan konfigurasi berikut (sesuaikan password DB):

```env
APP_NAME="SIM Maarif"
APP_ENV=production
APP_DEBUG=false
APP_URL=https://sim.maarif.nu

DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=sim_maarif
DB_USERNAME=sim_user
DB_PASSWORD=password_super_rahasia
```

Simpan dengan `Ctrl+X`, `Y`, `Enter`.

### D. Finalisasi Laravel

```bash
# Generate application key
php artisan key:generate

# Jalankan migrasi database
php artisan migrate --force

# Cache konfigurasi untuk performa
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Set permission storage & cache
sudo chown -R www-data:www-data /var/www/simmaci/backend/storage
sudo chown -R www-data:www-data /var/www/simmaci/backend/bootstrap/cache
sudo chmod -R 775 /var/www/simmaci/backend/storage
sudo chmod -R 775 /var/www/simmaci/backend/bootstrap/cache
```

Backend sekarang berjalan via **PHP-FPM** (dikelola oleh Nginx).

---

## 5. Setup Frontend (Vite React)

### A. Konfigurasi API URL

Masuk ke folder frontend:

```bash
cd /var/www/simmaci
# (Folder root frontend, sejajar dengan package.json frontend)
```

Edit/Buat file `.env.production`:

```bash
nano .env.production
```

Isi dengan URL domain backend (nanti kita setup di Nginx):

```env
VITE_API_URL=https://sim.maarif.nu/api
# Jika satu domain, bisa gunakan relative path atau full path
```

*Catatan: Jika backend dan frontend di domain yang sama (misal `/api` untuk backend), pastikan Nginx dikonfigurasi dengan benar.*

### B. Build Frontend

```bash
npm install
npm run build
```

Hasil build akan ada di folder `dist`.

---

## 6. Instalasi & Konfigurasi Nginx (Reverse Proxy)

Nginx bertugas melayani Frontend (file statis) dan meneruskan request `/api` ke Backend.

```bash
# Install Nginx
sudo apt install -y nginx
```

Buat konfigurasi server block:

```bash
sudo nano /etc/nginx/sites-available/sim-maarif
```

Isi dengan konfigurasi berikut (Ganti `sim.maarif.nu` dengan domain Anda):

```nginx
server {
    listen 80;
    server_name sim.maarif.nu; # Ganti domain

    # ── Frontend (React SPA) ──
    root /var/www/simmaci/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # ── Backend API (Laravel via PHP-FPM) ──
    location /api {
        alias /var/www/simmaci/backend/public;
        try_files $uri $uri/ @laravel;

        location ~ \.php$ {
            fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
            fastcgi_param SCRIPT_FILENAME $request_filename;
            include fastcgi_params;
        }
    }

    location @laravel {
        rewrite ^/api/(.*)$ /api/index.php/$1 last;
    }

    # ── Deny dotfiles ──
    location ~ /\.(?!well-known) {
        deny all;
    }
}
```

Aktifkan konfigurasi:

```bash
sudo ln -s /etc/nginx/sites-available/sim-maarif /etc/nginx/sites-enabled/
sudo nginx -t # Cek error
sudo systemctl restart nginx
```

---

## 7. Setup SSL (HTTPS) Gratis dengan Certbot

Agar website aman (gembok hijau).

```bash
sudo apt install -y certbot python3-certbot-nginx

# Request SSL
sudo certbot --nginx -d sim.maarif.nu
```

Ikuti instruksi di layar. Certbot akan otomatis mengupdate konfigurasi Nginx Anda.

---

## 8. Selesai! 🎉

Buka domain Anda `https://sim.maarif.nu`.

- Frontend harusnya muncul.
- Coba Login.
- Cek data-data.

## 🛠️ Troubleshooting (Jika Error)

1. **Backend Error:**
   Cek log Laravel:

   ```bash
   tail -f /var/www/simmaci/backend/storage/logs/laravel.log
   ```

2. **Nginx 502 Bad Gateway:**
   Artinya PHP-FPM mati. Cek status:

   ```bash
   sudo systemctl status php8.2-fpm
   sudo systemctl restart php8.2-fpm
   ```

3. **Halaman White Page di Production:**
   Seringkali karena path asset salah. Pastikan build frontend sukses dan `index.html` bisa diakses.

4. **Permission Error (500):**
   Pastikan `storage/` dan `bootstrap/cache/` writable:

   ```bash
   sudo chmod -R 775 /var/www/simmaci/backend/storage
   sudo chmod -R 775 /var/www/simmaci/backend/bootstrap/cache
   ```
