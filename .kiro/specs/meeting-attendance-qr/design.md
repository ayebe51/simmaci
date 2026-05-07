
# Design Document: Absensi Rapat Yayasan dengan QR Code

## Overview

Fitur **Meeting Attendance QR** memungkinkan Admin_Yayasan dan Super_Admin untuk mengelola rapat tingkat yayasan LP Ma'arif NU Cilacap secara digital — mulai dari pembuatan rapat, distribusi QR code undangan via WhatsApp, hingga pencatatan kehadiran peserta secara real-time.

Fitur ini mencakup:
- CRUD rapat dengan peserta dari berbagai sekolah (kepala sekolah, guru) dan pihak eksternal
- QR_Personal (one-time use, signed URL) per peserta terdaftar
- QR_Umum (multi-use, signed URL) untuk peserta walk-in
- Halaman check-in publik (tanpa autentikasi) dengan validasi signed token, delegasi, dan geolocation opsional
- Keamanan berlapis: signed URL, one-time token, rate limiting, pessimistic locking untuk concurrent check-in
- Device info tracking (IP, browser, OS, device type) tersimpan sebagai JSONB
- Integrasi WA Blast untuk undangan (segera) dan reminder (terjadwal)
- Laporan PDF (PHPWord) dan Excel (Maatwebsite) dengan kolom verifikasi
- Monitoring real-time via polling setiap 10 detik
- Akses read-only untuk Operator yang di-scope ke sekolah mereka

### Keputusan Desain Utama

1. **Cross-tenant model**: `meetings`, `meeting_participants`, dan `meeting_attendances` tidak menggunakan `HasTenantScope` karena rapat melibatkan lintas sekolah. Akses dikontrol via middleware role dan filter manual `school_ids`.
2. **Signed URL sebagai token QR**: Menggunakan `URL::temporarySignedRoute()` Laravel sehingga signature diverifikasi oleh framework tanpa perlu menyimpan token terpisah di database. Token di-store di kolom `qr_token` hanya sebagai referensi untuk one-time use tracking.
3. **Pessimistic locking untuk concurrent check-in**: `SELECT FOR UPDATE` di dalam `DB::transaction()` memastikan race condition tidak menghasilkan duplikasi check-in.
4. **Snapshot data peserta**: Nama, jabatan, dan instansi peserta di-snapshot ke `meeting_participants` saat rapat dibuat, sehingga laporan tetap akurat meskipun data guru berubah.
5. **Halaman check-in publik**: Tidak memerlukan autentikasi Sanctum — dilindungi hanya oleh signed URL Laravel. Ini memungkinkan peserta scan QR dari perangkat apapun tanpa login.
6. **Status rapat sebagai computed property**: Status `upcoming/ongoing/completed` dihitung dari `started_at`/`ended_at` vs waktu saat ini, tidak disimpan sebagai kolom statis, untuk menghindari stale data.
7. **WA Blast reuse**: Undangan dan reminder menggunakan `WaBlastService::createBlast()` yang sudah ada, dengan recipient list yang dikompilasi dari `meeting_participants`.

---

## Architecture

### Diagram Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATED USERS (Sanctum Token)                       │
│              super_admin / admin_yayasan / operator                          │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────────────┐
│                         Middleware Stack                                      │
│  auth:sanctum → [role:super_admin,admin_yayasan untuk write operations]      │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
┌─────────▼──────────┐ ┌───────▼────────┐ ┌────────▼──────────┐
│  MeetingController │ │MeetingReport   │ │  (Operator: read  │
│  - index           │ │Controller      │ │   only, filtered  │
│  - show            │ │  - pdf         │ │   by school_ids)  │
│  - store           │ │  - excel       │ └───────────────────┘
│  - update          │ └───────┬────────┘
│  - destroy         │         │
│  - manualCheckIn   │         │
│  - resetCheckIn    │         │
│  - regenerateQr    │         │
└─────────┬──────────┘         │
          │                    │
┌─────────▼────────────────────▼──────────────────────────────────────────────┐
│                          Service Layer                                        │
│  MeetingService │ MeetingQrService │ MeetingCheckInService │ MeetingReport   │
│                                                              Service          │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
┌─────────▼──────────┐ ┌───────▼────────┐ ┌────────▼──────────┐
│  Meeting           │ │  WaBlastService│ │  PHPWord /         │
│  Repository        │ │  (reuse)       │ │  Maatwebsite Excel │
│  MeetingParticipant│ └───────┬────────┘ └───────────────────┘
│  Repository        │         │
│  MeetingAttendance │         ▼
│  Repository        │  wa_blasts table
└─────────┬──────────┘
          │
┌─────────▼──────────────────────────────────────────────────────────────────┐
│                          PostgreSQL Database                                  │
│  meetings │ meeting_participants │ meeting_attendances │ meeting_schools      │
└────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                    PUBLIC CHECK-IN (No Auth Required)                         │
│              Peserta scan QR → Browser membuka URL                           │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────────────┐
│                    MeetingCheckInController (public routes)                   │
│  - show   → validate signed URL, return meeting info                         │
│  - checkIn → QR_Personal check-in (with pessimistic lock)                    │
│  - walkIn  → QR_Umum walk-in form submission                                 │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────────────┐
│                       MeetingCheckInService                                   │
│  1. Validate signed URL signature (403 if invalid)                            │
│  2. Check token expiry H-1 to H+1 (410 if expired)                           │
│  3. Rate limit check IP+participant_id (429 if exceeded)                      │
│  4. Geolocation validation if enabled (422 if out of range)                   │
│  5. DB::transaction() + lockForUpdate() → check is_token_used                │
│  6. Create MeetingAttendance + mark token used                                │
│  7. Capture device info from User-Agent                                       │
└────────────────────────────────────────────────────────────────────────────┘
```

### Alur Check-In QR_Personal

```
Peserta scan QR_Personal
         │
         ▼
Browser buka: /meetings/{id}/check-in?participant={pid}&signature=...&expires=...
         │
         ▼
MeetingCheckInController::show()
  ├─ URL::hasValidSignature() → 403 jika invalid
  ├─ Cek expires_at (H-1 to H+1) → 410 jika expired
  ├─ Load meeting + participant info
  └─ Return: meeting info, participant name, geolocation_required
         │
         ▼
Frontend MeetingCheckInPage (React)
  ├─ Tampilkan info rapat + nama peserta
  ├─ Jika geolocation_enabled → request browser geolocation
  ├─ Tampilkan opsi: "Hadir Sendiri" / "Hadir sebagai Delegasi"
  └─ Submit form
         │
         ▼
MeetingCheckInController::checkIn()
  ├─ Validate signed URL (ulang di server)
  ├─ Rate limit: check-in:{ip}:{participant_id} → 429 jika > 5/5menit
  ├─ Geolocation validation (Haversine) → 422 jika di luar radius
  └─ MeetingCheckInService::processCheckIn()
         │
         ▼
DB::transaction() {
  $locked = MeetingParticipant::lockForUpdate()->find($id);
  if ($locked->is_token_used) → return 409 "Sudah check-in pada [timestamp]"
  if ($locked->token_revoked) → return 410 "QR Code sudah tidak berlaku"
  
  MeetingAttendance::create([...device_info, checked_in_at microseconds...])
  $locked->update([is_token_used: true, token_used_at: now()])
}
         │
         ▼
Response: 201 + konfirmasi check-in (nama, waktu, device info)
```

### Alur Check-In QR_Umum (Walk-In)

```
Peserta scan QR_Umum
         │
         ▼
Browser buka: /meetings/{id}/check-in?token={qr_umum_token}&signature=...
         │
         ▼
MeetingCheckInController::show() (mode: walk-in)
  ├─ URL::hasValidSignature() → 403 jika invalid
  ├─ Cek expires_at → 410 jika expired
  └─ Return: meeting info, form fields required
         │
         ▼
Frontend: tampilkan form walk-in (nama, jabatan, instansi, nomor WA)
         │
         ▼
MeetingCheckInController::walkIn()
  ├─ Validate signed URL
  ├─ Rate limit: check-in:{ip}:walkin
  ├─ Normalize phone number (PhoneNormalizerService)
  ├─ Geolocation validation jika enabled
  └─ MeetingAttendance::create([attendance_type: qr_umum, walk_in_*])
         │
         ▼
Response: 201 + konfirmasi
```

### Alur Pengiriman WA Blast

```
MeetingService::create() dipanggil
         │
         ├─ [jika send_invitation_wa = true]
         │    ├─ Build recipient list dari meeting_participants
         │    ├─ Build pesan undangan dengan link QR_Personal per peserta
         │    └─ WaBlastService::createBlast() → dispatch SendBlastJob segera
         │
         └─ [jika send_reminder_wa = true]
              ├─ Hitung reminder_scheduled_at berdasarkan pilihan (H-1, 2 jam, custom)
              ├─ Simpan reminder_scheduled_at di meetings table
              └─ SendMeetingReminderJob::dispatch()->delay(reminder_scheduled_at)
                   │
                   ▼ (saat waktu tiba)
              SendMeetingReminderJob::handle()
                   ├─ Query peserta yang belum check-in
                   └─ WaBlastService::createBlast() untuk peserta tersebut
```

---

## Components and Interfaces

### Backend Components

#### Controllers (`app/Http/Controllers/Api/`)

| Controller | Tanggung Jawab |
|---|---|
| `MeetingController` | CRUD rapat, manual check-in, reset check-in, regenerate QR |
| `MeetingCheckInController` | Public check-in endpoint (no auth, signed URL protected) |
| `MeetingReportController` | Generate dan download laporan PDF + Excel |

#### Services (`app/Services/`)

| Service | Tanggung Jawab |
|---|---|
| `MeetingService` | Orkestrasi CRUD rapat, kompilasi peserta, trigger WA blast |
| `MeetingQrService` | Generate signed URL untuk QR_Personal dan QR_Umum via `URL::temporarySignedRoute()` |
| `MeetingCheckInService` | Validasi token, rate limiting, geolocation, pessimistic locking, device info capture |
| `MeetingReportService` | Generate PDF (PHPWord) dan Excel (Maatwebsite) laporan kehadiran |

#### Repositories (`app/Repositories/`)

| Repository | Interface | Tanggung Jawab |
|---|---|---|
| `MeetingRepository` | `MeetingRepositoryInterface` | Query, filter, paginate rapat; filter by school_ids untuk operator |
| `MeetingParticipantRepository` | `MeetingParticipantRepositoryInterface` | CRUD peserta, query by meeting, lock for update |
| `MeetingAttendanceRepository` | `MeetingAttendanceRepositoryInterface` | CRUD kehadiran, statistik per rapat |

#### Jobs (`app/Jobs/`)

| Job | Tanggung Jawab |
|---|---|
| `SendMeetingReminderJob` | Dijalankan pada `reminder_scheduled_at`; query peserta belum check-in, panggil `WaBlastService::createBlast()` |

#### Form Requests (`app/Http/Requests/Meeting/`)

| Request Class | Digunakan Oleh |
|---|---|
| `StoreMeetingRequest` | `MeetingController::store()` |
| `UpdateMeetingRequest` | `MeetingController::update()` |
| `CheckInRequest` | `MeetingCheckInController::checkIn()` |
| `WalkInCheckInRequest` | `MeetingCheckInController::walkIn()` |

#### Models (`app/Models/`)

| Model | Tabel | Traits |
|---|---|---|
| `Meeting` | `meetings` | `SoftDeletes`, `AuditLogTrait` |
| `MeetingParticipant` | `meeting_participants` | `SoftDeletes`, `AuditLogTrait` |
| `MeetingAttendance` | `meeting_attendances` | `SoftDeletes`, `AuditLogTrait` |

---

### Frontend Components

#### Pages (`src/features/meetings/pages/`)

| File | Deskripsi |
|---|---|
| `MeetingListPage.tsx` | Daftar rapat dengan filter tanggal, status, sekolah; pagination 20/halaman |
| `MeetingCreatePage.tsx` | Form buat rapat: detail, peserta multi-sekolah, WA blast options, geolocation |
| `MeetingDetailPage.tsx` | Detail rapat: statistik real-time (polling 10s), tabel peserta, QR_Umum, tombol aksi |
| `MeetingEditPage.tsx` | Form edit rapat (tanggal/waktu disabled jika ongoing/completed) |
| `MeetingCheckInPage.tsx` | Halaman publik check-in: validasi QR, form delegasi/walk-in, konfirmasi |

#### Components (`src/features/meetings/components/`)

| File | Deskripsi |
|---|---|
| `MeetingStatusBadge.tsx` | Badge berwarna untuk `upcoming` (biru), `ongoing` (hijau), `completed` (abu) |
| `AttendanceStatusBadge.tsx` | Badge untuk `present`, `present_delegation`, `present_walkin`, `absent` |
| `ParticipantSelector.tsx` | Multi-sekolah selector dengan auto-suggest kepala sekolah dan guru |
| `MeetingQrCode.tsx` | Tampilkan QR code menggunakan `qrcode.react` dengan opsi download |
| `MeetingAttendanceTable.tsx` | Tabel peserta dengan status, waktu check-in, device info |
| `MeetingStatsCards.tsx` | Kartu statistik: total, hadir, tidak hadir, delegasi, walk-in, persentase |
| `DelegationForm.tsx` | Form delegasi: pilih peserta yang diwakili + upload surat tugas |

#### Hooks (`src/features/meetings/hooks/`)

| File | Deskripsi |
|---|---|
| `useMeetings.ts` | TanStack Query: list rapat dengan filter dan pagination |
| `useMeeting.ts` | TanStack Query: detail satu rapat |
| `useMeetingAttendance.ts` | TanStack Query dengan `refetchInterval: 10000` untuk polling real-time |
| `useMeetingCheckIn.ts` | Mutation untuk proses check-in dan walk-in |

#### Services (`src/features/meetings/services/`)

| File | Deskripsi |
|---|---|
| `meetingService.ts` | Semua API calls untuk meeting CRUD, check-in, laporan via `apiClient` |

#### Types (`src/features/meetings/types/`)

| File | Deskripsi |
|---|---|
| `meeting.types.ts` | TypeScript interfaces: `Meeting`, `MeetingParticipant`, `MeetingAttendance`, `AttendanceStats`, `DeviceInfo`, enums |

---

### API Endpoints

#### Public Endpoints (No Auth — Signed URL Protected)

| Method | Endpoint | Controller Method | Deskripsi |
|---|---|---|---|
| `GET` | `/api/public/meetings/{meeting}/check-in` | `show` | Validasi signed URL, return info rapat + peserta |
| `POST` | `/api/public/meetings/{meeting}/check-in` | `checkIn` | QR_Personal check-in (dengan pessimistic lock) |
| `POST` | `/api/public/meetings/{meeting}/walk-in` | `walkIn` | QR_Umum walk-in form submission |

#### Authenticated Endpoints

| Method | Endpoint | Middleware | Deskripsi |
|---|---|---|---|
| `GET` | `/api/meetings` | `auth:sanctum` | Daftar rapat (operator: filtered by school_ids) |
| `GET` | `/api/meetings/{meeting}` | `auth:sanctum` | Detail rapat |
| `POST` | `/api/meetings` | `auth:sanctum, role:super_admin,admin_yayasan` | Buat rapat baru |
| `PUT` | `/api/meetings/{meeting}` | `auth:sanctum, role:super_admin,admin_yayasan` | Update rapat |
| `DELETE` | `/api/meetings/{meeting}` | `auth:sanctum, role:super_admin,admin_yayasan` | Soft delete rapat |
| `POST` | `/api/meetings/{meeting}/participants/{participant}/check-in` | `auth:sanctum, role:super_admin,admin_yayasan` | Manual check-in |
| `POST` | `/api/meetings/{meeting}/participants/{participant}/reset-check-in` | `auth:sanctum, role:super_admin,admin_yayasan` | Reset check-in |
| `POST` | `/api/meetings/{meeting}/participants/{participant}/regenerate-qr` | `auth:sanctum, role:super_admin,admin_yayasan` | Regenerate QR_Personal |
| `GET` | `/api/meetings/{meeting}/report/pdf` | `auth:sanctum, role:super_admin,admin_yayasan` | Download laporan PDF |
| `GET` | `/api/meetings/{meeting}/report/excel` | `auth:sanctum, role:super_admin,admin_yayasan` | Download laporan Excel |

**Response Shape (ApiResponse trait):**
```json
{
  "success": true,
  "message": "Rapat berhasil dibuat",
  "data": { ... }
}
```

**Request Body `POST /api/meetings`:**
```json
{
  "title": "Rapat Koordinasi Kepala Sekolah",
  "agenda": "Pembahasan program semester genap",
  "location": "Aula LP Ma'arif NU Cilacap",
  "started_at": "2025-02-15T08:00:00+07:00",
  "ended_at": "2025-02-15T12:00:00+07:00",
  "school_ids": [1, 2, 3],
  "geolocation_enabled": true,
  "latitude": -7.7325,
  "longitude": 109.0025,
  "geolocation_radius_meters": 200,
  "participants": [
    {
      "participant_type": "headmaster",
      "participant_id": 5,
      "name": "Drs. Ahmad Fauzi",
      "jabatan": "Kepala Sekolah",
      "instansi": "MI Maarif 01 Cilacap",
      "phone_number": "081234567890"
    },
    {
      "participant_type": "external",
      "participant_id": null,
      "name": "H. Budi Santoso",
      "jabatan": "Ketua Yayasan",
      "instansi": "LP Ma'arif NU Cilacap",
      "phone_number": "082345678901"
    }
  ],
  "send_invitation_wa": true,
  "send_reminder_wa": true,
  "reminder_timing": "H-1"
}
```

---

## Data Models

### Tabel `meetings`

Menyimpan data rapat yayasan. Cross-tenant (tidak ada `school_id`).

```sql
CREATE TABLE meetings (
    id                          BIGSERIAL PRIMARY KEY,
    title                       VARCHAR(255) NOT NULL,
    -- Agenda/deskripsi rapat (nullable)
    agenda                      TEXT,
    location                    VARCHAR(500) NOT NULL,
    -- Waktu mulai dan selesai rapat (timezone-aware)
    started_at                  TIMESTAMP WITH TIME ZONE NOT NULL,
    ended_at                    TIMESTAMP WITH TIME ZONE NOT NULL,
    -- Apakah validasi geolocation diaktifkan
    geolocation_enabled         BOOLEAN NOT NULL DEFAULT FALSE,
    -- Koordinat lokasi rapat (nullable, hanya diisi jika geolocation_enabled)
    latitude                    DECIMAL(10, 8),
    longitude                   DECIMAL(11, 8),
    geolocation_radius_meters   INTEGER,
    -- Token signed URL untuk QR_Umum (disimpan untuk referensi, bukan untuk validasi)
    qr_umum_token               VARCHAR(500),
    -- Referensi ke WA blast undangan
    invitation_blast_id         BIGINT REFERENCES wa_blasts(id) ON DELETE SET NULL,
    -- Referensi ke WA blast reminder
    reminder_blast_id           BIGINT REFERENCES wa_blasts(id) ON DELETE SET NULL,
    -- Waktu terjadwal pengiriman reminder
    reminder_scheduled_at       TIMESTAMP WITH TIME ZONE,
    -- User yang membuat rapat
    created_by                  BIGINT NOT NULL REFERENCES users(id),
    created_at                  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at                  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at                  TIMESTAMP WITH TIME ZONE,

    CONSTRAINT chk_meetings_dates CHECK (ended_at > started_at),
    CONSTRAINT chk_meetings_geolocation CHECK (
        (geolocation_enabled = FALSE) OR
        (geolocation_enabled = TRUE AND latitude IS NOT NULL AND longitude IS NOT NULL AND geolocation_radius_meters IS NOT NULL)
    ),
    CONSTRAINT chk_meetings_radius CHECK (geolocation_radius_meters IS NULL OR geolocation_radius_meters >= 10)
);

CREATE INDEX idx_meetings_started_at ON meetings(started_at);
CREATE INDEX idx_meetings_created_by ON meetings(created_by);
CREATE INDEX idx_meetings_deleted_at ON meetings(deleted_at);
```

**Eloquent Model:** `Meeting`
- Tidak menggunakan `HasTenantScope`
- Traits: `SoftDeletes`, `AuditLogTrait`
- Relasi:
  - `hasMany(MeetingParticipant)`
  - `hasMany(MeetingAttendance)`
  - `belongsToMany(School, 'meeting_schools')`
  - `belongsTo(User, 'created_by')`
  - `belongsTo(WaBlast, 'invitation_blast_id')`
  - `belongsTo(WaBlast, 'reminder_blast_id')`
- Computed property `status`:
  ```php
  public function getStatusAttribute(): string
  {
      $now = now();
      if ($now->lt($this->started_at)) return 'upcoming';
      if ($now->gt($this->ended_at)) return 'completed';
      return 'ongoing';
  }
  ```
- Casts: `started_at`, `ended_at`, `reminder_scheduled_at` → `datetime`, `geolocation_enabled` → `boolean`

---

### Tabel `meeting_participants`

Peserta terdaftar per rapat. Snapshot data saat rapat dibuat.

```sql
CREATE TABLE meeting_participants (
    id                          BIGSERIAL PRIMARY KEY,
    meeting_id                  BIGINT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    -- Tipe peserta: teacher (guru), headmaster (kepala sekolah), external (pihak luar)
    participant_type            VARCHAR(20) NOT NULL CHECK (participant_type IN ('teacher', 'headmaster', 'external')),
    -- FK ke tabel teachers (nullable untuk external)
    participant_id              BIGINT,
    -- Snapshot data peserta saat rapat dibuat
    name                        VARCHAR(255) NOT NULL,
    jabatan                     VARCHAR(255) NOT NULL,
    instansi                    VARCHAR(255) NOT NULL,
    -- Nomor WA yang sudah dinormalisasi (format: 62xxxxxxxxx)
    phone_number                VARCHAR(20) NOT NULL,
    -- Signed token untuk QR_Personal (full signed URL disimpan)
    qr_token                    TEXT,
    -- One-time use tracking
    is_token_used               BOOLEAN NOT NULL DEFAULT FALSE,
    token_used_at               TIMESTAMP WITH TIME ZONE,
    -- Flag untuk token yang sudah di-revoke (setelah regenerate QR)
    token_revoked               BOOLEAN NOT NULL DEFAULT FALSE,
    -- Versi untuk optimistic locking fallback
    version                     INTEGER NOT NULL DEFAULT 0,
    created_at                  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at                  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at                  TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_meeting_participants_meeting_id ON meeting_participants(meeting_id);
CREATE INDEX idx_meeting_participants_participant_id ON meeting_participants(participant_id) WHERE participant_id IS NOT NULL;
CREATE INDEX idx_meeting_participants_is_token_used ON meeting_participants(is_token_used);
CREATE UNIQUE INDEX idx_meeting_participants_qr_token ON meeting_participants(qr_token) WHERE deleted_at IS NULL AND qr_token IS NOT NULL;
```

**Eloquent Model:** `MeetingParticipant`
- Tidak menggunakan `HasTenantScope`
- Traits: `SoftDeletes`, `AuditLogTrait`
- Relasi:
  - `belongsTo(Meeting)`
  - `hasOne(MeetingAttendance, 'participant_id')`
- Casts: `is_token_used` → `boolean`, `token_revoked` → `boolean`, `token_used_at` → `datetime`

---

### Tabel `meeting_attendances`

Record kehadiran peserta (baik QR_Personal, QR_Umum, maupun manual).

```sql
CREATE TABLE meeting_attendances (
    id                              BIGSERIAL PRIMARY KEY,
    meeting_id                      BIGINT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    -- FK ke meeting_participants (nullable untuk walk-in)
    participant_id                  BIGINT REFERENCES meeting_participants(id) ON DELETE SET NULL,
    -- Metode check-in
    attendance_type                 VARCHAR(20) NOT NULL CHECK (attendance_type IN ('qr_personal', 'qr_umum', 'manual')),
    -- Apakah ini check-in delegasi
    is_delegation                   BOOLEAN NOT NULL DEFAULT FALSE,
    -- Peserta yang diwakili (jika delegasi)
    delegated_for_participant_id    BIGINT REFERENCES meeting_participants(id) ON DELETE SET NULL,
    -- Path file surat tugas delegasi di Laravel Storage
    delegation_letter_path          VARCHAR(500),
    -- Data peserta walk-in (nullable, hanya diisi untuk qr_umum)
    walk_in_name                    VARCHAR(255),
    walk_in_jabatan                 VARCHAR(255),
    walk_in_instansi                VARCHAR(255),
    walk_in_phone                   VARCHAR(20),
    -- Waktu check-in dengan presisi microseconds
    checked_in_at                   TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    -- Admin yang melakukan manual check-in (nullable)
    checked_in_by_admin_id          BIGINT REFERENCES users(id) ON DELETE SET NULL,
    -- Device info dari User-Agent (JSON)
    device_info                     JSONB,
    ip_address                      VARCHAR(45),
    -- Versi untuk optimistic locking fallback
    version                         INTEGER NOT NULL DEFAULT 0,
    created_at                      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at                      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at                      TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_meeting_attendances_meeting_id ON meeting_attendances(meeting_id);
CREATE INDEX idx_meeting_attendances_participant_id ON meeting_attendances(participant_id) WHERE participant_id IS NOT NULL;
CREATE INDEX idx_meeting_attendances_checked_in_at ON meeting_attendances(checked_in_at);
CREATE INDEX idx_meeting_attendances_attendance_type ON meeting_attendances(attendance_type);
```

**Struktur `device_info` JSONB:**
```json
{
  "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)...",
  "browser": "Safari",
  "browser_version": "17.0",
  "os": "iOS",
  "os_version": "17.0",
  "device_type": "mobile"
}
```

**Eloquent Model:** `MeetingAttendance`
- Tidak menggunakan `HasTenantScope`
- Traits: `SoftDeletes`, `AuditLogTrait`
- Relasi:
  - `belongsTo(Meeting)`
  - `belongsTo(MeetingParticipant, 'participant_id')`
  - `belongsTo(MeetingParticipant, 'delegated_for_participant_id')`
  - `belongsTo(User, 'checked_in_by_admin_id')`
- Casts: `is_delegation` → `boolean`, `device_info` → `array`, `checked_in_at` → `datetime`

---

### Tabel `meeting_schools` (Pivot)

Many-to-many antara rapat dan sekolah yang terlibat.

```sql
CREATE TABLE meeting_schools (
    id          BIGSERIAL PRIMARY KEY,
    meeting_id  BIGINT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    school_id   BIGINT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE (meeting_id, school_id)
);

CREATE INDEX idx_meeting_schools_meeting_id ON meeting_schools(meeting_id);
CREATE INDEX idx_meeting_schools_school_id ON meeting_schools(school_id);
```

---

### TypeScript Types (`src/features/meetings/types/meeting.types.ts`)

```typescript
export type MeetingStatus = 'upcoming' | 'ongoing' | 'completed';
export type ParticipantType = 'teacher' | 'headmaster' | 'external';
export type AttendanceType = 'qr_personal' | 'qr_umum' | 'manual';
export type AttendanceStatus = 'present' | 'present_delegation' | 'present_walkin' | 'absent';

export interface DeviceInfo {
  user_agent: string;
  browser: string;
  browser_version: string;
  os: string;
  os_version: string;
  device_type: 'mobile' | 'tablet' | 'desktop';
}

export interface AttendanceStats {
  total: number;
  present: number;
  absent: number;
  delegation: number;
  walk_in: number;
  percentage: number;
}

export interface School {
  id: number;
  nama: string;
  jenjang: string;
}

export interface MeetingAttendance {
  id: number;
  attendance_type: AttendanceType;
  is_delegation: boolean;
  delegated_for_participant_id: number | null;
  delegated_for_name: string | null;
  walk_in_name: string | null;
  walk_in_jabatan: string | null;
  walk_in_instansi: string | null;
  checked_in_at: string; // ISO 8601 with microseconds
  checked_in_by_admin_id: number | null;
  checked_in_by_admin_name: string | null;
  device_info: DeviceInfo | null;
  ip_address: string | null;
}

export interface MeetingParticipant {
  id: number;
  meeting_id: number;
  participant_type: ParticipantType;
  participant_id: number | null;
  name: string;
  jabatan: string;
  instansi: string;
  phone_number: string;
  qr_personal_url: string; // full signed URL for QR code display
  is_token_used: boolean;
  token_used_at: string | null;
  token_revoked: boolean;
  attendance: MeetingAttendance | null;
  attendance_status: AttendanceStatus;
}

export interface Meeting {
  id: number;
  title: string;
  agenda: string | null;
  location: string;
  started_at: string; // ISO 8601
  ended_at: string;
  status: MeetingStatus;
  geolocation_enabled: boolean;
  latitude: number | null;
  longitude: number | null;
  geolocation_radius_meters: number | null;
  qr_umum_url: string; // full signed URL for QR_Umum
  schools: School[];
  participants: MeetingParticipant[];
  attendance_stats: AttendanceStats;
  invitation_blast_id: number | null;
  reminder_blast_id: number | null;
  reminder_scheduled_at: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
}

// Request payloads
export interface ParticipantInput {
  participant_type: ParticipantType;
  participant_id: number | null;
  name: string;
  jabatan: string;
  instansi: string;
  phone_number: string;
}

export interface CreateMeetingPayload {
  title: string;
  agenda?: string;
  location: string;
  started_at: string;
  ended_at: string;
  school_ids: number[];
  geolocation_enabled: boolean;
  latitude?: number;
  longitude?: number;
  geolocation_radius_meters?: number;
  participants: ParticipantInput[];
  send_invitation_wa: boolean;
  send_reminder_wa: boolean;
  reminder_timing?: 'H-1' | '2_hours' | 'custom';
  reminder_at?: string; // ISO 8601, untuk custom timing
}

export interface CheckInPayload {
  is_delegation: boolean;
  delegated_for_participant_id?: number;
  delegation_letter?: File;
  latitude?: number;
  longitude?: number;
}

export interface WalkInPayload {
  walk_in_name: string;
  walk_in_jabatan: string;
  walk_in_instansi: string;
  walk_in_phone: string;
  latitude?: number;
  longitude?: number;
}

export interface MeetingListParams {
  date_from?: string;
  date_to?: string;
  status?: MeetingStatus;
  school_id?: number;
  search?: string;
  page?: number;
  per_page?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}
```

---

## QR Code Security Design

### QR_Personal — One-Time Use Signed URL

**Format URL:**
```
https://simmaci.app/meetings/{meeting_id}/check-in?participant={participant_id}&signature={hmac}&expires={timestamp}
```

**Generasi token di `MeetingQrService`:**
```php
public function generatePersonalQrUrl(Meeting $meeting, MeetingParticipant $participant): string
{
    // Token valid dari H-1 sampai H+1 dari waktu MULAI rapat
    $expiresAt = Carbon::parse($meeting->started_at)->addDay(); // H+1

    return URL::temporarySignedRoute(
        'public.meetings.check-in',
        $expiresAt,
        [
            'meeting'     => $meeting->id,
            'participant' => $participant->id,
        ]
    );
}

public function generateUmumQrUrl(Meeting $meeting): string
{
    $expiresAt = Carbon::parse($meeting->started_at)->addDay(); // H+1

    return URL::temporarySignedRoute(
        'public.meetings.check-in',
        $expiresAt,
        ['meeting' => $meeting->id]
        // Tidak ada parameter 'participant' → mode walk-in
    );
}
```

**Catatan:** Validasi H-1 (tidak bisa digunakan sebelum H-1) dilakukan secara manual di `MeetingCheckInService` karena `URL::temporarySignedRoute()` hanya mendukung expiry, bukan "not before". Jika `now() < started_at - 24 jam`, check-in ditolak dengan 410.

### Alur Validasi Check-In (6 Langkah)

```php
// MeetingCheckInService::processCheckIn()

// Langkah 1: Validasi signature Laravel
if (!$request->hasValidSignature()) {
    throw new InvalidQrSignatureException(); // HTTP 403
}

// Langkah 2: Validasi window H-1 sampai H+1
$windowStart = Carbon::parse($meeting->started_at)->subDay();
$windowEnd   = Carbon::parse($meeting->started_at)->addDay();
if (now()->lt($windowStart) || now()->gt($windowEnd)) {
    throw new QrExpiredException($windowEnd); // HTTP 410
}

// Langkah 3: Rate limiting
$rateLimitKey = "check-in:{$request->ip()}:{$participantId}";
if (RateLimiter::tooManyAttempts($rateLimitKey, maxAttempts: 5)) {
    throw new TooManyCheckInAttemptsException(); // HTTP 429
}
RateLimiter::hit($rateLimitKey, decaySeconds: 300); // 5 menit sliding window

// Langkah 4: Geolocation validation (jika enabled)
if ($meeting->geolocation_enabled && $request->has('latitude')) {
    $distance = $this->haversineDistance(
        $meeting->latitude, $meeting->longitude,
        $request->latitude, $request->longitude
    );
    if ($distance > $meeting->geolocation_radius_meters) {
        throw new OutsideGeofenceException($distance, $meeting->geolocation_radius_meters); // HTTP 422
    }
}

// Langkah 5: Pessimistic locking + one-time use check
DB::transaction(function () use ($participant, $request, $meeting) {
    $locked = MeetingParticipant::lockForUpdate()->findOrFail($participant->id);

    if ($locked->token_revoked) {
        throw new QrRevokedException(); // HTTP 410
    }

    if ($locked->is_token_used) {
        throw new AlreadyCheckedInException($locked->token_used_at); // HTTP 409
    }

    // Langkah 6: Buat record kehadiran + tandai token used
    $deviceInfo = $this->parseDeviceInfo($request->userAgent());

    MeetingAttendance::create([
        'meeting_id'                    => $meeting->id,
        'participant_id'                => $locked->id,
        'attendance_type'               => 'qr_personal',
        'is_delegation'                 => $request->is_delegation ?? false,
        'delegated_for_participant_id'  => $request->delegated_for_participant_id,
        'delegation_letter_path'        => $request->file('delegation_letter')?->store('meeting-delegations'),
        'checked_in_at'                 => Carbon::now()->format('Y-m-d H:i:s.u'),
        'device_info'                   => $deviceInfo,
        'ip_address'                    => $request->ip(),
    ]);

    $locked->update([
        'is_token_used'  => true,
        'token_used_at'  => now(),
        'version'        => $locked->version + 1,
    ]);
});
```

### Device Info Parsing

```php
// MeetingCheckInService::parseDeviceInfo()
// Menggunakan library jenssegers/agent

use Jenssegers\Agent\Agent;

private function parseDeviceInfo(string $userAgent): array
{
    $agent = new Agent();
    $agent->setUserAgent($userAgent);

    return [
        'user_agent'       => $userAgent,
        'browser'          => $agent->browser(),
        'browser_version'  => $agent->version($agent->browser()),
        'os'               => $agent->platform(),
        'os_version'       => $agent->version($agent->platform()),
        'device_type'      => $agent->isMobile() ? 'mobile'
                            : ($agent->isTablet() ? 'tablet' : 'desktop'),
    ];
}
```

### Haversine Formula

```php
// MeetingCheckInService::haversineDistance()
// Reuse logika dari AttendanceController::calculateDistance()

private function haversineDistance(
    float $lat1, float $lon1,
    float $lat2, float $lon2
): float {
    $earthRadius = 6371000; // meter
    $dLat = deg2rad($lat2 - $lat1);
    $dLon = deg2rad($lon2 - $lon1);

    $a = sin($dLat / 2) ** 2
       + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLon / 2) ** 2;

    return $earthRadius * 2 * asin(sqrt($a));
}
```

---

## Frontend Architecture

### Struktur Folder

```
src/features/meetings/
├── types/
│   └── meeting.types.ts
├── services/
│   └── meetingService.ts
├── hooks/
│   ├── useMeetings.ts
│   ├── useMeeting.ts
│   ├── useMeetingAttendance.ts    (polling refetchInterval: 10000)
│   └── useMeetingCheckIn.ts
├── components/
│   ├── MeetingStatusBadge.tsx
│   ├── AttendanceStatusBadge.tsx
│   ├── ParticipantSelector.tsx
│   ├── MeetingQrCode.tsx
│   ├── MeetingAttendanceTable.tsx
│   ├── MeetingStatsCards.tsx
│   └── DelegationForm.tsx
└── pages/
    ├── MeetingListPage.tsx
    ├── MeetingCreatePage.tsx
    ├── MeetingDetailPage.tsx
    ├── MeetingEditPage.tsx
    └── MeetingCheckInPage.tsx     (public, no auth)
```

### React Router v7 Routes

```tsx
// Dalam router config (App.tsx atau routes file)
// Protected routes (dalam ProtectedLayout)
<Route path="/dashboard/meetings" element={<MeetingListPage />} />
<Route path="/dashboard/meetings/create" element={<MeetingCreatePage />} />
<Route path="/dashboard/meetings/:id" element={<MeetingDetailPage />} />
<Route path="/dashboard/meetings/:id/edit" element={<MeetingEditPage />} />

// Public route (LUAR ProtectedLayout — tidak perlu auth token)
<Route path="/meetings/:id/check-in" element={<MeetingCheckInPage />} />
```

### Sidebar Navigation (AppShell.tsx)

```tsx
// Tambahkan grup baru "Rapat Yayasan" di AppShell.tsx
{
  title: "Rapat Yayasan",
  items: [
    {
      label: "Daftar Rapat",
      href: "/dashboard/meetings",
      icon: CalendarDays,
      // Visible untuk semua role
    },
    {
      label: "Buat Rapat Baru",
      href: "/dashboard/meetings/create",
      icon: CalendarPlus,
      // Hanya visible untuk adminRoles (super_admin, admin_yayasan)
      adminOnly: true,
    },
  ]
}
```

### Polling Real-Time (useMeetingAttendance.ts)

```typescript
// src/features/meetings/hooks/useMeetingAttendance.ts
import { useQuery } from '@tanstack/react-query';
import { meetingService } from '../services/meetingService';

export function useMeetingAttendance(meetingId: number) {
  return useQuery({
    queryKey: ['meeting-attendance', meetingId],
    queryFn: () => meetingService.getMeetingDetail(meetingId),
    refetchInterval: 10_000, // polling setiap 10 detik
    refetchIntervalInBackground: false, // hentikan polling jika tab tidak aktif
    staleTime: 5_000,
  });
}
```

### MeetingCheckInPage — Public Check-In Flow

```tsx
// src/features/meetings/pages/MeetingCheckInPage.tsx
// Halaman publik — tidak memerlukan auth token Sanctum

export default function MeetingCheckInPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const participantId = searchParams.get('participant');
  const isWalkIn = !participantId; // QR_Umum jika tidak ada participant param

  // Step 1: Validasi signed URL via API
  const { data: meetingInfo, isLoading, error } = useQuery({
    queryKey: ['public-meeting-checkin', id, participantId],
    queryFn: () => meetingService.validateCheckInUrl(id!, searchParams.toString()),
    retry: false,
  });

  // Step 2: Geolocation (jika required)
  const [coords, setCoords] = useState<GeolocationCoordinates | null>(null);
  useEffect(() => {
    if (meetingInfo?.geolocation_enabled) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoords(pos.coords),
        () => toast.error('Validasi lokasi diperlukan. Silakan izinkan akses lokasi.')
      );
    }
  }, [meetingInfo?.geolocation_enabled]);

  // Step 3: Form submission
  const checkInMutation = useMutation({
    mutationFn: isWalkIn
      ? (data: WalkInPayload) => meetingService.walkIn(id!, searchParams.toString(), data)
      : (data: CheckInPayload) => meetingService.checkIn(id!, searchParams.toString(), data),
    onSuccess: (data) => {
      // Tampilkan konfirmasi dengan timestamp + device info
    },
  });

  // Render: loading → error (403/410/409) → form → success
}
```

### QR Code Display (MeetingQrCode.tsx)

```tsx
// src/features/meetings/components/MeetingQrCode.tsx
import QRCode from 'qrcode.react';

interface MeetingQrCodeProps {
  url: string;
  label: string;
  size?: number;
}

export function MeetingQrCode({ url, label, size = 200 }: MeetingQrCodeProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <QRCode value={url} size={size} level="M" includeMargin />
      <p className="text-xs text-muted-foreground text-center">{label}</p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          // Download QR sebagai PNG
          const canvas = document.querySelector('canvas');
          const link = document.createElement('a');
          link.download = `qr-${label}.png`;
          link.href = canvas!.toDataURL();
          link.click();
        }}
      >
        Download QR
      </Button>
    </div>
  );
}
```

---

## WA Blast Integration

### Template Pesan Undangan

```
📋 *UNDANGAN RAPAT*

Yth. {nama}
{jabatan} - {instansi}

Anda diundang untuk hadir dalam:
*{judul_rapat}*

📅 Tanggal: {tanggal}
⏰ Waktu: {jam_mulai} - {jam_selesai}
📍 Lokasi: {lokasi}

📌 Agenda:
{agenda}

Silakan scan QR Code berikut untuk check-in:
{qr_link}

Harap konfirmasi kehadiran Anda.

_LP Ma'arif NU Cilacap_
```

### Template Pesan Reminder

```
⏰ *PENGINGAT RAPAT*

Yth. {nama}
{jabatan} - {instansi}

Mengingatkan bahwa rapat berikut akan segera dimulai:
*{judul_rapat}*

📅 Tanggal: {tanggal}
⏰ Waktu: {jam_mulai}
📍 Lokasi: {lokasi}

Gunakan QR Code Anda untuk check-in:
{qr_link}

_LP Ma'arif NU Cilacap_
```

### Implementasi di MeetingService

```php
// MeetingService::sendInvitationBlast()
public function sendInvitationBlast(Meeting $meeting): ?WaBlast
{
    $recipients = $meeting->participants
        ->filter(fn ($p) => !empty($p->phone_number))
        ->map(fn ($p) => [
            'recipient_name'  => $p->name,
            'school_name'     => $p->instansi,
            'phone_number'    => $p->phone_number,
            'recipient_type'  => 'gtk',
            'delivery_status' => 'pending',
            // Pesan individual dengan QR link per peserta
            'message_override' => $this->buildInvitationMessage($meeting, $p),
        ])->toArray();

    if (empty($recipients)) return null;

    // Buat blast dengan pesan per-recipient (message_override)
    return $this->waBlastService->createBlast([
        'title'              => "Undangan: {$meeting->title}",
        'recipient_category' => 'custom',
        'message_body'       => $this->buildInvitationMessage($meeting, null),
        'recipients'         => $recipients,
    ], auth()->id());
}

// SendMeetingReminderJob::handle()
public function handle(): void
{
    $meeting = Meeting::with('participants.attendance')->findOrFail($this->meetingId);

    // Hanya kirim ke peserta yang BELUM check-in
    $unattendedParticipants = $meeting->participants->filter(
        fn ($p) => $p->attendance === null && !empty($p->phone_number)
    );

    if ($unattendedParticipants->isEmpty()) return;

    $this->meetingService->sendReminderBlast($meeting, $unattendedParticipants);
}
```

### Timing Reminder

| Pilihan | Kalkulasi `reminder_scheduled_at` |
|---|---|
| H-1 | `started_at - 24 jam` |
| 2 jam sebelum | `started_at - 2 jam` |
| Custom | Input manual dari admin (validasi: min 30 menit sebelum, max 7 hari sebelum) |

---

## Report Design

### PDF (PHPWord)

**Struktur dokumen:**

1. **Header** — Logo LP Ma'arif NU Cilacap + judul "DAFTAR HADIR RAPAT" + info rapat (nama, tanggal, waktu, lokasi, agenda)
2. **Tabel Statistik** — Total Peserta | Hadir | Tidak Hadir | Delegasi | Walk-in | Persentase Kehadiran
3. **Tabel Daftar Hadir** — kolom: No | Nama | Jabatan | Asal Sekolah/Instansi | Status | Waktu Check-in | Verifikasi | Keterangan
4. **Footer** — Tanggal cetak + nama admin yang mencetak

**Kolom Verifikasi:**
- QR_Personal: `✓ Terverifikasi via QR Personal pada [timestamp] dari [browser] di [device_type]`
- Manual: `✓ Check-in Manual oleh [Admin Name] pada [timestamp]`
- Delegasi: `✓ Delegasi dari [Nama Peserta Asli] — Surat Tugas terlampir`
- Walk-in: `✓ Walk-in via QR Umum pada [timestamp]`
- Tidak hadir: `-`

### Excel (Maatwebsite)

**Sheet "Daftar Hadir":**
- Baris 1-5: Header info rapat (merge cells)
- Baris 6: Header kolom tabel
- Baris 7+: Data peserta (sama dengan PDF)
- Baris terakhir: Baris total statistik

```php
// MeetingReportService::generateExcel()
class MeetingAttendanceExport implements FromCollection, WithHeadings, WithStyles, WithTitle
{
    public function __construct(private Meeting $meeting) {}

    public function collection(): Collection
    {
        return $this->meeting->participants->map(fn ($p, $i) => [
            'no'          => $i + 1,
            'nama'        => $p->name,
            'jabatan'     => $p->jabatan,
            'instansi'    => $p->instansi,
            'status'      => $this->getStatusLabel($p),
            'waktu'       => $p->attendance?->checked_in_at?->format('H:i:s') ?? '-',
            'verifikasi'  => $this->getVerificationText($p),
            'keterangan'  => $this->getKeterangan($p),
        ]);
    }
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

**Property Reflection:** Setelah analisis prework, beberapa kriteria yang tumpang tindih telah digabungkan:
- Kriteria 4.5, 26.1-26.3 (one-time use) → digabung ke Property 1
- Kriteria 4.6, 27.2-27.3 (rate limiting) → digabung ke Property 3
- Kriteria 6.3, 17.1-17.4 (phone normalization) → digabung ke Property 5
- Kriteria 4.7-4.9, 28.8 (geolocation) → digabung ke Property 4
- Kriteria 1.1 (data persistence) dan 1.6 (QR uniqueness) → tetap terpisah karena menguji aspek berbeda

---

### Property 1: One-Time Use Token — Check-In Hanya Berhasil Sekali

*For any* peserta terdaftar dengan QR_Personal yang valid dan belum digunakan, check-in pertama SHALL berhasil dan menandai `is_token_used = true`, sedangkan setiap check-in berikutnya dengan token yang sama SHALL ditolak dengan response 409 dan pesan yang menyertakan timestamp check-in pertama.

**Validates: Requirements 4.4, 4.5, 26.1, 26.2, 26.3**

---

### Property 2: Concurrent Check-In — Tepat Satu yang Berhasil

*For any* dua atau lebih request check-in yang tiba secara bersamaan dengan QR_Personal yang sama, tepat satu request SHALL berhasil (HTTP 201) dan semua request lainnya SHALL mengembalikan response "sudah check-in" (HTTP 409) — tidak ada yang mengembalikan error 500 atau menghasilkan duplikasi record kehadiran.

**Validates: Requirements 32.1, 32.2, 32.3**

---

### Property 3: Rate Limiting — Pembatasan per IP+Participant

*For any* kombinasi IP address dan participant_id, setelah 5 percobaan check-in dalam jendela 5 menit, percobaan ke-6 dan seterusnya SHALL ditolak dengan response HTTP 429 sampai jendela waktu berakhir.

**Validates: Requirements 4.6, 27.2, 27.3, 27.5**

---

### Property 4: Geolocation Validation — Haversine Radius Check

*For any* rapat dengan `geolocation_enabled = true` dan radius R meter, check-in dari koordinat yang berjarak lebih dari R meter dari koordinat rapat SHALL ditolak dengan HTTP 422 dan pesan yang menyertakan jarak aktual dan radius maksimal. Check-in dari koordinat yang berjarak ≤ R meter SHALL diterima.

**Validates: Requirements 4.7, 4.8, 4.9, 28.6, 28.8, 28.9, 28.10**

---

### Property 5: Normalisasi Nomor WhatsApp

*For any* string nomor telepon yang diawali dengan `0`, `+62`, atau `62` (dengan atau tanpa spasi dan tanda hubung) dan memiliki 9-13 digit setelah kode negara, `PhoneNormalizerService::normalize()` SHALL menghasilkan string yang cocok dengan pola `^62[0-9]{9,13}$`. Untuk nomor yang tidak memenuhi pola tersebut setelah normalisasi, `isValid()` SHALL mengembalikan `false`.

**Validates: Requirements 6.3, 17.1, 17.2, 17.3, 17.4**

---

### Property 6: Status Rapat Otomatis — Deterministic Computation

*For any* rapat dengan `started_at` dan `ended_at` yang valid, computed property `status` SHALL mengembalikan `upcoming` jika `now() < started_at`, `ongoing` jika `started_at <= now() <= ended_at`, dan `completed` jika `now() > ended_at` — tanpa pengecualian untuk nilai waktu apapun dalam range yang valid.

**Validates: Requirements 18.1, 18.2, 18.3, 18.4**

---

### Property 7: QR Token Uniqueness — Setiap Peserta Mendapat Token Unik

*For any* rapat dengan N peserta terdaftar, setelah proses pembuatan rapat, setiap peserta SHALL memiliki nilai `qr_token` yang berbeda dari semua peserta lain dalam rapat yang sama maupun rapat yang berbeda (globally unique).

**Validates: Requirements 1.6, 25.1**

---

### Property 8: Laporan Statistik — Konsistensi Jumlah

*For any* rapat dengan N peserta terdaftar dan M peserta walk-in, laporan kehadiran SHALL memenuhi invariant: `total_present + total_absent = N` (peserta terdaftar), dan `total_walk_in = M`. Nilai `total_present` mencakup semua tipe kehadiran (qr_personal, manual, delegasi).

**Validates: Requirements 10.3, 12.2**

---

### Property 9: Token Expiry Window — H-1 sampai H+1

*For any* rapat dengan `started_at = T`, signed token SHALL hanya dapat digunakan dalam rentang waktu `[T - 24 jam, T + 24 jam]`. Check-in yang dilakukan sebelum `T - 24 jam` atau setelah `T + 24 jam` SHALL ditolak dengan HTTP 410.

**Validates: Requirements 4.3, 25.2, 25.6, 25.7, 25.8**

---

### Property 10: QR Regeneration — Token Lama Direvoke

*For any* peserta yang QR-nya di-regenerate, token lama SHALL ditandai `token_revoked = true` sehingga tidak dapat digunakan untuk check-in, dan token baru SHALL valid untuk digunakan dalam window H-1 sampai H+1.

**Validates: Requirements 31.2, 31.3, 31.4**

---

## Error Handling

### HTTP Error Codes untuk Check-In

| Kode | Kondisi | Pesan |
|---|---|---|
| 403 | Signature URL tidak valid atau telah dimodifikasi | "QR Code tidak valid atau telah dimodifikasi" |
| 409 | Token sudah digunakan (already checked in) | "Anda sudah check-in pada [timestamp]" |
| 410 | Token expired (di luar window H-1 sampai H+1) atau token revoked | "QR Code sudah tidak berlaku" |
| 422 | Geolocation di luar radius | "Anda berada di luar area rapat (jarak: [X] meter, maksimal: [R] meter)" |
| 422 | Geolocation permission ditolak | "Validasi lokasi diperlukan untuk check-in. Silakan izinkan akses lokasi." |
| 422 | Validasi form gagal (walk-in) | Field-level error messages |
| 429 | Rate limit exceeded | "Terlalu banyak percobaan check-in dari perangkat Anda. Silakan tunggu beberapa menit." |

### Error Handling di Backend

| Skenario | Penanganan |
|---|---|
| `DB::transaction()` deadlock | Laravel retry otomatis 3x, kemudian throw exception → HTTP 500 dengan pesan generic |
| File surat tugas > 5 MB | Validasi di `CheckInRequest` → HTTP 422 |
| File surat tugas bukan JPEG/PNG/PDF | Validasi di `CheckInRequest` → HTTP 422 |
| Logo tidak ditemukan saat generate PDF | Log warning, generate PDF tanpa logo |
| WA Blast gagal saat undangan | Log error, rapat tetap tersimpan, `invitation_blast_id` = null |
| `reminder_at` sudah lewat | HTTP 422 "Waktu reminder sudah lewat. Silakan pilih waktu yang akan datang." |
| `reminder_at` < 30 menit sebelum rapat | HTTP 422 "Waktu reminder minimal 30 menit sebelum rapat dimulai." |
| `reminder_at` > 7 hari sebelum rapat | HTTP 422 "Waktu reminder maksimal 7 hari sebelum rapat dimulai." |
| Operator akses rapat di luar school_ids | HTTP 403 "Anda tidak memiliki akses ke rapat ini." |
| Hapus rapat yang sudah ada kehadiran | HTTP 422 dengan konfirmasi diperlukan (frontend menampilkan dialog) |

### Error Handling di Frontend

| Skenario | Penanganan |
|---|---|
| HTTP 403 pada check-in page | Tampilkan halaman error "QR Code tidak valid" dengan ikon X merah |
| HTTP 409 pada check-in | Tampilkan halaman "Sudah Check-in" dengan timestamp sebelumnya |
| HTTP 410 pada check-in | Tampilkan halaman "QR Code Kadaluarsa" |
| HTTP 429 pada check-in | Tampilkan countdown timer sampai rate limit reset |
| HTTP 422 geolocation | Tampilkan pesan jarak aktual vs radius maksimal |
| Koneksi gagal | Sonner toast "Gagal terhubung ke server. Silakan coba lagi." |
| Form validation error | Inline error di bawah field yang bermasalah (React Hook Form + Zod) |

---

## Testing Strategy

### Pendekatan Dual Testing

Fitur ini menggunakan dua pendekatan testing yang saling melengkapi:
- **Unit tests**: Verifikasi contoh spesifik, edge case, dan kondisi error
- **Property-based tests**: Verifikasi properti universal di seluruh input yang mungkin

### Library Property-Based Testing

**Backend (PHP):** [eris/eris](https://github.com/giorgiosironi/eris) — property-based testing library untuk PHP/PHPUnit.

Setiap property test dikonfigurasi minimum **100 iterasi**.

Tag format komentar: `// Feature: meeting-attendance-qr, Property {N}: {property_text}`

### Unit Tests (PHPUnit)

**`MeetingQrServiceTest`:**
- Generate QR_Personal URL mengandung meeting_id dan participant_id yang benar
- Generate QR_Umum URL tidak mengandung participant parameter
- URL yang dihasilkan dapat diverifikasi dengan `URL::hasValidSignature()`
- Expiry dihitung dengan benar (H+1 dari started_at)

**`MeetingCheckInServiceTest`:**
- Signature tidak valid → throw `InvalidQrSignatureException`
- Check-in sebelum H-1 → throw `QrExpiredException`
- Check-in setelah H+1 → throw `QrExpiredException`
- Token sudah digunakan → throw `AlreadyCheckedInException` dengan timestamp
- Token revoked → throw `QrRevokedException`
- Geolocation di luar radius → throw `OutsideGeofenceException` dengan jarak aktual
- Check-in berhasil → record `MeetingAttendance` dibuat dengan device_info
- Check-in berhasil → `is_token_used = true` dan `token_used_at` diisi

**`MeetingServiceTest`:**
- Buat rapat dengan `ended_at <= started_at` → ValidationException
- Buat rapat dengan geolocation_enabled tanpa koordinat → ValidationException
- Buat rapat dengan reminder_at < 30 menit sebelum rapat → ValidationException
- Buat rapat dengan reminder_at > 7 hari sebelum rapat → ValidationException
- Hapus rapat dengan kehadiran → soft delete semua relasi

**`MeetingReportServiceTest`:**
- PDF dihasilkan tanpa error untuk rapat dengan 0 peserta
- PDF dihasilkan tanpa error untuk rapat dengan N peserta (berbagai status)
- Statistik dalam laporan: `present + absent = total_participants`
- Excel dihasilkan dengan sheet "Daftar Hadir"

**`PhoneNormalizerServiceTest` (reuse existing):**
- Sudah ada di `backend/tests/Unit/Services/NormalizationServiceTest.php`

### Property-Based Tests (PHPUnit + eris/eris)

**Property 1 — One-Time Use Token:**
```php
// Feature: meeting-attendance-qr, Property 1: One-Time Use Token
$this->forAll(
    Generator\elements(['qr_personal', 'manual']) // tipe check-in pertama
)->then(function (string $firstType) {
    $participant = MeetingParticipant::factory()->create(['is_token_used' => false]);

    // Check-in pertama harus berhasil
    $this->checkInService->processCheckIn($participant, $firstType);
    $this->assertTrue($participant->fresh()->is_token_used);

    // Check-in kedua harus ditolak
    $this->expectException(AlreadyCheckedInException::class);
    $this->checkInService->processCheckIn($participant, 'qr_personal');
});
```

**Property 2 — Concurrent Check-In:**
```php
// Feature: meeting-attendance-qr, Property 2: Concurrent Check-In
// Menggunakan parallel HTTP requests atau database transaction simulation
$this->forAll(
    Generator\choose(2, 10) // jumlah concurrent requests
)->then(function (int $concurrentCount) {
    $participant = MeetingParticipant::factory()->create(['is_token_used' => false]);

    // Simulasi concurrent check-in
    $results = $this->simulateConcurrentCheckIns($participant, $concurrentCount);

    $successCount = count(array_filter($results, fn ($r) => $r['status'] === 201));
    $alreadyCheckedInCount = count(array_filter($results, fn ($r) => $r['status'] === 409));

    $this->assertEquals(1, $successCount);
    $this->assertEquals($concurrentCount - 1, $alreadyCheckedInCount);
    $this->assertEquals(1, MeetingAttendance::where('participant_id', $participant->id)->count());
});
```

**Property 3 — Rate Limiting:**
```php
// Feature: meeting-attendance-qr, Property 3: Rate Limiting
$this->forAll(
    Generator\choose(6, 20) // jumlah percobaan melebihi limit
)->then(function (int $attemptCount) {
    $ip = '192.168.1.' . rand(1, 254);
    $participantId = rand(1, 1000);

    $responses = [];
    for ($i = 0; $i < $attemptCount; $i++) {
        $responses[] = $this->checkInService->checkRateLimit($ip, $participantId);
    }

    // 5 pertama harus lolos, sisanya harus ditolak
    $this->assertCount(5, array_filter($responses, fn ($r) => $r === 'allowed'));
    $this->assertCount($attemptCount - 5, array_filter($responses, fn ($r) => $r === 'rate_limited'));
});
```

**Property 4 — Geolocation Haversine:**
```php
// Feature: meeting-attendance-qr, Property 4: Geolocation Validation
$this->forAll(
    Generator\float(-90, 90),   // meeting latitude
    Generator\float(-180, 180), // meeting longitude
    Generator\choose(50, 500),  // radius dalam meter
    Generator\float(0.001, 0.01) // offset derajat (pasti di luar radius kecil)
)->then(function (float $lat, float $lon, int $radius, float $offset) {
    $meeting = Meeting::factory()->create([
        'geolocation_enabled'         => true,
        'latitude'                    => $lat,
        'longitude'                   => $lon,
        'geolocation_radius_meters'   => $radius,
    ]);

    // Koordinat di luar radius (offset ~1-10 km)
    $outsideLat = $lat + $offset;
    $outsideLon = $lon + $offset;
    $distance = $this->checkInService->haversineDistance($lat, $lon, $outsideLat, $outsideLon);

    if ($distance > $radius) {
        $this->expectException(OutsideGeofenceException::class);
        $this->checkInService->validateGeolocation($meeting, $outsideLat, $outsideLon);
    }

    // Koordinat di dalam radius (sangat dekat)
    $insideLat = $lat + 0.00001; // ~1 meter
    $insideLon = $lon + 0.00001;
    // Tidak boleh throw exception
    $this->checkInService->validateGeolocation($meeting, $insideLat, $insideLon);
});
```

**Property 5 — Phone Normalization:**
```php
// Feature: meeting-attendance-qr, Property 5: Normalisasi Nomor WhatsApp
$this->forAll(
    Generator\elements(['0', '+62', '62']),  // awalan
    Generator\choose(9, 13),                 // panjang digit setelah awalan
    Generator\elements(['', ' ', '-'])       // separator opsional
)->then(function (string $prefix, int $length, string $separator) {
    $digits = str_repeat('8', $length);
    $input = $prefix . $separator . $digits;

    $normalized = $this->normalizer->normalize($input);
    $this->assertMatchesRegularExpression('/^62[0-9]{9,13}$/', $normalized);
    $this->assertTrue($this->normalizer->isValid($normalized));
});
```

**Property 6 — Status Rapat Otomatis:**
```php
// Feature: meeting-attendance-qr, Property 6: Status Rapat Otomatis
$this->forAll(
    Generator\choose(1, 365),  // hari dari sekarang untuk started_at
    Generator\choose(1, 8)     // durasi rapat dalam jam
)->then(function (int $daysFromNow, int $durationHours) {
    $startedAt = now()->addDays($daysFromNow);
    $endedAt   = $startedAt->copy()->addHours($durationHours);

    $meeting = new Meeting(['started_at' => $startedAt, 'ended_at' => $endedAt]);

    // Sebelum rapat: upcoming
    Carbon::setTestNow($startedAt->copy()->subHour());
    $this->assertEquals('upcoming', $meeting->status);

    // Saat rapat berlangsung: ongoing
    Carbon::setTestNow($startedAt->copy()->addMinutes(30));
    $this->assertEquals('ongoing', $meeting->status);

    // Setelah rapat: completed
    Carbon::setTestNow($endedAt->copy()->addHour());
    $this->assertEquals('completed', $meeting->status);

    Carbon::setTestNow(); // reset
});
```

**Property 7 — QR Token Uniqueness:**
```php
// Feature: meeting-attendance-qr, Property 7: QR Token Uniqueness
$this->forAll(
    Generator\choose(2, 50) // jumlah peserta
)->then(function (int $participantCount) {
    $meeting = Meeting::factory()->create();
    $participants = MeetingParticipant::factory()
        ->count($participantCount)
        ->for($meeting)
        ->create();

    // Generate QR untuk semua peserta
    foreach ($participants as $p) {
        $this->qrService->generatePersonalQrUrl($meeting, $p);
    }

    $tokens = $participants->fresh()->pluck('qr_token');
    $this->assertEquals($participantCount, $tokens->unique()->count());
});
```

**Property 8 — Laporan Statistik Konsisten:**
```php
// Feature: meeting-attendance-qr, Property 8: Laporan Statistik Konsisten
$this->forAll(
    Generator\choose(1, 30),  // jumlah peserta terdaftar
    Generator\choose(0, 10)   // jumlah walk-in
)->then(function (int $registeredCount, int $walkInCount) {
    $meeting = Meeting::factory()->create();
    $participants = MeetingParticipant::factory()->count($registeredCount)->for($meeting)->create();

    // Buat beberapa kehadiran
    $presentCount = rand(0, $registeredCount);
    $participants->take($presentCount)->each(fn ($p) =>
        MeetingAttendance::factory()->create([
            'meeting_id'      => $meeting->id,
            'participant_id'  => $p->id,
            'attendance_type' => 'qr_personal',
        ])
    );

    // Buat walk-in
    for ($i = 0; $i < $walkInCount; $i++) {
        MeetingAttendance::factory()->walkIn()->create(['meeting_id' => $meeting->id]);
    }

    $stats = $this->reportService->calculateStats($meeting);

    $this->assertEquals($registeredCount, $stats['total']);
    $this->assertEquals($presentCount, $stats['present']);
    $this->assertEquals($registeredCount - $presentCount, $stats['absent']);
    $this->assertEquals($walkInCount, $stats['walk_in']);
    $this->assertEquals($stats['present'] + $stats['absent'], $registeredCount);
});
```

### Integration Tests

- `MeetingControllerTest` — CRUD endpoint, filter operator by school_ids, role-based access
- `MeetingCheckInControllerTest` — public check-in flow end-to-end (signed URL, one-time use, walk-in)
- `MeetingReportControllerTest` — PDF dan Excel download dengan mock data
- `SendMeetingReminderJobTest` — job hanya kirim ke peserta yang belum check-in

### Frontend Tests

- Unit test `meetingService.ts` — API call shapes dan error handling
- Component test `MeetingCheckInPage` — render states (loading, error 403/409/410, form, success)
- Component test `MeetingStatsCards` — tampilkan statistik dengan benar
- E2E test (Playwright) — alur lengkap: buat rapat → scan QR → check-in → lihat di detail page


---

## Design: Notulensi Rapat dan Foto Kegiatan

### Tabel `meeting_minutes` (Notulensi)

Menyimpan notulensi rapat dalam format HTML.

```sql
CREATE TABLE meeting_minutes (
    id                  BIGSERIAL PRIMARY KEY,
    meeting_id          BIGINT NOT NULL UNIQUE REFERENCES meetings(id) ON DELETE CASCADE,
    -- Konten notulensi dalam format HTML (dari rich text editor)
    content             TEXT NOT NULL,
    -- User yang membuat notulensi
    created_by          BIGINT NOT NULL REFERENCES users(id),
    -- User yang terakhir edit notulensi
    updated_by          BIGINT REFERENCES users(id),
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at          TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_meeting_minutes_meeting_id ON meeting_minutes(meeting_id);
CREATE INDEX idx_meeting_minutes_created_by ON meeting_minutes(created_by);
```

**Eloquent Model:** `MeetingMinutes`
- Traits: `SoftDeletes`, `AuditLogTrait`
- Relasi:
  - `belongsTo(Meeting)`
  - `belongsTo(User, 'created_by')`
  - `belongsTo(User, 'updated_by')`
- Casts: `created_at`, `updated_at` → `datetime`

---

### Tabel `meeting_photos` (Foto Kegiatan)

Menyimpan metadata foto kegiatan rapat.

```sql
CREATE TABLE meeting_photos (
    id                  BIGSERIAL PRIMARY KEY,
    meeting_id          BIGINT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    -- Path file di Laravel Storage (relative path: meetings/{meeting_id}/photos/{filename})
    file_path           VARCHAR(500) NOT NULL,
    -- Nama file original yang diupload
    original_filename   VARCHAR(255) NOT NULL,
    -- Ukuran file dalam bytes
    file_size           BIGINT NOT NULL,
    -- Dimensi gambar (width x height)
    width               INTEGER,
    height              INTEGER,
    -- MIME type (image/jpeg, image/png, etc)
    mime_type           VARCHAR(50),
    -- User yang upload foto
    uploaded_by         BIGINT NOT NULL REFERENCES users(id),
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at          TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_meeting_photos_meeting_id ON meeting_photos(meeting_id);
CREATE INDEX idx_meeting_photos_uploaded_by ON meeting_photos(uploaded_by);
```

**Eloquent Model:** `MeetingPhoto`
- Traits: `SoftDeletes`, `AuditLogTrait`
- Relasi:
  - `belongsTo(Meeting)`
  - `belongsTo(User, 'uploaded_by')`
- Casts: `created_at`, `updated_at` → `datetime`, `file_size` → `integer`, `width` → `integer`, `height` → `integer`

---

### Frontend Components untuk Notulensi

#### `MeetingMinutesEditor.tsx`

Rich text editor untuk membuat/edit notulensi menggunakan TipTap.

```typescript
interface MeetingMinutesEditorProps {
  meeting: Meeting;
  initialContent?: string;
  onSave: (content: string) => Promise<void>;
  isLoading?: boolean;
}

export const MeetingMinutesEditor: React.FC<MeetingMinutesEditorProps> = ({
  meeting,
  initialContent,
  onSave,
  isLoading,
}) => {
  // TipTap editor dengan toolbar: bold, italic, underline, heading, list, link
  // Auto-save draft ke localStorage setiap 30 detik
  // Tombol Simpan dan Batal
};
```

#### `MeetingMinutesView.tsx`

Tampilan read-only untuk notulensi.

```typescript
interface MeetingMinutesViewProps {
  meeting: Meeting;
  minutes: MeetingMinutes | null;
  canEdit: boolean;
  onEdit: () => void;
  onDownload: () => Promise<void>;
}

export const MeetingMinutesView: React.FC<MeetingMinutesViewProps> = ({
  meeting,
  minutes,
  canEdit,
  onEdit,
  onDownload,
}) => {
  // Tampilkan konten notulensi dalam format HTML
  // Tampilkan info: dibuat oleh, tanggal dibuat, terakhir diupdate
  // Tombol Edit (jika canEdit), Unduh DOCX
};
```

---

### Frontend Components untuk Foto Kegiatan

#### `MeetingPhotoGallery.tsx`

Galeri foto dengan grid layout dan lightbox.

```typescript
interface MeetingPhotoGalleryProps {
  meeting: Meeting;
  photos: MeetingPhoto[];
  canUpload: boolean;
  onUpload: (files: File[]) => Promise<void>;
  onDelete: (photoId: number) => Promise<void>;
  isLoading?: boolean;
}

export const MeetingPhotoGallery: React.FC<MeetingPhotoGalleryProps> = ({
  meeting,
  photos,
  canUpload,
  onUpload,
  onDelete,
  isLoading,
}) => {
  // Grid layout 3 kolom (responsive)
  // Thumbnail dengan hover effect
  // Tombol Unggah Foto (jika canUpload)
  // Lightbox modal untuk view full size
  // Tombol Hapus di setiap foto (jika canUpload)
  // Tombol Unduh Semua Foto (ZIP)
  // Indikator: X dari 50 foto
};
```

#### `MeetingPhotoUploader.tsx`

Komponen untuk upload foto dengan drag-and-drop.

```typescript
interface MeetingPhotoUploaderProps {
  meeting: Meeting;
  maxPhotos: number;
  currentPhotoCount: number;
  onUpload: (files: File[]) => Promise<void>;
  isLoading?: boolean;
}

export const MeetingPhotoUploader: React.FC<MeetingPhotoUploaderProps> = ({
  meeting,
  maxPhotos,
  currentPhotoCount,
  onUpload,
  isLoading,
}) => {
  // Drag-and-drop zone
  // File picker button
  // Validasi: format (JPEG, PNG, WebP, GIF), ukuran max 10MB
  // Progress bar untuk upload
  // Error handling dengan toast notification
};
```

---

### API Endpoints untuk Notulensi dan Foto

#### Notulensi Endpoints

| Method | Endpoint | Middleware | Deskripsi |
|---|---|---|---|
| `GET` | `/api/meetings/{meeting}/minutes` | `auth:sanctum` | Ambil notulensi rapat |
| `POST` | `/api/meetings/{meeting}/minutes` | `auth:sanctum, role:super_admin,admin_yayasan` | Buat notulensi baru |
| `PUT` | `/api/meetings/{meeting}/minutes` | `auth:sanctum, role:super_admin,admin_yayasan` | Update notulensi |
| `DELETE` | `/api/meetings/{meeting}/minutes` | `auth:sanctum, role:super_admin,admin_yayasan` | Hapus notulensi |
| `GET` | `/api/meetings/{meeting}/minutes/download` | `auth:sanctum` | Download notulensi sebagai DOCX |

#### Foto Endpoints

| Method | Endpoint | Middleware | Deskripsi |
|---|---|---|---|
| `GET` | `/api/meetings/{meeting}/photos` | `auth:sanctum` | Daftar foto rapat |
| `POST` | `/api/meetings/{meeting}/photos` | `auth:sanctum, role:super_admin,admin_yayasan` | Upload foto baru |
| `DELETE` | `/api/meetings/{meeting}/photos/{photo}` | `auth:sanctum, role:super_admin,admin_yayasan` | Hapus foto |
| `GET` | `/api/meetings/{meeting}/photos/download-all` | `auth:sanctum` | Download semua foto sebagai ZIP |

---

### Services untuk Notulensi dan Foto

#### `MeetingMinutesService`

```php
class MeetingMinutesService
{
    public function createOrUpdate(Meeting $meeting, string $content, User $user): MeetingMinutes
    {
        // Buat atau update notulensi
        // Sanitize HTML content menggunakan HTMLPurifier
        // Catat activity log
    }

    public function generateDocx(Meeting $meeting, MeetingMinutes $minutes): string
    {
        // Generate DOCX file menggunakan PHPWord
        // Include header rapat, konten notulensi
        // Return path file temporary
    }

    public function delete(Meeting $meeting): void
    {
        // Soft delete notulensi
        // Catat activity log
    }
}
```

#### `MeetingPhotoService`

```php
class MeetingPhotoService
{
    public function uploadPhotos(Meeting $meeting, array $files, User $user): Collection
    {
        // Validasi file (format, ukuran, jumlah total)
        // Simpan file ke storage
        // Generate thumbnail otomatis menggunakan Intervention Image
        // Buat record MeetingPhoto
        // Catat activity log
    }

    public function deletePhoto(MeetingPhoto $photo, User $user): void
    {
        // Hapus file dari storage
        // Soft delete record
        // Catat activity log
    }

    public function downloadAllPhotos(Meeting $meeting): string
    {
        // Buat ZIP file berisi semua foto
        // Return path file temporary
    }

    public function generateThumbnail(string $filePath): string
    {
        // Generate thumbnail 300x300px
        // Simpan ke storage
        // Return path thumbnail
    }
}
```

---

### TypeScript Types untuk Notulensi dan Foto

```typescript
export interface MeetingMinutes {
  id: number;
  meeting_id: number;
  content: string; // HTML content
  created_by: number;
  created_by_name: string;
  updated_by: number | null;
  updated_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface MeetingPhoto {
  id: number;
  meeting_id: number;
  file_path: string;
  thumbnail_path: string;
  original_filename: string;
  file_size: number;
  width: number;
  height: number;
  mime_type: string;
  uploaded_by: number;
  uploaded_by_name: string;
  created_at: string;
}

export interface MeetingPhotoUploadResponse {
  success: boolean;
  message: string;
  data: {
    photos: MeetingPhoto[];
    total_count: number;
    remaining_slots: number;
  };
}
```

---

### Integrasi ke Laporan PDF

#### Update `MeetingReportService`

```php
class MeetingReportService
{
    public function generatePdf(Meeting $meeting): string
    {
        // ... existing code untuk daftar hadir ...

        // Tambahkan halaman notulensi
        if ($meeting->minutes) {
            $this->addMinutesPage($phpWord, $meeting->minutes);
        }

        // Tambahkan halaman foto kegiatan
        if ($meeting->photos->count() > 0) {
            $this->addPhotosPage($phpWord, $meeting->photos);
        }

        return $tempPath;
    }

    private function addMinutesPage(PhpWord $phpWord, MeetingMinutes $minutes): void
    {
        $section = $phpWord->addSection();
        $section->addTitle('NOTULENSI RAPAT', 1);
        
        // Parse HTML content dan tambahkan ke dokumen
        // Preserve formatting (bold, italic, list, etc)
    }

    private function addPhotosPage(PhpWord $phpWord, Collection $photos): void
    {
        $section = $phpWord->addSection();
        $section->addTitle('FOTO KEGIATAN', 1);
        
        // Tambahkan foto dalam grid 2x2 per halaman
        // Maksimal 4 foto per halaman
        // Tambahkan caption di bawah setiap foto
    }
}
```

