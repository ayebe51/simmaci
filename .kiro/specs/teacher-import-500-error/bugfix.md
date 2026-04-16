# Bugfix Requirements Document

## Introduction

Fitur import data guru (bulk import via Excel/CSV) mengembalikan HTTP 500 setiap kali digunakan. Error ini memblokir operator dan super admin dari melakukan import massal data guru ke sistem SIMMACI. Berdasarkan analisis kode, terdapat beberapa kondisi yang dapat memicu 500: konflik routing antara `POST /teachers/import` dan `apiResource`, `AuditLogTrait` yang melempar exception saat `school_id` null, `HasTenantScope` yang memblokir query lookup NUPTK ketika konteks tenant tidak tersedia, dan `array_filter` yang secara tidak sengaja membuang nilai boolean `false` (seperti `is_certified = false`) sehingga berpotensi melanggar constraint database.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN operator atau super admin mengirim request `POST /api/teachers/import` dengan array data guru yang valid THEN sistem mengembalikan HTTP 500 "request failed with status code 500"

1.2 WHEN import diproses dan salah satu baris guru memiliki `is_certified = false` THEN sistem membuang nilai tersebut via `array_filter` sehingga field wajib bisa kosong dan menyebabkan database error

1.3 WHEN import diproses dan `Teacher::where('nuptk', ...)` dieksekusi tanpa konteks tenant yang valid (misalnya super admin tanpa `school_id`) THEN `TenantScope` melempar `AuthorizationException` yang tidak tertangkap di level import

1.4 WHEN `Teacher::create()` atau `Teacher::update()` berhasil dan `AuditLogTrait` mencoba mencatat activity log THEN jika `school_id` null atau `properties` tidak valid, `ActivityLog::create()` melempar exception yang menggagalkan seluruh request

1.5 WHEN route `POST /teachers/import` didaftarkan setelah `Route::apiResource('teachers', ...)` THEN Laravel mungkin memetakan request ke method `show` dengan parameter `{teacher} = 'import'` sehingga model binding gagal dan menghasilkan 500

### Expected Behavior (Correct)

2.1 WHEN operator atau super admin mengirim request `POST /api/teachers/import` dengan array data guru yang valid THEN sistem SHALL memproses import dan mengembalikan HTTP 200 dengan ringkasan `{ created, errors, summary }`

2.2 WHEN import diproses dan salah satu baris guru memiliki `is_certified = false` THEN sistem SHALL mempertahankan nilai `false` tersebut dan menyimpannya ke database dengan benar

2.3 WHEN import diproses dan query lookup NUPTK dieksekusi oleh super admin THEN sistem SHALL menggunakan `Teacher::withoutTenantScope()` atau `withoutGlobalScope()` agar query tidak diblokir oleh `TenantScope`

2.4 WHEN `AuditLogTrait` mencoba mencatat activity log selama proses import THEN sistem SHALL menangani exception dari `ActivityLog::create()` secara graceful tanpa menggagalkan proses import baris yang bersangkutan

2.5 WHEN route `POST /teachers/import` didefinisikan THEN sistem SHALL mendaftarkan route tersebut sebelum `Route::apiResource('teachers', ...)` agar tidak tertimpa oleh route `show`

### Unchanged Behavior (Regression Prevention)

3.1 WHEN operator menambah satu guru secara manual via `POST /api/teachers` THEN sistem SHALL CONTINUE TO memvalidasi data, menyimpan guru, dan mencatat activity log dengan benar

3.2 WHEN operator atau super admin mengambil daftar guru via `GET /api/teachers` THEN sistem SHALL CONTINUE TO menerapkan tenant scope sesuai role pengguna

3.3 WHEN import berhasil memproses sebagian baris dan sebagian baris lain gagal validasi THEN sistem SHALL CONTINUE TO mengembalikan partial success dengan daftar error per baris tanpa menghentikan seluruh proses

3.4 WHEN guru dengan NUPTK yang sama sudah ada di database THEN sistem SHALL CONTINUE TO melakukan update (upsert) pada data guru tersebut, bukan membuat duplikat

3.5 WHEN operator dengan `school_id` valid melakukan import THEN sistem SHALL CONTINUE TO secara otomatis mengisi `school_id` dari akun operator pada setiap baris yang diimport
