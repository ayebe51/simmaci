# Panduan Deployment SIM Maarif ke VPS Berbayar (Ubuntu 22.04 LTS)

Panduan ini akan membantu Anda menginstall aplikasi SIM Maarif (Frontend & Backend) ke server VPS (Virtual Private Server) agar bisa diakses secara online menggunakan domain sendiri (contoh: `sim.maarif.nu`).

## 📋 Prasyarat
1.  **VPS** dengan OS **Ubuntu 20.04** atau **22.04 LTS** (Min. RAM 2GB disarankan).
2.  **Domain** yang sudah diarahkan ke IP VPS Anda (A Record).
3.  Akses root/ssh ke server.

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

## 2. Instalasi NodeJS & PM2
Kita akan menggunakan **Node.js LTS (v20)**.

```bash
# Install Node.js v20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verifikasi
node -v 
# Output: v20.x.x
npm -v

# Install PM2 (Process Manager agar aplikasi terus berjalan)
sudo npm install -g pm2
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

## 4. Setup Backend (NestJS)

### A. Clone Repository
Kita akan simpan aplikasi di folder `/var/www/simmaci`.

```bash
mkdir -p /var/www/simmaci
cd /var/www/simmaci

# Clone repo (Ganti URL dengan repo GitHub Anda jika ada, atau upload manual via SFTP)
# Jika upload manual, pastikan folder 'backend' dan 'frontend' terupload.
```
*Asumsi: Folder proyek Anda sudah ada di `/var/www/simmaci` (berisi folder `backend` dan `frontend`)*.

### B. Install & Build Backend
```bash
cd /var/www/simmaci/backend

# Install dependencies
npm install

# Build aplikasi
npm run build
```

### C. Konfigurasi Environment (.env)
Buat file `.env` untuk production:
```bash
nano .env
```
Isi dengan konfigurasi berikut (sesuaikan password DB):
```env
PORT=3000
DATABASE_TYPE=postgres
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=sim_user
DATABASE_PASSWORD=password_super_rahasia
DATABASE_NAME=sim_maarif
JWT_SECRET=REDACTED_EXAMPLE_JWT_SECRET_001
# Hapus fallback secret di kode jika ada!
```
Simpan dengan `Ctrl+X`, `Y`, `Enter`.

### D. Jalankan Backend dengan PM2
```bash
pm2 start dist/main.js --name "sim-backend"
pm2 save
pm2 startup
```
Backend sekarang berjalan di port 3000.

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

    root /var/www/simmaci/dist; # Folder hasil build frontend
    index index.html;

    # Frontend (React Router Support)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API Reverse Proxy
    location /api/ {
        # Hapus /api prefix saat meneruskan ke backend jika backend tidak pakai prefix global
        # Tapi di struktur NestJS biasanya kita set global prefix atau sesuaikan di sini.
        # Jika Backend Anda pakai prefix 'api', gunakan:
        proxy_pass http://localhost:3000/api/; # Perhatikan trailing slash jika perlu rewrite
        
        # Jika di backend main.ts Anda TIDAK set globalPrefix 'api', tapi di Nginx pakai /api:
        # rewrite ^/api/(.*)$ /$1 break;
        # proxy_pass http://localhost:3000;
        
        # Opsi standar proxy
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
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

1.  **Backend Error:**
    Cek log PM2:
    ```bash
    pm2 logs sim-backend
    ```
2.  **Nginx 502 Bad Gateway:**
    Artinya Backend mati. Cek `pm2 list` atau pastikan port backend benar (3000).
3.  **Halaman White Page di Production:**
    Seringkali karena path asset salah. Pastikan build frontend sukses dan `index.html` bisa diakses.
