# Panduan Analisis Data Guru yang Tidak Terhubung dengan Sekolah (SIMMACI)

Dokumen ini berisi panduan teknis dan operasional untuk menganalisis dan mendiagnosis data guru di SIMMACI yang **tidak terhubung dengan sekolahnya** (atau memiliki masalah relasi dengan master data sekolah).

---

## 1. Penyebab Umum Masalah Relasi Guru & Sekolah

Di sistem SIMMACI, seorang guru terhubung ke sekolah melalui kolom `school_id` pada tabel `teachers` yang berelasi ke `id` pada tabel `schools`.

Ketidakterhubungan ini umumnya terjadi karena beberapa skenario:
1. **Hasil Import Massal (Bulk Import Excel/CSV)**:
   File import historis sering kali hanya menyertakan nama instansi dalam bentuk teks string bebas di kolom `unit_kerja`, namun belum dipetakan ke ID sekolah di database (`school_id` bernilai `NULL`).
2. **Pendaftaran / Input Data Tanpa Memilih Sekolah**:
   Pengisian form atau integrasi luar di mana `school_id` dikosongkan dan `unit_kerja` tidak diisi (kondisi *Yatim Piatu*).
3. **Sekolah Induk Berstatus Soft-Deleted**:
   Data guru memiliki `school_id`, tetapi sekolah induknya telah dihapus (soft-delete). Akibatnya, pada tampilan admin dan API, guru tampak tidak memiliki sekolah karena query default Eloquent menyembunyikan sekolah yang terhapus.
4. **Data Rusak / Orphan Record**:
   `school_id` terisi sebuah angka ID, tetapi ID tersebut tidak ada sama sekali di tabel `schools` (misal akibat *hard delete* manual atau dump database parsial).
5. **Mismatch Nama Unit Kerja vs Nama Sekolah**:
   Guru terhubung ke Sekolah A (`school_id`), tetapi teks pada kolom `unit_kerja` menyebutkan Sekolah B (indikasi salah pilih saat input atau mutasi guru yang belum disinkronkan).

---

## 2. Kategori yang Dianalisis oleh Script

Script diagnosa mengklasifikasikan data ke dalam 6 kategori:

| Kategori | Kondisi Database | Dampak & Tindakan |
|---|---|---|
| **1. Terhubung Normal** | `school_id IS NOT NULL` dan sekolah aktif | Data normal dan aman. |
| **2. NULL dengan Unit Kerja** | `school_id IS NULL`, tapi `unit_kerja` terisi | Siap dicocokkan otomatis (*smart matching*) ke master sekolah. |
| **3. Yatim Piatu** | `school_id IS NULL` dan `unit_kerja` kosong | Kritis. Perlu verifikasi manual melalui biodata guru / berkas. |
| **4. Orphan School ID** | `school_id` mengarah ke ID sekolah yang tidak ada | Kritis. ID sekolah lama rusak/hilang, perlu dipetakan ulang. |
| **5. Sekolah Terhapus** | `school_id` mengarah ke sekolah *soft-deleted* | Waspada. Pulihkan data sekolah atau mutasikan guru ke sekolah aktif. |
| **6. Potensi Mismatch** | `unit_kerja` ≠ `schools.nama` terhubung | Perlu ditinjau apakah guru telah mutasi atau salah penautan. |

---

## 3. Opsi Menjalankan Script

Tersedia **4 metode** yang dapat dipilih sesuai lingkungan kerja Anda:

### Opsi A: Menggunakan Artisan Command (Paling Lengkap & Direkomendasikan)

Artisan command dilengkapi fitur analisis dampak SK, pencocokan cerdas (*fuzzy matching*), ekspor ke CSV, dan opsi *auto-link*.

Masuk ke direktori `backend`:
```bash
cd backend
```

**1. Menampilkan ringkasan:**
```bash
php artisan teachers:analyze-unlinked
```

**2. Menampilkan rincian guru per baris di terminal:**
```bash
php artisan teachers:analyze-unlinked --details
```

**3. Menjalankan analisis pencocokan cerdas (*Smart Match*):**
```bash
php artisan teachers:analyze-unlinked --details --match
```

**4. Mengekspor hasil analisis ke file CSV (dapat dibuka di Excel):**
```bash
php artisan teachers:analyze-unlinked --match --csv=storage/guru_tanpa_sekolah.csv
```

**5. Simulasi penautan otomatis (*Dry Run* - Aman tanpa mengubah database):**
```bash
php artisan teachers:analyze-unlinked --auto-link --dry-run
```

**6. Terapkan penautan otomatis secara permanen ke database:**
```bash
php artisan teachers:analyze-unlinked --auto-link
```
*(Hanya menautkan guru yang nama unit kerjanya memiliki kemiripan minimal 85% atau cocok sempurna)*

---

### Opsi B: Menggunakan Bash Script di VPS / Docker / Coolify (Zero Downtime)

Jika aplikasi berjalan di server VPS dalam kontainer Docker:

```bash
# Dari root project di VPS:
bash diagnose-unlinked-teachers.sh
```

Argumen tambahan yang didukung:
```bash
# Tampilkan rincian data guru:
bash diagnose-unlinked-teachers.sh --details

# Tampilkan saran pencocokan sekolah:
bash diagnose-unlinked-teachers.sh --details --match

# Simulasi auto-link:
bash diagnose-unlinked-teachers.sh --auto-link --dry-run

# Terapkan auto-link:
bash diagnose-unlinked-teachers.sh --auto-link

# Export ke file CSV di storage container:
bash diagnose-unlinked-teachers.sh --csv=storage/guru_tanpa_sekolah.csv
```

Skrip ini otomatis mendeteksi kontainer backend (`simmaci-backend`, `backend`, atau `app`), menyinkronkan file script terbaru, dan membersihkan cache.

---

### Opsi C: Menggunakan Standalone PHP Script

Dapat dijalankan langsung dengan interpreter PHP tanpa harus memanggil artisan:

```bash
# Dari root project:
php scripts/analyze-unlinked-teachers.php
```

Atau di dalam Docker:
```bash
docker exec -i $(docker ps -qf "name=backend") php scripts/analyze-unlinked-teachers.php
```

---

### Opsi D: Menggunakan SQL Query Langsung (PostgreSQL / DBeaver / pgAdmin)

Buka file [`scripts/analyze-unlinked-teachers.sql`](file:///d:/apss-source/SIMMACI/scripts/analyze-unlinked-teachers.sql) di client database favorit Anda, atau jalankan via terminal `psql`:

```bash
# Masuk ke terminal PostgreSQL di VPS:
docker exec -i $(docker ps -qf "name=postgres") psql -U sim_user -d sim_maarif -f scripts/analyze-unlinked-teachers.sql
```

Query SQL di file tersebut mencakup:
1. Ringkasan jumlah dan persentase per kategori relasi.
2. Daftar guru `school_id NULL` beserta join pencocokan otomatis ke `schools.nama`.
3. Daftar guru yatim piatu.
4. Daftar guru orphan dan sekolah terhapus.
5. Deteksi mismatch nama.
6. Rekapitulasi dampak dokumen SK.

---

## 4. Rekomendasi Alur Penyelesaian

1. **Jalankan Diagnosa Awal**:
   ```bash
   php artisan teachers:analyze-unlinked --details --match
   ```
2. **Ekspor Hasil ke Tim Pendataan / Admin**:
   ```bash
   php artisan teachers:analyze-unlinked --match --csv=storage/analisis_guru.csv
   ```
3. **Tautkan Data yang Cocok Sempurna / Kemiripan Tinggi**:
   Jalankan uji coba terlebih dahulu:
   ```bash
   php artisan teachers:analyze-unlinked --auto-link --dry-run
   ```
   Jika hasil tinjauan sudah sesuai, eksekusi pembaruan data:
   ```bash
   php artisan teachers:analyze-unlinked --auto-link
   ```
4. **Tangani Sisa Kasus Manual**:
   Untuk guru yatim piatu (`school_id NULL` & `unit_kerja NULL`), buka panel admin Filament SIMMACI pada menu **Data GTK** untuk menetapkan sekolah induk yang tepat secara manual.
