# Design Document: WA Blast
## Overview

Fitur WA Blast memungkinkan pengguna SIMMACI dengan role `super_admin` dan `admin_yayasan` untuk mengirim pesan WhatsApp secara massal kepada kepala sekolah dan/atau guru (GTK) di jaringan madrasah LP Ma'arif NU Cilacap. Pengiriman dilakukan melalui **Go-WA** sebagai WhatsApp Gateway pihak ketiga.

Fitur ini mencakup:
- Pemilihan penerima berdasarkan kategori (Kepala Sekolah, GTK, atau keduanya) dengan filter per sekolah
- Komposisi pesan teks dengan dukungan template variabel (`{{nama}}`, `{{nama_sekolah}}`) dan lampiran PDF
- Penjadwalan pengiriman (segera atau terjadwal)
- Eksekusi pengiriman via Laravel Queue (background job) dengan jeda antar pesan
- Rate limiting (maks 500 penerima/sesi, 1.000 pesan/hari)
- Riwayat dan monitoring blast dengan progres real-time
- Manajemen template pesan (CRUD)
- Konfigurasi Go-WA Gateway (URL, API Token terenkripsi, nomor pengirim)
- Validasi dan normalisasi nomor WhatsApp ke format internasional Indonesia
- Retry pengiriman ke penerima yang gagal

### Keputusan Desain Utama

1. **Queue-based delivery**: Pengiriman dilakukan via `SendBlastJob` di Laravel Queue (database driver) agar tidak memblokir request HTTP. Jeda 2 detik antar pesan diimplementasikan di dalam job.
2. **Snapshot recipient list**: Daftar penerima disimpan sebagai snapshot di tabel `wa_blast_recipients` saat blast dibuat, bukan di-query ulang saat pengiriman. Ini memastikan konsistensi data meskipun data guru/sekolah berubah setelah blast dibuat.
3. **Konfigurasi terenkripsi**: API Token Go-WA disimpan terenkripsi menggunakan `encrypt()`/`decrypt()` Laravel (AES-256-CBC via APP_KEY).
4. **Non-tenant-scoped blast**: Karena fitur ini hanya untuk `super_admin` dan `admin_yayasan` yang memiliki akses lintas sekolah, model `WaBlast` tidak menggunakan `HasTenantScope`. Akses dikontrol via middleware `role:super_admin,admin_yayasan`.
5. **Template tidak terikat ke blast**: Saat template dipilih, isinya di-copy ke `message_body` blast. Perubahan template setelah blast dibuat tidak memengaruhi blast yang sudah ada.

---

## Architecture

### Diagram Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────────────┐
│                         HTTP Request                                 │
│              (super_admin / admin_yayasan)                           │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────────┐
│                    Middleware Stack                                   │
│  auth:sanctum → role:super_admin,admin_yayasan                       │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────────┐
│              WaBlastController / WaBlastTemplateController           │
│              WaBlastConfigController                                 │
│  - Validasi input via FormRequest                                    │
│  - Delegasi ke Service Layer                                         │
│  - Return ApiResponse                                                │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────────┐
│                  WaBlastService / WaBlastTemplateService             │
│  - Kompilasi recipient list (query + normalisasi + deduplication)    │
│  - Validasi rate limit (per-sesi dan harian)                         │
│  - Dispatch SendBlastJob ke queue                                    │
│  - Manajemen template                                                │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
          ┌────────────────┴────────────────┐
          │                                 │
┌─────────▼──────────┐           ┌──────────▼──────────────┐
│  WaBlastRepository │           │  GoWaGatewayService      │
│  WaBlastTemplate   │           │  (HTTP Client ke Go-WA)  │
│  Repository        │           │  - sendText()            │
│  - Query Eloquent  │           │  - sendFile()            │
│  - Filter/paginate │           │  - testConnection()      │
└─────────┬──────────┘           └──────────┬──────────────┘
          │                                 │
┌─────────▼──────────┐           ┌──────────▼──────────────┐
│  PostgreSQL DB     │           │  Go-WA Gateway API       │
│  wa_blasts         │           │  (External Service)      │
│  wa_blast_recipients│          └─────────────────────────┘
│  wa_blast_templates│
│  wa_blast_configs  │
└────────────────────┘
```

### Alur Pengiriman Blast

```
Pengguna konfirmasi kirim
         │
         ▼
WaBlastController::store()
         │
         ▼
WaBlastService::createBlast()
  ├─ Kompilasi recipients (query schools/teachers)
  ├─ Normalisasi nomor WA (PhoneNormalizer)
  ├─ Deduplication
  ├─ Validasi: max 500/sesi, daily limit 1000
  ├─ Simpan WaBlast (status: sending/scheduled)
  ├─ Simpan WaBlastRecipient[] (status: pending)
  └─ Upload PDF ke Storage (jika ada lampiran)
         │
         ▼ (jika segera)
SendBlastJob::dispatch($blastId)
         │
         ▼ (diproses oleh queue worker)
SendBlastJob::handle()
  ├─ Load konfigurasi Go-WA (decrypt token)
  ├─ Untuk setiap recipient (berurutan):
  │   ├─ Substitusi template variabel
  │   ├─ Kirim via GoWaGatewayService
  │   ├─ Update delivery_status (sent/failed/invalid_number)
  │   └─ Sleep 2 detik
  └─ Update blast_status → completed/failed
```

### Alur Penjadwalan

```
Pengguna simpan blast terjadwal
         │
         ▼
WaBlast disimpan dengan status: scheduled
         │
         ▼ (setiap menit via Laravel Scheduler)
ProcessScheduledBlastsCommand::handle()
  └─ Query WaBlast WHERE status=scheduled AND scheduled_at <= now()
       └─ Dispatch SendBlastJob untuk setiap blast yang waktunya tiba
```


---

## Components and Interfaces

### Backend Components

#### Controllers (`app/Http/Controllers/Api/`)

| Controller | Tanggung Jawab |
|---|---|
| `WaBlastController` | CRUD blast session, preview recipient, konfirmasi kirim, retry |
| `WaBlastTemplateController` | CRUD message template |
| `WaBlastConfigController` | Baca/simpan konfigurasi Go-WA, test koneksi |

#### Services (`app/Services/`)

| Service | Tanggung Jawab |
|---|---|
| `WaBlastService` | Orkestrasi pembuatan blast: kompilasi recipient, validasi rate limit, dispatch job |
| `WaBlastTemplateService` | CRUD template dengan validasi uniqueness nama |
| `WaBlastConfigService` | Enkripsi/dekripsi token, simpan/baca konfigurasi |
| `GoWaGatewayService` | HTTP client ke Go-WA API: `sendText()`, `sendFile()`, `testConnection()` |
| `PhoneNormalizerService` | Normalisasi dan validasi nomor WA ke format `62[0-9]{9,13}` |
| `RecipientCompilerService` | Query schools/teachers, normalisasi, deduplication, filter invalid |

#### Repositories (`app/Repositories/`)

| Repository | Interface | Tanggung Jawab |
|---|---|---|
| `WaBlastRepository` | `WaBlastRepositoryInterface` | Query, filter, paginate blast sessions |
| `WaBlastRecipientRepository` | `WaBlastRecipientRepositoryInterface` | Query recipient per blast, update delivery status |
| `WaBlastTemplateRepository` | `WaBlastTemplateRepositoryInterface` | CRUD template, cek uniqueness nama |
| `WaBlastConfigRepository` | `WaBlastConfigRepositoryInterface` | Baca/tulis konfigurasi singleton |

#### Jobs (`app/Jobs/`)

| Job | Tanggung Jawab |
|---|---|
| `SendBlastJob` | Proses pengiriman per recipient secara berurutan, update delivery status, sleep 2 detik antar pesan |

#### Artisan Commands (`app/Console/Commands/`)

| Command | Tanggung Jawab |
|---|---|
| `ProcessScheduledBlastsCommand` | Dijalankan setiap menit via scheduler; dispatch `SendBlastJob` untuk blast berstatus `scheduled` yang waktunya sudah tiba |

#### Form Requests (`app/Http/Requests/WaBlast/`)

| Request Class | Digunakan Oleh |
|---|---|
| `StoreWaBlastRequest` | `WaBlastController::store()` |
| `PreviewRecipientsRequest` | `WaBlastController::previewRecipients()` |
| `StoreWaBlastTemplateRequest` | `WaBlastTemplateController::store()` |
| `UpdateWaBlastTemplateRequest` | `WaBlastTemplateController::update()` |
| `StoreWaBlastConfigRequest` | `WaBlastConfigController::store()` |

#### Models (`app/Models/`)

| Model | Tabel | Traits |
|---|---|---|
| `WaBlast` | `wa_blasts` | `SoftDeletes`, `AuditLogTrait` |
| `WaBlastRecipient` | `wa_blast_recipients` | `SoftDeletes` |
| `WaBlastTemplate` | `wa_blast_templates` | `SoftDeletes` |
| `WaBlastConfig` | `wa_blast_configs` | — |

---

### Frontend Components

#### Pages (`src/features/wa-blast/`)

| File | Deskripsi |
|---|---|
| `WaBlastListPage.tsx` | Daftar blast session dengan filter status dan rentang tanggal |
| `WaBlastCreatePage.tsx` | Form pembuatan blast: pilih penerima, tulis pesan, jadwal |
| `WaBlastDetailPage.tsx` | Detail blast: isi pesan, daftar recipient + delivery status, progres real-time |
| `WaBlastTemplatePage.tsx` | Daftar dan CRUD message template |
| `WaBlastConfigPage.tsx` | Form konfigurasi Go-WA (hanya `super_admin`) |

#### Components (`src/features/wa-blast/components/`)

| File | Deskripsi |
|---|---|
| `RecipientSelector.tsx` | Pilih kategori (Kepala Sekolah / GTK / Keduanya) + filter sekolah |
| `RecipientPreviewTable.tsx` | Tabel preview penerima dengan jumlah valid/invalid, tombol hapus per baris |
| `MessageComposer.tsx` | Textarea pesan + counter karakter + tombol sisipkan variabel |
| `TemplatePickerModal.tsx` | Modal/dropdown pencarian dan pemilihan template |
| `AttachmentUploader.tsx` | Upload PDF dengan validasi tipe dan ukuran (maks 10 MB) |
| `ScheduleSelector.tsx` | Toggle segera/terjadwal + datetime picker |
| `BlastStatusBadge.tsx` | Badge berwarna untuk setiap `blast_status` |
| `DeliveryStatusBadge.tsx` | Badge berwarna untuk setiap `delivery_status` |
| `BlastProgressBar.tsx` | Progress bar sent/total dengan auto-refresh setiap 5 detik |
| `RecipientDetailTable.tsx` | Tabel recipient di halaman detail dengan kolom nama, sekolah, nomor, status |
| `GoWaConfigForm.tsx` | Form konfigurasi URL, token, nomor pengirim + tombol test koneksi |
| `TemplateForm.tsx` | Form buat/edit template dengan keterangan variabel yang tersedia |

#### Hooks (`src/features/wa-blast/hooks/`)

| File | Deskripsi |
|---|---|
| `useWaBlasts.ts` | TanStack Query: list blast sessions dengan filter |
| `useWaBlast.ts` | TanStack Query: detail satu blast session |
| `useWaBlastProgress.ts` | Polling setiap 5 detik untuk blast berstatus `sending` |
| `useWaBlastTemplates.ts` | TanStack Query: list dan CRUD template |
| `useWaBlastConfig.ts` | TanStack Query: baca/simpan konfigurasi Go-WA |
| `useRecipientPreview.ts` | Mutation untuk preview recipient sebelum blast dibuat |

#### Services (`src/features/wa-blast/services/`)

| File | Deskripsi |
|---|---|
| `waBlastService.ts` | Semua API calls untuk blast session via `apiClient` |
| `waBlastTemplateService.ts` | API calls untuk template management |
| `waBlastConfigService.ts` | API calls untuk konfigurasi Go-WA |

#### Types (`src/features/wa-blast/types/`)

| File | Deskripsi |
|---|---|
| `waBlast.types.ts` | TypeScript interfaces: `WaBlast`, `WaBlastRecipient`, `WaBlastTemplate`, `WaBlastConfig`, `RecipientPreview`, enum `BlastStatus`, `DeliveryStatus` |

---

## API Endpoints

Semua endpoint diproteksi dengan `auth:sanctum` dan `role:super_admin,admin_yayasan`, kecuali endpoint konfigurasi yang memerlukan `role:super_admin`.

### Blast Session

| Method | Endpoint | Controller Method | Deskripsi |
|---|---|---|---|
| `GET` | `/api/wa-blasts` | `index` | Daftar blast session (paginated, filter: status, date_from, date_to) |
| `POST` | `/api/wa-blasts` | `store` | Buat blast session baru (segera atau terjadwal) |
| `GET` | `/api/wa-blasts/{id}` | `show` | Detail blast session |
| `DELETE` | `/api/wa-blasts/{id}` | `destroy` | Batalkan blast berstatus `scheduled` atau `draft` |
| `POST` | `/api/wa-blasts/preview-recipients` | `previewRecipients` | Preview daftar penerima sebelum blast dibuat |
| `POST` | `/api/wa-blasts/{id}/retry` | `retry` | Buat blast baru dari recipient yang `failed` |
| `GET` | `/api/wa-blasts/{id}/progress` | `progress` | Progres pengiriman (sent_count, failed_count, total_count, status) |

**Request Body `POST /api/wa-blasts`:**
```json
{
  "title": "Pengumuman Rapat Koordinasi",
  "recipient_category": "both",
  "jenjang": ["MI", "MTs"],
  "school_ids": [1, 2, 3],
  "message_body": "Yth. {{nama}} dari {{nama_sekolah}}, ...",
  "attachment_path": "wa-blasts/attachments/surat-edaran.pdf",
  "scheduled_at": null,
  "excluded_phone_numbers": ["628123456789"]
}
```

**Request Body `POST /api/wa-blasts/preview-recipients`:**
```json
{
  "recipient_category": "kepala_sekolah",
  "jenjang": ["MI"],
  "school_ids": []
}
```

**Response `GET /api/wa-blasts/{id}/progress`:**
```json
{
  "success": true,
  "data": {
    "blast_status": "sending",
    "total_count": 120,
    "sent_count": 45,
    "failed_count": 2,
    "pending_count": 73,
    "invalid_count": 0
  }
}
```

---

### Message Template

| Method | Endpoint | Controller Method | Deskripsi |
|---|---|---|---|
| `GET` | `/api/wa-blast-templates` | `index` | Daftar semua template (dengan cuplikan 100 karakter) |
| `POST` | `/api/wa-blast-templates` | `store` | Buat template baru |
| `GET` | `/api/wa-blast-templates/{id}` | `show` | Detail template |
| `PUT` | `/api/wa-blast-templates/{id}` | `update` | Update template |
| `DELETE` | `/api/wa-blast-templates/{id}` | `destroy` | Hapus template |

**Request Body `POST /api/wa-blast-templates`:**
```json
{
  "name": "Undangan Rapat",
  "body": "Yth. {{nama}} dari {{nama_sekolah}}, ..."
}
```

---

### Konfigurasi Go-WA

Endpoint ini hanya dapat diakses oleh `super_admin`.

| Method | Endpoint | Controller Method | Deskripsi |
|---|---|---|---|
| `GET` | `/api/wa-blast-config` | `show` | Baca konfigurasi (token ditampilkan sebagai `***`) |
| `POST` | `/api/wa-blast-config` | `store` | Simpan/update konfigurasi (token dienkripsi sebelum disimpan) |
| `POST` | `/api/wa-blast-config/test` | `testConnection` | Uji koneksi ke Go-WA dengan konfigurasi tersimpan |

**Request Body `POST /api/wa-blast-config`:**
```json
{
  "api_url": "https://go-wa.example.com",
  "api_token": "secret-token-here",
  "sender_number": "6281234567890",
  "max_recipients_per_session": 500,
  "max_daily_messages": 1000
}
```

---

## Data Models

### Tabel `wa_blasts`

Menyimpan satu sesi pengiriman blast.

```sql
CREATE TABLE wa_blasts (
    id              BIGSERIAL PRIMARY KEY,
    title           VARCHAR(255) NOT NULL,
    -- Kategori penerima: 'kepala_sekolah', 'gtk', 'both'
    recipient_category VARCHAR(20) NOT NULL,
    -- JSON array of school IDs yang dipilih; null = semua sekolah
    school_ids      JSONB,
    -- JSON array of jenjang yang dipilih; null = semua jenjang. Contoh: ["MI", "MTs"]
    jenjang_filter  JSONB,
    message_body    TEXT NOT NULL,
    -- Path file PDF di Laravel Storage (nullable jika tidak ada lampiran)
    attachment_path VARCHAR(500),
    attachment_name VARCHAR(255),
    -- Status blast: draft, scheduled, sending, completed, failed
    blast_status    VARCHAR(20) NOT NULL DEFAULT 'draft',
    -- Waktu pengiriman terjadwal; null = segera
    scheduled_at    TIMESTAMP WITH TIME ZONE,
    -- Waktu pengiriman benar-benar dimulai
    sent_at         TIMESTAMP WITH TIME ZONE,
    -- Waktu pengiriman selesai (semua recipient diproses)
    completed_at    TIMESTAMP WITH TIME ZONE,
    -- Snapshot jumlah penerima saat blast dibuat
    total_recipients INTEGER NOT NULL DEFAULT 0,
    sent_count      INTEGER NOT NULL DEFAULT 0,
    failed_count    INTEGER NOT NULL DEFAULT 0,
    invalid_count   INTEGER NOT NULL DEFAULT 0,
    -- Referensi ke blast asal jika ini adalah retry blast
    parent_blast_id BIGINT REFERENCES wa_blasts(id) ON DELETE SET NULL,
    -- User yang membuat blast
    created_by      BIGINT NOT NULL REFERENCES users(id),
    error_message   TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at      TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_wa_blasts_status ON wa_blasts(blast_status);
CREATE INDEX idx_wa_blasts_scheduled_at ON wa_blasts(scheduled_at) WHERE blast_status = 'scheduled';
CREATE INDEX idx_wa_blasts_created_by ON wa_blasts(created_by);
CREATE INDEX idx_wa_blasts_created_at ON wa_blasts(created_at);
```

**Eloquent Model:** `WaBlast`
- Relasi: `hasMany(WaBlastRecipient)`, `belongsTo(User, 'created_by')`, `belongsTo(WaBlast, 'parent_blast_id')`
- Casts: `school_ids` → `array`, `jenjang_filter` → `array`, `scheduled_at`/`sent_at`/`completed_at` → `datetime`
- Traits: `SoftDeletes`, `AuditLogTrait`

---

### Tabel `wa_blast_recipients`

Snapshot daftar penerima per blast. Satu baris = satu penerima.

```sql
CREATE TABLE wa_blast_recipients (
    id              BIGSERIAL PRIMARY KEY,
    wa_blast_id     BIGINT NOT NULL REFERENCES wa_blasts(id) ON DELETE CASCADE,
    -- Nama penerima (snapshot saat blast dibuat)
    recipient_name  VARCHAR(255) NOT NULL,
    -- Nama sekolah penerima (snapshot)
    school_name     VARCHAR(255) NOT NULL,
    -- Nomor WA yang sudah dinormalisasi (format: 62xxxxxxxxx)
    phone_number    VARCHAR(20) NOT NULL,
    -- Tipe sumber: 'kepala_sekolah' atau 'gtk'
    recipient_type  VARCHAR(20) NOT NULL,
    -- Status pengiriman: pending, sent, failed, invalid_number
    delivery_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- Pesan error dari Go-WA jika gagal
    error_message   TEXT,
    -- Waktu pesan berhasil terkirim
    sent_at         TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at      TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_wa_blast_recipients_blast_id ON wa_blast_recipients(wa_blast_id);
CREATE INDEX idx_wa_blast_recipients_status ON wa_blast_recipients(delivery_status);
CREATE INDEX idx_wa_blast_recipients_phone ON wa_blast_recipients(phone_number);
```

**Eloquent Model:** `WaBlastRecipient`
- Relasi: `belongsTo(WaBlast)`
- Traits: `SoftDeletes`

---

### Tabel `wa_blast_templates`

Template pesan yang dapat digunakan ulang.

```sql
CREATE TABLE wa_blast_templates (
    id          BIGSERIAL PRIMARY KEY,
    -- Nama unik template (case-insensitive uniqueness di level aplikasi)
    name        VARCHAR(255) NOT NULL,
    body        TEXT NOT NULL,
    created_by  BIGINT NOT NULL REFERENCES users(id),
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at  TIMESTAMP WITH TIME ZONE
);

CREATE UNIQUE INDEX idx_wa_blast_templates_name ON wa_blast_templates(LOWER(name)) WHERE deleted_at IS NULL;
CREATE INDEX idx_wa_blast_templates_created_at ON wa_blast_templates(created_at);
```

**Eloquent Model:** `WaBlastTemplate`
- Relasi: `belongsTo(User, 'created_by')`
- Traits: `SoftDeletes`

---

### Tabel `wa_blast_configs`

Konfigurasi Go-WA Gateway. Hanya ada satu baris (singleton).

```sql
CREATE TABLE wa_blast_configs (
    id                          BIGSERIAL PRIMARY KEY,
    -- URL endpoint API Go-WA
    api_url                     VARCHAR(500) NOT NULL,
    -- API Token terenkripsi menggunakan Laravel encrypt()
    api_token_encrypted         TEXT NOT NULL,
    -- Nomor pengirim (device/sender number) dalam format 62xxxxxxxxx
    sender_number               VARCHAR(20) NOT NULL,
    -- Batas maksimal penerima per sesi (default: 500)
    max_recipients_per_session  INTEGER NOT NULL DEFAULT 500,
    -- Batas maksimal pesan per hari (default: 1000)
    max_daily_messages          INTEGER NOT NULL DEFAULT 1000,
    updated_by                  BIGINT REFERENCES users(id),
    created_at                  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at                  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Eloquent Model:** `WaBlastConfig`
- Tidak menggunakan `SoftDeletes` (singleton, tidak dihapus)
- Method helper: `getDecryptedToken(): string` — memanggil `decrypt($this->api_token_encrypted)`
- Tidak ada relasi tenant (`school_id`), karena konfigurasi bersifat global

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Normalisasi nomor WA selalu menghasilkan format valid

*For any* string nomor telepon yang diawali dengan `0`, `+62`, atau `62` (dengan atau tanpa spasi dan tanda hubung), fungsi normalisasi `PhoneNormalizerService` SHALL menghasilkan string yang cocok dengan pola `^62[0-9]{9,13}$`.

**Validates: Requirements 8.1, 8.2, 8.3**

---

### Property 2: Nomor tidak valid ditandai `invalid_number`

*For any* string nomor telepon yang setelah normalisasi tidak cocok dengan pola `^62[0-9]{9,13}$`, `RecipientCompilerService` SHALL menandai recipient tersebut dengan `delivery_status = invalid_number` dan tidak menyertakannya dalam antrian pengiriman.

**Validates: Requirements 8.4**

---

### Property 3: Deduplication memastikan tidak ada nomor duplikat dalam satu blast

*For any* daftar penerima yang dikompilasi (dari kepala sekolah, GTK, atau keduanya), setelah proses deduplication, setiap nomor WhatsApp yang sudah dinormalisasi SHALL muncul paling banyak satu kali dalam `wa_blast_recipients` untuk satu `wa_blast_id` yang sama.

**Validates: Requirements 1.6**

---

### Property 4: Rate limit per sesi tidak pernah dilampaui

*For any* upaya pembuatan blast session, jika jumlah recipient yang valid melebihi nilai `max_recipients_per_session` yang tersimpan di `wa_blast_configs`, `WaBlastService` SHALL menolak pembuatan blast dan mengembalikan error validasi, sehingga tidak ada `WaBlast` yang tersimpan dengan `total_recipients > max_recipients_per_session`.

**Validates: Requirements 5.1, 5.2**

---

### Property 5: Substitusi template variabel selalu menghasilkan pesan yang mengandung nilai aktual

*For any* `message_body` yang mengandung `{{nama}}` dan/atau `{{nama_sekolah}}`, dan *for any* recipient dengan `recipient_name` dan `school_name` yang tidak kosong, hasil substitusi SHALL mengandung nilai `recipient_name` di posisi `{{nama}}` dan nilai `school_name` di posisi `{{nama_sekolah}}`, tanpa menyisakan placeholder yang belum disubstitusi.

**Validates: Requirements 2.2**

---

### Property 6: Template round-trip menjaga konsistensi data

*For any* `name` dan `body` template yang valid (tidak kosong, nama unik), setelah operasi create diikuti retrieve, data yang dikembalikan SHALL identik dengan data yang disimpan — nama dan isi pesan tidak berubah.

**Validates: Requirements 11.2, 11.4**

---

### Property 7: Filter kategori penerima hanya mengambil data yang sesuai

*For any* pilihan kategori `kepala_sekolah`, `RecipientCompilerService` SHALL hanya menghasilkan recipient dari kolom `kepala_whatsapp` pada tabel `schools` (tidak ada data dari `teachers`). Sebaliknya, untuk kategori `gtk`, SHALL hanya menghasilkan recipient dari `teachers` dengan `is_active = true` (tidak ada data dari `schools`).

**Validates: Requirements 1.2, 1.3**

---

## Error Handling

### Kegagalan Go-WA Gateway

| Skenario | Penanganan |
|---|---|
| Go-WA tidak dapat dihubungi (timeout > 30 detik) | `SendBlastJob` menandai blast sebagai `failed`, menyimpan `error_message = "Go-WA Gateway tidak dapat dihubungi."`, menghentikan pengiriman |
| Go-WA mengembalikan error untuk satu recipient | `delivery_status` recipient diset `failed`, `error_message` disimpan, pengiriman ke recipient berikutnya dilanjutkan |
| Go-WA menolak nomor (format tidak valid) | `delivery_status` diset `invalid_number`, pengiriman dilanjutkan |
| Go-WA mengembalikan HTTP 401/403 | Blast ditandai `failed` dengan pesan "Autentikasi Go-WA gagal. Periksa konfigurasi API Token." |

### Kegagalan Upload Lampiran

| Skenario | Penanganan |
|---|---|
| File bukan PDF | Validasi di `StoreWaBlastRequest` menolak request dengan pesan "File harus berformat PDF." |
| File > 10 MB | Validasi menolak dengan pesan "Ukuran file maksimal 10 MB." |
| Storage tidak tersedia saat upload | Exception ditangkap, response 500 dengan pesan "Gagal mengunggah lampiran. Coba lagi." |

### Kegagalan Queue Job

- `SendBlastJob` menggunakan `tries = 1` (tidak di-retry otomatis oleh queue) karena pengiriman ulang harus dilakukan secara eksplisit oleh pengguna via tombol "Kirim Ulang ke yang Gagal".
- Jika job gagal karena exception tak terduga, blast diset `failed` dan exception dicatat di `error_message`.

### Validasi Input

| Kondisi | Response |
|---|---|
| Isi pesan kosong | HTTP 422, `"Isi pesan tidak boleh kosong."` |
| Pesan > 4.096 karakter | HTTP 422, `"Pesan terlalu panjang. Maksimal 4.096 karakter."` |
| `scheduled_at` di masa lalu | HTTP 422, `"Waktu pengiriman harus di masa mendatang."` |
| Jumlah recipient > batas sesi | HTTP 422, `"Jumlah penerima melebihi batas maksimal {n} per sesi."` |
| Konfigurasi Go-WA belum diisi | HTTP 422, `"Konfigurasi Go-WA Gateway belum diatur."` |
| Nama template sudah digunakan | HTTP 422, `"Nama template sudah digunakan. Gunakan nama yang berbeda."` |
| Akses oleh role tidak berwenang | HTTP 403, `"Aksi ini tidak diizinkan."` |

---

## Testing Strategy

### Unit Tests (PHPUnit)

Fokus pada logika bisnis yang terisolasi:

- `PhoneNormalizerServiceTest` — contoh konkret normalisasi: `0812...` → `62812...`, `+62812...` → `62812...`, nomor dengan spasi/tanda hubung, nomor terlalu pendek/panjang
- `RecipientCompilerServiceTest` — filter kategori, deduplication, penanganan nomor kosong
- `WaBlastServiceTest` — validasi rate limit, pembuatan blast, dispatch job
- `WaBlastTemplateServiceTest` — uniqueness nama, CRUD
- `WaBlastConfigServiceTest` — enkripsi/dekripsi token
- `SendBlastJobTest` — substitusi variabel, update delivery status, penanganan error Go-WA

### Property-Based Tests (PHPUnit + eris/eris atau spatie/phpunit-snapshot-assertions)

Library yang digunakan: **[eris/eris](https://github.com/giorgiosironi/eris)** — property-based testing library untuk PHP.

Setiap property test dikonfigurasi minimum **100 iterasi**.

Tag format komentar: `// Feature: wa-blast, Property {N}: {property_text}`

**Property 1 — Normalisasi nomor WA:**
```php
// Feature: wa-blast, Property 1: Normalisasi nomor WA selalu menghasilkan format valid
$this->forAll(
    Generator\elements('0', '+62', '62'),  // awalan
    Generator\choose(9, 13),               // panjang digit setelah awalan
)->then(function (string $prefix, int $length) {
    $digits = str_repeat('8', $length);
    $input = $prefix . $digits;
    $result = $this->normalizer->normalize($input);
    $this->assertMatchesRegularExpression('/^62[0-9]{9,13}$/', $result);
});
```

**Property 2 — Nomor tidak valid ditandai `invalid_number`:**
```php
// Feature: wa-blast, Property 2: Nomor tidak valid ditandai invalid_number
// Generate strings yang tidak bisa menjadi nomor WA valid setelah normalisasi
```

**Property 3 — Deduplication:**
```php
// Feature: wa-blast, Property 3: Deduplication memastikan tidak ada nomor duplikat
$this->forAll(
    Generator\vector(50, Generator\elements($phonePool))  // list dengan duplikat
)->then(function (array $phones) {
    $result = $this->compiler->deduplicate($phones);
    $this->assertCount(count(array_unique($result)), $result);
});
```

**Property 4 — Rate limit per sesi:**
```php
// Feature: wa-blast, Property 4: Rate limit per sesi tidak pernah dilampaui
$this->forAll(
    Generator\choose(501, 1000)  // jumlah recipient melebihi batas
)->then(function (int $count) {
    $this->expectException(ValidationException::class);
    $this->service->validateSessionLimit($count, maxLimit: 500);
});
```

**Property 5 — Substitusi template variabel:**
```php
// Feature: wa-blast, Property 5: Substitusi template variabel selalu menghasilkan pesan yang mengandung nilai aktual
$this->forAll(
    Generator\string(),  // nama penerima
    Generator\string()   // nama sekolah
)->then(function (string $nama, string $namaSekolah) {
    $template = 'Yth. {{nama}} dari {{nama_sekolah}}.';
    $result = $this->service->substituteVariables($template, $nama, $namaSekolah);
    $this->assertStringContainsString($nama, $result);
    $this->assertStringContainsString($namaSekolah, $result);
    $this->assertStringNotContainsString('{{nama}}', $result);
    $this->assertStringNotContainsString('{{nama_sekolah}}', $result);
});
```

### Integration Tests

- `WaBlastControllerTest` — endpoint CRUD blast, preview recipient, retry
- `WaBlastTemplateControllerTest` — endpoint CRUD template, uniqueness constraint
- `WaBlastConfigControllerTest` — simpan konfigurasi, test koneksi (mock Go-WA)
- `SendBlastJobIntegrationTest` — job end-to-end dengan mock `GoWaGatewayService`

### Frontend Tests

- Unit test komponen `PhoneNormalizerService` (TypeScript) jika ada logika normalisasi di sisi frontend
- Integration test form `WaBlastCreatePage` dengan React Testing Library: validasi field, preview recipient, submit
- E2E test (Playwright): alur lengkap buat blast → konfirmasi → monitoring progres
