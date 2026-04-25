# SK Kepala Madrasah - Deployment Guide

## 📋 Ringkasan Perubahan

### 1. Frontend Changes
- ✅ Hapus opsi "SK Kepala Madrasah" dari `SkSubmissionPage`
- ✅ Hapus filter "SK Kamad" dari `SkDashboardPage`
- ✅ Lengkapi data merge di `YayasanApprovalPage` untuk generate SK
- ✅ Ubah alert period dari 90 hari → 180 hari (6 bulan)

### 2. Backend Changes
- ✅ Tambah 3 field baru ke tabel `headmaster_tenures`
- ✅ Update model `HeadmasterTenure` fillable
- ✅ Update controller validation
- ✅ Ubah alert period dari 90 hari → 180 hari

---

## 🚀 Langkah Deployment

### Step 1: Backup Database
```bash
# Backup database sebelum migration
docker exec simmaci-db pg_dump -U sim_user sim_maarif > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Step 2: Pull Latest Code
```bash
git pull origin main
```

### Step 3: Run Migration
```bash
# Masuk ke container backend
docker exec -it simmaci-backend bash

# Jalankan migration
php artisan migrate

# Verifikasi migration berhasil
php artisan migrate:status

# Keluar dari container
exit
```

### Step 4: Rebuild Frontend
```bash
# Build frontend dengan perubahan terbaru
npm run build

# Atau jika menggunakan Docker
docker exec -it simmaci-frontend npm run build
```

### Step 5: Restart Services (Optional)
```bash
# Restart backend untuk memastikan perubahan diterapkan
docker restart simmaci-backend

# Restart frontend
docker restart simmaci-frontend
```

---

## ✅ Verifikasi Deployment

### 1. Verifikasi Database Migration
```bash
docker exec -it simmaci-db psql -U sim_user -d sim_maarif -c "\d headmaster_tenures"
```

**Expected Output:**
```
Column                      | Type
----------------------------+----------
surat_permohonan_number     | varchar  ✅
surat_permohonan_date       | varchar  ✅
keterangan                  | text     ✅
```

### 2. Verifikasi Frontend - SkSubmissionPage
1. Login ke aplikasi
2. Buka menu "Ajukan SK Baru"
3. **Verifikasi:** Dropdown jenis SK TIDAK ada "SK Kepala Madrasah"
4. **Verifikasi:** Ada pesan: "Untuk SK Kepala Madrasah, gunakan menu 'Pengajuan Kepala' di Manajemen SDM"

### 3. Verifikasi Frontend - SkDashboardPage
1. Buka menu "Manajemen SK Digital"
2. Klik dropdown filter "Jenis SK"
3. **Verifikasi:** Filter berisi:
   - Semua Jenis
   - SK GTY
   - SK GTT
   - SK Tendik (baru ditambahkan)
4. **Verifikasi:** TIDAK ada "SK Kamad"

### 4. Verifikasi Generate SK Kepala
1. Login sebagai admin yayasan
2. Buka menu "Approval Yayasan"
3. Approve pengajuan SK Kepala
4. Klik tombol "Cetak SK"
5. **Verifikasi field di dokumen:**
   - ✅ {NAMA} - Terisi
   - ✅ {NIP} - Terisi
   - ✅ {TEMPAT, TANGGAL LAHIR} - Terisi (format Indonesia)
   - ✅ {NOMOR INDUK MA'ARIF} - Terisi
   - ✅ {PENDIDIKAN} - Terisi
   - ✅ {UNIT KERJA} - Terisi
   - ✅ **{TMT} - Terisi dengan TMT GURU** (bukan TMT Kepala)
   - ✅ {TANGGAL PENETAPAN} - Terisi (format Indonesia)
   - ✅ {NOMOR} - Terisi lengkap
   - ✅ {BULAN} - Terisi
   - ✅ {TAHUN} - Terisi
   - ✅ {KECAMATAN} - Terisi
   - ✅ {NOMOR SURAT PERMOHONAN} - Terisi
   - ✅ {TANGGAL SURAT PERMOHONAN} - Terisi

### 5. Verifikasi Alert 6 Bulan
1. Buka menu "Monitoring Kepala"
2. **Verifikasi:** Deskripsi menampilkan "≤ 6 Bulan (180 Hari)"
3. **Verifikasi:** Hanya kepala dengan sisa masa jabatan ≤ 180 hari yang muncul

---

## 🔧 Troubleshooting

### Migration Error: "Table already exists"
```bash
# Rollback migration terakhir
docker exec -it simmaci-backend php artisan migrate:rollback --step=1

# Jalankan ulang
docker exec -it simmaci-backend php artisan migrate
```

### Field Tidak Muncul di Form
```bash
# Clear cache
docker exec -it simmaci-backend php artisan cache:clear
docker exec -it simmaci-backend php artisan config:clear
```

### Generate SK Masih Ada Field Kosong
1. Pastikan data teacher memiliki field lengkap (tmt, tempat_lahir, tanggal_lahir, dll)
2. Cek console browser untuk error JavaScript
3. Verifikasi API response dari `/api/headmasters`

---

## 📊 Data Migration Impact

### Tabel yang Diubah
- `headmaster_tenures` - Tambah 3 kolom baru

### Data Existing
- ✅ Data existing TIDAK terpengaruh
- ✅ Field baru nullable, tidak wajib diisi
- ✅ Tidak ada data loss

### Rollback Plan
```bash
# Jika perlu rollback
docker exec -it simmaci-backend php artisan migrate:rollback --step=1
```

---

## 🎯 Expected Results

### Before
- ❌ "SK Kepala Madrasah" ada di dropdown SkSubmissionPage
- ❌ Generate SK Kepala banyak field kosong
- ❌ TMT di SK Kepala tidak jelas (guru atau kepala?)
- ❌ Alert muncul 90 hari sebelum berakhir

### After
- ✅ "SK Kepala Madrasah" hanya di HeadmasterSubmissionPage
- ✅ Generate SK Kepala semua field terisi lengkap
- ✅ TMT di SK Kepala = TMT Guru (jelas dan konsisten)
- ✅ Alert muncul 6 bulan sebelum berakhir

---

## 📝 Files Changed

### Frontend
1. `src/features/sk-management/SkSubmissionPage.tsx`
2. `src/features/sk-management/SkDashboardPage.tsx`
3. `src/features/approval/YayasanApprovalPage.tsx`
4. `src/features/monitoring/HeadmasterExpiryPage.tsx`

### Backend
1. `backend/app/Models/HeadmasterTenure.php`
2. `backend/app/Http/Controllers/Api/HeadmasterController.php`
3. `backend/database/migrations/2026_04_25_034706_add_additional_fields_to_headmaster_tenures_table.php`

---

## 🔐 Security Notes

- ✅ Tidak ada perubahan pada authentication
- ✅ Tidak ada perubahan pada authorization
- ✅ Tidak ada perubahan pada tenant scoping
- ✅ Migration aman untuk production

---

## 📞 Support

Jika ada masalah saat deployment:
1. Cek logs: `docker logs simmaci-backend`
2. Cek database: `docker exec -it simmaci-db psql -U sim_user -d sim_maarif`
3. Rollback jika perlu: `php artisan migrate:rollback --step=1`

---

**Deployment Date:** 2026-04-25
**Version:** 1.1.0
**Status:** Ready for Production ✅
