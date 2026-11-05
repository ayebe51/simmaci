# Modul Integrasi & Redesign Portal Resmi LP Ma'arif NU Cilacap

Dokumentasi aset antarmuka, desain, dan integrasi data langsung untuk website resmi:  
🌐 **Domain Resmi**: [maarifnucilacap.or.id](https://maarifnucilacap.or.id)  
🔗 **Integrasi Basis Data**: [simmaci.com](https://simmaci.com)

---

## 📌 Ringkasan Pekerjaan (Work Delivery Overview)
Proyek ini mentransformasi seluruh tampilan visual dan fungsional website WordPress LP Ma'arif NU Kabupaten Cilacap agar mengadopsi standar kemewahan visual Islami Nahdliyyin dan terintegrasi secara *realtime* dengan sistem informasi **SIMMACI**.

### ✨ Fitur Unggulan yang Telah Diimplementasikan:
1. **Hero Section Berwibawa (Cosmic 3D Gold Nahdlatul Ulama)**:
   - Mengusung karya seni kosmik bintang, pendaran nebula zamrud, kaligrafi melingkar, dan lambang emas 3D resmi Nahdlatul Ulama dengan efek *subtle ambient breathing*.
   - Fitur pencarian madrasah instan terpadu dengan filter cepat per jenjang (Semua, MI, MTs, MA, SMK).
   - Sayap kartu melayang (*floating side wing badges*) untuk kenyamanan tampilan layar lebar (*widescreen desktop*).
2. **Statistik Pendidikan Terpadu**:
   - Menghubungkan metrik 207 satuan pendidikan formal, 1.944 pendidik/tendik, 39.424 peserta didik, dan 24 kecamatan se-Kabupaten Cilacap.
3. **Peta Sebaran Interaktif 24 Kecamatan**:
   - Peta digital vektor SVG 24 kecamatan Kabupaten Cilacap dengan deteksi hover, filter wilayah, dan integrasi direktori madrasah formal.
4. **Redesign Seluruh Halaman Utama & Turunan**:
   - Beranda Utama (`BERANDA_BARU_LOGO_NU.html` / `kode-beranda-lengkap.html`)
   - Profil Resmi & Sejarah Khidmah (`kode-halaman-profil.html`)
   - Portal Warta & Berita Terkini (`kode-halaman-berita.html`)
   - Khazanah Aswaja An-Nahdliyyah (`kode-halaman-khazanah.html`)
   - Ensiklopedia Ilmiah Ma'arif Pedia (`kode-halaman-maarif-pedia.html`)
   - Dokumen, Regulasi, & Validasi SK QR Code SIMMACI (`kode-halaman-dokumen.html`)
5. **Mega Footer 4 Kolom & Services Hub**:
   - Dilengkapi kontak resmi WhatsApp (`0822 2743 8003`), tautan pintas layanan PPDB, validasi dokumen, dan tombol akses cepat SIMMACI.
   - Dilengkapi script isolasi otomatis untuk menyembunyikan footer bawaan tema Astra.

---

## 📁 Struktur Berkas

```
wordpress-maarif-assets/
├── BERANDA_BARU_LOGO_NU.html          # Kode All-in-One Beranda Utama (Hero Emas NU Kosmik)
├── kode-beranda-lengkap.html          # Template Beranda Lengkap
├── kode-halaman-profil.html           # Template Halaman Profil Organisasi
├── kode-halaman-berita.html           # Template Kanal Warta Berita
├── kode-halaman-khazanah.html         # Template Khazanah Keaswajaan
├── kode-halaman-maarif-pedia.html     # Template Ensiklopedia Ma'arif Pedia
├── kode-halaman-dokumen.html          # Template Regulasi & Validasi Dokumen
├── kode-footer-saja.html              # Mega Footer 4 Kolom Mandiri
├── schools-dataset.json               # Dataset 207 Satuan Pendidikan Cilacap
├── cilacap-svg-paths-optimized.json   # Koordinat Vektor Peta 24 Kecamatan Cilacap
├── simmaci-connector.php              # Plugin Connector WordPress
├── paket-template-elementor-maarif-nu.zip # Paket Arsip Lengkap
└── PANDUAN_PAKAI.txt                  # Petunjuk Penggunaan di Elementor
```

---

## 🚀 Cara Pemasangan di Elementor WordPress
1. Buka salah satu file HTML di atas sesuai halamannya.
2. Salin seluruh isi kodenya (`Ctrl + A` -> `Ctrl + C`).
3. Pada editor Elementor di WordPress, buat Seksi/Container dengan tata letak **Full Width** (*No Gap*).
4. Masukkan widget **HTML**, lalu tempelkan (`Ctrl + V`) kodenya.
5. Klik **Update / Perbarui**. Halaman langsung tampil seragam, modern, dan profesional.
