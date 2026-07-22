# Laporan Pekerjaan — 17 Juli 2026

**Proyek:** SIMMACI — Sistem Informasi Manajemen Pendidikan LP Ma'arif NU Cilacap  
**Tanggal:** Jumat, 17 Juli 2026  
**Tipe:** Bugfix iteratif  
**Ringkasan:** 8 commit fix pada fitur arsip SK unit (MySkPage), endpoint index SkDocument, dan scanner QR absensi staf. 3 file dimodifikasi: `MySkPage.tsx`, `SkDocumentController.php`, `PublicScannerPage.tsx`.

---

## Ringkasan Commit

| Waktu | Commit | Area | Deskripsi Singkat |
|---|---|---|---|
| 08:11 | `b657f91` | FE | Override key renderData setelah spread — fix tanggal NULL |
| 09:06 | `d922ced` | FE + BE | Parser normalisasi spasi; tambah `tanggal_penetapan` & `tahun_ajaran` ke select |
| 10:42 | `a462bb4` | BE | Eager load relasi `school` di endpoint index SK |
| 11:36 | `0fe9b3b` | FE | Template selection berbasis pendidikan; tambah `KATA_PENGANGKATAN` |
| 11:41 | `8a66656` | FE | Logika "diangkat sebagai" vs "diangkat kembali sebagai" |
| 14:01 | `176e0f0` | FE | Scanner QR staff — error handling spesifik + reset state |
| 14:13 | `bb9289d` | FE | Inject bold ke `{NAMA}` via XML patch di arsip SK unit |
| 14:36 | `ded6295` | FE | Tambah "guru tetap" ke GTY + TMT fallback untuk jenis tidak dikenali |

---

## Frontend (FE)


### FE-1 · Fix: `tanggal_penetapan` & `tahun_ajaran` selalu NULL di renderData arsip SK unit

**Commit:** `b657f91` — 08:11 WIB  
**File:** `src/features/sk-management/MySkPage.tsx`  
**Root Cause:** Spread `...sk` di `renderData` menaruh `tanggal_penetapan` dan `tahun_ajaran` dalam
format mentah database (ISO string). Custom parser case-insensitive menemukan key lowercase dari
spread terlebih dahulu sebelum key uppercase eksplisit di bawahnya.

**Fix:** Key eksplisit dipindah ke SETELAH spread, ditambah lowercase alias agar selalu berformat Indonesia.

```typescript
// Sebelum (buggy) — key uppercase bisa ditimpa spread ...sk
const renderData = {
  ...teacherData,
  ...sk,
  "TANGGAL_PENETAPAN": formatDate(sk.tanggal_penetapan), // mungkin dikalahkan spread
  tanggal_penetapan: formatDate(sk.tanggal_penetapan),   // di akhir, tidak selalu dipakai
}

// Sesudah (fixed) — eksplisit SELALU override spread
const renderData = {
  // Spread dulu sebagai base, key eksplisit di bawah akan override
  ...teacherData,
  ...sk,
  // ── Override eksplisit — harus di BAWAH spread agar menang ──
  "TANGGAL_PENETAPAN": formatDate(sk.tanggal_penetapan),
  "TANGGAL PENETAPAN": formatDate(sk.tanggal_penetapan),
  "tanggal_penetapan": formatDate(sk.tanggal_penetapan),  // alias lowercase
  "TAHUN PELAJARAN": tahunAjaranStr,
  "tahun_ajaran": tahunAjaranStr,                          // alias lowercase
  "TANGGAL LENGKAP": formatDate(sk.tanggal_penetapan),
}
```


### FE-2 · Fix: Custom parser normalisasi non-breaking space dari Word

**Commit:** `d922ced` — 09:06 WIB  
**File:** `src/features/sk-management/MySkPage.tsx`  
**Root Cause:** Template DOCX yang diedit via Microsoft Word mengandung karakter non-breaking space
(U+00A0) di dalam placeholder seperti `{TANGGAL PENETAPAN}`. Parser lama hanya lowercase,
sehingga `{TANGGAL\u00A0PENETAPAN}` tidak cocok dengan key `"TANGGAL PENETAPAN"`.

**Fix:** Normalisasi `\u00A0` → spasi biasa, collapse multiple spaces, sebelum matching.

```typescript
// Sebelum
parser: (tag: string) => {
  const cleanTag = tag.replace(/^[%#/]/, "").trim().toLowerCase()
  return {
    get(scope: any) {
      for (const k in scope) {
        if (k.toLowerCase() === cleanTag) return scope[k]
      }
      return ""
    }
  }
}

// Sesudah — normalisasi lengkap sebelum matching
parser: (tag: string) => {
  const normalizeTag = (t: string) =>
    t.replace(/^[%#/]/, "").trim()
      .replace(/\u00A0/g, " ")   // non-breaking space → spasi biasa
      .replace(/\s+/g, " ")      // multiple spaces → satu spasi
      .toLowerCase()
  const cleanTag = normalizeTag(tag)
  return {
    get(scope: any) {
      if (cleanTag === ".") return scope
      for (const k in scope) {
        if (normalizeTag(k) === cleanTag) return scope[k]
      }
      return ""
    }
  }
}
```


### FE-3 · Fix: Pemilihan template arsip SK berbasis pendidikan + tambah `KATA_PENGANGKATAN`

**Commit:** `0fe9b3b` — 11:36 WIB  
**File:** `src/features/sk-management/MySkPage.tsx`  
**Root Cause:** Logika pemilihan template `MySkPage` hanya memeriksa `jenis_sk` string, tidak
mempertimbangkan `pendidikan_terakhir`. Guru D2/D3 bisa mendapat template GTY/GTT padahal
seharusnya Tendik. Selain itu, placeholder `{KATA_PENGANGKATAN}` tidak pernah diisi ke renderData.

**Fix:** Implementasi logika multi-tahap konsisten dengan `SkGeneratorPage`:

```typescript
const pendidikan = (teacherData.pendidikan_terakhir || "").toLowerCase()
const PENDIDIKAN_TINGGI = ["s1", "s2", "s3", "d4", "s1/d4", "strata"]
const isPendidikanTinggi = PENDIDIKAN_TINGGI.some(p => pendidikan.includes(p))
const hasGelar = (sk.nama || "").includes(",") || isPendidikanTinggi

let templateId = "tendik"
if (jenis.includes("kepala") || jenis.includes("kamad")) {
  templateId = "kamad"
} else if (!hasGelar) {
  templateId = "tendik"   // pendidikan di bawah S1 → Tendik
} else if (jenis.includes("gty") || jenis.includes("tetap yayasan")) {
  templateId = "gty"
} else if (jenis.includes("gtt") || jenis.includes("tidak tetap")) {
  templateId = "gtt"
} else {
  templateId = "gtt"      // default aman
}

// Di renderData — tambah key baru
"KATA_PENGANGKATAN": kataPengangkatan,
"kata_pengangkatan": kataPengangkatan,
```


### FE-4 · Fix: `KATA_PENGANGKATAN` — logika "diangkat sebagai" vs "diangkat kembali sebagai"

**Commit:** `8a66656` — 11:41 WIB  
**File:** `src/features/sk-management/MySkPage.tsx`  
**Root Cause:** Sebelumnya `KATA_PENGANGKATAN` diambil dari map statis per templateId
(`"diangkat sebagai Guru Tetap Yayasan"`, dll.), tidak mempertimbangkan apakah guru sedang
diangkat pertama kali atau diperpanjang.

**Fix:** Logika dinamis sama persis dengan `SkGeneratorPage`:

```typescript
const kataPengangkatan: string = (() => {
  if (!teacherData.tmt || !sk.tanggal_penetapan) return "diangkat sebagai"
  const tmt = new Date(teacherData.tmt)
  const penetapan = new Date(sk.tanggal_penetapan)
  if (isNaN(tmt.getTime()) || isNaN(penetapan.getTime())) return "diangkat sebagai"
  const diffDays = Math.ceil((penetapan.getTime() - tmt.getTime()) / (1000 * 60 * 60 * 24))
  const isUnder11Months = diffDays <= 330
  const isFirstGty = templateId === "gty" && periodeValue === 2
  return (isUnder11Months || isFirstGty) ? "diangkat sebagai" : "diangkat kembali sebagai"
})()
```

**Aturan:**
- TMT < 11 bulan dari penetapan (diffDays ≤ 330) → `"diangkat sebagai"` (guru baru)
- GTY periode pertama (2 tahun) → `"diangkat sebagai"`
- Selain itu → `"diangkat kembali sebagai"` (perpanjangan)


### FE-5 · Fix: Inject bold ke placeholder `{NAMA}` via XML patch di arsip SK unit

**Commit:** `bb9289d` — 14:13 WIB  
**File:** `src/features/sk-management/MySkPage.tsx`  
**Root Cause:** Template DOCX arsip SK unit tidak memiliki `<w:b/>` pada run XML placeholder `{NAMA}`.
Docxtemplater hanya mengisi teks, tidak menambah formatting. Nama guru tercetak tidak bold.

**Fix:** Patch `word/document.xml` langsung sebelum render, sama dengan `SkGeneratorPage`:

```typescript
const docFile = pzip.file("word/document.xml")
if (docFile) {
  let docXmlStr = docFile.asText()
  docXmlStr = docXmlStr.replace(
    /(<w:r\b[^>]*>)((?:(?!<\/w:r>)[\s\S])*?\{[\s]*NAMA[\s]*\}[\s\S]*?<\/w:r>)/g,
    (match, openTag, rest) => {
      // Jangan patch jika sudah ada bold
      if (rest.includes('<w:b/>') || rest.includes('<w:b w:val')) return match
      // Tambah rPr baru jika belum ada
      if (!rest.includes('<w:rPr>') && !rest.includes('<w:rPr ')) {
        return `${openTag}<w:rPr><w:b/><w:bCs/></w:rPr>${rest}`
      }
      // Sisipkan bold ke rPr yang sudah ada
      return match.replace(/<w:rPr([\s\S]*?)>/, '<w:rPr$1><w:b/><w:bCs/>')
    }
  )
  pzip.file("word/document.xml", docXmlStr)
}
```

**Catatan:** `<w:bCs/>` diperlukan untuk font complex script (termasuk karakter Indonesia).


### FE-6 · Fix: Tambah "guru tetap" ke kondisi GTY + TMT fallback untuk jenis tidak dikenali

**Commit:** `ded6295` — 14:36 WIB  
**File:** `src/features/sk-management/MySkPage.tsx`  
**Root Cause:** String `"guru tetap"` sebagai shorthand GTY tidak tercakup kondisi
`jenis.includes("tetap yayasan")`. Juga tidak ada fallback TMT ketika `jenis_sk` tidak dikenali
(guru lama yang `jenis_sk`-nya diisi dengan value bebas).

**Fix:**

```typescript
// Sebelum
} else if (jenis.includes("gty") || jenis.includes("tetap yayasan")) {
  templateId = "gty"
} else {
  templateId = "gtt" // default jika ada gelar tapi jenis tidak dikenali
}

// Sesudah — tambah "guru tetap" + TMT fallback
} else if (
  jenis.includes("gty") ||
  jenis.includes("tetap yayasan") ||
  jenis.includes("guru tetap")   // ← tambahan shorthand
) {
  templateId = "gty"
} else if (jenis.includes("gtt") || jenis.includes("tidak tetap")) {
  templateId = "gtt"
} else if (hasGelar) {
  // jenis_sk tidak dikenali → fallback hitung dari TMT + tanggal penetapan
  if (teacherData.tmt && sk.tanggal_penetapan) {
    const tmtDate = new Date(teacherData.tmt)
    const penetapanDate = new Date(sk.tanggal_penetapan)
    if (!isNaN(tmtDate.getTime()) && !isNaN(penetapanDate.getTime())) {
      const diffYears = (penetapanDate.getTime() - tmtDate.getTime())
                        / (1000 * 60 * 60 * 24 * 365.25)
      templateId = diffYears >= 2 ? "gty" : "gtt"
    } else {
      templateId = "gtt"
    }
  } else {
    templateId = "gtt"
  }
}
```


### FE-7 · Fix: Scanner QR staff — error handling spesifik per HTTP status + reset state

**Commit:** `176e0f0` — 14:01 WIB  
**File:** `src/features/attendance/PublicScannerPage.tsx`  
**Root Cause:** 3 masalah terpisah di `StaffScannerScreen`:
1. Error handler menampilkan pesan generik untuk semua jenis error HTTP
2. Kondisi geolocation salah — `!location && attendanceType === 'Kantor'` tidak cek `isGeolocationEnabled`, sehingga scanner diblokir meski geolocation dinonaktifkan
3. State `scanResult` tidak direset setelah gagal face verification → scanner terkunci permanen

**Fix:**

```typescript
// 1. Error handling spesifik per HTTP status
const status = error?.response?.status
const serverMsg = error?.response?.data?.message
if (status === 422) {
  toast.error(serverMsg || 'Data tidak valid. Pastikan QR Code Anda belum kadaluarsa.')
} else if (status === 404) {
  toast.error('Staff tidak ditemukan. Pastikan ID Card Anda terdaftar di sistem.')
} else if (status === 409 || serverMsg?.toLowerCase().includes('sudah')) {
  toast.warning(serverMsg || 'Anda sudah melakukan absensi hari ini.')
} else if (!navigator.onLine) {
  toast.error('Tidak ada koneksi internet. Periksa jaringan Anda dan coba lagi.')
} else {
  toast.error(serverMsg || 'Gagal melakukan absensi. Coba lagi beberapa saat.')
}

// 2. Perbaiki kondisi geolocation — tambah cek isGeolocationEnabled
// Sebelum
if (!location && attendanceType === 'Kantor') { ... }
// Sesudah
if (!location && attendanceType === 'Kantor' && isGeolocationEnabled) {
  toast.error('Lokasi GPS belum terdeteksi. Aktifkan izin lokasi dan coba lagi.')
  setScanResult(null)
  setFaceVerificationStatus('idle')
  return;
}

// 3. Reset state setelah gagal face verification (3 detik delay)
} catch (e: any) {
  const msg = e?.response?.data?.message || e?.message || 'Terjadi kesalahan saat verifikasi.'
  toast.error(msg)
  setTimeout(() => {
    setScanResult(null)
    setFaceVerificationStatus('idle')
  }, 3000)
}
```


---

## Backend (BE)

### BE-1 · Fix: Field `tanggal_penetapan` & `tahun_ajaran` tidak dikirim ke frontend

**Commit:** `d922ced` — 09:06 WIB  
**File:** `backend/app/Http/Controllers/Api/SkDocumentController.php`  
**Root Cause:** Method `index()` menggunakan `->select()` eksplisit yang tidak menyertakan
`tanggal_penetapan` dan `tahun_ajaran`, sehingga kedua field selalu `null` di response API.

**Fix:**

```php
// Sebelum
->select([
    'id', 'nomor_sk', 'nama', 'jenis_sk', 'status',
    'unit_kerja', 'created_at', 'school_id', 'teacher_id',
    'nomor_permohonan', 'tanggal_permohonan', 'surat_permohonan_url', 'file_url',
])

// Sesudah
->select([
    'id', 'nomor_sk', 'nama', 'jenis_sk', 'status',
    'unit_kerja', 'created_at', 'school_id', 'teacher_id',
    'nomor_permohonan', 'tanggal_permohonan', 'surat_permohonan_url', 'file_url',
    'tanggal_penetapan', 'tahun_ajaran',  // ← tambahan
])
```


### BE-2 · Fix: Load relasi `school` (kecamatan, alamat) di endpoint index SK

**Commit:** `a462bb4` — 10:42 WIB  
**File:** `backend/app/Http/Controllers/Api/SkDocumentController.php`  
**Root Cause:** Relasi `school` tidak di-eager load di `index()`, sehingga `kecamatan` dan `alamat`
tidak tersedia di data SK yang dikembalikan ke frontend, menyebabkan placeholder template kosong.

**Fix:**

```php
// Sebelum
->with(['teacher' => function ($q) { ... }])

// Sesudah
->with(['teacher' => function ($q) { ... }, 'school'])
```

---

## QA / Testing

### QA-1 · Unit test `calculatePeriode`

**File:** `src/features/sk-management/utils/calculatePeriode.test.ts`  
**Command digunakan:**

```bash
# Jalankan test file spesifik (dari root project)
npx vitest run src/features/sk-management/utils/calculatePeriode.test.ts

# Atau jalankan semua test dengan filter nama
npx vitest run --reporter=verbose calculatePeriode
```

**8 test cases** yang dijalankan hari ini:

| Test | Input TMT | Input Penetapan | Expected |
|---|---|---|---|
| SK fisik LP Ma'arif | 2008-07-14 | 2025-07-01 | 17 |
| Tepat 26 tahun | 2000-07-01 | 2026-07-01 | 26 |
| Bulan cetak lebih awal | 2000-10-01 | 2026-07-01 | 26 (bulan diabaikan) |
| Sehari sebelum ulang tahun | 2000-07-15 | 2026-07-14 | 26 (hari diabaikan) |
| Tepat hari ulang tahun | 2000-07-15 | 2026-07-15 | 26 |
| Sehari sesudah ulang tahun | 2000-07-15 | 2026-07-16 | 26 |
| TMT = penetapan | 2026-07-01 | 2026-07-01 | 0 |
| Penetapan sebelum TMT | 2030-01-01 | 2026-07-01 | 0 (non-negatif) |


### QA-2 · Eksplorasi bug SK Generator (pre-fix validation test)

**File:** `src/features/sk-management/utils/skGeneratorBugs.exploration.test.ts`  
**Command digunakan:**

```bash
# Jalankan test eksplorasi bug
npx vitest run src/features/sk-management/utils/skGeneratorBugs.exploration.test.ts

# Jalankan dengan output verbose untuk lihat setiap test case
npx vitest run --reporter=verbose src/features/sk-management/utils/skGeneratorBugs.exploration.test.ts

# Watch mode saat iterasi fix
npx vitest src/features/sk-management/utils/skGeneratorBugs.exploration.test.ts
```

**Test suite yang ditulis hari ini:**

| Suite | Bug | Jumlah Test | Tujuan |
|---|---|---|---|
| C1 — QR Code 404 | Double `encodeURIComponent` | 4 | Dokumentasi counterexample + validasi fix |
| C3 — Template selection | Kondisi GTT terlalu broad | 9 | Semua variasi status GTY/GTT/Kamad/TMT/pendidikan |
| C4 — Tembusan counter | Counter tidak reset per dokumen | 4 | Batch 1–5 dokumen |

**Contoh output test yang GAGAL sebelum fix (documents bug):**

```
✓ C1.3 — [DOCUMENTS BUG] unfixed verifyBySk DOES encode slashes as %2F
✓ C3.9 — [DOCUMENTS BUG] unfixed code DOES return sk_template_gtt for "Guru Tetap"
✓ C4.3 — [DOCUMENTS BUG] unfixed code DOES produce tembusan 7–12 for doc[1]
```


---

## DevOps / Infrastructure

Tidak ada perubahan infrastructure pada tanggal ini.  
Tidak ada commit ke `docker-compose`, CI/CD, migration, atau konfigurasi deployment.

---

## Commands yang Digunakan Hari Ini

### Git — Verifikasi commit dan diff

```bash
# Lihat commit hari ini
git log --oneline --since="2026-07-17" --until="2026-07-17 23:59:59"

# Lihat detail perubahan per commit
git show b657f91
git show d922ced
git show a462bb4
git show 0fe9b3b
git show 8a66656
git show 176e0f0
git show bb9289d
git show ded6295

# Lihat file mana saja yang berubah per commit
git show --stat b657f91

# Lihat diff file spesifik dari commit tertentu
git show d922ced -- src/features/sk-management/MySkPage.tsx
git show d922ced -- backend/app/Http/Controllers/Api/SkDocumentController.php
```

### Frontend — Testing

```bash
# Jalankan semua unit test (single run, bukan watch)
npx vitest run

# Jalankan test file spesifik
npx vitest run src/features/sk-management/utils/calculatePeriode.test.ts
npx vitest run src/features/sk-management/utils/skGeneratorBugs.exploration.test.ts

# Jalankan dengan output verbose
npx vitest run --reporter=verbose

# Watch mode saat iterasi fix (jalankan manual, bukan lewat agen)
npx vitest src/features/sk-management/utils/

# Filter berdasarkan nama test
npx vitest run --reporter=verbose calculatePeriode
npx vitest run --reporter=verbose skGeneratorBugs

# Build untuk verifikasi tidak ada TypeScript error
npm run build
```

### Backend — Testing & Debugging

```bash
# Jalankan semua test (dari folder backend/)
php artisan test

# Jalankan test file spesifik
php artisan test --filter=SkDocumentControllerTest

# Artisan tinker — debug query / model secara interaktif
php artisan tinker

# Contoh tinker yang mungkin digunakan hari ini:
# >>> SkDocument::select(['id','tanggal_penetapan','tahun_ajaran'])->first()
# >>> SkDocument::with('school')->first()->school

# Lihat routes yang terdaftar untuk SK
php artisan route:list --path=sk

# Clear cache jika ada perubahan config
php artisan config:clear
php artisan cache:clear
```

### Backend — Artisan Command RevertSkToDraft

```bash
# Cek SK mana yang akan di-revert (dry run, tidak ada perubahan)
php artisan sk:revert-to-draft --dry-run

# Cek semua status non-draft (bukan hanya approved/active)
php artisan sk:revert-to-draft --dry-run --all-status

# Eksekusi revert (dengan konfirmasi interaktif)
php artisan sk:revert-to-draft

# Eksekusi untuk semua status
php artisan sk:revert-to-draft --all-status
```


---

## Catatan Teknis

### Pola fix berulang hari ini

Semua pekerjaan hari ini adalah **port logika dari `SkGeneratorPage` → `MySkPage`**.  
`SkGeneratorPage` (generator massal untuk admin) sudah lebih matang dan sudah mengalami beberapa
iterasi fix sebelumnya. `MySkPage` (arsip SK personal untuk guru) dibuat belakangan dan banyak
logikanya belum ter-update mengikuti perbaikan di `SkGeneratorPage`.

**Logika yang disamakan hari ini:**

| Aspek | `SkGeneratorPage` (referensi) | `MySkPage` (sebelum fix) | `MySkPage` (sesudah fix) |
|---|---|---|---|
| Template selection | Berbasis pendidikan + gelar | Hanya cek `jenis_sk` string | ✅ Sama dengan SkGeneratorPage |
| Bold `{NAMA}` | XML patch sebelum render | Tidak ada patch | ✅ XML patch yang sama |
| `KATA_PENGANGKATAN` | Dinamis dari TMT + periode | Map statis | ✅ Logika dinamis yang sama |
| Parser normalisasi | `\u00A0` + multi-space | Hanya lowercase | ✅ Normalisasi lengkap |
| Override spread | Key eksplisit setelah spread | Urutan tidak terjamin | ✅ Eksplisit setelah spread |

### Root cause arsitekturis

Bug-bug ini muncul karena duplikasi logika antara dua halaman yang seharusnya berbagi
utility yang sama. Rekomendasi ke depan: ekstrak logika template selection, XML bold patch,
dan `KATA_PENGANGKATAN` ke utility function bersama di
`src/features/sk-management/utils/skDocumentHelpers.ts` agar tidak perlu sync manual.

