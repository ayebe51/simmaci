# Requirements Document

## Introduction

Fitur ini menambahkan logika otomatis pada SK Generator di SIMMACI untuk mengisi dua field tanggal secara otomatis berdasarkan tahun yang dipilih operator:

- **Tanggal Penetapan** — selalu ditetapkan pada **1 Juli** tahun yang dipilih
- **Tanggal Berakhir (Masa Berlaku)** — selalu ditetapkan pada **30 Juni tahun berikutnya**

Konvensi ini mengikuti kalender akademik LP Ma'arif NU: tahun ajaran dimulai Juli dan berakhir Juni tahun berikutnya. Saat ini, `tanggalPenetapan` diinisialisasi dengan `new Date()` (tanggal hari ini), dan `tglBerakhirVal` dihitung sebagai `tanggalPenetapan + 1 tahun - 1 hari` — keduanya tidak mengikuti konvensi 1 Juli / 30 Juni.

Fitur ini juga memastikan field `TAHUN PELAJARAN` (tahun ajaran) yang ditampilkan di dokumen SK konsisten dengan pasangan tanggal yang ditetapkan.

---

## Glossary

- **SK_Generator**: Halaman generator SK di SIMMACI (`SkGeneratorPage.tsx`) yang digunakan operator untuk mencetak dokumen SK massal
- **Tanggal_Penetapan**: Tanggal resmi ditetapkannya SK, diisi ke placeholder `{TANGGAL PENETAPAN}` dan `{TANGGAL LENGKAP}` di template DOCX
- **Tanggal_Berakhir**: Tanggal berakhirnya masa berlaku SK, diisi ke placeholder `{TANGGAL_BERAKHIR}` di template DOCX
- **Tahun_Ajaran**: String format `YYYY/YYYY+1` yang diisi ke placeholder `{TAHUN PELAJARAN}` di template DOCX (contoh: `2025/2026`)
- **Tahun_SK**: Tahun kalender yang menjadi acuan penetapan SK — Tanggal_Penetapan = 1 Juli Tahun_SK, Tanggal_Berakhir = 30 Juni (Tahun_SK + 1)
- **Operator**: Pengguna dengan role `operator` yang mengelola data SK untuk satu sekolah (tenant)
- **Super_Admin**: Pengguna dengan role `super_admin` atau `admin_yayasan` yang memiliki akses lintas sekolah

---

## Requirements

### Requirement 1: Inisialisasi Tanggal Otomatis Berdasarkan Tahun Berjalan

**User Story:** Sebagai operator, saya ingin tanggal penetapan dan tanggal berakhir SK terisi otomatis saat halaman generator dibuka, sehingga saya tidak perlu mengisi manual dan risiko salah tanggal berkurang.

#### Acceptance Criteria

1. WHEN halaman SK_Generator pertama kali dimuat, THE SK_Generator SHALL mengisi Tanggal_Penetapan secara otomatis dengan nilai `1 Juli <tahun berjalan>` (format `YYYY-07-01`)
2. WHEN halaman SK_Generator pertama kali dimuat, THE SK_Generator SHALL mengisi Tanggal_Berakhir secara otomatis dengan nilai `30 Juni <tahun berjalan + 1>` (format `YYYY-07-01 - 1 hari` = `YYYY+1-06-30`)
3. WHEN halaman SK_Generator pertama kali dimuat, THE SK_Generator SHALL mengisi Tahun_Ajaran secara otomatis dengan nilai `<tahun berjalan>/<tahun berjalan + 1>` (contoh: `2025/2026`)
4. THE SK_Generator SHALL menentukan "tahun berjalan" sebagai tahun kalender saat halaman dimuat, tanpa mempertimbangkan bulan atau tanggal saat ini

---

### Requirement 2: Pemilihan Tahun SK oleh Operator

**User Story:** Sebagai operator, saya ingin dapat mengubah tahun SK yang menjadi acuan, sehingga saya bisa mencetak SK untuk tahun ajaran yang berbeda (misalnya mencetak ulang SK tahun lalu atau menyiapkan SK tahun depan).

#### Acceptance Criteria

1. THE SK_Generator SHALL menyediakan input pemilihan Tahun_SK yang dapat diubah oleh operator
2. WHEN operator mengubah nilai Tahun_SK, THE SK_Generator SHALL memperbarui Tanggal_Penetapan secara otomatis menjadi `1 Juli <Tahun_SK baru>` (format `YYYY-07-01`)
3. WHEN operator mengubah nilai Tahun_SK, THE SK_Generator SHALL memperbarui Tanggal_Berakhir secara otomatis menjadi `30 Juni <Tahun_SK baru + 1>` (format `YYYY+1-06-30`)
4. WHEN operator mengubah nilai Tahun_SK, THE SK_Generator SHALL memperbarui Tahun_Ajaran secara otomatis menjadi `<Tahun_SK baru>/<Tahun_SK baru + 1>`
5. THE SK_Generator SHALL memastikan Tanggal_Penetapan, Tanggal_Berakhir, dan Tahun_Ajaran selalu konsisten satu sama lain — ketiganya SHALL selalu diturunkan dari satu nilai Tahun_SK yang sama

---

### Requirement 3: Konsistensi Data di Dokumen SK yang Digenerate

**User Story:** Sebagai operator, saya ingin dokumen SK yang dicetak memiliki tanggal penetapan dan masa berlaku yang benar sesuai konvensi LP Ma'arif NU, sehingga dokumen sah secara administratif.

#### Acceptance Criteria

1. WHEN SK_Generator menghasilkan dokumen DOCX, THE SK_Generator SHALL mengisi placeholder `{TANGGAL PENETAPAN}` dan `{TANGGAL LENGKAP}` dengan Tanggal_Penetapan dalam format tanggal Indonesia (contoh: `1 Juli 2025`)
2. WHEN SK_Generator menghasilkan dokumen DOCX, THE SK_Generator SHALL mengisi placeholder `{TANGGAL_BERAKHIR}` dengan Tanggal_Berakhir dalam format tanggal Indonesia (contoh: `30 Juni 2026`)
3. WHEN SK_Generator menghasilkan dokumen DOCX, THE SK_Generator SHALL mengisi placeholder `{TAHUN PELAJARAN}` dengan Tahun_Ajaran yang konsisten dengan Tanggal_Penetapan (contoh: `2025/2026`)
4. WHEN SK_Generator menyinkronkan data ke backend setelah generate, THE SK_Generator SHALL mengirimkan `tanggal_penetapan` dengan nilai Tanggal_Penetapan yang ditetapkan (bukan tanggal hari ini)

---

### Requirement 4: Kalkulasi Tanggal Berakhir

**User Story:** Sebagai sistem, saya ingin kalkulasi Tanggal_Berakhir dilakukan secara deterministik berdasarkan Tahun_SK, sehingga hasilnya selalu tepat `30 Juni` tahun berikutnya tanpa bergantung pada logika offset hari.

#### Acceptance Criteria

1. THE SK_Generator SHALL menghitung Tanggal_Berakhir sebagai tanggal `30 Juni` pada tahun `Tahun_SK + 1`, bukan sebagai `Tanggal_Penetapan + 365 hari` atau `Tanggal_Penetapan + 1 tahun - 1 hari`
2. FOR ALL nilai Tahun_SK yang valid (bilangan bulat positif), Tanggal_Berakhir yang dihitung SHALL selalu berupa tanggal `30 Juni <Tahun_SK + 1>` (round-trip property: `deriveEndDate(year).month === 6 && deriveEndDate(year).day === 30`)
3. FOR ALL nilai Tahun_SK yang valid, Tanggal_Penetapan yang dihitung SHALL selalu berupa tanggal `1 Juli <Tahun_SK>` (round-trip property: `deriveStartDate(year).month === 7 && deriveStartDate(year).day === 1`)
4. IF Tahun_SK yang diberikan bukan bilangan bulat positif yang valid, THEN THE SK_Generator SHALL menggunakan tahun berjalan sebagai fallback

---

### Requirement 5: Tampilan UI yang Informatif

**User Story:** Sebagai operator, saya ingin melihat tanggal penetapan dan tanggal berakhir yang akan digunakan sebelum mencetak, sehingga saya dapat memverifikasi kebenaran data sebelum dokumen digenerate.

#### Acceptance Criteria

1. THE SK_Generator SHALL menampilkan nilai Tanggal_Penetapan yang aktif di panel pengaturan generator sebelum proses generate dimulai
2. THE SK_Generator SHALL menampilkan nilai Tanggal_Berakhir yang aktif di panel pengaturan generator sebelum proses generate dimulai
3. WHEN nilai Tahun_SK berubah, THE SK_Generator SHALL memperbarui tampilan Tanggal_Penetapan dan Tanggal_Berakhir secara langsung (real-time) tanpa perlu reload halaman
4. WHERE operator memiliki role `operator` (bukan super_admin), THE SK_Generator SHALL tetap menampilkan dan menggunakan logika tanggal otomatis yang sama

