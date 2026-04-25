# Bugfix Requirements Document

## Introduction

Halaman "Laporan SK" (URL: `/dashboard/reports/sk`) tidak menampilkan data tabel meskipun filter form dan tombol export muncul dengan benar. Bug ini disebabkan oleh mismatch antara definisi API di frontend dan struktur response dari backend, serta perbedaan format data yang diharapkan oleh komponen UI.

**Impact**: User tidak dapat melihat laporan daftar SK documents yang sudah diterbitkan, sehingga fungsi monitoring, statistik, dan export data tidak dapat digunakan. Halaman menampilkan state kosong meskipun data SK ada di database.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN user membuka halaman Laporan SK (`/dashboard/reports/sk`) THEN API call `reportApi.skReport()` gagal karena method tidak terdefinisi dengan benar (dipanggil sebagai function tetapi didefinisikan sebagai object dengan method `.list()`)

1.2 WHEN backend mengembalikan response dengan struktur `{ total, by_status, by_jenis, data }` THEN frontend tidak dapat memproses data karena mengharapkan struktur `{ summary: { total, approved, pending, rejected, draft }, data, byType: { gty, gtt, kamad, tendik } }`

1.3 WHEN data tidak ter-load dengan benar THEN tabel menampilkan state kosong dan statistik cards tidak menampilkan angka

1.4 WHEN user mengaplikasikan filter (tanggal, status, madrasah) THEN data tetap tidak muncul karena API call gagal sejak awal

### Expected Behavior (Correct)

2.1 WHEN user membuka halaman Laporan SK THEN API call `reportApi.skReport(params)` harus berhasil memanggil endpoint `/api/reports/sk` dengan parameter yang benar

2.2 WHEN backend mengembalikan response THEN struktur data harus sesuai dengan ekspektasi frontend: `{ summary: { total, approved, pending, rejected, draft }, data: [...], byType: { gty, gtt, kamad, tendik } }`

2.3 WHEN data berhasil di-load THEN tabel harus menampilkan daftar SK documents dengan kolom: No, Nomor Seri SK, Penerima SK (PTK), Unit Kerja, Status, Tanggal Terbit

2.4 WHEN user mengaplikasikan filter THEN data harus ter-filter sesuai dengan parameter: tanggal mulai, tanggal akhir, status produk, dan filter madrasah

### Unchanged Behavior (Regression Prevention)

3.1 WHEN user yang bukan operator (super_admin/admin_yayasan) membuka halaman THEN filter madrasah harus tetap muncul dan berfungsi

3.2 WHEN user dengan role operator membuka halaman THEN data harus otomatis ter-scope ke school_id mereka tanpa menampilkan filter madrasah

3.3 WHEN user klik tombol "Export Excel" THEN fungsi export harus tetap bekerja dengan data yang sudah ter-load

3.4 WHEN user klik tombol "PDF / PRINT" THEN fungsi print harus tetap bekerja dengan layout yang sudah ada

3.5 WHEN data SK dengan status 'approved', 'pending', atau 'rejected' ada di database THEN semua status harus ditampilkan dengan benar di tabel dan statistik

## Bug Condition & Property

### Bug Condition Function

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type PageLoadRequest
  OUTPUT: boolean
  
  // Bug terjadi ketika user membuka halaman Laporan SK
  RETURN X.url = "/dashboard/reports/sk"
END FUNCTION
```

### Property Specification - Fix Checking

```pascal
// Property: Fix Checking - Data Load Success
FOR ALL X WHERE isBugCondition(X) DO
  response ← loadSkReportPage'(X)
  ASSERT response.apiCallSuccess = true AND
         response.dataStructureValid = true AND
         response.tableDataVisible = true AND
         response.statisticsVisible = true
END FOR
```

**Key Definitions:**
- **F**: Fungsi load halaman dengan API definition yang salah dan response structure mismatch
- **F'**: Fungsi load halaman dengan API definition yang benar dan response structure yang sesuai

### Preservation Goal

```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)
END FOR
```

Untuk semua halaman lain yang menggunakan `reportApi` (seperti laporan teacher), behavior harus tetap sama.

## Technical Context

**Affected Files:**
- `src/lib/api.ts` - API definition untuk `reportApi.skReport`
- `backend/app/Http/Controllers/Api/ReportController.php` - Backend controller yang mengembalikan response
- `src/features/reports/SkReportPageSimple.tsx` - Komponen halaman yang mengkonsumsi data

**Current API Definition (Incorrect):**
```typescript
skReport: {
  list: (params?: Record<string, any>) => apiClient.get('/reports/sk', { params }).then((r) => r.data),
}
```

**Current Usage (Incorrect):**
```typescript
reportApi.skReport({ start_date, end_date, school_id, status })
```

**Expected API Definition (Correct):**
```typescript
skReport: (params?: Record<string, any>) => apiClient.get('/reports/sk', { params }).then((r) => r.data)
```

**Current Backend Response:**
```json
{
  "total": 100,
  "by_status": { "approved": 50, "pending": 30, "rejected": 20 },
  "by_jenis": { "GTY": 40, "GTT": 30, "Kamad": 20, "Tendik": 10 },
  "data": [...]
}
```

**Expected Frontend Structure:**
```json
{
  "summary": {
    "total": 100,
    "approved": 50,
    "pending": 30,
    "rejected": 20,
    "draft": 0
  },
  "byType": {
    "gty": 40,
    "gtt": 30,
    "kamad": 20,
    "tendik": 10
  },
  "data": [...]
}
```
