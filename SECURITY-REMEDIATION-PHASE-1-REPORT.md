# LAPORAN REMEDIASI KEAMANAN SISTEM INFORMASI SIMMACI — FASE 1
## Penutupan Production NO-GO & Pengerasan Batas Keamanan (Security Boundary Hardening)

- **Aplikasi**: SIMMACI — Sistem Informasi Manajemen LP Ma'arif NU Cilacap
- **Repositori**: `ayebe51/simmaci`
- **Branch**: `fix/security-hardening-phase1`
- **Base Commit**: `e44101a2`
- **Tanggal Remediasi**: 9 Oktober 2026
- **Peran**: Principal Application Security Engineer
- **Audit Baseline**: [`SECURITY-AUDIT-CSRF-CORS-HTTPS-PRODUCTION.md`](file:///d:/apss-source/SIMMACI/SECURITY-AUDIT-CSRF-CORS-HTTPS-PRODUCTION.md) (Status Baseline: **NO-GO**)

---

## 1. RINGKASAN EKSEKUTIF & KEPUTUSAN VERDIK

### Keputusan Verdik: **CONDITIONAL PASS**

> **Dasar Keputusan CONDITIONAL PASS**:
> Seluruh 5 area temuan tingkat **High** dari audit baseline beserta temuan pengerasan tambahan telah **100% diimplementasikan di source code**, divalidasi melalui inspeksi konfigurasi mendalam, dan diverifikasi melalui **13 automated regression tests baru (69 assertions)** serta **61 automated regression tests existing (214 assertions)** tanpa memecah fungsionalitas SIMMACI yang sah.
> 
> Status dikategorikan **CONDITIONAL PASS** (bukan Unconditional PASS) karena **verifikasi runtime pada server live production (`api.simmaci.com` & `simmaci.com`) baru dapat dilakukan setelah pemilik sistem menginput environment variables wajib di Coolify dashboard dan mengeksekusi deployment resmi**.

---

## 2. MATRIKS STATUS VERIFIKASI PER TEMUAN

Sesuai aturan keamanan kerja, status verifikasi dipisahkan secara tegas dan tidak digabungkan ke dalam satu klaim umum:

| ID Temuan | Kategori & Deskripsi | Implemented in Source | Verified by Automated Tests | Verified by Config Inspection | Verified Live Production | Status Fase 1 |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **SEC-HTTPS-001** | Trusted Proxy Configuration & Header Spoofing Protection | **YA** | **YA** | **YA** | *Pending Deploy* | **TERTUTUP (Source)** |
| **SEC-COOKIE-001** | Secure Authentication & CSRF Cookies Behind Proxy | **YA** | **YA** | **YA** | *Pending Deploy* | **TERTUTUP (Source)** |
| **SEC-HEAD-001** | Backend API Browser Security Headers (HSTS, CSP, XFO, XCTO, RP) | **YA** | **YA** | **YA** | *Pending Deploy* | **TERTUTUP (Source)** |
| **SEC-CONF-001** | Penghapusan Hardcoded Credential Fallbacks & Fail-Closed Enforcement | **YA** | **YA** | **YA** | *Pending Deploy* | **TERTUTUP (Source)** |
| **SEC-CORS-001** | Eliminasi Public Ingress WAHA & Wildcard CORS (`*`) | **YA** | **YA** | **YA** | *Pending Deploy* | **TERTUTUP (Source)** |
| **SEC-DEBUG-003** | Eliminasi Pengungkapan Versi PHP via `X-Powered-By` & `expose_php` | **YA** | **YA** | **YA** | *Pending Deploy* | **TERTUTUP (Source)** |

---

## 3. DETAIL IMPLEMENTASI TEKNIS & KEPUTUSAN DESAIN

### 3.1 SEC-HTTPS-001 — Trusted Proxy Configuration

- **Masalah Semula**:
  Laravel 12 belum mengonfigurasi `$middleware->trustProxies()`. Akibatnya, Laravel membaca `REMOTE_ADDR` internal Traefik (`172.18.0.x`) sebagai IP klien, memutus logging aktivitas IP yang sah, melemahkan IP rate-limiting, dan berisiko menghasilkan URL HTTP jika scheme HTTPS tidak terdeteksi.
- **Keputusan Arsitektur & Trust Boundary**:
  - Menolak opsi `at: '*'` karena membuka celah header spoofing jika klien dapat menjangkau aplikasi tanpa sanitasi proxy upstream.
  - Mengonfigurasi trust boundary terukur mencakup loopback dan subnet RFC 1918 (`127.0.0.1, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16`), mencakup jaringan bridge Docker Coolify dan Traefik.
  - Membatasi trusted headers hanya pada `HEADER_X_FORWARDED_FOR | HEADER_X_FORWARDED_HOST | HEADER_X_FORWARDED_PORT | HEADER_X_FORWARDED_PROTO`.
  - Memastikan kompatibilitas penuh dengan `php artisan config:cache` melalui `config/trustedproxy.php` dan `config/app.php`.
  - Menambahkan `URL::forceScheme('https')` di [`AppServiceProvider`](file:///d:/apss-source/SIMMACI/backend/app/Providers/AppServiceProvider.php) ketika `APP_ENV=production` atau `APP_URL` menggunakan HTTPS.
- **Hasil Otomasi**:
  - Request dari trusted proxy (`172.18.0.2`) dengan `X-Forwarded-For: 203.0.113.195` berhasil me-resolve IP `203.0.113.195` dan scheme `https`.
  - Request dari untrusted IP (`198.51.100.55`) yang mencoba memalsukan `X-Forwarded-For` langsung ditolak dan tetap tercatat sebagai `198.51.100.55`.

### 3.2 SEC-COOKIE-001 — Secure Authentication & CSRF Cookies

- **Masalah Semula**:
  `SESSION_SECURE_COOKIE` tidak didefinisikan secara eksplisit di Coolify dan `config/session.php` mengandalkan nilai default env yang bernilai `null` (diperlakukan sebagai `false` oleh cookie jar). Cookie sesi dikirim tanpa flag `Secure`.
- **Keputusan Arsitektur**:
  - Di [`config/session.php`](file:///d:/apss-source/SIMMACI/backend/config/session.php): Mengimplementasikan *defense-in-depth default*:
    ```php
    'secure' => env('SESSION_SECURE_COOKIE') !== null
        ? (bool) env('SESSION_SECURE_COOKIE')
        : (env('APP_ENV') === 'production'),
    ```
    Jika variabel `SESSION_SECURE_COOKIE` tidak diisi di environment, sistem secara otomatis mengaktifkan flag `Secure` bila `APP_ENV === 'production'`.
  - Di [`docker-compose.coolify.yml`](file:///d:/apss-source/SIMMACI/docker-compose.coolify.yml): Mendeklarasikan `SESSION_SECURE_COOKIE: "true"` secara eksplisit pada kontainer `backend`, `queue`, dan `scheduler`.
  - Menjaga integritas `XSRF-TOKEN`: Cookie `XSRF-TOKEN` tetap `HttpOnly=false` agar dapat dibaca secara sah oleh frontend Axios/Fetch, namun flag `Secure=true` dan `SameSite=lax` diaktifkan secara ketat saat sesi berjalan di bawah HTTPS. Cookie sesi autentikasi tetap terlindungi dengan `HttpOnly=true`.

### 3.3 SEC-HEAD-001 & SEC-DEBUG-003 — Backend API Security Headers & PHP Hardening

- **Masalah Semula**:
  Endpoint API backend pada `backend.conf` tidak menyertakan HSTS, Clickjacking protection, Referrer-Policy, nosniff, atau CSP. Response juga membocorkan versi PHP (`X-Powered-By: PHP/8.3.16`).
- **Keputusan Arsitektur**:
  - Nginx bertindak sebagai single authority pemilik response header keamanan backend, menggunakan direktif `always` agar header tetap hadir pada HTTP error status (4xx dan 5xx).
  - Mengimplementasikan `backend/docker/nginx/hsts_map.conf`:
    ```nginx
    map $http_x_forwarded_proto $hsts_header {
        default "";
        https "max-age=31536000; includeSubDomains";
    }
    ```
    HSTS hanya dikirimkan jika protokol eksternal yang di-forward oleh Traefik adalah HTTPS (mematuhi RFC 6797 yang melarang pengiriman STS melalui transport HTTP non-secure).
  - Menambahkan header di [`backend/docker/nginx/backend.conf`](file:///d:/apss-source/SIMMACI/backend/docker/nginx/backend.conf):
    - `X-Frame-Options: SAMEORIGIN always;`
    - `X-Content-Type-Options: nosniff always;`
    - `Referrer-Policy: strict-origin-when-cross-origin always;`
    - `Strict-Transport-Security: $hsts_header always;`
    - `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; object-src 'none'; base-uri 'self'; always;` (kompatibel dengan Livewire/Filament dan API JSON).
  - Menghilangkan `X-Powered-By`:
    - Level PHP: Menambahkan `expose_php=Off` pada konfigurasi `/usr/local/etc/php/conf.d/uploads.ini` di [`backend/Dockerfile`](file:///d:/apss-source/SIMMACI/backend/Dockerfile).
    - Level Nginx: Menambahkan `server_tokens off;`, `fastcgi_hide_header X-Powered-By;`, dan `proxy_hide_header X-Powered-By;` di [`backend/docker/nginx/backend.conf`](file:///d:/apss-source/SIMMACI/backend/docker/nginx/backend.conf).

### 3.4 SEC-CONF-001 — Fail-Closed Credential Enforcement

- **Masalah Semula**:
  `docker-compose.coolify.yml` memiliki fallback kredensial default yang rentan:
  - Password Redis: `R3d1s_S1mm4c1_9f8a7b6c5d4e3f2nd74`
  - Password & API key WAHA: `secret123` dan `admin`
  - Fallback warisan: `GOWA_BASIC_AUTH`
- **Keputusan Arsitektur**:
  - Mengubah seluruh interpolasi kredensial sensitif menjadi fail-closed menggunakan sintaks Docker Compose `${VARIABLE:?VARIABLE is required}`.
  - Menghapus string kredensial default dari source code dan compose files.
  - Mengaktifkan `--protected-mode yes` pada Redis.
  - Memperbarui healthcheck Redis menggunakan format safe parameter expansion: `redis-cli -a "${REDIS_PASSWORD:?REDIS_PASSWORD is required}" ping`.
  - Jika salah satu kredensial kosong atau tidak didefinisikan saat deploy, proses orkestrasi Coolify/Docker Compose akan langsung menggagalkan build dan menolak running (fail-safe).

### 3.5 SEC-CORS-001 — Eliminasi Public Ingress WAHA

- **Masalah Semula**:
  Kontainer WAHA diekspos ke publik via Traefik pada router `waha.simmaci.com` dengan wildcard CORS (`Access-Control-Allow-Origin: *`), memungkinkan pihak ketiga di internet mengakses Swagger UI atau melakukan brute force API key.
- **Keputusan Arsitektur**:
  - Audit kode front-end (`src/`) membuktikan tidak ada pemanggilan langsung ke `waha.simmaci.com`. Seluruh komunikasi WhatsApp dilakukan oleh backend internal via `http://waha:3000`.
  - Menghapus seluruh label Traefik (`traefik.enable`, `traefik.http.routers.waha.*`, dll.) dari kontainer `waha` di [`docker-compose.coolify.yml`](file:///d:/apss-source/SIMMACI/docker-compose.coolify.yml).
  - Melepaskan kontainer `waha` dari jaringan eksternal `coolify`.
  - Kontainer `waha` hanya terhubung ke `simmaci-network` internal dengan alias `waha` dan `gowa`.
  - Port `3000` hanya diakses secara internal oleh kontainer `backend`, `queue`, dan `scheduler`.
  - Jika admin memerlukan akses dashboard WAHA untuk scan QR code perangkat baru, akses dapat dilakukan melalui port forwarding SSH lokal (`ssh -L 3000:simmaci-waha:3000 user@server`) tanpa mengekspos port ke internet publik.

---

## 4. BERKAS YANG DIUBAH & PENJELASAN PERUBAHAN

| No | Berkas | Perubahan Keamanan |
| :--- | :--- | :--- |
| 1 | [`backend/bootstrap/app.php`](file:///d:/apss-source/SIMMACI/backend/bootstrap/app.php) | Mengonfigurasi `$middleware->trustProxies()` dengan subnet RFC 1918 dan pembatasan header forwarder yang valid. |
| 2 | [`backend/config/app.php`](file:///d:/apss-source/SIMMACI/backend/config/app.php) | Menambahkan key konfigurasi `'trusted_proxies'` untuk mendukung caching konfigurasi Laravel. |
| 3 | [`backend/config/trustedproxy.php`](file:///d:/apss-source/SIMMACI/backend/config/trustedproxy.php) | Berkas konfigurasi baru untuk trusted proxies & trusted headers compatible dengan `config:cache`. |
| 4 | [`backend/app/Providers/AppServiceProvider.php`](file:///d:/apss-source/SIMMACI/backend/app/Providers/AppServiceProvider.php) | Menambahkan `URL::forceScheme('https')` di method `boot()` saat environment `production`. |
| 5 | [`backend/config/session.php`](file:///d:/apss-source/SIMMACI/backend/config/session.php) | Mengonfigurasi `'secure'` dengan fallback otomatis bernilai `true` saat `APP_ENV=production`. |
| 6 | [`backend/Dockerfile`](file:///d:/apss-source/SIMMACI/backend/Dockerfile) | Menyuntikkan `expose_php=Off` ke `uploads.ini` dan menyalin `hsts_map.conf` ke `/etc/nginx/conf.d/`. |
| 7 | [`backend/docker/nginx/hsts_map.conf`](file:///d:/apss-source/SIMMACI/backend/docker/nginx/hsts_map.conf) | Berkas konfigurasi baru Nginx untuk pemetaan HSTS kondisional berbasis protokol `X-Forwarded-Proto`. |
| 8 | [`backend/docker/nginx/backend.conf`](file:///d:/apss-source/SIMMACI/backend/docker/nginx/backend.conf) | Menambahkan `server_tokens off`, menyembunyikan `X-Powered-By`, menambahkan HSTS, XFO, XCTO, Referrer-Policy, dan CSP dengan flag `always`. |
| 9 | [`docker-compose.coolify.yml`](file:///d:/apss-source/SIMMACI/docker-compose.coolify.yml) | Menerapkan fail-closed credential interpolation (`REDIS_PASSWORD`, `WAHA_API_KEY`, dll.), mengaktifkan `protected-mode yes`, menginjeksi `SESSION_SECURE_COOKIE` & `TRUSTED_PROXIES`, dan mencabut ingress Traefik WAHA. |
| 10 | [`docker-compose.yml`](file:///d:/apss-source/SIMMACI/docker-compose.yml) | Menghapus hardcoded password Redis default dari file compose development lokal. |
| 11 | [`docker-compose.waha.yml`](file:///d:/apss-source/SIMMACI/docker-compose.waha.yml) | Menghapus fallback kredensial default `secret123` dan `admin`. |
| 12 | [`backend/.env.example`](file:///d:/apss-source/SIMMACI/backend/.env.example) | Mendokumentasikan template variabel baru: `TRUSTED_PROXIES`, `SESSION_SECURE_COOKIE`, dan konfigurasi WAHA. |
| 13 | [`backend/tests/Feature/SecurityHardeningPhase1Test.php`](file:///d:/apss-source/SIMMACI/backend/tests/Feature/SecurityHardeningPhase1Test.php) | Berkas test suite otomatis baru yang memvalidasi seluruh kontrol keamanan Fase 1 (13 tests, 69 assertions). |

---

## 5. HASIL UJI REGRESI OTOMATIS

### 5.1 Test Suite Khusus Fase 1: `SecurityHardeningPhase1Test.php`
Perintah eksekusi:
```bash
php artisan test tests/Feature/SecurityHardeningPhase1Test.php
```
Hasil:
```text
PASS  Tests\Feature\SecurityHardeningPhase1Test
✓ trusted proxy resolves client ip and https scheme                           0.61s
✓ untrusted client cannot spoof client ip or scheme                           0.06s
✓ throttling uses resolved client ip through trusted proxy                    0.06s
✓ session cookie secure defaults to true in production                        0.05s
✓ csrf cookie is secure without breaking frontend reading                     0.06s
✓ csrf rejection behavior on web routes                                       0.06s
✓ csrf acceptance with valid token                                            0.06s
✓ backend nginx configuration includes security headers                       0.05s
✓ dockerfile disables expose php                                              0.05s
✓ api responses do not disclose x powered by                                  0.06s
✓ compose coolify enforces required credentials and removes fallbacks         0.06s
✓ compose parses cleanly with disposable dummy values                         0.06s
✓ waha service public ingress is removed                                      0.05s

Tests:    13 passed (69 assertions)
Duration: 1.49s
```

### 5.2 Test Suite Regresi Terkait
1. **Health and Warmup** (`tests/Feature/HealthAndWarmupTest.php`):
   - 4 passed (14 assertions) — Mengonfirmasi API `/api/health`, `/api/version`, `/api/health/deep`, dan `/api/warmup` berjalan normal tanpa gangguan.
2. **WhatsApp Gateway Service** (`tests/Unit/Services/WahaGatewayServiceTest.php`):
   - 12 passed (28 assertions) — Mengonfirmasi komunikasi internal ke WAHA dan autentikasi token tetap berfungsi 100%.
3. **Public Meeting Scanner** (`tests/Feature/PublicMeetingScannerTest.php`):
   - 18 passed (57 assertions) — Mengonfirmasi autentikasi PIN, rate-limiting, dan scanner QR pertemuan publik tetap valid.
4. **Post-Remediation Authorization Verification** (`tests/Feature/PostRemediationSecurityVerificationTest.php`):
   - 27 passed (115 assertions) — Mengonfirmasi multi-tenancy, proteksi IDOR, dan isolasi role tidak mengalami regresi.
5. **Frontend Offline Queue Test** (`vitest run src/lib/__tests__/offlineQueue.test.ts`):
   - 4 passed (4 assertions) — Mengonfirmasi integritas queue offline front-end.

**Total Pengujian**: **78 tests dieksekusi, 78 passed (100% green), 0 failed.**

---

## 6. CHECKLIST ENVIRONMENT VARIABLE WAJIB DI COOLIFY

Sebelum melakukan redeploy di Coolify, pastikan variabel-variabel berikut telah didefinisikan pada dashboard Coolify:

| Nama Environment Variable | Tujuan / Fungsi | Persyaratan Nilai |
| :--- | :--- | :--- |
| `DB_PASSWORD` | Kredensial autentikasi PostgreSQL | **Wajib diisi**. String rahasia yang kuat. |
| `REDIS_PASSWORD` | Kredensial autentikasi Redis | **Wajib diisi**. String rahasia yang kuat (minimal 32 karakter acak). |
| `APP_KEY` | Kunci enkripsi sesi & data Laravel | **Wajib diisi**. Format `base64:...`. |
| `MINIO_ROOT_USER` | Username admin storage MinIO | **Wajib diisi**. String non-default. |
| `MINIO_ROOT_PASSWORD` | Password admin storage MinIO | **Wajib diisi**. String rahasia yang kuat. |
| `WAHA_API_KEY` | Kunci otentikasi API internal WAHA | **Wajib diisi**. String rahasia yang kuat (digunakan pula pada config database WA Blast). |
| `WAHA_DASHBOARD_PASSWORD` | Password akun admin internal WAHA | **Wajib diisi**. String rahasia yang kuat (untuk akses via SSH tunnel). |
| `SESSION_SECURE_COOKIE` | Penegakan flag HTTPS pada cookie sesi | Disetel ke `true`. |
| `TRUSTED_PROXIES` | Daftar IP/CIDR proxy terpercaya | Disetel ke `127.0.0.1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16` (default aman sudah tersedia). |

*Catatan Keamanan: Jangan pernah mencantumkan atau meng-commit nilai rahasia nyata ke git repository.*

---

## 7. RUNBOOK VERIFIKASI PASCA-DEPLOYMENT PRODUKSI

Setelah perubahan di-deploy ke server produksi oleh system owner, jalankan rangkaian uji non-destruktif berikut dari terminal luar untuk memvalidasi penutupan celah secara langsung:

### 1. Verifikasi Security Headers & Tidak Ada PHP Version Disclosure
Jalankan:
```bash
curl -I https://api.simmaci.com/api/version
```
**Kriteria Lolos**:
- Header `X-Powered-By` **TIDAK ADA**.
- Header `X-Frame-Options: SAMEORIGIN` **ADA**.
- Header `X-Content-Type-Options: nosniff` **ADA**.
- Header `Referrer-Policy: strict-origin-when-cross-origin` **ADA**.
- Header `Strict-Transport-Security: max-age=31536000; includeSubDomains` **ADA**.
- Header `Content-Security-Policy` **ADA**.

### 2. Verifikasi Cookie Sesi & CSRF Flag Secure
Jalankan:
```bash
curl -I https://api.simmaci.com/admin/login
```
**Kriteria Lolos**:
- Pada header `Set-Cookie` untuk sesi (`sim_maarif_session` atau sejenis):
  - Mengandung flag `Secure`.
  - Mengandung flag `HttpOnly`.
  - Mengandung `SameSite=lax`.
- Pada header `Set-Cookie` untuk `XSRF-TOKEN`:
  - Mengandung flag `Secure`.
  - Mengandung `SameSite=lax`.
  - Tidak memiliki flag `HttpOnly` (agar front-end dapat membaca token).

### 3. Verifikasi Resolusi Trusted Proxy & Client IP
Periksa file log aplikasi (`storage/logs/laravel.log`) atau database activity logs setelah melakukan request dari IP publik tertentu.
**Kriteria Lolos**:
- IP yang tercatat adalah IP publik asli pengguna, bukan IP gateway Docker internal (`172.18.0.x`).

### 4. Verifikasi Penutupan Public Ingress WAHA
Jalankan:
```bash
curl -I https://waha.simmaci.com
```
**Kriteria Lolos**:
- Domain `waha.simmaci.com` merespons dengan **404 Not Found** (Traefik router tidak ditemukan) atau koneksi ditolak / SSL handshake timeout.
- Dashboard WAHA dan Swagger UI tidak dapat diakses lagi dari internet publik.
- Wildcard CORS (`Access-Control-Allow-Origin: *`) tidak lagi dapat dipicu oleh publik.

### 5. Verifikasi Integrasi Pesan WhatsApp
Lakukan uji kirim pesan WhatsApp melalui panel SIMMACI (`/api/wa-blasts/test-connection`).
**Kriteria Lolos**:
- Backend SIMMACI berhasil berkomunikasi dengan `http://waha:3000` via Docker bridge internal dan mengembalikan status koneksi aktif.

---

## 8. BACKLOG TEMUAN FASE 2 (DI LUAR RUANG LINGKUP FASE 1)

Temuan-temuan berikut secara sengaja tidak diubah pada Fase 1 karena memerlukan penyesuaian arsitektur frontend/otentikasi dan akan ditangani pada Fase 2:

1. **SEC-AUTH-001 (Token Storage Architecture)**: Evaluasi migrasi penyimpanan token SPA dari `localStorage` ke httpOnly cookie atau short-lived bearer token dengan refresh mechanism.
2. **SEC-AUTH-002 (Sanctum Expiration Policy)**: Konfigurasi waktu kedaluwarsa eksplisit untuk token Sanctum (`expiration` di `config/sanctum.php`).
3. **SEC-S3-001 (MinIO Direct Signed URLs)**: Penggantian streaming file MinIO query-string dengan presigned URL berbasis S3 driver.
4. **SEC-ADMIN-001 (Filament Admin Panel Access Restriction)**: Pembatasan subnet IP atau VPN internal untuk akses `/admin/login`.
5. **SEC-CSP-002 (Strict Nonce-based CSP)**: Penyempurnaan Content Security Policy menggunakan cryptographic nonces untuk mengeliminasi `'unsafe-inline'` pada SPA React dan Filament.

---

## 9. KESIMPULAN

Fase 1 Remediasi Keamanan telah menyelesaikan seluruh pekerjaan hardening batas keamanan aplikasi SIMMACI sesuai standar industri. Seluruh perbaikan telah diverifikasi aman secara lokal tanpa merusak alur operasional aplikasi. Sistem siap untuk diajukan ke tahap deployment produksi oleh System Owner dengan mengikuti panduan Coolify dan runbook verifikasi di atas.
