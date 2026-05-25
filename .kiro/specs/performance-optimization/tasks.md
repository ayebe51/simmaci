# Implementation Plan: Performance Optimization

## Overview

This plan implements performance optimizations across the SIMMACI full stack: database indexing, backend query optimization with Redis caching, frontend QueryClient tuning with optimistic updates, batched document generation, and lazy loading improvements. Each task builds incrementally, starting with data layer foundations and progressing to frontend UX enhancements.

## Tasks

- [x] 1. Database index migration and foundation
  - [x] 1.1 Create migration for additional composite indexes
    - Create a new migration file `backend/database/migrations/2026_06_01_000001_add_performance_optimization_indexes.php`
    - Add composite index on `approval_histories(document_id, document_type)`
    - Add composite index on `sk_documents(school_id, created_at DESC)` for reverse chronological listing
    - Use try/catch pattern (matching existing `2026_04_15_000001_add_performance_indexes.php`) to skip if index already exists
    - Include `down()` method with `dropIndexIfExists`
    - _Requirements: 5.1, 5.3, 5.4_

  - [x] 1.2 Write unit test for index migration
    - Create `backend/tests/Unit/PerformanceIndexMigrationTest.php`
    - Test that migration runs without error on fresh database
    - Test that running migration twice does not throw (idempotency)
    - _Requirements: 5.4, 5.5_

- [x] 2. Dashboard cache service (Redis)
  - [x] 2.1 Create DashboardCacheService class
    - Create `backend/app/Services/DashboardCacheService.php`
    - Implement `getStats(User $user)`, `getSchoolStats(User $user)`, `getCharts(User $user)`, `getSkStatistics(User $user)`, `getSkTrend(User $user)`, `getSchoolBreakdown(User $user)` methods
    - Implement `buildKey(string $endpoint, User $user)` scoping by role + school_id
    - Implement `invalidateForSchool(int $schoolId)` to flush all dashboard cache variants for a school
    - Use 60-second TTL for dashboard data, 300-second TTL for school name cache
    - Implement Redis fallback: catch `ConnectionException`, fall back to database cache driver, log warning
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.6_

  - [x] 2.2 Create school name cache helper
    - Add `getSchoolNames(): array` method to `DashboardCacheService` that caches all school id→name pairs with 300s TTL
    - Populate cache with a single `SELECT id, nama FROM schools` query when cache is empty/expired
    - _Requirements: 10.2, 10.3_

  - [x] 2.3 Integrate DashboardCacheService into DashboardController
    - Modify `backend/app/Http/Controllers/Api/DashboardController.php`
    - Inject `DashboardCacheService` via constructor
    - Replace direct DB queries in `stats()`, `schoolStats()`, `getSchoolStatistics()`, `charts()`, `skStatistics()`, `skTrend()`, `schoolBreakdown()` with cache service calls
    - Use aggregate queries (COUNT, SUM) instead of loading model instances
    - Replace individual `School::find()` calls in activity log resolution with cached school names
    - _Requirements: 4.2, 10.1, 10.2, 10.3_

  - [x] 2.4 Write property test for cache tenant isolation (Property 8)
    - **Property 8: Cache tenant isolation**
    - Create `backend/tests/Feature/DashboardCacheTenantIsolationTest.php`
    - Use Pest with randomized role + school_id combinations (100 iterations)
    - Assert that cache keys for different (role, school_id) pairs are always distinct
    - Assert that reading cache for user A never returns data cached by user B with different scope
    - **Validates: Requirements 4.6**

  - [x] 2.5 Write property test for cache TTL behavior (Property 6)
    - **Property 6: Dashboard cache serves within TTL**
    - Create `backend/tests/Feature/DashboardCacheTtlTest.php`
    - Use `DB::getQueryLog()` to assert second call within 60s executes zero DB queries
    - Run 100 iterations with randomized user contexts
    - **Validates: Requirements 4.2**

  - [x] 2.6 Write property test for school name cache (Property 16)
    - **Property 16: School name cache prevents N queries**
    - Create `backend/tests/Feature/SchoolNameCacheTest.php`
    - Generate N activity logs referencing M distinct school_ids
    - Assert at most 1 DB query to resolve all school names
    - **Validates: Requirements 10.2**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Optimized batch approval handler
  - [x] 4.1 Refactor batchUpdateStatus in SkDocumentController
    - Modify `backend/app/Http/Controllers/Api/SkDocumentController.php` method `batchUpdateStatus`
    - Add validation: `'ids' => 'required|array|max:50'`, `'ids.*' => 'integer'`
    - Replace individual `SkDocument::find()` loop with `SkDocument::with('teacher')->whereIn('id', $ids)->get()`
    - Wrap all writes in `DB::transaction()`
    - Implement partial failure: try/catch per document, collect succeeded/failed arrays
    - Replace individual `Notification::create()` with bulk `Notification::insert($records)`
    - Replace individual `ApprovalHistory::create()` with bulk `ApprovalHistory::insert($records)`
    - Bulk update SK document statuses with `SkDocument::whereIn('id', $succeededIds)->update([...])`
    - Return response with `count` (succeeded) and `failed` array with id + reason
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [x] 4.2 Add cache invalidation to batch approval
    - After successful batch approval, call `DashboardCacheService::invalidateForSchool()` for each affected school_id
    - Extract unique school_ids from processed documents
    - _Requirements: 4.3_

  - [x] 4.3 Write property test for eager loading (Property 1)
    - **Property 1: Eager loading prevents N+1 queries**
    - Create `backend/tests/Feature/BatchApprovalQueryEfficiencyTest.php`
    - Use `DB::enableQueryLog()` to count SELECT queries
    - Generate random batch sizes (1-50), assert ≤ 2 SELECT queries regardless of N
    - Run 100 iterations
    - **Validates: Requirements 1.2**

  - [x] 4.4 Write property test for bulk inserts (Property 2)
    - **Property 2: Bulk insert for batch write operations**
    - In same test file, assert exactly 1 INSERT for notifications and 1 INSERT for approval histories per batch
    - Run 100 iterations with randomized batch sizes
    - **Validates: Requirements 1.3, 1.4**

  - [x] 4.5 Write property test for partial failure (Property 3)
    - **Property 3: Partial failure resilience in batch approval**
    - Create test with mix of valid and invalid SK documents (randomized V valid + I invalid, V+I ≤ 50)
    - Assert response contains exactly V succeeded and I failed entries
    - **Validates: Requirements 1.6**

  - [x] 4.6 Write property test for cache invalidation on status change (Property 7)
    - **Property 7: Cache invalidation on SK status change**
    - Assert that after batch approval, dashboard cache entries for affected school_ids are invalidated
    - Use `Cache::has()` to verify keys are cleared
    - **Validates: Requirements 4.3**

- [x] 5. SK List API optimization
  - [x] 5.1 Optimize SK list query with SQL-level NIM enrichment
    - Modify `backend/app/Http/Controllers/Api/SkDocumentController.php` method `index`
    - Replace PHP-level collection filtering for NIM enrichment with SQL JOIN using `LOWER(TRIM())` or `ILIKE`
    - Scope NIM matching to same `school_id`
    - Only enrich documents where `teacher_id IS NULL` or teacher lacks `nomor_induk_maarif`
    - _Requirements: 2.2_

  - [x] 5.2 Add field selection to SK list response
    - Add `->select(['id', 'nomor_sk', 'nama', 'jenis_sk', 'status', 'unit_kerja', 'created_at', 'school_id', 'teacher_id'])` to the query
    - Ensure response includes only: id, nomor_sk, nama, jenis_sk, status, unit_kerja, created_at, teacher.nomor_induk_maarif
    - Exclude all other attributes (jabatan, file_url, surat_permohonan_url, qr_code, revision fields, archive fields, etc.)
    - _Requirements: 7.1, 7.2_

  - [x] 5.3 Add slow query logging
    - Register `DB::listen()` in the SK list endpoint (or via middleware)
    - Log queries exceeding 500ms with query text and duration
    - Ensure request still completes normally even if slow
    - _Requirements: 2.4_

  - [x] 5.4 Write property test for NIM enrichment correctness (Property 4)
    - **Property 4: NIM enrichment correctness via SQL**
    - Create `backend/tests/Feature/NimEnrichmentPropertyTest.php`
    - Generate random SK documents and teachers with case-variant names
    - Assert that matching teacher NIM appears in response when conditions are met
    - Run 100 iterations
    - **Validates: Requirements 2.2**

  - [x] 5.5 Write property test for response payload fields (Property 9)
    - **Property 9: Response payload contains only allowed fields**
    - Create `backend/tests/Feature/SkListPayloadPropertyTest.php`
    - Assert response objects contain exactly the allowed fields and none of the excluded fields
    - Run 100 iterations with randomized SK documents
    - **Validates: Requirements 7.1, 7.2**

  - [x] 5.6 Write property test for pagination metadata (Property 10)
    - **Property 10: Pagination metadata invariant**
    - Assert response includes total (≥0), per_page (1-100, default 25), current_page (≥1)
    - Assert data array length ≤ per_page
    - Run 100 iterations with randomized page sizes and data volumes
    - **Validates: Requirements 7.4**

- [x] 6. Checkpoint - Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Frontend QueryClient configuration
  - [x] 7.1 Configure QueryClient with staleTime and gcTime
    - Modify `src/App.tsx` to configure the existing `queryClient` with:
      - `staleTime: 30 * 1000` (30 seconds)
      - `gcTime: 5 * 60 * 1000` (5 minutes)
      - `refetchOnWindowFocus: false`
      - `retry: 1`
    - _Requirements: 3.1, 3.2_

  - [x] 7.2 Define standardized query keys
    - Create `src/features/sk-management/utils/queryKeys.ts`
    - Define `SK_QUERY_KEYS` object with `all`, `list(filters)`, `detail(id)`, `candidates(search, page)`, `templates`, `revisions`, `pending`
    - Create `src/features/dashboard/utils/queryKeys.ts` with `DASHBOARD_QUERY_KEYS`
    - _Requirements: 3.3_

  - [x] 7.3 Add placeholderData to SK list query
    - Modify the SK list page query hook to use `placeholderData: keepPreviousData` (from TanStack Query)
    - Ensure cached data renders immediately on navigation while background refetch occurs
    - _Requirements: 3.4_

- [x] 8. Optimistic updates for SK approval
  - [x] 8.1 Create useSkBatchApproval hook with optimistic updates
    - Create `src/features/sk-management/hooks/useSkBatchApproval.ts`
    - Implement `useMutation` with `onMutate` that cancels outgoing queries, snapshots previous data, and optimistically updates cache
    - Implement `onError` rollback to previous state with Sonner toast error (5s duration)
    - Implement `onSuccess` that invalidates SK and dashboard query keys
    - Track in-flight mutation IDs to prevent duplicate submissions
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 8.2 Write property test for optimistic rollback (Property 11)
    - **Property 11: Optimistic update rollback on failure**
    - Create `src/features/sk-management/__tests__/optimisticRollback.property.test.ts`
    - Use `fast-check` to generate random SK states and simulate server failures
    - Assert cache reverts to exact pre-mutation state on error
    - Run 100 iterations
    - **Validates: Requirements 8.3**

  - [x] 8.3 Write property test for cache reconciliation (Property 12)
    - **Property 12: Cache reconciliation with server response**
    - In same test file, assert that after successful mutation, cache matches server response exactly
    - Run 100 iterations
    - **Validates: Requirements 8.4**

  - [x] 8.4 Write property test for duplicate mutation prevention (Property 13)
    - **Property 13: Duplicate mutation prevention**
    - Assert that triggering approval while in-flight does not send additional request
    - Run 100 iterations with randomized timing
    - **Validates: Requirements 8.5**

  - [x] 8.5 Write property test for targeted invalidation (Property 5)
    - **Property 5: Targeted query invalidation**
    - Create `src/features/sk-management/__tests__/queryInvalidation.property.test.ts`
    - Use `fast-check` to generate random query key sets
    - Assert only SK-related and dashboard keys are invalidated, other keys untouched
    - Run 100 iterations
    - **Validates: Requirements 3.3**

- [x] 9. Batched document generator
  - [x] 9.1 Implement batched generation with progress and cancellation
    - Create `src/features/sk-management/utils/generateSkBatched.ts`
    - Implement batch processing with `BATCH_SIZE = 5`
    - Add `onProgress(completed, total)` callback invoked after each batch
    - Add `AbortSignal` support for cancellation (stops after current batch)
    - Yield to browser event loop with `requestAnimationFrame` between batches
    - Implement partial failure: continue on individual doc failure, collect failures
    - Return `{ generated, failures }` result
    - _Requirements: 6.1, 6.2, 6.4, 6.6_

  - [x] 9.2 Implement batched API sync with concurrent requests
    - Add `syncInBatches(results, concurrency = 10)` function in same file
    - Batch API calls into groups of 10 concurrent requests
    - Track sync failures separately, provide retry capability
    - _Requirements: 6.3, 6.5_

  - [x] 9.3 Integrate batched generator into SkGeneratorPage
    - Modify `src/features/sk-management/SkGeneratorPage.tsx`
    - Replace existing sequential generation with `generateSkBatched`
    - Add progress indicator showing "8/20 (40%)" format
    - Add cancel button that triggers `AbortController.abort()`
    - Show failure summary dialog at end with retry option for failed items
    - _Requirements: 6.1, 6.4, 6.5, 6.6_

  - [x] 9.4 Write property test for partial failure resilience (Property 14)
    - **Property 14: Document generation partial failure resilience**
    - Create `src/features/sk-management/__tests__/batchedGenerator.property.test.ts`
    - Use `fast-check` to generate N teachers with M random failures
    - Assert exactly N-M successes and M failure entries
    - Run 100 iterations
    - **Validates: Requirements 6.4**

  - [x] 9.5 Write property test for progress reporting (Property 15)
    - **Property 15: Batched progress reporting**
    - Assert progress callback invoked ⌈N/5⌉ times with monotonically increasing count
    - Run 100 iterations with randomized N
    - **Validates: Requirements 6.1**

- [x] 10. Lazy loading and code splitting
  - [x] 10.1 Move heavy libraries to dynamic imports in SkGeneratorPage
    - Modify `src/features/sk-management/SkGeneratorPage.tsx`
    - Replace top-level `import JSZip`, `import PizZip`, `import Docxtemplater`, `import QRCode` with dynamic `import()` inside the generate handler
    - Ensure these libraries are NOT in the initial bundle chunks
    - _Requirements: 9.2_

  - [x] 10.2 Replace PageLoader spinner with CSS skeleton placeholders
    - Create `src/components/common/SkeletonPage.tsx` with CSS-only animated skeleton shapes
    - Replace `<PageLoader />` in `App.tsx` Suspense fallback with `<SkeletonPage />`
    - No additional JS library imports for skeleton animation (pure CSS)
    - _Requirements: 9.3_

  - [x] 10.3 Add chunk error boundary with retry
    - Create `src/components/common/ChunkErrorBoundary.tsx`
    - Catch dynamic import failures (ChunkLoadError)
    - Display "Gagal memuat halaman" message with retry button
    - Retry re-attempts the import without full page reload
    - Wrap lazy-loaded routes with this boundary in `App.tsx`
    - _Requirements: 9.4_

  - [x] 10.4 Write unit test for skeleton and error boundary
    - Test that SkeletonPage renders without JS library dependencies
    - Test that ChunkErrorBoundary shows retry button on import failure
    - Test that retry re-attempts the dynamic import
    - _Requirements: 9.3, 9.4_

- [x] 11. API response payload optimization for dashboard
  - [x] 11.1 Optimize dashboard endpoint to return only aggregates
    - Ensure `DashboardController` stats methods return only COUNT/SUM values
    - Remove any individual record data from dashboard responses
    - _Requirements: 7.3_

  - [x] 11.2 Add background refetch for dashboard statistics
    - Modify dashboard page query to use `refetchInterval: 60 * 1000` (60 seconds)
    - Ensure `refetchIntervalInBackground: false` so it only refetches when tab is active
    - On refetch failure, keep displaying stale data without error indicator
    - _Requirements: 10.4, 10.5_

- [x] 12. Integration and wiring
  - [x] 12.1 Wire cache invalidation across all SK mutation paths
    - Ensure single SK status update (`SkDetailPage`) also invalidates dashboard cache
    - Ensure SK submission and revision endpoints trigger cache invalidation for affected school
    - Update `useSkBatchApproval` hook to invalidate both SK and dashboard query keys on success
    - _Requirements: 4.3, 3.3_

  - [x] 12.2 Verify all route components use React.lazy
    - Audit `src/App.tsx` to confirm all route-level page components use `React.lazy()`
    - Add any missing lazy imports for new pages
    - _Requirements: 9.1_

  - [x] 12.3 Write integration test for batch approval end-to-end
    - Create `backend/tests/Feature/BatchApprovalIntegrationTest.php`
    - Test full flow: submit batch → verify DB state → verify cache invalidated → verify response shape
    - Test boundary: exactly 50 items succeeds, 51 items rejected
    - Test Redis fallback when connection refused
    - _Requirements: 1.1, 1.5, 1.6, 1.7, 4.5_

  - [x] 12.4 Write performance benchmark assertions
    - Add assertions in integration test: batch approval of 50 docs < 3 seconds
    - Add assertion: SK list with filters < 500ms at p95
    - Add assertion: dashboard stats < 2 seconds for super_admin
    - _Requirements: 1.1, 2.1, 10.1_

- [x] 13. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Backend uses PHP (Laravel 12) with Pest for testing; Frontend uses TypeScript with vitest + fast-check for property tests
- The existing migration `2026_04_15_000001_add_performance_indexes.php` already covers `sk_documents(school_id, status)`, `notifications(user_id, is_read)`, `teachers(school_id, is_active)`, and `activity_logs(school_id, id)` — new migration only adds missing indexes

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "7.1", "7.2"] },
    { "id": 1, "tasks": ["1.2", "2.1", "2.2", "7.3", "10.2", "10.3"] },
    { "id": 2, "tasks": ["2.3", "2.4", "2.5", "2.6", "10.1", "10.4"] },
    { "id": 3, "tasks": ["4.1", "5.1", "5.2", "5.3", "11.1"] },
    { "id": 4, "tasks": ["4.2", "4.3", "4.4", "4.5", "5.4", "5.5", "5.6", "11.2"] },
    { "id": 5, "tasks": ["4.6", "8.1", "9.1"] },
    { "id": 6, "tasks": ["8.2", "8.3", "8.4", "8.5", "9.2"] },
    { "id": 7, "tasks": ["9.3", "9.4", "9.5"] },
    { "id": 8, "tasks": ["12.1", "12.2"] },
    { "id": 9, "tasks": ["12.3", "12.4"] }
  ]
}
```
