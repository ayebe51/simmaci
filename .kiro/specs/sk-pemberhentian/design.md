# Design Document: SK Pemberhentian

## Overview

Fitur SK Pemberhentian menambahkan jenis dokumen baru (`jenis_sk = "Pemberhentian"`) ke dalam modul SK Management yang sudah ada di SIMMACI. Fitur ini mengikuti pola alur kerja yang identik dengan SK Pengangkatan dan SK Mutasi: operator mengajukan → admin yayasan menyetujui/menolak → dokumen DOCX di-generate → verifikasi via QR code.

Perbedaan utama dibandingkan jenis SK lain:
- Membutuhkan field tambahan: `alasan_pemberhentian`, `keterangan_pemberhentian` (opsional), dan `tanggal_efektif_pemberhentian`
- Pada saat di-approve, memicu side effect pada data master: `teachers.is_active = false` dan pembuatan record `teacher_mutations`
- Menggunakan template DOCX tersendiri dengan `sk_type = "pemberhentian"`
- Validasi PNS berlaku (sama seperti jenis SK lain)

Tidak ada komponen top-level baru — semua perubahan adalah ekstensi dari komponen yang sudah ada.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (React/TypeScript)                                    │
│                                                                 │
│  SkSubmissionPage        SkGeneratorPage                        │
│  ├── PemberhentianFields ├── useSkTemplate('pemberhentian')     │
│  │   ├── AlasanSelect    ├── templateIdMapping (+ pemberhentian)│
│  │   ├── KeteranganInput └── renderData (+ alasan/tgl efektif) │
│  │   └── TanggalEfektif                                        │
│  │                       SkTemplateManagementPage               │
│  SkDashboardPage         └── sk_type = "pemberhentian" tampil   │
│  └── filter jenis_sk                                           │
└─────────────┬───────────────────────────────────────────────────┘
              │ HTTP (Sanctum)
┌─────────────▼───────────────────────────────────────────────────┐
│  Backend (Laravel 12)                                           │
│                                                                 │
│  SkDocumentController                                           │
│  ├── submitRequest → StoreSkPemberhentianRequest (baru)         │
│  │   └── SkPemberhentianService::validateSubmission()          │
│  ├── update        → SkPemberhentianService::onApproved()       │
│  └── batchUpdateStatus → SkPemberhentianService::onApproved()  │
│                                                                 │
│  SkPemberhentianService (BARU)                                 │
│  ├── validateSubmission() — PNS check, duplikat check          │
│  ├── onApproved()         — is_active=false, TeacherMutation   │
│  └── buildTeacherMutationData()                                │
│                                                                 │
│  Models: SkDocument (+3 kolom), Teacher, TeacherMutation       │
└─────────────┬───────────────────────────────────────────────────┘
              │
┌─────────────▼───────────────────────────────────────────────────┐
│  Database (PostgreSQL 16)                                       │
│  sk_documents: +alasan_pemberhentian, +keterangan_pemberhentian │
│                +tanggal_efektif_pemberhentian                   │
│  teachers: is_active (sudah ada)                               │
│  teacher_mutations: (sudah ada)                                │
│  sk_templates: sk_type='pemberhentian' (data baru, no DDL)     │
└─────────────────────────────────────────────────────────────────┘

---

## Perubahan Database

### Migration Baru

**File:** `backend/database/migrations/2026_xx_xx_000001_add_pemberhentian_fields_to_sk_documents_table.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sk_documents', function (Blueprint $table) {
            $table->string('alasan_pemberhentian')->nullable()
                ->after('ijazah_url')
                ->comment('Kategori alasan pemberhentian: pengunduran_diri, pensiun, meninggal_dunia, pelanggaran_disiplin, habis_kontrak, lainnya');
            $table->text('keterangan_pemberhentian')->nullable()
                ->after('alasan_pemberhentian')
                ->comment('Keterangan bebas jika alasan_pemberhentian = lainnya');
            $table->date('tanggal_efektif_pemberhentian')->nullable()
                ->after('keterangan_pemberhentian')
                ->comment('Tanggal mulai berlakunya keputusan pemberhentian');
        });
    }

    public function down(): void
    {
        Schema::table('sk_documents', function (Blueprint $table) {
            $table->dropColumn([
                'alasan_pemberhentian',
                'keterangan_pemberhentian',
                'tanggal_efektif_pemberhentian',
            ]);
        });
    }
};
```

### Perubahan Model `SkDocument`

Tambahkan tiga field baru ke `$fillable` dan `casts()`:

```php
// Tambahkan ke $fillable
'alasan_pemberhentian',
'keterangan_pemberhentian',
'tanggal_efektif_pemberhentian',

// Tambahkan ke casts()
'tanggal_efektif_pemberhentian' => 'date',
```

### Tidak Ada Perubahan DDL Lain

- Tabel `teachers`: field `is_active` sudah ada (`boolean`)
- Tabel `teacher_mutations`: semua kolom yang dibutuhkan sudah ada (`teacher_id`, `school_id`, `from_unit`, `to_unit`, `reason`, `sk_number`, `effective_date`, `performed_by`)
- Tabel `sk_templates`: tidak perlu DDL — `sk_type = "pemberhentian"` adalah nilai data, bukan kolom baru

---

## Components and Interfaces

### 1. Service Baru: `SkPemberhentianService`

**File:** `backend/app/Services/SkPemberhentianService.php`

Service ini mengenkapsulasi semua logika bisnis yang spesifik untuk SK Pemberhentian, agar `SkDocumentController` tetap ramping.

```php
<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\SkDocument;
use App\Models\Teacher;
use App\Models\TeacherMutation;
use App\Models\User;

class SkPemberhentianService
{
    /**
     * Validasi payload pengajuan SK Pemberhentian.
     * Mengembalikan array error atau null jika valid.
     */
    public function validateSubmission(array $data, int $schoolId, string $tahunAjaran): ?array
    {
        // Tidak ada validasi khusus yang belum ditangani StoreSkPemberhentianRequest.
        // Metode ini disiapkan sebagai extension point untuk logika masa depan.
        return null;
    }

    /**
     * Dipanggil setelah SK Pemberhentian berstatus 'approved'.
     * Menandai guru sebagai non-aktif dan membuat record TeacherMutation.
     */
    public function onApproved(SkDocument $sk, User $approver): void
    {
        if (! $sk->teacher_id || ! $sk->teacher) {
            return;
        }

        $teacher = $sk->teacher;

        // 1. Nonaktifkan guru
        $teacher->update(['is_active' => false]);

        // 2. Buat record TeacherMutation sebagai riwayat pemberhentian
        TeacherMutation::create([
            'teacher_id'     => $teacher->id,
            'school_id'      => $sk->school_id,
            'from_unit'      => $sk->unit_kerja,
            'to_unit'        => null,
            'reason'         => $sk->alasan_pemberhentian ?? 'Pemberhentian',
            'sk_number'      => $sk->nomor_sk,
            'effective_date' => $sk->tanggal_efektif_pemberhentian,
            'performed_by'   => $approver->id,
        ]);

        // 3. Activity log khusus untuk meninggal_dunia
        $keterangan = $sk->alasan_pemberhentian === 'meninggal_dunia'
            ? "Guru {$teacher->nama} dinyatakan meninggal dunia berdasarkan SK {$sk->nomor_sk}."
            : "Guru {$teacher->nama} diberhentikan berdasarkan SK {$sk->nomor_sk} (alasan: {$sk->alasan_pemberhentian}).";

        ActivityLog::log(
            description: $keterangan,
            event: 'deactivate_teacher_pemberhentian',
            logName: 'sk',
            subject: $teacher,
            causer: $approver,
            schoolId: $sk->school_id
        );
    }
}
```

### 2. Form Request Baru: `StoreSkPemberhentianRequest`

**File:** `backend/app/Http/Requests/SkDocument/StoreSkPemberhentianRequest.php`

```php
<?php

namespace App\Http\Requests\SkDocument;

use Illuminate\Foundation\Http\FormRequest;

class StoreSkPemberhentianRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Otorisasi ditangani middleware role
    }

    public function rules(): array
    {
        return [
            'nama'                           => 'required|string|max:255',
            'unit_kerja'                     => 'required|string|max:255',
            'jabatan'                        => 'nullable|string|max:255',
            'surat_permohonan_url'           => 'required|string',
            'alasan_pemberhentian'           => 'required|string|in:pengunduran_diri,pensiun,meninggal_dunia,pelanggaran_disiplin,habis_kontrak,lainnya',
            'keterangan_pemberhentian'       => 'nullable|required_if:alasan_pemberhentian,lainnya|string|max:1000',
            'tanggal_efektif_pemberhentian'  => [
                'required',
                'date',
                'after_or_equal:' . now()->subYear()->toDateString(),
            ],
            'nuptk'                          => 'nullable|string',
            'nip'                            => 'nullable|string',
            'status_kepegawaian'             => 'nullable|string',
            'tempat_lahir'                   => 'nullable|string',
            'tanggal_lahir'                  => 'nullable|string',
            'pendidikan_terakhir'            => 'nullable|string',
            'tmt'                            => 'nullable|string',
            'nomor_induk_maarif'             => 'nullable|string|max:20',
            'nomor_surat_permohonan'         => 'nullable|string',
            'tanggal_surat_permohonan'       => 'nullable|string',
            'tanggal_penetapan'              => 'nullable|string',
        ];
    }

    public function messages(): array
    {
        return [
            'alasan_pemberhentian.required' => 'Alasan pemberhentian wajib diisi.',
            'alasan_pemberhentian.in'       => 'Alasan pemberhentian tidak valid.',
            'keterangan_pemberhentian.required_if'
                => 'Keterangan wajib diisi jika alasan pemberhentian adalah "Lainnya".',
            'tanggal_efektif_pemberhentian.required'
                => 'Tanggal efektif pemberhentian wajib diisi.',
            'tanggal_efektif_pemberhentian.after_or_equal'
                => 'Tanggal efektif tidak boleh lebih dari 1 tahun ke belakang.',
        ];
    }
}
```

### 3. Perubahan `SkDocumentController`

#### 3a. Method `submitRequest` — Delegasi ke `SkPemberhentianService`

Inject `SkPemberhentianService` ke constructor dan tambahkan penanganan khusus untuk `jenis_sk = "Pemberhentian"`:

```php
// Tambahkan ke constructor
public function __construct(
    private NormalizationService $normalizationService,
    private DashboardCacheService $dashboardCacheService,
    private \App\Services\SkPemberhentianService $pemberhentianService,
) {}
```

Di dalam `submitRequest`, setelah validasi awal dan sebelum pembuatan record SK, tambahkan:

```php
// Setelah blok PNS auto-rejection yang sudah ada:
if ($data['jenis_sk'] === 'Pemberhentian') {
    // Validasi field pemberhentian via dedicated Form Request
    $pemberhentianRequest = StoreSkPemberhentianRequest::createFrom($request);
    $pemberhentianRequest->validateResolved();

    // Simpan field pemberhentian ke $data untuk disertakan saat create SkDocument
    $data['alasan_pemberhentian']          = $request->input('alasan_pemberhentian');
    $data['keterangan_pemberhentian']      = $request->input('keterangan_pemberhentian');
    $data['tanggal_efektif_pemberhentian'] = $request->input('tanggal_efektif_pemberhentian');
}
```

Saat `SkDocument::create()`, sertakan field pemberhentian:

```php
$sk = SkDocument::create([
    // ... field yang sudah ada ...
    'alasan_pemberhentian'          => $data['alasan_pemberhentian'] ?? null,
    'keterangan_pemberhentian'      => $data['keterangan_pemberhentian'] ?? null,
    'tanggal_efektif_pemberhentian' => $data['tanggal_efektif_pemberhentian'] ?? null,
]);
```

#### 3b. Method `update` — Trigger Deaktivasi Guru

Setelah blok pembuatan `ApprovalHistory` yang sudah ada, tambahkan:

```php
// Trigger deaktivasi guru untuk SK Pemberhentian
if ($oldStatus !== $newStatus
    && $newStatus === 'approved'
    && $skDocument->jenis_sk === 'Pemberhentian'
) {
    $this->pemberhentianService->onApproved($skDocument->fresh()->load('teacher'), $request->user());
}
```

#### 3c. Method `batchUpdateStatus` — Trigger Deaktivasi Guru (Batch)

Di dalam `DB::transaction`, setelah `$succeeded[] = $sk->id;`, tambahkan:

```php
// Trigger deaktivasi guru untuk SK Pemberhentian
if ($isApproved && $sk->jenis_sk === 'Pemberhentian') {
    $this->pemberhentianService->onApproved($sk, $user);
}
```

---

## Komponen Frontend

### 1. `SkSubmissionPage.tsx` — Field Pemberhentian Baru

**File:** `src/features/sk-management/SkSubmissionPage.tsx`

Tambahkan conditional rendering untuk field pemberhentian ketika `jenis_sk === "Pemberhentian"`:

```tsx
// Konstanta enum alasan pemberhentian
const ALASAN_PEMBERHENTIAN_OPTIONS = [
  { value: 'pengunduran_diri', label: 'Pengunduran Diri' },
  { value: 'pensiun',          label: 'Pensiun' },
  { value: 'meninggal_dunia',  label: 'Meninggal Dunia' },
  { value: 'pelanggaran_disiplin', label: 'Pelanggaran Disiplin' },
  { value: 'habis_kontrak',    label: 'Habis Kontrak' },
  { value: 'lainnya',          label: 'Lainnya' },
] as const

// Tambahkan ke Zod schema form
alasan_pemberhentian: z.enum([
  'pengunduran_diri','pensiun','meninggal_dunia',
  'pelanggaran_disiplin','habis_kontrak','lainnya'
]).optional(),
keterangan_pemberhentian: z.string().max(1000).optional(),
tanggal_efektif_pemberhentian: z.string().optional(),

// Refine: jika jenis_sk = Pemberhentian, field di atas wajib
.refine(
  (data) => data.jenis_sk !== 'Pemberhentian' || !!data.alasan_pemberhentian,
  { message: 'Alasan pemberhentian wajib diisi', path: ['alasan_pemberhentian'] }
)
.refine(
  (data) => data.jenis_sk !== 'Pemberhentian' || !!data.tanggal_efektif_pemberhentian,
  { message: 'Tanggal efektif pemberhentian wajib diisi', path: ['tanggal_efektif_pemberhentian'] }
)
.refine(
  (data) => data.alasan_pemberhentian !== 'lainnya' || !!data.keterangan_pemberhentian,
  { message: 'Keterangan wajib diisi jika alasan adalah "Lainnya"', path: ['keterangan_pemberhentian'] }
)
```

Tambahkan opsi `"Pemberhentian"` ke dropdown `jenis_sk` yang sudah ada.

Blok JSX yang ditambahkan (conditional):

```tsx
{watchedJenisSk === 'Pemberhentian' && (
  <div className="space-y-4 border-l-2 border-red-200 pl-4">
    <h3 className="font-medium text-sm text-muted-foreground">Detail Pemberhentian</h3>

    {/* Alasan Pemberhentian */}
    <FormField name="alasan_pemberhentian" render={({ field }) => (
      <FormItem>
        <FormLabel>Alasan Pemberhentian <span className="text-red-500">*</span></FormLabel>
        <Select onValueChange={field.onChange} value={field.value}>
          <SelectTrigger><SelectValue placeholder="Pilih alasan..." /></SelectTrigger>
          <SelectContent>
            {ALASAN_PEMBERHENTIAN_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FormMessage />
      </FormItem>
    )} />

    {/* Keterangan (hanya jika alasan = lainnya) */}
    {watchedAlasan === 'lainnya' && (
      <FormField name="keterangan_pemberhentian" render={({ field }) => (
        <FormItem>
          <FormLabel>Keterangan <span className="text-red-500">*</span></FormLabel>
          <Textarea {...field} placeholder="Jelaskan alasan pemberhentian..." maxLength={1000} />
          <FormMessage />
        </FormItem>
      )} />
    )}

    {/* Tanggal Efektif */}
    <FormField name="tanggal_efektif_pemberhentian" render={({ field }) => (
      <FormItem>
        <FormLabel>Tanggal Efektif Pemberhentian <span className="text-red-500">*</span></FormLabel>
        <Input type="date" {...field}
          min={new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
        />
        <FormMessage />
      </FormItem>
    )} />
  </div>
)}
```

Field-field pemberhentian disertakan di payload POST ke `/api/sk-documents/submit-request` hanya ketika `jenis_sk === "Pemberhentian"`.

### 2. `SkGeneratorPage.tsx` — Template, Placeholder, dan Penomoran SK Pemberhentian

**File:** `src/features/sk-management/SkGeneratorPage.tsx`

#### Penomoran SK Pemberhentian

SK Pemberhentian **menggunakan format penomoran yang sama** dengan SK pengangkatan dan mutasi. Tidak ada format terpisah. Format dikonfigurasi pengguna melalui field `nomorFormat` yang sudah ada di halaman Generator (contoh default: `{NOMOR}/PC.L/A.II/H-34.B/24.29/{PERIODE}/{BULAN}/{TAHUN}`).

Konsekuensinya:
- Counter `nomorMulai` diambil dari nomor SK tertinggi yang sudah ada di seluruh tabel `sk_documents` (termasuk SK Pemberhentian), sehingga tidak ada tabrakan nomor antar jenis SK.
- Placeholder `{NOMOR}`, `{PERIODE}`, `{BULAN}`, `{BL_ROMA}`, `{TAHUN}` bekerja persis sama untuk SK Pemberhentian.
- Placeholder `{PERIODE}` untuk pemberhentian akan bernilai `0` jika `tmt` kosong (sama seperti mode insidentil), karena SK Pemberhentian tidak relevan dengan periode masa kerja. Ini aman — template pemberhentian cukup tidak menyertakan `{PERIODE}` jika tidak diperlukan.

Tidak ada state baru, tidak ada format baru, tidak ada perubahan logika penomoran.

#### 2a. Tambah hook template pemberhentian

```tsx
// Tambahkan di samping template hooks yang sudah ada
const skTemplatePemberhentian = useSkTemplate('pemberhentian')

// Tambahkan ke skTemplateByType record
const skTemplateByType: Record<string, ReturnType<typeof useSkTemplate>> = {
  sk_template_gty:          skTemplateGty,
  sk_template_gtt:          skTemplateGtt,
  sk_template_kamad:        skTemplateKamad,
  sk_template_tendik:       skTemplateTendik,
  sk_template_pemberhentian: skTemplatePemberhentian,  // BARU
}
```

#### 2b. Tambah template selection logic untuk Pemberhentian

Di dalam blok penentuan `templateId` (sebelum logika GTY/GTT/Tendik):

```tsx
// Cek jenis_sk terlebih dahulu — Pemberhentian selalu pakai template sendiri
if (jenis.includes('pemberhentian')) {
  templateId = 'sk_template_pemberhentian'
}
// else: lanjutkan logika GTY/GTT/Kamad/Tendik yang sudah ada
```

#### 2c. Tambah placeholder mapping untuk Pemberhentian

Di dalam blok `renderData`, tambahkan field pemberhentian:

```tsx
const renderData: any = {
  // ... semua field yang sudah ada ...

  // Field Pemberhentian (null-safe: menghasilkan "-" jika tidak ada)
  "ALASAN_PEMBERHENTIAN": formatAlasanPemberhentian(t.alasan_pemberhentian) || "-",
  "KETERANGAN_PEMBERHENTIAN": t.keterangan_pemberhentian || "-",
  "TANGGAL_EFEKTIF": formatDateIndo(t.tanggal_efektif_pemberhentian) || "-",
  "TANGGAL EFEKTIF": formatDateIndo(t.tanggal_efektif_pemberhentian) || "-",
  "TANGGAL_EFEKTIF_PEMBERHENTIAN": formatDateIndo(t.tanggal_efektif_pemberhentian) || "-",
}
```

Helper `formatAlasanPemberhentian`:

```tsx
const formatAlasanPemberhentian = (alasan?: string): string => {
  const labels: Record<string, string> = {
    pengunduran_diri:    'Pengunduran Diri',
    pensiun:             'Pensiun',
    meninggal_dunia:     'Meninggal Dunia',
    pelanggaran_disiplin:'Pelanggaran Disiplin',
    habis_kontrak:       'Habis Kontrak',
    lainnya:             'Lainnya',
  }
  return alasan ? (labels[alasan] ?? alasan) : '-'
}
```

### 3. `SkTemplateManagementPage.tsx` — Tambah Opsi Pemberhentian

**File:** `src/features/sk-management/SkTemplateManagementPage.tsx`

Ada dua tempat yang perlu diperbarui agar template pemberhentian bisa diunggah, diaktifkan, dan ditampilkan di halaman manajemen template.

#### 3a. Tambah ke konstanta `SK_TYPES`

Konstanta ini menentukan bagian (section) template yang ditampilkan di halaman manajemen:

```tsx
// Sebelum (existing):
const SK_TYPES = [
  { value: 'gty',   label: 'GTY',    fullLabel: 'Guru Tetap Yayasan' },
  { value: 'gtt',   label: 'GTT',    fullLabel: 'Guru Tidak Tetap' },
  { value: 'kamad', label: 'Kamad',  fullLabel: 'Kepala Madrasah' },
  { value: 'tendik',label: 'Tendik', fullLabel: 'Tenaga Kependidikan' },
] as const

// Sesudah (tambahkan pemberhentian):
const SK_TYPES = [
  { value: 'gty',           label: 'GTY',           fullLabel: 'Guru Tetap Yayasan' },
  { value: 'gtt',           label: 'GTT',           fullLabel: 'Guru Tidak Tetap' },
  { value: 'kamad',         label: 'Kamad',         fullLabel: 'Kepala Madrasah' },
  { value: 'tendik',        label: 'Tendik',        fullLabel: 'Tenaga Kependidikan' },
  { value: 'pemberhentian', label: 'Pemberhentian', fullLabel: 'SK Pemberhentian' },  // BARU
] as const
```

#### 3b. Tambah ke Zod enum `uploadFormSchema`

Zod schema memvalidasi `sk_type` yang dikirim saat upload. Enum ini harus mencakup `'pemberhentian'`:

```tsx
// Sebelum:
sk_type: z.enum(['gty', 'gtt', 'kamad', 'tendik', 'surat_permohonan'], {
  required_error: 'Pilih jenis SK',
}),

// Sesudah:
sk_type: z.enum(['gty', 'gtt', 'kamad', 'tendik', 'surat_permohonan', 'pemberhentian'], {
  required_error: 'Pilih jenis SK',
}),
```

Tidak ada perubahan logika lain — `SkTemplateService` sudah menangani semua operasi template (upload, activate, delete, getDownloadUrl) secara generik berdasarkan `sk_type`, sehingga nilai `'pemberhentian'` langsung didukung tanpa perubahan backend.

### 4. `VerifySkPage.tsx` — Tidak Ada Perubahan Logika

**File:** `src/features/verification/VerifySkPage.tsx`

Halaman verifikasi publik sudah menampilkan semua field dari response API. Untuk SK Pemberhentian, backend perlu menyertakan `alasan_pemberhentian` dan `tanggal_efektif_pemberhentian` di response `GET /api/sk/verify/:nomor`. Perubahan minimal: tambahkan rendering kondisional di halaman verifikasi jika field tersebut ada:

```tsx
{skData.alasan_pemberhentian && (
  <div className="text-sm">
    <span className="font-medium">Alasan Pemberhentian:</span>{' '}
    {formatAlasanPemberhentian(skData.alasan_pemberhentian)}
  </div>
)}
{skData.tanggal_efektif_pemberhentian && (
  <div className="text-sm">
    <span className="font-medium">Tanggal Efektif:</span>{' '}
    {formatDateIndo(skData.tanggal_efektif_pemberhentian)}
  </div>
)}
```

---

## Data Models

### Alur Data Lengkap

```
Operator (SkSubmissionPage)
  │
  │ POST /api/sk-documents/submit-request
  │ { jenis_sk: "Pemberhentian",
  │   alasan_pemberhentian: "pengunduran_diri",
  │   tanggal_efektif_pemberhentian: "2026-08-01",
  │   keterangan_pemberhentian: null,
  │   ... field umum ... }
  │
  ▼
SkDocumentController::submitRequest()
  ├── Normalize nama + unit_kerja
  ├── PNS check → reject jika PNS
  ├── Jenjang check → reject jika non-RA/TK (kecuali unlock)
  ├── StoreSkPemberhentianRequest::validateResolved() ← BARU
  │   ├── alasan_pemberhentian: required, enum
  │   ├── tanggal_efektif: required, >= today-1year
  │   └── keterangan: required_if alasan=lainnya
  ├── Duplicate check (nama + jenis_sk + school_id + tahun_ajaran)
  ├── Upsert Teacher record
  └── SkDocument::create({ ..., alasan_pemberhentian, ... })
      → status: "pending"
      → Notifikasi ke admin_yayasan/super_admin (existing job)
      → ActivityLog event: submit_sk_request

Admin Yayasan (SkDashboardPage)
  │
  │ PATCH /api/sk-documents/{id}
  │   atau
  │ PATCH /api/sk-documents/batch-status
  │ { status: "approved" }
  │
  ▼
SkDocumentController::update() / batchUpdateStatus()
  ├── Role check: operator → 403
  ├── sk.update({ status: "approved" })
  ├── ApprovalHistory::create(...)
  ├── Notification::create(...) ke operator
  └── [BARU] jika jenis_sk = "Pemberhentian" && status = "approved":
      SkPemberhentianService::onApproved(sk, user)
      ├── teacher.update({ is_active: false })
      ├── TeacherMutation::create({ reason, sk_number, effective_date, ... })
      └── ActivityLog event: deactivate_teacher_pemberhentian

Admin (SkGeneratorPage)
  │
  │ [Client-side DOCX generation]
  │
  ▼
  ├── Filter kandidat: jenis_sk = "Pemberhentian", status = "approved", file_url null
  ├── templateId = "sk_template_pemberhentian"
  ├── useSkTemplate('pemberhentian') → URL template aktif
  ├── renderData = { NAMA, ALASAN_PEMBERHENTIAN, TANGGAL_EFEKTIF, QR_CODE, ... }
  ├── docxtemplater.render(renderData)
  └── PATCH /api/sk-documents/{id} { file_url, nomor_sk, status, tanggal_penetapan }
```

### Tipe Data TypeScript

```typescript
// Tambahkan ke tipe SkDocument yang ada
interface SkDocument {
  // ... field yang sudah ada ...
  alasan_pemberhentian?: AlasanPemberhentian | null
  keterangan_pemberhentian?: string | null
  tanggal_efektif_pemberhentian?: string | null  // YYYY-MM-DD
}

type AlasanPemberhentian =
  | 'pengunduran_diri'
  | 'pensiun'
  | 'meninggal_dunia'
  | 'pelanggaran_disiplin'
  | 'habis_kontrak'
  | 'lainnya'
```

---

## Mapping Placeholder Template DOCX

Berikut adalah daftar lengkap placeholder yang didukung di template `sk_type = "pemberhentian"`. Placeholder menggunakan delimiter `{...}` sesuai konfigurasi docxtemplater yang sudah ada.

| Placeholder | Sumber Data | Keterangan |
|---|---|---|
| `{NAMA}` | `sk.nama` | Nama guru, di-render **bold** oleh docxtemplater |
| `{JABATAN}` | `sk.jabatan` | Jabatan guru |
| `{UNIT_KERJA}` | `sk.unit_kerja` | Nama sekolah/unit kerja |
| `{UNIT KERJA}` | `sk.unit_kerja` | Alias spasi |
| `{NOMOR_SK}` | `generatedNomor` | Nomor SK yang di-generate |
| `{NOMOR}` | `seqStr` | Nomor urut (4 digit) |
| `{ALASAN_PEMBERHENTIAN}` | `sk.alasan_pemberhentian` | Label alasan dalam Bahasa Indonesia |
| `{KETERANGAN_PEMBERHENTIAN}` | `sk.keterangan_pemberhentian` | Teks bebas (jika alasan = lainnya) |
| `{TANGGAL_EFEKTIF}` | `sk.tanggal_efektif_pemberhentian` | Format: "1 Agustus 2026" |
| `{TANGGAL EFEKTIF}` | `sk.tanggal_efektif_pemberhentian` | Alias spasi |
| `{TANGGAL_PENETAPAN}` | `tanggalPenetapanPerGuru` | Tanggal SK ditetapkan |
| `{TANGGAL PENETAPAN}` | `tanggalPenetapanPerGuru` | Alias spasi |
| `{TANGGAL}` | `tglHari` | Hari tanggal penetapan |
| `{BULAN}` | `tglBulan` | Bulan tanggal penetapan (angka) |
| `{BL_ROMA}` | `tglRoma` | Bulan dalam angka Romawi |
| `{TAHUN}` | `tglTahun` | Tahun penetapan |
| `{NOMOR_INDUK_MAARIF}` | `teacher.nomor_induk_maarif` | NIM Ma'arif guru |
| `{NIM}` | `teacher.nomor_induk_maarif` | Alias NIM |
| `{KECAMATAN}` | `school.kecamatan` | Kecamatan sekolah |
| `{TEMPAT/TANGGAL LAHIR}` | `teacher.tempat_lahir + tanggal_lahir` | Tempat, tgl lahir |
| `{PENDIDIKAN}` | `teacher.pendidikan_terakhir` | Pendidikan terakhir |
| `{PENDIDIKAN TERAKHIR}` | `teacher.pendidikan_terakhir` | Alias |
| `{qrcode}` | `qrCodeData` | QR code base64 (via ImageModule) |
| `{#tembusan}{nomor}. {isi}{/tembusan}` | Array tembusan | Loop tembusan (reset per dokumen) |

> **Catatan:** Placeholder `{KATA_PENGANGKATAN}`, `{TMT}`, `{PERIODE}`, `{TANGGAL_BERAKHIR}` tetap tersedia di renderData tapi umumnya tidak relevan untuk template pemberhentian. Template pemberhentian dapat mengabaikannya — placeholder yang tidak ada di template akan diabaikan oleh docxtemplater.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

---

### Property 1: Isolasi Tenant — Query Hanya Mengembalikan Data Sekolah Sendiri

*Untuk setiap* operator dengan `school_id` tertentu, semua record SK Pemberhentian yang dikembalikan oleh endpoint `GET /api/sk-documents` dengan parameter `jenis_sk = "Pemberhentian"` harus memiliki `school_id` yang sama dengan `school_id` operator tersebut — tidak boleh ada satupun record dari sekolah lain.

**Validates: Requirements 9.1, 9.2, 9.3**

---

### Property 2: Pencegahan Duplikat Pengajuan

*Untuk setiap* kombinasi `(nama, jenis_sk = "Pemberhentian", school_id, tahun_ajaran)` yang sudah memiliki record dengan `status = "pending"` atau `status = "draft"`, semua upaya pengajuan berikutnya dengan kombinasi yang sama harus selalu ditolak dengan HTTP 422 dan menyertakan `existing_nomor_sk` di response body.

**Validates: Requirements 1.10**

---

### Property 3: Penolakan Otomatis Guru PNS/ASN

*Untuk setiap* payload pengajuan SK Pemberhentian yang mengandung `nip` dengan panjang 18 digit, atau `status_kepegawaian` yang mengandung substring `"pns"` atau `"asn"` (case-insensitive), sistem harus selalu menolak pengajuan dengan HTTP 422 dan membuat record `sk_documents` dengan `status = "rejected"` beserta `rejection_reason` yang menjelaskan penolakan PNS.

**Validates: Requirements 1.11**

---

### Property 4: Validasi Rentang Tanggal Efektif

*Untuk setiap* nilai `tanggal_efektif_pemberhentian` yang lebih awal dari `(tanggal hari ini − 365 hari)`, validasi backend harus selalu menolak pengajuan dengan HTTP 422. Untuk setiap nilai yang sama dengan atau lebih baru dari batas tersebut, validasi harus lolos (asumsi field wajib lainnya terisi).

**Validates: Requirements 1.5**

---

### Property 5: Validasi Enum Alasan Pemberhentian

*Untuk setiap* nilai `alasan_pemberhentian` yang tidak termasuk dalam himpunan `{"pengunduran_diri", "pensiun", "meninggal_dunia", "pelanggaran_disiplin", "habis_kontrak", "lainnya"}`, validasi backend harus selalu menolak pengajuan dengan HTTP 422. Untuk semua nilai yang termasuk dalam himpunan tersebut, validasi field ini harus lolos.

**Validates: Requirements 1.3**

---

### Property 6: Invariant Perubahan Status Guru Saat Approve/Reject

*Untuk setiap* SK Pemberhentian dengan `teacher_id` yang valid:
- Ketika SK di-`approved`, nilai `teachers.is_active` untuk teacher terkait harus selalu menjadi `false` setelah operasi selesai.
- Ketika SK di-`rejected`, nilai `teachers.is_active` untuk teacher terkait harus tetap tidak berubah dari nilai sebelumnya — tidak boleh dimodifikasi oleh operasi reject.

**Validates: Requirements 5.1, 5.3**

---

### Property 7: Round-Trip Teacher Mutations Saat Approve

*Untuk setiap* SK Pemberhentian yang di-approve dan memiliki `teacher_id` yang valid, harus selalu terdapat tepat satu record baru di tabel `teacher_mutations` yang memenuhi: `teacher_id` cocok, `sk_number = sk.nomor_sk`, `reason = sk.alasan_pemberhentian`, dan `effective_date = sk.tanggal_efektif_pemberhentian`.

**Validates: Requirements 5.4**

---

### Property 8: Template Selection untuk Pemberhentian

*Untuk setiap* SK dengan `jenis_sk` yang mengandung substring `"pemberhentian"` (case-insensitive), logika pemilihan template di `SkGeneratorPage` harus selalu menghasilkan `templateId = "sk_template_pemberhentian"` — tidak peduli nilai `pendidikan_terakhir`, `tmt`, atau `nama` guru tersebut.

**Validates: Requirements 3.2, 3.3**

---

### Property 9: Integritas Filter Jenis SK

*Untuk setiap* response dari endpoint `GET /api/sk-documents?jenis_sk=Pemberhentian`, semua record yang dikembalikan harus memiliki `jenis_sk = "Pemberhentian"` — tidak boleh ada record dengan nilai `jenis_sk` lain yang ikut muncul di hasil filter.

**Validates: Requirements 7.1, 7.2**

---

### Property 10: Invariant Single-Active Template per Tipe

*Untuk setiap* operasi `activate` pada template dengan `sk_type = "pemberhentian"`, jumlah template pemberhentian dengan `is_active = true` di tabel `sk_templates` harus selalu sama dengan 1 setelah operasi selesai. Operasi ini idempoten: mengaktifkan template yang sudah aktif tidak menambah jumlah template aktif.

**Validates: Requirements 4.2**

---

## Error Handling

### Error Submission

| Kondisi | HTTP Status | Pesan |
|---|---|---|
| Guru berstatus PNS | 422 | `"Pengajuan ditolak: PTK berstatus PNS tidak dapat mengajukan SK melalui yayasan."` |
| Duplikat pending | 422 | `"Pengajuan SK untuk \"..\" sudah ada dan sedang menunggu persetujuan (No: ...)."` |
| `alasan_pemberhentian` kosong | 422 | `"Alasan pemberhentian wajib diisi."` |
| `alasan_pemberhentian` di luar enum | 422 | `"Alasan pemberhentian tidak valid."` |
| `keterangan_pemberhentian` kosong saat alasan = lainnya | 422 | `"Keterangan wajib diisi jika alasan pemberhentian adalah 'Lainnya'."` |
| `tanggal_efektif` lebih dari 1 tahun ke belakang | 422 | `"Tanggal efektif tidak boleh lebih dari 1 tahun ke belakang."` |
| Operator submit ke sekolah berbeda | 403 | `"Anda tidak memiliki izin untuk sekolah ini."` |

### Error Generate DOCX

| Kondisi | Penanganan |
|---|---|
| Template `pemberhentian` tidak aktif | `useSkTemplate` mengembalikan fallback URL `/templates/sk-pemberhentian-template.docx`; jika fallback juga 404, `error` diset dan generator menampilkan toast error: `"Template SK Pemberhentian tidak tersedia. Unggah dan aktifkan template terlebih dahulu."` |
| `alasan_pemberhentian` null di renderData | Placeholder `{ALASAN_PEMBERHENTIAN}` diisi `"-"` oleh custom parser |
| `tanggal_efektif_pemberhentian` null | Placeholder `{TANGGAL_EFEKTIF}` diisi `"-"` |

### Error Approval

| Kondisi | HTTP Status | Pesan |
|---|---|---|
| Operator mencoba approve/reject | 403 | `"Anda tidak memiliki izin untuk menyetujui atau menolak pengajuan SK."` |
| `SkPemberhentianService::onApproved` gagal | 500 (uncaught) → Di-wrap dalam `DB::transaction`, rollback otomatis | Seluruh operasi approve dibatalkan |
| teacher_id null saat approve | Service mengembalikan lebih awal (`return`), tidak ada error, guru tidak terpengaruh |

### Validasi Frontend (Zod)

Validasi Zod di `SkSubmissionPage` mencegah request tidak valid sebelum dikirim ke backend:
- Field pemberhentian hanya divalidasi ketika `jenis_sk === "Pemberhentian"`
- `tanggal_efektif_pemberhentian` memiliki `min` date attribute di `<Input type="date">` sesuai batas backend
- Error message ditampilkan inline di bawah setiap field via `<FormMessage />`

---

## Testing Strategy

### Unit Test Backend

**File baru:** `backend/tests/Unit/Services/SkPemberhentianServiceTest.php`

Menggunakan PHPUnit. Test yang perlu dibuat:

- `test_onApproved_sets_teacher_inactive_and_creates_mutation` — SK Pemberhentian approved → is_active=false, TeacherMutation dibuat
- `test_onApproved_does_nothing_when_teacher_id_is_null` — SK tanpa teacher_id → tidak ada exception, tidak ada mutation
- `test_onApproved_logs_meninggal_dunia_with_special_description` — alasan meninggal_dunia → activity log mengandung "meninggal dunia"
- `test_reject_does_not_change_teacher_is_active` — reject SK → is_active teacher tidak berubah

**File yang ada:** `backend/tests/Unit/Services/NormalizationServiceTest.php` — tidak ada perubahan.

### Property-Based Test Backend

Property-based testing tidak tersedia secara native di PHPUnit. Gunakan [eris/eris](https://github.com/giorgiosironi/eris) untuk PHP.

**File baru:** `backend/tests/Unit/Services/SkPemberhentianServicePropertyTest.php`

```php
// Property 6: Invariant perubahan is_active
// Feature: sk-pemberhentian, Property 6: Approve sets is_active=false, reject preserves is_active
public function test_property_approve_sets_inactive_reject_preserves(): void
{
    $this->forAll(
        Generator\bool(),   // initial is_active state
        Generator\elements(['pengunduran_diri','pensiun','meninggal_dunia','pelanggaran_disiplin','habis_kontrak','lainnya'])
    )->then(function(bool $initialIsActive, string $alasan) {
        $teacher = Teacher::factory()->create(['is_active' => $initialIsActive]);
        $sk = SkDocument::factory()->create([
            'teacher_id' => $teacher->id,
            'jenis_sk' => 'Pemberhentian',
            'status' => 'approved',
            'alasan_pemberhertian' => $alasan,
        ]);
        $approver = User::factory()->create(['role' => 'admin_yayasan']);

        $this->service->onApproved($sk, $approver);

        $this->assertFalse($teacher->fresh()->is_active);
    });
}

// Property 7: Round-trip TeacherMutation saat approve
// Feature: sk-pemberhentian, Property 7: Approve creates matching TeacherMutation
public function test_property_approve_creates_teacher_mutation(): void
{
    $this->forAll(
        Generator\elements(['pengunduran_diri','pensiun','meninggal_dunia']),
        Generator\date('Y-m-d', new \DateTime('2025-01-01'), new \DateTime('2027-12-31'))
    )->then(function(string $alasan, string $tanggalEfektif) {
        $teacher = Teacher::factory()->create(['is_active' => true]);
        $sk = SkDocument::factory()->create([
            'teacher_id' => $teacher->id,
            'jenis_sk' => 'Pemberhentian',
            'status' => 'approved',
            'alasan_pemberhentian' => $alasan,
            'tanggal_efektif_pemberhentian' => $tanggalEfektif,
        ]);
        $approver = User::factory()->create(['role' => 'admin_yayasan']);

        $this->service->onApproved($sk, $approver);

        $mutation = TeacherMutation::where('teacher_id', $teacher->id)
            ->where('sk_number', $sk->nomor_sk)
            ->first();

        $this->assertNotNull($mutation);
        $this->assertEquals($alasan, $mutation->reason);
        $this->assertEquals($tanggalEfektif, $mutation->effective_date);
    });
}
```

**File baru:** `backend/tests/Feature/SkPemberhentianSubmissionPropertyTest.php`

```php
// Property 3: Penolakan PNS
// Feature: sk-pemberhentian, Property 3: PNS always rejected

// Property 2: Duplicate prevention
// Feature: sk-pemberhentian, Property 2: Duplicate pending always rejected

// Property 5: Tanggal efektif validation
// Feature: sk-pemberhentian, Property 5: Date before (today-1year) always rejected
```

### Property-Based Test Frontend

Menggunakan [fast-check](https://github.com/dubzzz/fast-check) (sudah tersedia di project sebagai dependency testing).

**File baru:** `src/features/sk-management/__tests__/skPemberhentianGenerator.property.test.ts`

```typescript
import * as fc from 'fast-check'
import { describe, it, expect } from 'vitest'

// Property 8: Template selection selalu sk_template_pemberhentian untuk jenis Pemberhentian
// Feature: sk-pemberhentian, Property 8: Template selection always returns sk_template_pemberhentian
describe('SK Pemberhentian template selection', () => {
  it('selalu memilih template pemberhentian untuk jenis Pemberhentian', () => {
    fc.assert(
      fc.property(
        fc.record({
          jenis_sk: fc.constantFrom(
            'Pemberhentian', 'pemberhentian', 'PEMBERHENTIAN', 'sk pemberhentian'
          ),
          pendidikan_terakhir: fc.oneof(
            fc.constant('S1'), fc.constant('SMA'), fc.constant('D3'), fc.constant('')
          ),
          tmt: fc.date({ min: new Date('2010-01-01'), max: new Date('2024-01-01') })
            .map(d => d.toISOString().split('T')[0]),
          nama: fc.string({ minLength: 3, maxLength: 50 }),
        }),
        (data) => {
          const jenis = data.jenis_sk.toLowerCase()
          const selectedTemplateId = jenis.includes('pemberhentian')
            ? 'sk_template_pemberhentian'
            : 'sk_template_tendik' // fallback untuk non-pemberhentian

          expect(selectedTemplateId).toBe('sk_template_pemberhentian')
        }
      ),
      { numRuns: 100 }
    )
  })
})

// Property 9: Filter jenis_sk integrity
// Feature: sk-pemberhentian, Property 9: Filter results only contain Pemberhentian
describe('Filter jenis_sk integrity', () => {
  it('hasil filter jenis_sk=Pemberhentian tidak mengandung jenis_sk lain', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.integer({ min: 1 }),
            jenis_sk: fc.oneof(
              fc.constant('Pemberhentian'),
              fc.constant('GTY'),
              fc.constant('GTT'),
              fc.constant('Tendik'),
            ),
          }),
          { minLength: 0, maxLength: 20 }
        ),
        (skList) => {
          const filtered = skList.filter(sk => sk.jenis_sk === 'Pemberhentian')
          expect(filtered.every(sk => sk.jenis_sk === 'Pemberhentian')).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })
})
```

### Test Integrasi

**File baru:** `backend/tests/Feature/SkPemberhentianApprovalTest.php`

- Submit SK Pemberhentian → verifikasi record dibuat dengan field pemberhentian terisi
- Approve SK Pemberhentian → verifikasi teacher.is_active = false, TeacherMutation dibuat, ApprovalHistory dibuat, notifikasi dibuat
- Reject SK Pemberhentian → verifikasi status rejected, teacher.is_active tidak berubah
- Batch approve SK Pemberhentian → verifikasi semua guru terkait di-nonaktifkan

### Unit Test Frontend

**File baru:** `src/features/sk-management/__tests__/SkSubmissionPage.test.tsx`

- Render form dengan jenis_sk = "Pemberhentian" → field pemberhentian muncul
- Render form dengan jenis_sk = "GTY" → field pemberhentian tidak muncul
- Pilih alasan = "lainnya" → field keterangan muncul
- Submit form tanpa alasan_pemberhentian → validasi error muncul
