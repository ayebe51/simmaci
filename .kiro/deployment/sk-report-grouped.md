# Laporan SK Per Sekolah - Deployment Guide

## 📋 Ringkasan Perubahan

### Feature: Grouped SK Report by School
**User Request:** Laporan SK yang dikelompokkan per sekolah, bukan per nama guru individual.

**Example:**
- ❌ **Before:** 100+ baris (1 baris per guru)
- ✅ **After:** ~20 baris (1 baris per sekolah dengan total jumlah)

### Changes Made

#### 1. Frontend Changes
- ✅ Created new page: `SkReportGroupedPage.tsx`
- ✅ Added route: `/reports/sk-grouped`
- ✅ Added menu item: "Laporan SK (Per Sekolah)"
- ✅ Features:
  - Group by `unit_kerja` (school) and `kecamatan`
  - Show breakdown by jenis SK (GTY, GTT, Kamad, Tendik)
  - Show breakdown by status (Approved, Pending, Rejected)
  - Excel export with grouped data
  - Print-friendly layout
  - Summary statistics

#### 2. Backend Changes
- ✅ Fixed `ReportController.php` to load `school` relation
- ✅ Changed: `with('teacher')` → `with(['teacher', 'school'])`
- ✅ This enables frontend to access `item.school.kecamatan`

#### 3. Fallback Helper
- ✅ Added `extractKecamatanFromName()` function
- ✅ Extracts kecamatan from school name if `school.kecamatan` is null
- ✅ Supports 22 kecamatan in Cilacap

---

## 🚀 Langkah Deployment

### Step 1: Pull Latest Code
```bash
git pull origin main
```

**Commits:**
- `cdbf8a8` - Initial grouped report feature
- `ed62507` - Fix kecamatan display (load school relation)

### Step 2: Rebuild Frontend
```bash
# Build frontend dengan perubahan terbaru
npm run build

# Atau jika menggunakan Docker/Coolify
# Redeploy frontend service di Coolify dashboard
```

### Step 3: Restart Backend (Optional)
```bash
# Restart backend untuk memuat perubahan controller
docker restart simmaci-backend

# Atau redeploy backend di Coolify dashboard
```

### Step 4: Clear Browser Cache
```bash
# User perlu hard refresh browser
# Windows/Linux: Ctrl + Shift + R
# Mac: Cmd + Shift + R
```

---

## ✅ Verifikasi Deployment

### 1. Verifikasi Menu Baru
1. Login ke aplikasi
2. Buka sidebar menu
3. **Verifikasi:** Ada menu baru "Laporan SK (Per Sekolah)" di section Laporan
4. Klik menu tersebut

### 2. Verifikasi Tampilan Grouped Report
1. Buka "Laporan SK (Per Sekolah)"
2. **Verifikasi tampilan:**
   - ✅ Header: "Laporan Pengajuan SK Per Sekolah"
   - ✅ Filter: Tanggal Mulai, Tanggal Akhir, Status
   - ✅ Summary cards: Total Sekolah, Total Pengajuan, Disetujui, Pending
   - ✅ Tabel dengan kolom:
     - No
     - Tanggal
     - **Kecamatan** (harus terisi, bukan "Tidak Diketahui")
     - Unit Kerja
     - Jumlah Guru
     - Detail (breakdown GTY/GTT/Kamad/Tendik)

### 3. Verifikasi Kecamatan Terisi
1. Lihat kolom "Kecamatan" di tabel
2. **Expected:** Nama kecamatan yang benar (Majenang, Cilacap, Gandrungmanis, dll)
3. **NOT Expected:** "Tidak Diketahui" untuk semua baris

**Jika masih "Tidak Diketahui":**
- Cek apakah backend sudah di-restart/redeploy
- Cek apakah data `schools` table memiliki field `kecamatan` terisi
- Cek browser console untuk error

### 4. Verifikasi Excel Export
1. Klik tombol "Export Excel"
2. **Verifikasi file Excel:**
   - ✅ Nama file: `Rekap_SK_Per_Sekolah_YYYY-MM-DD.xlsx`
   - ✅ Sheet name: "Rekap Per Sekolah"
   - ✅ Kolom: No, Tanggal, Kecamatan, Unit Kerja, Jumlah Pengajuan, GTY, GTT, Kamad, Tendik, Disetujui, Pending, Ditolak
   - ✅ Data sesuai dengan tampilan di web

### 5. Verifikasi Print/PDF
1. Klik tombol "PDF / Print"
2. **Verifikasi preview print:**
   - ✅ Header: "Rekapitulasi Pengajuan SK Per Sekolah"
   - ✅ Subheader: "LP Ma'arif NU Cilacap"
   - ✅ Periode tanggal
   - ✅ Tabel data
   - ✅ Footer dengan tanda tangan (Ketua & Sekretaris)
   - ✅ Filter dan tombol TIDAK muncul di print

---

## 🔧 Troubleshooting

### Kecamatan Masih "Tidak Diketahui"

**Penyebab 1: Backend belum di-restart**
```bash
# Restart backend
docker restart simmaci-backend

# Atau redeploy di Coolify
```

**Penyebab 2: Data `schools` table tidak ada kecamatan**
```bash
# Cek data schools
docker exec -it simmaci-db psql -U sim_user -d sim_maarif -c "SELECT id, nama, kecamatan FROM schools LIMIT 10;"

# Jika kecamatan NULL, update manual atau via migration
```

**Penyebab 3: Browser cache**
```bash
# Hard refresh browser
# Windows/Linux: Ctrl + Shift + R
# Mac: Cmd + Shift + R
```

### Menu Tidak Muncul

**Solusi:**
```bash
# Clear browser cache
# Hard refresh: Ctrl + Shift + R

# Atau rebuild frontend
npm run build
```

### Data Tidak Muncul di Tabel

**Cek:**
1. Apakah ada data SK di database?
2. Apakah filter tanggal terlalu sempit?
3. Cek browser console untuk error API

**Debug:**
```bash
# Cek API response
curl https://simmaci.com/api/reports/sk

# Cek backend logs
docker logs simmaci-backend
```

---

## 📊 Data Structure

### API Response Structure
```json
{
  "summary": {
    "total": 150,
    "approved": 120,
    "pending": 20,
    "rejected": 10
  },
  "byType": {
    "gty": 80,
    "gtt": 50,
    "kamad": 15,
    "tendik": 5
  },
  "data": [
    {
      "id": 1,
      "nomor_sk": "REQ/2026/0001",
      "jenis_sk": "GTY",
      "nama": "Ahmad Fauzi",
      "unit_kerja": "MI Gandrungmanis",
      "status": "approved",
      "created_at": "2026-04-01",
      "teacher": { ... },
      "school": {
        "id": 5,
        "nama": "MI Gandrungmanis",
        "kecamatan": "Gandrungmanis"  // ← This is now loaded!
      }
    }
  ]
}
```

### Grouped Data Structure (Frontend)
```typescript
{
  unit_kerja: "MI Gandrungmanis",
  kecamatan: "Gandrungmanis",  // From school.kecamatan
  total: 10,
  gty: 5,
  gtt: 3,
  kamad: 1,
  tendik: 1,
  approved: 8,
  pending: 2,
  rejected: 0,
  tanggal_awal: "2026-04-01",
  tanggal_akhir: "2026-04-20"
}
```

---

## 🎯 Expected Results

### Before
- ❌ Laporan SK menampilkan 100+ baris (1 baris per guru)
- ❌ Sulit melihat total per sekolah
- ❌ Kecamatan tidak terisi ("Tidak Diketahui")

### After
- ✅ Laporan SK menampilkan ~20 baris (1 baris per sekolah)
- ✅ Mudah melihat total per sekolah
- ✅ Kecamatan terisi dengan benar
- ✅ Breakdown per jenis SK dan status
- ✅ Excel export tersedia
- ✅ Print-friendly layout

---

## 📝 Files Changed

### Frontend
1. `src/features/reports/SkReportGroupedPage.tsx` (new file)
2. `src/App.tsx` (added route)
3. `src/components/layout/AppShell.tsx` (added menu)

### Backend
1. `backend/app/Http/Controllers/Api/ReportController.php` (line 21: load school relation)

---

## 🔐 Security Notes

- ✅ Tidak ada perubahan pada authentication
- ✅ Tidak ada perubahan pada authorization
- ✅ Tenant scoping tetap berfungsi (operator hanya lihat sekolahnya)
- ✅ Tidak ada perubahan database schema

---

## 📞 Support

Jika ada masalah saat deployment:
1. Cek logs: `docker logs simmaci-backend`
2. Cek API: `curl https://simmaci.com/api/reports/sk`
3. Cek browser console untuk error JavaScript
4. Hard refresh browser: Ctrl + Shift + R

---

**Deployment Date:** 2026-04-25
**Version:** 1.2.0
**Status:** Ready for Production ✅

**Commits:**
- `cdbf8a8` - Initial grouped report feature
- `ed62507` - Fix kecamatan display (load school relation)
