# Implementation Plan: Data Normalization

## Overview

This implementation plan converts the data normalization design into discrete coding tasks. The feature implements automatic text standardization for school names (Title Case) and teacher names (UPPERCASE with preserved academic degrees) throughout the SIMMACI application. The implementation includes backend normalization service, controller integration, frontend autocomplete component, and a data migration command for existing records.

## Tasks

- [x] 1. Create NormalizationService with core normalization methods
  - Create `backend/app/Services/NormalizationService.php`
  - Implement `normalizeSchoolName()` method with Title Case conversion and abbreviation preservation (MI, MTs, MA, NU, SD, SMP, SMA, SMK)
  - Implement `normalizeTeacherName()` method with UPPERCASE conversion and degree preservation
  - Implement `parseAcademicDegrees()` protected method to extract degrees using regex pattern
  - Implement `formatDegree()` protected method for proper degree capitalization
  - Handle edge cases: null input, empty strings, special characters (apostrophes, hyphens)
  - Use multibyte-safe functions (`mb_strtoupper`, `mb_convert_case`)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.4, 2.5, 2.6, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [x] 1.1 Write unit tests for NormalizationService
  - Create `tests/Unit/Services/NormalizationServiceTest.php`
  - Test school name normalization: all uppercase, all lowercase, mixed case, abbreviation preservation
  - Test teacher name normalization: with degrees, without degrees, multiple degrees, special characters
  - Test edge cases: null input, empty strings, whitespace-only strings
  - _Requirements: 11.1, 11.2_

- [x] 1.2 Write property test for school name idempotence
  - **Property 3: School Name Idempotence**
  - **Validates: Requirements 1.5**
  - Create `tests/Property/SchoolNameNormalizationTest.php`
  - Verify `normalize(normalize(x)) == normalize(x)` for all valid school names
  - Use property-based testing library (Eris or Pest Property)
  - _Requirements: 11.3_

- [x] 1.3 Write property test for teacher name idempotence
  - **Property 7: Teacher Name Idempotence**
  - **Validates: Requirements 2.6**
  - Create `tests/Property/TeacherNameNormalizationTest.php`
  - Verify `normalize(normalize(x)) == normalize(x)` for all valid teacher names
  - _Requirements: 11.3_

- [x] 1.4 Write property test for normalization output validity
  - **Property 10: Normalization Returns Non-Null for Valid Inputs**
  - **Validates: Requirements 11.5**
  - Verify non-null, non-empty input produces non-null, non-empty output
  - Test both school and teacher normalization functions
  - _Requirements: 11.5_

- [x] 2. Integrate normalization into SkDocumentController
  - Inject `NormalizationService` via constructor dependency injection
  - Modify `submitRequest()` method to normalize `unit_kerja` and `nama` fields before processing
  - Modify `bulkRequest()` method to normalize all documents in the batch
  - Update school lookup to use case-insensitive `ILIKE` operator with normalized name
  - Ensure normalization happens before teacher upsert
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 7.1, 7.3_

- [x] 2.1 Write integration tests for SK submission normalization
  - Create tests in `tests/Feature/NormalizationIntegrationTest.php`
  - Test individual SK submission normalizes school and teacher names
  - Test bulk SK submission normalizes all records
  - Test case-insensitive school lookup
  - Verify normalized data is saved to database
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Integrate normalization into TeacherController
  - Inject `NormalizationService` via constructor dependency injection
  - Modify `store()` method to normalize `nama` and `unit_kerja` fields
  - Modify `update()` method to normalize `nama` and `unit_kerja` fields if present
  - Modify `import()` method to normalize all teacher names in bulk import
  - Update school lookup to use case-insensitive `ILIKE` operator
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 7.2_

- [x] 3.1 Write integration tests for teacher management normalization
  - Test teacher creation normalizes name
  - Test teacher update normalizes name
  - Test bulk import normalizes all names
  - Verify normalized data is saved to database
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 4. Create School API endpoint for autocomplete
  - Add `index()` method to `backend/app/Http/Controllers/Api/SchoolController.php`
  - Implement GET `/api/schools` endpoint
  - Support optional `search` query parameter (minimum 2 characters, case-insensitive ILIKE)
  - Apply tenant scoping: operators see only their school, admins see all schools
  - Return JSON with `id`, `nama`, `kecamatan` fields
  - Limit results to 50 records, ordered by `nama`
  - Add route to `routes/api.php` with `auth:sanctum` middleware
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 4.1 Write integration tests for School API endpoint
  - Test search filtering works case-insensitively
  - Test tenant scoping for operators
  - Test admins can see all schools
  - Test minimum 2 character search requirement
  - Test result limit and ordering
  - _Requirements: 6.1, 6.2, 6.4, 6.5_

- [x] 5. Checkpoint - Ensure all backend tests pass
  - Run `php artisan test` from backend directory
  - Verify all unit tests, property tests, and integration tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Create frontend SchoolAutocomplete component
  - Create `src/features/sk-management/components/SchoolAutocomplete.tsx`
  - Implement component using Shadcn/UI Combobox (Popover + Command components)
  - Use TanStack Query to fetch schools from `/api/schools` endpoint
  - Implement search with 300ms debounce
  - Display school name and kecamatan in dropdown options
  - Cache results for 5 minutes using TanStack Query `staleTime`
  - Show loading state while fetching
  - Display error message prop if validation fails
  - Support disabled state for operators with pre-assigned schools
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6_

- [x] 7. Add school API service method
  - Add `list()` method to `src/services/schoolApi.ts` (or create if doesn't exist)
  - Accept optional `search` parameter
  - Use `apiClient` from `src/lib/api.ts`
  - Return typed response with School interface
  - Handle errors gracefully
  - _Requirements: 6.1, 6.2_

- [x] 8. Integrate SchoolAutocomplete into SkSubmissionPage
  - Import `SchoolAutocomplete` component in `src/features/sk-management/SkSubmissionPage.tsx`
  - Replace free-text `unit_kerja` Input with SchoolAutocomplete for operators
  - Keep free-text Input for super admins (allow creating new schools)
  - Pre-populate and disable field for operators with assigned school
  - Wire up to React Hook Form using `form.watch()` and `form.setValue()`
  - Pass validation error from form state to component
  - _Requirements: 5.1, 5.4, 5.5, 10.3_

- [x] 9. Add frontend validation for school selection
  - Update Zod schema in SkSubmissionPage to require `unit_kerja`
  - Add validation error message in Indonesian: "Madrasah tidak valid. Pilih dari daftar yang tersedia."
  - Prevent form submission if school not selected
  - Display clear error message below autocomplete field
  - _Requirements: 10.1, 10.2, 10.4, 10.5_

- [x] 9.1 Write E2E tests for school autocomplete
  - Create `tests/E2E/school-autocomplete.spec.ts` using Playwright
  - Test autocomplete displays suggestions when typing
  - Test selecting from autocomplete populates field
  - Test operator cannot edit pre-populated school field
  - Test super admin can use free-text entry
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 10. Checkpoint - Test frontend integration manually
  - Start frontend dev server (`npm run dev`)
  - Test SK submission form with autocomplete as operator
  - Test SK submission form with free-text as super admin
  - Verify school suggestions appear and are selectable
  - Verify validation errors display correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Create data migration artisan command
  - Create `backend/app/Console/Commands/NormalizeData.php`
  - Implement command signature: `normalize:data {--dry-run} {--batch=500}`
  - Inject `NormalizationService` via constructor
  - Implement `handle()` method with progress tracking
  - Implement `normalizeSchools()` method with batch processing (chunk by batch size)
  - Implement `normalizeTeachers()` method with batch processing
  - Implement `normalizeSkDocuments()` method with batch processing
  - Display progress bar for each entity type
  - Support `--dry-run` flag to preview changes without saving
  - Support `--batch` option for custom batch size (default 500)
  - Output summary table showing records updated per entity type
  - Handle errors gracefully: log error, continue processing, report at end
  - Create activity log entry on completion (if not dry-run)
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 12.1, 12.2, 12.4_

- [x] 11.1 Write integration tests for migration command
  - Test command normalizes existing school names
  - Test command normalizes existing teacher names
  - Test command normalizes SK document names
  - Test `--dry-run` flag does not modify database
  - Test command outputs summary statistics
  - Test error handling for individual record failures
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.9_

- [x] 12. Add activity logging for normalization changes
  - Add activity log entries in SkDocumentController when normalizing during submission
  - Add activity log entries in TeacherController when normalizing during create/update
  - Add activity log entry in NormalizeData command on completion
  - Include original value, normalized value, table name, record ID in log properties
  - Use existing `ActivityLog` model and `AuditLogTrait` for consistency
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

- [x] 12.1 Write tests for activity logging
  - Test SK submission creates activity log with normalization details
  - Test teacher creation creates activity log
  - Test migration command creates activity log
  - Verify log includes original and normalized values
  - _Requirements: 13.1, 13.2, 13.3_

- [x] 13. Final checkpoint - End-to-end verification
  - Run all backend tests: `php artisan test`
  - Run all frontend tests: `npm run test:e2e`
  - Manually test SK submission flow with normalization
  - Manually test teacher creation with normalization
  - Run migration command with `--dry-run` on staging data
  - Verify activity logs are created correctly
  - Check error logs for any issues
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties (idempotence, output validity)
- Unit tests validate specific examples and edge cases
- Integration tests verify controller-level normalization behavior
- E2E tests validate complete user workflows
- The design uses PHP (Laravel) for backend and TypeScript (React) for frontend
- All normalization happens server-side before database save
- Frontend autocomplete prevents inconsistent data entry at the source
- Migration command provides backward compatibility for existing data
- Activity logging provides full audit trail for compliance
