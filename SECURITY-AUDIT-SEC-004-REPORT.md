# SECURITY AUDIT REPORT
## SEC-004 — Environment Variables & .ENV Security

**Project:** SIMMACI — [simmaci.com](https://simmaci.com)  
**Date:** 2026-09-03  
**Auditor Roles:** Principal Application Security Engineer + DevSecOps Engineer + Cloud Security Engineer + Adversarial Security Auditor  
**Audit Mode:** Strictly READ-ONLY Verification  
**Verdict:** 🟡 **PASS WITH HARDENING**

---

## 1. EXECUTIVE SUMMARY

Telah dilaksanakan audit keamanan mendalam terhadap arsitektur **Environment Variables, Berkas `.env`, Mekanisme Git Tracking, Docker Build Context, dan Aliran Kredensial Produksi** pada aplikasi **SIMMACI**.

### Ringkasan Status Utama:
1. **Frontend & Production Build Security (🟢 PASS):**
   - Kode frontend (`src/**`) dan bundel kompilasi produksi (`dist/**`) terbukti **100% bersih dari secret server-side**.
   - Hanya variabel publik `VITE_API_URL` dan `VITE_APP_URL` yang diakses di sisi klien.
   - Tidak ditemukan API key, password database, bearer token, atau private key pada bundel JavaScript, HTML, maupun CSS.
2. **Git History Cleanup (🟢 PASS):**
   - Pembersihan riwayat Git (SEC-001) terbukti efektif di remote GitHub. Berkas `backend/.env` yang memuat kredensial Supabase lama telah lenyap dari seluruh pohon commit (0 match pada fresh clone).
3. **Tracking & Konfigurasi Berkas `.env` (🟡 NEEDS HARDENING):**
   - Berkas `.env` dan `.env.production` di root direktori saat ini masih **ter-track oleh Git** (`git ls-files`). Meskipun saat ini hanya berisi konfigurasi publik (`VITE_API_URL`), penamaan berkas `.env` yang ter-track menimbulkan risiko tinggi jika di masa depan ada developer yang menambahkan secret ke dalamnya.
   - Berkas `backend/.env.manual` yang ter-track oleh Git memuat nilai `APP_KEY=base64:(REDACTED_HISTORICAL_APP_KEY_001)`.
   - Root direktori belum memiliki berkas `.dockerignore`, sehingga seluruh konteks root (termasuk folder `.git/` dan backup lokal) dapat terkirim ke daemon Docker saat proses build frontend.
4. **Aliran Kredensial Docker Compose Produksi (🟢 PASS):**
   - Berkas `docker-compose.coolify.yml` telah mengadopsi sintaks mandatory fail-closed (`:?required`) untuk `DB_PASSWORD`, `APP_KEY`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, dan `GOWA_BASIC_AUTH`.

---

## 2. SCOPE AUDIT

Audit mencakup seluruh repositori `d:\apss-source\SIMMACI` dan infrastruktur live terkait:
* Berkas `.env*`, `.gitignore`, dan status Git tracking.
* Kode sumber frontend (`src/**`, `vite.config.ts`, `public/**`).
* Hasil kompilasi produksi (`dist/**`).
* Konfigurasi kontainerisasi (`Dockerfile`, `backend/Dockerfile`, `.dockerignore`, `docker-compose*.yml`).
* Alur otomasi CI/CD (`.github/workflows/main.yml`).
* Pola pengambilan variabel di sisi backend (`backend/app/**`, `backend/config/**`).
* Uji respons HTTP live (`https://simmaci.com` dan `https://api.simmaci.com`).

---

## 3. METHODOLOGY

Audit dilakukan dengan pendekatan gabungan (*Static Application Security Testing / SAST*, *Configuration Analysis*, dan *Black-Box Production Probing*):
* **Git Index & History Inspection:** `git ls-files`, `git check-ignore -v`, dan pemindaian commit tree.
* **Regex AST & Pattern Scanning:** Pemindaian pola secret (`postgres://`, `sk_live_`, `AIza`, `APP_KEY`, private keys, high-entropy tokens).
* **Docker Context Inspection:** Audit direktif `ARG`, `ENV`, `COPY`, `ADD`, serta aturan `.dockerignore`.
* **Codebase Pattern Analysis:** Audit pemanggilan `env()` langsung di luar `config/`, logging statements (`Log::info`, `dd()`, `console.log`).
* **Live HTTP Probing:** Pengujian kebocoran debug, stack trace, dan response headers.

---

## 4. ENVIRONMENT VARIABLE INVENTORY & CLASSIFICATION

Berdasarkan ekstraksi terhadap seluruh berkas konfigurasi Laravel (`backend/config/*.php`) dan frontend (`src/**`), berikut klasifikasi variabel yang digunakan:

| Variable | Kategori | Sumber Produksi | Digunakan Oleh | Server / Client | Tingkat Risiko |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`APP_KEY`** | **SECRET** | Coolify Secret / Env | Laravel Session & Encryption | Server | 🔴 **Critical** |
| **`DB_PASSWORD`** | **SECRET** | Coolify Secret / Env | PostgreSQL Connection | Server | 🔴 **Critical** |
| **`MINIO_ROOT_PASSWORD`** | **SECRET** | Coolify Secret / Env | MinIO Object Storage | Server | 🔴 **Critical** |
| **`GOWA_BASIC_AUTH`** | **SECRET** | Coolify Secret / Env | WhatsApp Gateway Daemon | Server | 🟠 **High** |
| **`AWS_SECRET_ACCESS_KEY`** | **SECRET** | Coolify Secret / Env | Laravel S3 Storage Driver | Server | 🔴 **Critical** |
| **`REDIS_PASSWORD`** | **SECRET** | Coolify Secret / Env | Redis Cache & Queue | Server | 🟠 **High** |
| **`MAIL_PASSWORD`** | **SECRET** | Coolify Secret / Env | SMTP Mailer | Server | 🟠 **High** |
| **`DB_HOST` / `DB_PORT`** | SENSITIVE CONFIG | Docker Compose DNS (`db`) | Database Connector | Server | 🟡 **Medium** |
| **`DB_DATABASE` / `DB_USERNAME`** | SENSITIVE CONFIG | Docker Compose Env | Database Connector | Server | 🟡 **Medium** |
| **`MINIO_ROOT_USER`** | SENSITIVE CONFIG | Docker Compose Env | MinIO Storage Root | Server | 🟡 **Medium** |
| **`AWS_ACCESS_KEY_ID`** | SENSITIVE CONFIG | Docker Compose Env | Laravel S3 Driver | Server | 🟡 **Medium** |
| **`APP_ENV` / `APP_DEBUG`** | SENSITIVE CONFIG | Docker Compose Env (`production`/`false`) | Framework Kernel | Server | 🟡 **Medium** |
| **`GOWA_INTERNAL_URL`** | SENSITIVE CONFIG | Docker DNS (`http://gowa:3000`) | Backend WA Service | Server | 🟢 **Low** |
| **`APP_URL` / `FRONTEND_URL`** | PUBLIC CONFIG | Docker Compose Env | URL Generator / CORS | Server | 🟢 **Low** |
| **`VITE_API_URL`** | PUBLIC CONFIG | Build Arg / Dockerfile | Axios HTTP Client | **Client (Browser)** | 🟢 **Low** |
| **`VITE_APP_URL`** | PUBLIC CONFIG | Build Arg / Runtime Origin | QR Verification Links | **Client (Browser)** | 🟢 **Low** |
| **`VITE_STORAGE_URL`** | PUBLIC CONFIG | Build Arg / Dockerfile | Asset Routing | **Client (Browser)** | 🟢 **Low** |
| **`VITE_SENTRY_DSN`** | PUBLIC CONFIG | Build Arg / Env | Sentry Error Reporting | **Client (Browser)** | 🟢 **Low** |

*Catatan:* Seluruh secret murni berada di **Server (Backend / Docker)**. Tidak ada satupun secret yang berada di **Client (Browser)**.

---

## 5. .GITIGNORE ASSESSMENT

### Hasil Pengujian Git:
```bash
$ git check-ignore -v --no-index .env .env.local .env.production .env.development
.gitignore:3:.env          .env
.gitignore:4:.env*.local   .env.local
```

### Temuan Evaluasi `.gitignore`:
1. **Kelemahan Rule Root `.gitignore`:**
   - Root `.gitignore` baris 3 dan 4 hanya mendefinisikan `.env` dan `.env*.local`.
   - Pola umum `.env.*` **tidak ada**. Akibatnya, berkas seperti `.env.production`, `.env.development`, `.env.staging`, atau `.env.test` **tidak diabaikan** oleh root `.gitignore`.
2. **Backend `.gitignore`:**
   - `backend/.gitignore` mengabaikan `.env`, `.env.backup`, dan `.env.production`.
   - Berkas `backend/.env` saat ini berstatus **IGNORED** dan aman dari pelacakan Git.

*Status:* 🟡 **NEEDS HARDENING**

---

## 6. GIT TRACKING ASSESSMENT

### Bukti Perintah:
```bash
$ git ls-files | grep -E '(^|/)\.env($|\.)'
.env
.env.production
backend/.env.example
backend/.env.manual
```

### Evaluasi:
1. **`.env` (Root):** Sedang ter-track di Git (`HEAD`). Walaupun isinya saat ini hanya konfigurasi lokal (`VITE_API_URL=http://localhost:8000/api`), file bernama `.env` seharusnya tidak berada di indeks Git.
2. **`.env.production` (Root):** Sedang ter-track di Git (`HEAD`). Berisi konfigurasi frontend (`VITE_API_URL=/api`, dll.).
3. **`backend/.env.manual`:** Sedang ter-track di Git (`HEAD`). Memuat konfigurasi dev SQLite dengan **`APP_KEY=base64:(REDACTED_HISTORICAL_APP_KEY_001)`**.

*Status:* 🔴 **TRACKED .ENV PRESENT (Finding SEC-004-01 & SEC-004-02)**

---

## 7. GIT HISTORY ASSESSMENT

### Bukti Pemindaian Riwayat Commit:
```bash
$ git log --all --name-only --pretty=format: | grep -E '(^|/)\.env($|\.)' | sort -u
.env
.env.production
backend/.env.example
backend/.env.manual
```
* Riwayat berkas `backend/.env` (yang di masa lalu memuat kredensial Supabase & JWT di commit `70972cd`) **telah terhapus 100%** dari seluruh cabang dan commit pada remote GitHub (`390d0da9` & `8a36e451`).
* Tidak ada commit aktif yang memuat koneksi Supabase atau JWT secret lama.

*Status:* 🟢 **PASS**

---

## 8. FRONTEND EXPOSURE ASSESSMENT

### Evaluasi Penggunaan Variabel di Frontend (`src/**`):
* Seluruh pencarian `process.env.*` menghasilkan **0 temuan**.
* Pencarian `import.meta.env.*` menemukan 14 referensi, yang seluruhnya merujuk ke:
  - `import.meta.env.VITE_API_URL`
  - `import.meta.env.VITE_APP_URL`
* Tidak ditemukan penggunaan variabel bertipe rahasia seperti `VITE_API_KEY`, `VITE_SECRET`, `VITE_PASSWORD`, `VITE_TOKEN`, atau `VITE_APP_KEY`.
* Server secret tidak pernah direferensikan ataupun diimpor oleh modul frontend.

*Status:* 🟢 **PASS**

---

## 9. PRODUCTION BUILD SECRET LEAKAGE

### Bukti Pemindaian Direktori Kompilasi (`dist/**`):
* Pemindaian regex mendalam terhadap seluruh berkas bundle JavaScript minified, stylesheet, dan HTML di direktori `dist/` menghasilkan:
  ```text
  PRODUCTION BUILD SCAN: 100% CLEAN - ZERO SECRETS FOUND
  ```
* Tidak ditemukan pattern database connection string (`postgres://`, `mysql://`, `redis://`).
* Tidak ditemukan private key, token authorization, atau kunci API pihak ketiga yang tertanam ke aset statis.

*Status:* 🟢 **PASS**

---

## 10. DOCKER ASSESSMENT

### 10.1. Frontend Dockerfile (`Dockerfile`)
* Menggunakan pendekatan *multi-stage build*:
  - Stage 1 (`build`): Menyalin berkas sumber secara eksplisit (`COPY src ./src`, `COPY public ./public`, dll.). **Tidak menggunakan `COPY . .`**.
  - Mengambil build arguments (`ARG VITE_API_URL=/api`, dll.) dan menulis `.env.production` sementara di dalam kontainer build.
  - Stage 2 (`nginx:alpine`): Hanya menyalin artefak statis `COPY --from=build /app/dist /usr/share/nginx/html`.
  - **Kesimpulan:** Image akhir Nginx bersih total dari source code, git history, maupun secret build.

### 10.2. Backend Dockerfile (`backend/Dockerfile`)
* Menggunakan `COPY . .` pada baris 43.
* Didukung oleh `backend/.dockerignore` yang secara eksplisit mengabaikan `.env`, `.env.backup`, dan `/storage/*.key`.
* **Kelemahan Temuan:** Root direktori (`/`) **tidak memiliki `.dockerignore`**. Ketika frontend di-build dengan konteks root, berkas seperti `.git/` dan `.env.local` ikut dikirim ke Docker daemon engine sebagai build context.

*Status:* 🟡 **PASS WITH HARDENING**

---

## 11. CI/CD ASSESSMENT (`.github/workflows/main.yml`)

### Evaluasi Pipeline GitHub Actions:
1. **Backend Test Job:**
   - Menjalankan service container PostgreSQL lokal dengan password dummy `secret` dan database `sim_maarif_test`.
   - Mengenerate APP_KEY sementara secara in-memory menggunakan `php artisan key:generate`.
   - Tidak menggunakan atau mencetak secret produksi.
2. **Docker Build & Push Job:**
   - Menggunakan token bawaan `${{ secrets.GITHUB_TOKEN }}` untuk autentikasi ke GitHub Container Registry (`ghcr.io`).
   - Tidak ada injection secret produksi ke dalam layer Docker.
3. **Log Sanitization:**
   - Tidak ditemukan perintah berbahaya seperti `cat .env`, `printenv`, `env`, atau `echo $SECRET`.

*Status:* 🟢 **PASS**

---

## 12. PRODUCTION CONFIGURATION ASSESSMENT (COOLIFY & COMPOSE)

### Evaluasi Aliran Variabel:
* Pada berkas produksi [docker-compose.coolify.yml](file:///d:/apss-source/SIMMACI/docker-compose.coolify.yml):
  ```yaml
  DB_PASSWORD: ${DB_PASSWORD:?DB_PASSWORD is required}
  APP_KEY: ${APP_KEY:?APP_KEY is required}
  MINIO_ROOT_USER: ${MINIO_ROOT_USER:?MINIO_ROOT_USER is required}
  MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:?MINIO_ROOT_PASSWORD is required}
  GOWA_BASIC_AUTH: ${GOWA_BASIC_AUTH:?GOWA_BASIC_AUTH is required}
  ```
  Seluruh kredensial sensitif diwajibkan berasal dari runtime environment server/Coolify Secrets. Tidak ada fallback plaintext yang dapat dieksploitasi jika variabel kosong.
* Pada berkas lokal [docker-compose.yml](file:///d:/apss-source/SIMMACI/docker-compose.yml):
  Masih terdapat fallback `POSTGRES_PASSWORD: ${DB_PASSWORD:-secret}` dan `MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-minioadmin}`. Berkas ini khusus untuk dev lokal, namun disarankan untuk diseragamkan agar tidak memicu kebingungan.

*Status:* 🟢 **PASS (Production Compose) / 🟡 WARN (Local Compose)**

---

## 13. HTTP ENVIRONMENT LEAKAGE ASSESSMENT

### Pengujian Eksternal Live (`https://simmaci.com` dan `https://api.simmaci.com`):
1. **Error Response:**
   - Endpoint invalid (`/api/invalid-route-xyz`) mengembalikan respons JSON 404 tanpa stack trace.
   - Internal 500 error mengembalikan halaman HTML generic Laravel (`APP_DEBUG=false`), tanpa mengekspos environment variables, file path, atau credential database.
2. **Direct File Probing:**
   - Akses ke `/.env` dan `/backend/.env` mengembalikan halaman fallback SPA (karena live server belum menjalankan Nginx build terbaru), namun **tidak ada isi berkas kredensial aktual yang bocor**.

*Status:* 🟢 **PASS**

---

## 14. LOGGING & DEBUG AUDIT

### Evaluasi Kode Sumber Backend:
1. **Debug Statements:**
   - Pencarian terhadap `dd()`, `dump()`, `var_dump()`, dan `print_r()` di seluruh `backend/app/` menghasilkan **0 temuan**.
2. **Pola Pemanggilan `env()` Langsung:**
   Ditemukan 3 berkas yang memanggil `env()` secara langsung di luar `config/`:
   - `backend/app/Services/GoWaGatewayService.php` (baris 69): `env('GOWA_INTERNAL_URL')`
   - `backend/app/Http/Controllers/Api/FileUploadController.php` (baris 39, 81, 122): `env('AWS_ACCESS_KEY_ID')`
   - `backend/app/Services/MeetingQrService.php` (baris 99, 129): `env('FRONTEND_URL')`
   *Risiko:* Jika perintah `php artisan config:cache` dijalankan di produksi, fungsi `env()` akan mengembalikan `null`. Hal ini bukan kebocoran kredensial, melainkan potensi malfungsi konfigurasi runtime.

*Status:* 🟡 **NEEDS HARDENING**

---

## 15. FINDINGS INVENTORY

### 🔴 Finding SEC-004-01: Root `.env` & `.env.production` Masih Ter-track di Git Index
* **Severity:** **HIGH**
* **Lokasi:** `.env`, `.env.production`
* **Deskripsi:** Berkas `.env` dan `.env.production` tercatat pada Git index (`git ls-files`). Meskipun saat ini hanya berisi parameter publik (`VITE_API_URL`), setiap file bernama `.env` yang berada dalam pelacakan Git berpotensi tinggi memicu kebocoran kredensial jika developer memasukkan secret baru di masa mendatang.
* **Status:** `PROVEN`

### 🟡 Finding SEC-004-02: Hardcoded `APP_KEY` pada `backend/.env.manual` yang Ter-track di Git
* **Severity:** **MEDIUM**
* **Lokasi:** `backend/.env.manual` (baris 3)
* **Deskripsi:** Berkas `backend/.env.manual` ter-track oleh Git dan memuat string `APP_KEY=base64:(REDACTED_HISTORICAL_APP_KEY_001)`. Walaupun ditujukan untuk dev lokal SQLite, meng-commit application key ke Git melanggar standar secret hygiene.
* **Status:** `PROVEN`

### 🟡 Finding SEC-004-03: Root Direktori Tidak Memiliki Berkas `.dockerignore`
* **Severity:** **MEDIUM**
* **Lokasi:** `.dockerignore` (Missing di root)
* **Deskripsi:** Ketika frontend di-build dengan konteks root (`context: .`), ketiadaan `.dockerignore` menyebabkan seluruh direktori (termasuk folder `.git/` sebesar ratusan MB dan berkas backup lokal) dikirimkan ke Docker build context daemon.
* **Status:** `PROVEN`

### 🟡 Finding SEC-004-04: Aturan `.gitignore` Root Tidak Mencakup Pola Lengkap `.env.*`
* **Severity:** **LOW**
* **Lokasi:** `.gitignore` (Root)
* **Deskripsi:** Aturan `.gitignore` di root hanya memuat `.env` dan `.env*.local`. Pola `.env.production`, `.env.development`, atau `.env.staging` tidak dicakup, sehingga Git tidak otomatis mengabaikan berkas-berkas tersebut jika dibuat baru.
* **Status:** `PROVEN`

### 🟡 Finding SEC-004-05: Penggunaan `env()` Langsung di Dalam Controller dan Service
* **Severity:** **LOW**
* **Lokasi:** `FileUploadController.php`, `GoWaGatewayService.php`, `MeetingQrService.php`
* **Deskripsi:** Pemanggilan helper `env()` secara langsung di dalam layer aplikasi akan mengembalikan `null` saat konfigurasi di-cache (`config:cache`) di lingkungan produksi.
* **Status:** `PROVEN`

---

## 16. RISK MATRIX (SEC-004-01 s/d SEC-004-16)

| ID | Kontrol / Uji | Kondisi Diharapkan | Kondisi Aktual | Severity | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-004-01** | `.env` Git Tracking | 0 `.env` files tracked | `.env` & `.env.production` ter-track | **HIGH** | 🔴 **FAIL** |
| **SEC-004-02** | `.gitignore` Coverage | Mencakup `.env*` dan `.env` | Hanya `.env` & `.env*.local` | **MEDIUM** | 🟡 **WARN** |
| **SEC-004-03** | Git History Exposure | 0 secrets di commit history | Bersih total pasca-remediasi | **HIGH** | 🟢 **PASS** |
| **SEC-004-04** | Frontend VITE Secret Exposure | 0 server secrets di VITE_* | Hanya `VITE_API_URL` & `APP_URL` | **CRITICAL** | 🟢 **PASS** |
| **SEC-004-05** | Production Build Secret Exposure | 0 secrets di `dist/**` | 100% Bersih dari secret | **CRITICAL** | 🟢 **PASS** |
| **SEC-004-06** | Docker Build Secret Exposure | Build context terlindungi | Root `.dockerignore` tidak ada | **MEDIUM** | 🟡 **WARN** |
| **SEC-004-07** | Docker Image Layer Exposure | 0 secret di image layer | Frontend Nginx image bersih | **HIGH** | 🟢 **PASS** |
| **SEC-004-08** | Docker Compose Hardcoded Secret | Mandatory variable fail-closed | Produksi aman (`:?`), Dev lokal fallback | **MEDIUM** | 🟢 **PASS (Prod)** |
| **SEC-004-09** | Production Environment Source | Secrets di runtime/secret mgr | Coolify injects at container runtime | **HIGH** | 🟢 **PASS** |
| **SEC-004-10** | CI/CD Secret Exposure | 0 secrets leaked di logs | GitHub Actions aman, no secret leak | **HIGH** | 🟢 **PASS** |
| **SEC-004-11** | `.env` File Permission | Minimal privilege (600/640) | Local dev ACL normal, Linux env injected | **LOW** | 🟢 **PASS** |
| **SEC-004-12** | HTTP Environment Leakage | 0 env values via HTTP | Generic response, no env dump | **HIGH** | 🟢 **PASS** |
| **SEC-004-13** | Debug / Error Leakage | APP_DEBUG=false, no trace | Generic 500 & 404, debug disabled | **HIGH** | 🟢 **PASS** |
| **SEC-004-14** | Log Leakage | 0 passwords/tokens logged | Tidak ada logging kredensial | **MEDIUM** | 🟢 **PASS** |
| **SEC-004-15** | Example Environment Security | Hanya placeholder kosong | `.env.example` bersih; `.env.manual` ada key | **MEDIUM** | 🟡 **WARN** |
| **SEC-004-16** | Backup File Exposure | Backup files di-ignore | `security-remediation/` ignored | **MEDIUM** | 🟢 **PASS** |

---

## 17. RECOMMENDED REMEDIATION (PANDUAN PERBAIKAN)

> *Catatan Kepatuhan: Sesuai aturan audit, perbaikan berikut **TIDAK DIJALANKAN OTOMATIS** selama fase audit read-only ini, dan disediakan sebagai panduan aksi bagi tim developer.*

### Rekomendasi 1: Untrack `.env` dan `.env.production` dari Git
Hapus berkas dari pelacakan Git tanpa menghapusnya dari disk komputer:
```bash
git rm --cached .env .env.production
```

### Rekomendasi 2: Perluas Aturan Root `.gitignore`
Perbarui baris 3 pada `.gitignore` root agar mengabaikan seluruh varian `.env`:
```gitignore
.env
.env.*
!.env.example
```

### Rekomendasi 3: Amankan Berkas `backend/.env.manual`
Kosongkan `APP_KEY` pada `backend/.env.manual` atau untrack berkas tersebut dari Git:
```bash
git rm --cached backend/.env.manual
```

### Rekomendasi 4: Tambahkan Root `.dockerignore`
Buat berkas `.dockerignore` di root direktori proyek dengan isi:
```dockerignore
.git
.gitignore
.env
.env.*
node_modules
dist
security-remediation
scratch
*.md
*.bak
```

### Rekomendasi 5: Refactor Pemanggilan `env()` di Backend Code
Ganti pemanggilan `env()` langsung dengan helper `config()`:
* Pada `FileUploadController.php`: ganti `env('AWS_ACCESS_KEY_ID')` menjadi `config('filesystems.disks.s3.key')`.
* Pada `GoWaGatewayService.php`: ganti `env('GOWA_INTERNAL_URL')` menjadi `config('services.gowa.internal_url')`.

---

## 18. VERIFICATION COMMANDS

Perintah verifikasi mandiri yang dapat dijalankan setelah remedi:
```bash
# 1. Pastikan 0 berkas .env yang ter-track di Git:
git ls-files | grep -E '(^|/)\.env($|\.)'
# Expected: Hanya backend/.env.example yang muncul

# 2. Verifikasi efektivitas .gitignore terhadap seluruh varian .env:
git check-ignore -v --no-index .env .env.production .env.local .env.staging
# Expected: Seluruhnya cocok dengan aturan .gitignore

# 3. Verifikasi ketiadaan secret pada bundle build:
npm run build
grep -rn "postgres://" dist/ || echo "CLEAN"
```

---

## 19. RESIDUAL RISK

* **Risiko Residual Rendah:** Karena `.env` dan `.env.production` yang saat ini ter-track di Git **hanya memuat URL publik** (`/api`), tidak ada dampak eksploitasi instan terhadap infrastruktur aktif.
* **Risiko Kebersihan Konfigurasi:** Kerentanan utama bersifat prosedural, di mana ketiadaan proteksi `.gitignore` penuh dan ketiadaan `.dockerignore` root dapat menjadi pintu masuk kebocoran kredensial di kemudian hari jika tidak segera di-hardening.

---

## 20. FINAL SECURITY VERDICT

```text
===========================================================================
                      FINAL SECURITY VERDICT
===========================================================================

  [ ] 🔴 FAIL
  [X] 🟡 PASS WITH HARDENING
  [ ] 🟢 PASS

===========================================================================
JUSTIFIKASI AUDITOR:
1. Production bundle (dist/**), frontend (src/**), dan image build Nginx
   terbukti 100% BEBAS dari kredensial dan secret server-side (PROVEN).
2. Riwayat remote GitHub terbukti bersih dari kebocoran lama Supabase/JWT (PROVEN).
3. Secret produksi pada Coolify telah mengadopsi fail-closed mandatory (PROVEN).
4. Status PASS penuh ditahan (PASS WITH HARDENING) karena:
   - File .env dan .env.production masih ter-track di indeks Git.
   - backend/.env.manual memuat hardcoded APP_KEY.
   - Root .dockerignore belum tersedia.
===========================================================================
```
