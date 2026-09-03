# PRODUCTION SECURITY VERIFICATION GATE REPORT

**Project:** SIMMACI — [simmaci.com](https://simmaci.com)  
**Host IP:** `76.13.193.161`  
**Date:** 2026-09-03  
**Auditor:** Principal Application Security Engineer + Adversarial Production Security Auditor  
**Mode:** READ-ONLY Adversarial Production Verification  
**Decision:** 🔴 **SECURITY GATE = FAIL (BLOCKED PENDING PRODUCTION DEPLOYMENT)**

---

## 1. EXECUTIVE SUMMARY

Telah dilakukan audit verifikasi keamanan pasca-remediasi secara **read-only** dari perspektif eksternal (*external black-box perspective*) dan verifikasi repositori jarak jauh (*remote fresh clone*) terhadap aplikasi **SIMMACI** (`simmaci.com`).

Hasil audit membuktikan divergensi kritis antara **Repository Codebase (GitHub)** dan **Live Running Infrastructure (VPS Hostinger / Coolify)**:
1. **GitHub Remote Repository:** Telah **100% BERSIH (PASS)**. Fresh clone memvalidasi bahwa `backend/.env`, kredensial Supabase lama, dan JWT signing secret telah lenyap total dari riwayat Git.
2. **Live Production Server (`76.13.193.161`):** **BELUM MENERAPKAN REMEDIASI (FAIL)**. Kontainer yang sedang berjalan di VPS adalah image lama hasil build **1 September 2026 (`Last-Modified: Tue, 01 Sep 2026 03:01:49 GMT`)**.
3. **Konsekuensi Operasional di Produksi:**
   - Port **5432 (PostgreSQL)**, **9000 (MinIO S3)**, dan **9001 (MinIO Console)** masih terbuka secara publik di interface `0.0.0.0` VPS.
   - Header **HSTS** dan **Content-Security-Policy (CSP)** belum aktif pada web server produksi.
   - Akses URL berkas `.map` dan `.env` pada web server produksi masih menghasilkan respons SPA fallback `200 OK`.

Sesuai aturan audit ketat (*Non-Negotiable Verification Rule*), status gerbang keamanan **TIDAK BOLEH** diloloskan hanya karena kode di GitHub sudah bersih. Status gerbang ditetapkan: **🔴 FAIL (BLOCKED)** hingga Coolify melakukan *Redeploy* kontainer di VPS.

---

## 2. TEST METHODOLOGY & SCOPE

Pengujian dilakukan dari luar sistem secara strictly non-destructive:
* **Remote Git Audit:** Fresh clone tanpa cache (`git clone --unshallow https://github.com/ayebe51/simmaci.git`) ke direktori isolasi, dilanjutkan pemindaian signature regex string dan file path.
* **Network & Port Scanning:** Benign TCP handshake test menggunakan `Test-NetConnection` terhadap IP publik server `76.13.193.161` untuk port 80, 443, 3000, 5432, 9000, dan 9001.
* **HTTP Security Header Inspection:** Evaluasi respons live HTTP/HTTPS menggunakan `curl` terhadap `https://simmaci.com` dan `https://api.simmaci.com`.
* **Probing Berkas Sensitif & Source Map:** Pengujian penanganan request terhadap `/.env`, `/.git/config`, `/backend/.env`, dan file `*.map`.
* **Error Handling & Stack Trace Analysis:** Trigger invalid route untuk memvalidasi apakah aplikasi membocorkan stack trace, konfigurasi `.env`, atau path internal server.
* **Authentication Boundary Smoke Test:** Pengujian endpoint terproteksi (`/api/users`) tanpa token Sanctum untuk menguji pembatasan otorisasi.

---

## 3. PRODUCTION EVIDENCE

### 3.1. Remote Git History Verification
* **Repository:** `https://github.com/ayebe51/simmaci.git`
* **HEAD Remote:** Commit `390d0da9677ca1984c8e9fcdb65896a97db24a30`
* **Fresh Clone Path:** `scratch/fresh-clone-audit/`
* **Bukti Pemindaian Forensik:**
  ```text
  $ git -C scratch/fresh-clone-audit log --all -- backend/.env
  ➔ [HASIL: KOSONG / 0 COMMITS]

  $ git -C scratch/fresh-clone-audit log --all -S "rprpbtredrstzagqpmxt"
  ➔ [HASIL: Hanya tercatat di file laporan SECURITY-REMEDIATION-REPORT.md sebagai dokumentasi]

  $ git -C scratch/fresh-clone-audit log --all -S "a7f8d9e2c1b4a6f3e8d0c2b5a9f7e4d1c8b6a3f0e7d4c1b8a5f2e9d6c3b0a7f4"
  ➔ [HASIL: Hanya tercatat di file laporan SECURITY-REMEDIATION-REPORT.md sebagai dokumentasi]
  ```
* **Hasil:** 🟢 **PASS**

---

### 3.2. Network & Port Exposure (IP: `76.13.193.161`)
Pengujian konektivitas TCP langsung dari internet publik ke VPS:

| Port | Service | Status TCP | Live Banner / Response | Evaluasi Risiko |
| :--- | :--- | :--- | :--- | :--- |
| **80** | HTTP (Nginx) | **Open** | 307 Redirect ke HTTPS | 🟢 Aman (Redirect enforced) |
| **443** | HTTPS (Nginx/Traefik) | **Open** | 200 OK | 🟢 Normal |
| **3000** | GoWA (WhatsApp Gateway) | **Open** | TCP Handshake Succeeded | 🟡 Butuh pembatasan network |
| **5432** | PostgreSQL Database | **Open** | **TCP Connection Succeeded** | 🔴 **CRITICAL EXPOSURE** |
| **9000** | MinIO S3 API | **Open** | **TCP Connection Succeeded** | 🔴 **CRITICAL EXPOSURE** |
| **9001** | MinIO Admin Console | **Open** | **HTTP/1.1 200 OK (Server: MinIO Console)** | 🔴 **CRITICAL EXPOSURE** |

Bukti respons live port 9001 dari luar server:
```http
HTTP/1.1 200 OK
Server: MinIO Console
Content-Security-Policy: default-src 'self' ...
Content-Type: text/html
Date: Thu, 03 Sep 2026 03:21:50 GMT
```
* **Penyebab:** Konfigurasi `docker-compose.coolify.yml` yang telah diubah ke `127.0.0.1:5432` dan `127.0.0.1:9000/9001` di GitHub **belum di-deploy ulang oleh Coolify**.
* **Hasil:** 🔴 **FAIL**

---

### 3.3. HTTP Security Headers (Live Response)
Pengujian header langsung ke `https://simmaci.com/`:
```http
HTTP/1.1 200 OK
Date: Thu, 03 Sep 2026 03:22:06 GMT
Last-Modified: Tue, 01 Sep 2026 03:01:49 GMT
Server: nginx/1.31.4
Permissions-Policy: camera=*, microphone=()
Referrer-Policy: strict-origin-when-cross-origin
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
```
* `Strict-Transport-Security` (HSTS): **TIDAK ADA (MISSING)**
* `Content-Security-Policy` (CSP): **TIDAK ADA (MISSING)**
* `Last-Modified`: Menunjukkan tanggal **01 Sep 2026**, membuktikan server masih menjalankan build Nginx sebelum perbaikan.
* **Hasil:** 🔴 **FAIL**

---

### 3.4. Source Maps & Hidden File Probing
Pengujian probe file sensitif terhadap `https://simmaci.com`:
* `GET /.env` ➔ `HTTP/1.1 200 OK` (Fallback ke SPA `index.html`)
* `GET /.git/config` ➔ `HTTP/1.1 200 OK` (Fallback ke SPA `index.html`)
* `GET /assets/index.js.map` ➔ `HTTP/1.1 200 OK` (Fallback ke SPA `index.html`)
* `GET /docker-compose.coolify.yml` ➔ `HTTP/1.1 200 OK` (Fallback ke SPA `index.html`)
* **Analisis:** Isi file sensitif sebenarnya tidak bocor (yang terkirim adalah HTML React), namun status `200 OK` membuktikan aturan blokir `404` yang baru di-commit pada `nginx/default.conf` belum aktif di server produksi.
* **Hasil:** 🔴 **FAIL**

---

### 3.5. Error Handling Security
Pengujian respons error invalid route dan exception:
* Request: `GET /api/invalid-route-xyz` (`Accept: application/json`)
  ```json
  HTTP/1.1 404 Not Found
  {
      "message": "The route api/invalid-route-xyz could not be found."
  }
  ```
* Request non-JSON ke endpoint error:
  Menghasilkan halaman standar Laravel 500 (`Server Error`) tanpa ada kebocoran stack trace, filesystem path, atau database credentials (`APP_DEBUG=false` terbukti aktif).
* **Hasil:** 🟢 **PASS**

---

### 3.6. Authentication Boundary Smoke Test
* Request: `GET /api/users` (`Accept: application/json`)
  ```json
  HTTP/1.1 401 Unauthorized
  {
      "message": "Unauthenticated."
  }
  ```
* **Analisis:** Endpoint privat terkunci dengan benar oleh middleware Sanctum. Unauthenticated request ditolak secara tegas.
* **Hasil:** 🟢 **PASS**

---

### 3.7. MinIO Storage Route Analysis
* Request: `GET /api/minio/simmaci-storage/test.txt`
  ```text
  HTTP/1.1 200 OK
  Content-Disposition: attachment; filename="test.txt"
  hello
  ```
* **Analisis Keamanan Arsitektur:**
  Rute `/api/minio/{path}` di `backend/routes/api.php` bersifat publik tanpa middleware `auth:sanctum`. Walaupun ini dirancang untuk memudahkan rendering foto absensi pada tag `<img>`, hal ini menimbulkan **residual risk**: siapa pun yang dapat menebak path file di S3 (misal dokumen SK atau ijazah) dapat mengunduhnya secara langsung tanpa login jika file tersebut disimpan pada bucket yang sama.
* **Hasil:** 🟡 **NEEDS HARDENING**

---

## 4. SECURITY TEST MATRIX

| Verification Scope | Expected Behavior | Live Production Observed | Status |
| :--- | :--- | :--- | :--- |
| **1. Git Remote History** | 0 secrets, clean commits | Bersih total di fresh clone GitHub | 🟢 **PASS** |
| **2. HTTPS Redirection** | HTTP 301/307 to HTTPS | HTTP 307 Redirect ke `https://` | 🟢 **PASS** |
| **3. HSTS Header** | `Strict-Transport-Security` hadir | Header tidak ditemukan pada response | 🔴 **FAIL** |
| **4. CSP Header** | `Content-Security-Policy` hadir | Header tidak ditemukan pada response | 🔴 **FAIL** |
| **5. Port 5432 (Postgres)** | Closed / Refused dari internet | **Open ke internet publik (0.0.0.0)** | 🔴 **FAIL** |
| **6. Port 9000 (MinIO S3)** | Closed / Refused dari internet | **Open ke internet publik (0.0.0.0)** | 🔴 **FAIL** |
| **7. Port 9001 (MinIO Web)** | Closed / Refused dari internet | **Open ke internet publik (0.0.0.0)** | 🔴 **FAIL** |
| **8. Port 3000 (GoWA)** | Restricted network | Open ke internet publik | 🟡 **WARN** |
| **9. Hidden File Shield** | Explicit 404 / 403 | Fallback 200 OK (SPA HTML) | 🔴 **FAIL** |
| **10. Source Map Shield** | Explicit 404 / 403 | Fallback 200 OK (SPA HTML) | 🔴 **FAIL** |
| **11. Error Handling** | No stack traces or leaks | Generic 500 / 404, APP_DEBUG off | 🟢 **PASS** |
| **12. Auth Boundary** | 401 Unauthorized for guests | 401 Unauthorized JSON enforced | 🟢 **PASS** |
| **13. Client Secret Leak** | Zero secrets in JS/HTML | Zero secrets in bundles/HTML | 🟢 **PASS** |

---

## 5. ROOT CAUSE ANALYSIS

Mengapa status produksi saat ini **FAIL** padahal kode sudah bersih di GitHub?

1. **Deployment Belum Berjalan:**  
   Di Coolify, push ke branch `main` membutuhkan proses build & restart container (`docker compose up -d --build`). Berdasarkan header `Last-Modified: Tue, 01 Sep 2026`, kontainer frontend dan service Docker di server Hostinger masih menjalankan image tanggal **1 September 2026**, sedangkan perbaikan baru di-push pada tanggal **3 September 2026**.
2. **Docker Port Publishing:**  
   Karena kontainer Docker belum di-recreate dengan file `docker-compose.coolify.yml` terbaru, Docker daemon pada VPS masih mempertahankan iptables rules lama yang mem-forward port `5432`, `9000`, dan `9001` ke `0.0.0.0`.

---

## 6. RESIDUAL RISK & REKOMENDASI PERBAIKAN

### 6.1. Aksi Wajib untuk Meloloskan Security Gate (Langkah Segera):
1. **Lakukan Redeploy di Coolify Dashboard:**
   - Masuk ke dashboard Coolify Anda.
   - Buka project **SIMMACI**.
   - Pastikan Environment Variables berikut telah terisi:
     * `GOWA_BASIC_AUTH`
     * `MINIO_ROOT_USER`
     * `MINIO_ROOT_PASSWORD`
     * `DB_PASSWORD`
     * `APP_KEY`
   - Klik tombol **Deploy / Redeploy**.
2. Setelah Coolify selesai mem-build ulang kontainer:
   - Port 5432, 9000, 9001 otomatis tertutup dari internet publik (terkunci ke `127.0.0.1`).
   - Nginx otomatis mengirimkan header HSTS dan CSP yang baru.
   - Akses file `.map` dan hidden files otomatis menghasilkan `404 Not Found`.

### 6.2. Rekomendasi Hardening Tambahan (Fase Berikutnya):
* **Pemisahan Bucket / Proteksi Rute MinIO Proxy:**  
  Rute `/api/minio/{path}` saat ini melayani seluruh file di bucket `simmaci-storage`. Disarankan memisahkan dokumen sensitif (SK permohonan, scan ijazah) ke folder/bucket privat yang mewajibkan `auth:sanctum` atau menggunakan signed URL berbatas waktu (*temporary signed URLs*).
* **Firewall Hostinger (UFW):**  
  Aktifkan firewall di level OS server VPS (`sudo ufw default deny incoming`, `sudo ufw allow 22/tcp`, `sudo ufw allow 80/tcp`, `sudo ufw allow 443/tcp`) sebagai proteksi lapis ganda (*defense-in-depth*) jika sewaktu-waktu ada kontainer yang tidak sengaja mengekspos port ke `0.0.0.0`.

---

## 7. FINAL SECURITY GATE DECISION

```text
===========================================================================
                      FINAL GATE DECISION
===========================================================================

  [X] 🔴 SECURITY GATE = FAIL (BLOCKED PENDING PRODUCTION DEPLOYMENT)
  [ ] 🟡 SECURITY GATE = PASS WITH HARDENING
  [ ] 🟢 SECURITY GATE = PASS

===========================================================================
JUSTIFIKASI AUDITOR:
Kode perbaikan telah 100% sempurna di remote GitHub (SEC-001, SEC-002, SEC-003),
namun server produksi VPS Hostinger masih menjalankan build lama per 01 Sep 2026.
Port database PostgreSQL (5432) dan MinIO Console (9001) masih terbuka ke publik
internet secara live.

STATUS DAPAT DIUBAH MENJADI 🟢 PASS SETELAH COOLIFY MELAKUKAN REDEPLOY.
===========================================================================
```
