# SK Generator Bugs — Bugfix Design

## Overview

Dokumen ini mendeskripsikan desain teknis untuk memperbaiki 4 bug pada fitur SK Generator yang berdampak pada dokumen SK yang sudah dicetak dan diterima guru:

1. **QR Code 404** — Double `encodeURIComponent` pada nomor SK yang mengandung `/`
2. **Nama tidak bold** — Placeholder `{NAMA}` di template DOCX tidak memiliki formatting `<w:b/>`
3. **Template SK salah** — Kondisi `teacherStatus.includes("guru")` terlalu broad, menangkap GTY ke branch GTT; tidak ada TMT fallback; tidak ada logika Tendik berbasis pendidikan
4. **Nomor tembusan tidak reset** — Counter penomoran tembusan tidak di-reset saat iterasi multi-dokumen
5. **PNS lolos ke antrian SK** — Pengajuan SK dari PTK berstatus PNS/ASN tidak ditolak otomatis, padahal SK PNS tidak diterbitkan lewat yayasan

Semua bug berada di frontend (React/TypeScript), kecuali bug #2 yang ada di file template DOCX, dan bug #5 yang ada di backend (Laravel).

---

## Glossary

- **Bug_Condition (C)**: Kondisi yang memicu bug — input atau state yang menyebabkan perilaku salah
- **Property (P)**: Perilaku yang diharapkan ketika bug condition terpenuhi setelah fix diterapkan
- **Preservation**: Perilaku yang tidak boleh berubah akibat fix
- **`getSkVerificationUrl()`**: Fungsi di `src/utils/verification.ts` yang menghasilkan URL verifikasi QR code dengan satu kali `encodeURIComponent`
- **`verificationApi.verifyBySk()`**: Method di `src/lib/api.ts` yang melakukan GET request ke `/verify/sk/{nomor}` — saat ini memanggil `encodeURIComponent` lagi, menyebabkan double-encoding
- **`selectTemplate()`**: Logika pemilihan template di `SkGeneratorPage.tsx` dalam fungsi `handleGenerate`, baris `let templateId = ...`
- **`tembusanCounter`**: Variabel counter/index yang digunakan untuk penomoran daftar tembusan di template DOCX — saat ini tidak di-reset per iterasi dokumen
- **GTY**: Guru Tetap Yayasan — template SK untuk guru dengan status tetap, termasuk Kepala Madrasah (Kamad)
- **GTT**: Guru Tidak Tetap — template SK untuk guru dengan status tidak tetap
- **Kamad**: Kepala Madrasah — guru yang diberi tugas tambahan sebagai kepala; SK pengangkatan Kamad dilakukan lewat SK satuan, bukan SK massal. Dalam konteks SK massal, Kamad tetap mendapat template GTY karena statusnya sebagai Guru Tetap Yayasan
- **Tendik**: Tenaga Kependidikan — template SK default untuk tenaga kependidikan

---

## Bug Details

### Bug 1: QR Code 404 — Double `encodeURIComponent`

Nomor SK mengandung karakter `/` (contoh: `0001/PC.L/A.II/H-34.B/24.29/07/2026`). Karakter ini di-encode di `getSkVerificationUrl()` menjadi `%2F`, menghasilkan URL yang valid. Namun `verificationApi.verifyBySk()` memanggil `encodeURIComponent` sekali lagi pada nilai yang sudah ter-encode, mengubah `%2F` menjadi `%252F`. React Router tidak dapat me-resolve path dengan `%252F`, sehingga halaman 404.

**Formal Specification:**
```
FUNCTION isBugCondition_C1(input)
  INPUT: input of type { nomorSk: string }
  OUTPUT: boolean

  encodedOnce  ← encodeURIComponent(input.nomorSk)
  encodedTwice ← encodeURIComponent(encodedOnce)

  RETURN input.nomorSk CONTAINS '/'
         AND verificationApi.verifyBySk CALLS encodeURIComponent(input.nomorSk)
         AND encodedTwice CONTAINS '%252F'
END FUNCTION
```

**Contoh:**
- Input: `nomorSk = "0001/PC.L/A.II/H-34.B/24.29/07/2026"`
- `getSkVerificationUrl()` menghasilkan: `.../verify/sk/0001%2FPC.L%2FA.II%2FH-34.B%2F24.29%2F07%2F2026` ✓
- `verifyBySk()` memanggil `encodeURIComponent("0001%2FPC.L%2F...")` → `.../verify/sk/0001%252FPC.L%252F...` ✗ (404)
- Nomor SK tanpa `/` (contoh: `SK-001-2026`): tidak terdampak

### Bug 2: Nama Tidak Bold — Template DOCX Tanpa `<w:b/>`

Placeholder `{NAMA}` di template DOCX tidak memiliki formatting bold pada run XML-nya. Docxtemplater hanya mengisi nilai teks ke dalam run yang sudah ada — ia tidak menambahkan atau mengubah formatting. Jika run XML tidak memiliki `<w:b/>` dalam `<w:rPr>`, teks yang dirender tidak akan bold.

**Formal Specification:**
```
FUNCTION isBugCondition_C2(template)
  INPUT: template of type DocxTemplate
  OUTPUT: boolean

  namaRunXml ← extractRunXmlForPlaceholder(template, '{NAMA}')

  RETURN NOT (namaRunXml CONTAINS '<w:b/>'
              OR namaRunXml CONTAINS '<w:b w:val="true"/>')
END FUNCTION
```

**Contoh:**
- Run XML saat ini (buggy): `<w:r><w:t>{NAMA}</w:t></w:r>` → nama dirender tanpa bold
- Run XML yang benar: `<w:r><w:rPr><w:b/></w:rPr><w:t>{NAMA}</w:t></w:r>` → nama dirender bold

### Bug 3: Template SK Salah — Kondisi GTT Terlalu Broad

Kondisi pemilihan template GTT menggunakan `teacherStatus.includes("guru")` yang menangkap semua status yang mengandung kata "guru", termasuk "Guru Tetap Yayasan". Karena kondisi GTY diperiksa lebih dulu secara benar, tetapi kondisi GTT di-`else if` berikutnya masih mengandung `teacherStatus.includes("guru")` sebagai fallback, guru dengan status "Guru Tetap Yayasan" yang tidak cocok dengan kondisi GTY (karena variasi penulisan) akan jatuh ke branch GTT.

**Formal Specification:**
```
FUNCTION isBugCondition_C3(input)
  INPUT: input of type { teacherStatus: string, jenissk: string }
  OUTPUT: boolean

  status ← input.teacherStatus.toLowerCase()
  jenis  ← input.jenissk.toLowerCase()

  isGty ← status CONTAINS 'gty' OR status CONTAINS 'tetap yayasan'
           OR jenis CONTAINS 'gty' OR jenis CONTAINS 'tetap yayasan'

  isGttBroad ← status CONTAINS 'gtt' OR status CONTAINS 'tidak tetap'
               OR jenis CONTAINS 'gtt' OR jenis CONTAINS 'tidak tetap'
               OR status CONTAINS 'guru'   // ← kondisi terlalu broad

  RETURN NOT isGty AND isGttBroad AND status CONTAINS 'guru'
         AND (status CONTAINS 'tetap' OR jenis CONTAINS 'tetap')
         AND NOT (status CONTAINS 'tidak' OR jenis CONTAINS 'tidak')
END FUNCTION
```

**Contoh:**
- `teacherStatus = "Guru Tetap Yayasan"` → seharusnya GTY, tapi masuk GTT karena `"guru tetap yayasan".includes("guru")` = true
- `teacherStatus = "Guru Tidak Tetap"` → benar masuk GTT
- `teacherStatus = "GTY"` → benar masuk GTY (tidak terdampak)
- `teacherStatus = "GTT"` → benar masuk GTT (tidak terdampak)
- `teacherStatus = "kamad"` → seharusnya GTY (Kamad adalah GTY), tapi masuk GTT karena `"kamad"` tidak cocok GTY dan kondisi `teacherStatus.includes("guru")` tidak terpenuhi — namun branch Kamad tidak pernah tercapai karena kondisi GTT sudah menangkap sebelumnya

### Bug 4: Nomor Tembusan Tidak Reset — Counter Tidak Di-reset Per Dokumen

Pada generate multi-dokumen, variabel counter untuk penomoran tembusan di template DOCX tidak di-reset saat iterasi ke dokumen berikutnya. Dokumen pertama menampilkan nomor 1–6 dengan benar, dokumen kedua melanjutkan dari 7–12.

**Formal Specification:**
```
FUNCTION isBugCondition_C4(input)
  INPUT: input of type { documentIndex: number, tembusanStartNumber: number }
  OUTPUT: boolean

  RETURN input.documentIndex > 0
         AND input.tembusanStartNumber > 1
END FUNCTION
```

**Contoh:**
- Batch 3 guru: dokumen ke-0 → tembusan 1–6 ✓, dokumen ke-1 → tembusan 7–12 ✗ (seharusnya 1–6), dokumen ke-2 → tembusan 13–18 ✗ (seharusnya 1–6)
- Batch 1 guru: dokumen ke-0 → tembusan 1–6 ✓ (tidak terdampak)

### Bug 5: PNS Lolos ke Antrian SK — Tidak Ada Penolakan Otomatis

PTK berstatus PNS/ASN tidak seharusnya mengajukan SK lewat yayasan — SK PNS diterbitkan oleh instansi pemerintah, bukan LP Ma'arif. Saat ini tidak ada validasi yang menolak pengajuan PNS, sehingga data PNS masuk ke antrian generator dan bisa diterbitkan SK-nya secara keliru.

**Deteksi PNS:**
- `status_kepegawaian` atau `status` mengandung "pns" atau "asn" (case-insensitive)
- `nip` memiliki panjang 18 digit (format NIP PNS baku Indonesia)

**Formal Specification:**
```
FUNCTION isPns(doc)
  INPUT: doc of type SkSubmissionDocument
  OUTPUT: boolean

  status ← LOWER(doc.status_kepegawaian ?? doc.status ?? "")
  nip    ← STRIP_NON_DIGITS(doc.nip ?? "")

  RETURN status CONTAINS 'pns' OR status CONTAINS 'asn'
         OR LENGTH(nip) = 18
END FUNCTION
```

**Lokasi fix (backend):**
- `processBulkRequestSync()` di `SkDocumentController.php` — batch kecil (≤3 dokumen)
- `ProcessBulkSkSubmission::handle()` di `app/Jobs/ProcessBulkSkSubmission.php` — batch besar (>3 dokumen)
- `submitRequest()` di `SkDocumentController.php` — pengajuan individual

**Contoh:**
- `status = "PNS"`, `nip = "198501012010011001"` (18 digit) → ditolak otomatis, status `rejected`, alasan: "PTK berstatus PNS tidak dapat mengajukan SK melalui yayasan"
- `status = "GTY"`, `nip = "123456789"` (9 digit) → lolos, diproses normal
- `status = ""`, `nip = "198501012010011001123"` (21 digit, bukan 18) → lolos, diproses normal

---

## Expected Behavior

### Preservation Requirements

**Perilaku yang tidak boleh berubah:**
- Guru dengan `status_kepegawaian` atau `jenis_sk` yang secara eksplisit menunjukkan "GTT" atau "Guru Tidak Tetap" harus tetap mendapat template GTT
- Guru dengan status Tendik harus tetap mendapat template Tendik sebagai default
- Nomor SK tanpa karakter `/` harus tetap menghasilkan URL QR yang valid dan dapat di-scan
- Halaman `/verify/sk/:nomor` harus tetap berfungsi untuk SK valid dan kadaluarsa
- Semua placeholder lain di template DOCX (jabatan, unit kerja, TMT, nomor SK, dll.) harus tetap ter-render benar tanpa perubahan formatting
- Generate single-dokumen harus tetap menampilkan nomor tembusan dimulai dari 1
- Jumlah dan isi daftar tembusan per dokumen tidak boleh berubah

**Perubahan yang disengaja (bukan regresi):**
- Guru dengan status Kamad/Kepala Madrasah sekarang mendapat template GTY (bukan `sk_template_kamad`). Ini adalah perubahan yang benar secara bisnis: SK massal untuk Kamad menggunakan template GTY karena Kamad adalah Guru Tetap Yayasan. SK pengangkatan Kamad sebagai jabatan dilakukan lewat SK satuan terpisah.

**Scope:**
Semua input yang tidak memenuhi bug condition (C1–C4) harus sepenuhnya tidak terpengaruh oleh fix ini.

---

## Hypothesized Root Cause

### Bug 1: Double `encodeURIComponent`

1. **Encoding di dua lapisan berbeda**: `getSkVerificationUrl()` di `src/utils/verification.ts` (baris 7) memanggil `encodeURIComponent(nomorSk)` untuk membangun URL QR. Kemudian `verificationApi.verifyBySk()` di `src/lib/api.ts` (baris 333) memanggil `encodeURIComponent(nomor)` lagi sebelum menyusun path API. Nilai yang diterima `verifyBySk` adalah `nomor` dari `useParams()` di `VerifySkPage.tsx` — React Router sudah men-decode `%2F` menjadi `/` saat parsing params, sehingga `nomor` berisi slash literal. Tapi `verifyBySk` memanggil `encodeURIComponent` lagi, menghasilkan `%252F`.

2. **Ketidakkonsistenan antara QR generation dan API call**: QR code di-generate dengan URL yang sudah ter-encode sekali. Saat user scan, browser membuka URL tersebut, React Router men-decode params, lalu `verifyBySk` meng-encode ulang — siklus ini menghasilkan double-encoding.

### Bug 2: Nama Tidak Bold

1. **Formatting ada di template, bukan di data**: Docxtemplater bekerja dengan mengganti teks placeholder di dalam run XML yang sudah ada. Jika run XML untuk `{NAMA}` tidak memiliki `<w:b/>` dalam `<w:rPr>`, teks hasil render tidak akan bold — tidak peduli nilai datanya.

2. **Template dibuat tanpa formatting bold**: Saat template DOCX dibuat/diedit, placeholder `{NAMA}` ditulis sebagai teks biasa tanpa formatting bold diterapkan pada karakter tersebut.

### Bug 3: Template SK Salah

1. **Kondisi GTT mengandung `teacherStatus.includes("guru")`**: Di `SkGeneratorPage.tsx` dalam `handleGenerate`, kondisi `else if` untuk GTT adalah:
   ```typescript
   } else if (teacherStatus.includes("gtt") || teacherStatus.includes("tidak tetap") || 
              jenis.includes("gtt") || jenis.includes("tidak tetap") || 
              jenis.includes("tidak tetap") || teacherStatus.includes("guru")) {
   ```
   Kondisi terakhir `teacherStatus.includes("guru")` menangkap semua status yang mengandung kata "guru", termasuk "Guru Tetap Yayasan".

2. **Urutan evaluasi**: Kondisi GTY diperiksa lebih dulu dan benar untuk kasus eksplisit ("gty", "tetap yayasan"). Namun jika status ditulis sebagai "Guru Tetap Yayasan" (bukan "GTY"), kondisi GTY tidak cocok karena tidak mengandung "gty" atau "tetap yayasan" secara substring — lalu jatuh ke GTT karena mengandung "guru".

   > **Catatan**: Setelah membaca kode aktual, kondisi GTY sudah mencakup `teacherStatus.includes("tetap yayasan")`. Namun jika status ditulis "Guru Tetap Yayasan", `"guru tetap yayasan".includes("tetap yayasan")` = true, sehingga seharusnya masuk GTY. Bug yang lebih mungkin terjadi adalah ketika status ditulis dengan variasi lain (contoh: "Guru Tetap", "Tetap Yayasan") yang tidak cocok dengan kondisi GTY tapi cocok dengan `teacherStatus.includes("guru")` di GTT. Fix yang tepat adalah menghapus `teacherStatus.includes("guru")` dari kondisi GTT.

### Bug 4: Nomor Tembusan Tidak Reset

1. **Counter di luar scope iterasi**: Variabel counter untuk penomoran tembusan kemungkinan dideklarasikan di luar loop `for (let i = 0; i < selectedTeachers.length; i++)`, sehingga nilainya terakumulasi antar iterasi. Setiap dokumen baru seharusnya memulai counter dari 1, tapi counter tidak di-reset.

2. **Template DOCX menggunakan loop dengan index**: Template DOCX menggunakan fitur loop docxtemplater (`{#tembusan}...{/tembusan}`) dengan index yang di-generate dari JavaScript. Jika array tembusan yang dikirim ke `renderData` mengandung nomor yang dilanjutkan dari dokumen sebelumnya, output akan salah.

---

## Correctness Properties

Property 1: Bug Condition C1 — QR URL Tidak Double-Encoded

_For any_ nomor SK yang mengandung karakter `/`, URL yang digunakan untuk request verifikasi ke backend SHALL hanya ter-encode satu kali — `%2F` bukan `%252F` — sehingga React Router dapat me-resolve path dan backend dapat menemukan SK.

**Validates: Requirements 2.1, 2.2**

Property 2: Bug Condition C3 — Template Dipilih dengan Benar (Status Eksplisit + TMT Fallback + Tendik berbasis Pendidikan)

_For any_ input, template dipilih berdasarkan prioritas:
1. Status eksplisit GTY/Kamad → `sk_template_gty`
2. Status eksplisit GTT → `sk_template_gtt`
3. Status kosong + TMT ≥ 2 tahun → `sk_template_gty`
4. Status kosong + TMT < 2 tahun atau kosong → `sk_template_gtt`
5. Status tidak dikenal + pendidikan < S1 (SMA/MA, D3, dll.) → `sk_template_tendik`
6. Status tidak dikenal + pendidikan ≥ S1 → `sk_template_gtt` (default aman)

**Validates: Requirements 2.4, 2.5**

Property 3: Bug Condition C4 — Nomor Tembusan Reset Per Dokumen

_For any_ batch generate multi-dokumen dengan N guru (N > 1), setiap dokumen ke-i (i ≥ 0) SHALL memiliki nomor tembusan yang dimulai dari 1, independen dari dokumen sebelumnya.

**Validates: Requirements 2.6**

Property 4: Preservation — Template GTT Tetap Benar

_For any_ input di mana `teacherStatus` atau `jenis_sk` secara eksplisit menunjukkan GTT ("gtt", "tidak tetap") dan TIDAK mengandung indikator GTY atau Kamad, fungsi pemilihan template SHALL tetap mengembalikan `sk_template_gtt` — sama seperti sebelum fix.

**Validates: Requirements 3.1**

Property 5: Preservation — Template Tendik untuk Pendidikan di Bawah S1

_For any_ input di mana status tidak cocok GTY/GTT/Kamad dan `pendidikan_terakhir` adalah di bawah S1 (SMA/MA, D3, dll.), fungsi pemilihan template SHALL mengembalikan `sk_template_tendik`.

**Validates: Requirements 3.3**

Property 6: Preservation — QR URL untuk Nomor SK Tanpa `/` Tidak Berubah

_For any_ nomor SK yang tidak mengandung karakter `/`, URL verifikasi yang dihasilkan SHALL tetap valid dan identik dengan perilaku sebelum fix.

**Validates: Requirements 3.4, 3.5, 3.6**

---

## Fix Implementation

### Bug 1: Hapus `encodeURIComponent` dari `verificationApi.verifyBySk()`

**File:** `src/lib/api.ts`

**Perubahan:**
```typescript
// Before (buggy)
verifyBySk: (nomor: string) => apiClient.get(`/verify/sk/${encodeURIComponent(nomor)}`),

// After (fixed)
verifyBySk: (nomor: string) => apiClient.get(`/verify/sk/${nomor}`),
```

**Alasan:** `nomor` yang diterima dari `useParams()` di `VerifySkPage` sudah berupa string yang di-decode oleh React Router. Axios tidak melakukan encoding tambahan pada path segment. Satu-satunya encoding yang diperlukan sudah dilakukan oleh `getSkVerificationUrl()` saat QR code di-generate.

**Catatan penting:** Pastikan backend route `GET /api/verify/sk/{nomor}` menggunakan `where` constraint yang mengizinkan karakter `/` dalam parameter, atau gunakan route dengan wildcard. Jika backend menggunakan Laravel route model binding dengan `{nomor}` biasa, karakter `/` dalam URL path akan menyebabkan 404 di sisi backend — ini perlu diverifikasi.

### Bug 2: Tambahkan `<w:b/>` pada Run XML Placeholder `{NAMA}` di Template DOCX

**File:** Semua file template DOCX (GTY, GTT, Kamad, Tendik) yang disimpan di storage backend

**Perubahan:** Buka setiap template DOCX dengan editor (Word/LibreOffice), pilih teks `{NAMA}`, terapkan formatting **Bold**, lalu simpan. Atau edit XML secara langsung:

```xml
<!-- Before (buggy) -->
<w:r>
  <w:t>{NAMA}</w:t>
</w:r>

<!-- After (fixed) -->
<w:r>
  <w:rPr>
    <w:b/>
    <w:bCs/>
  </w:rPr>
  <w:t>{NAMA}</w:t>
</w:r>
```

**Catatan:** `<w:bCs/>` diperlukan untuk font complex script (termasuk karakter Indonesia). Pastikan semua template yang digunakan (GTY, GTT, Kamad, Tendik) diperbaiki.

### Bug 3: Refactor Logika Pemilihan Template — GTT Terlalu Broad, Kamad → GTY, TMT Fallback, Tendik berbasis Pendidikan

**File:** `src/features/sk-management/SkGeneratorPage.tsx`

**Perubahan:**
```typescript
// Before (buggy)
const teacherStatus = (teacher.status || "").toLowerCase();
const jenis = (t.jenis_sk || "").toLowerCase()

if (teacherStatus.includes("gty") || teacherStatus.includes("tetap yayasan") || 
    jenis.includes("gty") || jenis.includes("tetap yayasan")) {
    templateId = "sk_template_gty"
} else if (teacherStatus.includes("gtt") || teacherStatus.includes("tidak tetap") || 
           jenis.includes("gtt") || jenis.includes("tidak tetap") || 
           jenis.includes("tidak tetap") || teacherStatus.includes("guru")) {  // ← BUG: terlalu broad
    templateId = "sk_template_gtt"
} else if (teacherStatus.includes("kamad") || teacherStatus.includes("kepala") || 
           jenis.includes("kamad") || jenis.includes("kepala")) {
    templateId = "sk_template_kamad"  // ← tidak pernah tercapai + salah secara bisnis
}

// After (fixed)
// Sumber status: sk_document.status_kepegawaian lebih spesifik dari teacher.status
const statusRaw = (t.status_kepegawaian || teacher.status || "").toLowerCase()
const jenis = (t.jenis_sk || "").toLowerCase()
const pendidikan = (t.pendidikan_terakhir || teacher.pendidikan_terakhir || "").toLowerCase()

const isGty   = statusRaw.includes("gty") || statusRaw.includes("tetap yayasan") ||
                jenis.includes("gty")     || jenis.includes("tetap yayasan")
const isKamad = statusRaw.includes("kamad") || statusRaw.includes("kepala") ||
                jenis.includes("kamad")     || jenis.includes("kepala")
const isGtt   = statusRaw.includes("gtt") || statusRaw.includes("tidak tetap") ||
                jenis.includes("gtt")     || jenis.includes("tidak tetap")
const isEmpty = statusRaw === "" && jenis === ""

// Pendidikan di bawah S1: SMA/MA, D1, D2, D3 — bukan S1/S2/S3/D4
const PENDIDIKAN_TINGGI = ["s1", "s2", "s3", "d4", "s1/d4", "strata"]
const isBelowS1 = pendidikan !== "" && !PENDIDIKAN_TINGGI.some(p => pendidikan.includes(p))

if (isGty || isKamad) {
    templateId = "sk_template_gty"
} else if (isGtt) {
    templateId = "sk_template_gtt"
} else if (isEmpty) {
    // Fallback: gunakan TMT untuk menentukan GTY vs GTT
    // TMT >= 2 tahun → GTY, TMT < 2 tahun atau kosong → GTT (default aman)
    const periodeForTemplate = tmtRaw ? calculatePeriode(tmtRaw, tglPenetapanVal) : 0
    templateId = periodeForTemplate >= 2 ? "sk_template_gty" : "sk_template_gtt"
} else if (isBelowS1) {
    // Status tidak dikenal + pendidikan di bawah S1 → Tendik
    templateId = "sk_template_tendik"
} else {
    // Status tidak dikenal + pendidikan S1 ke atas → GTT (default aman, bisa direvisi)
    templateId = "sk_template_gtt"
}
```

**Prioritas pemilihan template (urutan evaluasi):**
1. Status eksplisit GTY / Kamad → `sk_template_gty`
2. Status eksplisit GTT → `sk_template_gtt`
3. Status kosong + TMT ≥ 2 tahun → `sk_template_gty`
4. Status kosong + TMT < 2 tahun atau TMT kosong → `sk_template_gtt` (default aman)
5. Status tidak dikenal + pendidikan < S1 (SMA/MA, D3, dll.) → `sk_template_tendik`
6. Status tidak dikenal + pendidikan ≥ S1 → `sk_template_gtt` (default aman, bisa direvisi)

**Catatan implementasi:** `calculatePeriode(tmtRaw, tglPenetapanVal)` sudah tersedia di scope yang sama. Pastikan penentuan template dilakukan setelah `tmtRaw` divalidasi, atau gunakan guard `tmtRaw ? calculatePeriode(...) : 0`.

**Alasan perubahan:**
1. `t.status_kepegawaian` ditambahkan sebagai sumber status prioritas pertama
2. `teacherStatus.includes("guru")` dihapus dari kondisi GTT — terlalu broad
3. Kondisi Kamad dipindahkan ke branch GTY — Kamad adalah GTY; SK jabatan Kamad lewat SK satuan
4. Branch `sk_template_kamad` dihapus dari logika pemilihan template massal
5. **TMT fallback**: status kosong → gunakan `calculatePeriode` (≥2 tahun = GTY, <2 tahun = GTT)
6. **Tendik berbasis pendidikan**: hanya untuk PTK dengan pendidikan di bawah S1 yang statusnya tidak dikenal

### Bug 4: Reset Counter Tembusan di Setiap Iterasi Dokumen

**File:** `src/features/sk-management/SkGeneratorPage.tsx`

**Perubahan:** Identifikasi variabel counter tembusan yang dideklarasikan di luar loop `handleGenerate`, lalu pindahkan deklarasinya ke dalam loop (atau reset nilainya di awal setiap iterasi):

```typescript
// Pola yang perlu dicari dan diperbaiki:
// Before (buggy) — counter di luar loop
let tembusanCounter = 1  // atau let tembusanIndex = 0
for (let i = 0; i < selectedTeachers.length; i++) {
    // ... tembusanCounter digunakan tapi tidak di-reset
}

// After (fixed) — counter di-reset di awal setiap iterasi
for (let i = 0; i < selectedTeachers.length; i++) {
    let tembusanCounter = 1  // deklarasi di dalam loop, atau:
    // tembusanCounter = 1   // reset eksplisit di awal iterasi
    // ...
}
```

**Catatan:** Berdasarkan analisis kode `SkGeneratorPage.tsx`, tembusan kemungkinan di-render melalui data yang dikirim ke `renderData` sebagai array. Jika demikian, pastikan array tembusan di-generate ulang (bukan di-append) untuk setiap dokumen.

### Bug 5: Tambahkan Penolakan Otomatis PNS di Backend

**Files:**
- `backend/app/Http/Controllers/Api/SkDocumentController.php` — method `submitRequest()` dan `processBulkRequestSync()`
- `backend/app/Jobs/ProcessBulkSkSubmission.php` — method `handle()`

**Helper function (tambahkan sebagai private method atau helper):**
```php
private function isPns(array $doc): bool
{
    $status = strtolower($doc['status_kepegawaian'] ?? $doc['status'] ?? '');
    $nip    = preg_replace('/\D/', '', $doc['nip'] ?? '');

    return str_contains($status, 'pns')
        || str_contains($status, 'asn')
        || strlen($nip) === 18;
}
```

**Perubahan di `submitRequest()`:**
```php
// Tambahkan setelah validasi, sebelum upsert teacher
if ($this->isPns($data)) {
    // Buat SK document dengan status rejected langsung
    $nomorSk = SkDocument::generateNomorSk();
    $sk = SkDocument::create([
        'nomor_sk'             => $nomorSk,
        'nama'                 => $data['nama'],
        'jenis_sk'             => $data['jenis_sk'] ?? 'PNS',
        'unit_kerja'           => $data['unit_kerja'],
        'school_id'            => $schoolId,
        'surat_permohonan_url' => $data['surat_permohonan_url'],
        'status'               => 'rejected',
        'rejection_reason'     => 'PTK berstatus PNS tidak dapat mengajukan SK melalui yayasan.',
        'created_by'           => $request->user()->email,
        'tanggal_penetapan'    => now()->format('Y-m-d'),
    ]);
    return response()->json([
        'message' => 'Pengajuan ditolak: PTK berstatus PNS tidak dapat mengajukan SK melalui yayasan.',
        'sk' => $sk,
    ], 422);
}
```

**Perubahan di `processBulkRequestSync()` dan `ProcessBulkSkSubmission::handle()`:**
```php
// Tambahkan di awal loop foreach, sebelum upsert teacher
if ($this->isPns($doc)) {
    // Catat sebagai rejected, lanjut ke dokumen berikutnya
    $seq++;
    $nomorSk = 'REQ/' . $year . '/' . str_pad($seq, 4, '0', STR_PAD_LEFT);
    SkDocument::create([
        'nomor_sk'         => $nomorSk,
        'nama'             => $doc['nama'],
        'jenis_sk'         => $doc['status_kepegawaian'] ?? $doc['status'] ?? 'PNS',
        'unit_kerja'       => $doc['unit_kerja'] ?? null,
        'school_id'        => $schoolId,
        'status'           => 'rejected',
        'rejection_reason' => 'PTK berstatus PNS tidak dapat mengajukan SK melalui yayasan.',
        'created_by'       => $this->userEmail, // atau $request->user()->email
        'tanggal_penetapan'=> now()->format('Y-m-d'),
    ]);
    $skipped++;
    continue;
}
```

**Alasan:** SK PNS diterbitkan oleh instansi pemerintah, bukan LP Ma'arif. Pengajuan PNS yang lolos ke antrian generator berpotensi menerbitkan SK yang tidak sah. Penolakan di level pengajuan memastikan data PNS tidak pernah masuk ke antrian generator.

---

## Testing Strategy

### Validation Approach

Strategi testing mengikuti dua fase: pertama, tulis test yang membuktikan bug ada pada kode yang belum diperbaiki (exploratory); kedua, verifikasi fix bekerja benar dan tidak merusak perilaku yang sudah ada (fix checking + preservation checking).

### Exploratory Bug Condition Checking

**Goal:** Surface counterexample yang membuktikan bug ada SEBELUM fix diterapkan. Konfirmasi atau refutasi analisis root cause.

**Test Plan:** Tulis unit test untuk setiap bug condition, jalankan pada kode yang BELUM diperbaiki, dokumentasikan kegagalan.

**Test Cases:**

1. **C1 — Double Encoding Test** (akan gagal pada kode unfixed):
   - Input: `nomorSk = "0001/PC.L/A.II/H-34.B/24.29/07/2026"`
   - Simulasikan alur: `getSkVerificationUrl(nomorSk)` → ambil path → simulasikan `useParams()` decode → panggil `verifyBySk(nomor)`
   - Assert: URL request ke backend TIDAK mengandung `%252F`
   - Expected failure: URL mengandung `%252F`

2. **C3 — Template Selection GTY Test** (akan gagal pada kode unfixed):
   - Input: `teacherStatus = "Guru Tetap Yayasan"`, `jenis = ""`
   - Panggil logika pemilihan template
   - Assert: `templateId === "sk_template_gty"`
   - Expected failure: `templateId === "sk_template_gtt"`

3. **C3 — Template Selection Boundary Test** (akan gagal pada kode unfixed):
   - Input: `teacherStatus = "guru tetap"`, `jenis = ""`
   - Assert: `templateId !== "sk_template_gtt"` (seharusnya tendik sebagai default)
   - Expected failure: `templateId === "sk_template_gtt"`

4. **C4 — Tembusan Counter Reset Test** (akan gagal pada kode unfixed):
   - Simulasikan generate 2 dokumen berurutan
   - Assert: dokumen ke-2 memiliki `tembusanStartNumber === 1`
   - Expected failure: `tembusanStartNumber > 1`

**Expected Counterexamples:**
- `verifyBySk("0001/PC.L/...")` menghasilkan request ke `/verify/sk/0001%252FPC.L%252F...`
- `selectTemplate({ teacherStatus: "Guru Tetap Yayasan" })` mengembalikan `"sk_template_gtt"`
- Dokumen ke-2 dalam batch memiliki nomor tembusan dimulai dari 7 (bukan 1)

### Fix Checking

**Goal:** Verifikasi bahwa untuk semua input di mana bug condition terpenuhi, fungsi yang sudah diperbaiki menghasilkan perilaku yang benar.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result ← processSkGenerate_fixed(input)
  ASSERT (
    C1: NOT result.verifyApiUrl CONTAINS '%252F'
    C3: input.isGtyStatus IMPLIES result.templateId = 'sk_template_gty'
    C4: result.tembusanStartNumber = 1 FOR ALL documentIndex
  )
END FOR
```

### Preservation Checking

**Goal:** Verifikasi bahwa untuk semua input di mana bug condition TIDAK terpenuhi, fungsi yang sudah diperbaiki menghasilkan hasil yang sama dengan fungsi asli.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT processSkGenerate_original(input) = processSkGenerate_fixed(input)
END FOR
```

**Testing Approach:** Property-based testing direkomendasikan untuk preservation checking karena:
- Menghasilkan banyak test case secara otomatis di seluruh domain input
- Menangkap edge case yang mungkin terlewat oleh unit test manual
- Memberikan jaminan kuat bahwa perilaku tidak berubah untuk semua input non-buggy

**Test Cases:**
1. **GTT Preservation**: Verifikasi `teacherStatus = "Guru Tidak Tetap"` tetap menghasilkan `sk_template_gtt` setelah fix
2. **GTT via jenis_sk Preservation**: Verifikasi `jenis = "gtt"` tetap menghasilkan `sk_template_gtt`
3. **Kamad Preservation**: Verifikasi `teacherStatus = "kamad"` tetap menghasilkan `sk_template_kamad`
4. **Tendik Default Preservation**: Verifikasi status yang tidak cocok dengan GTY/GTT/Kamad tetap menghasilkan `sk_template_tendik`
5. **QR URL tanpa `/` Preservation**: Verifikasi nomor SK tanpa `/` menghasilkan URL yang identik sebelum dan sesudah fix
6. **Single-dokumen Tembusan Preservation**: Verifikasi generate 1 dokumen tetap menghasilkan tembusan dimulai dari 1

### Unit Tests

- Test `verificationApi.verifyBySk()` dengan nomor SK yang mengandung `/` — verifikasi URL request tidak mengandung `%252F`
- Test logika pemilihan template untuk semua kombinasi status: GTY eksplisit, GTT eksplisit, "Guru Tetap Yayasan", "Guru Tidak Tetap", Kamad, Tendik, status kosong
- Test counter tembusan untuk batch 1, 2, dan 3 dokumen — verifikasi setiap dokumen dimulai dari 1
- Test edge case: `teacherStatus = ""` dan `jenis_sk = ""` → default ke Tendik
- Test edge case: `teacherStatus = "guru"` tanpa qualifier → tidak boleh masuk GTT

### Property-Based Tests

- Generate random string nomor SK yang mengandung `/` → verifikasi `verifyBySk` tidak double-encode
- Generate random kombinasi `teacherStatus` dan `jenis_sk` yang mengandung "gty"/"tetap yayasan" → verifikasi selalu menghasilkan GTY
- Generate random batch size N (1–10) → verifikasi setiap dokumen memiliki `tembusanStartNumber = 1`
- Generate random `teacherStatus` yang mengandung "gtt"/"tidak tetap" tapi tidak mengandung "gty" → verifikasi tetap menghasilkan GTT

### Integration Tests

- End-to-end: generate SK untuk guru GTY, scan QR code, verifikasi halaman verifikasi terbuka tanpa 404
- End-to-end: generate SK batch 3 guru, buka setiap DOCX, verifikasi nomor tembusan masing-masing dimulai dari 1
- End-to-end: generate SK untuk guru dengan `status_kepegawaian = "Guru Tetap Yayasan"`, verifikasi template yang digunakan adalah GTY
- Visual: buka DOCX hasil generate, verifikasi nama guru tercetak bold
