# Bugfix Requirements Document

## Introduction

Empat bug ditemukan pada fitur SK Generator setelah dokumen SK berhasil di-generate. Bug-bug ini berdampak pada validitas dokumen yang sudah dicetak dan diterima guru:

1. **QR Code 404** — Ketika QR code pada dokumen SK di-scan, browser membuka URL verifikasi yang menampilkan halaman 404. Root cause: nomor SK mengandung karakter `/` yang di-encode dua kali (`encodeURIComponent` dipanggil di `getSkVerificationUrl()` saat generate QR, lalu dipanggil lagi di `verificationApi.verifyBySk()` saat request ke backend), menghasilkan URL seperti `/verify/sk/0001%252FPC.L%252F...` yang tidak dikenali oleh React Router maupun backend.

2. **Nama tidak bold** — Nama guru pada dokumen SK hasil generate tidak tercetak tebal, padahal desain template mengharuskan nama dicetak bold. Root cause: placeholder `{NAMA}` di template DOCX tidak memiliki formatting bold (`<w:b/>`) pada run XML-nya, sehingga docxtemplater merender teks tanpa bold meskipun data sudah benar.

3. **Template SK salah** — Dua guru yang TMT-nya sudah lebih dari 2 tahun mendapatkan SK dengan template "Guru Tidak Tetap" (GTT), padahal seharusnya "Guru Tetap Yayasan" (GTY). Root cause: kondisi pemilihan template di `SkGeneratorPage.tsx` memiliki logika yang terlalu broad — `teacherStatus.includes("guru")` menangkap semua status yang mengandung kata "guru" (termasuk "Guru Tetap Yayasan") dan memasukkannya ke branch GTT, karena kondisi GTT dievaluasi sebelum kondisi GTY selesai diverifikasi secara menyeluruh.

4. **Nomor tembusan tidak di-reset** — Pada generate multi-dokumen (beberapa guru sekaligus), nomor urut pada bagian "Tembusan dikirim kepada Yth." tidak di-reset untuk setiap dokumen baru. Halaman pertama menampilkan nomor 1–6 dengan benar, namun halaman kedua (guru berbeda) melanjutkan dari 7–12, padahal seharusnya juga dimulai dari 1. Root cause: variabel counter/index untuk penomoran tembusan tidak di-reset saat iterasi ke dokumen SK berikutnya dalam loop generate multi-dokumen.

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN pengguna men-scan QR code pada dokumen SK yang sudah dicetak THEN sistem menampilkan halaman 404 karena URL verifikasi mengandung nomor SK yang di-encode dua kali (double `encodeURIComponent`), menghasilkan `%252F` sebagai ganti `/` dalam path URL

1.2 WHEN nomor SK mengandung karakter `/` (seperti `0001/PC.L/A.II/H-34.B/24.29/07/2026`) THEN sistem menghasilkan QR code dengan URL yang tidak dapat di-resolve oleh React Router karena path parameter `:nomor` tidak menangkap karakter `/` secara default

1.3 WHEN dokumen SK di-generate dan dicetak THEN nama guru pada dokumen tidak tercetak tebal (bold), meskipun desain template mengharuskan nama dicetak bold

1.4 WHEN guru memiliki `status_kepegawaian` atau `jenis_sk` yang mengandung kata "guru" (termasuk "Guru Tetap Yayasan") THEN sistem memilih template GTT (Guru Tidak Tetap) karena kondisi `teacherStatus.includes("guru")` pada branch GTT terpenuhi sebelum kondisi GTY diperiksa

1.5 WHEN guru memiliki TMT lebih dari 2 tahun dan seharusnya mendapat template GTY THEN sistem mencetak SK dengan template "Guru Tidak Tetap" karena kesalahan urutan dan logika kondisi pemilihan template

1.6 WHEN generate SK dilakukan untuk lebih dari satu guru sekaligus (multi-dokumen) THEN sistem menampilkan nomor tembusan yang dilanjutkan dari dokumen sebelumnya (contoh: dokumen pertama 1–6, dokumen kedua 7–12) karena counter penomoran tembusan tidak di-reset di setiap iterasi dokumen baru

### Expected Behavior (Correct)

2.1 WHEN pengguna men-scan QR code pada dokumen SK yang sudah dicetak THEN sistem SHALL menampilkan halaman verifikasi SK yang benar (`/verify/sk/:nomor`) tanpa 404, dengan nomor SK ter-decode dengan benar

2.2 WHEN nomor SK mengandung karakter `/` THEN sistem SHALL menggunakan URL encoding yang konsisten — nomor SK di-encode tepat satu kali saat QR code di-generate, dan di-decode dengan benar saat halaman verifikasi dimuat

2.3 WHEN dokumen SK di-generate THEN sistem SHALL mencetak nama guru dengan format bold sesuai desain template, sehingga nama tercetak tebal pada dokumen fisik

2.4 WHEN guru memiliki `jenis_sk` atau `status_kepegawaian` yang secara eksplisit menunjukkan "GTY" atau "Guru Tetap Yayasan" THEN sistem SHALL memilih template GTY, bukan GTT

2.5 WHEN logika pemilihan template dievaluasi THEN sistem SHALL memprioritaskan pencocokan GTY sebelum GTT, dan kondisi GTT tidak boleh menangkap status yang mengandung kata "guru" secara umum

2.6 WHEN generate SK dilakukan untuk lebih dari satu guru sekaligus (multi-dokumen) THEN sistem SHALL me-reset counter penomoran tembusan ke 1 untuk setiap dokumen SK baru, sehingga setiap dokumen memiliki nomor tembusan yang dimulai dari 1 secara independen

### Unchanged Behavior (Regression Prevention)

3.1 WHEN guru memiliki `jenis_sk` atau `status_kepegawaian` yang secara eksplisit menunjukkan "GTT" atau "Guru Tidak Tetap" THEN sistem SHALL CONTINUE TO memilih template GTT dengan benar

3.2 WHEN guru memiliki status Kepala Madrasah (kamad) THEN sistem SHALL CONTINUE TO memilih template Kamad dengan benar

3.3 WHEN guru memiliki status Tenaga Kependidikan (tendik) THEN sistem SHALL CONTINUE TO memilih template Tendik sebagai default dengan benar

3.4 WHEN QR code di-generate untuk nomor SK yang tidak mengandung karakter spesial THEN sistem SHALL CONTINUE TO menghasilkan URL verifikasi yang valid dan dapat di-scan

3.5 WHEN halaman `/verify/sk/:nomor` diakses dengan nomor SK yang valid dan berstatus approved THEN sistem SHALL CONTINUE TO menampilkan detail SK dengan badge "SK VALID & AKTIF"

3.6 WHEN halaman `/verify/sk/:nomor` diakses dengan nomor SK yang sudah kadaluarsa THEN sistem SHALL CONTINUE TO menampilkan detail SK dengan badge "SK KADALUARSA"

3.7 WHEN dokumen SK di-generate untuk semua field selain nama THEN sistem SHALL CONTINUE TO merender semua placeholder lain (jabatan, unit kerja, TMT, nomor SK, dll.) dengan benar tanpa perubahan formatting

3.8 WHEN generate SK dilakukan untuk hanya satu guru (single-dokumen) THEN sistem SHALL CONTINUE TO menampilkan nomor tembusan dengan benar dimulai dari 1

3.9 WHEN generate SK multi-dokumen dilakukan dan setiap dokumen memiliki jumlah tembusan yang berbeda THEN sistem SHALL CONTINUE TO menampilkan seluruh daftar tembusan sesuai template masing-masing dokumen tanpa terpotong atau terlewat

---

## Bug Condition Derivation

### Bug Condition Function

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type SkGenerateInput | SkVerificationRequest
  OUTPUT: boolean

  RETURN (
    // C1: Nomor SK mengandung karakter '/' yang menyebabkan double-encoding
    (X.type = 'qr_generate' AND X.nomorSk CONTAINS '/') OR

    // C2: Placeholder {NAMA} di template DOCX tidak memiliki formatting bold
    (X.type = 'docx_render' AND X.templatePlaceholderNama.hasBoldFormatting = false) OR

    // C3: Status/jenis guru mengandung "guru" secara umum sehingga masuk branch GTT
    (X.type = 'template_selection' AND
      (X.teacherStatus CONTAINS 'guru' OR X.jenissk CONTAINS 'guru') AND
      NOT (X.teacherStatus CONTAINS 'gty' OR X.teacherStatus CONTAINS 'tetap yayasan' OR
           X.jenissk CONTAINS 'gty' OR X.jenissk CONTAINS 'tetap yayasan')) OR

    // C4: Generate multi-dokumen dengan counter tembusan yang tidak di-reset
    (X.type = 'multi_doc_generate' AND X.documentIndex > 0 AND X.tembusanCounterNotReset = true)
  )
END FUNCTION
```

### Property: Fix Checking

```pascal
// Property: Fix Checking — QR Code URL, Bold Nama, Template Selection
FOR ALL X WHERE isBugCondition(X) DO
  result ← processSkGenerate'(X)
  ASSERT (
    // C1: URL QR code tidak mengandung double-encoding
    (X.type = 'qr_generate' AND X.nomorSk CONTAINS '/' IMPLIES
      NOT result.qrUrl CONTAINS '%25' AND
      decodeURIComponent(result.qrUrl) ENDS_WITH X.nomorSk) AND

    // C2: Nama guru tercetak bold di dokumen
    (X.type = 'docx_render' IMPLIES
      result.docxXml CONTAINS '<w:b/>' OR result.docxXml CONTAINS '<w:b w:val="true"/>') AND

    // C3: Guru GTY mendapat template GTY, bukan GTT
    (X.type = 'template_selection' AND
      (X.teacherStatus CONTAINS 'gty' OR X.teacherStatus CONTAINS 'tetap yayasan' OR
       X.jenissk CONTAINS 'gty' OR X.jenissk CONTAINS 'tetap yayasan') IMPLIES
      result.selectedTemplateId = 'sk_template_gty') AND

    // C4: Nomor tembusan di-reset ke 1 untuk setiap dokumen baru
    (X.type = 'multi_doc_generate' AND X.documentIndex > 0 IMPLIES
      result.tembusanStartNumber = 1)
  )
END FOR
```

### Property: Preservation Checking

```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT processSkGenerate(X) = processSkGenerate'(X)
  // Perilaku normal tidak berubah:
  // - Guru GTT tetap mendapat template GTT
  // - Guru Kamad tetap mendapat template Kamad
  // - Guru Tendik tetap mendapat template Tendik
  // - Nomor SK tanpa karakter '/' tetap menghasilkan URL QR yang valid
  // - Semua placeholder lain (jabatan, unit kerja, TMT, dll.) tetap ter-render benar
  // - Halaman verifikasi SK tetap berfungsi untuk SK valid dan kadaluarsa
  // - Generate single-dokumen tetap menampilkan nomor tembusan dimulai dari 1
  // - Jumlah dan isi daftar tembusan per dokumen tidak berubah
END FOR
```
