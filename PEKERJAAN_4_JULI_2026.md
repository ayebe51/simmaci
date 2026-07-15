# Dokumentasi Pekerjaan - 4 Juli 2026

## Ringkasan
Pada tanggal 4 Juli 2026, fokus pekerjaan adalah pada perbaikan integritas data, khususnya terkait pengelolaan Surat Keputusan (SK), penanganan duplikasi data guru antar sekolah, serta perbaikan data `unit_kerja`. Sejumlah script PHP *standalone* dan command Laravel/Artisan dibuat atau diperbarui untuk mendiagnosis dan memperbaiki masalah-masalah korupsi data tersebut.

## Detail Pekerjaan

### 1. Deteksi Duplikasi & Korupsi Data Lintas Sekolah
Beberapa script dibuat khusus untuk mengidentifikasi masalah data ganda dan korupsi relasi data lintas institusi sekolah:
- **`backend/check_cross_school.php`**: Script untuk mendeteksi dan mengecek adanya korupsi pada data SK lintas sekolah.
- **`backend/check_cross_school2.php`**: Script untuk mengecek jumlah / perhitungan presisi terkait data lintas sekolah.
- **`backend/check_ganda.php`**: Script untuk mendeteksi nama guru yang terduplikasi atau tercatat ganda pada lebih dari satu sekolah.

### 2. Penanganan SK Gagal (Failed), Terhapus, dan Revert Nama SK
- **`backend/force_fix_failed.php`**: Script untuk mengeksekusi perbaikan paksa (*force fix*) terhadap dokumen-dokumen SK yang berstatus gagal diproses.
- **`backend/check_deleted_sk.php`**: Script untuk meninjau atau memvalidasi data SK yang sebelumnya terhapus.
- **`backend/revert_sk_names.php`**: Script *temporary* untuk melakukan revert atau mengembalikan perubahan nama pada SK ke versi yang seharusnya.

### 3. Pembaruan Command Laravel (Console/Commands)
- **Pembaruan Logika Deduplikasi (`CleanDuplicatePendingSks.php` & `RestoreTeacherData.php`)**: Menambahkan kriteria pengecekan `school_id` saat melakukan penghapusan atau restorasi duplikat. Hal ini mencegah terjadinya *false positive* dimana sistem secara keliru menghapus data karena kriteria yang kurang spesifik.
- **Sinkronisasi Unit Kerja (`SyncSkUnitKerja.php`)**: Membuat command baru untuk menstandarisasi dan memperbaiki kesesuaian nama `unit_kerja` yang tertera pada entitas `sk_documents`.

### 4. Perbaikan Spesifik per Sekolah (Targeted Fixes)
- **`backend/check_pucung_lor.php`**: Script untuk pengecekan dan audit data spesifik pada institusi Pucung Lor sejalan dengan sinkronisasi *unit_kerja*.
- **`backend/fix_mts_gandrungmangu.php`**: Script khusus yang dirancang sementara waktu untuk memperbaiki anomali data yang ada di MTs Gandrungmangu.

## Catatan
- Sebagian besar script perbaikan berstatus sementara (*temporary* atau *standalone* scripts) dan disimpan di dalam folder root `backend/`.
- Perbaikan command Artisan memastikan pencegahan duplikasi data di masa mendatang menjadi lebih aman berkat adanya filter `school_id`.
