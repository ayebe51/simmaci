# Implementation Plan

## Phase 1: Exploratory Bug Condition Testing

- [x] 1. Write bug condition exploration tests (BEFORE implementing fixes)
  - **Property 1: Bug Condition** - API Endpoint and Payload Mismatch
  - **CRITICAL**: These tests MUST FAIL on unfixed code - failure confirms the bugs exist
  - **DO NOT attempt to fix the tests or the code when they fail**
  - **NOTE**: These tests encode the expected behavior - they will validate the fixes when they pass after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bugs exist
  - Write integration tests for all 8 bug categories:
    1. Student logs endpoint mismatch (`/attendance/student-logs` vs `/attendance/student-log`)
    2. Master data endpoint mismatch (`/subjects` vs `/attendance/subjects`, etc.)
    3. QR scan payload mismatch (`{ qr_code }` vs `{ code, type }`)
    4. HTTP method mismatch (POST vs PUT for settings, POST vs GET for check-wa)
    5. Data parsing logic error (accessing `r.student_id` directly vs `r.logs[].student_id`)
    6. Missing PIN validation (client-side only vs backend validation)
    7. Missing navigation menu (no attendance items for operator role)
    8. Missing geolocation tracking (no GPS coordinates captured or validated)
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL with 404 errors, 405 errors, validation errors, undefined values, missing UI elements, missing geolocation data
  - Document counterexamples found to understand root causes
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12, 1.13, 1.14, 1.15, 1.16, 1.17, 1.18_

- [x] 2. Write preservation property tests (BEFORE implementing fixes)
  - **Property 2: Preservation** - Existing Working Features
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for working features:
    - Teacher attendance endpoints (`/attendance/teacher`)
    - Student report endpoint (`/attendance/student-report`)
    - Settings show endpoint (`GET /attendance/settings`)
    - Tenant scoping mechanism (operators only see their school_id data)
    - Authentication flow (unauthenticated requests get 401)
    - Data validation (invalid payloads get validation errors)
  - Write property-based tests capturing observed behavior patterns
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

## Phase 2: Implementation

- [ ] 3. Fix API endpoint and payload mismatches in frontend

  - [x] 3.1 Fix `src/lib/api.ts` - Student Logs Endpoints
    - Change `studentLogIndex` from `/attendance/student-logs` to `/attendance/student-log`
    - Change `studentLogStore` from `/attendance/student-logs` to `/attendance/student-log`
    - _Bug_Condition: Frontend calls `/attendance/student-logs` (plural) but backend expects `/attendance/student-log` (singular)_
    - _Expected_Behavior: API calls return 200/201 instead of 404_
    - _Preservation: Backend endpoints remain unchanged_
    - _Requirements: 1.1, 1.2, 2.1, 2.2_

  - [x] 3.2 Fix `src/lib/api.ts` - Master Data Endpoints
    - Change `subjectList` from `/subjects` to `/attendance/subjects`
    - Change `subjectStore` from `/subjects` to `/attendance/subjects`
    - Change `subjectUpdate` from `/subjects/${id}` to `/attendance/subjects/${id}`
    - Change `classList` from `/classes` to `/attendance/classes`
    - Change `classStore` from `/classes` to `/attendance/classes`
    - Change `classUpdate` from `/classes/${id}` to `/attendance/classes/${id}`
    - Change `scheduleList` from `/lesson-schedules` to `/attendance/schedules`
    - Change `scheduleStore` from `/lesson-schedules` to `/attendance/schedules`
    - _Bug_Condition: Frontend calls root-level endpoints but backend groups under `/attendance` prefix_
    - _Expected_Behavior: API calls return 200/201 instead of 404_
    - _Preservation: Backend endpoints remain unchanged_
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [x] 3.3 Fix `src/lib/api.ts` - QR Scan Payload Structure
    - Change `qrScan` method to accept `(code: string, type: 'teacher' | 'student')` parameters
    - Change payload from `{ qr_code: qrCode }` to `{ code: qrCode, type: type }`
    - Update method signature: `qrScan: (code: string, type: 'teacher' | 'student') => apiClient.post('/attendance/qr-scan', { code, type }).then((r) => r.data)`
    - _Bug_Condition: Frontend sends `{ qr_code }` but backend expects `{ code, type }`_
    - _Expected_Behavior: QR scan requests process successfully without validation errors_
    - _Preservation: Backend validation rules remain unchanged_
    - _Requirements: 1.9, 2.9_

  - [x] 3.4 Fix `src/lib/api.ts` - HTTP Method Consistency
    - Change `settingsUpdate` from `POST /attendance/settings` to `PUT /attendance/settings`
    - Change `checkWaConnection` from `POST /attendance/check-wa` to `GET /attendance/check-wa`
    - Update method signatures:
      - `settingsUpdate: (data: any) => apiClient.put('/attendance/settings', data).then((r) => r.data)`
      - `checkWaConnection: () => apiClient.get('/attendance/check-wa').then((r) => r.data)`
    - _Bug_Condition: Frontend uses POST but backend expects PUT/GET_
    - _Expected_Behavior: API calls return 200 instead of 405 Method Not Allowed_
    - _Preservation: Backend HTTP methods remain unchanged_
    - _Requirements: 1.10, 1.11, 2.10, 2.11_

- [ ] 4. Fix data parsing logic in StudentAttendancePage

  - [x] 4.1 Fix `src/features/attendance/StudentAttendancePage.tsx` - Parse Nested Logs Data
    - Locate the `useEffect` hook that processes `existingRecords`
    - Change from accessing `r.student_id` and `r.status` directly
    - To parsing `r.logs` array: `r.logs.forEach((log: any) => { statuses[log.student_id] = log.status; })`
    - Add null check: `const logs = r.logs || [];`
    - Add else clause to reset statuses when no records: `else { setStudentStatuses({}); }`
    - _Bug_Condition: Code accesses flat fields but data is nested in `logs` JSON field_
    - _Expected_Behavior: Existing attendance data displays correctly in UI_
    - _Preservation: Backend response structure remains unchanged_
    - _Requirements: 1.12, 1.13, 2.12, 2.13_

  - [x] 4.2 Fix `src/features/attendance/StudentAttendancePage.tsx` - Store Payload Structure
    - Locate the `handleSaveBulk` function
    - Verify payload uses `logs` field name (not `records`)
    - Ensure payload structure matches backend expectation: `{ class_id, subject_id, tanggal, jam_ke?, logs: [...] }`
    - _Bug_Condition: Frontend might send `records` field but backend expects `logs`_
    - _Expected_Behavior: Save operations succeed without validation errors_
    - _Preservation: Backend validation rules remain unchanged_
    - _Requirements: 2.2, 2.12_

- [ ] 5. Fix QR scanner payload and add PIN validation

  - [x] 5.1 Fix `src/features/attendance/QrScannerPage.tsx` - QR Scan Payload
    - Update `qrScanMutation` to pass both `code` and `type` parameters
    - Change mutation call from `qrScanMutation.mutate(decodedText)` to `qrScanMutation.mutate({ code: decodedText, type: mode === 'guru' ? 'teacher' : 'student' })`
    - Update mutation function signature to accept `{ code: string; type: 'teacher' | 'student' }`
    - Update queryFn: `queryFn: ({ code, type }: { code: string; type: 'teacher' | 'student' }) => attendanceApi.qrScan(code, type)`
    - _Bug_Condition: Frontend sends single string but backend expects object with code and type_
    - _Expected_Behavior: QR scan requests process correctly with proper type detection_
    - _Preservation: Backend QR scan logic remains unchanged_
    - _Requirements: 1.9, 2.9_

  - [x] 5.2 Add PIN validation to `src/features/attendance/QrScannerPage.tsx`
    - Add backend PIN validation call in `handlePinSubmit` function
    - Replace client-side only check with API call: `await attendanceApi.verifyPin(pin)`
    - Handle success/error responses with appropriate toast messages
    - Add try-catch block for error handling
    - _Bug_Condition: PIN only validated client-side, allowing unauthorized access_
    - _Expected_Behavior: PIN validated via backend API for proper authorization_
    - _Preservation: Existing authentication flow remains unchanged_
    - _Requirements: 1.14, 2.14_

  - [x] 5.3 Add `verifyPin` method to `src/lib/api.ts`
    - Add new method in `attendanceApi` object: `verifyPin: (pin: string) => apiClient.post('/attendance/verify-pin', { pin }).then((r) => r.data)`
    - _Bug_Condition: No API method exists for PIN validation_
    - _Expected_Behavior: Frontend can call backend to validate PIN_
    - _Requirements: 2.14_

- [ ] 6. Add attendance navigation menu

  - [x] 6.1 Fix `src/components/layout/AppShell.tsx` - Add Attendance Menu Group
    - Import required icons: `UserCheck, GraduationCap, ScanLine, BookOpen, ClipboardList` from `lucide-react`
    - Add new navigation group in `navGroups` array (before "Manajemen SDM" group)
    - Add conditional rendering: only show for non-super-admin users (`!isSuperAdmin`)
    - Include 8 menu items:
      1. Absensi Guru → `/dashboard/attendance/teacher`
      2. Absensi Siswa → `/dashboard/attendance/student`
      3. Scanner QR → `/dashboard/attendance/scanner`
      4. Mata Pelajaran → `/dashboard/attendance/subjects`
      5. Kelas / Rombel → `/dashboard/attendance/classes`
      6. Jadwal Jam → `/dashboard/attendance/schedule`
      7. Laporan Absensi → `/dashboard/attendance/report`
      8. Pengaturan Absensi → `/dashboard/attendance/settings`
    - _Bug_Condition: No attendance menu items exist in navigation_
    - _Expected_Behavior: Operators see attendance menu and can access features via UI_
    - _Preservation: Existing navigation groups remain unchanged_
    - _Requirements: 1.15, 2.15_

- [ ] 7. Add backend PIN validation endpoint (optional but recommended)

  - [x] 7.1 Add `verifyPin` method to `backend/app/Http/Controllers/Api/AttendanceController.php`
    - Add new public method `verifyPin(Request $request): JsonResponse`
    - Validate request: `$request->validate(['pin' => 'required|string'])`
    - Fetch settings: `AttendanceSetting::where('school_id', $request->user()->school_id)->first()`
    - Compare PIN: `$request->pin === $settings->scanner_pin`
    - Return JSON response with `success` and `message` fields
    - Return 401 status for invalid PIN, 400 for missing settings
    - _Bug_Condition: No backend endpoint exists for PIN validation_
    - _Expected_Behavior: Backend can validate PIN for scanner authorization_
    - _Requirements: 2.14_

  - [x] 7.2 Add route in `backend/routes/api.php`
    - Add route inside `auth:sanctum` middleware group
    - Add inside attendance prefix group: `Route::post('verify-pin', [AttendanceController::class, 'verifyPin'])`
    - _Bug_Condition: No route exists for PIN validation endpoint_
    - _Expected_Behavior: Frontend can call `/attendance/verify-pin` endpoint_
    - _Requirements: 2.14_

- [ ] 8. Add geolocation tracking and geofencing

  - [x] 8.1 Create database migration for geolocation columns
    - Create new migration file: `backend/database/migrations/YYYY_MM_DD_HHMMSS_add_geolocation_to_attendance.php`
    - Add columns to `teacher_attendance` table:
      - `latitude` (decimal, 10, 8, nullable)
      - `longitude` (decimal, 11, 8, nullable)
    - Add columns to `student_attendance_logs` table:
      - `latitude` (decimal, 10, 8, nullable)
      - `longitude` (decimal, 11, 8, nullable)
    - Add columns to `attendance_settings` table:
      - `geolocation_enabled` (boolean, default false)
      - `school_latitude` (decimal, 10, 8, nullable)
      - `school_longitude` (decimal, 11, 8, nullable)
      - `geofence_radius_meters` (integer, default 100)
    - _Bug_Condition: No database columns exist for GPS coordinates_
    - _Expected_Behavior: Database can store latitude/longitude for attendance records and geofencing settings_
    - _Requirements: 2.16_

  - [x] 8.2 Update AttendanceController with geolocation validation
    - Update `storeTeacherAttendance` method in `backend/app/Http/Controllers/Api/AttendanceController.php`
    - Add validation rules for latitude/longitude (nullable, numeric)
    - Add geofencing validation logic:
      - Fetch school settings with geolocation_enabled, school_latitude, school_longitude, geofence_radius_meters
      - If geolocation_enabled is true and coordinates provided, calculate distance using Haversine formula
      - Reject attendance if distance > geofence_radius_meters with error message
    - Store latitude/longitude in database if provided
    - Add Haversine distance calculation helper method
    - Update `storeStudentAttendance` method with same geolocation validation
    - _Bug_Condition: Backend doesn't validate GPS coordinates or enforce geofencing_
    - _Expected_Behavior: Backend validates attendance location against school geofence_
    - _Requirements: 2.17, 2.18_

  - [x] 8.3 Create useGeolocation custom hook
    - Create new file: `src/hooks/useGeolocation.ts`
    - Implement custom hook that wraps browser Geolocation API
    - Return state: `{ latitude, longitude, accuracy, error, loading }`
    - Handle geolocation errors with Indonesian error messages
    - Support options: enableHighAccuracy, timeout, maximumAge
    - _Bug_Condition: No reusable hook exists for geolocation_
    - _Expected_Behavior: Components can easily access GPS coordinates_
    - _Requirements: 2.16_

  - [x] 8.4 Update TeacherAttendancePage to capture GPS coordinates
    - Import `useGeolocation` hook in `src/features/attendance/TeacherAttendancePage.tsx`
    - Call hook at component level: `const geolocation = useGeolocation()`
    - Update `handleStatusChange` to include latitude/longitude in payload if available
    - Add useEffect to show toast warning if geolocation error occurs
    - _Bug_Condition: Teacher attendance page doesn't capture GPS coordinates_
    - _Expected_Behavior: GPS coordinates automatically captured when recording teacher attendance_
    - _Requirements: 2.16_

  - [x] 8.5 Update StudentAttendancePage to capture GPS coordinates
    - Import `useGeolocation` hook in `src/features/attendance/StudentAttendancePage.tsx`
    - Call hook at component level: `const geolocation = useGeolocation()`
    - Update `handleSaveBulk` to include latitude/longitude in each log entry if available
    - Add useEffect to show toast warning if geolocation error occurs
    - _Bug_Condition: Student attendance page doesn't capture GPS coordinates_
    - _Expected_Behavior: GPS coordinates automatically captured when recording student attendance_
    - _Requirements: 2.16_

  - [x] 8.6 Update QrScannerPage to capture GPS coordinates
    - Import `useGeolocation` hook in `src/features/attendance/QrScannerPage.tsx`
    - Call hook at component level: `const geolocation = useGeolocation()`
    - Update QR scan mutation to include latitude/longitude in payload if available
    - Add useEffect to show toast warning if geolocation error occurs
    - _Bug_Condition: QR scanner doesn't capture GPS coordinates_
    - _Expected_Behavior: GPS coordinates automatically captured when scanning QR code_
    - _Requirements: 2.16_

  - [x] 8.7 Update AttendanceSettingsPage with geofencing UI
    - Update `src/features/attendance/AttendanceSettingsPage.tsx`
    - Add new fields to formState: geolocation_enabled, school_latitude, school_longitude, geofence_radius_meters
    - Add new Card section with title "Geolocation & Geofencing"
    - Add Switch for geolocation_enabled
    - Add Input fields for school_latitude and school_longitude (conditional on geolocation_enabled)
    - Add Input field for geofence_radius_meters with min=10, max=1000, step=10
    - Add Button "Gunakan Lokasi Saat Ini" to auto-fill coordinates using browser geolocation
    - Add helper text explaining geofencing radius
    - _Bug_Condition: No UI exists for configuring geofencing settings_
    - _Expected_Behavior: Operators can configure school location and geofence radius_
    - _Requirements: 2.19_

## Phase 3: Fix Checking

- [x] 9. Verify bug condition exploration tests now pass

  - [x] 9.1 Re-run exploration tests from task 1
    - **Property 1: Expected Behavior** - API Endpoint and Payload Consistency
    - **IMPORTANT**: Re-run the SAME tests from task 1 - do NOT write new tests
    - The tests from task 1 encode the expected behavior
    - When these tests pass, it confirms the expected behavior is satisfied
    - Run all 8 bug category tests:
      1. Student logs endpoint test (should return 200 instead of 404)
      2. Master data endpoints test (should return 200 instead of 404)
      3. QR scan payload test (should process successfully)
      4. HTTP method test (should return 200 instead of 405)
      5. Data parsing test (should correctly access nested data)
      6. PIN validation test (should validate via backend)
      7. Navigation menu test (should display attendance items)
      8. Geolocation tracking test (should capture and validate GPS coordinates)
    - **EXPECTED OUTCOME**: All tests PASS (confirms bugs are fixed)
    - Document test results and any remaining issues
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 2.13, 2.14, 2.15, 2.16, 2.17, 2.18, 2.19_

## Phase 4: Preservation Checking

- [-] 10. Verify preservation tests still pass

  - [x] 10.1 Re-run preservation tests from task 2
    - **Property 2: Preservation** - Existing Working Features Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run all preservation tests:
      1. Teacher attendance endpoints (GET/POST `/attendance/teacher`)
      2. Student report endpoint (GET `/attendance/student-report`)
      3. Settings show endpoint (GET `/attendance/settings`)
      4. Tenant scoping (operators only see their school_id data)
      5. Authentication (unauthenticated requests get 401)
      6. Data validation (invalid payloads get validation errors)
      7. Existing data integrity (no corruption of stored attendance records)
    - **EXPECTED OUTCOME**: All tests PASS (confirms no regressions)
    - Document test results and confirm no breaking changes
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

## Phase 5: Integration & E2E Testing

- [x] 11. Integration tests for full attendance workflows

  - [x] 11.1 Test full student attendance workflow
    - Create test class via API
    - Create test subject via API
    - Record student attendance via API
    - Fetch student logs via API
    - View student report via API
    - Verify data flows correctly through entire workflow
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.12, 2.13_

  - [x] 11.2 Test QR scanner workflow
    - Validate PIN via API
    - Select scanner mode (teacher/student)
    - Simulate QR scan with correct payload
    - Verify attendance recorded in database
    - Check response includes correct data
    - _Requirements: 2.9, 2.14_

  - [x] 11.3 Test navigation and UI accessibility
    - Login as operator user
    - Verify attendance menu visible in navigation
    - Navigate to each attendance page
    - Verify pages load without errors
    - _Requirements: 2.15_

  - [x] 11.4 Test multi-tenant isolation
    - Create data as operator from school 1
    - Login as operator from school 2
    - Verify school 2 cannot see school 1 data
    - Verify tenant scoping works for all endpoints
    - _Requirements: 3.5_

  - [x] 11.5 Test geolocation and geofencing workflow
    - Configure geofencing settings via API (enable geolocation, set school coordinates, set radius)
    - Record teacher attendance with GPS coordinates inside geofence
    - Verify attendance accepted
    - Record teacher attendance with GPS coordinates outside geofence
    - Verify attendance rejected with appropriate error message
    - Record student attendance with GPS coordinates
    - Verify coordinates stored in database
    - Test QR scan with GPS coordinates
    - Verify coordinates stored in database
    - _Requirements: 2.16, 2.17, 2.18, 2.19_

- [x] 12. E2E tests with Playwright

  - [x] 12.1 E2E: Operator records student attendance
    - Login as operator
    - Navigate to Absensi Siswa via menu
    - Select class and subject from dropdowns
    - Mark attendance for students
    - Save attendance
    - Verify success message displayed
    - _Requirements: 2.1, 2.2, 2.12, 2.13, 2.15_

  - [x] 12.2 E2E: Operator uses QR scanner
    - Login as operator
    - Navigate to Scanner QR via menu
    - Enter PIN and verify
    - Select teacher mode
    - Simulate QR code scan
    - Verify attendance recorded message
    - _Requirements: 2.9, 2.14, 2.15_

  - [x] 12.3 E2E: Operator manages master data
    - Login as operator
    - Navigate to Mata Pelajaran via menu
    - Create new subject
    - Edit existing subject
    - Navigate to Kelas via menu
    - Create new class
    - Navigate to Jadwal Jam via menu
    - Create new schedule
    - Verify all CRUD operations work
    - _Requirements: 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.15_

  - [x] 12.4 E2E: Operator views attendance report
    - Login as operator
    - Navigate to Laporan Absensi via menu
    - Select filters (class, subject, date range)
    - Generate report
    - Verify report displays correct data
    - Export to Excel/PDF
    - _Requirements: 2.15, 3.2_

  - [x] 12.5 E2E: Operator configures geofencing
    - Login as operator
    - Navigate to Pengaturan Absensi via menu
    - Enable geolocation tracking
    - Click "Gunakan Lokasi Saat Ini" button
    - Verify coordinates auto-filled
    - Set geofence radius to 200 meters
    - Save settings
    - Verify success message displayed
    - Record attendance (should capture GPS automatically)
    - Verify attendance recorded with location data
    - _Requirements: 2.16, 2.19_

## Phase 6: Final Checkpoint

- [x] 13. Final verification and cleanup
  - Ensure all exploration tests pass (bug fixes validated)
  - Ensure all preservation tests pass (no regressions)
  - Ensure all integration tests pass
  - Ensure all E2E tests pass
  - Review code changes for consistency and best practices
  - Update any relevant documentation
  - Ask user if any questions or issues arise
