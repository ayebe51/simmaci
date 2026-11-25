# Panduan Lengkap Placeholder Template SK (.docx) SIMMACI

Dokumen ini merupakan panduan resmi bagi pengelola atau operator SIMMACI dalam menyusun dan mengunggah template dokumen Surat Keputusan (SK) berformat Microsoft Word (`.docx`) melalui menu **Pengaturan Template SK**.

Sistem SIMMACI menggunakan mesin templating **docxtemplater**. Setiap teks di dalam tanda kurung kurawal tunggal `{...}` akan otomatis digantikan dengan data yang tersimpan di sistem saat dokumen SK di-generate.

---

## 1. Aturan Dasar Penulisan Placeholder di Word (.docx)

1. **Kurung Kurawal Tunggal**: Gunakan kurung kurawal tunggal, contoh `{NAMA}`, bukan double `{{NAMA}}` (kecuali untuk tag khusus loop/kondisional).
2. **Hindari Tag Terpotong XML**: Microsoft Word terkadang memecah satu kata menjadi beberapa elemen internal XML jika kata tersebut diketik lalu diedit/disisipi huruf di tengahnya.
   - *Tips Terbaik:* Ketik teks tag di Notepad terlebih dahulu, lalu *Copy* dan *Paste* (pilih *Keep Text Only*) ke dalam dokumen Word.
3. **Huruf Besar/Kecil (Case Sensitivity)**: Sebaiknya gunakan format persis seperti yang ada pada tabel di bawah ini. SIMMACI telah mendukung variasi spasi dan underscore (misal `{NOMOR INDUK MAARIF}` dan `{NOMOR_INDUK_MAARIF}` keduanya didukung).
4. **Tag Gambar (QR Code)**: Khusus QR Code wajib diawali dengan tanda persen: `{%qrcode}`.

---

## 2. Ringkasan Placeholder Berdasarkan Jenis SK

| Jenis SK | Placeholder Utama yang Wajib / Dianjurkan |
| :--- | :--- |
| **SK Guru Tetap Yayasan (GTY)** | `{NOMOR}`, `{TAHUN}`, `{NAMA}`, `{TEMPAT/TANGGAL LAHIR}`, `{NOMOR INDUK MAARIF}`, `{PENDIDIKAN}`, `{UNIT KERJA}`, `{TMT}`, `{TAHUN PELAJARAN}`, `{KATA_PENGANGKATAN}`, `{PERIODE}`, `{%qrcode}`, `{#tembusan}...` |
| **SK Guru Tidak Tetap (GTT)** | Sama dengan GTY, ditambahkan `{TANGGAL_BERAKHIR}` |
| **SK Tenaga Kependidikan (Tendik)** | Sama dengan GTY/GTT |
| **SK Kepala Madrasah (Kamad)** | Tambahan `{NOMOR SURAT REKOMENDASI}`, `{TANGGAL SURAT REKOMENDASI}`, `{KECAMATAN}`, `{GOLONGAN}` (khusus Kamad PNS) |
| **SK Perubahan Status** | Tambahan `{NOMOR_SK_LAMA}`, `{GELAR_BARU}`, `{JUDUL_PENGANGKATAN}`, `{JABATAN_UPPER}`, `{STATUS_GURU}` |
| **SK Pemberhentian** | Tambahan `{ALASAN_PEMBERHENTIAN}`, `{KETERANGAN_PEMBERHENTIAN}`, `{TANGGAL_EFEKTIF}` |

---

## 3. Daftar Lengkap Tag Placeholder

### A. Header, Nomor SK & Tanggal

| Tag Placeholder | Deskripsi | Contoh Output |
| :--- | :--- | :--- |
| `{NOMOR}` | Nomor urut SK | `1702` |
| `{nomor_sk}` | Nomor lengkap SK resmi | `1702/PC.L/A.II/H-34.B/24.29/10/X/2025` |
| `{TANGGAL}` | Tanggal penetapan (angka) | `20` |
| `{BULAN}` | Bulan penetapan (angka) | `10` |
| `{BL_ROMA}` | Bulan penetapan (angka romawi) | `X` |
| `{TAHUN}` | Tahun penetapan | `2025` |
| `{TAHUN PELAJARAN}` | Tahun pelajaran aktif | `2025/2026` |
| `{TANGGAL PENETAPAN}` | Tanggal penetapan SK format Indonesia | `20 Oktober 2025` |
| `{TANGGAL LENGKAP}` | Sama dengan tanggal penetapan | `20 Oktober 2025` |
| `{TANGGAL_BERAKHIR}` | Tanggal akhir berlakunya SK | `01 Juli 2026` |

---

### B. Judul & Status Pengangkatan (Dinamis Otomatis Sesuai TMT)

Bagian ini sangat penting terutama pada **SK Perubahan Status** dan **SK Pengangkatan**:

| Tag Placeholder | Logika Otomatis Sistem | Contoh Output |
| :--- | :--- | :--- |
| `{JUDUL_PENGANGKATAN}` | Jika masa kerja $\ge 2$ th $\rightarrow$ GTY<br>Jika masa kerja $< 2$ th $\rightarrow$ GTT | `PENGANGKATAN GURU TETAP YAYASAN` atau `PENGANGKATAN GURU TIDAK TETAP` |
| `{JABATAN_UPPER}` | Huruf kapital nama status jabatan | `GURU TETAP YAYASAN` atau `GURU TIDAK TETAP` |
| `{STATUS_GURU}` | Format Title Case nama status | `Guru Tetap Yayasan` atau `Guru Tidak Tetap` |
| `{KATA_PENGANGKATAN}` | `diangkat sebagai` (jika baru diangkat pertama kali)<br>`diangkat kembali sebagai` (jika perpanjangan masa kerja) | `diangkat kembali sebagai` |
| `{PERIODE}` | Masa periode penugasan | `1`, `2`, `3`, dst. |

---

### C. Data Personil (Guru / Tendik / Kepala)

| Tag Placeholder | Variasi Tag yang Didukung | Keterangan & Contoh Output |
| :--- | :--- | :--- |
| `{NAMA}` | `{nama}` | Nama lengkap beserta gelar (otomatis menyertakan gelar baru bila ada). Contoh: `ADINDA EGI DIAN RENJANI AULIA, S.Pd` |
| `{TEMPAT/TANGGAL LAHIR}` | `{TEMPAT, TANGGAL LAHIR}` | Tempat dan tanggal lahir lengkap. Contoh: `Kuningan, 02 September 1989` |
| `{NOMOR INDUK MAARIF}` | `{NOMOR_INDUK_MAARIF}`, `{NIM}` | Nomor Induk Ma'arif resmi. Contoh: `113402867` |
| `{PENDIDIKAN}` | `{PENDIDIKAN TERAKHIR}`, `{Pendidikan}` | Tingkat pendidikan formal terakhir. Contoh: `S1`, `D3`, `SMA` |
| `{UNIT KERJA}` | `{unit_kerja}` | Nama sekolah/madrasah tempat bertugas. Contoh: `MI Al Ma’arif 02 Rejamulya` |
| `{KECAMATAN}` | `{kecamatan}` | Nama kecamatan unit kerja. Contoh: `Kedungreja` |
| `{TMT}` | `{TANGGAL MULAI TUGAS}`, `{TMT GURU}` | Tanggal mulai awal bertugas. Contoh: `1 Juli 2020` |
| `{GOLONGAN}` | (Khusus Kamad PNS) | Golongan/ruang kepegawaian ASN. Contoh: `IV/a` |

---

### D. Khusus SK Perubahan Status (Tendik ke Guru)

| Tag Placeholder | Deskripsi | Contoh Output |
| :--- | :--- | :--- |
| `{NOMOR_SK_LAMA}` | Nomor SK Tendik yang dicabut dan dinyatakan tidak berlaku | `447/PC.L/A.II/H-34.B/24.29/5/7/2025` |
| `{NOMOR SK LAMA}` | Variasi spasi dari tag nomor SK lama | `447/PC.L/A.II/H-34.B/24.29/5/7/2025` |
| `{GELAR_BARU}` | Gelar akademik sarjana yang baru didapatkan | `, S.Pd.` |

---

### E. Khusus SK Pemberhentian

| Tag Placeholder | Deskripsi | Contoh Output |
| :--- | :--- | :--- |
| `{ALASAN_PEMBERHENTIAN}` | Alasan pemberhentian resmi | `Mengundurkan Diri`, `Meninggal Dunia`, `Pensiun` |
| `{KETERANGAN_PEMBERHENTIAN}` | Keterangan/catatan tambahan pemberhentian | `Mengajukan permohonan berhenti mandiri` |
| `{TANGGAL_EFEKTIF}` | Tanggal resmi mulai berlakunya pemberhentian | `15 November 2025` |

---

### F. Surat Permohonan & Rekomendasi (Konsideran)

| Tag Placeholder | Deskripsi | Contoh Output |
| :--- | :--- | :--- |
| `{NOMOR SURAT PERMOHONAN}` | Nomor surat permohonan dari unit kerja/sekolah | `027/MI.025/SP/V/2025` |
| `{TANGGAL SURAT PERMOHONAN}` | Tanggal surat permohonan | `26 April 2025` |
| `{NOMOR SURAT REKOMENDASI}` | Nomor surat rekomendasi MWC (jika ada) | `014/MWC.LP/R-1/2025` |
| `{TANGGAL SURAT REKOMENDASI}` | Tanggal surat rekomendasi MWC | `02 Mei 2025` |

---

### G. QR Code Digital & Daftar Tembusan

#### 1. QR Code Digital
Letakkan tag ini pada kolom tanda tangan atau area verifikasi dokumen:
```text
{%qrcode}
```
> [!IMPORTANT]
> Tanda persen (`%`) wajib disertakan. Ini memberi tahu mesin docxtemplater bahwa placeholder ini adalah sebuah gambar QR Code, bukan teks biasa.

#### 2. Daftar Tembusan Dinamis
Untuk menghindari masalah nomor urut tembusan berantakan saat melakukan unduh gabung (bulk generate), gunakan format loop berikut:
```text
{#tembusan}{nomor}. {isi}
{/tembusan}
```
*Sistem SIMMACI otomatis menyuplai daftar tembusan standar:*
1. LP Ma'arif NU PWNU Jawa Tengah
2. PCNU Cilacap
3. Perwakilan LP Ma'arif NU MWCNU Kecamatan `{KECAMATAN}`
4. Kepala `{UNIT KERJA}`
5. BP3MNU `{UNIT KERJA}`
6. Arsip

---

## 4. Contoh Penerapan Nyata pada Template SK Perubahan Status

Berikut adalah contoh susunan teks dalam dokumen Word `.docx` untuk template **SK Perubahan Status**:

### Bagian Judul
```text
SURAT KEPUTUSAN
Nomor : {NOMOR}/PC.L/A.II/H-34.B/24.29/{BULAN}/{BL_ROMA}/{TAHUN}

TENTANG
{JUDUL_PENGANGKATAN}
DI LINGKUNGAN PENGURUS CABANG LEMBAGA PENDIDIKAN MA’ARIF NU KABUPATEN CILACAP
```

### Bagian Memperhatikan (Konsideran)
```text
Memperhatikan : Berdasarkan Surat Permohonan SK Dari {UNIT KERJA} Nomor {NOMOR SURAT PERMOHONAN} Tanggal {TANGGAL SURAT PERMOHONAN}.
```

### Bagian Diktum MEMUTUSKAN
```text
MEMUTUSKAN :
Menetapkan :
Pertama    : Identitas Personil tersebut di bawah ini :
             1. Nama                : {NAMA}
             2. Tempat/Tanggal Lahir: {TEMPAT/TANGGAL LAHIR}
             3. Nomor Induk Ma'arif : {NOMOR INDUK MAARIF}
             4. Pendidikan Terakhir : {PENDIDIKAN}
             5. Unit Kerja          : {UNIT KERJA}
             6. Tanggal Mulai Tugas : {TMT}

             Terhitung mulai tanggal {TANGGAL PENETAPAN} mencabut SK sebelumnya dengan nomor {NOMOR_SK_LAMA}, dan selanjutnya {KATA_PENGANGKATAN} {STATUS_GURU} LP.Ma'arif NU Cilacap pada {UNIT KERJA} tahun pelajaran {TAHUN PELAJARAN}, diberikan hak-hak sesuai dengan ketentuan yang berlaku.

Kedua      : Keputusan ini berlaku sejak tanggal ditetapkan sampai dengan {TANGGAL_BERAKHIR}, dan apabila ada kekeliruan dikemudian hari akan diadakan perbaikan sebagaimana mestinya.
```

### Bagian Tanggal Penetapan & Pengesahan
```text
Ditetapkan di : Cilacap
Pada Tanggal  : {TANGGAL LENGKAP}

PENGURUS CABANG NAHDLATUL ULAMA
LEMBAGA PENDIDIKAN MA'ARIF
KABUPATEN CILACAP

{%qrcode}

ALI SODIQIN, S.Ag., M.Pd.I              NGADINO, S.Pd.I
         Ketua                               Sekretaris
```

### Bagian Tembusan
```text
Tembusan dikirim Kepada Yth. :
{#tembusan}{nomor}. {isi}
{/tembusan}
```

---

## 5. Pertanyaan Umum & Pemecahan Masalah (FAQ)

### T: Mengapa teks `{JUDUL_PENGANGKATAN}` lebih baik daripada menulis langsung "PENGANGKATAN GURU TETAP YAYASAN"?
**J:** Karena dalam satu jenis template perubahan status, guru yang diangkat bisa berstatus **GTY** (jika TMT $\ge 2$ tahun) atau **GTT** (jika TMT $< 2$ tahun). Dengan memakai tag `{JUDUL_PENGANGKATAN}`, sistem akan otomatis memilih kalimat yang tepat tanpa Anda perlu membuat dua file template terpisah.

### T: Mengapa saat di-download tag `{NAMA}` tetap muncul persis tulisan `{NAMA}` dan tidak berubah jadi nama guru?
**J:** Kemungkinan besar saat mengetik di Word, huruf `{` atau kata di dalamnya sempat terhapus/diedit sebagian sehingga Word memisahkan tag tersebut ke dalam tag XML terpisah (`<w:t>{</w:t><w:t>NAMA</w:t><w:t>}</w:t>`).
**Solusi:** Hapus seluruh kata `{NAMA}`, salin teks `{NAMA}` dari Notepad atau panduan ini, lalu paste ke Word menggunakan opsi *Paste Plain Text*.

### T: Apakah nama tag case-sensitive (harus huruf besar)?
**J:** Sistem telah mengantisipasi penulisan kapital umum seperti `{NAMA}`, `{UNIT KERJA}`, `{TMT}`, dan `{nomor_sk}`. Disarankan selalu menggunakan huruf kapital sesuai panduan ini untuk menghindari ketidakcocokan.
