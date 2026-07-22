# Laporan Pekerjaan — 18, 20 & 21 Juli 2026

**Proyek:** SIMMACI — Sistem Informasi Manajemen Pendidikan LP Ma'arif NU Cilacap  
**Tanggal:** Jumat 18 Juli · Senin 20 Juli · Selasa 21 Juli 2026  
**Tipe:** Bugfix produksi + fitur baru (SK submission lock)  
**Ringkasan:** 12 commit — fix 502 deployment (investigasi & workaround), 4 bugfix frontend, fitur lock/unlock pengajuan SK per madrasah dengan toggle admin tanpa perlu ubah kode.

---

## Ringkasan Commit

| Tanggal | Hash | Area | Deskripsi |
|---|---|---|---|
| 18 Jul | `02e69ef` | FE | Fix TDZ: pindah `periodeValue` sebelum `kataPengangkatan` di MySkPage |
| 20 Jul | `c9cf7c4` | FE | Absensi staff: restart scanner otomatis, pesan GPS lebih jelas |
| 20 Jul | `b9a3f1f` | FE | Absensi staff: tambah loading overlay saat submit, hilangkan blank state |
| 20 Jul | `128d728` | FE | Fix checkbox approve SK: kondisi `statusFilter === 'draft'` bukan `status === 'draft'` |
| 21 Jul | `1615c0a` | FE | Banner pengajuan SK berdasarkan jenjang (RA/TK buka, MI ke atas info) |
| 21 Jul | `4c84d87` | BE+FE | Fitur lock/unlock SK: migration, model, endpoint toggle, UI toggle di Kelola Sekolah |
| 21 Jul | `0f97079` | BE | Fix parameter `ActivityLog::log` di `toggleSkSubmission` |
| 21 Jul | `acf281e` | BE+FE | Backend blokir `submitRequest` & `bulkRequest` cek `sk_submission_unlocked`, tombol "Tutup Semua" |
| 21 Jul | `dd17c28` | BE+Test | Fix test fixtures MI pakai `sk_submission_unlocked=true`, fix `performed_by null` pada PNS auto-reject |
| 21 Jul | `24099f7` | FE | Fix cache stale: `staleTime=0` di query sekolah agar toggle sk_submission_unlocked langsung terlihat |

---

## 18 Juli 2026

### Investigasi 502 Bad Gateway (Deployment Coolify)

**Konteks:** Setelah deploy terbaru, situs `simmaci.com` mengembalikan 502 Bad Gateway pada semua request ke `/api/*`.

**Investigasi:**
- Log nginx frontend menunjukkan `connect() failed (111: Connection refused)` ke `http://10.0.2.10:80`
- Ditemukan dua stack berjalan bersamaan: stack lama (`sim-maarif-fullstack_default`) dan stack baru (`yam0yy...`)
- Container `simmaci_frontend` lama masih aktif tanpa Traefik label — tidak serve traffic
- Container `frontend-yam0yy...` yang serve traffic tidak bisa reach `backend` karena alias DNS tidak terdaftar di network yang benar
- **Root cause:** Coolify deploy stack baru tapi tidak stop stack lama; network isolation antara dua stack

**Workaround di server:** Disambungkan backend baru ke network yang tepat dengan alias DNS `backend`:
```bash
docker network disconnect yam0yy9a6l424v8j89hv7pqr_simmaci-network backend-yam0yy...
docker network connect --alias backend yam0yy9a6l424v8j89hv7pqr_simmaci-network backend-yam0yy...
```

**Perbaikan kode permanen** (sudah di-push):
- `Dockerfile` backend: tambah wait loop DB (max 60 detik) sebelum migrate, abort kalau migrate gagal
- `nginx/entrypoint.sh`: bersihkan sed placeholder yang tidak efektif  
- `docker-compose.coolify.yml`: frontend `depends_on: backend: condition: service_healthy`

---

### FE-1 · Fix: TDZ error saat unduh SK di Arsip SK Unit

**Commit:** `02e69ef` — 15:31 WIB  
**File:** `src/features/sk-management/MySkPage.tsx`

**Root cause:** Commit sebelumnya (`ded6295`, 17 Juli) memindahkan `periodeValue` ke bawah `kataPengangkatan`. Di dalam IIFE `kataPengangkatan`, `periodeValue` diakses lewat `isFirstGty = templateId === "gty" && periodeValue === 2`. Karena `const` tidak di-hoist ke nilai (hanya deklarasi), mengakses `periodeValue` sebelum baris deklarasinya melempar **`ReferenceError: Cannot access 'periodeValue' before initialization`**.

**Fix:** Pindahkan deklarasi `periodeValue` ke sebelum `kataPengangkatan`.

```typescript
// Sebelum (buggy) — periodeValue dipakai tapi baru dideklarasikan beberapa baris kemudian
const kataPengangkatan: string = (() => {
  const isFirstGty = templateId === "gty" && periodeValue === 2  // ❌ TDZ!
  ...
})()
// ... banyak kode ...
const periodeValue: number = (() => { ... })()

// Sesudah (fixed)
const periodeValue: number = (() => { ... })()  // ✅ dideklarasikan duluan
const kataPengangkatan: string = (() => {
  const isFirstGty = templateId === "gty" && periodeValue === 2  // ✅ OK
  ...
})()
```

---

## 20 Juli 2026

### FE-2 · Fix: Absensi staff blank tanpa notifikasi setelah scan QR

**Commit:** `c9cf7c4` + `b9a3f1f` — 09:17–09:20 WIB  
**File:** `src/features/attendance/PublicScannerPage.tsx`

**Root cause (3 masalah):**

1. **Blank state** — Setelah QR terdeteksi: scanner stop (`scanning = false`), `scanResult` diisi, tapi `faceVerificationStatus = 'idle'`. Kondisi render:
   - Default screen: `!scanning && !scanResult && faceVerificationStatus === 'idle'` → false karena `scanResult !== null`
   - Face overlay: `faceVerificationStatus === 'scanning'` → false
   - Scanner: `scanning = false` → tidak muncul
   - **Tidak ada UI state yang aktif** → layar blank selama API call

2. **Scanner tidak restart** — Setelah submit selesai (sukses/gagal), `scanResult` di-reset tapi scanner tidak di-restart. User harus tekan "Mulai Scan" lagi tanpa panduan.

3. **GPS belum ready** — Pesan toast "Menunggu lokasi GPS..." terlalu singkat, user tidak tahu harus menunggu.

**Fix:**
```typescript
// 1. Tambah state submitting + overlay loading
const [submitting, setSubmitting] = useState(false)

// Di render: overlay saat submit
{submitting && (
  <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center z-20 gap-4">
    <Loader2 className="h-10 w-10 text-blue-400 animate-spin" />
    <p className="text-blue-300 font-bold text-sm">Memproses absensi...</p>
  </div>
)}

// Default screen juga cek !submitting
{!scanning && !scanResult && !submitting && faceVerificationStatus === 'idle' && ( ... )}

// 2. Restart scanner otomatis di finally
finally {
  setSubmitting(false)
  setScanResult(null)
  setFaceVerificationStatus('idle')
  setTimeout(() => startScanner(), 1500) // delay 1.5s agar toast terbaca
}

// 3. Pesan GPS lebih jelas
toast.warning('Menunggu lokasi GPS... Coba lagi dalam beberapa detik.')
```


### FE-3 · Fix: Checkbox approve SK tidak muncul di tab Antrean Draft

**Commit:** `128d728` — 10:03 WIB  
**File:** `src/features/sk-management/SkDashboardPage.tsx`

**Root cause:** Checkbox di setiap row mengecek `status === 'draft'` (status item individual dari DB). Data dari tab "Antrean Draft" di-query dengan `status: 'unverified'` yang di backend mengembalikan item dengan status `'pending'` atau `'draft'`. Mayoritas item berstatus `'pending'` → kondisi `status === 'draft'` tidak pernah true → checkbox tidak muncul.

```typescript
// Sebelum (buggy)
{status === 'draft' && <Checkbox ... />}

// Sesudah (fixed) — cek tab aktif, bukan status item
{statusFilter === 'draft' && <Checkbox ... />}
```

---

## 21 Juli 2026

### Fitur Baru: Lock/Unlock Pengajuan SK per Madrasah

**Latar belakang:** Pengajuan SK untuk jenjang MI ke atas ditutup per 1 Juli 2026. RA/TK tetap buka. Madrasah yang sudah menghubungi pengurus LP Ma'arif NU Cilacap perlu bisa dibuka kembali **tanpa deploy ulang** — cukup klik di dashboard.

**Arsitektur:**

```
Field: schools.sk_submission_unlocked (nullable boolean)
  null  = ikuti aturan global (RA/TK buka, MI ke atas tutup)
  true  = dibuka khusus oleh admin
  false = ditutup paksa (override global)
```

**Backend:**

| File | Perubahan |
|---|---|
| `migrations/2026_07_21_..._add_sk_submission_unlocked...` | Tambah kolom nullable boolean |
| `School.php` | Tambah ke `$fillable` + cast boolean |
| `SchoolController::toggleSkSubmission()` | `PATCH /schools/{id}/sk-submission-unlock` — toggle per madrasah |
| `SchoolController::resetAllSkSubmission()` | `PATCH /schools/sk-submission-reset-all` — reset semua MI ke atas ke locked |
| `SkDocumentController::submitRequest()` | Cek `sk_submission_unlocked` sebelum blokir jenjang |
| `SkDocumentController::processBulkRequestSync()` | Cek per-row di loop bulk import |

**Frontend:**

| File | Perubahan |
|---|---|
| `src/lib/api.ts` | `schoolApi.toggleSkSubmission()`, `schoolApi.resetAllSkSubmission()` |
| `SkSubmissionPage.tsx` | Variabel `isSkLocked`, banner 3 kondisi, tombol & form diblokir kalau locked |
| `AdminSchoolManagementPage.tsx` | Kolom "Pengajuan SK" dengan toggle button, tombol "Tutup Semua" |

**Banner di SkSubmissionPage (3 kondisi):**
- 🟢 **RA/TK** → "Pengajuan SK Dibuka" (emerald)
- 🔵 **MI ke atas, unlocked admin** → "Pengajuan Diizinkan oleh LP Ma'arif NU Cilacap" (blue)
- 🔴 **MI ke atas, default** → "Pengajuan SK Ditutup — Per 1 Juli 2026" (red) + form diblokir

**Cara pakai (tanpa ubah kode):**
1. Operator menghubungi LP Ma'arif NU Cilacap
2. Admin buka **Dashboard → Kelola Sekolah**
3. Klik tombol **"Ditutup"** pada baris madrasah → berubah jadi **"Dibuka"**
4. Operator langsung bisa mengajukan SK
5. Untuk tutup semua sekaligus: klik **"Tutup Semua Pengajuan SK"** di atas halaman

---

### Bugfix: ActivityLog::log parameter salah

**Commit:** `0f97079`  
**Root cause:** `toggleSkSubmission` memanggil `ActivityLog::log()` dengan parameter `subjectType:` dan `subjectId:` yang tidak ada. Parameter yang benar adalah `subject:` (object model) dan `causer:`.

---

### Bugfix Test: 14 test failures setelah fitur lock

**Masalah 1:** Test suites `BulkSkRequestTest`, `BulkSkImportPreservationTest`, `BulkSkImportDuplicateTeacherTest` menggunakan sekolah `MI Ma'arif NU ...` — sekarang terblokir oleh fitur baru.  
**Fix:** Tambah `'sk_submission_unlocked' => true` di `setUp()` semua test yang pakai sekolah MI.

**Masalah 2:** PNS auto-reject di `processBulkRequestSync` mengisi `performed_by => null` pada `ApprovalHistory::create()`, tapi kolom `performed_by` adalah NOT NULL.  
**Fix:** Ganti ke `performed_by => $request->user()->id`.

---

## Notes Teknis

### Kenapa tidak pakai setting global

Menggunakan kolom per-madrasah (`schools.sk_submission_unlocked`) lebih granular daripada setting global karena:
- Setiap madrasah bisa dibuka secara independen
- Perubahan tidak mempengaruhi madrasah lain
- Audit trail tersimpan di ActivityLog per madrasah
- Tidak perlu restart server / deploy ulang

### Urutan pengecekan di `submitRequest` / `bulkRequest`

```
1. Validasi request fields
2. Normalisasi nama sekolah + guru
3. Resolve school_id
4. [BARU] Cek sk_submission_unlocked untuk jenjang MI ke atas
5. PNS auto-reject
6. Duplicate guard (pending yang sama)
7. Create/update Teacher + SkDocument
```


---

## Ringkasan Commit

| Hash | Area | Deskripsi |
|---|---|---|
| `02e69ef` | FE | Fix TDZ: pindah `periodeValue` sebelum `kataPengangkatan` di MySkPage |
| `c9cf7c4` | FE | Absensi staff: restart scanner otomatis, pesan GPS lebih jelas |
| `b9a3f1f` | FE | Absensi staff: tambah loading overlay saat submit, hilangkan blank state |
| `128d728` | FE | Fix checkbox approve SK: kondisi `statusFilter === 'draft'` bukan `status === 'draft'` |
| `1615c0a` | FE | Banner pengajuan SK berdasarkan jenjang (RA/TK buka, MI ke atas info) |
| `4c84d87` | BE+FE | Fitur lock/unlock SK: migration, model, endpoint toggle, UI toggle di Kelola Sekolah |
| `0f97079` | BE | Fix parameter `ActivityLog::log` di `toggleSkSubmission` |
| `acf281e` | BE+FE | Backend blokir `submitRequest` & `bulkRequest` cek `sk_submission_unlocked`, tombol "Tutup Semua" |
| `dd17c28` | BE+Test | Fix test fixtures MI pakai `sk_submission_unlocked=true`, fix `performed_by null` pada PNS auto-reject |

---

## Deployment Fix

### 502 Bad Gateway — Nginx frontend tidak bisa reach backend

**Root cause:** Container `simmaci_frontend` lama (dari deploy sebelumnya tanpa Traefik label) masih aktif di network `sim-maarif-fullstack_default`, sedangkan backend dari stack baru ada di network `yam0yy..._simmaci-network`.

**Fix sementara di server:** `docker network connect --alias backend yam0yy9a6l424v8j89hv7pqr_simmaci-network backend-yam0yy...`

**Fix permanen di codebase:**
- `Dockerfile` backend: tambah wait loop DB sebelum migrate, stop kalau migrate gagal
- `nginx/entrypoint.sh`: bersihkan sed placeholder yang tidak efektif
- `docker-compose.coolify.yml`: frontend `depends_on: backend: condition: service_healthy`

---

## Bugfix Frontend

### FE-1 · Fix: TDZ error saat unduh SK di Arsip SK Unit

**File:** `src/features/sk-management/MySkPage.tsx`  
**Root cause:** `periodeValue` dideklarasikan setelah `kataPengangkatan` yang memakainya → Temporal Dead Zone error saat tombol unduh diklik.

**Fix:** Pindahkan deklarasi `periodeValue` ke atas `kataPengangkatan`.


### FE-2 · Fix: Absensi staff blank setelah scan QR

**File:** `src/features/attendance/PublicScannerPage.tsx`  

**Root cause (3 masalah):**
1. Setelah QR terdeteksi, scanner stop → `scanning = false`, `scanResult` terisi, tapi tidak ada UI state yang aktif → blank
2. `submitAttendance` tidak set loading state → blank selama API call
3. Scanner tidak restart otomatis setelah selesai

**Fix:**
- Tambah state `submitting` + overlay loading "Memproses absensi..."
- Restart scanner otomatis 1.5 detik setelah submit selesai
- Pesan GPS lebih informatif


### FE-3 · Fix: Checkbox approve SK tidak muncul

**File:** `src/features/sk-management/SkDashboardPage.tsx`  
**Root cause:** Kondisi `status === 'draft'` mengecek status item individual. Data dari tab "Antrean Draft" di-query dengan `status: 'unverified'` yang mengembalikan item dengan status `'pending'` — tidak pernah match `'draft'`.  
**Fix:** Ganti ke `statusFilter === 'draft'`.

---

## Fitur Baru: Lock/Unlock Pengajuan SK per Madrasah

### Latar Belakang
Pengajuan SK untuk jenjang MI ke atas ditutup per 1 Juli 2026. RA/TK tetap buka. Madrasah yang sudah menghubungi pengurus LP Ma'arif NU Cilacap bisa dibuka kembali tanpa perlu deploy ulang.

### Arsitektur

```
Field: schools.sk_submission_unlocked (nullable boolean)
  null  = ikuti aturan global (RA/TK buka, MI ke atas tutup)
  true  = dibuka khusus oleh admin
  false = ditutup paksa (override global)
```

### Perubahan

**Backend:**
- Migration: `add_sk_submission_unlocked_to_schools_table`
- Model `School`: tambah field + cast boolean
- `SchoolController::toggleSkSubmission()`: `PATCH /schools/{id}/sk-submission-unlock`
- `SchoolController::resetAllSkSubmission()`: `PATCH /schools/sk-submission-reset-all` — reset semua MI ke atas ke default (locked) dalam satu klik
- `SkDocumentController::submitRequest()`: cek `sk_submission_unlocked` sebelum blokir jenjang
- `SkDocumentController::processBulkRequestSync()`: cek per-row di loop bulk

**Frontend:**
- `src/lib/api.ts`: `schoolApi.toggleSkSubmission()`, `schoolApi.resetAllSkSubmission()`
- `SkSubmissionPage.tsx`:
  - Variabel `isSkLocked` — computed dari jenjang + `sk_submission_unlocked`
  - Banner 3 kondisi: hijau (RA/TK buka), biru (unlocked admin), merah (ditutup)
  - Tombol submit disabled + pesan "Pengajuan Ditutup" kalau locked
  - Tab Import Kolektif diganti blok pesan kalau locked
- `AdminSchoolManagementPage.tsx`:
  - Kolom "Pengajuan SK" di tabel dengan tombol toggle per-madrasah
  - Tombol "Tutup Semua Pengajuan SK" di header dengan konfirmasi

### Cara Pakai (tanpa ubah kode)
1. Operator MI ke atas menghubungi LP Ma'arif NU Cilacap
2. Admin buka **Dashboard → Kelola Sekolah**
3. Klik tombol **"Ditutup"** di kolom "Pengajuan SK" pada baris madrasah yang bersangkutan
4. Status berubah ke **"Dibuka"** — operator langsung bisa mengajukan SK
5. Untuk tutup kembali: klik **"Dibuka"** → kembali ke "Ditutup"
6. Untuk tutup semua sekaligus: klik tombol **"Tutup Semua Pengajuan SK"** di bagian atas halaman

---

## Bugfix Test

### Test suites yang fail setelah fitur lock SK ditambahkan

**Masalah:**
1. `BulkSkRequestTest`, `BulkSkImportPreservationTest`, `BulkSkImportDuplicateTeacherTest` — semua pakai sekolah `MI Ma'arif NU ...` yang sekarang terblokir
2. PNS auto-reject: `approval_histories.performed_by NOT NULL constraint` — diisi `null` padahal NOT NULL

**Fix:**
- Tambah `'sk_submission_unlocked' => true` di `setUp()` semua test yang pakai sekolah MI
- Ganti `performed_by => null` jadi `performed_by => $request->user()->id` di PNS auto-reject

---

## Notes Teknis

### Urutan pengecekan di `submitRequest`/`bulkRequest`

```
1. Validasi request fields
2. Normalisasi nama sekolah + guru
3. Resolve school_id
4. [BARU] Cek sk_submission_unlocked untuk jenjang MI ke atas
5. PNS auto-reject
6. Duplicate guard (pending yang sama)
7. Create/update Teacher + SkDocument
```

### Kenapa tidak pakai seeder/setting global

Menggunakan kolom per-madrasah (`schools.sk_submission_unlocked`) lebih granular daripada setting global karena:
- Setiap madrasah bisa dibuka secara independen
- Perubahan tidak mempengaruhi madrasah lain
- Audit trail tersimpan di ActivityLog per madrasah
- Tidak perlu restart server / deploy ulang

---

## Detail Kode yang Diubah

---

### 1. `src/features/sk-management/MySkPage.tsx` — Fix TDZ `periodeValue`

**Commit:** `02e69ef`

```typescript
// ── SEBELUM (buggy) ──────────────────────────────────────────────────
// kataPengangkatan dideklarasikan SEBELUM periodeValue

// Kata pengangkatan
const kataPengangkatan: string = (() => {
  if (!teacherData.tmt || !sk.tanggal_penetapan) return "diangkat sebagai"
  const tmt = new Date(teacherData.tmt)
  const penetapan = new Date(sk.tanggal_penetapan)
  if (isNaN(tmt.getTime()) || isNaN(penetapan.getTime())) return "diangkat sebagai"
  const diffDays = Math.ceil((penetapan.getTime() - tmt.getTime()) / (1000 * 60 * 60 * 24))
  const isUnder11Months = diffDays <= 330
  const isFirstGty = templateId === "gty" && periodeValue === 2  // ❌ periodeValue belum ada!
  return (isUnder11Months || isFirstGty) ? "diangkat sebagai" : "diangkat kembali sebagai"
})()

// ... banyak kode lain ...

// Hitung PERIODE (tahun pengabdian) dari TMT ke tanggal penetapan
const periodeValue: number = (() => {
  if (!teacherData.tmt || !sk.tanggal_penetapan) return 0
  const tmt = new Date(teacherData.tmt)
  const penetapan = new Date(sk.tanggal_penetapan)
  if (isNaN(tmt.getTime()) || isNaN(penetapan.getTime())) return 0
  const diffMs = penetapan.getTime() - tmt.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.25))
})()


// ── SESUDAH (fixed) ──────────────────────────────────────────────────
// periodeValue dideklarasikan LEBIH DULU

// Hitung PERIODE — harus di atas kataPengangkatan karena dipakai di dalamnya
const periodeValue: number = (() => {
  if (!teacherData.tmt || !sk.tanggal_penetapan) return 0
  const tmt = new Date(teacherData.tmt)
  const penetapan = new Date(sk.tanggal_penetapan)
  if (isNaN(tmt.getTime()) || isNaN(penetapan.getTime())) return 0
  const diffMs = penetapan.getTime() - tmt.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.25))
})()

// Kata pengangkatan — sekarang bisa akses periodeValue
const kataPengangkatan: string = (() => {
  if (!teacherData.tmt || !sk.tanggal_penetapan) return "diangkat sebagai"
  const tmt = new Date(teacherData.tmt)
  const penetapan = new Date(sk.tanggal_penetapan)
  if (isNaN(tmt.getTime()) || isNaN(penetapan.getTime())) return "diangkat sebagai"
  const diffDays = Math.ceil((penetapan.getTime() - tmt.getTime()) / (1000 * 60 * 60 * 24))
  const isUnder11Months = diffDays <= 330
  const isFirstGty = templateId === "gty" && periodeValue === 2  // ✅ OK
  return (isUnder11Months || isFirstGty) ? "diangkat sebagai" : "diangkat kembali sebagai"
})()
```

---

### 2. `src/features/attendance/PublicScannerPage.tsx` — Fix blank state & restart scanner

**Commit:** `c9cf7c4` + `b9a3f1f`

```typescript
// ── TAMBAH state submitting ──────────────────────────────────────────
const [submitting, setSubmitting] = useState(false);

// ── OVERLAY loading saat submit (BARU) ─────────────────────────────
{submitting && (
  <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-4 gap-4 z-20">
    <Loader2 className="h-10 w-10 text-blue-400 animate-spin" />
    <p className="text-blue-300 font-bold text-sm">Memproses absensi...</p>
  </div>
)}

// ── Default screen: tambah !submitting ──────────────────────────────
{!scanning && !scanResult && !submitting && faceVerificationStatus === 'idle' && (
  // ... form default
)}

// ── submitAttendance: tambah setSubmitting + restart scanner ─────────
const submitAttendance = async (qrCode: string, faceVerified: boolean = false) => {
  // cek lokasi GPS
  if (!location && attendanceType === 'Kantor' && isGeolocationEnabled) {
    toast.error('Lokasi GPS belum terdeteksi. Aktifkan izin lokasi dan coba lagi.')
    setScanResult(null)
    setFaceVerificationStatus('idle')
    setTimeout(() => startScanner(), 500)  // BARU: restart otomatis
    return;
  }

  setSubmitting(true);  // BARU: set loading
  try {
    const res = await staffAttendanceApi.scan({ ... });
    toast.success(res.message || 'Absen berhasil dicatat.')
  } catch (error: any) {
    // ... error handling per status HTTP
  } finally {
    setSubmitting(false);  // BARU: clear loading
    setScanResult(null);
    setFaceVerificationStatus('idle');
    setTimeout(() => startScanner(), 1500);  // BARU: restart otomatis 1.5s
  }
};

// ── GPS warning: pesan lebih informatif ────────────────────────────
// Sebelum: toast.warning('Menunggu lokasi GPS...')
// Sesudah:
toast.warning('Menunggu lokasi GPS... Coba lagi dalam beberapa detik.');
```

---

### 3. `src/features/sk-management/SkDashboardPage.tsx` — Fix checkbox approve SK

**Commit:** `128d728`

```typescript
// ── SEBELUM (buggy) ──────────────────────────────────────────────────
<TableCell className="pl-8">
  {status === 'draft' && (  // ❌ 'status' adalah status item, bukan tab aktif
    <Checkbox
      checked={selectedIds.has(item.id)}
      onCheckedChange={(checked) => handleSelectRow(item.id, !!checked)}
    />
  )}
</TableCell>

// ── SESUDAH (fixed) ──────────────────────────────────────────────────
<TableCell className="pl-8">
  {statusFilter === 'draft' && (  // ✅ 'statusFilter' adalah tab yang aktif
    <Checkbox
      checked={selectedIds.has(item.id)}
      onCheckedChange={(checked) => handleSelectRow(item.id, !!checked)}
    />
  )}
</TableCell>
```

---

### 4. `backend/database/migrations/2026_07_21_..._add_sk_submission_unlocked_to_schools_table.php` — Migration baru

**Commit:** `4c84d87`

```php
public function up(): void
{
    Schema::table('schools', function (Blueprint $table) {
        $table->boolean('sk_submission_unlocked')
            ->nullable()
            ->default(null)
            ->after('jenjang')
            ->comment('null=ikuti aturan global, true=unlocked oleh admin, false=locked paksa');
    });
}

public function down(): void
{
    Schema::table('schools', function (Blueprint $table) {
        $table->dropColumn('sk_submission_unlocked');
    });
}
```

---

### 5. `backend/app/Models/School.php` — Tambah field ke model

**Commit:** `4c84d87`

```php
// Tambah ke $fillable
protected $fillable = [
    'nsm', 'npsn', 'nama', 'alamat',
    'provinsi', 'kabupaten', 'kecamatan', 'kelurahan',
    'telepon', 'email', 'kepala_madrasah',
    'akreditasi', 'status', 'status_jamiyyah', 'npsm_nu', 'jenjang',
    'kepala_nim', 'kepala_nuptk', 'kepala_whatsapp',
    'kepala_jabatan_mulai', 'kepala_jabatan_selesai',
    'sk_submission_unlocked',  // BARU
];

// Tambah cast
protected function casts(): array
{
    return [
        'sk_submission_unlocked' => 'boolean',
    ];
}
```

---

### 6. `backend/app/Http/Controllers/Api/SchoolController.php` — Endpoint toggle + reset-all

**Commit:** `4c84d87` + `acf281e`

```php
// ── BARU: Toggle per madrasah ─────────────────────────────────────────
/**
 * PATCH /api/schools/{school}/sk-submission-unlock
 */
public function toggleSkSubmission(Request $request, School $school): JsonResponse
{
    $data = $request->validate([
        'sk_submission_unlocked' => 'nullable|boolean',
    ]);

    $school->update(['sk_submission_unlocked' => $data['sk_submission_unlocked']]);

    $statusLabel = match ($school->sk_submission_unlocked) {
        true  => 'dibuka (unlocked oleh admin)',
        false => 'ditutup paksa',
        null  => 'mengikuti aturan global',
    };

    ActivityLog::log(
        description: "Toggle SK submission {$school->nama}: {$statusLabel}",
        event: 'update_school',
        logName: 'school',
        subject: $school,
        causer: $request->user(),
        schoolId: $school->id,
    );

    return response()->json([
        'success' => true,
        'message' => "Status pengajuan SK {$school->nama} berhasil diubah: {$statusLabel}",
        'data'    => [
            'id'                     => $school->id,
            'nama'                   => $school->nama,
            'jenjang'                => $school->jenjang,
            'sk_submission_unlocked' => $school->sk_submission_unlocked,
        ],
    ]);
}

// ── BARU: Reset semua ke null (locked) ────────────────────────────────
/**
 * PATCH /api/schools/sk-submission-reset-all
 */
public function resetAllSkSubmission(Request $request): JsonResponse
{
    $updated = School::whereNotIn('jenjang', ['RA', 'TK'])
        ->whereNotNull('sk_submission_unlocked')
        ->update(['sk_submission_unlocked' => null]);

    ActivityLog::log(
        description: "Reset semua izin SK submission ke default ({$updated} madrasah)",
        event: 'update_school',
        logName: 'school',
        subject: null,
        causer: $request->user(),
        schoolId: null,
    );

    return response()->json([
        'success' => true,
        'message' => "{$updated} madrasah berhasil direset ke status default (pengajuan ditutup).",
        'data'    => ['updated_count' => $updated],
    ]);
}
```

---

### 7. `backend/routes/api.php` — Route baru

**Commit:** `4c84d87` + `acf281e`

```php
// Sebelum
Route::get('schools/profile/me', [SchoolController::class, 'profile']);
Route::get('schools/autocomplete', [SchoolController::class, 'autocomplete']);
Route::apiResource('schools', SchoolController::class);

// Sesudah
Route::get('schools/profile/me', [SchoolController::class, 'profile']);
Route::get('schools/autocomplete', [SchoolController::class, 'autocomplete']);
Route::patch('schools/{school}/sk-submission-unlock', [SchoolController::class, 'toggleSkSubmission'])
    ->middleware('role:super_admin,admin_yayasan');
Route::patch('schools/sk-submission-reset-all', [SchoolController::class, 'resetAllSkSubmission'])
    ->middleware('role:super_admin,admin_yayasan');
Route::apiResource('schools', SchoolController::class);
```

---

### 8. `src/lib/api.ts` — Tambah method baru di schoolApi

**Commit:** `4c84d87` + `acf281e`

```typescript
// Tambah di akhir schoolApi
export const schoolApi = {
  // ... method existing ...
  generateAccounts: (schoolId?: number) => apiClient.post(...),

  // BARU: Toggle per madrasah
  toggleSkSubmission: (schoolId: number, unlocked: boolean | null) =>
    apiClient.patch(`/schools/${schoolId}/sk-submission-unlock`, { sk_submission_unlocked: unlocked }).then((r) => r.data),

  // BARU: Reset semua ke locked
  resetAllSkSubmission: () =>
    apiClient.patch('/schools/sk-submission-reset-all').then((r) => r.data),
};
```

---

### 9. `src/features/sk-management/SkSubmissionPage.tsx` — Lock form + banner 3 kondisi

**Commit:** `1615c0a` + `4c84d87`

```typescript
// ── BARU: Computed isSkLocked ─────────────────────────────────────────
const isSkLocked = (() => {
  if (!isOperator) return false
  if (!schoolProfile) return false
  const jenjang = (schoolProfile.jenjang || "").toUpperCase()
  const isRaTk = jenjang === "RA" || jenjang === "TK"
      || jenjang.includes("RA") || jenjang.includes("TK")
  if (isRaTk) return false
  if (schoolProfile.sk_submission_unlocked === true) return false
  return true  // default: MI ke atas = locked
})()

// ── BARU: Banner 3 kondisi ────────────────────────────────────────────
{isOperator && schoolProfile && (() => {
  const jenjang = (schoolProfile.jenjang || "").toUpperCase()
  const isRaTk = jenjang === "RA" || jenjang === "TK"
      || jenjang.includes("RA") || jenjang.includes("TK")

  if (isRaTk) {
    return (
      <div className="flex items-start gap-4 bg-emerald-50 border border-emerald-200 rounded-2xl px-6 py-4">
        <CheckCircle className="h-5 w-5 text-emerald-600" />
        <div>
          <p className="text-sm font-black text-emerald-900 uppercase">Pengajuan SK Dibuka</p>
          <p className="text-xs text-emerald-700 mt-1">
            Pengajuan SK untuk jenjang <strong>RA/TK</strong> saat ini dibuka.
          </p>
        </div>
      </div>
    )
  }

  if (schoolProfile.sk_submission_unlocked === true) {
    return (
      <div className="flex items-start gap-4 bg-blue-50 border border-blue-200 rounded-2xl px-6 py-4">
        <CheckCircle className="h-5 w-5 text-blue-600" />
        <div>
          <p className="text-sm font-black text-blue-900 uppercase">Pengajuan Diizinkan oleh LP Ma'arif NU Cilacap</p>
          <p className="text-xs text-blue-700 mt-1">
            Madrasah ini telah mendapatkan izin khusus dari pengurus LP Ma'arif NU Cilacap.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-4 bg-red-50 border border-red-200 rounded-2xl px-6 py-4">
      <AlertTriangle className="h-5 w-5 text-red-600" />
      <div>
        <p className="text-sm font-black text-red-900 uppercase">
          Pengajuan SK Ditutup — Per 1 Juli 2026
        </p>
        <p className="text-xs text-red-700 mt-1">
          Pengajuan SK untuk jenjang <strong>{schoolProfile.jenjang}</strong> telah ditutup.
          Silakan hubungi pengurus <strong>LP Ma'arif NU Cilacap</strong> untuk mendapatkan izin.
        </p>
      </div>
    </div>
  )
})()}

// ── BARU: Tombol submit disabled kalau locked ─────────────────────────
<Button
  type="submit"
  disabled={isSubmitting || isUploading || isSkLocked}  // tambah isSkLocked
  onClick={isSkLocked
    ? (e) => { e.preventDefault(); toast.error("Pengajuan SK ditutup. Hubungi LP Ma'arif NU Cilacap.") }
    : undefined}
>
  {isSkLocked ? "Pengajuan Ditutup" : "Simpan & Ajukan"}
</Button>

// ── BARU: Tab Import Kolektif diblokir kalau locked ───────────────────
<TabsContent value="collective">
  {isSkLocked ? (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertTriangle className="h-8 w-8 text-red-500" />
        <p className="font-black text-slate-800 uppercase">Pengajuan Ditutup</p>
        <p className="text-xs text-slate-500 max-w-xs text-center">
          Import kolektif tidak tersedia. Pengajuan SK ditutup per 1 Juli 2026.
        </p>
      </CardContent>
    </Card>
  ) : (
    <BulkSkSubmission />
  )}
</TabsContent>
```

---

### 10. `src/features/schools/AdminSchoolManagementPage.tsx` — Toggle per-madrasah & reset all

**Commit:** `acf281e`

```typescript
// ── BARU: Mutation toggle per madrasah ───────────────────────────────
const toggleSkMutation = useMutation({
  mutationFn: ({ schoolId, unlocked }: { schoolId: number; unlocked: boolean | null }) =>
    schoolApi.toggleSkSubmission(schoolId, unlocked),
  onSuccess: (_, variables) => {
    queryClient.invalidateQueries({ queryKey: ['admin-schools'] })
    const label = variables.unlocked === true ? 'dibuka'
      : variables.unlocked === false ? 'ditutup paksa' : 'direset ke default'
    toast.success(`Pengajuan SK berhasil ${label}`)
  },
  onError: () => toast.error('Gagal mengubah status pengajuan SK'),
})

// ── BARU: Mutation reset semua ────────────────────────────────────────
const resetAllSkMutation = useMutation({
  mutationFn: () => schoolApi.resetAllSkSubmission(),
  onSuccess: (data: any) => {
    queryClient.invalidateQueries({ queryKey: ['admin-schools'] })
    toast.success(data?.message || 'Semua izin pengajuan SK berhasil direset')
  },
  onError: () => toast.error('Gagal mereset izin pengajuan SK'),
})

// ── BARU: Tombol "Tutup Semua" di header ─────────────────────────────
<Button
  variant="outline"
  size="sm"
  disabled={resetAllSkMutation.isPending}
  onClick={() => {
    if (window.confirm('Reset semua izin yang sudah dibuka ke default (ditutup)?')) {
      resetAllSkMutation.mutate()
    }
  }}
  className="border-red-200 text-red-600 hover:bg-red-50"
>
  <Lock className="h-3.5 w-3.5 mr-1" />
  Tutup Semua Pengajuan SK
</Button>

// ── BARU: Kolom "Pengajuan SK" di tabel ──────────────────────────────
<TableHead>Pengajuan SK</TableHead>

// Per row — cek jenjang + sk_submission_unlocked
<TableCell onClick={(e) => e.stopPropagation()}>
  {(() => {
    const jenjang = (school.jenjang || "").toUpperCase()
    const isRaTk = jenjang === "RA" || jenjang === "TK"
    if (isRaTk) {
      return <Badge className="bg-emerald-100 text-emerald-700">Selalu Buka</Badge>
    }
    const isUnlocked = school.sk_submission_unlocked === true
    return (
      <Button
        size="sm"
        disabled={toggleSkMutation.isPending}
        onClick={() => toggleSkMutation.mutate({
          schoolId: school.id,
          unlocked: isUnlocked ? null : true  // toggle: null=reset ke locked, true=buka
        })}
        className={isUnlocked
          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
          : 'bg-red-50 text-red-600 hover:bg-red-100'}
      >
        {isUnlocked ? <><LockOpen className="h-3 w-3 mr-1" />Dibuka</>
          : <><Lock className="h-3 w-3 mr-1" />Ditutup</>}
      </Button>
    )
  })()}
</TableCell>
```

---

### 11. `backend/app/Http/Controllers/Api/SkDocumentController.php` — Cek lock di submitRequest & bulkRequest

**Commit:** `acf281e`

```php
// ── submitRequest: ganti blokir jenjang lama dengan cek sk_submission_unlocked ──

// SEBELUM
if (in_array($detectedJenjang, ['MI', 'SD', 'MTS', 'SMP', 'MA', 'SMA', 'SMK'])) {
    $isException = stripos($data['unit_kerja'], 'sidaurip') !== false
        || stripos($data['unit_kerja'], 'mergawati') !== false;
    if (!$isException) {
        return response()->json([
            'message' => "Pengajuan SK untuk jenjang {$detectedJenjang} saat ini sudah ditutup.",
        ], 422);
    }
}

// SESUDAH
if (in_array($detectedJenjang, ['MI', 'SD', 'MTS', 'SMP', 'MA', 'SMA', 'SMK'])) {
    $isUnlocked = $school && $school->sk_submission_unlocked === true;
    $isLegacyException = stripos($data['unit_kerja'], 'sidaurip') !== false
        || stripos($data['unit_kerja'], 'mergawati') !== false;

    if (! $isUnlocked && ! $isLegacyException) {
        return response()->json([
            'message' => "Pengajuan SK untuk jenjang {$detectedJenjang} saat ini sudah ditutup per 1 Juli 2026. "
                . "Hubungi LP Ma'arif NU Cilacap untuk mendapatkan izin pengajuan.",
        ], 422);
    }
}

// ── processBulkRequestSync: cek per-row ──────────────────────────────
// Di dalam loop foreach setelah $schoolId diresolved:
if ($request->user()->role === 'operator') {
    $schoolForCheck = $schoolId
        ? ($schoolObjectCache[$schoolId] ?? ($schoolObjectCache[$schoolId] = School::find($schoolId)))
        : null;
    $detectedJenjangBulk = $this->detectJenjang($schoolForCheck, $doc['unit_kerja'] ?? '');

    if (in_array($detectedJenjangBulk, ['MI', 'SD', 'MTS', 'SMP', 'MA', 'SMA', 'SMK'])) {
        $isUnlockedBulk = $schoolForCheck && $schoolForCheck->sk_submission_unlocked === true;
        $isLegacyExceptionBulk = stripos($doc['unit_kerja'] ?? '', 'sidaurip') !== false
            || stripos($doc['unit_kerja'] ?? '', 'mergawati') !== false;

        if (! $isUnlockedBulk && ! $isLegacyExceptionBulk) {
            $skipped++;
            $rejectedRows[] = [
                'nama'   => $doc['nama'] ?? 'unknown',
                'alasan' => "Pengajuan SK untuk jenjang {$detectedJenjangBulk} ditutup per 1 Juli 2026.",
            ];
            continue;
        }
    }
}
```

---

### 12. `backend/app/Http/Controllers/Api/SkDocumentController.php` — Fix `performed_by null`

**Commit:** `dd17c28`

```php
// SEBELUM — PNS auto-reject menyebabkan NOT NULL constraint violation
\App\Models\ApprovalHistory::create([
    'school_id'    => $createdDoc->school_id,
    'document_id'  => $createdDoc->id,
    'document_type'=> 'sk_document',
    'action'       => 'reject',
    'from_status'  => 'pending',
    'to_status'    => 'rejected',
    'performed_by' => null,  // ❌ NOT NULL column!
    'performed_at' => now(),
    'comment'      => 'Ditolak otomatis oleh sistem',
    'metadata'     => ['rejection_reason' => 'PTK berstatus PNS...'],
]);

// SESUDAH
\App\Models\ApprovalHistory::create([
    // ...
    'performed_by' => $request->user()->id,  // ✅ gunakan ID user yang submit
    // ...
]);
```

---

### 13. Test fixtures — `sk_submission_unlocked = true` untuk sekolah MI

**Commit:** `dd17c28`  
**Files:** `BulkSkRequestTest.php`, `BulkSkImportPreservationTest.php`, `BulkSkImportDuplicateTeacherTest.php`

```php
// SEBELUM — sekolah MI tanpa flag → terblokir fitur baru
$this->school = School::factory()->create([
    'nama' => 'MI Ma\'arif NU 03 Karangsembung',
]);

// SESUDAH — unlock untuk keperluan testing
$this->school = School::factory()->create([
    'nama' => 'MI Ma\'arif NU 03 Karangsembung',
    'sk_submission_unlocked' => true,  // TAMBAH: bypass lock untuk testing
]);
```

---

### 14. Bugfix: Toggle SK tidak langsung update UI setelah "Tutup Semua"

**Commit:** `24099f7`

**Gejala:** Setelah menekan tombol "Tutup Semua Pengajuan SK", tombol per-madrasah yang sebelumnya "Dibuka" tidak kembali berubah ke "Ditutup" secara real-time. Perlu refresh manual halaman.

**Root cause:** TanStack Query meng-cache data sekolah dari API `GET /api/schools`. Default `staleTime` di project ini tidak eksplisit di-set, sehingga data dianggap "fresh" selama beberapa menit. Setelah `queryClient.invalidateQueries` dipanggil di `onSuccess` mutation, data di-refetch — tapi state cache lama masih ditampilkan di UI sebelum refetch selesai. Ditambah lagi, jika user pindah filter kecamatan setelah toggle, query key berbeda sehingga invalidation tidak efektif.

**Fix:**

```typescript
// src/features/schools/AdminSchoolManagementPage.tsx

// SEBELUM — tanpa staleTime, pakai default cache
const { data: schoolsData, isLoading } = useQuery({
  queryKey: ['admin-schools', currentPage, debouncedSearchTerm, filterKecamatan],
  queryFn: () => schoolApi.paginate({ ... }),
})

// SESUDAH — staleTime: 0 agar data selalu fresh
const { data: schoolsData, isLoading } = useQuery({
  queryKey: ['admin-schools', currentPage, debouncedSearchTerm, filterKecamatan],
  queryFn: () => schoolApi.paginate({ ... }),
  staleTime: 0, // selalu fetch fresh — kolom sk_submission_unlocked harus up-to-date
})
```

---

## File-File yang Dimodifikasi (Ringkasan)

| File | Jenis | Commit |
|---|---|---|
| `src/features/sk-management/MySkPage.tsx` | FE | `02e69ef` |
| `src/features/attendance/PublicScannerPage.tsx` | FE | `c9cf7c4`, `b9a3f1f` |
| `src/features/sk-management/SkDashboardPage.tsx` | FE | `128d728` |
| `src/features/sk-management/SkSubmissionPage.tsx` | FE | `1615c0a`, `4c84d87` |
| `src/features/schools/AdminSchoolManagementPage.tsx` | FE | `acf281e`, `24099f7` |
| `src/lib/api.ts` | FE | `4c84d87`, `acf281e` |
| `backend/app/Models/School.php` | BE | `4c84d87` |
| `backend/app/Http/Controllers/Api/SchoolController.php` | BE | `4c84d87`, `0f97079`, `acf281e` |
| `backend/app/Http/Controllers/Api/SkDocumentController.php` | BE | `acf281e`, `dd17c28` |
| `backend/routes/api.php` | BE | `4c84d87`, `acf281e` |
| `backend/database/migrations/2026_07_21_..._add_sk_submission_unlocked...php` | BE | `4c84d87` |
| `backend/tests/Feature/BulkSkRequestTest.php` | Test | `dd17c28` |
| `backend/tests/Feature/BulkSkImportPreservationTest.php` | Test | `dd17c28` |
| `backend/tests/Feature/BulkSkImportDuplicateTeacherTest.php` | Test | `dd17c28` |
