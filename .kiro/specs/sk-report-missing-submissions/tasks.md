# Implementation Plan: SK Report — Madrasah Belum Mengajukan

## Overview

Implementasi fitur laporan madrasah berstatus jam'iyyah yang belum mengajukan SK. Fitur ini menambahkan 2 endpoint baru di `ReportController` (list + Excel export), halaman React baru `SkReportMissingPage` dengan filter/search/tabel/export, dan integrasi navigasi dengan halaman laporan SK yang sudah ada.

Pendekatan implementasi:
1. Backend API — extend `ReportController` dengan 2 method baru + route registration
2. Excel Export — Maatwebsite Excel export class
3. Frontend — halaman React baru dengan TanStack Query, filter, tabel, dan export buttons
4. Navigasi — link dari halaman laporan SK existing ke halaman baru
5. PDF — menggunakan `window.print()` dengan CSS `@media print` (landscape)

---

## Tasks

- [x] 1. Backend API — Endpoint List Madrasah Belum Mengajukan
  - [x] 1.1 Add `skBelumMengajukan` method to ReportController
    - Add method `skBelumMengajukan(Request $request): JsonResponse` to `backend/app/Http/Controllers/Api/ReportController.php`
    - Implement inline role check: reject non-super_admin/admin_yayasan with 403
    - Implement LEFT JOIN query between `schools` and `sk_documents` with `WHERE sk.id IS NULL`
    - Filter `status_jamiyyah ILIKE '%jam''iyyah%'` (case-insensitive)
    - Exclude soft-deleted schools (`deleted_at IS NULL`)
    - Exclude soft-deleted sk_documents in the JOIN condition
    - Apply optional filters: `jenjang`, `kecamatan`, `search` (nama/NPSN, case-insensitive), `start_date`, `end_date`
    - Return response with `total`, `kecamatan_list` (distinct kecamatan values), and `data` array
    - Each data item includes: id, nama, npsn, jenjang, kecamatan, kepala_madrasah, telepon
    - Order results by `nama ASC`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4_

  - [x] 1.2 Register API routes for the new endpoints
    - Add `Route::get('sk-belum-mengajukan', [ReportController::class, 'skBelumMengajukan'])` inside the existing `reports` prefix group in `backend/routes/api.php`
    - Add `Route::get('sk-belum-mengajukan/export', [ReportController::class, 'exportSkBelumMengajukan'])` in the same group
    - _Requirements: 1.1, 3.1_

  - [x] 1.3 Write unit/feature tests for skBelumMengajukan endpoint
    - Create test file: `backend/tests/Feature/SkBelumMengajukanReportTest.php`
    - Test: super_admin gets 200 with correct response structure
    - Test: admin_yayasan gets 200
    - Test: operator gets 403
    - Test: only jam'iyyah schools without SK appear in results
    - Test: schools WITH SK submissions do NOT appear
    - Test: non-jam'iyyah schools do NOT appear
    - Test: jenjang filter narrows results correctly
    - Test: kecamatan filter narrows results correctly
    - Test: search filter matches nama and NPSN (case-insensitive)
    - Test: period filter (start_date/end_date) correctly determines "belum mengajukan"
    - Test: soft-deleted schools are excluded
    - Test: total count matches data array length
    - _Requirements: 1.1, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4_

- [x] 2. Backend API — Excel Export Endpoint
  - [x] 2.1 Create Maatwebsite Excel export class
    - Create file: `backend/app/Exports/SkBelumMengajukanExport.php`
    - Implement `FromCollection`, `WithHeadings`, `WithEvents`, `WithStyles` interfaces
    - Accept filter parameters (jenjang, kecamatan, search, start_date, end_date) via constructor
    - Reuse the same query logic as `skBelumMengajukan` for data retrieval
    - Define columns: No, Nama Madrasah, NPSN, Jenjang, Kecamatan, Kepala Madrasah, Nomor Telepon
    - Add header rows: title "Laporan Madrasah Belum Mengajukan SK", "LP Ma'arif NU Cilacap", date + active filters
    - Apply basic styling (bold headers, auto-width columns)
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 2.2 Add `exportSkBelumMengajukan` method to ReportController
    - Add method `exportSkBelumMengajukan(Request $request): BinaryFileResponse|JsonResponse`
    - Implement inline role check (same as skBelumMengajukan)
    - Use `Excel::download()` with the export class
    - Set filename: `Laporan_Belum_Mengajukan_SK_{date}.xlsx`
    - Wrap in try-catch, return 500 JSON error on failure with message "Gagal menghasilkan file Excel. Silakan coba lagi."
    - _Requirements: 3.1, 3.4_

  - [x] 2.3 Write tests for Excel export endpoint
    - Add tests to `backend/tests/Feature/SkBelumMengajukanReportTest.php`
    - Test: export returns downloadable .xlsx file
    - Test: export respects active filters
    - Test: export returns 403 for operator role
    - Test: export returns correct Content-Type header
    - _Requirements: 3.1, 3.4_

- [x] 3. Checkpoint — Backend verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Frontend — API Service and Types
  - [x] 4.1 Add API methods and TypeScript interfaces for the report
    - Add `MissingSchoolItem` interface and `SkBelumMengajukanResponse` interface to appropriate types location
    - Add `skBelumMengajukan` method to the report API service in `src/lib/api.ts` (or relevant service file)
    - Add `exportSkBelumMengajukan` method with `responseType: 'blob'` for Excel download
    - Define query params interface: `jenjang`, `kecamatan`, `search`, `start_date`, `end_date`
    - _Requirements: 1.1, 3.1_

- [x] 5. Frontend — SkReportMissingPage Component
  - [x] 5.1 Create SkReportMissingPage main component
    - Create file: `src/features/reports/SkReportMissingPage.tsx`
    - Implement page layout with title "Laporan Madrasah Belum Mengajukan SK"
    - Add summary card showing total count of madrasah belum mengajukan
    - Implement TanStack Query hook to fetch data from `/api/reports/sk-belum-mengajukan`
    - Implement loading state with skeleton/spinner
    - Implement error state with retry button
    - Implement empty state with message "Semua madrasah jam'iyyah sudah mengajukan SK"
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 5.2 Implement filter bar and search functionality
    - Add jenjang dropdown filter (options: RA, MI, MTs, MA)
    - Add kecamatan dropdown filter (populated from `kecamatan_list` in API response)
    - Add period filter with start_date and end_date date pickers
    - Add search input with debounce for nama/NPSN search
    - Connect all filters to TanStack Query refetch via query params
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 5.3 Implement data table
    - Render table with columns: No, Nama Madrasah, NPSN, Jenjang, Kecamatan, Kepala Madrasah
    - Use Shadcn/UI Table components for consistent styling
    - Display row numbers based on position in filtered results
    - Handle null/empty values gracefully (display "-" or empty)
    - _Requirements: 1.2_

  - [x] 5.4 Implement export buttons (Excel and PDF)
    - Add "Download Excel" button that triggers blob download from export endpoint
    - Implement file download logic (create blob URL, trigger download, revoke URL)
    - Add "Download PDF" button that triggers `window.print()`
    - Add CSS `@media print` styles for landscape orientation, kop header, table formatting, footer with date and page number
    - Show toast notification (Sonner) on export error
    - Pass current active filters to export endpoint
    - _Requirements: 3.1, 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 5.5 Write component tests for SkReportMissingPage
    - Create test file: `src/features/reports/SkReportMissingPage.test.tsx`
    - Test: renders table with correct columns
    - Test: filter interactions trigger refetch
    - Test: search debounce works correctly
    - Test: export button triggers download
    - Test: empty state renders when no data
    - Test: loading state renders skeleton
    - Test: error state renders with retry button
    - _Requirements: 1.1, 1.2, 2.1, 2.3, 3.1, 4.1_

- [x] 6. Frontend — Route Registration and Navigation
  - [x] 6.1 Register route for SkReportMissingPage
    - Add route `reports/sk-belum-mengajukan` in `src/App.tsx` (or relevant router config)
    - Wrap with ErrorBoundary fallback
    - Ensure route is protected (requires authentication)
    - _Requirements: 5.1_

  - [x] 6.2 Add navigation link to existing SK report pages
    - Add "Belum Mengajukan" navigation link/tab in `SkReportGroupedPage.tsx`
    - Add same link in `SkReportPageSimple.tsx` for consistency
    - Add navigation item in `AppShell.tsx` sidebar (icon: FileBarChart, label: "Laporan Belum Mengajukan SK")
    - Display badge/indicator with count of madrasah belum mengajukan on the navigation tab
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 7. Final Checkpoint — Full feature verification
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- No database migration needed — uses existing `schools` and `sk_documents` tables
- PDF export uses browser `window.print()` approach (no backend PDF generation)
- Excel export uses Maatwebsite Excel following existing patterns in the project
- Role restriction is inline in controller methods (not middleware), following existing pattern in `SkDocumentController`
- Property tests validate universal correctness properties (query logic, filter behavior, search, period determination)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["1.3", "2.2"] },
    { "id": 3, "tasks": ["2.3", "4.1"] },
    { "id": 4, "tasks": ["5.1"] },
    { "id": 5, "tasks": ["5.2", "5.3"] },
    { "id": 6, "tasks": ["5.4", "6.1"] },
    { "id": 7, "tasks": ["5.5", "6.2"] }
  ]
}
```
