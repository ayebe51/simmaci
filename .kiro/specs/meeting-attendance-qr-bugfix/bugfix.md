# Bugfix: Meeting Attendance QR Test Failures

## Problem Statement

CI/CD pipeline failing with 25 test failures in meeting-attendance-qr implementation:

1. **QR Signature Validation Issues** (6 failures)
   - Tests expecting specific exceptions (OutsideGeofenceException, QrExpiredException) but receiving InvalidQrSignatureException
   - Indicates signature validation is failing before other checks

2. **Meeting Creation Failures** (2 failures)
   - POST /api/meetings returning 500 instead of 201
   - Both super_admin and admin_yayasan roles affected

3. **Authorization Issues** (2 failures)
   - Operators getting 403 when accessing /api/meetings
   - Should return 200 with filtered meetings for their school

4. **Report Generation Failures** (2 failures)
   - PDF and Excel reports returning empty content
   - assertNotEmpty() failing on response content

5. **Database Constraint Violations** (1 failure)
   - SendMeetingReminderJob failing with NOT NULL constraint on phone_number
   - External participants missing phone_number

6. **Feature Tests Failures** (12 failures)
   - Various integration test failures cascading from above issues

## Root Causes to Investigate

1. QR signature validation logic may be too strict or incorrectly implemented
2. Meeting creation endpoint may have missing error handling or validation issues
3. Authorization middleware may not be properly scoped for operators
4. Report generation may not be writing content to response
5. Job may not be handling external participants with missing phone numbers

## Fix Strategy

1. Diagnose QR signature validation in MeetingQrService
2. Fix meeting creation endpoint error handling
3. Verify operator authorization scoping
4. Fix report generation content output
5. Handle NULL phone_number in SendMeetingReminderJob

## Success Criteria

- All 25 tests pass
- CI/CD pipeline succeeds
- No regressions in existing functionality
