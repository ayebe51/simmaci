 # Requirements Document

## Introduction

Fitur ini menampilkan **NIM (Nomor Induk Maarif)** pada halaman daftar Pengajuan SK (`SkDashboardPage.tsx`). Setelah operator melakukan pengajuan SK (satuan maupun kolektif), data pengajuan tampil di tabel antrian. NIM perlu ditampilkan di sana agar admin dapat mengidentifikasi guru dengan lebih mudah.

NIM diambil dari field `nomor_induk_maarif` pada data item pengajuan (bisa dari `item.nomor_induk_maarif` langsung atau via relasi `item.teacher?.nomor_induk_maarif`). Jika NIM tersedia, ditampilkan di bawah nama guru di kolom "Nama Pemilik". Jika tidak tersedia, tidak ditampilkan (tidak ada label kosong).

## Glossary

- **NIM**: Nomor Induk Maarif — nomor identitas guru dalam sistem LP Ma'arif NU Cilacap, disimpan sebagai `nomor_induk_maarif` di database
- **Form_Pengajuan_SK**: Formulir elektronik pada tab "Input Satuan" di halaman Pengajuan SK
- **Teacher_Lookup**: Proses pencarian data guru via `teacherApi.list()` (GET /teachers?search=...) berdasarkan nama yang diinput user
- **Auto-fill**: Pengisian otomatis field NIM dari hasil Teacher_Lookup
- **Override**: Kemampuan user untuk mengubah nilai NIM yang sudah di-auto-fill
- **SkSubmissionPage**: Halaman `src/features/sk-management/SkSubmissionPage.tsx`
- **Backend_SK**: Endpoint `POST /api/sk-documents/submit-request` yang menerima payload pengajuan SK

## Requirements

### Requirement 1: Tampilkan Field NIM di Form Pengajuan SK

**User Story:** Sebagai operator madrasah, saya ingin melihat field NIM di formulir pengajuan SK, sehingga saya dapat mencantumkan Nomor Induk Maarif guru yang diajukan.

#### Acceptance Criteria

1. THE Form_Pengajuan_SK SHALL menampilkan field input bertipe teks dengan label "NIM (Nomor Induk Maarif)" pada tab "Input Satuan"
2. THE Form_Pengajuan_SK SHALL menempatkan field NIM pada baris tersendiri dalam layout grid dua kolom, berdampingan dengan field Tempat Lahir
3. THE Form_Pengajuan_SK SHALL menampilkan placeholder "Cth: 113400139" pada field NIM
4. THE Form_Pengajuan_SK SHALL menerima input NIM berupa string numerik dengan panjang maksimal 20 karakter
5. THE Form_Pengajuan_SK SHALL menampilkan field NIM sebagai field opsional (tidak wajib diisi)

---

### Requirement 2: Auto-fill NIM dari Data Guru

**User Story:** Sebagai operator madrasah, saya ingin NIM terisi otomatis ketika saya mengisi nama guru, sehingga saya tidak perlu mencari dan mengetik NIM secara manual.

#### Acceptance Criteria

1. WHEN user mengisi field nama dengan minimal 3 karakter dan berhenti mengetik selama 600ms, THE Form_Pengajuan_SK SHALL melakukan Teacher_Lookup menggunakan nilai nama sebagai parameter `search`
2. WHEN Teacher_Lookup mengembalikan tepat satu hasil yang memiliki nilai `nomor_induk_maarif` tidak kosong, THE Form_Pengajuan_SK SHALL mengisi field NIM dengan nilai `nomor_induk_maarif` dari hasil tersebut
3. WHEN Teacher_Lookup mengembalikan nol hasil atau lebih dari satu hasil, THE Form_Pengajuan_SK SHALL membiarkan field NIM tidak berubah
4. WHEN Teacher_Lookup mengembalikan satu hasil tetapi `nomor_induk_maarif` bernilai null atau kosong, THE Form_Pengajuan_SK SHALL membiarkan field NIM tidak berubah
5. WHILE Teacher_Lookup sedang berjalan, THE Form_Pengajuan_SK SHALL menampilkan indikator loading pada field NIM

---

### Requirement 3: Override NIM oleh User

**User Story:** Sebagai operator madrasah, saya ingin bisa mengubah NIM yang sudah terisi otomatis, sehingga saya dapat mengoreksi jika data yang ditemukan tidak sesuai.

#### Acceptance Criteria

1. THE Form_Pengajuan_SK SHALL mengizinkan user mengetik langsung pada field NIM kapan saja, termasuk setelah auto-fill
2. WHEN user mengubah nilai field NIM secara manual setelah auto-fill, THE Form_Pengajuan_SK SHALL mempertahankan nilai yang diketik user tanpa menimpa ulang dari Teacher_Lookup berikutnya
3. WHEN user mengosongkan field NIM secara manual, THE Form_Pengajuan_SK SHALL membiarkan field NIM kosong dan tidak melakukan auto-fill ulang secara otomatis

---

### Requirement 4: Kirim NIM ke Backend saat Submit

**User Story:** Sebagai operator madrasah, saya ingin NIM yang saya isi (baik manual maupun auto-fill) ikut terkirim ke backend saat pengajuan SK disubmit, sehingga data NIM tersimpan dalam record pengajuan.

#### Acceptance Criteria

1. WHEN user menekan tombol "Simpan & Ajukan" dan form valid, THE Form_Pengajuan_SK SHALL menyertakan field `nomor_induk_maarif` dalam payload yang dikirim ke Backend_SK
2. WHEN field NIM berisi nilai, THE Form_Pengajuan_SK SHALL mengirim nilai tersebut sebagai string pada field `nomor_induk_maarif`
3. WHEN field NIM kosong, THE Form_Pengajuan_SK SHALL mengirim `nomor_induk_maarif` sebagai `undefined` (field tidak disertakan dalam payload)
4. THE Backend_SK SHALL menerima field `nomor_induk_maarif` sebagai nullable string pada validasi endpoint `submit-request`
5. WHEN Backend_SK menerima `nomor_induk_maarif` yang tidak kosong, THE Backend_SK SHALL menyimpan nilai tersebut ke field `nomor_induk_maarif` pada record Teacher yang terkait dengan pengajuan

---

### Requirement 5: Validasi Format NIM

**User Story:** Sebagai operator madrasah, saya ingin sistem memberi tahu saya jika NIM yang saya masukkan tidak valid, sehingga saya tidak mengirim data yang salah format.

#### Acceptance Criteria

1. WHEN user mengisi field NIM dengan karakter non-numerik, THE Form_Pengajuan_SK SHALL menampilkan pesan error "NIM hanya boleh berisi angka"
2. WHEN user mengisi field NIM dengan lebih dari 20 karakter, THE Form_Pengajuan_SK SHALL menampilkan pesan error "NIM maksimal 20 karakter"
3. WHEN field NIM dikosongkan, THE Form_Pengajuan_SK SHALL tidak menampilkan pesan error (field bersifat opsional)
4. WHEN field NIM berisi nilai valid (numerik, maksimal 20 karakter), THE Form_Pengajuan_SK SHALL tidak menampilkan pesan error

---

### Requirement 6: Tampilkan NIM di Halaman Verifikasi SK (Opsional)

**User Story:** Sebagai pihak yang memverifikasi SK, saya ingin melihat NIM guru pada halaman verifikasi SK, sehingga saya dapat mengkonfirmasi identitas guru dengan lebih lengkap.

#### Acceptance Criteria

1. WHERE fitur verifikasi SK aktif, THE VerifySkPage SHALL menampilkan field NIM jika data `nomor_induk_maarif` tersedia pada record Teacher yang terkait
2. WHERE fitur verifikasi SK aktif dan `nomor_induk_maarif` bernilai null atau kosong, THE VerifySkPage SHALL tidak menampilkan baris NIM (tidak menampilkan label kosong)
