# Bugfix Requirements Document

## Introduction

Spec ini mendokumentasikan verifikasi workflow **SK Generator** pada aplikasi SIMMACI. Tujuannya adalah memastikan seluruh alur generate dokumen SK (Surat Keputusan) berjalan dengan benar — mulai dari loading template, render data ke DOCX, generate QR code, format nomor SK, hingga bulk generate untuk banyak guru sekaligus.

Workflow yang diuji: `SkGeneratorPage.tsx` → `useSkTemplate` hook → `docxtemplater` rendering → QR code embedding → ZIP download → backend status update.

Area yang diverifikasi secara ketat:
1. **Template loading** — fetch template aktif dari backend atau fallback ke file lokal
2. **Render data ke DOCX** — placeholder terisi dengan benar
3. **QR Code generation** — QR code ter-embed dan URL verifikasi valid
4. **Format nomor SK** — placeholder `{NOMOR}`, `{PERIODE}`, `{TAHUN}`, dll. di-resolve dengan benar
5. **Bulk generate** — generate untuk banyak guru menghasilkan ZIP yang valid
6. **Halaman verifikasi SK** — ketika QR code di-scan, muncul halaman publik yang menampilkan status validitas SK

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN template aktif tersedia di backend THEN sistem mengunduh template dari URL yang diberikan API, namun KETIKA fetch gagal (network error atau 5xx) sistem menampilkan error tanpa fallback ke template lokal

1.2 WHEN data guru memiliki field `tmt` yang kosong atau null THEN sistem melewati guru tersebut (`continue`) tanpa memberikan notifikasi yang jelas kepada pengguna bahwa guru tersebut dilewati

1.3 WHEN placeholder dalam template DOCX menggunakan spasi atau casing berbeda (misal `{ NAMA }` atau `{nama}`) THEN sistem menggunakan custom parser case-insensitive, namun field yang tidak ditemukan dikembalikan sebagai string kosong `""` tanpa peringatan

1.4 WHEN format nomor SK mengandung placeholder `{PERIODE}` untuk template `sk_template_kamad` THEN sistem mengganti `{PERIODE}` dengan string kosong `""` yang dapat menghasilkan nomor SK dengan format tidak konsisten (misal `0001/PC.L/A.II/H-34.B/24.29//07/2026`)

1.5 WHEN generate bulk dilakukan untuk banyak guru dengan tipe SK berbeda (GTY, GTT, Kamad, Tendik) THEN sistem mengelompokkan per template, namun KETIKA mode "gabung dalam 1 file" aktif dan ada lebih dari satu kelompok, sistem menghasilkan ZIP berisi beberapa file DOCX kolektif — bukan satu file tunggal

1.6 WHEN QR code di-generate dengan URL verifikasi THEN URL menggunakan `window.location.origin` yang pada environment production mungkin berbeda dari URL publik yang seharusnya digunakan untuk verifikasi

1.7 WHEN pengguna men-scan QR code pada dokumen SK yang telah dicetak THEN tidak ada halaman verifikasi khusus untuk SK yang menampilkan detail dokumen (nama guru, nomor SK, jabatan, unit kerja, tanggal berlaku, status valid/invalid) — route `/verify/sk/:id` saat ini menggunakan `PublicVerificationPage` generik yang memanggil `verificationApi.verifyByCode(id)` namun backend tidak memiliki endpoint publik untuk verifikasi SK berdasarkan nomor SK

1.8 WHEN backend menerima request ke `/api/verify/sk/{nomor}` THEN endpoint tersebut tidak ada — tidak ada controller, route, maupun logic untuk memverifikasi SK secara publik tanpa autentikasi

1.9 WHEN endpoint verifikasi SK publik mengembalikan data SK THEN sistem tidak memperhitungkan masa berlaku SK — SK yang sudah melewati 1 tahun sejak `tanggal_penetapan` tetap dikembalikan sebagai valid, padahal seharusnya dinyatakan kadaluarsa

### Expected Behavior (Correct)

2.1 WHEN fetch template dari backend gagal dengan error 5xx atau network error THEN sistem SHALL menampilkan pesan error yang jelas DAN tetap mencoba fallback ke template lokal di `/public/templates/sk-{type}-template.docx`

2.2 WHEN data guru memiliki field `tmt` yang kosong atau null THEN sistem SHALL menampilkan toast warning yang menyebutkan nama guru yang dilewati, bukan hanya `console.error`

2.3 WHEN placeholder dalam template tidak ditemukan di data guru THEN sistem SHALL mengisi dengan nilai default yang bermakna (misal `"-"`) dan mencatat field mana yang tidak ditemukan di console untuk debugging

2.4 WHEN format nomor SK mengandung `{PERIODE}` untuk template kamad THEN sistem SHALL menghapus placeholder `{PERIODE}` beserta karakter separator di sekitarnya sehingga nomor SK tetap memiliki format yang valid dan konsisten

2.5 WHEN generate bulk dilakukan dalam mode "gabung dalam 1 file" dan semua guru memiliki tipe SK yang sama THEN sistem SHALL menghasilkan satu file DOCX kolektif yang dapat langsung diunduh tanpa ZIP

2.6 WHEN QR code di-generate THEN sistem SHALL menggunakan URL verifikasi yang berasal dari environment variable `VITE_APP_URL` (atau fallback ke `window.location.origin`) sehingga URL konsisten dan dapat dikonfigurasi per environment

2.7 WHEN pengguna men-scan QR code pada dokumen SK yang telah dicetak THEN sistem SHALL menampilkan halaman verifikasi publik di route `/verify/sk/:nomor` yang menampilkan: nama guru, nomor SK, jabatan, unit kerja, tanggal penetapan, status valid/invalid, dan nama/logo sekolah — tanpa memerlukan autentikasi

2.8 WHEN backend menerima request GET ke `/api/verify/sk/{nomor}` THEN sistem SHALL mengembalikan data SK yang relevan (nama, nomor_sk, jabatan, unit_kerja, tanggal_penetapan, tanggal_kadaluarsa, status, school.nama) jika SK ditemukan, berstatus `approved` atau `active`, **dan belum melewati 1 tahun sejak `tanggal_penetapan`**, tanpa memerlukan token autentikasi

2.9 WHEN SK ditemukan dan berstatus `approved` tetapi sudah melewati 1 tahun sejak `tanggal_penetapan` THEN sistem SHALL mengembalikan response dengan `is_expired: true` dan pesan yang menjelaskan SK telah kadaluarsa, bukan 404 — agar pengguna tahu SK pernah valid namun sudah tidak berlaku

### Unchanged Behavior (Regression Prevention)

3.1 WHEN template aktif tersedia di backend dan fetch berhasil THEN sistem SHALL CONTINUE TO menggunakan template dari backend (bukan fallback lokal)

3.2 WHEN data guru memiliki semua field lengkap (nama, tmt, unit_kerja, dll.) THEN sistem SHALL CONTINUE TO me-render semua placeholder dengan data yang benar

3.3 WHEN generate dilakukan untuk satu guru THEN sistem SHALL CONTINUE TO menghasilkan satu file DOCX yang dapat diunduh

3.4 WHEN status SK berhasil di-generate THEN sistem SHALL CONTINUE TO mengupdate status SK ke `approved` dan status guru ke `is_verified: true` di backend

3.5 WHEN nomor SK di-generate dengan format default `{NOMOR}/PC.L/A.II/H-34.B/24.29/{PERIODE}/{BULAN}/{TAHUN}` untuk guru GTY/GTT THEN sistem SHALL CONTINUE TO menghasilkan nomor SK yang valid dengan semua placeholder ter-resolve

3.6 WHEN template tidak tersedia di backend (HTTP 404) THEN sistem SHALL CONTINUE TO menggunakan fallback template lokal tanpa menampilkan error kepada pengguna

3.7 WHEN pengguna mengakses route `/verify/teacher/:nuptk` atau `/verify/student/:nisn` THEN sistem SHALL CONTINUE TO menampilkan halaman verifikasi guru/siswa yang sudah ada tanpa perubahan

3.8 WHEN SK berstatus `pending` atau `rejected` dan nomor SK-nya diakses via endpoint verifikasi publik THEN sistem SHALL CONTINUE TO mengembalikan response yang menandakan SK tidak valid (bukan data SK aktif)

3.9 WHEN SK berstatus `approved` dan masih dalam masa berlaku 1 tahun THEN sistem SHALL CONTINUE TO mengembalikan response 200 dengan `is_expired: false` dan data SK lengkap

---

## Bug Condition Derivation

### Bug Condition Function

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type SkGenerateInput | SkVerificationRequest
  OUTPUT: boolean
  
  // Bug terjadi pada kondisi-kondisi berikut:
  RETURN (
    // C1: Template fetch gagal dengan 5xx/network error
    (X.templateFetchStatus IN [500, 502, 503, 'network_error']) OR
    
    // C2: Data guru dengan TMT kosong
    (X.teacher.tmt IS NULL OR X.teacher.tmt = '') OR
    
    // C3: Format nomor SK dengan {PERIODE} untuk template kamad
    (X.templateId = 'sk_template_kamad' AND X.nomorFormat CONTAINS '{PERIODE}') OR
    
    // C4: Bulk generate mode gabung dengan tipe SK berbeda
    (X.combineInOneFile = true AND X.teacherGroups.count > 1) OR
    
    // C5: QR code URL menggunakan window.location.origin (tidak dikonfigurasi)
    (X.verificationUrlSource = 'window.location.origin') OR
    
    // C6: Request verifikasi SK publik ke endpoint yang tidak ada
    (X.type = 'verification_request' AND X.path MATCHES '/api/verify/sk/{nomor}') OR
    
    // C7: SK approved tapi sudah kadaluarsa (> 1 tahun dari tanggal_penetapan)
    (X.type = 'verification_request' AND X.skStatus = 'approved' AND X.tanggalPenetapan.addYear() < NOW())
  )
END FUNCTION
```

### Property: Fix Checking

```pascal
// Property: Fix Checking - SK Generator Error Handling & QR Verification
FOR ALL X WHERE isBugCondition(X) DO
  result ← generateSk'(X) OR verifySkPublic'(X)
  ASSERT (
    // C1: Fallback ke template lokal, tidak crash
    (X.templateFetchStatus IN [500, 'network_error'] IMPLIES result.usedFallbackTemplate = true AND result.success = true) AND
    
    // C2: Toast warning ditampilkan untuk guru yang dilewati
    (X.teacher.tmt IS NULL IMPLIES result.skippedTeachers CONTAINS X.teacher.nama AND result.toastWarning != null) AND
    
    // C3: Nomor SK kamad tidak mengandung separator ganda
    (X.templateId = 'sk_template_kamad' IMPLIES NOT result.nomorSk MATCHES '//') AND
    
    // C4: Bulk gabung menghasilkan output yang valid
    (X.combineInOneFile = true IMPLIES result.outputFiles.count >= 1 AND result.outputFiles.all(f => f.isValid)) AND
    
    // C5: QR URL menggunakan VITE_APP_URL atau fallback yang konsisten
    (X.verificationUrlSource = 'window.location.origin' IMPLIES result.qrUrl STARTS_WITH env('VITE_APP_URL') OR result.qrUrl STARTS_WITH window.location.origin) AND
    
    // C6: Endpoint verifikasi publik mengembalikan data SK yang valid
    (X.type = 'verification_request' AND X.skStatus = 'approved' AND X.tanggalPenetapan.addYear() >= NOW() IMPLIES result.httpStatus = 200 AND result.data.is_expired = false) AND
    (X.type = 'verification_request' AND X.skStatus != 'approved' IMPLIES result.httpStatus = 404) AND
    
    // C7: SK kadaluarsa dikembalikan dengan is_expired: true (bukan 404)
    (X.type = 'verification_request' AND X.skStatus = 'approved' AND X.tanggalPenetapan.addYear() < NOW() IMPLIES result.httpStatus = 200 AND result.data.is_expired = true)
  )
END FOR
```

### Property: Preservation Checking

```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT generateSk(X) = generateSk'(X)
  // Perilaku normal tidak berubah:
  // - Template dari backend tetap digunakan
  // - Semua placeholder ter-render dengan benar
  // - Status SK ter-update ke approved
  // - QR code ter-embed di dokumen
  // - Route /verify/teacher dan /verify/student tidak berubah
END FOR
```
