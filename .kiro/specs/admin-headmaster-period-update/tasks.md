# Implementation Plan: Admin Headmaster Period Update

## Overview

This implementation plan breaks down the feature into discrete coding tasks that build incrementally. The feature enables super admin and admin yayasan users to view and update headmaster profile information and tenure periods for any school in the system, while maintaining proper authorization, validation, and audit trails.

## Tasks

- [ ] 1. Enhance backend authorization and validation
  - [x] 1.1 Update SchoolController with role-based authorization logic
    - Add authorization check in `update()` method to allow super_admin and admin_yayasan to update any school
    - Enforce tenant scoping for operator role (can only update own school)
    - Return 403 Forbidden response for unauthorized cross-school updates
    - _Requirements: 1.4, 6.2, 6.3, 6.5_
  
  - [x] 1.2 Enhance validation rules for headmaster profile fields
    - Add validation for `kepala_madrasah` (nullable, string, max 255)
    - Add validation for `kepala_nim` (nullable, string, max 50)
    - Add validation for `kepala_nuptk` (nullable, string, max 50)
    - Add validation for `kepala_whatsapp` (nullable, string, max 20)
    - Add validation for `kepala_jabatan_mulai` (nullable, date format)
    - Add validation for `kepala_jabatan_selesai` (nullable, date, after_or_equal:kepala_jabatan_mulai)
    - _Requirements: 3.1, 3.3, 3.4, 3.5, 6.6_
  
  - [x] 1.3 Implement activity logging for headmaster profile updates
    - Create ActivityLog entry on successful update
    - Record causer_id (user who performed update)
    - Record school_id (school that was updated)
    - Include description with school name and action
    - Use database transaction to ensure atomicity
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 7.1, 7.2_
  
  - [x] 1.4 Write unit tests for SchoolController authorization
    - Test super_admin can update any school headmaster profile
    - Test admin_yayasan can update any school headmaster profile
    - Test operator can only update own school headmaster profile
    - Test operator cannot update other school headmaster profile
    - Test 403 response for unauthorized cross-school updates
    - _Requirements: 1.1, 1.2, 1.3, 6.2, 6.3, 6.5_
  
  - [x] 1.5 Write unit tests for validation rules
    - Test date format validation for tenure dates
    - Test end date must be after or equal to start date
    - Test null values accepted for optional fields
    - Test string length limits enforced
    - Test validation error responses (422)
    - _Requirements: 3.1, 3.3, 3.4, 3.5_

- [ ] 2. Create reusable HeadmasterProfileForm component
  - [x] 2.1 Create HeadmasterProfileForm component with form fields
    - Create component at `src/features/schools/components/HeadmasterProfileForm.tsx`
    - Define props interface (school, onSuccess, onCancel, isAdminMode)
    - Implement form fields for all headmaster profile data (kepala_madrasah, kepala_nim, kepala_nuptk, kepala_whatsapp, kepala_jabatan_mulai, kepala_jabatan_selesai)
    - Use React Hook Form for form state management
    - Use Shadcn/UI components (Input, Button, DatePicker)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 5.3_
  
  - [x] 2.2 Implement client-side validation with Zod schema
    - Create Zod schema for headmaster profile fields
    - Validate date formats for tenure dates
    - Validate end date is after or equal to start date
    - Validate string length limits
    - Display inline validation errors with form fields
    - _Requirements: 3.1, 3.3, 3.4, 3.5, 5.5_
  
  - [x] 2.3 Implement form submission with API integration
    - Call SchoolController update endpoint via apiClient
    - Handle loading state during submission
    - Disable submit button during submission to prevent duplicates
    - Call onSuccess callback after successful update
    - Call onCancel callback when user cancels
    - _Requirements: 3.2, 3.6, 5.4, 8.4, 8.5_
  
  - [x] 2.4 Implement error handling and user feedback
    - Display toast notification on successful update
    - Display inline validation errors for 422 responses
    - Display error message for 403 Forbidden responses
    - Display general error message with retry option for server errors
    - Display loading spinner during data fetch and submission
    - _Requirements: 3.7, 8.1, 8.2, 8.3, 8.4_
  
  - [x] 2.5 Write unit tests for HeadmasterProfileForm component
    - Test renders all headmaster fields correctly
    - Test displays loading state during submission
    - Test displays success message after update
    - Test displays inline validation errors
    - Test validates end date after start date on client
    - Test calls onSuccess callback after successful update
    - Test calls onCancel callback when cancelled
    - Test prevents duplicate submissions
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.5, 8.1, 8.2_

- [ ] 3. Create AdminSchoolManagementPage for admin users
  - [x] 3.1 Create AdminSchoolManagementPage component with school list
    - Create page at `src/features/schools/AdminSchoolManagementPage.tsx`
    - Implement school list display with pagination
    - Display school name, kecamatan, current headmaster, and tenure dates
    - Use TanStack React Query for data fetching
    - Implement loading state with skeleton UI
    - _Requirements: 1.1, 1.2, 5.1, 5.4_
  
  - [x] 3.2 Implement search and filter functionality
    - Add search input for school name filtering
    - Add kecamatan dropdown filter
    - Debounce search input to optimize API calls
    - Update query parameters on filter changes
    - _Requirements: 5.1_
  
  - [x] 3.3 Implement school selection and edit mode
    - Add click handler for school selection
    - Display HeadmasterProfileForm when school is selected
    - Pass selected school data to form component
    - Handle form success callback to refresh school list
    - Handle form cancel callback to return to list view
    - _Requirements: 1.2, 5.2, 5.6_
  
  - [x] 3.4 Write unit tests for AdminSchoolManagementPage
    - Test renders school list correctly
    - Test search functionality filters schools
    - Test kecamatan filter works correctly
    - Test school selection displays edit form
    - Test form success refreshes school list
    - Test form cancel returns to list view
    - _Requirements: 1.1, 5.1, 5.2, 5.6_

- [ ] 4. Update routing and navigation
  - [x] 4.1 Add route for AdminSchoolManagementPage
    - Add route at `/dashboard/admin/schools` in React Router configuration
    - Add route guard to restrict access to super_admin and admin_yayasan roles
    - Use ProtectedLayout wrapper for authentication
    - _Requirements: 1.1, 1.2, 1.3_
  
  - [~] 4.2 Update navigation menu for admin users
    - Add "Kelola Sekolah" menu item for super_admin and admin_yayasan
    - Hide menu item from operator role
    - Use role-based conditional rendering
    - _Requirements: 1.1, 1.2_

- [ ] 5. Refactor existing SchoolProfilePage to use HeadmasterProfileForm
  - [~] 5.1 Extract form logic from SchoolProfilePage into HeadmasterProfileForm
    - Remove duplicate form code from SchoolProfilePage
    - Import and use HeadmasterProfileForm component
    - Pass school data and callbacks as props
    - Maintain existing operator functionality
    - _Requirements: 5.3_

- [ ] 6. Checkpoint - Ensure all tests pass
  - Run backend PHPUnit tests (`php artisan test`)
  - Run frontend unit tests if implemented
  - Manually test admin user can update any school
  - Manually test operator can only update own school
  - Manually test validation errors display correctly
  - Manually test activity logs are created
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Add API service methods for school management
  - [x] 7.1 Create or update school API service module
    - Create `src/services/schoolService.ts` if not exists
    - Add `getSchools()` method with search and filter parameters
    - Add `getSchoolById()` method for fetching single school
    - Add `updateSchool()` method for updating headmaster profile
    - Use apiClient from `src/lib/api.ts`
    - _Requirements: 6.1, 6.2, 6.4_

- [ ] 8. Implement data refresh after successful update
  - [~] 8.1 Implement optimistic updates with React Query
    - Use React Query mutation for school updates
    - Invalidate school list query after successful update
    - Invalidate school detail query after successful update
    - Display updated data immediately in UI
    - _Requirements: 7.3, 8.1_

- [ ] 9. Write integration tests for end-to-end workflow
  - [~] 9.1 Write backend integration tests
    - Test admin can complete full update workflow
    - Test operator can update own school profile
    - Test update flow with database transaction
    - Test activity log creation on successful update
    - Test no activity log created on failed update
    - _Requirements: 4.1, 4.2, 4.3, 7.1, 7.2_
  
  - [~] 9.2 Write E2E tests with Playwright
    - Test admin can search and update headmaster profile
    - Test validation error displays for invalid date range
    - Test operator cannot access other schools
    - Test success toast appears after update
    - Test loading states display correctly
    - _Requirements: 1.1, 1.3, 3.5, 8.1, 8.4_

- [ ] 10. Final checkpoint and manual testing
  - Verify super admin can view all schools in the list
  - Verify admin yayasan can view all schools in the list
  - Verify operator only sees their own school
  - Verify search functionality filters schools correctly
  - Verify kecamatan filter works as expected
  - Verify all headmaster fields display correctly
  - Verify date picker works for tenure dates
  - Verify form validation prevents invalid date ranges
  - Verify success toast appears after successful update
  - Verify error messages display for validation failures
  - Verify loading spinner shows during API calls
  - Verify submit button is disabled during submission
  - Verify cancel button discards changes
  - Verify activity log is created for each update
  - Verify updated data reflects immediately in UI
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- The implementation reuses existing backend infrastructure (SchoolController)
- Frontend uses existing patterns (React Query, Shadcn/UI, React Hook Form)
- All API calls go through the central apiClient
- Activity logging ensures audit trail for all changes
- Authorization is enforced at both frontend (route guards) and backend (controller checks)
