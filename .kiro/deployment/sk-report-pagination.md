# Paginasi Laporan SK (Detail) - Deployment Guide

## 📋 Ringkasan Perubahan

### Feature: Pagination for SK Report Detail Page
**User Request:** Tambahkan paginasi pada halaman "Laporan SK (Detail)" yang menampilkan data per guru individual.

**Problem:**
- Halaman menampilkan semua data sekaligus (100+ baris)
- Scroll panjang, sulit navigasi
- Performance issue saat data banyak

**Solution:**
- Tambahkan paginasi dengan kontrol lengkap
- Default 20 item per halaman
- Opsi: 10, 20, 50, 100 item per halaman
- Navigasi: Awal, Prev, Next, Akhir
- Info: "Menampilkan X - Y dari Z data"

---

## ✨ Fitur Paginasi

### 1. Kontrol Paginasi
- **Items per page selector**: Dropdown untuk memilih jumlah data per halaman
  - 10 / hal
  - 20 / hal (default)
  - 50 / hal
  - 100 / hal

### 2. Navigasi Halaman
- **Awal**: Langsung ke halaman pertama
- **Prev**: Halaman sebelumnya
- **Next**: Halaman berikutnya
- **Akhir**: Langsung ke halaman terakhir
- **Info halaman**: "Hal X / Y"

### 3. Info Data
- Menampilkan: "Menampilkan 1 - 20 dari 150 data"
- Update otomatis saat navigasi atau filter berubah

### 4. Auto Reset
- Saat filter berubah (tanggal, status, sekolah), otomatis kembali ke halaman 1
- Mencegah user melihat halaman kosong setelah filter

---

## 🎯 Perubahan Kode

### File Changed
- `src/features/reports/SkReportPageSimple.tsx`

### Changes Made

#### 1. State Management
```typescript
// Pagination state
const [currentPage, setCurrentPage] = useState(1)
const [itemsPerPage, setItemsPerPage] = useState(20)
```

#### 2. Pagination Logic
```typescript
// Paginated data
const paginatedData = useMemo(() => {
  if (!reportData?.data) return []
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  return reportData.data.slice(startIndex, endIndex)
}, [reportData?.data, currentPage, itemsPerPage])

// Total pages calculation
const totalPages = useMemo(() => {
  if (!reportData?.data) return 0
  return Math.ceil(reportData.data.length / itemsPerPage)
}, [reportData?.data, itemsPerPage])
```

#### 3. Auto Reset on Filter Change
```typescript
const handleFilterChange = () => {
  setCurrentPage(1)
}

// Applied to all filter inputs
onChange={e => { setStartDate(e.target.value); handleFilterChange() }}
```

#### 4. Pagination UI
- Header bar dengan info dan kontrol
- Items per page selector
- Navigation buttons (Awal, Prev, Next, Akhir)
- Current page indicator

---

## 🚀 Langkah Deployment

### Step 1: Pull Latest Code
```bash
git pull origin main
```

**Commit:**
- `dbbcc5c` - Add pagination to SK report detail page

### Step 2: Rebuild Frontend
```bash
# Build frontend
npm run build

# Atau redeploy di Coolify
# Frontend service → Redeploy
```

### Step 3: Clear Browser Cache
```bash
# User perlu hard refresh
# Windows/Linux: Ctrl + Shift + R
# Mac: Cmd + Shift + R
```

---

## ✅ Verifikasi Deployment

### 1. Akses Halaman Laporan
1. Login ke aplikasi: `https://simmaci.com`
2. Buka menu: **Laporan → Laporan SK (Detail)**
3. Atau: **Pusat Data & Laporan SK**

### 2. Verifikasi Paginasi UI
**Expected:**
- ✅ Header bar di atas tabel dengan:
  - Info: "Menampilkan 1 - 20 dari X data"
  - Dropdown: "20 / hal" (default)
  - Tombol: Awal, Prev, Next, Akhir
  - Info: "Hal 1 / Y"

### 3. Test Navigasi
1. **Klik "Next"**
   - Tabel menampilkan data 21-40
   - Info update: "Menampilkan 21 - 40 dari X data"
   - Nomor urut update: 21, 22, 23, ...

2. **Klik "Akhir"**
   - Langsung ke halaman terakhir
   - Tombol "Next" dan "Akhir" disabled

3. **Klik "Prev"**
   - Kembali ke halaman sebelumnya

4. **Klik "Awal"**
   - Kembali ke halaman 1

### 4. Test Items Per Page
1. **Ubah ke "10 / hal"**
   - Tabel menampilkan 10 data
   - Total halaman bertambah
   - Otomatis reset ke halaman 1

2. **Ubah ke "50 / hal"**
   - Tabel menampilkan 50 data
   - Total halaman berkurang

3. **Ubah ke "100 / hal"**
   - Tabel menampilkan 100 data

### 5. Test Auto Reset
1. **Ubah filter tanggal**
   - Paginasi otomatis reset ke halaman 1
   - Data update sesuai filter

2. **Ubah filter status**
   - Paginasi otomatis reset ke halaman 1

3. **Ubah filter sekolah** (untuk super admin)
   - Paginasi otomatis reset ke halaman 1

---

## 🔧 Troubleshooting

### Paginasi Tidak Muncul

**Penyebab 1: Browser cache**
```bash
# Hard refresh
# Windows/Linux: Ctrl + Shift + R
# Mac: Cmd + Shift + R
```

**Penyebab 2: Frontend belum rebuild**
```bash
# Rebuild frontend
npm run build

# Atau redeploy di Coolify
```

### Nomor Urut Tidak Benar

**Expected behavior:**
- Halaman 1: No. 1, 2, 3, ..., 20
- Halaman 2: No. 21, 22, 23, ..., 40
- Halaman 3: No. 41, 42, 43, ..., 60

**Jika nomor selalu 1-20:**
- Cek kode: `{((currentPage - 1) * itemsPerPage) + i + 1}`
- Pastikan `currentPage` dan `itemsPerPage` state bekerja

### Tombol Disabled Tidak Bekerja

**Expected:**
- Halaman 1: "Awal" dan "Prev" disabled
- Halaman terakhir: "Next" dan "Akhir" disabled

**Debug:**
```typescript
console.log('Current page:', currentPage)
console.log('Total pages:', totalPages)
```

### Data Tidak Update Saat Navigasi

**Cek:**
1. `paginatedData` useMemo dependency: `[reportData?.data, currentPage, itemsPerPage]`
2. State `currentPage` update dengan benar
3. Browser console untuk error

---

## 📊 Technical Details

### Pagination Algorithm
```typescript
// Calculate start and end index
const startIndex = (currentPage - 1) * itemsPerPage
const endIndex = startIndex + itemsPerPage

// Slice data
const paginatedData = reportData.data.slice(startIndex, endIndex)

// Calculate total pages
const totalPages = Math.ceil(totalItems / itemsPerPage)
```

### Example Calculation
**Scenario:** 150 total items, 20 items per page

| Page | Start Index | End Index | Items Shown | Display |
|------|-------------|-----------|-------------|---------|
| 1    | 0           | 20        | 1-20        | "Menampilkan 1 - 20 dari 150 data" |
| 2    | 20          | 40        | 21-40       | "Menampilkan 21 - 40 dari 150 data" |
| 3    | 40          | 60        | 41-60       | "Menampilkan 41 - 60 dari 150 data" |
| ...  | ...         | ...       | ...         | ... |
| 8    | 140         | 160       | 141-150     | "Menampilkan 141 - 150 dari 150 data" |

**Total pages:** `Math.ceil(150 / 20) = 8 pages`

---

## 🎨 UI/UX Improvements

### Before (No Pagination)
```
┌─────────────────────────────────────────┐
│ Tabel SK (150 baris)                    │
│ ┌─────────────────────────────────────┐ │
│ │ 1. Ahmad Fauzi                      │ │
│ │ 2. Siti Aminah                      │ │
│ │ 3. Budi Santoso                     │ │
│ │ ...                                 │ │
│ │ 148. Rina Wati                      │ │
│ │ 149. Agus Setiawan                  │ │
│ │ 150. Dewi Lestari                   │ │
│ └─────────────────────────────────────┘ │
│ ↓ Scroll panjang                        │
└─────────────────────────────────────────┘
```

### After (With Pagination)
```
┌─────────────────────────────────────────────────────────┐
│ Menampilkan 1-20 dari 150 | [20/hal▼] [Awal][‹][1/8][›][Akhir] │
├─────────────────────────────────────────────────────────┤
│ Tabel SK (20 baris)                                     │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 1. Ahmad Fauzi                                      │ │
│ │ 2. Siti Aminah                                      │ │
│ │ ...                                                 │ │
│ │ 20. Dewi Lestari                                    │ │
│ └─────────────────────────────────────────────────────┘ │
│ ✓ Tidak perlu scroll panjang                            │
│ ✓ Navigasi mudah                                        │
│ ✓ Performance lebih baik                                │
└─────────────────────────────────────────────────────────┘
```

---

## 🎯 Expected Results

### Before
- ❌ Menampilkan semua data sekaligus (100+ baris)
- ❌ Scroll panjang, sulit navigasi
- ❌ Performance issue saat data banyak
- ❌ Sulit mencari data spesifik

### After
- ✅ Menampilkan 20 data per halaman (default)
- ✅ Navigasi mudah dengan tombol Prev/Next
- ✅ Opsi ubah jumlah item per halaman (10/20/50/100)
- ✅ Info jelas: "Menampilkan X - Y dari Z data"
- ✅ Auto reset ke halaman 1 saat filter berubah
- ✅ Performance lebih baik (render lebih sedikit data)
- ✅ Nomor urut konsisten di semua halaman

---

## 📝 Files Changed

### Frontend
1. `src/features/reports/SkReportPageSimple.tsx`
   - Added pagination state
   - Added pagination logic (useMemo)
   - Added pagination UI
   - Added auto reset on filter change

---

## 🔐 Security Notes

- ✅ Tidak ada perubahan pada authentication
- ✅ Tidak ada perubahan pada authorization
- ✅ Tenant scoping tetap berfungsi
- ✅ Tidak ada perubahan backend/database
- ✅ Pure frontend pagination (client-side)

---

## 📞 Support

Jika ada masalah:
1. Hard refresh browser: Ctrl + Shift + R
2. Cek browser console untuk error
3. Verifikasi frontend sudah rebuild
4. Cek network tab untuk API response

---

## 💡 Future Improvements (Optional)

### Server-Side Pagination
Saat ini menggunakan client-side pagination (semua data di-fetch, lalu di-slice di frontend).

**Untuk data yang sangat besar (1000+ records), pertimbangkan:**
1. Backend pagination di `ReportController.php`
2. API parameter: `?page=1&per_page=20`
3. Response: `{ data: [...], meta: { current_page, total_pages, total_items } }`
4. Frontend fetch data per halaman

**Benefit:**
- Lebih cepat (fetch hanya data yang ditampilkan)
- Lebih efisien (bandwidth lebih kecil)
- Scalable untuk data besar

**Trade-off:**
- Lebih kompleks (perlu ubah backend)
- Excel export perlu fetch all data

---

**Deployment Date:** 2026-04-25
**Version:** 1.3.0
**Status:** Ready for Production ✅

**Commit:**
- `dbbcc5c` - Add pagination to SK report detail page - 20 items per page default
