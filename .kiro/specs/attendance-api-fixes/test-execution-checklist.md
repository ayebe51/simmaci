# Test Execution Checklist - Attendance API Fixes

**Spec**: `.kiro/specs/attendance-api-fixes`  
**Status**: Implementation Complete, Testing Phase  
**Last Updated**: 2026-05-05

## Pre-Execution Checklist

### Environment Setup
- [ ] Backend server is running (`php artisan serve`)
- [ ] Frontend dev server is running (`npm run dev`)
- [ ] Database is accessible and has test data
- [ ] Playwright is installed (`npx playwright install`)

### Test Data Verification
- [ ] Test school exists (NPSN: 99999999)
- [ ] Test operator user exists (username: operator_test)
- [ ] Test subjects exist (at least 1)
- [ ] Test classes exist (at least 1)
- [ ] Test schedules exist (at least 1)
- [ ] Test teachers exist (at least 1)
- [ ] Test students exist (at least 1)
- [ ] Attendance settings exist with PIN (123456)

**Quick Setup**: Run `cd backend && php ../e2e/setup-test-data.php`

## Test Execution Phases

### Phase 1: Exploratory Bug Condition Testing ✅
- [x] Task 1: Bug condition exploration tests
- [x] Task 2: Preservation property tests

**Status**: Completed  
**Results**: Documented in `test-results-task-9.md`

### Phase 2: Implementation ✅
- [x] Task 3: Fix API endpoint mismatches
- [x] Task 4: Fix data parsing logic
- [x] Task 5: Fix QR scanner payload and PIN validation
- [x] Task 6: Add attendance navigation menu
- [x] Task 7: Add backend PIN validation endpoint
- [x] Task 8: Add geolocation tracking and geofencing

**Status**: Completed  
**Code Changes**: All frontend and backend fixes applied

### Phase 3: Fix Checking ✅
- [x] Task 9: Re-run bug condition tests (should pass)

**Status**: Completed  
**Results**: All bug condition tests passing

### Phase 4: Preservation Checking ⏳
- [-] Task 10: Re-run preservation tests (should still pass)

**Status**: In Progress  
**Note**: Some preservation tests may need adjustment

### Phase 5: Integration & E2E Testing ✅
- [x] Task 11: Integration tests for full workflows
- [x] Task 12: E2E tests with Playwright

**Status**: Completed  
**Test Files**: `e2e/attendance.spec.ts`

### Phase 6: Final Checkpoint
- [ ] Task 13: Final verification and cleanup

**Status**: Pending

## E2E Test Execution

### Test Suite 12.1: Student Attendance Recording
**Requirements**: 2.1, 2.2, 2.12, 2.13, 2.15

**Command**:
```bash
npx playwright test e2e/attendance.spec.ts -g "12.1"
```

**Checklist**:
- [ ] Test passes without errors
- [ ] Login successful
- [ ] Navigation menu visible
- [ ] Class dropdown populated
- [ ] Subject dropdown populated
- [ ] Attendance can be marked
- [ ] Save operation successful
- [ ] Success message displayed

**Expected Duration**: ~30 seconds

---

### Test Suite 12.2: QR Scanner Usage
**Requirements**: 2.9, 2.14, 2.15

**Command**:
```bash
npx playwright test e2e/attendance.spec.ts -g "12.2"
```

**Checklist**:
- [ ] Test passes without errors
- [ ] Login successful
- [ ] Scanner page accessible
- [ ] PIN input visible
- [ ] PIN verification works
- [ ] Mode selection available
- [ ] Scanner UI functional

**Expected Duration**: ~20 seconds

**Note**: Actual QR scanning requires manual testing

---

### Test Suite 12.3: Master Data Management
**Requirements**: 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.15

**Command**:
```bash
npx playwright test e2e/attendance.spec.ts -g "12.3"
```

**Checklist**:
- [ ] All 4 tests pass
- [ ] Subject CRUD operations work
- [ ] Class CRUD operations work
- [ ] Schedule CRUD operations work
- [ ] Navigation to all pages successful

**Expected Duration**: ~60 seconds

---

### Test Suite 12.4: Attendance Report
**Requirements**: 2.15, 3.2

**Command**:
```bash
npx playwright test e2e/attendance.spec.ts -g "12.4"
```

**Checklist**:
- [ ] Test passes without errors
- [ ] Report page accessible
- [ ] Filters work correctly
- [ ] Report generates successfully
- [ ] Data displays correctly
- [ ] Export functionality works

**Expected Duration**: ~30 seconds

---

### Test Suite 12.5: Geofencing Configuration
**Requirements**: 2.16, 2.19

**Command**:
```bash
npx playwright test e2e/attendance.spec.ts -g "12.5"
```

**Checklist**:
- [ ] Test passes without errors
- [ ] Settings page accessible
- [ ] Geolocation toggle works
- [ ] Current location button works
- [ ] Coordinates auto-fill
- [ ] Radius input works
- [ ] Settings save successfully
- [ ] GPS capture on attendance

**Expected Duration**: ~40 seconds

---

## Full Test Suite Execution

### Run All E2E Tests
```bash
npm run test:e2e
```

**Expected Results**:
- Total Tests: 7
- Passing: 7
- Failing: 0
- Duration: ~3-5 minutes

### Execution Checklist
- [ ] All 7 tests pass
- [ ] No timeout errors
- [ ] No element not found errors
- [ ] No authentication errors
- [ ] HTML report generated
- [ ] Screenshots captured (if any failures)

## Post-Execution Verification

### Manual Verification (Optional)
After automated tests pass, manually verify:

1. **Student Attendance**:
   - [ ] Login as operator
   - [ ] Navigate to Absensi Siswa
   - [ ] Record attendance for multiple students
   - [ ] Verify data saved in database

2. **QR Scanner**:
   - [ ] Use real device with camera
   - [ ] Scan actual QR code
   - [ ] Verify attendance recorded

3. **Geolocation**:
   - [ ] Use real device with GPS
   - [ ] Record attendance with location
   - [ ] Verify coordinates in database
   - [ ] Test geofencing validation

4. **Reports**:
   - [ ] Generate report with real data
   - [ ] Export to Excel
   - [ ] Verify Excel content
   - [ ] Export to PDF
   - [ ] Verify PDF content

### Database Verification
```sql
-- Check test data exists
SELECT * FROM schools WHERE npsn = '99999999';
SELECT * FROM users WHERE username = 'operator_test';
SELECT * FROM attendance_subjects WHERE school_id = (SELECT id FROM schools WHERE npsn = '99999999');
SELECT * FROM attendance_classes WHERE school_id = (SELECT id FROM schools WHERE npsn = '99999999');

-- Check attendance records
SELECT * FROM teacher_attendances WHERE school_id = (SELECT id FROM schools WHERE npsn = '99999999');
SELECT * FROM student_attendance_logs WHERE school_id = (SELECT id FROM schools WHERE npsn = '99999999');

-- Check geolocation data
SELECT latitude, longitude, location_verified FROM teacher_attendances WHERE latitude IS NOT NULL;
SELECT latitude, longitude, location_verified FROM student_attendance_logs WHERE latitude IS NOT NULL;
```

## Troubleshooting

### Common Issues

**Issue**: Tests fail with "Connection refused"
- **Solution**: Ensure backend and frontend servers are running
- **Command**: `cd backend && php artisan serve` and `npm run dev`

**Issue**: Tests fail with "Element not found"
- **Solution**: Run in UI mode to inspect: `npx playwright test --ui`
- **Solution**: Verify test data exists: `php e2e/setup-test-data.php`

**Issue**: Tests fail with "401 Unauthorized"
- **Solution**: Verify test user exists in database
- **Solution**: Check credentials in `e2e/attendance.spec.ts`

**Issue**: Geolocation tests fail
- **Solution**: Verify geolocation permission granted in test
- **Solution**: Check backend geofencing validation logic

**Issue**: Tests are flaky (pass sometimes, fail sometimes)
- **Solution**: Increase wait times in test
- **Solution**: Add explicit waits for data loading
- **Solution**: Check for race conditions

## Sign-Off

### Developer Sign-Off
- [ ] All code changes implemented
- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] All E2E tests passing
- [ ] Code reviewed and approved
- [ ] Documentation updated

**Developer**: ________________  
**Date**: ________________

### QA Sign-Off
- [ ] All automated tests executed
- [ ] All manual tests executed
- [ ] No critical bugs found
- [ ] Performance acceptable
- [ ] Security verified
- [ ] Ready for deployment

**QA Engineer**: ________________  
**Date**: ________________

### Product Owner Sign-Off
- [ ] All requirements met
- [ ] User acceptance criteria satisfied
- [ ] Feature ready for production
- [ ] Documentation complete

**Product Owner**: ________________  
**Date**: ________________

## Deployment Checklist

Before deploying to production:

- [ ] All tests passing in staging environment
- [ ] Database migrations tested
- [ ] Rollback plan prepared
- [ ] Monitoring configured
- [ ] Error tracking enabled (Sentry)
- [ ] Performance baseline established
- [ ] User documentation updated
- [ ] Training materials prepared (if needed)
- [ ] Stakeholders notified

## Success Metrics

After deployment, monitor:

- [ ] Error rate < 1%
- [ ] API response time < 500ms
- [ ] User adoption rate
- [ ] Feature usage statistics
- [ ] User feedback (positive/negative)
- [ ] Support tickets related to attendance

## Notes

_Add any additional notes, observations, or issues encountered during testing:_

---

**Test Execution Status**: ⏳ In Progress  
**Next Action**: Complete Phase 4 (Preservation Checking) and Phase 6 (Final Checkpoint)  
**Blockers**: None  
**ETA**: Ready for deployment after final verification
