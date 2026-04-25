# Laporan SK Data Sync Bug - Bugfix Design

## Overview

Halaman "Laporan SK" tidak dapat menampilkan data tabel karena terdapat dua masalah utama: (1) API definition mismatch di frontend - method `reportApi.skReport` didefinisikan sebagai object dengan property `.list()` tetapi dipanggil sebagai function langsung, dan (2) response structure mismatch - backend mengembalikan struktur `{ total, by_status, by_jenis, data }` sedangkan frontend mengharapkan `{ summary: { total, approved, pending, rejected, draft }, byType: { gty, gtt, kamad, tendik }, data }`.

Strategi fix: Ubah API definition di `src/lib/api.ts` dari object menjadi function, dan transform response structure di backend controller untuk match ekspektasi frontend.

## Glossary

- **Bug_Condition (C)**: Kondisi yang memicu bug - ketika user membuka halaman Laporan SK (`/dashboard/reports/sk`)
- **Property (P)**: Behavior yang diharapkan - API call berhasil dan data tabel ter-render dengan benar
- **Preservation**: Behavior halaman laporan lain (teacher report) dan fungsi export/print yang harus tetap tidak berubah
- **reportApi.skReport**: Method API di `src/lib/api.ts` yang memanggil endpoint `/api/reports/sk`
- **ReportController::skReport**: Method backend di `backend/app/Http/Controllers/Api/ReportController.php` yang mengembalikan data laporan SK
- **SkReportPageSimple**: Komponen React di `src/features/reports/SkReportPageSimple.tsx` yang mengkonsumsi data laporan

## Bug Details

### Bug Condition

Bug terjadi ketika user membuka halaman Laporan SK. Terdapat dua root cause yang menyebabkan data tidak muncul: (1) API call gagal karena method definition salah, dan (2) jika API call berhasil, data tidak ter-render karena struktur response tidak sesuai ekspektasi.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type PageLoadRequest
  OUTPUT: boolean
  
  RETURN input.url = "/dashboard/reports/sk"
         AND (apiDefinitionMismatch() OR responseStructureMismatch())
END FUNCTION

FUNCTION apiDefinitionMismatch()
  RETURN reportApi.skReport is defined as object with .list() method
         AND called as function: reportApi.skReport(params)
END FUNCTION

FUNCTION responseStructureMismatch()
  RETURN backend returns { total, by_status, by_jenis, data }
         AND frontend expects { summary: {...}, byType: {...}, data }
END FUNCTION
```

### Examples

**Example 1: API Call Failure**
- User: Super admin membuka `/dashboard/reports/sk`
- Expected: API call `reportApi.skReport({ start_date: '2024-01-01', end_date: '2024-12-31' })` berhasil
- Actual: TypeError - `reportApi.skReport is not a function` karena didefinisikan sebagai object

**Example 2: Data Structure Mismatch**
- Backend response: `{ total: 100, by_status: { approved: 50, pending: 30, rejected: 20 }, by_jenis: { GTY: 40, GTT: 30 }, data: [...] }`
- Frontend expects: `reportData.summary.total`, `reportData.summary.approved`, `reportData.byType.gty`
- Actual: `reportData.summary` is undefined, statistik cards menampilkan angka kosong

**Example 3: Filter Application**
- User: Operator memilih filter status "approved" dan tanggal range
- Expected: Tabel menampilkan SK dengan status approved dalam range tersebut
- Actual: Tabel tetap kosong karena API call gagal sejak awal

**Edge Case: Empty Data**
- User: Admin membuka halaman ketika belum ada SK di database
- Expected: Tabel kosong dengan message "Tidak ada data", statistik menampilkan 0
- Actual: Sama seperti bug condition - tidak bisa dibedakan apakah data kosong atau API gagal

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Halaman laporan teacher (`/dashboard/reports/teachers`) harus tetap berfungsi dengan `reportApi.teacherRekap.list()`
- Fungsi export Excel harus tetap bekerja setelah data ter-load
- Fungsi print/PDF harus tetap bekerja dengan layout yang sama
- Filter madrasah untuk super_admin/admin_yayasan harus tetap muncul dan berfungsi
- Auto-scoping untuk operator (data ter-filter ke school_id mereka) harus tetap bekerja
- Statistik cards dan charts harus tetap menampilkan data dengan styling yang sama

**Scope:**
Semua halaman lain yang menggunakan `reportApi` (seperti `reportApi.teacherRekap`, `reportApi.summary`) harus tetap tidak terpengaruh. Perubahan hanya pada `reportApi.skReport` dan response structure dari `ReportController::skReport`.

## Hypothesized Root Cause

Berdasarkan analisis bug description dan code inspection, root cause yang paling mungkin adalah:

1. **API Definition Inconsistency**: Di `src/lib/api.ts`, `reportApi.skReport` didefinisikan sebagai object dengan property `.list()`:
   ```typescript
   skReport: {
     list: (params?: Record<string, any>) => apiClient.get('/reports/sk', { params }).then((r) => r.data),
   }
   ```
   Tetapi di `SkReportPageSimple.tsx`, dipanggil sebagai function langsung:
   ```typescript
   reportApi.skReport({ start_date, end_date, school_id, status })
   ```
   Ini menyebabkan TypeError karena `reportApi.skReport` adalah object, bukan function.

2. **Response Structure Mismatch**: Backend `ReportController::skReport` mengembalikan:
   ```php
   return response()->json([
       'total' => $sks->count(),
       'by_status' => $sks->groupBy('status')->map->count(),
       'by_jenis' => $sks->groupBy('jenis_sk')->map->count(),
       'data' => $sks,
   ]);
   ```
   Sedangkan frontend mengharapkan:
   ```typescript
   reportData.summary.total
   reportData.summary.approved
   reportData.byType.gty
   ```

3. **Case Sensitivity Issue**: Backend mengembalikan `by_jenis` dengan keys uppercase (`GTY`, `GTT`, `Kamad`, `Tendik`) sedangkan frontend mengharapkan lowercase (`gty`, `gtt`, `kamad`, `tendik`).

4. **Missing Draft Status**: Frontend mengharapkan `summary.draft` tetapi backend tidak menghitung status draft dalam `by_status`.

## Correctness Properties

Property 1: Bug Condition - API Call Success and Data Rendering

_For any_ page load request where the URL is `/dashboard/reports/sk`, the fixed API definition and response structure SHALL enable successful API call execution, correct data structure parsing, and proper rendering of table rows and statistics cards.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - Other Report Pages Behavior

_For any_ page load request where the URL is NOT `/dashboard/reports/sk` (such as teacher reports or summary reports), the fixed code SHALL produce exactly the same behavior as the original code, preserving all existing functionality for other report endpoints.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File 1**: `src/lib/api.ts`

**Function**: `reportApi.skReport`

**Specific Changes**:
1. **Change API Definition from Object to Function**: Ubah dari object dengan property `.list()` menjadi function langsung
   - Before: `skReport: { list: (params) => ... }`
   - After: `skReport: (params?: Record<string, any>) => apiClient.get('/reports/sk', { params }).then((r) => r.data)`

**File 2**: `backend/app/Http/Controllers/Api/ReportController.php`

**Function**: `skReport(Request $request)`

**Specific Changes**:
1. **Transform Response Structure**: Ubah struktur response untuk match ekspektasi frontend
   - Wrap `by_status` counts ke dalam object `summary` dengan keys: `total`, `approved`, `pending`, `rejected`, `draft`
   - Rename `by_jenis` menjadi `byType` dan lowercase semua keys (`GTY` → `gty`, `GTT` → `gtt`, `Kamad` → `kamad`, `Tendik` → `tendik`)

2. **Add Draft Status Calculation**: Tambahkan perhitungan untuk status `draft` di summary (jika ada)

3. **Ensure Case-Insensitive Grouping**: Pastikan grouping `jenis_sk` case-insensitive agar `GTY`, `gty`, `Gty` semua dihitung sebagai satu kategori

4. **Maintain Backward Compatibility**: Pastikan response tetap include `data` array dengan struktur yang sama

5. **Handle Empty Data**: Pastikan response structure tetap valid meskipun data kosong (return 0 untuk semua counts)

### Expected Response Structure After Fix

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
  "data": [
    {
      "id": 1,
      "nomor_sk": "001/SK/2024",
      "jenis_sk": "GTY",
      "nama": "Ahmad Fauzi",
      "unit_kerja": "MA Maarif NU 1 Cilacap",
      "status": "approved",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

## Testing Strategy

### Validation Approach

Testing strategy menggunakan two-phase approach: pertama, surface counterexamples yang mendemonstrasikan bug pada unfixed code untuk confirm root cause, kemudian verify fix works correctly dan preserve existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples yang mendemonstrasikan bug BEFORE implementing the fix. Confirm atau refute root cause analysis. Jika refute, perlu re-hypothesize.

**Test Plan**: Write tests yang simulate page load dan API call untuk halaman Laporan SK. Run tests pada UNFIXED code untuk observe failures dan understand root cause.

**Test Cases**:
1. **API Definition Test**: Call `reportApi.skReport({ start_date: '2024-01-01' })` dan assert TypeError (will fail on unfixed code - confirms API definition mismatch)
2. **Response Structure Test**: Mock backend response dengan struktur lama `{ total, by_status, by_jenis }` dan assert frontend tidak bisa access `reportData.summary.total` (will fail on unfixed code - confirms structure mismatch)
3. **Case Sensitivity Test**: Mock backend response dengan `by_jenis: { GTY: 10 }` dan assert frontend tidak bisa access `reportData.byType.gty` (will fail on unfixed code - confirms case sensitivity issue)
4. **Empty Data Test**: Mock backend response dengan data kosong dan assert statistik cards menampilkan 0 (may fail on unfixed code if structure mismatch prevents rendering)

**Expected Counterexamples**:
- TypeError: `reportApi.skReport is not a function` ketika page load
- `reportData.summary` is undefined ketika try to access statistics
- `reportData.byType.gty` is undefined ketika try to render charts
- Possible causes: API definition mismatch, response structure mismatch, case sensitivity issue

### Fix Checking

**Goal**: Verify bahwa untuk semua inputs dimana bug condition holds, fixed function produces expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := loadSkReportPage_fixed(input)
  ASSERT result.apiCallSuccess = true
  ASSERT result.dataStructureValid = true
  ASSERT result.tableDataVisible = true
  ASSERT result.statisticsVisible = true
END FOR
```

**Test Cases**:
1. **API Call Success**: Verify `reportApi.skReport(params)` returns data tanpa error
2. **Data Structure Validation**: Verify response memiliki `summary` object dengan keys `total`, `approved`, `pending`, `rejected`, `draft`
3. **Type Breakdown Validation**: Verify response memiliki `byType` object dengan keys lowercase `gty`, `gtt`, `kamad`, `tendik`
4. **Table Rendering**: Verify tabel menampilkan rows dengan data dari `reportData.data`
5. **Statistics Rendering**: Verify statistik cards menampilkan angka dari `reportData.summary`
6. **Charts Rendering**: Verify pie chart dan bar chart menampilkan data dari `reportData.summary` dan `reportData.byType`

### Preservation Checking

**Goal**: Verify bahwa untuk semua inputs dimana bug condition does NOT hold, fixed function produces same result as original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT loadReportPage_original(input) = loadReportPage_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended untuk preservation checking karena:
- Generates many test cases automatically across input domain
- Catches edge cases yang manual unit tests might miss
- Provides strong guarantees bahwa behavior unchanged untuk all non-buggy inputs

**Test Plan**: Observe behavior pada UNFIXED code first untuk other report pages, kemudian write property-based tests capturing that behavior.

**Test Cases**:
1. **Teacher Report Preservation**: Observe bahwa `reportApi.teacherRekap.list()` works correctly pada unfixed code, kemudian write test untuk verify ini continues after fix
2. **Summary Report Preservation**: Observe bahwa `reportApi.summary()` works correctly pada unfixed code, kemudian write test untuk verify ini continues after fix
3. **Export Excel Preservation**: Observe bahwa export Excel works correctly pada unfixed code (setelah manual fix untuk load data), kemudian write test untuk verify ini continues after fix
4. **Print/PDF Preservation**: Observe bahwa print/PDF works correctly pada unfixed code (setelah manual fix untuk load data), kemudian write test untuk verify layout unchanged
5. **Filter Preservation**: Observe bahwa filter madrasah dan status works correctly untuk operator dan super_admin, kemudian write test untuk verify ini continues after fix

### Unit Tests

- Test API definition change: verify `reportApi.skReport` is callable as function
- Test response structure transformation: verify backend returns correct structure
- Test case sensitivity: verify `byType` keys are lowercase
- Test empty data handling: verify response structure valid when no SK documents exist
- Test filter parameters: verify backend correctly applies filters (date range, status, school_id)

### Property-Based Tests

- Generate random filter combinations (date ranges, status values, school IDs) dan verify API call succeeds dan returns valid structure
- Generate random SK document datasets dan verify response structure always matches expected format
- Generate random user roles (operator, super_admin) dan verify data scoping works correctly
- Test bahwa all non-SK report endpoints continue working across many scenarios

### Integration Tests

- Test full page load flow: user opens `/dashboard/reports/sk` → API call → data renders → statistics display
- Test filter application flow: user changes filters → API call with new params → data updates → table re-renders
- Test export flow: user clicks export → data transforms to Excel format → file downloads
- Test print flow: user clicks print → print dialog opens → layout correct
- Test role-based access: operator sees only their school data, super_admin sees all schools
