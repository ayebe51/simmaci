# Laporan Pekerjaan — 22 Juli 2026

**Proyek:** SIMMACI — Sistem Informasi Manajemen Pendidikan LP Ma'arif NU Cilacap  
**Tanggal:** Rabu 22 Juli 2026  
**Tipe:** Bugfix + fitur baru (normalisasi status kepegawaian)  
**Ringkasan:** 9 commit — 2 fix CI/CD deployment, 1 fix viewer ijazah, 3 perbaikan logika normalisasi status GTY/GTT/Tendik di backend, 1 fitur baru (Koreksi Status + auto-infer pendidikan), 1 fix test, 1 fix SK Generator (gelar diploma).

---

## Ringkasan Commit

| Jam (WIB) | Hash | Area | Deskripsi |
|---|---|---|---|
| 08:27 | `5059ba4` | FE | Fix viewer ijazah di revisi SK: gunakan `/api/files/view/` dengan auth token |
| 08:54 | `47aa1db` | Infra | `createbuckets restart: no` agar tidak memblokir Coolify deployment |
| 09:11 | `2d62e12` | CI/CD | Tambah `ignore-error=true` pada `cache-to` GHA agar build tidak gagal |
| 10:27 | `b3bede2` | BE | Fix: singkatan nama jangan di-parse sebagai gelar akademik |
| 11:37 | `b40091d` | BE+FE | Feat: Koreksi Status kepegawaian (dry-run + apply) berbasis TMT dan gelar |
| 11:49 | `47b243d` | Test | Fix TeacherFactory: `diffInYears` urutan argumen terbalik |
| 12:02 | `e310321` | BE+Test | Fix: perbaiki logika penentuan status GTY/GTT/Tendik di NormalizationService |
| 14:29 | `e051649` | BE+FE | Feat: auto-infer `pendidikan_terakhir` dari gelar di nama guru |
| 15:05 | `d475d5c` | FE | Fix: gelar diploma (A.Ma/A.Md) tidak boleh pakai template GTY/GTT |

---

## Detail Pekerjaan

---

### 1. Fix: Viewer Ijazah di Revisi SK

**Commit:** `5059ba4` — 08:27 WIB  
**File:** `src/features/sk-management/SkRevisionListPage.tsx`

**Masalah:** Link "Lihat Ijazah" di dialog revisi SK menggunakan URL `/api/minio/...` yang langsung ke MinIO tanpa autentikasi. Di deployment produksi dengan bucket private, request langsung ke MinIO menghasilkan `403 Forbidden` atau `401 Unauthorized`.

**Root cause:** URL di-hardcode ke `/api/minio/${selectedItem.ijazah_url}` — melewati middleware auth Laravel.

**Fix:** Gunakan endpoint proxy `/api/files/view/` dengan `Authorization: Bearer <token>` header, fetch lalu buka sebagai Object URL.

```typescript
// SEBELUM (buggy)
import { skApi, authApi, skTemplateApi } from "@/lib/api";
// ...
<a href={`/api/minio/${selectedItem.ijazah_url}`} target="_blank" ...>

// SESUDAH (fixed)
import { skApi, authApi, skTemplateApi, API_URL } from "@/lib/api";
// ...
<a
  href={`${API_URL}/files/view/${selectedItem.ijazah_url
    .replace(/^\/?(storage\/|api\/minio\/)?/, '')
    .split('/').map(encodeURIComponent).join('/')}`}
  onClick={(e) => {
    e.preventDefault()
    const token = localStorage.getItem('auth_token')
    const path = selectedItem.ijazah_url.replace(/^\/?(storage\/|api\/minio\/)?/, '')
    const url = `${API_URL}/files/view/${path.split('/').map(encodeURIComponent).join('/')}`
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.blob() })
      .then(blob => {
        const objUrl = URL.createObjectURL(blob)
        window.open(objUrl, '_blank')
      })
      .catch(() => toast.error('Gagal membuka ijazah. File mungkin tidak tersedia.'))
  }}
>
```

---

### 2. Fix Infra: `createbuckets` Tidak Blokir Deployment

**Commit:** `47aa1db` — 08:54 WIB  
**File:** `docker-compose.coolify.yml`

**Masalah:** Service `createbuckets` (MinIO init bucket) tidak punya `restart: no`. Docker Compose menganggap service ini perlu terus berjalan; kalau selesai/exit, orchestrator mencoba restart — memblokir alur health check deployment Coolify.

**Masalah tambahan:** Frontend di-start tanpa menunggu backend siap (`depends_on: - backend` tanpa kondisi health).

```yaml
# SEBELUM
  createbuckets:
    image: minio/mc
    container_name: simmaci-mc
    depends_on:
      minio:
        condition: service_healthy

  frontend:
    depends_on:
      - backend

# SESUDAH
  createbuckets:
    image: minio/mc
    container_name: simmaci-mc
    restart: no          # ← TAMBAH: exit setelah selesai, jangan restart
    depends_on:
      minio:
        condition: service_healthy

  frontend:
    depends_on:
      backend:
        condition: service_healthy   # ← TAMBAH: tunggu backend healthy dulu
```

---

### 3. Fix CI/CD: Cache GHA Tidak Gagalkan Build

**Commit:** `2d62e12` — 09:11 WIB  
**File:** `.github/workflows/main.yml`

**Masalah:** GitHub Actions build gagal dengan error `cache storage quota exceeded` atau storage error sementara pada step `cache-to`. Karena error ini menyebabkan seluruh build dianggap gagal, padahal image sudah berhasil di-build.

```yaml
# SEBELUM
cache-to: type=gha,mode=max

# SESUDAH (dua kali: backend & frontend)
cache-to: type=gha,mode=max,ignore-error=true
```

---

### 4. Fix Backend: Singkatan Nama Jangan Di-parse sebagai Gelar

**Commit:** `b3bede2` — 10:27 WIB  
**File:** `backend/app/Services/NormalizationService.php`  
**Method:** `mergeCompoundDegrees()`

**Masalah:** Nama seperti `ATIK RAMATIKA SD, A.Ma.Pd.` mengandung `SD` yang bisa salah diinterpretasikan. Lebih parah, urutan penulisan di Excel sering terbalik: `SD, A.Ma.Pd.` alih-alih `A.Ma.Pd.SD`.

**Fix:** Tambah regex untuk normalisasi urutan terbalik `SD, A.Ma.Pd.` → `A.Ma.Pd.SD`:

```php
// Tambahan di mergeCompoundDegrees()

// A.Ma.Pd. SD → A.Ma.Pd.SD  (urutan benar)
$name = preg_replace('/\bA\.?\s*Ma\.?\s*Pd\.?\s+SD\.?\b/i', 'A.Ma.Pd.SD', $name);

// SD[,] A.Ma.Pd. → A.Ma.Pd.SD  (urutan terbalik — sering di Excel)
$name = preg_replace('/\bSD[,\s]+A\.?\s*Ma\.?\s*Pd\.?\b/i', 'A.Ma.Pd.SD', $name);

// A.Ma. Pust → A.Ma.Pust  (Ahli Madya Pustakawan)
$name = preg_replace('/\bA\.?\s*Ma\.?\s+Pust\.?\b/i', 'A.Ma.Pust', $name);
```

---

### 5. Fitur Baru: Koreksi Status Kepegawaian (Dry-run + Apply)

**Commit:** `b40091d` — 11:37 WIB  
**Files:** `backend/app/Http/Controllers/Api/TeacherController.php`, `backend/app/Services/NormalizationService.php`, `backend/routes/api.php`, `src/features/master-data/TeacherListPage.tsx`, `src/lib/api.ts`

**Latar belakang:** Status kepegawaian (GTY/GTT/Tendik) banyak yang salah di database karena diisi manual oleh operator tanpa validasi. Misalnya guru dengan TMT 2018 tapi statusnya masih `GTT`, atau guru tanpa gelar tapi statusnya `GTY`. Fitur ini memungkinkan admin memproses ulang seluruh data sekaligus.

#### 5a. Backend — Endpoint `POST /api/teachers/recalculate-status`

Mendukung `?dry_run=true` untuk preview sebelum simpan. Memproses guru via `chunk(500)` untuk efisiensi memori. Skip guru berstatus `PNS`/`PPPK` (status final).

```php
// backend/app/Http/Controllers/Api/TeacherController.php

public function recalculateStatuses(Request $request): JsonResponse
{
    if (!in_array($request->user()->role, ['super_admin', 'admin_yayasan'])) {
        return $this->errorResponse('Anda tidak memiliki akses.', 403);
    }

    $isDryRun = $request->boolean('dry_run', false);
    $schoolId = $request->input('school_id');

    $query = Teacher::withoutTenantScope()
        ->whereNotIn('status', ['PNS', 'PPPK'])
        ->whereNotNull('status');

    if ($schoolId) {
        $query->where('school_id', $schoolId);
    }

    $updated = 0; $total = 0; $changes = [];

    $query->chunk(500, function ($teachers) use (&$updated, &$total, &$changes, $isDryRun) {
        foreach ($teachers as $teacher) {
            $total++;
            $originalStatus = $teacher->status;
            $tmt = null;
            if ($teacher->tmt) {
                try { $tmt = \Carbon\Carbon::parse((string) $teacher->tmt); }
                catch (\Exception $e) { $tmt = null; }
            }

            $newStatus = $this->normalizationService->normalizeEmploymentStatus(
                $originalStatus, $tmt, $teacher->nama, $teacher->pendidikan_terakhir
            );

            if ($newStatus !== $originalStatus) {
                if (!$isDryRun) { $teacher->update(['status' => $newStatus]); }
                $changes[] = [
                    'id'      => $teacher->id,
                    'nama'    => $teacher->nama,
                    'tmt'     => $teacher->tmt,
                    'dari'    => $originalStatus,
                    'menjadi' => $newStatus,
                ];
                $updated++;
            }
        }
    });

    if (!$isDryRun && $updated > 0) {
        ActivityLog::create([
            'description' => "Recalculate status kepegawaian: {$updated} dari {$total} guru diperbarui.",
            'event'       => 'recalculate_teacher_status',
            'log_name'    => 'master',
            'causer_id'   => $request->user()->id,
            'causer_type' => get_class($request->user()),
            'school_id'   => null,
            'properties'  => ['updated' => $updated, 'total' => $total],
        ]);
    }

    $message = $isDryRun
        ? "Preview: {$updated} dari {$total} guru akan diperbarui statusnya."
        : "Selesai: {$updated} dari {$total} guru berhasil diperbarui statusnya.";

    return $this->successResponse([
        'total' => $total, 'updated' => $updated,
        'dry_run' => $isDryRun,
        'changes' => $isDryRun ? $changes : array_slice($changes, 0, 50),
    ], $message);
}
```

#### 5b. Backend — `NormalizationService`: Re-evaluate TMT untuk GTY/GTT

Sebelumnya status yang sudah tersimpan valid (`GTY`/`GTT`) tidak diperiksa ulang via TMT. Sekarang jika TMT tersedia, status di-recalculate.

```php
// backend/app/Services/NormalizationService.php — normalizeEmploymentStatus()

// TAMBAH blok elseif ini setelah blok match existing:
} elseif (in_array($trimmed, ['GTY', 'GTT'], true) && $tmt !== null) {
    // Re-evaluate TMT-based status even for already-valid GTY/GTT values.
    // Corrects: status=GTT but TMT ≥ 2 years (should be GTY),
    //        or status=GTY but TMT < 2 years (should be GTT).
    $resolvedStatus = $this->resolveAktif($tmt);
}
```

#### 5c. Backend — Route Baru

```php
// backend/routes/api.php
Route::post('teachers/recalculate-status', [TeacherController::class, 'recalculateStatuses']);
```

#### 5d. Frontend — API Method

```typescript
// src/lib/api.ts — tambah di teacherApi
recalculateStatus: (params?: { dry_run?: boolean; school_id?: number }): Promise<any> =>
  apiClient.post('/teachers/recalculate-status', {}, { params }).then((r) => r.data),
```

#### 5e. Frontend — Tombol & Dialog Preview di TeacherListPage

Alur: klik "Koreksi Status" → dry-run otomatis → tampil dialog preview dengan tabel perubahan → konfirmasi → apply.

```typescript
// src/features/master-data/TeacherListPage.tsx

// State
const [isRecalcOpen, setIsRecalcOpen] = useState(false)
const [recalcResult, setRecalcResult] = useState<any>(null)

// Mutation dry-run
const recalcDryRunMutation = useMutation({
  mutationFn: () => teacherApi.recalculateStatus({ dry_run: true }),
  onSuccess: (res: any) => {
    setRecalcResult(res.data ?? res)
    setIsRecalcOpen(true)
  },
  onError: (e: any) => toast.error('Gagal memeriksa status: ' + (e.response?.data?.message || e.message))
})

// Mutation apply
const recalcMutation = useMutation({
  mutationFn: () => teacherApi.recalculateStatus({ dry_run: false }),
  onSuccess: (res: any) => {
    queryClient.invalidateQueries({ queryKey: ['teachers'] })
    const updated = res.data?.updated ?? res.updated ?? 0
    toast.success(`Selesai! ${updated} status guru berhasil dikoreksi.`)
    setIsRecalcOpen(false)
    setRecalcResult(null)
  },
  onError: (e: any) => toast.error('Gagal koreksi status: ' + (e.response?.data?.message || e.message))
})

// Tombol di toolbar (super_admin/admin_yayasan saja)
{ label: 'Koreksi Status', onClick: () => recalcDryRunMutation.mutate(),
  variant: 'teal', icon: <RefreshCw className="h-4 w-4" />,
  disabled: recalcDryRunMutation.isPending }
```

Dialog preview menampilkan: total diperiksa, jumlah akan dikoreksi, tabel nama + TMT + status lama → status baru. Tombol "Terapkan N Koreksi" hanya muncul jika ada perubahan.

---

### 6. Fix Test: `TeacherFactory` — `diffInYears` Urutan Argumen Terbalik

**Commit:** `47b243d` — 11:49 WIB  
**File:** `backend/database/factories/TeacherFactory.php`

**Masalah:** `now()->diffInYears($tmt)` menghasilkan nilai negatif karena `$tmt` ada di masa lalu. Akibatnya factory selalu mengassign `GTT`. Setelah `normalizeEmploymentStatus` diperbarui untuk re-evaluate `GTT` via TMT, guru dengan TMT lama (≥ 2 tahun) yang ter-assign `GTT` oleh factory akan dikoreksi ke `GTY` — menyebabkan `NormalizeDataCommandTest` gagal karena count perubahan tidak sesuai ekspektasi.

```php
// backend/database/factories/TeacherFactory.php

// SEBELUM (buggy — menghasilkan nilai negatif)
$diffYears = now()->diffInYears($tmt);

// SESUDAH (fixed — dari $tmt ke now, nilai positif)
$diffYears = \Carbon\Carbon::instance($tmt)->diffInYears(\Carbon\Carbon::now());
```

---

### 7. Fix Backend: Perbaiki Logika Penentuan Status GTY/GTT/Tendik

**Commit:** `e310321` — 12:02 WIB  
**Files:** `backend/app/Services/NormalizationService.php`, `backend/app/Console/Commands/NormalizeData.php`, `backend/tests/Feature/NormalizeDataCommandTest.php`

**Masalah:** Logika `normalizeEmploymentStatus()` sebelumnya hanya cek apakah nama punya gelar atau tidak, lalu langsung return `Tendik`. Tidak ada fallback ke `pendidikan_terakhir`, dan tidak ada perbedaan antara "tidak ada gelar" vs "hanya gelar Diploma".

**Aturan baru (berurutan, nama lebih dipercaya dari kolom pendidikan):**

1. Cek gelar dari nama:
   - Tidak ada gelar → cek `pendidikan_terakhir`
     - Jika S1/S2/S3 → biarkan GTY/GTT (nama mungkin belum punya gelar)
     - Selain itu → Tendik
   - Semua gelar Diploma (A.Md./A.Ma.) → Tendik
   - Ada gelar S1+ (S.Pd., M.Ag., Dr., dll.) → lanjut cek TMT
2. Jika `teacherName = null` → gunakan `pendidikan_terakhir` saja sebagai sinyal

```php
// backend/app/Services/NormalizationService.php — normalizeEmploymentStatus()

// SEBELUM
if ($teacherName !== null && in_array($resolvedStatus, ['GTY', 'GTT'], true)) {
    $parsedName = $this->parseAcademicDegrees($teacherName);
    if (empty($parsedName['prefix_degrees']) && empty($parsedName['suffix_degrees'])) {
        return 'Tendik';
    }
    // cek diploma...
}
// Check explicit pendidikan column (terpisah, selalu dijalankan)
if ($pendidikan !== null && in_array($resolvedStatus, ['GTY', 'GTT'], true)) {
    $p = preg_replace('/[^a-z0-9]/', '', mb_strtolower(trim($pendidikan)));
    if (in_array($p, ['d3', 'diii', 'd2', 'd1', 'sma', 'smp', 'sd', 'slta', 'sltp'])) {
        return 'Tendik';
    }
}

// SESUDAH
if ($teacherName !== null && in_array($resolvedStatus, ['GTY', 'GTT'], true)) {
    $parsedName = $this->parseAcademicDegrees($teacherName);
    $hasDegree  = !empty($parsedName['prefix_degrees']) || !empty($parsedName['suffix_degrees']);

    if (!$hasDegree) {
        // Tidak ada gelar — fallback ke pendidikan_terakhir
        if ($pendidikan !== null) {
            $p = preg_replace('/[^a-z0-9]/', '', mb_strtolower(trim($pendidikan), 'UTF-8'));
            if (in_array($p, ['s1', 's2', 's3', 'strata1', 'strata2', 'strata3', 'sarjana', 'magister', 'doktor'])) {
                return $resolvedStatus;  // nama belum punya gelar tapi pendidikan S1+ → tetap GTY/GTT
            }
        }
        return 'Tendik';  // tidak ada gelar DAN pendidikan bukan S1+ → Tendik
    }

    // Ada gelar — cek apakah semuanya diploma
    if (!empty($parsedName['suffix_degrees'])) {
        $isAllDiploma = true;
        foreach ($parsedName['suffix_degrees'] as $deg) {
            if (!str_starts_with($deg, 'A.Md') && !str_starts_with($deg, 'A.Ma')) {
                $isAllDiploma = false;
                break;
            }
        }
        if ($isAllDiploma) {
            return 'Tendik';  // semua gelar diploma → Tendik
        }
    }
    // Gelar S1+ → status GTY/GTT sudah benar

} elseif ($teacherName === null && $pendidikan !== null && in_array($resolvedStatus, ['GTY', 'GTT'], true)) {
    // Tidak ada nama → gunakan pendidikan sebagai satu-satunya sinyal
    $p = preg_replace('/[^a-z0-9]/', '', mb_strtolower(trim($pendidikan), 'UTF-8'));
    if (in_array($p, ['d3', 'diii', 'd2', 'd1', 'sma', 'smp', 'sd', 'slta', 'sltp'])) {
        return 'Tendik';
    }
}
```

**Fix `NormalizeData` command:** Lewatkan `pendidikan_terakhir` ke `normalizeEmploymentStatus()` agar kolom ini dipertimbangkan:

```php
// backend/app/Console/Commands/NormalizeData.php
$normalizedStatus = $this->normalizationService->normalizeEmploymentStatus(
    $originalStatus,
    $tmt,
    $normalizedName,           // ← gunakan nama yang sudah dinormalisasi
    $teacher->pendidikan_terakhir  // ← TAMBAH: pertimbangkan pendidikan juga
);
```

**Fix test** `NormalizeDataCommandTest`: data factory dibuat deterministik (`pendidikan_terakhir=S1`, `status=GTY`, `tmt=3 tahun lalu`) agar tidak berubah saat command dijalankan:

```php
// backend/tests/Feature/NormalizeDataCommandTest.php
Teacher::factory()->create([
    'nama' => 'ahmad dahlan, s.pd',
    'school_id' => $school->id,
    'pendidikan_terakhir' => 'S1',   // ← TAMBAH
    'status' => 'GTY',               // ← TAMBAH
    'tmt' => now()->subYears(3)->format('Y-m-d'),  // ← TAMBAH
]);
```

---

### 8. Fitur Baru: Auto-infer `pendidikan_terakhir` dari Gelar di Nama

**Commit:** `e051649` — 14:29 WIB  
**Files:** `backend/app/Services/NormalizationService.php`, `backend/app/Console/Commands/NormalizeData.php`, `backend/app/Http/Controllers/Api/TeacherController.php`, `src/features/master-data/TeacherListPage.tsx`

**Latar belakang:** Banyak guru yang kolom `pendidikan_terakhir`-nya kosong tapi namanya mengandung gelar seperti `S.Pd.`, `M.Ag.`, dll. Fitur ini otomatis mengisi kolom tersebut dari gelar yang terdeteksi — tanpa menimpa data yang sudah ada.

#### 8a. Method Baru: `inferPendidikanFromName()`

```php
// backend/app/Services/NormalizationService.php

/**
 * Infer pendidikan_terakhir dari gelar di nama guru.
 * Prof./Dr. → S3, M.* → S2, S.* → S1, A.Md./A.Ma. → D3
 * Return null jika tidak ada gelar terdeteksi.
 */
public function inferPendidikanFromName(?string $teacherName): ?string
{
    if ($teacherName === null || trim($teacherName) === '') return null;

    $parsed = $this->parseAcademicDegrees($teacherName);

    // Prefix: Prof./Dr./Dra. → S3
    foreach ($parsed['prefix_degrees'] as $deg) {
        $key = $this->degreeKey($deg);
        if (in_array($key, ['PROF', 'DR', 'DRA'])) return 'S3';
    }

    // Suffix: cari tingkat tertinggi
    $highest = null;
    $levelOrder = ['D3' => 1, 'S1' => 2, 'S2' => 3, 'S3' => 4];

    foreach ($parsed['suffix_degrees'] as $deg) {
        $key = $this->degreeKey($deg);
        $level = match (true) {
            str_starts_with($key, 'M') && strlen($key) >= 2            => 'S2',
            str_starts_with($key, 'S') && strlen($key) >= 2            => 'S1',
            str_starts_with($key, 'AMD') || str_starts_with($key, 'AMA') => 'D3',
            in_array($key, ['DIII', 'DII', 'DIV', 'DI'])               => 'D3',
            default => null,
        };
        if ($level !== null && ($highest === null
            || ($levelOrder[$level] ?? 0) > ($levelOrder[$highest] ?? 0))) {
            $highest = $level;
        }
    }
    return $highest;
}
```

#### 8b. Integrasi ke `NormalizeData` Command

```php
// backend/app/Console/Commands/NormalizeData.php

// Auto-fill pendidikan_terakhir jika kosong, infer dari gelar di nama
$originalPendidikan  = $teacher->pendidikan_terakhir;
$normalizedPendidikan = $originalPendidikan;
if (empty(trim((string) $originalPendidikan))) {
    $inferred = $this->normalizationService->inferPendidikanFromName($normalizedName);
    if ($inferred !== null) {
        $normalizedPendidikan = $inferred;
    }
}
// Perubahan dicatat di $changes dan $logChanges jika berbeda
```

#### 8c. Integrasi ke `recalculateStatuses` Controller

```php
// backend/app/Http/Controllers/Api/TeacherController.php — recalculateStatuses()

// Auto-infer pendidikan_terakhir jika kosong
$newPendidikan = $originalPendidikan;
if (empty(trim((string) $originalPendidikan))) {
    $inferred = $this->normalizationService->inferPendidikanFromName($teacher->nama);
    if ($inferred !== null) { $newPendidikan = $inferred; }
}

$newStatus = $this->normalizationService->normalizeEmploymentStatus(
    $originalStatus, $tmt, $teacher->nama, $newPendidikan ?? $originalPendidikan
);

// Update keduanya (status + pendidikan) dalam satu query jika ada perubahan
if ($statusChanged || $pendidikanChanged) {
    $toUpdate = [];
    if ($statusChanged)    $toUpdate['status']             = $newStatus;
    if ($pendidikanChanged) $toUpdate['pendidikan_terakhir'] = $newPendidikan;
    if (!$isDryRun) { $teacher->update($toUpdate); }
    $changes[] = [
        'id' => $teacher->id, 'nama' => $teacher->nama, 'tmt' => $teacher->tmt,
        'dari' => $originalStatus, 'menjadi' => $newStatus,
        'pendidikan_baru' => $pendidikanChanged ? $newPendidikan : null,
    ];
    $updated++;
}
```

#### 8d. Frontend — Badge `pendidikan_baru` di Dialog Preview

```tsx
// src/features/master-data/TeacherListPage.tsx — dialog Koreksi Status

// Tambah badge biru untuk pendidikan yang akan terisi otomatis
{c.pendidikan_baru && (
  <Badge className="text-[10px] px-1.5 py-0 rounded-lg font-bold border-0 bg-sky-100 text-sky-700">
    +{c.pendidikan_baru}
  </Badge>
)}

// Update keterangan aturan di footer dialog
Aturan: GTT → GTY jika TMT ≥ 2 tahun · GTY → GTT jika TMT &lt; 2 tahun
· Tanpa gelar → Tendik · Badge biru = pendidikan terisi otomatis dari gelar
```

---

### 9. Fix: Gelar Diploma Tidak Boleh Gunakan Template GTY/GTT

**Commit:** `d475d5c` — 15:05 WIB  
**Files:** `src/features/sk-management/SkGeneratorPage.tsx`, `src/features/sk-management/MySkPage.tsx`

**Masalah:** Nama seperti `SRI UTAMI, A.Ma.Pust.` mengandung koma → `hasGelarBelakang = true`. Karena kondisi hanya mengecek ada/tidaknya koma, dan TMT ≥ 2 tahun, sistem memilih template GTY. Padahal A.Ma./A.Md. adalah gelar Diploma → seharusnya template Tendik.

**Root cause:** Kondisi `hasGelar = hasGelarDepan || hasGelarBelakang || isPendidikanTinggi` tidak membedakan gelar S1+ dengan gelar Diploma.

**Fix:** Tambah variabel `isGelarDiplomaOnly` di kedua file:

```typescript
// SkGeneratorPage.tsx & MySkPage.tsx (logika identik)

// Ambil string gelar belakang (setelah koma)
const gelarBelakangStr = hasGelarBelakang
  ? namaLengkap.substring(namaLengkap.indexOf(',') + 1).trim()
  : ""

// Cek apakah HANYA diploma (A.Ma/A.Md) — tanpa ada gelar S1+ bersamaan
const isGelarDiplomaOnly = hasGelarBelakang
  && /^(A\.Ma|A\.Md|Amd|AMD)/i.test(gelarBelakangStr)
  && !/\b(S\.|M\.|Dr\.|Drs\.|Dra\.|Prof\.)/i.test(gelarBelakangStr)

// SEBELUM
const hasGelar = hasGelarDepan || hasGelarBelakang || isPendidikanTinggi

// SESUDAH
const hasGelar = hasGelarDepan || (hasGelarBelakang && !isGelarDiplomaOnly) || isPendidikanTinggi
```

**Hasilnya:**
- `SRI UTAMI, A.Ma.Pust.` → `isGelarDiplomaOnly = true` → `hasGelar = false` → template **Tendik** ✓
- `BUDI SANTOSO, S.Pd.` → `isGelarDiplomaOnly = false` → `hasGelar = true` → cek TMT → GTY/GTT ✓
- `ATIK, S.Pd., A.Md.` → ada `S.` → `isGelarDiplomaOnly = false` → `hasGelar = true` → cek TMT ✓

---

## File-File yang Dimodifikasi

| File | Jenis | Commit(s) | Perubahan |
|---|---|---|---|
| `src/features/sk-management/SkRevisionListPage.tsx` | FE | `5059ba4` | Viewer ijazah via auth proxy |
| `docker-compose.coolify.yml` | Infra | `47aa1db` | `restart: no` + `depends_on service_healthy` |
| `.github/workflows/main.yml` | CI/CD | `2d62e12` | `ignore-error=true` pada `cache-to` |
| `backend/app/Services/NormalizationService.php` | BE | `b3bede2`, `b40091d`, `e310321`, `e051649` | Fix gelar compound + re-evaluate TMT + aturan Tendik baru + `inferPendidikanFromName()` |
| `backend/app/Http/Controllers/Api/TeacherController.php` | BE | `b40091d`, `e051649` | Endpoint `recalculateStatuses` + auto-infer pendidikan |
| `backend/app/Console/Commands/NormalizeData.php` | BE | `e310321`, `e051649` | Lewat pendidikan ke normalizeStatus + auto-infer pendidikan |
| `backend/database/factories/TeacherFactory.php` | Test | `47b243d` | Fix `diffInYears` urutan argumen |
| `backend/tests/Feature/NormalizeDataCommandTest.php` | Test | `e310321` | Data factory deterministik |
| `backend/routes/api.php` | BE | `b40091d` | Route `POST teachers/recalculate-status` |
| `src/lib/api.ts` | FE | `b40091d` | `teacherApi.recalculateStatus()` |
| `src/features/master-data/TeacherListPage.tsx` | FE | `b40091d`, `e051649` | Tombol + dialog Koreksi Status + badge pendidikan |
| `src/features/sk-management/SkGeneratorPage.tsx` | FE | `d475d5c` | Fix `isGelarDiplomaOnly` |
| `src/features/sk-management/MySkPage.tsx` | FE | `d475d5c` | Fix `isGelarDiplomaOnly` |

---

## Catatan Teknis

### Prioritas pengecekan di `normalizeEmploymentStatus()`

```
1. Apakah status null/kosong? → return as-is
2. Apakah status bukan salah satu dari valid list? → resolve via match() mapping
   (HONORER→GTT, GURU TETAP YAYASAN→GTY, TENDIK→Tendik, dll.)
3. Apakah status sudah valid (GTY/GTT) dan ada TMT? → re-evaluate via resolveAktif(tmt)
4. Ada teacherName?
   a. Tidak ada gelar → cek pendidikan_terakhir → Tendik atau tetap GTY/GTT
   b. Semua gelar Diploma → Tendik
   c. Ada gelar S1+ → return resolvedStatus (GTY/GTT dari TMT sudah benar)
5. Tidak ada teacherName tapi ada pendidikan → cek D3/SMA → Tendik
6. Return resolvedStatus
```

### Perbedaan `calculatePeriode()` vs `diffMs / 365.25`

| Metode | TMT Des 2025, cetak Jul 2026 | Hasil |
|---|---|---|
| `Math.floor(diffMs / 365.25)` (lama MySkPage) | ~0.58 tahun | **0** |
| `calculatePeriode()` — selisih `getFullYear()` | 2026−2025 | **1** |

Keduanya menghasilkan GTT untuk kasus ini (< 2), tapi nilai `{PERIODE}` di dokumen berbeda. `calculatePeriode()` adalah metode yang konsisten dengan konvensi penomoran SK LP Ma'arif NU Cilacap.
