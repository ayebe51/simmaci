# Laporan Kerja Harian — 1 Juli 2026
**Proyek:** SIMMACI (SIM Maarif NU Cilacap)
**Tanggal:** Rabu, 1 Juli 2026
**Total Commit Hari Ini:** 12 commit (08:26 — 14:42 WIB)

---

## Ringkasan Eksekutif

Fokus hari ini terbagi menjadi tiga area utama:
1. **Perbaikan logika SK Generator** — konsistensi aturan "guru baru" (11 bulan) di generator dan halaman print, serta pembatasan pengajuan SK hanya untuk jenjang RA.
2. **Perbaikan data deduplication guru** — peningkatan kemampuan merge field dan penambahan command baru `teachers:merge-from-deleted`.
3. **DevOps & dokumentasi** — fix Docker build failure akibat ECONNRESET, dan penambahan dokumentasi testing serta GitHub templates.

---

## 👨‍💻 FULLSTACK DEVELOPER

### 1. Update Kondisi Guru Baru: 11 Bulan (≤ 330 Hari)
**Commit:** `c7c4a0e` — 08:26 WIB
**File:** `src/features/sk-management/SkGeneratorPage.tsx`

**Latar belakang:** Aturan bisnis menentukan bahwa guru dianggap "baru" jika TMT-nya belum melebihi 11 bulan dari tanggal SK. Sebelumnya kondisi menggunakan perbandingan tahun saja (`getFullYear() ===`), yang tidak akurat untuk kasus lintas tahun.

**Perubahan kode:**
```tsx
// SEBELUM (tidak akurat — hanya bandingkan tahun)
const skTahunVal = new Date(tanggalPenetapanPerGuru).getFullYear();
const isNewTeacher = t.jenis_pengajuan === 'new' || 
    (t.jenis_pengajuan !== 'renew' && new Date(t.tmt).getFullYear() === skTahunVal);
const dynamicPengangkatan = isNewTeacher ? "diangkat sebagai" : "diangkat kembali sebagai";

// SESUDAH (akurat — hitung selisih hari)
const tmtDateObj = new Date(t.tmt || teacher?.tmt || new Date());
const diffTime = tglPenetapanPerGuru.getTime() - tmtDateObj.getTime();
const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
const isUnder11Months = diffDays <= 330; // 11 months

const isNewTeacher = t.jenis_pengajuan === 'new' || isUnder11Months;
const isFirstGty = templateId === "sk_template_gty" && periodeValue === 2;

const dynamicPengangkatan = (isNewTeacher || isFirstGty) ? "diangkat sebagai" : "diangkat kembali sebagai";
```

**Dampak:** Placeholder `KATA_PENGANGKATAN` di template DOCX sekarang terisi `"diangkat sebagai"` untuk guru baru, dan `"diangkat kembali sebagai"` untuk guru lama secara konsisten.

---

### 2. Sinkronisasi Logika 11 Bulan ke SkPrintPage
**Commit:** `22f59a3` — 09:22 WIB
**File:** `src/features/sk-management/SkPrintPage.tsx`

**Latar belakang:** `SkGeneratorPage.tsx` dan `SkPrintPage.tsx` memiliki logika `isNewTeacher` sendiri-sendiri. Setelah fix di generator, halaman print masih menggunakan logika lama (year comparison), menyebabkan inkonsistensi antara preview dan cetakan final.

**Perubahan kode:**
```tsx
// SEBELUM (logic lama — year comparison)
const skTahun = parseIndonesianDate(sk.tanggal_penetapan)?.getFullYear() || ...;
const isNewTeacher = sk.jenis_pengajuan === 'new' || 
    (sk.jenis_pengajuan !== 'renew' && sk.teacher?.tmt && 
     new Date(sk.teacher.tmt).getFullYear() === skTahun);

// SESUDAH (sinkron dengan generator — day diff)
const skTglPenetapan = parseIndonesianDate(sk.tanggal_penetapan) || new Date(sk.created_at);
let isNewTeacher = sk.jenis_pengajuan === 'new';
if (sk.jenis_pengajuan !== 'renew' && sk.teacher?.tmt) {
    const tmtDateObj = new Date(sk.teacher.tmt);
    const diffTime = skTglPenetapan.getTime() - tmtDateObj.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    isNewTeacher = isNewTeacher || diffDays <= 330; // 11 months
}
const textPengangkatan = isNewTeacher ? "diangkat" : "diangkat kembali";
```

Juga ditambahkan route baru di `backend/routes/api.php` untuk mendukung endpoint SK print.

---

### 3. Pembatasan Pengajuan SK — Hanya untuk Jenjang RA
**Commit:** `480336f` — 08:38 WIB
**File:** `backend/app/Http/Controllers/Api/SkDocumentController.php`, `src/features/sk-management/SkSubmissionPage.tsx`

**Latar belakang:** Berdasarkan kebijakan LP Ma'arif NU Cilacap, pengajuan SK saat ini hanya dibuka untuk jenjang RA (Raudhatul Athfal). Sebelumnya sistem tidak memvalidasi jenjang sekolah saat pengajuan.

**Backend — Validasi jenjang di `submitRequest()`:**
```php
// Case-insensitive school lookup
$school = School::whereRaw('LOWER(nama) = LOWER(?)', [$data['unit_kerja']])->first();

// Blokir jenjang non-RA
$detectedJenjang = $this->detectJenjang($school, $data['unit_kerja']);
if (in_array($detectedJenjang, ['MI', 'SD', 'MTS', 'SMP', 'MA', 'SMA', 'SMK'])) {
    return response()->json([
        'message' => "Pengajuan SK untuk jenjang {$detectedJenjang} saat ini sudah ditutup. 
                      Pengajuan hanya dibuka untuk jenjang RA.",
    ], 422);
}
```

**Helper method baru `detectJenjang()`:**
```php
private function detectJenjang(?School $school, string $namaUnitKerja): string
{
    if ($school && $school->jenjang) {
        $jenjang = strtoupper($school->jenjang);
        if (!empty($jenjang)) return $jenjang;
    }
    $nama = strtoupper($namaUnitKerja);
    if (preg_match('/\bMI\b|MADRASAH IBTIDAIYAH|IBTIDAIYAH/', $nama)) return 'MI';
    if (preg_match('/\bSD\b|SEKOLAH DASAR/', $nama)) return 'SD';
    if (preg_match('/MTS|MT S|MADRASAH TSANAWIYAH|TSANAWIYAH/', $nama)) return 'MTS';
    if (preg_match('/\bSMP\b|SEKOLAH MENENGAH PERTAMA/', $nama)) return 'SMP';
    if (preg_match('/\bMA\b\s|MADRASAH ALIYAH/', $nama)) return 'MA';
    if (preg_match('/\bSMA\b|SEKOLAH MENENGAH ATAS/', $nama)) return 'SMA';
    if (preg_match('/\bSMK\b|SEKOLAH MENENGAH KEJURUAN/', $nama)) return 'SMK';
    if (preg_match('/\bRA\b|\bR A\b|RAUDHATUL|RAUDATUL|TK\b|PAUD\b|\bBA\b|BUSTHANUL/', $nama)) return 'RA';
    return 'UNKNOWN';
}
```

**Frontend — Banner informasi penutupan di SkSubmissionPage:**
```tsx
<div className="flex items-center gap-4 bg-red-50 border border-red-200 rounded-2xl px-6 py-4">
  <AlertTriangle className="h-5 w-5 text-red-600" />
  <div>
    <p className="text-sm font-black text-red-900 uppercase tracking-wide">Pemberitahuan</p>
    <p className="text-xs text-red-700 mt-0.5">
      Pengajuan SK untuk jenjang MI, MTs, MA, dan SMK saat ini <b>sudah ditutup</b>.
      Pengajuan SK saat ini hanya dibuka untuk jenjang <b>RA (Raudhatul Athfal)</b>.
    </p>
  </div>
</div>
```

---

## 🗄️ DATABASE ADMINISTRATOR (DBA)

### 1. Perbaikan Command CleanDuplicateTeachers — Tambah Pengecekan `unit_kerja`
**Commit:** `c71c7928` — 11:09 WIB
**File:** `backend/app/Console/Commands/CleanDuplicateTeachers.php`

**Masalah:** Command deduplication tidak mengenali guru duplikat yang memiliki `unit_kerja` sama tapi `school_id` berbeda (akibat data korup dari import lama). Akibatnya duplikat dilewati (SKIP) padahal seharusnya digabung.

**Perubahan:**
```php
// Tambah pengecekan unit_kerja sebagai kriteria pencocokan
$sameUnitKerja = !empty($keep->unit_kerja) 
    && !empty($dup->unit_kerja) 
    && strtoupper(trim($keep->unit_kerja)) === strtoupper(trim($dup->unit_kerja));

if (!($sameSchool || $sameSchoolName || $sameUnitKerja || $sameNuptk || $sameNim)) {
    $this->warn("  ⏭️ SKIP ...");
    continue;
}
```

Juga ditambahkan `school_id` ke daftar fields yang dimigrasikan saat merge.

### 2. Perbaikan Merge Fields — Dari 8 Menjadi 24 Field
**Commit:** `8977afb5` — 13:10 WIB
**File:** `backend/app/Console/Commands/CleanDuplicateTeachers.php`

**Masalah:** Saat deduplication, hanya 8 field kritis yang dimigrasikan dari duplikat ke record utama. Field penting seperti `phone_number`, `email`, `pendidikan_terakhir`, `kecamatan`, dll hilang.

**Perubahan — Daftar field lengkap:**
```php
$fields = [
    'school_id', 'nuptk', 'nomor_induk_maarif', 'nip',
    'tempat_lahir', 'tanggal_lahir', 'jenis_kelamin',
    'pendidikan_terakhir', 'mapel', 'unit_kerja',       // ← baru
    'status_kepegawaian', 'status', 'tmt',
    'phone_number', 'email', 'is_certified',             // ← baru
    'provinsi', 'kabupaten', 'kecamatan', 'kelurahan',  // ← baru
    'pdpkpnu', 'kta_number',                            // ← baru
    'photo_id', 'surat_permohonan_url',                 // ← baru
    'nomor_surat_permohonan', 'tanggal_surat_permohonan', // ← baru
];
```

Juga ditambahkan normalisasi nilai "kosong" yang lebih lengkap: `'-'`, `'null'`, `'NULL'`, `'N/A'`, `'_'` sekarang dianggap sebagai kosong saat merge.

**Cara menjalankan:**
```bash
# Dry run dulu untuk preview
php artisan teachers:clean-duplicates --dry-run

# Eksekusi sebenarnya
php artisan teachers:clean-duplicates
```

### 3. Command Baru: `teachers:merge-from-deleted`
**Commit:** `36c8764` — 14:07 WIB
**File:** `backend/app/Console/Commands/MergeFromSoftDeleted.php` (file baru, 143 baris)

**Latar belakang:** Setelah proses deduplication besar-besaran (ratusan guru dihapus/soft-deleted), ditemukan bahwa beberapa field dari record yang ter-soft-delete belum sempat dimigrasikan ke record aktif. Command ini memungkinkan recovery data dari soft-deleted records.

**Signature command:**
```
teachers:merge-from-deleted
    {--date= : Tanggal soft-delete (YYYY-MM-DD, default: hari ini)}
    {--dry-run : Preview tanpa menyimpan}
```

**Algoritma pencocokan:**
1. Ambil semua guru yang di-soft-delete pada tanggal tertentu
2. Untuk setiap guru terhapus, cari padanan aktif berdasarkan nama (bare name sebelum koma)
3. Prioritaskan match berdasarkan: `school_id` sama → `unit_kerja` sama → `nuptk` sama → `nomor_induk_maarif` sama
4. Fallback: jika hanya 1 kandidat aktif, gunakan kandidat tersebut
5. Merge 24 field jika field di record aktif kosong

**Contoh output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ KEEP (aktif): ID=1234 | "SITI AMINAH, S.Pd.I"
📥 FROM (deleted): ID=5678 | "SITI AMINAH"
   📋 Merged: phone_number="08123456789", email="siti@gmail.com", kecamatan="Kroya"

📊 Hasil:
   - Guru ter-soft-delete: 127
   - Berhasil di-merge: 89 guru (213 field)
   - Tidak ada pasangan aktif: 38
```

**Cara menjalankan:**
```bash
# Preview untuk tanggal tertentu
php artisan teachers:merge-from-deleted --date=2026-06-30 --dry-run

# Eksekusi
php artisan teachers:merge-from-deleted --date=2026-06-30
```

---

## 🔧 DEVOPS

### Fix Docker Build Failure — `npm ci` ECONNRESET
**Commit:** `a42d4ad` — 09:38 WIB
**File:** `Dockerfile`

**Masalah:** Build Docker di GitHub Actions gagal secara intermittent dengan error `ECONNRESET` saat `npm ci` mencoba download dependency dari npm registry. Terjadi karena jaringan GitHub Actions tidak stabil untuk request besar.

**Root cause:** Base image `node:20-alpine` tidak memiliki konfigurasi retry npm yang memadai.

**Perubahan:**
```dockerfile
# SEBELUM
FROM node:20-alpine AS build
# ...
RUN npm ci

# SESUDAH
FROM node:20-slim AS build
# ...
# Install dependencies dengan retry untuk mencegah GitHub Actions ECONNRESET
RUN npm config set fetch-retries 5 \
    && npm config set fetch-retry-mintimeout 20000 \
    && npm ci
```

**Penjelasan perubahan:**
- Ganti `node:20-alpine` → `node:20-slim`: image slim berbasis Debian lebih kompatibel dengan network stack di GitHub Actions runner
- `fetch-retries 5`: coba ulang download 5x sebelum gagal
- `fetch-retry-mintimeout 20000`: timeout minimum 20 detik antar retry

---

## 🧪 QA / QUALITY ASSURANCE

### Migrasi Test Payload: Dari MI/MA/SMP ke RA
**Commit:** `22e66ab` (08:47) + `4c70ded` (08:48) WIB
**File:** 6 file test di `backend/tests/`

**Latar belakang:** Setelah pembatasan SK hanya untuk jenjang RA ditambahkan (commit `480336f`), semua test yang menggunakan payload dengan `unit_kerja` jenjang MI/MA/SMP langsung gagal dengan error 422.

**File yang diupdate:**
- `tests/Feature/ActivityLoggingNormalizationTest.php`
- `tests/Feature/NormalizationActivityLogTest.php`
- `tests/Feature/NormalizationIntegrationTest.php`
- `tests/Feature/SkDocumentPreservationTest.php`
- `tests/Feature/SkSubmissionBugExplorationTest.php`
- `tests/Unit/SkDocumentNotificationTest.php`

**Contoh perubahan:**
```php
// SEBELUM (akan ditolak oleh validasi jenjang baru)
'unit_kerja' => 'MI Maarif 01 Kesugihan',
'unit_kerja' => 'MA Maarif NU 01 Cilacap',

// SESUDAH (lolos validasi — RA)
'unit_kerja' => 'RA Maarif NU Cilacap',
'unit_kerja' => 'Raudhatul Athfal Al-Ikhlas',
```

**Hasil akhir:** Semua test suite kembali hijau setelah migrasi payload. Total 6 file test, ~50 payload test case diupdate.

**Cara menjalankan test:**
```bash
cd backend
php artisan test
php artisan test --filter SkDocumentNotificationTest
php artisan test --filter NormalizationIntegrationTest
```

---

## 📋 PROJECT MANAGER (PM)

### Progress Hari Ini

| Waktu | Aktivitas | Status |
|-------|-----------|--------|
| 08:26 | Fix logika guru baru 11 bulan di SK Generator | ✅ Done |
| 08:38 | Blokir pengajuan SK non-RA + banner notifikasi | ✅ Done |
| 08:47–08:48 | Migrasi 6 file test payload ke jenjang RA | ✅ Done |
| 09:22 | Sinkronisasi logika 11 bulan ke halaman print SK | ✅ Done |
| 09:26 | Tambah TESTING.md dan GitHub Issue/PR templates | ✅ Done |
| 09:38 | Fix Docker build ECONNRESET | ✅ Done |
| 11:09 | Fix CleanDuplicateTeachers + pengecekan unit_kerja | ✅ Done |
| 13:10 | Expand merge fields dari 8 → 24 field | ✅ Done |
| 14:07 | Command baru: teachers:merge-from-deleted | ✅ Done |
| 14:42 | Hapus temp files yang tidak sengaja di-commit | ✅ Done |

### Isu yang Diselesaikan
1. **Bug kritis:** Teks SK untuk guru baru/lama tidak konsisten antara preview dan cetakan
2. **Bug kritis:** Data hilang saat deduplication (field tidak ikut dimigrasikan)
3. **Kebijakan bisnis:** Sistem tidak memblokir pengajuan SK dari jenjang non-RA
4. **DevOps:** Build pipeline gagal intermittent di GitHub Actions

### Pekerjaan Tertunda / Carry Over
- Template DOCX SK (`sk-gtt-template.docx`, `sk-gty-template.docx`, `sk-tendik-template.docx`) diupdate bersamaan dengan perbaikan placeholder `KATA_PENGANGKATAN` — perlu validasi ulang oleh operator untuk memastikan format sesuai standar LP Ma'arif NU

---

## 📌 PRODUCT OWNER (PO)

### Fitur / Kebijakan yang Diimplementasikan Hari Ini

#### 1. Pembatasan Pengajuan SK — Hanya Jenjang RA
Berdasarkan kebijakan LP Ma'arif NU Cilacap, pengajuan SK semester ini hanya dibuka untuk jenjang Raudhatul Athfal (RA). Sistem sekarang:
- Menolak pengajuan dari operator jenjang MI, MTs, MA, SMA, SMK dengan pesan error yang jelas
- Menampilkan banner peringatan merah di halaman pengajuan SK
- Deteksi jenjang bersumber dari field `jenjang` sekolah, atau fallback ke pengenalan pola nama sekolah

#### 2. Perbaikan Teks SK "Diangkat" vs "Diangkat Kembali"
Aturan bisnis yang sudah ada (guru baru = TMT < 11 bulan dari tanggal SK) kini diimplementasikan dengan benar menggunakan perhitungan selisih hari, bukan perbandingan tahun. Berlaku konsisten di:
- Halaman Generate SK (preview DOCX)
- Halaman Print SK (cetakan final)

#### 3. Perbaikan Data Master Guru
Command-command deduplication dan merge ditingkatkan untuk menjaga integritas data lebih baik, termasuk recovery data dari record yang ter-soft-delete.

### Files Berubah Hari Ini (Ringkasan)

| File | Jenis | Deskripsi |
|------|-------|-----------|
| `src/features/sk-management/SkGeneratorPage.tsx` | Frontend | Fix logika isNewTeacher (11 bulan) |
| `src/features/sk-management/SkPrintPage.tsx` | Frontend | Sinkronisasi logika 11 bulan |
| `src/features/sk-management/SkSubmissionPage.tsx` | Frontend | Tambah banner penutupan SK non-RA |
| `backend/app/Http/Controllers/Api/SkDocumentController.php` | Backend | Blokir jenjang non-RA + helper detectJenjang() |
| `backend/app/Console/Commands/CleanDuplicateTeachers.php` | Backend | Fix matching unit_kerja + expand 24 merge fields |
| `backend/app/Console/Commands/MergeFromSoftDeleted.php` | Backend | **File baru** — command merge dari soft-deleted |
| `Dockerfile` | DevOps | Fix npm ECONNRESET di Docker build |
| `TESTING.md` | Dokumentasi | **File baru** — panduan testing |
| `.github/ISSUE_TEMPLATE/bug_report.md` | Dokumentasi | **File baru** — template laporan bug |
| `.github/PULL_REQUEST_TEMPLATE.md` | Dokumentasi | **File baru** — template PR |
| `backend/tests/Feature/*.php` (6 file) | Testing | Migrasi payload MI/MA → RA |
| `public/templates/*.docx` (3 file) | Template | Update placeholder KATA_PENGANGKATAN |

---

*Laporan dibuat otomatis dari git log 2026-07-01 · Proyek SIMMACI*
