# Workflow SK Kepala Madrasah - Panduan Lengkap

## 📋 Ringkasan Workflow

### Alur Pengajuan SK Kepala Madrasah

```
┌─────────────────────────────────────────────────────────────┐
│ 1. PENGAJUAN KEPALA                                         │
│    (Operator/Admin Yayasan)                                 │
│    Menu: Pengajuan Kepala                                   │
│    - Pilih guru yang akan diangkat                          │
│    - Pilih madrasah tujuan                                  │
│    - Isi periode, TMT, nomor surat permohonan               │
│    - Upload scan surat permohonan                           │
│    Status: Pending                                          │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. APPROVAL YAYASAN                                         │
│    (Admin Yayasan/Ketua)                                    │
│    Menu: Approval Yayasan                                   │
│    - Review pengajuan                                       │
│    - Approve atau Reject                                    │
│    Status: Approved / Rejected                              │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. CETAK SK                                                 │
│    (Admin Yayasan)                                          │
│    Menu: Approval Yayasan                                   │
│    - Klik tombol "Cetak SK"                                 │
│    - SK otomatis generate dengan QR code                    │
│    - Download file DOCX                                     │
│    Status: Approved (SK Terbit)                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 Masalah yang Diperbaiki

### Issue: Dropdown Guru Tidak Muncul

**Problem:**
- Di halaman "Pengajuan Kepala", dropdown "Pilih Calon Kepala Guru Tetap" kosong
- User tidak bisa memilih guru
- Dropdown hanya muncul setelah user mengetik di search box

**Root Cause:**
```typescript
// BEFORE (SALAH)
queryFn: () => teacherApi.list({ 
  search: teacherSearch,  // ← Saat pertama load, ini kosong string ""
  is_verified: true, 
  per_page: 50 
})
```

Backend API mungkin tidak mengembalikan data jika `search` parameter kosong string.

**Solution:**
```typescript
// AFTER (BENAR)
queryFn: () => teacherApi.list({ 
  search: teacherSearch || undefined,  // ← Jika kosong, kirim undefined (tidak ada parameter)
  is_verified: true, 
  per_page: 100  // ← Naikkan limit
})
```

**Changes:**
- `search: teacherSearch` → `search: teacherSearch || undefined`
- `per_page: 50` → `per_page: 100`
- Sama untuk `schoolsData` query

---

## 📝 Halaman-Halaman Terkait

### 1. Pengajuan Kepala (`/dashboard/headmaster/submit`)
**File:** `src/features/sk-management/HeadmasterSubmissionPage.tsx`

**Fungsi:**
- Form pengajuan SK Kepala Madrasah
- Pilih guru (dropdown dengan search)
- Pilih madrasah tujuan (dropdown dengan search)
- Isi periode jabatan (1/2/3)
- Isi TMT mulai jabatan
- Isi nomor & tanggal surat permohonan
- Upload scan surat permohonan (PDF)
- Keterangan opsional

**Data yang Disimpan:**
```typescript
{
  teacher_id: number,
  teacher_name: string,
  school_id: number,
  school_name: string,
  periode: string,  // "1", "2", "3"
  start_date: string,  // TMT mulai jabatan
  end_date: string,  // Otomatis +4 tahun
  sk_url: string | null,  // URL scan surat permohonan
  keterangan: string,
  surat_permohonan_number: string,
  surat_permohonan_date: string,
  status: "Pending"
}
```

**Akses:**
- Operator (untuk sekolahnya sendiri)
- Admin Yayasan (untuk semua sekolah)

---

### 2. Approval Yayasan (`/dashboard/approval`)
**File:** `src/features/approval/YayasanApprovalPage.tsx`

**Fungsi:**
- Lihat semua pengajuan SK Kepala
- Approve pengajuan (status → Approved)
- Reject pengajuan (status → Rejected, dengan alasan)
- Generate SK (setelah approved)
- Upload SK final manual (PDF dengan tanda tangan basah)

**Fitur Generate SK:**
- Otomatis generate DOCX dari template
- Isi semua field template dengan data guru & sekolah
- Generate QR code untuk verifikasi
- Format nomor SK otomatis
- Download file DOCX

**Akses:**
- Admin Yayasan
- Ketua Yayasan

---

## ✅ Verifikasi Setelah Fix

### 1. Test Dropdown Guru
1. Login sebagai operator atau admin yayasan
2. Buka menu: **Pengajuan Kepala**
3. Klik dropdown: **"Pilih Calon Kepala Guru Tetap"**
4. **Expected:** Dropdown langsung menampilkan daftar guru (tanpa perlu ketik)
5. **Expected:** Bisa search dengan mengetik nama guru
6. **Expected:** Menampilkan nama guru + unit kerja

### 2. Test Dropdown Madrasah
1. Klik dropdown: **"Madrasah Tujuan (Tempat Menjabat)"**
2. **Expected:** Dropdown langsung menampilkan daftar madrasah
3. **Expected:** Bisa search dengan mengetik nama madrasah

### 3. Test Submit Pengajuan
1. Pilih guru dari dropdown
2. Pilih madrasah tujuan
3. Pilih periode: "Periode Ke-1 (4 Tahun)"
4. Isi TMT mulai jabatan
5. Isi nomor & tanggal surat permohonan (opsional)
6. Upload scan surat permohonan (opsional)
7. Klik **"Simpan Pengajuan"**
8. **Expected:** Toast success: "Pengajuan Kepala Madrasah Berhasil!"
9. **Expected:** Redirect ke dashboard SK

### 4. Test Approval
1. Login sebagai admin yayasan
2. Buka menu: **Approval Yayasan**
3. **Expected:** Melihat pengajuan yang baru dibuat
4. **Expected:** Status: "Pending"
5. Klik tombol **"Approve"**
6. **Expected:** Status berubah menjadi "Approved"

### 5. Test Generate SK
1. Di halaman Approval Yayasan
2. Cari pengajuan dengan status "Approved"
3. Isi **"Format & Penomoran Kolektif"**:
   - Penomoran: `0001`
   - Format: `{NOMOR}/PC.L/A.II/H-34.B/{BULAN}/{TAHUN}`
   - Tanggal Penetapan: pilih tanggal
   - Tahun Ajaran: `2025/2026`
4. Klik tombol **"Cetak SK"**
5. **Expected:** Toast loading: "Menyiapkan Dokumen..."
6. **Expected:** File DOCX otomatis download
7. **Expected:** File berisi:
   - Nama guru
   - NIP
   - Tempat, tanggal lahir
   - Nomor Induk Ma'arif
   - Pendidikan
   - Unit Kerja (madrasah)
   - TMT (TMT sebagai guru, bukan TMT sebagai kepala)
   - Tanggal penetapan
   - Nomor SK
   - QR code untuk verifikasi
   - Nomor & tanggal surat permohonan

---

## 🔧 Troubleshooting

### Dropdown Guru Masih Kosong

**Penyebab 1: Frontend belum rebuild**
```bash
# Rebuild frontend
npm run build

# Atau redeploy di Coolify
```

**Penyebab 2: Browser cache**
```bash
# Hard refresh
# Windows/Linux: Ctrl + Shift + R
# Mac: Cmd + Shift + R
```

**Penyebab 3: Backend API issue**
```bash
# Test API langsung
curl https://simmaci.com/api/teachers?is_verified=true&per_page=100

# Expected: Array of teachers
```

**Penyebab 4: Tidak ada guru verified**
```bash
# Cek database
docker exec -it simmaci-db psql -U sim_user -d sim_maarif -c "SELECT COUNT(*) FROM teachers WHERE is_verified = true;"

# Jika 0, perlu verify guru dulu
```

---

### Generate SK Gagal

**Error: "Template SK tidak ditemukan"**
- Template belum diupload di menu **Template SK**
- Upload template DOCX dengan placeholder: `{NAMA}`, `{NIP}`, `{TMT}`, dll.

**Error: Field kosong di SK**
- Data guru tidak lengkap (tempat_lahir, tanggal_lahir, dll.)
- Update data guru di menu **Master Guru**

**Error: QR Code tidak muncul**
- Template harus punya placeholder: `{%qrcode}`
- Bukan `{qrcode}` (tanpa %)

---

### Approval Tidak Muncul

**Penyebab:**
- User bukan admin yayasan
- Pengajuan belum dibuat
- Status pengajuan sudah approved/rejected

**Debug:**
```bash
# Cek data headmaster_tenures
docker exec -it simmaci-db psql -U sim_user -d sim_maarif -c "SELECT * FROM headmaster_tenures ORDER BY created_at DESC LIMIT 5;"
```

---

## 📊 Data Flow

### Database Tables

#### `headmaster_tenures`
```sql
CREATE TABLE headmaster_tenures (
  id SERIAL PRIMARY KEY,
  teacher_id INTEGER REFERENCES teachers(id),
  teacher_name VARCHAR(255),
  school_id INTEGER REFERENCES schools(id),
  school_name VARCHAR(255),
  periode VARCHAR(10),  -- "1", "2", "3"
  start_date DATE,  -- TMT mulai jabatan
  end_date DATE,  -- Otomatis +4 tahun
  status VARCHAR(50) DEFAULT 'Pending',  -- Pending, Approved, Rejected
  sk_url TEXT,  -- URL scan surat permohonan atau SK final
  keterangan TEXT,
  surat_permohonan_number VARCHAR(255),
  surat_permohonan_date VARCHAR(255),
  rejection_reason TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### API Endpoints

#### 1. List Headmaster Tenures
```
GET /api/headmasters
Response: { data: [...], meta: {...} }
```

#### 2. Create Headmaster Tenure
```
POST /api/headmasters
Body: {
  teacher_id, teacher_name, school_id, school_name,
  periode, start_date, end_date, sk_url, keterangan,
  surat_permohonan_number, surat_permohonan_date
}
Response: { success: true, data: {...} }
```

#### 3. Approve Headmaster Tenure
```
POST /api/headmasters/{id}/approve
Body: { nomor_sk, tanggal_penetapan }
Response: { success: true, message: "..." }
```

#### 4. Reject Headmaster Tenure
```
POST /api/headmasters/{id}/reject
Body: { rejection_reason }
Response: { success: true, message: "..." }
```

#### 5. Update Headmaster Tenure
```
PUT /api/headmasters/{id}
Body: { sk_url, status, ... }
Response: { success: true, data: {...} }
```

---

## 🎯 Expected Results

### Before Fix
- ❌ Dropdown guru kosong saat pertama load
- ❌ User harus ketik dulu baru muncul data
- ❌ Pengalaman user buruk

### After Fix
- ✅ Dropdown guru langsung menampilkan data
- ✅ User bisa langsung pilih tanpa ketik
- ✅ Search tetap berfungsi untuk filter
- ✅ Dropdown madrasah juga langsung muncul
- ✅ Pengalaman user lebih baik

---

## 📝 Files Changed

### Frontend
1. `src/features/sk-management/HeadmasterSubmissionPage.tsx`
   - Fixed teacher query: `search: teacherSearch || undefined`
   - Fixed school query: `search: schoolSearch || undefined`
   - Increased per_page: 50 → 100

---

## 🔐 Security Notes

- ✅ Tidak ada perubahan pada authentication
- ✅ Tidak ada perubahan pada authorization
- ✅ Tenant scoping tetap berfungsi
- ✅ Tidak ada perubahan backend/database
- ✅ Pure frontend fix

---

## 💡 Workflow Summary

### Untuk Operator Sekolah:
1. Buka menu **"Pengajuan Kepala"**
2. Pilih guru dari sekolah sendiri
3. Pilih madrasah tujuan (biasanya sekolah sendiri)
4. Isi form lengkap
5. Submit pengajuan
6. Tunggu approval dari yayasan

### Untuk Admin Yayasan:
1. Buka menu **"Approval Yayasan"**
2. Review pengajuan yang masuk
3. Approve atau Reject
4. Jika approved, klik **"Cetak SK"**
5. Download SK DOCX
6. Print, tanda tangan basah
7. Upload SK final (opsional)

---

## 📞 Support

Jika ada masalah:
1. Hard refresh browser: Ctrl + Shift + R
2. Cek browser console untuk error
3. Verifikasi frontend sudah rebuild
4. Test API endpoint langsung
5. Cek database untuk data guru

---

**Deployment Date:** 2026-04-25
**Version:** 1.4.0
**Status:** Ready for Production ✅

**Commit:**
- `082dea5` - Fix teacher dropdown not showing in headmaster submission - load all teachers on mount
