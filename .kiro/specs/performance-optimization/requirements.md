# Requirements Document

## Introduction

Performance optimization for the SIMMACI application, targeting the primary user complaint of slowness after approving SK submissions (pengajuan SK), and improving overall application responsiveness. The optimization covers backend API response times, database query efficiency, caching strategies, and frontend data fetching and rendering patterns.

## Glossary

- **System**: The SIMMACI web application (frontend + backend combined)
- **Backend**: The Laravel 12 API server handling business logic and data access
- **Frontend**: The React 19 SPA handling UI rendering and client-side data management
- **Query_Client**: The TanStack React Query v5 instance managing frontend server state
- **SK_Approval_API**: The `PATCH /api/sk-documents/batch-status` endpoint processing batch SK approvals
- **SK_List_API**: The `GET /api/sk-documents` endpoint returning paginated SK documents
- **Dashboard_API**: The dashboard statistics endpoints (`/api/dashboard/stats`, `/api/dashboard/school-stats`)
- **Cache_Layer**: The Redis-backed caching system for frequently accessed data
- **Batch_Approval_Handler**: The `batchUpdateStatus` method in `SkDocumentController`
- **NIM_Enrichment**: The post-query logic that enriches SK documents with teacher NIM data
- **Document_Generator**: The client-side DOCX generation system using docxtemplater and PizZip

## Requirements

### Requirement 1: SK Batch Approval Response Time

**User Story:** As an admin_yayasan, I want the SK batch approval process to complete within a reasonable time, so that I do not experience UI freezes or timeouts when approving multiple SK submissions.

#### Acceptance Criteria

1. WHEN a batch approval request with up to 50 SK documents is submitted, THE SK_Approval_API SHALL return a response within 3 seconds measured from request receipt to response dispatch on the server
2. WHEN a batch approval request is processed, THE Batch_Approval_Handler SHALL load all SK documents with their teacher relationships in a single eager-loaded query instead of individual queries per document
3. WHEN a batch approval request creates notifications, THE Batch_Approval_Handler SHALL insert all notification records using a bulk insert operation instead of individual inserts per SK document
4. WHEN a batch approval request creates approval history records, THE Batch_Approval_Handler SHALL insert all approval history records using a bulk insert operation
5. IF a batch approval request contains more than 50 SK document IDs, THEN THE SK_Approval_API SHALL reject the request with a validation error indicating the maximum batch size of 50 has been exceeded
6. IF one or more SK documents in a batch cannot be processed due to invalid state or missing data, THEN THE Batch_Approval_Handler SHALL skip the failed documents, continue processing the remaining documents, and return a response that includes both the count of successfully processed documents and a list of IDs that failed with their failure reasons
7. WHEN a batch approval request is processed, THE Batch_Approval_Handler SHALL wrap all database write operations for the batch within a single database transaction so that either all documents in the batch are updated or none are committed

### Requirement 2: SK List API Query Optimization

**User Story:** As an operator, I want the SK document list to load quickly, so that I can efficiently manage my school's SK submissions.

#### Acceptance Criteria

1. WHEN the SK list endpoint is called with any combination of filters (status, jenis_sk, search, school_id), THE SK_List_API SHALL return paginated results with a server-side response time at or below 500 milliseconds at the 95th percentile, measured for datasets up to 10,000 SK documents per tenant, with a page size between 1 and 100 items (default 25)
2. WHEN the NIM enrichment logic executes for SK items whose teacher lacks a nomor_induk_maarif, THE SK_List_API SHALL resolve matching teachers using a SQL WHERE clause with case-insensitive comparison (e.g., ILIKE or LOWER()) scoped to the relevant school_id(s), without loading all teachers into PHP memory and without using PHP-level collection filtering for name matching
3. WHEN the SK list is filtered by status and school_id, THE SK_List_API SHALL produce a query plan that uses an index scan (Index Scan or Index Only Scan) on the composite index `sk_docs_school_status_idx`, verifiable via PostgreSQL EXPLAIN output
4. IF the SK list query exceeds 500 milliseconds, THEN THE SK_List_API SHALL still return the paginated result set without terminating the request, and SHALL log the slow query duration for monitoring purposes

### Requirement 3: Frontend Query Client Configuration

**User Story:** As a user navigating between pages, I want previously loaded data to remain available without unnecessary refetching, so that page transitions feel instant.

#### Acceptance Criteria

1. THE Query_Client SHALL be configured with a default `staleTime` of 30 seconds so that queries fetched within the last 30 seconds are served from cache without triggering a background refetch on component mount or page navigation
2. THE Query_Client SHALL be configured with a default `gcTime` (garbage collection time) of 5 minutes so that inactive query data remains in memory for up to 300 seconds after the last subscriber unmounts, enabling instant cache hits on back-navigation
3. WHEN a mutation succeeds on an SK-related endpoint (sk-documents, sk-templates, sk-candidates-generator, sk-revisions, or sk-pending), THE Frontend SHALL invalidate only the query keys directly related to the mutated resource (e.g., the list query key and, if applicable, the detail query key for the affected item) instead of refetching all cached queries
4. WHEN the SK list page is navigated to and cached data from a prior fetch of the same query key exists in the Query_Client cache, THE Frontend SHALL supply that cached data via `placeholderData` so that the page renders content immediately while a background refetch occurs, preventing a full loading skeleton from appearing between navigation
5. IF the Query_Client cache contains no prior data for a query on initial page load, THEN THE Frontend SHALL display the standard loading state without errors until the first fetch completes within a maximum timeout of 10 seconds

### Requirement 4: Redis Cache Integration for Frequently Accessed Data

**User Story:** As a system administrator, I want the application to cache frequently accessed data in Redis, so that database load is reduced and response times improve.

#### Acceptance Criteria

1. IF the environment variable CACHE_STORE is set to "redis", THEN THE Backend SHALL use the Redis cache store for cache operations
2. WHEN any dashboard statistics endpoint (stats, schoolStats, getSchoolStatistics, charts, skStatistics, skTrend, schoolBreakdown) is requested, THE Dashboard_API SHALL serve cached results scoped to the requesting user's role and school_id, with a time-to-live of 60 seconds before recalculating from the database
3. WHEN an SK document status changes, THE Cache_Layer SHALL invalidate all dashboard statistics cache entries for the affected school_id within 1 second of the status change
4. WHEN school data is requested by the application for user context resolution or school lookups, THE Cache_Layer SHALL cache the school record keyed by school_id with a time-to-live of 5 minutes
5. IF Redis is unavailable at runtime, THEN THE Backend SHALL fall back to the database cache driver transparently, continuing to serve requests without raising exceptions or returning error responses to the client
6. THE Cache_Layer SHALL scope all dashboard cache keys by user role and school_id so that operator-scoped data is never served to a different tenant

### Requirement 5: Database Index Optimization

**User Story:** As a system administrator, I want database queries to use optimal indexes, so that query execution times remain low as data grows.

#### Acceptance Criteria

1. THE Backend SHALL add a composite index on `approval_histories(document_id, document_type)` to support queries that filter approval records by both document identifier and document type simultaneously
2. THE Backend SHALL add a composite index on `notifications(user_id, is_read)` to support queries that filter notifications by user and read status simultaneously
3. THE Backend SHALL add a composite index on `sk_documents(school_id, created_at DESC)` to support tenant-scoped queries that list documents in reverse chronological order
4. IF an index with the same column combination already exists on the target table, THEN THE Backend SHALL skip index creation without raising an error
5. WHEN the migration adding indexes is executed, THE Backend SHALL complete within 30 seconds per index on tables containing up to 1,000,000 rows

### Requirement 6: Frontend Document Generation Performance

**User Story:** As an admin_yayasan generating SK documents for multiple teachers, I want the generation process to provide progress feedback and not freeze the browser, so that I can continue working during generation.

#### Acceptance Criteria

1. WHEN generating SK documents for more than 5 teachers, THE Document_Generator SHALL process documents in batches of 5 and display a progress indicator showing the number of completed documents out of the total selected (e.g., "8/20") and the corresponding percentage, updated after each batch completes
2. WHEN generating SK documents, THE Document_Generator SHALL yield control to the browser event loop for at least one animation frame (requestAnimationFrame or setTimeout 0) between each batch so that the user can interact with UI elements (scroll, click cancel) between batches
3. WHEN syncing generated SK documents to the backend, THE Document_Generator SHALL batch API calls into groups of 10 concurrent requests instead of making individual sequential calls per document
4. IF a document generation fails for one teacher, THEN THE Document_Generator SHALL continue processing remaining teachers and display a summary at the end listing each failed teacher's name, the error reason, and provide a retry option for the failed items
5. IF an API sync call fails for one or more documents in a batch, THEN THE Document_Generator SHALL retain the failed sync payloads, display the count of sync failures to the user, and provide a manual retry action that re-attempts only the failed syncs
6. WHEN a generation process is in progress, THE Document_Generator SHALL display a cancel button that, when clicked, stops processing after the current batch completes and retains all documents generated up to that point

### Requirement 7: API Response Payload Optimization

**User Story:** As a user on a slow network connection, I want API responses to contain only the data needed for the current view, so that page loads are faster.

#### Acceptance Criteria

1. WHEN the SK list endpoint is called, THE SK_List_API SHALL return only the following fields per record: id, nomor_sk, nama, jenis_sk, status, unit_kerja, created_at, and the nested teacher.nomor_induk_maarif (including NIM values enriched from matching teacher records)
2. WHEN the SK list endpoint is called, THE SK_List_API SHALL exclude all other model attributes (jabatan, file_url, surat_permohonan_url, qr_code, revision_status, revision_reason, revision_data, archived_at, archived_by, archive_reason, nomor_permohonan, tanggal_permohonan, rejection_reason, ijazah_url) from the response payload
3. WHEN the dashboard statistics endpoint is called, THE Dashboard_API SHALL return only aggregated count values (totals and per-status breakdowns) without including any individual record data in the response payload
4. WHEN the SK list endpoint returns paginated results, THE SK_List_API SHALL include pagination metadata containing total, per_page (default: 25, maximum: 100), and current_page fields, and SHALL NOT duplicate the full record data outside the paginated data array

### Requirement 8: Optimistic Updates for SK Approval

**User Story:** As an admin_yayasan approving SK submissions, I want the UI to reflect my approval action immediately, so that the interface feels responsive even before the server confirms.

#### Acceptance Criteria

1. WHEN an SK approval action is triggered, THE Frontend SHALL update the local query cache to reflect the item's status as "Approved" within 100ms of the user's click, before the server responds
2. WHILE an optimistic update is in-flight awaiting server confirmation, THE Frontend SHALL disable the approve and reject buttons for that item to prevent duplicate submissions
3. IF the server returns an HTTP error or network failure after an optimistic update, THEN THE Frontend SHALL revert the local query cache to the previous state and display a Sonner toast notification containing the server error message (or a generic fallback if unavailable) for at least 5 seconds
4. WHEN a batch approval completes successfully on the server, THE Frontend SHALL replace the optimistically-updated cache entries with the server response data to ensure local state matches the confirmed server state
5. IF the user triggers an approval action while a previous approval for the same item is still in-flight, THEN THE Frontend SHALL ignore the duplicate action and not send an additional server request

### Requirement 9: Lazy Loading and Code Splitting

**User Story:** As a user loading the application for the first time, I want only the code needed for the current page to be downloaded, so that the initial load time is minimized.

#### Acceptance Criteria

1. THE Frontend SHALL lazy-load all route-level page components (components registered as route elements in App.tsx) using React.lazy with route-based code splitting
2. THE Frontend SHALL not include JSZip, PizZip, Docxtemplater, or QRCode in the initial bundle chunks; these libraries SHALL be loaded via dynamic import only when the user initiates document generation (e.g., clicks the generate button in SkGeneratorPage)
3. WHEN a lazy-loaded page is loading, THE Frontend SHALL display a skeleton placeholder composed of static CSS-only animated shapes (no additional JS library imports) that approximates the target page layout, instead of a full-page spinner
4. IF a dynamic import fails due to network error or chunk loading failure, THEN THE Frontend SHALL display an error message indicating the module failed to load and provide a retry action that re-attempts the import without requiring a full page reload
5. THE Frontend initial bundle (vendor + app entry chunks, excluding lazy-loaded route chunks) SHALL not exceed 250 KB gzipped as measured by the Vite build output

### Requirement 10: Backend Query Optimization for Dashboard

**User Story:** As a super_admin viewing the dashboard, I want statistics to load quickly even with data across all schools, so that I get an immediate overview of the system state.

#### Acceptance Criteria

1. WHEN the dashboard stats endpoint is called, THE Dashboard_API SHALL return the complete response within 2 seconds by executing aggregate count queries (COUNT, SUM) without loading model instances into memory
2. WHEN recent activity logs are fetched, THE Dashboard_API SHALL return the 15 most recent entries, eager-load the causer relationship, and resolve school names from a cache with a time-to-live of 300 seconds instead of executing individual `School::find()` calls per log entry
3. IF the school name cache is empty or expired WHEN activity logs are fetched, THEN THE Dashboard_API SHALL populate the cache by executing a single query to retrieve all school id-name pairs before mapping log entries
4. WHILE the dashboard is displayed, THE Frontend SHALL refresh statistics every 60 seconds using a background refetch that retains the previously displayed data and does not show loading indicators
5. IF a background refetch fails, THEN THE Frontend SHALL continue displaying the last successfully fetched data and retry on the next 60-second interval without showing an error indicator to the user
