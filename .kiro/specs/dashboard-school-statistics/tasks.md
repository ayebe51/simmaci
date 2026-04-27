# Implementation Plan: Dashboard School Statistics

## Overview

Implementasi fitur statistik sekolah pada dashboard SIMMACI yang menampilkan distribusi sekolah berdasarkan afiliasi (Jama'ah vs Jam'iyyah) dan jenjang pendidikan (MI/SD, MTs/SMP, MA/SMA/SMK). Implementasi menggunakan Laravel untuk backend API dan React + TypeScript untuk frontend components.

Pendekatan implementasi:
1. Database migration untuk menambahkan kolom `jenjang` dan index
2. Backend API endpoint dengan aggregation queries
3. Frontend components dengan responsive design
4. Testing untuk memastikan kualitas dan correctness

---

## Tasks

- [x] 1. Database Migration - Add jenjang column and indexes
  - Create migration file: `2026_04_XX_XXXXXX_add_jenjang_to_schools_table.php`
  - Add `jenjang` column (string, nullable) after `status_jamiyyah`
  - Add database index on `jenjang` column for query performance
  - Add database index on `status_jamiyyah` column if not exists
  - Run migration in development environment
  - Verify column and indexes are created successfully
  - _Requirements: 1.1, 2.1, 4.4_

- [x] 2. Backend API Implementation
  - [x] 2.1 Implement getSchoolStatistics method in DashboardController
    - Add method `getSchoolStatistics(Request $request): JsonResponse` to `backend/app/Http/Controllers/Api/DashboardController.php`
    - Implement tenant scoping logic (operator sees only their school, super_admin/admin_yayasan see all)
    - Implement affiliation aggregation query with CASE WHEN for categorization (jamaah, jamiyyah, undefined)
    - Implement jenjang aggregation query with CASE WHEN for categorization (mi_sd, mts_smp, ma_sma_smk, lainnya, undefined)
    - Format response with counts and totals
    - Add error handling with try-catch and logging
    - Use ApiResponse trait for consistent response format
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.8, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.8, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  
  - [x] 2.2 Add API route for school statistics
    - Add route `GET /api/dashboard/school-statistics` in `backend/routes/api.php`
    - Apply middleware: `auth:sanctum`, `TenantScope`
    - Map route to `DashboardController@getSchoolStatistics`
    - _Requirements: 1.1, 2.1, 3.6_
  
  - [x] 2.3 Write unit tests for DashboardController
    - Create test file: `backend/tests/Unit/DashboardControllerTest.php`
    - Test: Response structure has correct keys (affiliation, jenjang, total)
    - Test: Affiliation categorization logic (Jama'ah/Afiliasi → jamaah, Jam'iyyah → jamiyyah)
    - Test: Jenjang categorization logic (MI/SD → mi_sd, MTs/SMP → mts_smp, MA/SMA/SMK → ma_sma_smk)
    - Test: Case-insensitive matching for jenjang values
    - Test: Tenant scoping for operator role (only their school)
    - Test: Global access for super_admin and admin_yayasan
    - Test: NULL and empty string values categorized as "undefined"
    - Test: Zero values returned for empty categories
    - _Requirements: 7.1, 7.2, 7.5_

- [x] 3. Checkpoint - Backend API verification
  - Run unit tests: `php artisan test --filter=DashboardControllerTest`
  - Test API endpoint with Postman/Insomnia for different user roles
  - Verify response format matches API contract
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Frontend API Service
  - [x] 4.1 Add getSchoolStatistics method to dashboard API service
    - Open or create `src/services/dashboardApi.ts`
    - Add method `getSchoolStatistics()` that calls `GET /api/dashboard/school-statistics`
    - Define TypeScript interfaces: `SchoolStatisticsData`, `AffiliationStats`, `JenjangStats`
    - Use `apiClient` from `src/lib/api.ts` for HTTP request
    - Return typed response with proper error handling
    - _Requirements: 1.1, 2.1, 3.3_

- [x] 5. Frontend Components Implementation
  - [x] 5.1 Create SchoolStatisticsCards container component
    - Create file: `src/features/dashboard/components/SchoolStatisticsCards.tsx`
    - Define component props: `SchoolStatisticsCardsProps` with data and loading state
    - Implement React Query hook to fetch statistics data
    - Implement loading state with skeleton loaders
    - Implement error state with error message and toast notification
    - Implement grid layout: 2 columns on desktop (md:grid-cols-2), 1 column on mobile
    - Render AffiliationCard and JenjangCard sub-components
    - Add React Query configuration: 5 min staleTime, 10 min cacheTime, no refetch on window focus
    - _Requirements: 1.2, 1.6, 2.2, 2.7, 3.1, 3.2, 3.4, 3.5, 4.1, 6.1, 6.2, 6.3_
  
  - [x] 5.2 Create AffiliationCard sub-component
    - Create file: `src/features/dashboard/components/AffiliationCard.tsx`
    - Implement card layout with Shadcn/UI Card component
    - Display title: "Statistik Afiliasi Sekolah"
    - Display three categories: Jama'ah/Afiliasi, Jam'iyyah, Tidak Terdefinisi
    - Calculate and display percentages for each category
    - Implement progress bars with emerald color scheme
    - Display total count at bottom
    - Use Tailwind classes consistent with existing dashboard cards
    - Implement responsive text sizing
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 3.2, 3.4, 6.4, 6.5_
  
  - [x] 5.3 Create JenjangCard sub-component
    - Create file: `src/features/dashboard/components/JenjangCard.tsx`
    - Implement card layout with Shadcn/UI Card component
    - Display title: "Statistik Jenjang Pendidikan"
    - Display five categories: MI/SD, MTs/SMP, MA/SMA/SMK, Lainnya, Tidak Terdefinisi
    - Calculate and display percentages for each category
    - Implement progress bars with emerald color scheme
    - Display total count at bottom
    - Use Tailwind classes consistent with existing dashboard cards
    - Implement responsive text sizing
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.2, 3.4, 6.4, 6.5_
  
  - [x] 5.4 Integrate SchoolStatisticsCards into DashboardPage
    - Open `src/features/dashboard/DashboardPage.tsx`
    - Import SchoolStatisticsCards component
    - Add SchoolStatisticsCards below existing stats cards (Total Sekolah, Total Guru, etc.)
    - Add margin-top spacing (mt-8) for visual separation
    - Ensure component is rendered for all user roles (super_admin, admin_yayasan, operator)
    - _Requirements: 1.2, 2.2, 3.1, 3.2_
  
  - [x] 5.5 Write component tests for SchoolStatisticsCards
    - Create test file: `src/features/dashboard/components/SchoolStatisticsCards.test.tsx`
    - Test: Renders loading state with skeleton loaders
    - Test: Renders affiliation statistics with correct counts and percentages
    - Test: Renders jenjang statistics with correct counts and percentages
    - Test: Handles zero values correctly (displays "0 (0%)")
    - Test: Calculates percentages accurately
    - Test: Responsive layout changes at different viewport sizes
    - _Requirements: 7.3, 7.5_

- [x] 6. Checkpoint - Frontend components verification
  - Run component tests: `npm run test`
  - Test components in browser at different viewport sizes (mobile, tablet, desktop)
  - Verify loading states, error states, and data display
  - Verify styling consistency with existing dashboard
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Integration Testing
  - [x] 7.1 Write end-to-end integration test
    - Create test file: `backend/tests/Feature/DashboardStatisticsIntegrationTest.php`
    - Test: Seed database with test schools (various afiliasi and jenjang values)
    - Test: Make API request as super_admin and verify response matches expected counts
    - Test: Make API request as operator and verify only their school is counted
    - Test: Create new school and verify statistics update in real-time
    - Test: Verify NULL and empty values are handled correctly
    - _Requirements: 7.4, 7.5_
  
  - [x] 7.2 Performance testing with large dataset
    - Seed database with 1000 test schools
    - Measure API response time
    - Verify response time is less than 500ms
    - Verify database query time is less than 100ms
    - _Requirements: 4.1, 4.5_

- [x] 8. Final Integration and Verification
  - [x] 8.1 Test with different user roles
    - Login as super_admin and verify statistics show all schools
    - Login as admin_yayasan and verify statistics show all schools
    - Login as operator and verify statistics show only their school
    - _Requirements: 1.8, 2.8, 3.6_
  
  - [x] 8.2 Test edge cases
    - Test with empty database (no schools)
    - Test with schools having NULL jenjang values
    - Test with schools having empty string jenjang values
    - Test with schools having unrecognized jenjang values
    - Test with mixed case jenjang values (MI, mi, Mi)
    - Verify all edge cases are handled gracefully
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  
  - [x] 8.3 Responsive design verification
    - Test on mobile device (< 768px)
    - Test on tablet device (768px - 1024px)
    - Test on desktop (> 1024px)
    - Verify layout adapts correctly at all breakpoints
    - Verify text remains readable at all sizes
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 9. Final Checkpoint - Complete feature verification
  - Run all tests (unit, component, integration): `php artisan test && npm run test`
  - Verify code coverage meets 80% minimum for new code
  - Test complete user flow: login → dashboard → view statistics
  - Verify no console errors or warnings
  - Verify API response times meet performance targets
  - Verify responsive design works on all devices
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation and catch issues early
- Database migration must be run before backend implementation
- Backend API must be complete before frontend integration
- Component tests validate UI behavior and edge cases
- Integration tests validate end-to-end flow from database to UI
- Performance testing ensures scalability to 1000+ schools
- Final verification ensures all requirements are met

---

## Implementation Order

1. **Phase 1**: Database (Task 1) - Foundation for data storage
2. **Phase 2**: Backend API (Tasks 2-3) - Data aggregation and business logic
3. **Phase 3**: Frontend Service (Task 4) - API integration layer
4. **Phase 4**: Frontend Components (Tasks 5-6) - UI implementation
5. **Phase 5**: Integration & Testing (Tasks 7-9) - Quality assurance and verification

---

## Estimated Timeline

- Database Migration: 1-2 hours
- Backend API: 4-6 hours (including tests)
- Frontend Components: 6-8 hours (including tests)
- Integration & Testing: 2-4 hours
- **Total**: 13-20 hours (approximately 2-3 days)

---

## Technical Dependencies

- Laravel 12 with Eloquent ORM
- PostgreSQL 16 with indexing support
- React 19 with TypeScript
- TanStack React Query v5 for data fetching
- Shadcn/UI components for consistent styling
- Tailwind CSS for responsive design
- PHPUnit for backend testing
- Vitest/React Testing Library for frontend testing
