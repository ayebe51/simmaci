# Implementation Plan: Student Statistics per Jenjang

## Overview

Implementasi fitur statistik jumlah siswa per jenjang pendidikan di SIMMACI. Fitur ini menampilkan ringkasan jumlah siswa aktif yang dikelompokkan berdasarkan jenjang (RA, MI, MTs, MA), dengan drill-down ke daftar madrasah per jenjang dan detail per kelas, serta fitur download Excel.

Pendekatan implementasi:
1. Backend service layer dengan aggregation queries (GROUP BY)
2. Backend controller dengan 5 endpoint API
3. Excel export menggunakan Maatwebsite Excel
4. Frontend API service dan TanStack Query hooks
5. Frontend components dengan drill-down navigation
6. Property-based tests dan unit tests

---

## Tasks

- [x] 1. Backend Service Layer
  - [x] 1.1 Create StudentStatisticsService with core methods
    - Create file: `backend/app/Services/StudentStatisticsService.php`
    - Implement `getPerJenjang(?int $schoolId = null): array` — aggregates active student counts per jenjang category using CASE WHEN SQL with GROUP BY
    - Implement `getMadrasahByJenjang(string $jenjangCategory, ?int $schoolId = null): Collection` — returns madrasah list with active student counts sorted descending
    - Implement `getPerKelas(int $schoolId): Collection` — returns student counts per kelas sorted alphanumerically with "Belum Ditentukan" last
    - Implement `categorizeJenjang(?string $jenjang): string` — maps NULL/empty to "Tidak Terdefinisi", RA/MI/MTs/MA (case-insensitive) to canonical, else "Lainnya"
    - Implement `normalizeKelas(?string $kelas): string` — maps NULL/empty/whitespace to "Belum Ditentukan", else trimmed value
    - Implement `generateExportFilename(string $prefix, string $identifier): string` — sanitizes special characters to underscores, appends timestamp
    - Calculate percentage for each jenjang category: `round((jumlah_siswa / total) * 100)`
    - Use `withoutTenantScope()` for super_admin/admin_yayasan, manual school_id filter for operators
    - Filter only students with `status = 'Aktif'` and `deleted_at IS NULL`, join with schools where `deleted_at IS NULL`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 3.1, 3.3, 3.4, 3.5, 4.4, 5.5, 6.5, 6.6, 7.1_

  - [x] 1.2 Write property tests for categorizeJenjang
    - **Property 1: Jenjang Categorization Correctness**
    - **Validates: Requirements 1.5, 1.6**
    - Create test file: `backend/tests/Unit/Services/StudentStatisticsServicePropertyTest.php`
    - Use Faker to generate 100+ random jenjang values (NULL, empty, "RA", "ra", "Ra", "MI", "mi", "MTs", "mts", "MA", "ma", random strings)
    - Assert: NULL/empty → "Tidak Terdefinisi", RA/MI/MTs/MA (any case) → canonical, else → "Lainnya"

  - [x] 1.3 Write property tests for normalizeKelas
    - **Property 6: Kelas Normalization**
    - **Validates: Requirements 3.3**
    - Assert: NULL/empty/whitespace-only → "Belum Ditentukan", non-whitespace → trimmed value
    - Generate 100+ random kelas values including edge cases (spaces, tabs, newlines)

  - [x] 1.4 Write property tests for generateExportFilename
    - **Property 9: Export Filename Sanitization**
    - **Validates: Requirements 4.4**
    - Generate 100+ random madrasah names with special characters
    - Assert: result matches pattern `{prefix}_{sanitized}_{YYYYMMdd_HHmmss}.xlsx` with no special chars except underscores

- [ ] 2. Backend Controller and Routes
  - [x] 2.1 Create StudentStatisticsController
    - Create file: `backend/app/Http/Controllers/Api/StudentStatisticsController.php`
    - Use `ApiResponse` trait for consistent response format
    - Inject `StudentStatisticsService` via constructor
    - Implement `perJenjang(Request $request): JsonResponse` — returns categories array with jenjang, jumlah_siswa, persentase, and total
    - Implement `madrasahByJenjang(Request $request, string $jenjang): JsonResponse` — validates jenjang param, returns madrasah list with id, nama, npsn, kecamatan, jumlah_siswa
    - Implement `perKelas(Request $request, int $id): JsonResponse` — validates madrasah exists, returns kelas list with kelas, jumlah_siswa
    - Implement `exportPerKelas(Request $request, int $id): BinaryFileResponse|JsonResponse` — generates Excel with columns: Nama Madrasah, NPSN, Kelas, Jumlah Siswa + summary row
    - Implement `exportRekapPerJenjang(Request $request, string $jenjang): BinaryFileResponse|JsonResponse` — generates Excel with columns: No, Nama Madrasah, NPSN, Kecamatan, Jumlah Siswa + grand total row
    - Determine school_id from authenticated user's role (operator → user's school_id, else null)
    - Handle errors: 400 for invalid jenjang, 404 for madrasah not found, 500 for export failures
    - _Requirements: 1.1, 1.2, 1.3, 1.7, 2.1, 2.2, 2.5, 3.1, 3.2, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 6.1, 6.2, 6.3, 6.4_

  - [x] 2.2 Register API routes
    - Add routes in `backend/routes/api.php` under middleware group `['auth:sanctum', 'role:super_admin,admin_yayasan,operator']`
    - Prefix: `student-statistics`
    - Routes: GET `/per-jenjang`, GET `/per-jenjang/{jenjang}/madrasah`, GET `/per-jenjang/{jenjang}/export`, GET `/madrasah/{id}/per-kelas`, GET `/madrasah/{id}/per-kelas/export`
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [-] 2.3 Write unit tests for StudentStatisticsController
    - Create test file: `backend/tests/Feature/StudentStatisticsControllerTest.php`
    - Test: 401 for unauthenticated requests
    - Test: 403 for users with roles other than super_admin/admin_yayasan/operator
    - Test: 200 with correct response structure for perJenjang endpoint
    - Test: 400 for invalid jenjang parameter in madrasahByJenjang
    - Test: 404 for non-existent madrasah in perKelas
    - Test: Operator scoping — only sees their school's data
    - Test: Super_admin sees all data across schools
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [-] 2.4 Write property test for aggregation counts
    - **Property 2: Aggregation Counts Only Active Students**
    - **Validates: Requirements 1.1**
    - Seed database with students of mixed statuses (Aktif, Lulus, Pindah)
    - Assert: sum of all category counts equals total active students only
    - Run 50+ iterations with randomized student data

  - [-] 2.5 Write property test for operator tenant scoping
    - **Property 3: Operator Tenant Scoping**
    - **Validates: Requirements 1.3, 6.5**
    - Create operators with different school_ids, seed students across schools
    - Assert: operator queries return data exclusively from their school_id

  - [-] 2.6 Write property test for privileged roles
    - **Property 4: Privileged Roles See All Data**
    - **Validates: Requirements 1.2, 6.6**
    - Assert: super_admin/admin_yayasan total equals sum of all active students across all schools

- [~] 3. Checkpoint - Backend verification
  - Run backend tests: `php artisan test --filter=StudentStatistics`
  - Verify all 5 API endpoints return correct response structure
  - Verify tenant scoping works correctly for different roles
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Frontend API Service and Hooks
  - [-] 4.1 Create studentStatisticsApi service
    - Create file: `src/features/student-statistics/services/studentStatisticsApi.ts`
    - Define TypeScript interfaces: `JenjangStatItem`, `JenjangSummaryResponse`, `MadrasahStatItem`, `KelasStatItem`
    - Implement `getPerJenjang(): Promise<JenjangSummaryResponse>` using `apiClient`
    - Implement `getMadrasahByJenjang(jenjang: string): Promise<MadrasahStatItem[]>` using `apiClient`
    - Implement `getPerKelas(madrasahId: number): Promise<KelasStatItem[]>` using `apiClient`
    - Implement `exportPerKelas(madrasahId: number): Promise<Blob>` with `responseType: 'blob'`
    - Implement `exportRekapPerJenjang(jenjang: string): Promise<Blob>` with `responseType: 'blob'`
    - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1_

  - [~] 4.2 Create TanStack Query hooks
    - Create file: `src/features/student-statistics/hooks/useJenjangStatistics.ts` — query key `['student-statistics', 'per-jenjang']`, staleTime 5 min, retry 1
    - Create file: `src/features/student-statistics/hooks/useMadrasahByJenjang.ts` — query key `['student-statistics', 'madrasah', jenjang]`, enabled when jenjang is set, retry 1
    - Create file: `src/features/student-statistics/hooks/useKelasStatistics.ts` — query key `['student-statistics', 'kelas', madrasahId]`, enabled when madrasahId is set, retry 1
    - _Requirements: 7.2, 7.3, 7.4_

  - [~] 4.3 Create downloadExcel utility
    - Create file: `src/features/student-statistics/utils/downloadExcel.ts`
    - Implement function that takes a Blob and filename, creates object URL, triggers download, revokes URL
    - _Requirements: 4.1, 5.1_

- [ ] 5. Frontend Components
  - [~] 5.1 Create JenjangSummaryCards component
    - Create file: `src/features/student-statistics/components/JenjangSummaryCards.tsx`
    - Display cards for each jenjang category (RA, MI, MTs, MA, Tidak Terdefinisi, Lainnya) with jumlah_siswa and persentase
    - Show total student count
    - Each card is clickable to trigger drill-down to madrasah list
    - Display 0 count and 0% for categories with no students
    - Use Shadcn/UI Card components with Tailwind styling
    - _Requirements: 1.4, 1.8_

  - [~] 5.2 Create MadrasahListPanel component
    - Create file: `src/features/student-statistics/components/MadrasahListPanel.tsx`
    - Display table/list of madrasah with columns: Nama, NPSN, Jumlah Siswa
    - Each madrasah row is clickable to drill-down to kelas detail
    - Include download rekap button that triggers `exportRekapPerJenjang`
    - Show madrasah with 0 students in the list
    - Use Sonner toast for download error notifications
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 5.1, 5.2, 5.3, 5.4, 5.5_

  - [~] 5.3 Create KelasDetailPanel component
    - Create file: `src/features/student-statistics/components/KelasDetailPanel.tsx`
    - Display table of kelas with columns: Kelas, Jumlah Siswa
    - Include download button that triggers `exportPerKelas`
    - Handle empty kelas list (madrasah with 0 active students)
    - Use Sonner toast for download error notifications
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [~] 5.4 Create StatisticsSkeleton and ErrorFallback components
    - Create file: `src/features/student-statistics/components/StatisticsSkeleton.tsx` — loading skeleton matching card layout
    - Create file: `src/features/student-statistics/components/ErrorFallback.tsx` — error message display with retry button
    - Retry button calls `queryClient.invalidateQueries()` to re-fetch data
    - _Requirements: 1.7, 2.5, 7.2, 7.3, 7.4_

  - [~] 5.5 Create StudentStatisticsPage with drill-down navigation
    - Create file: `src/features/student-statistics/StudentStatisticsPage.tsx`
    - Manage state: selectedJenjang, selectedMadrasah for drill-down navigation
    - Render JenjangSummaryCards → MadrasahListPanel → KelasDetailPanel based on selection
    - Show StatisticsSkeleton during loading, ErrorFallback on error
    - Implement 10-second timeout handling with error message and retry
    - _Requirements: 1.1, 1.4, 1.7, 1.8, 2.1, 2.5, 3.1, 7.2, 7.3, 7.4_

  - [~] 5.6 Register route and navigation
    - Add route in React Router configuration for `/student-statistics`
    - Add navigation link in sidebar/menu for authorized roles (super_admin, admin_yayasan, operator)
    - _Requirements: 6.4_

- [~] 6. Checkpoint - Frontend verification
  - Verify all components render correctly with mock data
  - Test drill-down navigation flow: cards → madrasah list → kelas detail
  - Verify loading and error states display correctly
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Integration and Property Tests
  - [~] 7.1 Write property test for per-madrasah sorting
    - **Property 5: Per-Madrasah Results Sorted Descending by Count**
    - **Validates: Requirements 2.2**
    - Create test in `backend/tests/Unit/Services/StudentStatisticsServicePropertyTest.php`
    - Seed multiple madrasah with random student counts
    - Assert: for every consecutive pair (i, i+1), jumlah_siswa[i] >= jumlah_siswa[i+1]

  - [~] 7.2 Write property test for kelas sorting
    - **Property 7: Kelas Sorting with "Belum Ditentukan" Last**
    - **Validates: Requirements 3.4**
    - Seed students with random kelas values including NULL/empty
    - Assert: "Belum Ditentukan" is always the last entry, all other entries are in ascending alphanumeric order

  - [~] 7.3 Write property test for per-kelas export sum invariant
    - **Property 8: Per-Kelas Export Sum Invariant**
    - **Validates: Requirements 4.3**
    - Generate random kelas data, export to Excel
    - Assert: summary row total equals sum of all individual kelas jumlah_siswa values

  - [~] 7.4 Write property test for rekap export sum invariant
    - **Property 10: Rekap Export Sum Invariant**
    - **Validates: Requirements 5.3**
    - Generate random madrasah data for a jenjang, export to Excel
    - Assert: grand total row equals sum of all individual madrasah jumlah_siswa values

  - [~] 7.5 Write property test for rekap export alphabetical sorting
    - **Property 11: Rekap Export Sorted Alphabetically**
    - **Validates: Requirements 5.4**
    - Generate madrasah with random names
    - Assert: madrasah rows are sorted in ascending alphabetical order by nama

  - [~] 7.6 Write property test for percentage calculation
    - **Property 13: Percentage Calculation**
    - **Validates: Requirements 1.4**
    - Generate random student distributions across jenjang categories
    - Assert: each persentase equals round((jumlah_siswa / total) * 100), and when total = 0 all percentages are 0

  - [~] 7.7 Write property test for role-based access control
    - **Property 12: Role-Based Access Control**
    - **Validates: Requirements 6.4**
    - Generate users with various roles
    - Assert: only super_admin, admin_yayasan, operator get 200; all other roles get 403

  - [~] 7.8 Write frontend component tests
    - Create test file: `src/features/student-statistics/components/JenjangSummaryCards.test.tsx`
    - Test: renders all 6 jenjang categories with correct counts and percentages
    - Test: renders 0 count and 0% for empty categories
    - Test: click on card triggers drill-down callback
    - Test: loading skeleton renders correctly
    - Test: error fallback renders with retry button
    - _Requirements: 1.4, 1.7, 1.8, 7.2_

- [~] 8. Final Checkpoint - Complete feature verification
  - Run all backend tests: `php artisan test --filter=StudentStatistics`
  - Run frontend tests: `npx vitest --run`
  - Verify complete drill-down flow works end-to-end
  - Verify Excel downloads generate correct file structure
  - Verify tenant scoping for all roles
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- No database migration needed — uses existing `schools` and `students` tables
- Backend uses Maatwebsite Excel for export (inline anonymous classes following MeetingReportService pattern)
- Frontend follows feature-based folder structure under `src/features/student-statistics/`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "2.1", "2.2"] },
    { "id": 2, "tasks": ["2.3", "2.4", "2.5", "2.6", "4.1"] },
    { "id": 3, "tasks": ["4.2", "4.3"] },
    { "id": 4, "tasks": ["5.1", "5.4"] },
    { "id": 5, "tasks": ["5.2", "5.3", "5.5"] },
    { "id": 6, "tasks": ["5.6", "7.1", "7.2", "7.3", "7.4", "7.5", "7.6", "7.7"] },
    { "id": 7, "tasks": ["7.8"] }
  ]
}
```
