# Laporan Pekerjaan - 3 Juli 2026

## Ringkasan
Pekerjaan pada 3 Juli 2026 berfokus pada penyelesaian bug (error) kritis di sisi Frontend (khususnya *download* template SK yang rusak/corrupt), perbaikan logika penomoran dan pengurutan di SK Generator, serta pembuatan perintah artisan untuk pemulihan dan pembersihan data guru (*Teacher Data Restoration*).

---

## 1. Perbaikan Fitur Unduh (Download) Template SK & PizZip
Terjadi masalah ketika men-download dan meng-generate file Word (.docx) SK dari template, di mana file menjadi corrupt (ZIP error).
- **Penanganan ArrayBuffer & Base64 (`MySkPage.tsx`, `SkDetailPage.tsx`)**: Memperbaiki cara pembacaan file dari server dengan menggunakan `ArrayBuffer` dan parameter bawaan PizZip (`base64: true`), alih-alih menggunakan fungsi konversi `atob()` bawaan *browser* yang menyebabkan *parsing error*.
- **Pemindahan Sumber Template**: Mengubah logika *fetching* template dari sebelumnya mengambil di tabel *settings* menjadi langsung menggunakan tabel spesifik `sk_templates`.

## 2. Perbaikan SK Generator dan Logika Penomoran
Sebelumnya terjadi kekacauan pada nomor SK yang digenerate (tumpang tindih / *duplicate numbers*) dan salah urutan.
- **Akurasi Nomor Maksimal SK Terakhir**: Memperbaiki *query* untuk mencari nomor SK terakhir agar tidak terpengaruh oleh *update* massal (bulk ops) yang memanipulasi kolom `updated_at`. Logika sekarang mengecualikan draft (prefix `DRAFT-`).
- **Penyortiran yang Benar (FIFO)**: Kandidat generator sekarang diurutkan secara tegas (explicit) berdasarkan `created_at` ASC sehingga request yang lebih lama akan mendapatkan nomor SK yang lebih kecil.
- **Pengamanan Template Rusak**: Kandidat SK yang memiliki data Tanggal Lahir (TTL) atau TMT kosong disembunyikan (*hide*) dari SK Generator agar tidak menghasilkan dokumen Word yang datanya bolong.
- **Daftar Arsip & Pencarian**: Pencarian berdasarkan `nomor_sk` sekarang diaktifkan. Dokumen berstatus `REQ` dan `DRAFT` sengaja didorong ke paling bawah daftar dan disembunyikan dari halaman Arsip SK Unit.

## 3. Pemulihan Data Guru (Data Restoration Commands)
Karena adanya masalah duplikasi sebelumnya, beberapa data berharga (seperti TMT, Tempat Tanggal Lahir, NIM) tertinggal di baris data guru yang sudah terhapus (*soft-deleted*).
- **Command `teacher:restore-data`**: Perintah baru untuk memulihkan (*recover*) data-data yang hilang (TMT, TTL, NIM, Unit Kerja) dari data guru duplikat yang sudah terhapus, lalu disinkronkan ke data guru utama yang sedang aktif. Command ini juga memulihkan data permohonan SK yang terkait.
- **Command `SyncSkNames`**: Perintah baru untuk mensinkronkan ulang nama di *sk_documents* agar identik dengan profil master guru (*teacher profiles*).
- **Command `CleanDuplicatePendingSks` (`sk:clean-pending`)**: Perintah ini (versi pertama sebelum diupdate lagi tanggal 4) diciptakan pada hari ini untuk membersihkan antrean SK ganda. Logika penghapusannya memastikan bahwa antrean SK yang sudah memiliki *file* atau data permohonan yang valid lebih diprioritaskan untuk dipertahankan, serta memperhatikan pemisahan berdasarkan `tahun_ajaran`.
- **Perbaikan Bug PostgreSQL**: Mengatasi *invalid datetime format error* saat melakukan filter/query pada kolom `tanggal_permohonan` di database PostgreSQL.

---

## Kesimpulan
Pembaruan 3 Juli sukses mengatasi masalah *corrupt document* saat mencetak SK di sisi pengguna akhir (User/Frontend), menertibkan kembali manajemen nomor seri SK, serta menyediakan sarana (Artisan Commands) untuk pemulihan data pasca-insiden duplikasi guru.
