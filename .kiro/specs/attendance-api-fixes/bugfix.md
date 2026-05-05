# Bugfix Requirements Document

## Introduction

Fitur attendance di aplikasi SIMMACI sudah diimplementasikan di frontend dan backend, tetapi tidak berfungsi karena ada ketidakcocokan (mismatch) antara API endpoint, payload structure, HTTP methods, dan logic parsing data. Bug ini menyebabkan:
- Frontend tidak bisa fetch/save data absensi siswa dan guru
- Master data (mata pelajaran, kelas, jadwal) tidak bisa diload
- QR scanner tidak bisa record attendance
- Settings tidak bisa disimpan dan WA connection check gagal
- Student attendance data tidak ditampilkan dengan benar
- PIN scanner tidak divalidasi ke backend
- Tidak ada menu navigation untuk akses fitur

Impact: Fitur attendance tidak dapat digunakan sama sekali oleh user.

## Bug Analysis

### Current Behavior (Defect)

**1. API Endpoint Mismatch - Student Logs**

1.1 WHEN frontend memanggil `GET /attendance/student-logs` THEN backend mengembalikan 404 error karena endpoint yang tersedia adalah `/attendance/student-log` (singular)

1.2 WHEN frontend memanggil `POST /attendance/student-logs` THEN backend mengembalikan 404 error karena endpoint yang tersedia adalah `/attendance/student-log` (singular)

**2. API Endpoint Mismatch - Master Data**

1.3 WHEN frontend memanggil `GET /subjects` THEN backend mengembalikan 404 error karena endpoint yang tersedia adalah `/attendance/subjects`

1.4 WHEN frontend memanggil `GET /classes` THEN backend mengembalikan 404 error karena endpoint yang tersedia adalah `/attendance/classes`

1.5 WHEN frontend memanggil `GET /lesson-schedules` THEN backend mengembalikan 404 error karena endpoint yang tersedia adalah `/attendance/schedules`

1.6 WHEN frontend memanggil `PUT /subjects/{id}` THEN backend mengembalikan 404 error karena endpoint yang tersedia adalah `/attendance/subjects/{subject}`

1.7 WHEN frontend memanggil `PUT /classes/{id}` THEN backend mengembalikan 404 error karena endpoint yang tersedia adalah `/attendance/classes/{class}`

1.8 WHEN frontend memanggil `POST /lesson-schedules` THEN backend mengembalikan 404 error karena endpoint yang tersedia adalah `/attendance/schedules`

**3. QR Scan Payload Tidak Match**

1.9 WHEN frontend mengirim QR scan request dengan payload `{ qr_code: string }` THEN backend tidak bisa memproses karena expect payload `{ code: string, type: 'teacher'|'student' }`

**4. HTTP Method Tidak Konsisten**

1.10 WHEN frontend memanggil `POST /attendance/settings` untuk update settings THEN backend mengembalikan 405 error karena expect `PUT /attendance/settings`

1.11 WHEN frontend memanggil `POST /attendance/check-wa` untuk check WA connection THEN backend mengembalikan 405 error karena expect `GET /attendance/check-wa`

**5. Student Attendance Page Logic Bug**

1.12 WHEN StudentAttendancePage memproses `existingRecords` dari API THEN code salah mengakses `r.student_id` dan `r.status` langsung padahal data tersebut ada di dalam `r.logs` array (JSON field)

1.13 WHEN StudentAttendancePage mencoba menampilkan existing attendance data THEN data tidak muncul karena parsing logic salah

**6. Scanner PIN Tidak Divalidasi**

1.14 WHEN user memasukkan PIN di QrScannerPage THEN PIN hanya dicek di client-side tanpa validasi ke backend, sehingga siapa saja bisa akses scanner mode dengan PIN apapun

**7. Tidak Ada Menu Navigation**

1.15 WHEN user login ke aplikasi THEN tidak ada menu/link untuk akses fitur attendance di sidebar/navigation, sehingga user tidak bisa akses kecuali tahu URL langsung

**8. Tidak Ada Geolocation Tracking**

1.16 WHEN user melakukan absensi (guru atau siswa) via QR scanner atau manual input THEN sistem tidak merekam lokasi GPS (latitude/longitude) sehingga tidak ada validasi bahwa user benar-benar berada di lokasi sekolah

1.17 WHEN operator mencoba melihat laporan absensi THEN tidak ada informasi lokasi GPS yang terekam, sehingga tidak bisa memverifikasi keaslian absensi atau mendeteksi fake attendance dari lokasi lain

1.18 WHEN sekolah ingin mengaktifkan geofencing untuk validasi lokasi THEN tidak ada pengaturan untuk menentukan koordinat sekolah dan radius geofencing yang diperbolehkan

### Expected Behavior (Correct)

**1. API Endpoint Consistency - Student Logs**

2.1 WHEN frontend memanggil `GET /attendance/student-logs` THEN backend SHALL merespons dengan data student attendance logs (endpoint harus konsisten antara frontend dan backend)

2.2 WHEN frontend memanggil `POST /attendance/student-logs` THEN backend SHALL menyimpan student attendance logs dan mengembalikan response sukses

**2. API Endpoint Consistency - Master Data**

2.3 WHEN frontend memanggil `GET /subjects` THEN backend SHALL merespons dengan data subjects (atau frontend harus memanggil `/attendance/subjects`)

2.4 WHEN frontend memanggil `GET /classes` THEN backend SHALL merespons dengan data classes (atau frontend harus memanggil `/attendance/classes`)

2.5 WHEN frontend memanggil `GET /lesson-schedules` THEN backend SHALL merespons dengan data lesson schedules (atau frontend harus memanggil `/attendance/schedules`)

2.6 WHEN frontend memanggil `PUT /subjects/{id}` THEN backend SHALL update subject dengan ID tersebut (atau frontend harus memanggil `/attendance/subjects/{subject}`)

2.7 WHEN frontend memanggil `PUT /classes/{id}` THEN backend SHALL update class dengan ID tersebut (atau frontend harus memanggil `/attendance/classes/{class}`)

2.8 WHEN frontend memanggil `POST /lesson-schedules` THEN backend SHALL menyimpan lesson schedule (atau frontend harus memanggil `/attendance/schedules`)

**3. QR Scan Payload Consistency**

2.9 WHEN frontend mengirim QR scan request THEN payload structure harus match dengan yang diexpect backend (baik frontend kirim `{ code, type }` atau backend terima `{ qr_code }`)

**4. HTTP Method Consistency**

2.10 WHEN frontend memanggil endpoint untuk update settings THEN HTTP method harus konsisten (baik frontend pakai PUT atau backend terima POST)

2.11 WHEN frontend memanggil endpoint untuk check WA connection THEN HTTP method harus konsisten (baik frontend pakai GET atau backend terima POST)

**5. Student Attendance Page Logic Fix**

2.12 WHEN StudentAttendancePage memproses `existingRecords` dari API THEN code SHALL parse data dari `r.logs` array dengan benar untuk mengakses `student_id` dan `status`

2.13 WHEN StudentAttendancePage mencoba menampilkan existing attendance data THEN data SHALL ditampilkan dengan benar sesuai dengan structure dari backend

**6. Scanner PIN Validation**

2.14 WHEN user memasukkan PIN di QrScannerPage THEN PIN SHALL divalidasi ke backend untuk memastikan hanya user yang authorized yang bisa akses scanner mode

**7. Menu Navigation**

2.15 WHEN user login ke aplikasi THEN SHALL ada menu/link untuk akses fitur attendance di sidebar/navigation sehingga user bisa akses fitur dengan mudah

**8. Geolocation Tracking & Validation**

2.16 WHEN user melakukan absensi (guru atau siswa) via QR scanner atau manual input THEN sistem SHALL merekam lokasi GPS (latitude/longitude) menggunakan browser Geolocation API

2.17 WHEN sistem merekam absensi dengan lokasi GPS THEN sistem SHALL memvalidasi bahwa lokasi user berada dalam radius yang ditentukan dari koordinat sekolah (geofencing validation)

2.18 WHEN operator melihat laporan absensi THEN sistem SHALL menampilkan informasi lokasi GPS yang terekam untuk setiap record absensi, memungkinkan verifikasi keaslian absensi

2.19 WHEN sekolah mengakses pengaturan attendance THEN SHALL ada opsi untuk mengaktifkan/nonaktifkan geolocation tracking, mengatur koordinat sekolah (latitude/longitude), dan menentukan radius geofencing dalam meter

### Unchanged Behavior (Regression Prevention)

**1. Teacher Attendance**

3.1 WHEN frontend memanggil `GET /attendance/teacher` atau `POST /attendance/teacher` THEN system SHALL CONTINUE TO berfungsi dengan benar karena endpoint sudah match

**2. Student Report**

3.2 WHEN frontend memanggil `GET /attendance/student-report` THEN system SHALL CONTINUE TO berfungsi dengan benar karena endpoint sudah match

**3. Settings Show**

3.3 WHEN frontend memanggil `GET /attendance/settings` THEN system SHALL CONTINUE TO berfungsi dengan benar karena endpoint sudah match

**4. QR Scan Success Flow**

3.4 WHEN QR scan berhasil memproses teacher attendance THEN system SHALL CONTINUE TO menyimpan data dengan benar dan mengembalikan response sukses

**5. Tenant Scoping**

3.5 WHEN user dengan role `operator` mengakses attendance data THEN system SHALL CONTINUE TO hanya menampilkan data dari `school_id` mereka sendiri (tenant isolation tetap berfungsi)

**6. Authentication**

3.6 WHEN user yang tidak authenticated mencoba akses attendance endpoints THEN system SHALL CONTINUE TO mengembalikan 401 Unauthorized error

**7. Data Validation**

3.7 WHEN frontend mengirim data yang tidak valid (missing required fields, invalid format) THEN backend SHALL CONTINUE TO mengembalikan validation error dengan pesan yang jelas

**8. Existing Attendance Records**

3.8 WHEN ada data attendance yang sudah tersimpan di database THEN data tersebut SHALL CONTINUE TO tetap valid dan tidak corrupt setelah fix diimplementasikan
