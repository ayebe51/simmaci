# Implementation Plan: SK Template Upload

## Overview

Implement a dynamic SK template management system that replaces hardcoded bundled `.docx` files with an uploadable, activatable template store. The backend exposes a REST API backed by `SkTemplateService` and a new `sk_templates` table. The frontend adds a management page for `super_admin` and updates `SkGeneratorPage` to resolve templates via the `useSkTemplate` hook.

## Tasks

- [x] 1. Database migration for `sk_templates` table
  - Create migration file at `backend/database/migrations/` for the `sk_templates` table
  - Columns: `id`, `sk_type` (varchar 20), `original_filename` (varchar 255), `file_path` (varchar 500), `disk` (varchar 20, default `public`), `is_active` (boolean, default false), `uploaded_by` (varchar 255), `created_at`, `updated_at`, `deleted_at`
  - Add indexes: `idx_sk_templates_sk_type`, `idx_sk_templates_is_active`, `idx_sk_templates_sk_type_active`
  - _Requirements: 1.1_

- [x] 2. `SkTemplate` Eloquent model
  - Create `backend/app/Models/SkTemplate.php`
  - Use `SoftDeletes` trait; no `HasTenantScope` or `AuditLogTrait` (global resource, explicit logging in service)
  - `$fillable`: `sk_type`, `original_filename`, `file_path`, `disk`, `is_active`, `uploaded_by`
  - Cast `is_active` to boolean
  - Add `scopeActive($query)` and `scopeForType($query, string $skType)` query scopes
  - _Requirements: 1.1, 2.1_

- [x] 3. `StoreSkTemplateRequest` form request
  - Create `backend/app/Http/Requests/SkTemplate/StoreSkTemplateRequest.php`
  - Rules: `file` → `required|file|mimes:docx|max:10240`; `sk_type` → `required|string|in:gty,gtt,kamad,tendik`
  - Indonesian validation messages for both fields
  - _Requirements: 1.2, 1.3, 1.4_

- [x] 4. `SkTemplateService` business logic
  - Create `backend/app/Services/SkTemplateService.php`
  - `store(UploadedFile $file, string $skType, User $uploader): SkTemplate` — store file to `sk-templates/{uuid}.docx` on the resolved disk (S3 if `AWS_ACCESS_KEY_ID` set, else `public`), create model record, call `ActivityLog::log('upload_sk_template', ...)`
  - `activate(SkTemplate $template, User $activator): SkTemplate` — wrap in DB transaction: set `is_active = false` for all same `sk_type`, set `is_active = true` for the given template, call `ActivityLog::log('activate_sk_template', ...)`
  - `delete(SkTemplate $template, User $deleter): void` — if `is_active`, set `is_active = false` first, then soft-delete, call `ActivityLog::log('delete_sk_template', ...)`
  - `getDownloadUrl(SkTemplate $template): string` — return `Storage::disk($template->disk)->temporaryUrl(...)` for S3 or `Storage::disk($template->disk)->url(...)` for public; throw 404 if file missing
  - `resolveActiveTemplate(string $skType): ?SkTemplate` — return `SkTemplate::active()->forType($skType)->first()` or null
  - _Requirements: 1.1, 1.5, 3.1, 3.2, 4.1, 4.2, 4.3, 5.1, 5.2, 6.1_

  - [x] 4.1 Write unit tests for `SkTemplateService`
    - Test `store()`: verify record fields match inputs, verify `ActivityLog` called with correct event and causer
    - Test `activate()`: verify single-active invariant — after activating template B of type `gty`, template A of same type has `is_active = false`; verify `ActivityLog` called
    - Test `delete()`: verify soft-delete, verify active status cleared when deleting active template, verify `ActivityLog` called
    - Test `getDownloadUrl()`: verify signed URL for S3 disk, direct URL for public disk, exception when file missing
    - Test `resolveActiveTemplate()`: returns active template when one exists, returns null when none
    - _Requirements: 1.1, 1.5, 3.1, 3.2, 4.1, 4.2, 4.3, 5.1, 5.2, 6.1_

- [x] 5. Property-based tests for backend invariants
  - Install or confirm `eris/eris` is available in `backend/composer.json`; add to `require-dev` if missing
  - Create `backend/tests/Feature/SkTemplate/SkTemplatePropertyTest.php`

  - [x] 5.1 Write property test for upload field mapping (Property 1)
    - Generate random valid `(file, sk_type)` pairs; call `store()`; assert `sk_type`, `original_filename`, `uploaded_by` match inputs
    - **Property 1: Upload creates a persisted record with correct fields**
    - **Validates: Requirements 1.1, 1.6**

  - [x] 5.2 Write property test for invalid file type rejection (Property 2)
    - Generate random files with non-docx extensions; assert upload endpoint returns 422 and no record is created
    - **Property 2: Invalid file type is always rejected**
    - **Validates: Requirements 1.2**

  - [x] 5.3 Write property test for invalid sk_type rejection (Property 3)
    - Generate random strings not in `{gty, gtt, kamad, tendik}`; assert upload endpoint returns 422
    - **Property 3: Invalid sk_type is always rejected**
    - **Validates: Requirements 1.4**

  - [x] 5.4 Write property test for upload activity log (Property 4)
    - For any successful upload, assert `ActivityLog` record exists with `event = 'upload_sk_template'`, correct `causer_id`, and `sk_type` in properties
    - **Property 4: Upload always produces an activity log entry**
    - **Validates: Requirements 1.5**

  - [x] 5.5 Write property test for activation invariant (Property 5)
    - Generate random sequences of activate operations on templates of the same `sk_type`; after each activation assert exactly one template for that type has `is_active = true`
    - **Property 5: At most one active template per sk_type**
    - **Validates: Requirements 3.1, 3.5**

  - [x] 5.6 Write property test for activation activity log (Property 6)
    - For any successful activation, assert `ActivityLog` record exists with `event = 'activate_sk_template'`, correct `causer_id`, template `id` and `sk_type` in properties
    - **Property 6: Activation always produces an activity log entry**
    - **Validates: Requirements 3.2**

  - [x] 5.7 Write property test for delete clears active status (Property 7)
    - For any active template, after deletion assert no template for that `sk_type` has `is_active = true`
    - **Property 7: Deleting an active template clears active status**
    - **Validates: Requirements 4.2**

  - [x] 5.8 Write property test for deletion activity log (Property 8)
    - For any successful deletion, assert `ActivityLog` record exists with `event = 'delete_sk_template'`, correct `causer_id`, template `id` and `sk_type` in properties
    - **Property 8: Deletion always produces an activity log entry**
    - **Validates: Requirements 4.3**

  - [x] 5.9 Write property test for list ordering invariant (Property 9)
    - Insert templates in random order; assert list endpoint returns them ordered by `sk_type` asc, `created_at` desc
    - **Property 9: List ordering invariant**
    - **Validates: Requirements 2.1**

  - [x] 5.10 Write property test for list filtering by sk_type (Property 10)
    - For any `sk_type` filter value, assert all returned records match that `sk_type` and no other `sk_type` appears
    - **Property 10: List filtering by sk_type**
    - **Validates: Requirements 2.2**

  - [x] 5.11 Write property test for non-super_admin access denial (Property 11)
    - For any authenticated user with role not `super_admin`, assert write endpoints (upload, activate, delete, download) return 403
    - **Property 11: Non-super_admin users are always denied write access**
    - **Validates: Requirements 8.2, 8.3**

  - [x] 5.12 Write property test for list response never exposes file_path (Property 16)
    - For any list response, assert `file_path` field is absent from every item in the response body
    - **Property 16: List response never exposes raw storage paths**
    - **Validates: Requirements 8.4**

- [x] 6. `SkTemplateController` and routes
  - Create `backend/app/Http/Controllers/Api/SkTemplateController.php` using `ApiResponse` trait
  - `index()` — list all templates ordered by `sk_type` asc, `created_at` desc; support `?sk_type=` filter; exclude `file_path` from response
  - `store(StoreSkTemplateRequest $request)` — delegate to `SkTemplateService::store()`, return 201
  - `activate(SkTemplate $template)` — delegate to `SkTemplateService::activate()`, return 200
  - `destroy(SkTemplate $template)` — delegate to `SkTemplateService::delete()`, return 200
  - `download(SkTemplate $template)` — delegate to `SkTemplateService::getDownloadUrl()`, return `{ data: { url } }`
  - `active(Request $request)` — resolve active template for `?sk_type=` param via `SkTemplateService::resolveActiveTemplate()`; include `file_url` in response; return 404 if none
  - Register routes in `backend/routes/api.php` under `auth:sanctum` middleware:
    - `GET /sk-templates` and `GET /sk-templates/active` — auth only
    - `POST /sk-templates`, `POST /sk-templates/{id}/activate`, `DELETE /sk-templates/{id}`, `GET /sk-templates/{id}/download` — `role:super_admin`
  - _Requirements: 1.1, 1.6, 2.1, 2.2, 2.3, 3.1, 3.3, 3.4, 4.1, 4.4, 5.1, 5.3, 6.1, 8.1, 8.2, 8.3, 8.4_

  - [x] 6.1 Write integration tests for all endpoints
    - Create `backend/tests/Feature/SkTemplate/SkTemplateControllerTest.php`
    - Test `GET /sk-templates`: returns ordered list, supports `sk_type` filter, excludes `file_path`
    - Test `POST /sk-templates`: valid upload creates record and returns 201; invalid file returns 422; invalid `sk_type` returns 422; non-super_admin returns 403
    - Test `POST /sk-templates/{id}/activate`: sets single active, returns 200; non-existent id returns 404; non-super_admin returns 403
    - Test `DELETE /sk-templates/{id}`: soft-deletes record, clears active if was active, returns 200; non-super_admin returns 403
    - Test `GET /sk-templates/{id}/download`: returns URL for super_admin; returns 403 for non-super_admin
    - Test `GET /sk-templates/active`: returns active template with `file_url`; returns 404 when none active
    - _Requirements: 1.1, 1.2, 1.4, 1.6, 2.1, 2.2, 3.1, 3.3, 4.1, 5.1, 6.1, 8.2, 8.3, 8.4_

- [x] 7. Backend checkpoint — ensure all tests pass
  - Run `php artisan test --filter=SkTemplate` and confirm all unit, property, and integration tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. `skTemplateApi` additions to `src/lib/api.ts`
  - Add `skTemplateApi` export to `src/lib/api.ts` with methods: `list`, `upload`, `activate`, `delete`, `downloadUrl`, `getActive`
  - `upload` uses `FormData` with `Content-Type: multipart/form-data`
  - `getActive(skType)` calls `GET /sk-templates/active?sk_type={skType}`
  - _Requirements: 6.1, 7.3, 7.4, 7.5_

- [x] 9. `useSkTemplate` hook
  - Create `src/features/sk-management/hooks/useSkTemplate.ts`
  - Accept `skType: string` parameter; return `{ templateUrl: string | null, isLoading: boolean, error: string | null }`
  - Use TanStack Query with `queryKey: ['sk-template-active', skType]`
  - On success: return `data.file_url` from the active template response
  - On HTTP 404 or null result: silently return static fallback path `/templates/sk-{skType}-template.docx`
  - On 5xx or network error: set `error` with descriptive message; return `templateUrl: null`
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 9.1 Write unit tests for `useSkTemplate` hook
    - Mock `skTemplateApi.getActive`; verify `templateUrl` equals `file_url` when active template exists
    - Verify fallback to `/templates/sk-{skType}-template.docx` on 404 response
    - Verify `error` is set on 5xx response
    - Verify TanStack Query cache prevents duplicate requests for same `skType`
    - **Property 12: Template resolution uses active uploaded template when available**
    - **Property 13: Template resolution falls back to static file when no active template exists**
    - **Property 14: Template resolution is cached within a generation session**
    - **Validates: Requirements 6.1, 6.2, 6.4**

- [x] 10. `SkTemplateManagementPage` component
  - Create `src/features/sk-management/SkTemplateManagementPage.tsx`
  - Page header with title "Manajemen Template SK"
  - Upload form card using React Hook Form + Zod (`uploadFormSchema`): file picker (`.docx` only) + `sk_type` select (`gty`, `gtt`, `kamad`, `tendik`) + submit button with loading state
  - Inline Zod validation: reject non-`.docx` files and files > 10 MB before API call
  - Templates list grouped into 4 sections by `sk_type` (GTY, GTT, Kamad, Tendik)
  - Each template row: `original_filename`, `uploaded_by`, `created_at` formatted, active badge, Activate / Download / Delete action buttons
  - Activate: call `skTemplateApi.activate`, optimistically update active badge, revert on failure, invalidate query
  - Delete: show Shadcn `AlertDialog` confirmation before calling `skTemplateApi.delete`, remove from list on success
  - Download: call `skTemplateApi.downloadUrl`, open returned URL in new tab
  - Use TanStack Query (`useQuery` for list, `useMutation` for upload/activate/delete) with `queryKey: ['sk-templates']`
  - Success/error feedback via Sonner toasts
  - All UI elements use Shadcn/UI components
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [x] 10.1 Write unit tests for `SkTemplateManagementPage`
    - Render with mocked TanStack Query data; verify templates are grouped by `sk_type`
    - Test Zod schema: non-`.docx` file produces inline error, no API call made
    - Test Zod schema: file > 10 MB produces inline error, no API call made
    - Test delete confirmation dialog appears before API call
    - Test optimistic activate update reverts on mutation failure
    - **Property 15: Client-side validation rejects invalid files before API call**
    - **Validates: Requirements 7.2, 7.5, 7.7**

- [x] 11. Register route and guard in frontend router
  - Add route `/dashboard/sk-templates` in the frontend router pointing to `SkTemplateManagementPage`
  - Guard the route so only `super_admin` can access it (redirect or show 403 for other roles), consistent with existing `ProtectedLayout` role-check pattern
  - Add navigation link to the route in the sidebar/settings area accessible to `super_admin`
  - _Requirements: 7.1_

- [x] 12. Update `SkGeneratorPage` to use `useSkTemplate` hook
  - In `src/features/sk-management/SkGeneratorPage.tsx`, replace the `settingApi.get(templateId)` calls inside `handleGenerate` with calls to the `useSkTemplate` hook (one per SK type)
  - Call `useSkTemplate` for each of the four SK types (`gty`, `gtt`, `kamad`, `tendik`) at the top of the component
  - In `handleGenerate`, read `templateUrl` from the hook result instead of fetching from `settingApi`
  - If `templateUrl` is null and `error` is set, show a toast error and abort generation for that SK type
  - Remove the `templateCache` fetch-from-settingApi block; the hook's TanStack Query cache serves as the in-session cache
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 13. Frontend checkpoint — ensure all tests pass
  - Run `npm run test -- --run` and confirm all Vitest unit tests pass
  - Run `npm run lint` and fix any ESLint errors
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (activation invariant, filtering, access control, etc.)
- Unit tests validate specific examples and edge cases
- The `sk_templates` table has no `school_id` — it is a global resource, not tenant-scoped
- The `file_path` column is intentionally excluded from all list/single-record API responses (only exposed via the dedicated download endpoint)
