# Implementation Plan: Absensi Siswa Berbasis QR Code

## Overview

Fitur ini memperluas infrastruktur absensi yang sudah ada di SIMMACI untuk mendukung scan QR code dari Kartu Tanda Siswa (KTS). Implementasi mencakup: migration database, ekstensi backend controller, TypeScript types, custom hooks, komponen UI baru, halaman baru, dan ekstensi halaman yang sudah ada. Semua kode baru mengikuti pola multi-tenancy (`school_id` scoping), `ApiResponse` trait, dan konvensi TanStack Query yang berlaku di proyek ini.

---

## Tasks

- [ ] 1. Database Migration dan Model Update
  - [ ] 1.1 Buat migration `add_reviewed_at_and_softdeletes_to_student_attendance_logs`
    - Tambahkan kolom `reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL`
    - Tambahkan kolom `deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL`
    - Tambahkan partial index `idx_sal_reviewed_at` pada `reviewed_at WHERE deleted_at IS NULL`
    - Tambahkan index `idx_sal_deleted_at` pada `deleted_at`
    - Tambahkan partial index `idx_sal_tanggal` pada `tanggal WHERE deleted_at IS NULL`
    - Tambahkan partial index `idx_sal_class_id` pada `class_id WHERE deleted_at IS NULL`
    - File: `backend/database/migrations/{timestamp}_add_reviewed_at_and_softdeletes_to_student_attendance_logs.php`
    - _Requirements: 3.3, 4.4, 7.5, 17.4_

  - [ ] 1.2 Update model `StudentAttendanceLog`
    - Tambahkan `use SoftDeletes;` trait
    - Tambahkan `reviewed_at` ke `$fillable`
    - Tambahkan cast `'reviewed_at' => 'datetime'` di method `casts()`
    - File: `backend/app/Models/StudentAttendanceLog.php`
    - _Requirements: 13.1, 17.4_

- [ ] 2. Backend — Form Request dan Rate Limiter
  - [ ] 2.1 Buat `UpdateStudentLogRequest`
    - Validasi `logs` sebagai required array
    - Setiap elemen `logs` harus memiliki `student_id` (integer), `status` (in: Hadir,Sakit,Izin,Alpa), `keterangan` (nullable string max:255), `manual_edit` (boolean)
    - File: `backend/app/Http/Requests/Attendance/UpdateStudentLogRequest.php`
    - _Requirements: 4.2, 4.6_

  - [ ] 2.2 Tambahkan Laravel `RateLimiter` ke `PublicAttendanceController::verifyPin()`
    - Key: `pin-attempt:{school_id}:{ip}`
    - Maksimal 5 percobaan, decay 300 detik (5 menit)
    - Return 429 dengan `retry_after` jika terlalu banyak percobaan
    - File: `backend/app/Http/Controllers/Api/PublicAttendanceController.php`
    - _Requirements: 5.4_

- [ ] 3. Backend — Ekstensi `PublicAttendanceController::qrScan()` untuk Siswa
  - [ ] 3.1 Tambahkan logika `type=student` ke method `qrScan()` yang sudah ada
    - Validasi request: tambahkan `class_id` sebagai required integer ketika `type=student`
    - Langkah 1: Lookup `Student` by `qr_code` (case-sensitive, `where school_id = $schoolId`)
    - Langkah 2: Jika tidak ditemukan, return 404 dengan `error_type: not_found`
    - Langkah 3: Validasi `student->status === 'Aktif'`; jika tidak, return 422 dengan `error_type: inactive_student`
    - Langkah 4: Validasi keanggotaan kelas (`student->kelas === SchoolClass->nama`); jika tidak, return 422 dengan `error_type: wrong_class`
    - Langkah 5: Return 200 dengan `student_id`, `student_name`, `status`
    - File: `backend/app/Http/Controllers/Api/PublicAttendanceController.php`
    - _Requirements: 2.2, 2.3, 2.4, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [ ]* 3.2 Tulis property test untuk validasi QR siswa (Property 1 & 2)
    - **Property 1: QR Matching adalah Case-Sensitive dan School-Scoped**
    - **Validates: Requirements 2.2, 9.1**
    - **Property 2: Validasi QR Berjalan Secara Berurutan**
    - **Validates: Requirements 9.3, 9.4, 9.5, 9.6**
    - File: `backend/tests/Unit/Services/StudentQrValidationTest.php`
    - Gunakan PHPUnit dengan data provider untuk berbagai kombinasi QR, school_id, status, kelas

- [ ] 4. Backend — Ekstensi `AttendanceController` (studentLogIndex, Show, Update, Destroy)
  - [ ] 4.1 Ekstensi `AttendanceController::studentLogIndex()` dengan filter dan pagination
    - Tambahkan filter `date_from` dan `date_to` (rentang tanggal)
    - Tambahkan filter `subject_id`
    - Ubah pagination dari 50 menjadi 20 per halaman
    - Tambahkan computed field `has_unreviewed_alpa` di response (true jika `reviewed_at IS NULL` dan ada entry `status=Alpa` dalam `logs`)
    - Tambahkan `reviewed_at`, `hadir_count`, `alpa_count`, `class_name`, `subject_name` di response
    - File: `backend/app/Http/Controllers/Api/AttendanceController.php`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ] 4.2 Buat `AttendanceController::studentLogShow()`
    - GET single `StudentAttendanceLog` by ID dengan tenant scope
    - Load semua siswa di kelas tersebut dan merge dengan data `logs` yang tersimpan
    - Setiap entry di response harus memiliki: `student_id`, `student_name`, `nisn`, `has_qr_code` (bool: `qr_code` tidak null dan tidak kosong), `status`, `keterangan`, `manual_edit`, `scanned_by`
    - Return 403 jika `school_id` tidak cocok dengan user yang login
    - File: `backend/app/Http/Controllers/Api/AttendanceController.php`
    - _Requirements: 4.1, 12.1, 12.3, 6.4_

  - [ ] 4.3 Buat `AttendanceController::studentLogUpdate()`
    - PUT update array `logs` pada record `StudentAttendanceLog`
    - Set `reviewed_at = now()` setelah update berhasil
    - Gunakan `UpdateStudentLogRequest` untuk validasi
    - Return 403 jika `school_id` tidak cocok
    - File: `backend/app/Http/Controllers/Api/AttendanceController.php`
    - _Requirements: 4.3, 4.4, 4.5, 6.4, 17.2_

  - [ ] 4.4 Buat `AttendanceController::studentLogDestroy()`
    - Soft delete `StudentAttendanceLog` by ID dengan tenant scope
    - Return 403 jika `school_id` tidak cocok
    - File: `backend/app/Http/Controllers/Api/AttendanceController.php`
    - _Requirements: 6.4, 17.4_

  - [ ]* 4.5 Tulis unit test untuk `StudentAttendanceLog` model dan controller methods
    - Test `updateOrCreate` idempotency (Property 6)
    - **Property 6: Penyimpanan Log adalah Idempoten (updateOrCreate)**
    - **Validates: Requirements 3.3**
    - Test `reviewed_at` di-set saat `studentLogUpdate()` dipanggil
    - Test soft delete tidak menghapus record secara permanen
    - File: `backend/tests/Unit/Services/StudentAttendanceLogTest.php`

- [ ] 5. Backend — Routes Baru dan Rate Limiter Test
  - [ ] 5.1 Daftarkan routes baru di `routes/api.php`
    - `GET /api/attendance/student-log/{id}` → `AttendanceController::studentLogShow`
    - `PUT /api/attendance/student-log/{id}` → `AttendanceController::studentLogUpdate`
    - `DELETE /api/attendance/student-log/{id}` → `AttendanceController::studentLogDestroy`
    - Semua route di dalam group `auth:sanctum` + `tenant` middleware yang sudah ada
    - File: `backend/routes/api.php`
    - _Requirements: 6.3, 13.3, 14.2_

  - [ ]* 5.2 Tulis unit test untuk PIN rate limiter
    - Test lockout setelah 5 percobaan gagal (Property 8)
    - **Property 8: Lockout PIN Aktif Setelah 5 Percobaan Gagal**
    - **Validates: Requirements 5.4**
    - Test reset setelah 5 menit (mock `RateLimiter`)
    - File: `backend/tests/Unit/Services/PinRateLimitTest.php`

- [ ] 6. Checkpoint — Backend
  - Jalankan `php artisan migrate` untuk memastikan migration berjalan tanpa error
  - Jalankan `php artisan test` untuk memastikan semua test backend lulus
  - Pastikan tidak ada regresi pada endpoint yang sudah ada

- [ ] 7. Frontend — TypeScript Types
  - [ ] 7.1 Buat file `src/features/attendance/types/studentAttendance.types.ts`
    - Definisikan: `AttendanceStatus`, `LogEntry`, `StudentAttendanceLog`, `ScanSession`, `ScanHistoryEntry`, `StudentAttendanceListParams`, `QrScanStudentResponse`, `UpdateStudentLogPayload`
    - Definisikan: `PersistedScanSession` (localStorage schema dengan `version: 1`)
    - Definisikan: `PinLockout` (localStorage schema)
    - Sesuai dengan spesifikasi di design.md section "TypeScript Types"
    - _Requirements: 13.1_

- [ ] 8. Frontend — API Extensions
  - [ ] 8.1 Tambahkan method baru ke `attendanceApi` di `src/lib/api.ts`
    - `studentLogShow(id: number)` → GET `/attendance/student-log/{id}`
    - `studentLogUpdate(id: number, data: UpdateStudentLogPayload)` → PUT `/attendance/student-log/{id}`
    - `studentLogDelete(id: number)` → DELETE `/attendance/student-log/{id}`
    - Update `studentLogIndex` untuk mendukung parameter `date_from`, `date_to`, `subject_id`, `page`, `per_page`
    - File: `src/lib/api.ts`
    - _Requirements: 13.3, 13.6_

  - [ ] 8.2 Tambahkan method baru ke `publicAttendanceApi` di `src/lib/api.ts`
    - `qrScanStudent(schoolId, pin, code, classId)` → POST `/public/attendance/qr-scan` dengan `type: 'student'`
    - File: `src/lib/api.ts`
    - _Requirements: 13.2_

- [ ] 9. Frontend — Custom Hooks
  - [ ] 9.1 Buat `src/features/attendance/hooks/usePinLockout.ts`
    - Kelola state lockout PIN di `localStorage` (key: `pin_lockout_{schoolId}`)
    - Expose: `failedAttempts`, `isLocked`, `lockedUntil`, `recordFailedAttempt()`, `resetLockout()`
    - Lockout setelah 5 percobaan gagal selama 5 menit
    - _Requirements: 5.4_

  - [ ] 9.2 Buat `src/features/attendance/hooks/useAudioBeep.ts`
    - Generate beep pendek (≤500ms) menggunakan `AudioContext` Web API
    - Expose: `playSuccessBeep()`, `playErrorBeep()`
    - Tidak memerlukan file audio eksternal
    - _Requirements: 11.4_

  - [ ] 9.3 Buat `src/features/attendance/hooks/useScannerBorderFlash.ts`
    - Kelola state warna border area scanner
    - Expose: `borderColor`, `flashSuccess()` (hijau 1 detik), `flashError()` (merah 1 detik)
    - _Requirements: 11.5, 11.6_

  - [ ] 9.4 Buat `src/features/attendance/hooks/useScanSession.ts`
    - Kelola state sesi scan: `statusMap`, `scanHistory`, `config`
    - Persist ke `localStorage` (key: `scan_session_{schoolId}`) setiap kali `statusMap` berubah
    - Expose: `initStatusMap(students)`, `markPresent(studentId, studentName)`, `restoreSession()`, `clearSession()`
    - Expose: `hadirCount`, `totalCount`, `buildLogsForSave()`
    - _Requirements: 2.3, 2.5, 2.7, 2.8, 3.1, 10.3, 10.4, 16.1_

  - [ ]* 9.5 Tulis unit tests untuk hooks
    - `useScanSession`: inisialisasi statusMap semua Alpa (Property 3), update saat scan berhasil (Property 4), idempotence duplikat scan (Property 5), localStorage round-trip (Property 9)
    - **Property 3: Inisialisasi Sesi — Semua Siswa Dimulai dengan Status Alpa**
    - **Validates: Requirements 10.3**
    - **Property 4: Scan Berhasil Mengubah Status Menjadi Hadir**
    - **Validates: Requirements 2.3, 10.4**
    - **Property 5: Scan Duplikat adalah Idempoten**
    - **Validates: Requirements 2.5**
    - **Property 9: Persistensi Sesi Scan ke localStorage adalah Round-Trip**
    - **Validates: Requirements 16.1**
    - `usePinLockout`: threshold 5 attempts, lockout duration, reset (Property 8)
    - File: `src/features/attendance/hooks/useScanSession.test.ts`, `src/features/attendance/hooks/usePinLockout.test.ts`

  - [ ] 9.6 Buat `src/features/attendance/hooks/useStudentAttendanceLogs.ts`
    - TanStack Query hook untuk list sesi absensi dengan filter dan pagination
    - Query key: `['student-attendance-logs', params]`
    - Gunakan `attendanceApi.studentLogIndex(params)`
    - _Requirements: 7.1, 7.2, 7.3, 13.7_

  - [ ] 9.7 Buat `src/features/attendance/hooks/useStudentAttendanceLog.ts`
    - TanStack Query hook untuk detail satu sesi absensi
    - Query key: `['student-attendance-log', id]`
    - Gunakan `attendanceApi.studentLogShow(id)`
    - _Requirements: 4.1, 13.7_

- [ ] 10. Frontend — Komponen UI Baru
  - [ ] 10.1 Buat `src/features/attendance/components/AttendanceStatusBadge.tsx`
    - Badge berwarna berdasarkan status: Hadir (emerald), Sakit (yellow), Izin (blue), Alpa (red)
    - Props: `status: AttendanceStatus`
    - _Requirements: 8.4_

  - [ ] 10.2 Buat `src/features/attendance/components/BelumDitinjauBadge.tsx`
    - Badge "Belum Ditinjau" dengan warna oranye/amber
    - Ditampilkan ketika `has_unreviewed_alpa === true`
    - _Requirements: 7.5_

  - [ ] 10.3 Buat `src/features/attendance/components/DiubahManualBadge.tsx`
    - Badge "Diubah Manual" dengan warna ungu/violet
    - Ditampilkan pada baris siswa yang `manual_edit === true`
    - _Requirements: 4.4_

  - [ ] 10.4 Buat `src/features/attendance/components/StudentQrWarningIcon.tsx`
    - Ikon ⚠️ (Lucide `AlertTriangle`) untuk siswa yang `has_qr_code === false`
    - Dengan tooltip "Siswa ini tidak memiliki QR code"
    - _Requirements: 12.3_

  - [ ] 10.5 Buat `src/features/attendance/components/ScanSummaryDialog.tsx`
    - Dialog ringkasan setelah "Selesai & Simpan"
    - Tampilkan jumlah: Hadir, Sakit, Izin, Alpa
    - Props: `open`, `onClose`, `summary: { hadir, sakit, izin, alpa }`
    - _Requirements: 3.4_

  - [ ] 10.6 Buat `src/features/attendance/components/StudentScannerScreen.tsx`
    - Komponen utama scan QR siswa untuk `PublicScannerPage`
    - Form konfigurasi sesi: kelas, mata pelajaran, jam_ke, tanggal (default hari ini, max 30 hari ke belakang)
    - Load daftar siswa kelas → inisialisasi `statusMap` via `useScanSession`
    - Integrasi `Html5Qrcode` dengan cooldown 2,5 detik
    - Per scan: POST `qrScanStudent()` → update statusMap, toast, beep, border flash
    - Counter "X dari Y siswa hadir"
    - Riwayat scan: nama, status, waktu HH:MM:SS
    - Tombol "Selesai & Simpan" → POST `studentLogStore()` → tampilkan `ScanSummaryDialog`
    - Offline persistence: banner "Mode Offline" + tombol "Simpan Data Tertunda"
    - Responsive: single-column portrait (≥280×280px kamera), two-column landscape
    - Tombol aksi minimal 56px tinggi di mobile
    - _Requirements: 1.1–1.9, 2.1–2.10, 3.1–3.6, 5.1–5.7, 10.1–10.6, 11.1–11.7, 15.1–15.6, 16.1–16.6_

- [ ] 11. Frontend — Ekstensi `PublicScannerPage`
  - [ ] 11.1 Tambahkan opsi "Scan QR Siswa" ke `ModeScreen` di `PublicScannerPage.tsx`
    - Tambahkan tombol mode baru dengan ikon `GraduationCap` dan warna violet/purple
    - Update tipe `Screen` untuk mendukung mode `student-scanner`
    - Integrasikan `StudentScannerScreen` sebagai screen baru
    - Tambahkan `usePinLockout` ke `LoginScreen` untuk lockout client-side
    - File: `src/features/attendance/PublicScannerPage.tsx`
    - _Requirements: 5.1–5.7, 13.2, 14.3_

- [ ] 12. Frontend — Ekstensi `QrScannerPage` (Mode Siswa Terautentikasi)
  - [ ] 12.1 Lengkapi mode siswa di `QrScannerPage.tsx`
    - Tambahkan session state: `statusMap`, `scanHistory`, counter
    - Integrasi `useScanSession`, `useAudioBeep`, `useScannerBorderFlash`
    - Form konfigurasi sesi (kelas, mapel, jam_ke, tanggal)
    - Tombol "Selesai & Simpan" → POST `attendanceApi.studentLogStore()` → `ScanSummaryDialog`
    - File: `src/features/attendance/QrScannerPage.tsx`
    - _Requirements: 2.1–2.10, 13.4_

- [ ] 13. Frontend — Halaman Baru `StudentAttendanceEditPage`
  - [ ] 13.1 Buat `src/features/attendance/StudentAttendanceEditPage.tsx`
    - Load data sesi via `useStudentAttendanceLog(id)`
    - Tabel semua siswa dengan kolom: no, nama, NISN, ikon ⚠️ (jika tanpa QR), status (dropdown), keterangan (input text max 255), badge "Diubah Manual"
    - Dropdown status: Hadir, Sakit, Izin, Alpa
    - Track perubahan lokal; badge "Diubah Manual" muncul saat status diubah
    - Tombol "Simpan Perubahan" → PUT `attendanceApi.studentLogUpdate(id, { logs })`
    - Validasi: jika tidak ada perubahan, tampilkan pesan "Tidak ada perubahan yang perlu disimpan"
    - Error handling: pertahankan perubahan di form jika simpan gagal
    - Responsive: tabel dalam container horizontal-scrollable di mobile
    - _Requirements: 4.1–4.8, 12.1–12.5, 15.4_

- [ ] 14. Frontend — Ekstensi `StudentAttendancePage`
  - [ ] 14.1 Refactor `StudentAttendancePage.tsx` menjadi halaman daftar sesi absensi
    - Ganti tampilan form input langsung dengan tabel daftar sesi absensi
    - Kolom tabel: tanggal, kelas, mata pelajaran, jam ke, jumlah hadir, jumlah alpa, `BelumDitinjauBadge`, aksi (tombol "Edit")
    - Filter: date_from, date_to, class_id, subject_id
    - Pagination 20 sesi per halaman menggunakan `useStudentAttendanceLogs`
    - Tombol "Edit" → navigate ke `StudentAttendanceEditPage`
    - Empty state: "Tidak ada data absensi untuk filter yang dipilih"
    - File: `src/features/attendance/StudentAttendancePage.tsx`
    - _Requirements: 7.1–7.7_

- [ ] 15. Frontend — Ekstensi `StudentAttendanceReportPage`
  - [ ] 15.1 Tambahkan loading state dan empty state yang proper ke `StudentAttendanceReportPage.tsx`
    - Loading state: spinner dengan teks "Memuat laporan..."
    - Empty state: pesan "Belum ada data absensi untuk periode ini" ketika `reportData.students.length === 0`
    - Tambahkan kolom persentase kehadiran: `(hadir / total_sesi) × 100%` per siswa
    - File: `src/features/attendance/StudentAttendanceReportPage.tsx`
    - _Requirements: 8.5, 8.6, 8.7_

- [ ] 16. Frontend — Routing
  - [ ] 16.1 Daftarkan route baru di `src/App.tsx`
    - `attendance/student` → `StudentAttendancePage` (daftar sesi — sudah ada, dipertahankan)
    - `attendance/student/:id/edit` → `StudentAttendanceEditPage` (baru, protected)
    - Import `StudentAttendanceEditPage`
    - File: `src/App.tsx`
    - _Requirements: 14.1, 14.2, 14.4_

- [ ] 17. Checkpoint — Frontend
  - Jalankan `npm run build` untuk memastikan tidak ada TypeScript error
  - Jalankan `npm run lint` untuk memastikan tidak ada ESLint error
  - Pastikan semua import menggunakan alias `@/`

- [ ] 18. Tests — Backend Integration
  - [ ]* 18.1 Buat `backend/tests/Feature/StudentAttendanceIntegrationTest.php`
    - Test full flow: POST `qr-scan` (type=student) dengan QR valid → 200
    - Test POST `qr-scan` dengan QR tidak ditemukan → 404
    - Test POST `qr-scan` dengan siswa tidak aktif → 422
    - Test POST `qr-scan` dengan siswa bukan anggota kelas → 422
    - Test GET `student-log` dengan filter date_from/date_to/subject_id
    - Test GET `student-log/{id}` dengan tenant isolation (403 jika school_id berbeda)
    - Test PUT `student-log/{id}` → `reviewed_at` di-set, `manual_edit` tersimpan
    - Test DELETE `student-log/{id}` → soft delete (record masih ada di DB)
    - Test pagination 20 per halaman
    - _Requirements: 6.1–6.6_

- [ ]* 19. Tests — Frontend Unit Tests
  - [ ]* 19.1 Buat unit tests untuk komponen UI
    - `AttendanceStatusBadge`: render warna yang benar untuk setiap status
    - `BelumDitinjauBadge`: render hanya ketika `has_unreviewed_alpa === true`
    - `DiubahManualBadge`: render hanya ketika `manual_edit === true`
    - `StudentQrWarningIcon`: render ikon dan tooltip untuk siswa tanpa QR
    - `ScanSummaryDialog`: tampilkan jumlah yang benar
    - File: `src/features/attendance/components/*.test.tsx`

  - [ ]* 19.2 Tulis property test untuk `buildLogsForSave` (Property 7)
    - **Property 7: Auto-Alpa — Kelengkapan Logs saat Simpan**
    - **Validates: Requirements 3.1, 3.2**
    - Generator: random list siswa (1–50), random subset yang di-scan
    - Verifikasi: output array panjangnya = jumlah siswa, semua siswa ada, yang tidak di-scan berstatus Alpa
    - File: `src/features/attendance/hooks/useScanSession.test.ts`

- [ ] 20. Final Checkpoint — Ensure all tests pass
  - Jalankan `php artisan test` dari direktori `backend/`
  - Jalankan `npm run test -- --run` dari root untuk frontend tests
  - Pastikan semua test lulus, tanyakan kepada user jika ada pertanyaan

---

## Notes

- Tasks bertanda `*` adalah opsional dan dapat dilewati untuk MVP yang lebih cepat
- Setiap task mereferensikan requirement spesifik untuk traceability
- Checkpoint memastikan validasi inkremental sebelum melanjutkan ke fase berikutnya
- Property tests memvalidasi correctness properties universal yang didefinisikan di design.md
- Semua kode backend menggunakan `ApiResponse` trait untuk response shape yang konsisten
- Semua kode frontend menggunakan `@/` alias untuk imports
- `StudentScannerScreen` adalah komponen terbesar — implementasikan secara inkremental (config form → kamera → statusMap → persistence → offline)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "7.1"] },
    { "id": 1, "tasks": ["1.2", "8.1", "8.2"] },
    { "id": 2, "tasks": ["2.1", "2.2", "9.1", "9.2", "9.3", "10.1", "10.2", "10.3", "10.4"] },
    { "id": 3, "tasks": ["3.1", "9.4", "10.5"] },
    { "id": 4, "tasks": ["3.2", "4.1", "9.5", "9.6", "9.7"] },
    { "id": 5, "tasks": ["4.2", "4.3", "4.4", "10.6"] },
    { "id": 6, "tasks": ["4.5", "5.1", "11.1", "12.1"] },
    { "id": 7, "tasks": ["5.2", "13.1", "14.1", "15.1"] },
    { "id": 8, "tasks": ["16.1"] },
    { "id": 9, "tasks": ["18.1", "19.1", "19.2"] }
  ]
}
```
