# Bugfix Tasks: Meeting Attendance QR Test Failures

## Task 1: Diagnose and Fix QR Signature Validation

Investigate why QR signature validation is failing before other checks, causing tests to receive InvalidQrSignatureException instead of expected exceptions like OutsideGeofenceException and QrExpiredException.

**Failing Tests:**
- MeetingCheckInServiceTest lines 100, 155, 208, 259, 302, 349
- MeetingCheckInServiceTest property 4 (geolocation) line 388
- MeetingCheckInServiceTest property 9 (token) lines 520, 547, 575, 603, 632

### Sub-tasks

- [x] Review MeetingQrService::validateSignature() implementation
- [x] Check test setup for QR token generation and mocking
- [x] Verify signature validation is not blocking legitimate requests
- [x] Fix signature validation logic or test mocks
- [x] Verify all 6 unit tests pass

---

## Task 2: Fix Meeting Creation Endpoint (500 Errors)

Fix POST /api/meetings endpoint returning 500 instead of 201 for super_admin and admin_yayasan.

**Failing Tests:**
- MeetingControllerTest::super admin can create meeting (line 89)
- MeetingControllerTest::admin yayasan can create meeting (line 137)

### Sub-tasks

- [ ] Review MeetingController::store() implementation
- [ ] Check MeetingService::createMeeting() for exceptions
- [ ] Review form request validation in StoreMeetingRequest
- [ ] Check database constraints and relationships
- [ ] Fix error handling and validation
- [ ] Verify both tests pass

---

## Task 3: Fix Operator Authorization for Meeting List

Fix GET /api/meetings returning 403 for operators (should return 200 with filtered meetings).

**Failing Tests:**
- MeetingControllerTest::operator can only see meetings (line 249)
- MeetingControllerTest::operator can only view meeting (line 294)

### Sub-tasks

- [ ] Review authorization middleware for meetings endpoint
- [ ] Check HasTenantScope trait application
- [ ] Verify operator role has proper permissions
- [ ] Fix authorization logic
- [ ] Verify both tests pass

---

## Task 4: Fix Report Generation (Empty Content)

Fix PDF and Excel report generation returning empty content.

**Failing Tests:**
- MeetingReportControllerTest::pdf report includes meeting data (line 163)
- MeetingReportControllerTest::excel report includes meeting data (line 179)

### Sub-tasks

- [ ] Review MeetingReportService::generatePdf() implementation
- [ ] Review MeetingReportService::generateExcel() implementation
- [ ] Check response content writing
- [ ] Verify file generation is working
- [ ] Fix content output to response
- [ ] Verify both tests pass

---

## Task 5: Fix SendMeetingReminderJob Phone Number Constraint

Fix NOT NULL constraint violation on phone_number for external participants.

**Failing Test:**
- SendMeetingReminderJobTest (line 108)

### Sub-tasks

- [ ] Review SendMeetingReminderJob implementation
- [ ] Check how external participants are created
- [ ] Handle NULL phone_number gracefully
- [ ] Update job to skip or handle missing phone numbers
- [ ] Verify test passes

---

## Task 6: Verify All Tests Pass

Run full test suite to ensure all 25 failures are fixed and no regressions.

**Dependencies:** Task 1, 2, 3, 4, 5

### Sub-tasks

- [ ] Run backend tests: `php artisan test`
- [ ] Verify all 25 previously failing tests now pass
- [ ] Check for any new failures
- [ ] Verify CI/CD pipeline succeeds
