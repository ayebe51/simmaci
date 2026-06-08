# Design Document: Absensi Siswa Berbasis QR Code

## Overview

Fitur **Student Attendance QR** memungkinkan operator sekolah dan guru piket mencatat kehadiran siswa per kelas dan mata pelajaran menggunakan QR code yang tercetak di Kartu Tanda Siswa (KTS). Fitur ini merupakan perluasan dari infrastruktur absensi yang sudah ada di SIMMACI — bukan penggantian.

Fitur ini mencakup:
- Mode "Scan QR Siswa" baru di `PublicScannerPage` (halaman publik PIN-protected)
- Penyelesaian mode siswa di `QrScannerPage` (halaman terautentikasi Sanctum)
- Auto-Alpa untuk siswa yang tidak di-scan saat "Selesai & Simpan"
- Edit manual status absensi per siswa dengan badge "Diubah Manual" dan field keterangan
- Daftar sesi absensi dengan filter, pagination, dan badge "Belum Ditinjau"
- Laporan matriks absensi bulanan dengan kode warna per status
- Ketahanan offline: data sesi di-persist ke `localStorage` agar tidak hilang saat koneksi putus
- Lockout PIN client-side setelah 5 percobaan gagal (5 menit)

### Keputusan Desain Utama

1. **Validasi QR di backend, state sesi di frontend**: Endpoint `POST /api/public/attendance/qr-scan` dengan `type=student` hanya memvalidasi QR code (cocokkan `qr_code` kolom, cek `status=Aktif`, cek keanggotaan kelas) dan mengembalikan data siswa. State sesi (siapa sudah hadir, counter, riwayat) dikelola sepenuhnya di memori React — tidak ada round-trip per scan untuk menyimpan status individual. Penyimpanan terjadi sekali saat "Selesai & Simpan".

2. **`updateOrCreate` sebagai idempotency guard**: Penyimpanan log absensi menggunakan `updateOrCreate` berdasarkan `(school_id, class_id, subject_id, tanggal)` — konsisten dengan pola yang sudah ada di `PublicAttendanceController::studentLogStore()`.

3. **`reviewed_at` untuk badge "Belum Ditinjau"**: Kolom nullable `reviewed_at` ditambahkan ke `student_attendance_logs`. Kolom ini di-set saat operator menyimpan edit manual. Badge "Belum Ditinjau" muncul ketika `reviewed_at IS NULL` DAN ada siswa dengan `status=Alpa` dalam `logs`.

4. **PIN lockout client-side**: Karena endpoint publik tidak memiliki session state, lockout diimplementasikan di `localStorage` (key: `pin_lockout_{school_id}`). Laravel `RateLimiter` di backend berfungsi sebagai secondary guard untuk brute-force dari luar browser.

5. **Audio feedback via Web Audio API**: Beep pendek di-generate menggunakan `AudioContext` — tidak memerlukan file audio eksternal, tidak ada dependency tambahan.

6. **Offline persistence via `localStorage`**: Data sesi scan yang sedang berjalan di-serialize ke `localStorage` (key: `scan_session_{school_id}`) setiap kali ada perubahan state. Saat koneksi pulih, tombol "Simpan Data Tertunda" muncul.

7. **Extend `PublicScannerPage` dengan mode baru**: Alih-alih membuat halaman baru, mode "Scan QR Siswa" ditambahkan ke `ModeScreen` yang sudah ada. `ScannerScreen` di-refactor untuk mendukung dua sub-mode: `teacher` (existing) dan `student` (new).

8. **`logs` array diperluas dengan field `manual_edit` dan `scanned_by`**: Setiap elemen `logs` JSON kini mendukung field opsional `manual_edit: boolean` dan `scanned_by: string` untuk audit trail tanpa mengubah skema tabel.

---

## Architecture

### Diagram Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PUBLIC SCANNER (No Auth — PIN Protected)                  │
│              Operator / Guru Piket scan KTS siswa                            │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────────────┐
│                    PublicScannerPage.tsx (React)                              │
│  LoginScreen → ModeScreen → [ManualScreen | ScannerScreen(teacher/student)]  │
│                                                                               │
│  StudentScannerScreen (new sub-mode inside ScannerScreen):                   │
│  - Session config (class, subject, jam_ke, date)                             │
│  - Html5Qrcode camera → POST qr-scan(type=student) per scan                 │
│  - In-memory statusMap: { student_id → AttendanceStatus }                   │
│  - Scan history, counter, audio beep, border flash                           │
│  - localStorage persistence (offline resilience)                             │
│  - "Selesai & Simpan" → POST student-log → SummaryDialog                    │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │ POST /api/public/attendance/qr-scan (type=student)
                               │ POST /api/public/attendance/student-log
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PublicAttendanceController (Laravel)                       │
│  qrScan(type=student) [EXTEND existing method]:                              │
│    1. Validate PIN                                                            │
│    2. Lookup Student by qr_code (case-sensitive, scoped to school_id)        │
│    3. Validate status = 'Aktif'                                               │
│    4. Validate kelas membership (Student.kelas == SchoolClass.nama)          │
│    5. Return { success, student_id, student_name, status }                   │
│  studentLogStore() [EXISTING]: updateOrCreate log with full logs array       │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────────────┐
│                         PostgreSQL Database                                   │
│  student_attendance_logs (extended: +reviewed_at, +soft deletes)             │
│  students (qr_code, status, kelas columns — existing)                        │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATED MANAGEMENT (Sanctum Token)                  │
│              Operator / Admin_Yayasan / Super_Admin                          │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────────────┐
│                    AttendanceController (Laravel)                             │
│  studentLogIndex()   — list + filter + pagination (EXTEND)                   │
│  studentLogShow()    — single log detail with full student list (NEW)        │
│  studentLogUpdate()  — manual edit, sets reviewed_at (NEW)                  │
│  studentLogDestroy() — soft delete (NEW)                                     │
│  studentReport()     — monthly matrix (EXISTING, minor extension)            │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────────────┐
│                    Frontend Management Pages                                  │
│  StudentAttendancePage.tsx      — list + filter + "Belum Ditinjau" badge     │
│  StudentAttendanceEditPage.tsx  — manual edit per sesi (NEW)                 │
│  StudentAttendanceReportPage.tsx— monthly matrix (EXISTING, extended)        │
│  QrScannerPage.tsx              — authenticated scanner (EXTEND siswa mode)  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Alur Scan QR Siswa (Public Scanner)

```
Operator buka /scan → LoginScreen (pilih sekolah + PIN)
         │
         ▼ verifyPin() → success
ModeScreen → pilih "Scan QR Siswa"
         │
         ▼
StudentScannerScreen:
  1. Tampilkan form konfigurasi: kelas, mapel, jam_ke, tanggal
  2. Load daftar siswa kelas → inisialisasi statusMap: { student_id: 'Alpa' }
  3. Persist statusMap + config ke localStorage (key: scan_session_{schoolId})
  4. Operator tekan "Mulai Scan" → Html5Qrcode.start()
         │
         ▼ (setiap QR terbaca, cooldown 2.5s)
  POST /api/public/attendance/qr-scan
  { school_id, pin, code, type: 'student', class_id }
         │
         ├─ 200 success → update statusMap[student_id] = 'Hadir'
         │                 toast sukses, beep, border hijau 1s, update counter
         │
         ├─ 404 not found  → toast error "Siswa tidak ditemukan", border merah 1s
         ├─ 422 inactive   → toast "Siswa tidak aktif: [nama]", border merah 1s
         └─ 422 wrong_class→ toast "Siswa [nama] bukan anggota kelas ini", border merah 1s
         │
         ▼ Operator tekan "Selesai & Simpan"
  POST /api/public/attendance/student-log
  { school_id, pin, class_id, subject_id, tanggal, jam_ke, logs: [...all students] }
         │
         ▼ success → tampilkan SummaryDialog (hadir/sakit/izin/alpa)
                     hapus localStorage session
```

### Alur Edit Manual (Authenticated)

```
Operator login → StudentAttendancePage (list sesi)
  → filter (tanggal, kelas, mapel) → klik "Edit" pada satu sesi
         │
         ▼
StudentAttendanceEditPage:
  GET /api/attendance/student-log/{id}
  → tampilkan tabel semua siswa + status terakhir
  → siswa tanpa qr_code: tampilkan ikon ⚠️
  → operator ubah status via dropdown + isi keterangan
  → badge "Diubah Manual" muncul pada baris yang diubah
         │
         ▼ klik "Simpan Perubahan"
  PUT /api/attendance/student-log/{id}
  { logs: [...updated with manual_edit: true] }
  → backend set reviewed_at = now()
         │
         ▼ success → toast "Absensi berhasil diperbarui"
                     badge "Belum Ditinjau" hilang dari list
```

---

## Components and Interfaces

### Backend Components

#### Controllers (`app/Http/Controllers/Api/`)

| Controller | Method | Status | Perubahan |
|---|---|---|---|
| `PublicAttendanceController` | `qrScan()` | **EXTEND** | Tambah logika `type=student`: lookup by `qr_code` (case-sensitive, scoped to `school_id`), validasi `status=Aktif`, validasi kelas membership |
| `AttendanceController` | `studentLogIndex()` | **EXTEND** | Tambah filter `date_from`, `date_to`, `subject_id`; tambah `reviewed_at` dan `has_unreviewed_alpa` di response; pagination 20/page |
| `AttendanceController` | `studentLogShow()` | **NEW** | GET single log dengan full student list, status, `has_qr_code` flag |
| `AttendanceController` | `studentLogUpdate()` | **NEW** | PUT update `logs` array + set `reviewed_at = now()` |
| `AttendanceController` | `studentLogDestroy()` | **NEW** | Soft delete log |

#### Form Requests (`app/Http/Requests/Attendance/`)

| Request Class | Digunakan Oleh | Status |
|---|---|---|
| `UpdateStudentLogRequest` | `AttendanceController::studentLogUpdate()` | **NEW** |

#### Models (`app/Models/`)

| Model | Perubahan |
|---|---|
| `StudentAttendanceLog` | Tambah `reviewed_at` ke `$fillable` dan cast; tambah `SoftDeletes` trait |

#### Migration

Satu migration baru: `add_reviewed_at_and_softdeletes_to_student_attendance_logs`

```sql
ALTER TABLE student_attendance_logs
  ADD COLUMN reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  ADD COLUMN deleted_at  TIMESTAMP WITH TIME ZONE DEFAULT NULL;

CREATE INDEX idx_sal_reviewed_at ON student_attendance_logs(reviewed_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_sal_deleted_at  ON student_attendance_logs(deleted_at);
CREATE INDEX idx_sal_tanggal     ON student_attendance_logs(tanggal)     WHERE deleted_at IS NULL;
CREATE INDEX idx_sal_class_id    ON student_attendance_logs(class_id)    WHERE deleted_at IS NULL;
```

#### Backend Rate Limiting (Secondary Guard)

Di `app/Http/Controllers/Api/PublicAttendanceController::verifyPin()`, tambahkan Laravel `RateLimiter` sebagai secondary guard:

```php
use Illuminate\Support\Facades\RateLimiter;

$key = 'pin-attempt:' . $request->school_id . ':' . $request->ip();
if (RateLimiter::tooManyAttempts($key, 5)) {
    $seconds = RateLimiter::availableIn($key);
    return response()->json([
        'success' => false,
        'message' => "Terlalu banyak percobaan. Coba lagi dalam {$seconds} detik.",
        'retry_after' => $seconds,
    ], 429);
}
RateLimiter::hit($key, 300); // 5 menit decay
```

---

### Frontend Components

#### Pages (`src/features/attendance/`)

| File | Status | Deskripsi |
|---|---|---|
| `PublicScannerPage.tsx` | **EXTEND** | Tambah `StudentScannerScreen` component; extend `ModeScreen` dengan opsi "Scan QR Siswa" |
| `QrScannerPage.tsx` | **EXTEND** | Lengkapi siswa mode: session state, statusMap, scan history, counter, "Selesai & Simpan" |
| `StudentAttendancePage.tsx` | **EXTEND** | Tambah filter date_from/date_to/subject_id, pagination 20/page, badge "Belum Ditinjau", tombol "Edit" |
| `StudentAttendanceEditPage.tsx` | **NEW** | Edit manual per sesi: tabel siswa, dropdown status, keterangan, badge "Diubah Manual" |
| `StudentAttendanceReportPage.tsx` | **EXTEND** | Perbaikan: loading state, empty state, persentase kehadiran |

#### Components (`src/features/attendance/components/`)

| File | Deskripsi |
|---|---|
| `StudentScannerScreen.tsx` | Komponen scan QR siswa: config form, kamera, statusMap, counter, riwayat, offline persistence |
| `ScanSummaryDialog.tsx` | Dialog ringkasan setelah "Selesai & Simpan": jumlah hadir/sakit/izin/alpa |
| `AttendanceStatusBadge.tsx` | Badge berwarna: Hadir (hijau), Sakit (kuning), Izin (biru), Alpa (merah) |
| `BelumDitinjauBadge.tsx` | Badge "Belum Ditinjau" untuk sesi yang belum di-review |
| `DiubahManualBadge.tsx` | Badge "Diubah Manual" untuk baris siswa yang statusnya diubah manual |
| `StudentQrWarningIcon.tsx` | Ikon ⚠️ untuk siswa tanpa `qr_code` |

#### Hooks (`src/features/attendance/hooks/`)

| File | Deskripsi |
|---|---|
| `useStudentAttendanceLogs.ts` | TanStack Query: list sesi dengan filter dan pagination |
| `useStudentAttendanceLog.ts` | TanStack Query: detail satu sesi dengan full student list |
| `useScanSession.ts` | Custom hook: kelola state sesi scan (statusMap, counter, riwayat, localStorage persistence) |
| `usePinLockout.ts` | Custom hook: kelola lockout PIN (5 attempts → 5 min, stored in localStorage) |
| `useAudioBeep.ts` | Custom hook: generate beep via Web Audio API (`AudioContext`) |
| `useScannerBorderFlash.ts` | Custom hook: flash border hijau/merah selama 1 detik |

#### API Extensions (`src/lib/api.ts`)

Tambahan ke `attendanceApi`:
```typescript
studentLogShow: (id: number) =>
  apiClient.get(`/attendance/student-log/${id}`).then(r => r.data),
studentLogUpdate: (id: number, data: UpdateStudentLogPayload) =>
  apiClient.put(`/attendance/student-log/${id}`, data).then(r => r.data),
studentLogDelete: (id: number) =>
  apiClient.delete(`/attendance/student-log/${id}`).then(r => r.data),
```

Tambahan ke `publicAttendanceApi`:
```typescript
qrScanStudent: (schoolId: number, pin: string, code: string, classId: number) =>
  axios.post(`${API_BASE_URL}/public/attendance/qr-scan`, {
    school_id: schoolId, pin, code, type: 'student', class_id: classId,
  }).then(r => r.data),
```

---

### API Endpoints

#### Public Endpoints (No Auth — PIN Protected)

| Method | Endpoint | Status | Deskripsi |
|---|---|---|---|
| `POST` | `/api/public/attendance/qr-scan` | **EXTEND** | Tambah logika `type=student` |
| `POST` | `/api/public/attendance/student-log` | EXISTING | Simpan log absensi (sudah ada, tidak berubah) |
| `GET` | `/api/public/attendance/students` | EXISTING | Ambil daftar siswa per kelas (sudah ada) |

**Request Body `POST /api/public/attendance/qr-scan` (type=student):**
```json
{
  "school_id": 1,
  "pin": "1234",
  "code": "QR_VALUE_CASE_SENSITIVE",
  "type": "student",
  "class_id": 5
}
```

**Response sukses (200):**
```json
{
  "success": true,
  "message": "Ahmad Fauzi — Hadir",
  "student_id": 42,
  "student_name": "Ahmad Fauzi",
  "status": "Aktif"
}
```

**Response error — siswa tidak ditemukan (404):**
```json
{
  "success": false,
  "message": "Siswa tidak ditemukan di sekolah ini",
  "error_type": "not_found"
}
```

**Response error — siswa tidak aktif (422):**
```json
{
  "success": false,
  "message": "Siswa tidak aktif: Ahmad Fauzi",
  "error_type": "inactive_student"
}
```

**Response error — bukan anggota kelas (422):**
```json
{
  "success": false,
  "message": "Siswa Ahmad Fauzi bukan anggota kelas ini",
  "error_type": "wrong_class"
}
```

#### Authenticated Endpoints (auth:sanctum)

| Method | Endpoint | Status | Deskripsi |
|---|---|---|---|
| `GET` | `/api/attendance/student-log` | **EXTEND** | Tambah filter `date_from`, `date_to`, `subject_id`; pagination 20/page; `reviewed_at` di response |
| `GET` | `/api/attendance/student-log/{id}` | **NEW** | Detail satu sesi + full student list |
| `PUT` | `/api/attendance/student-log/{id}` | **NEW** | Update logs array + set `reviewed_at` |
| `DELETE` | `/api/attendance/student-log/{id}` | **NEW** | Soft delete sesi |
| `GET` | `/api/attendance/student-report` | EXISTING | Monthly matrix report |

**Response `GET /api/attendance/student-log` (extended):**
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": 1,
        "tanggal": "2025-01-15",
        "class_id": 5,
        "class_name": "VII A",
        "subject_id": 3,
        "subject_name": "Matematika",
        "jam_ke": 2,
        "hadir_count": 28,
        "alpa_count": 2,
        "reviewed_at": null,
        "has_unreviewed_alpa": true
      }
    ],
    "current_page": 1,
    "per_page": 20,
    "total": 45
  }
}
```

**Response `GET /api/attendance/student-log/{id}`:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "tanggal": "2025-01-15",
    "class_id": 5,
    "class_name": "VII A",
    "subject_id": 3,
    "subject_name": "Matematika",
    "jam_ke": 2,
    "reviewed_at": null,
    "logs": [
      {
        "student_id": 42,
        "student_name": "Ahmad Fauzi",
        "nisn": "1234567890",
        "has_qr_code": true,
        "status": "Hadir",
        "keterangan": null,
        "manual_edit": false,
        "scanned_by": "Scanner Publik"
      },
      {
        "student_id": 43,
        "student_name": "Budi Santoso",
        "nisn": "0987654321",
        "has_qr_code": false,
        "status": "Alpa",
        "keterangan": null,
        "manual_edit": false,
        "scanned_by": "Scanner Publik"
      }
    ]
  }
}
```

**Request Body `PUT /api/attendance/student-log/{id}`:**
```json
{
  "logs": [
    {
      "student_id": 43,
      "status": "Sakit",
      "keterangan": "Demam, ada surat dokter",
      "manual_edit": true
    }
  ]
}
```

---

## Data Models

### Perubahan Tabel `student_attendance_logs`

Tabel ini sudah ada. Hanya dua kolom baru yang ditambahkan via migration:

```sql
-- Migration: add_reviewed_at_and_softdeletes_to_student_attendance_logs
ALTER TABLE student_attendance_logs
  ADD COLUMN reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  ADD COLUMN deleted_at  TIMESTAMP WITH TIME ZONE DEFAULT NULL;
```

**Eloquent Model `StudentAttendanceLog` (updated):**
```php
use SoftDeletes; // tambahkan trait

protected $fillable = [
    'school_id', 'class_id', 'subject_id', 'tanggal', 'jam_ke',
    'logs', 'latitude', 'longitude', 'location_verified',
    'reviewed_at', // baru
];

protected function casts(): array {
    return [
        'logs'        => 'array',
        'reviewed_at' => 'datetime',
    ];
}
```

### Struktur `logs` JSON Array (Extended)

Setiap elemen array `logs` mendukung field berikut (backward-compatible — field baru opsional):

```typescript
interface LogEntry {
  student_id: number;       // required — FK ke students.id
  status: 'Hadir' | 'Sakit' | 'Izin' | 'Alpa'; // required
  keterangan?: string;      // opsional, max 255 karakter
  manual_edit?: boolean;    // true jika diubah via edit manual
  scanned_by?: string;      // "Scanner Publik" atau nama operator
}
```

Contoh `logs` setelah sesi scan + edit manual:
```json
[
  { "student_id": 42, "status": "Hadir", "scanned_by": "Scanner Publik" },
  { "student_id": 43, "status": "Sakit", "keterangan": "Demam", "manual_edit": true, "scanned_by": "Scanner Publik" },
  { "student_id": 44, "status": "Alpa", "scanned_by": "Scanner Publik" }
]
```

### TypeScript Types (`src/features/attendance/types/studentAttendance.types.ts`)

```typescript
export type AttendanceStatus = 'Hadir' | 'Sakit' | 'Izin' | 'Alpa';

export interface LogEntry {
  student_id: number;
  student_name?: string;    // populated by backend on GET detail
  nisn?: string;            // populated by backend on GET detail
  has_qr_code?: boolean;    // populated by backend on GET detail
  status: AttendanceStatus;
  keterangan?: string;
  manual_edit?: boolean;
  scanned_by?: string;
}

export interface StudentAttendanceLog {
  id: number;
  school_id: number;
  class_id: number;
  class_name?: string;
  subject_id: number;
  subject_name?: string;
  tanggal: string;          // YYYY-MM-DD
  jam_ke?: number;
  logs: LogEntry[];
  reviewed_at: string | null;
  has_unreviewed_alpa?: boolean; // computed by backend
  hadir_count?: number;
  alpa_count?: number;
  created_at: string;
  updated_at: string;
}

export interface ScanSession {
  schoolId: number;
  schoolName: string;
  pin: string;
  classId: number;
  className: string;
  subjectId: number;
  subjectName: string;
  jamKe?: number;
  tanggal: string;
  statusMap: Record<number, AttendanceStatus>; // student_id → status
  scanHistory: ScanHistoryEntry[];
  savedAt?: string;
}

export interface ScanHistoryEntry {
  studentId: number;
  studentName: string;
  status: AttendanceStatus;
  time: string; // HH:MM:SS
}

export interface StudentAttendanceListParams {
  date_from?: string;
  date_to?: string;
  class_id?: number;
  subject_id?: number;
  page?: number;
  per_page?: number;
}

export interface QrScanStudentResponse {
  success: boolean;
  message: string;
  student_id?: number;
  student_name?: string;
  status?: string;
  error_type?: 'not_found' | 'inactive_student' | 'wrong_class' | 'invalid_pin';
}

export interface UpdateStudentLogPayload {
  logs: Array<{
    student_id: number;
    status: AttendanceStatus;
    keterangan?: string;
    manual_edit: true;
  }>;
}
```

### localStorage Schema

```typescript
// Key: `scan_session_${schoolId}`
// Persisted setiap kali statusMap berubah
interface PersistedScanSession {
  version: 1;
  schoolId: number;
  schoolName: string;
  classId: number;
  className: string;
  subjectId: number;
  subjectName: string;
  jamKe?: number;
  tanggal: string;
  statusMap: Record<string, AttendanceStatus>; // string keys for JSON serialization
  scanHistory: ScanHistoryEntry[];
  lastUpdated: string; // ISO timestamp
}

// Key: `pin_lockout_${schoolId}`
interface PinLockout {
  failedAttempts: number;
  lockedUntil: string | null; // ISO timestamp, null if not locked
}
```

---

## Correctness Properties

*A property adalah karakteristik atau perilaku yang harus berlaku di semua eksekusi valid sistem — pernyataan formal tentang apa yang harus dilakukan sistem. Properties menjembatani spesifikasi yang dapat dibaca manusia dengan jaminan kebenaran yang dapat diverifikasi mesin.*

### Property 1: QR Matching adalah Case-Sensitive dan School-Scoped

*For any* nilai QR code dan `school_id`, sistem SHALL hanya mengembalikan siswa yang memiliki nilai `qr_code` yang identik secara karakter (case-sensitive) DAN memiliki `school_id` yang sama. Siswa dari sekolah lain dengan QR yang sama, atau siswa dari sekolah yang sama dengan QR yang berbeda kapitalisasi, tidak boleh ditemukan.

**Validates: Requirements 2.2, 9.1**

---

### Property 2: Validasi QR Berjalan Secara Berurutan

*For any* QR code yang di-scan, sistem SHALL menjalankan validasi dalam urutan yang ketat: (1) cocokkan `qr_code` dengan `school_id` → jika gagal, kembalikan "tidak ditemukan"; (2) validasi `status = 'Aktif'` → jika gagal, kembalikan "siswa tidak aktif"; (3) validasi keanggotaan kelas → jika gagal, kembalikan "bukan anggota kelas ini". Langkah berikutnya tidak boleh dijalankan jika langkah sebelumnya gagal.

**Validates: Requirements 9.3, 9.4, 9.5, 9.6**

---

### Property 3: Inisialisasi Sesi — Semua Siswa Dimulai dengan Status Alpa

*For any* kelas dengan N siswa aktif, ketika sesi scan dimulai, `statusMap` SHALL diinisialisasi dengan tepat N entri di mana setiap nilai adalah `'Alpa'`. Tidak ada siswa yang boleh dimulai dengan status selain `'Alpa'`.

**Validates: Requirements 10.3**

---

### Property 4: Scan Berhasil Mengubah Status Menjadi Hadir

*For any* siswa yang ada dalam `statusMap` sesi aktif, ketika QR code siswa tersebut berhasil divalidasi oleh backend, status siswa tersebut dalam `statusMap` SHALL diperbarui menjadi `'Hadir'` dalam waktu ≤1 detik. Status siswa lain dalam `statusMap` tidak boleh berubah.

**Validates: Requirements 2.3, 10.4**

---

### Property 5: Scan Duplikat adalah Idempoten

*For any* siswa yang sudah berstatus `'Hadir'` dalam `statusMap`, melakukan scan ulang QR code siswa tersebut SHALL tidak mengubah `statusMap` — status tetap `'Hadir'` dan tidak ada entri duplikat yang ditambahkan ke riwayat scan.

**Validates: Requirements 2.5**

---

### Property 6: Penyimpanan Log adalah Idempoten (updateOrCreate)

*For any* kombinasi `(school_id, class_id, subject_id, tanggal)`, memanggil `studentLogStore` dua kali dengan data yang berbeda SHALL menghasilkan tepat satu record `StudentAttendanceLog` di database — bukan dua record. Pemanggilan kedua memperbarui record yang ada.

**Validates: Requirements 3.3**

---

### Property 7: Auto-Alpa — Kelengkapan Logs saat Simpan

*For any* kelas dengan N siswa aktif, ketika "Selesai & Simpan" ditekan, array `logs` yang disimpan SHALL mengandung tepat N entri — satu per siswa. Setiap siswa yang tidak di-scan (statusnya masih `'Alpa'` di `statusMap`) SHALL tersimpan dengan `status: 'Alpa'`. Tidak ada siswa yang boleh hilang dari logs.

**Validates: Requirements 3.1, 3.2**

---

### Property 8: Lockout PIN Aktif Setelah 5 Percobaan Gagal

*For any* jumlah percobaan PIN yang gagal N, jika N ≥ 5 maka sistem SHALL menolak semua percobaan PIN berikutnya dan menampilkan pesan lockout hingga 5 menit berlalu sejak percobaan ke-5. Jika N < 5, sistem SHALL mengizinkan percobaan berikutnya.

**Validates: Requirements 5.4**

---

### Property 9: Persistensi Sesi Scan ke localStorage adalah Round-Trip

*For any* state sesi scan (statusMap, scanHistory, config), melakukan serialisasi ke `localStorage` dan kemudian deserialisasi SHALL menghasilkan state yang ekuivalen — semua student_id, status, dan riwayat scan harus terpulihkan dengan benar setelah page refresh.

**Validates: Requirements 16.1**

---

## Error Handling

### Backend Error Responses

| Kondisi | HTTP Status | `error_type` | Pesan |
|---|---|---|---|
| PIN tidak valid | 401 | `invalid_pin` | "PIN tidak valid. Silakan login ulang." |
| Terlalu banyak percobaan PIN | 429 | `rate_limited` | "Terlalu banyak percobaan. Coba lagi dalam X detik." |
| QR tidak cocok dengan siswa manapun | 404 | `not_found` | "Siswa tidak ditemukan di sekolah ini" |
| Siswa ditemukan tapi tidak aktif | 422 | `inactive_student` | "Siswa tidak aktif: [nama]" |
| Siswa aktif tapi bukan anggota kelas | 422 | `wrong_class` | "Siswa [nama] bukan anggota kelas ini" |
| QR kosong atau tidak dapat diparse | — | — | Diabaikan di frontend (tidak dikirim ke backend) |
| Server error (5xx) | 500 | `server_error` | "Terjadi kesalahan pada server. Silakan coba lagi." |
| Log tidak ditemukan (GET/PUT/DELETE) | 404 | `not_found` | "Data absensi tidak ditemukan." |
| Akses ditolak (school_id berbeda) | 403 | `forbidden` | "Anda tidak memiliki akses ke data ini." |

### Frontend Error Handling

**Sesi Scan (`StudentScannerScreen`):**
- Kamera tidak dapat diakses → tampilkan pesan "Gagal membuka kamera. Periksa izin browser." + tombol "Gunakan Mode Manual"
- QR scan error (404/422) → toast error + border merah 1s, lanjutkan scan tanpa menghentikan kamera
- Penyimpanan gagal → pertahankan data di memori + localStorage, tampilkan tombol "Coba Lagi"
- Koneksi terputus → tampilkan banner "Mode Offline" + jumlah scan tertunda, data tetap di localStorage

**Edit Manual (`StudentAttendanceEditPage`):**
- Load gagal → tampilkan error state dengan tombol "Muat Ulang"
- Simpan gagal → pertahankan perubahan di form, tampilkan Sonner toast error
- Tidak ada perubahan → tampilkan pesan "Tidak ada perubahan yang perlu disimpan"

**PIN Lockout:**
- Setelah 5 gagal → disable input PIN + tampilkan countdown timer
- Setelah 5 menit → reset lockout, aktifkan kembali input

### Tenant Isolation

Semua endpoint `auth:sanctum` menggunakan `HasTenantScope` yang otomatis membatasi query ke `school_id` milik user yang login. Untuk endpoint publik, `school_id` dikirim dalam request body dan divalidasi secara eksplisit. Operator tidak dapat mengakses atau memodifikasi data sekolah lain — backend mengembalikan 403 jika `school_id` tidak cocok.

---

## Testing Strategy

### Unit Tests

**Backend (PHPUnit):**
- `StudentQrValidationTest`: validasi urutan (QR match → status → kelas), case-sensitivity, school scoping
- `StudentAttendanceLogTest`: `updateOrCreate` idempotency, `reviewed_at` di-set saat update, soft delete
- `PinRateLimitTest`: lockout setelah 5 gagal via `RateLimiter`, reset setelah 5 menit

**Frontend (Vitest):**
- `useScanSession.test.ts`: inisialisasi statusMap, update saat scan berhasil, idempotence duplikat scan
- `usePinLockout.test.ts`: threshold 5 attempts, lockout duration, reset
- `scanSessionPersistence.test.ts`: serialisasi/deserialisasi localStorage round-trip
- `useAudioBeep.test.ts`: AudioContext dipanggil dengan durasi ≤500ms

### Property-Based Tests

Property-based testing menggunakan **fast-check** (TypeScript) untuk frontend dan **PHPUnit** untuk backend.

Setiap property test dikonfigurasi dengan minimum **100 iterasi**.

Tag format: `Feature: student-attendance-qr, Property {N}: {property_text}`

**Property 1 — QR Matching Case-Sensitive & School-Scoped** (`Feature: student-attendance-qr, Property 1`):
- Generator: random QR strings (alphanumeric + special chars), random school_ids
- Verifikasi: lookup dengan QR yang sama tapi berbeda case → tidak ditemukan; lookup dengan school_id berbeda → tidak ditemukan

**Property 2 — Sequential Validation** (`Feature: student-attendance-qr, Property 2`):
- Generator: random student records dengan kombinasi (valid QR, inactive status, wrong class)
- Verifikasi: urutan error response sesuai — tidak pernah melewati step yang gagal

**Property 3 — Inisialisasi Alpa** (`Feature: student-attendance-qr, Property 3`):
- Generator: random list siswa (1–50 siswa)
- Verifikasi: setelah `initStatusMap(students)`, semua nilai dalam map adalah `'Alpa'`

**Property 4 — Scan Mengubah Status** (`Feature: student-attendance-qr, Property 4`):
- Generator: random statusMap + random student_id yang ada di map
- Verifikasi: setelah `markPresent(studentId)`, hanya `statusMap[studentId]` yang berubah ke `'Hadir'`

**Property 5 — Scan Duplikat Idempoten** (`Feature: student-attendance-qr, Property 5`):
- Generator: random statusMap dengan beberapa siswa sudah `'Hadir'`
- Verifikasi: `markPresent(studentId)` dua kali → statusMap tidak berubah, scanHistory tidak bertambah

**Property 6 — updateOrCreate Idempoten** (`Feature: student-attendance-qr, Property 6`):
- Generator: random (school_id, class_id, subject_id, tanggal) + random logs array
- Verifikasi: dua kali POST ke `student-log` → COUNT(*) tetap 1, data adalah yang terbaru

**Property 7 — Auto-Alpa Kelengkapan** (`Feature: student-attendance-qr, Property 7`):
- Generator: random list siswa (1–50), random subset yang di-scan
- Verifikasi: `buildLogsForSave(students, statusMap)` menghasilkan array dengan panjang = jumlah siswa, semua siswa ada

**Property 8 — PIN Lockout** (`Feature: student-attendance-qr, Property 8`):
- Generator: random sequence percobaan PIN (benar/salah)
- Verifikasi: setelah 5 gagal berturut-turut, semua percobaan berikutnya ditolak hingga 5 menit berlalu

**Property 9 — localStorage Round-Trip** (`Feature: student-attendance-qr, Property 9`):
- Generator: random ScanSession objects (berbagai ukuran statusMap dan scanHistory)
- Verifikasi: `JSON.parse(JSON.stringify(session))` menghasilkan objek yang deep-equal dengan original

### Integration Tests

**Backend (PHPUnit Feature Tests):**
- `StudentAttendanceQrScanTest`: full flow scan QR siswa via `POST /api/public/attendance/qr-scan`
- `StudentAttendanceLogCrudTest`: CRUD operations pada `student-log` endpoint dengan auth
- `StudentAttendanceReportTest`: monthly matrix report dengan data yang benar

**Frontend (Playwright E2E):**
- Scan QR siswa flow: login PIN → pilih kelas/mapel → scan → selesai & simpan → verifikasi summary
- Edit manual flow: login → buka sesi → ubah status → simpan → verifikasi badge hilang
