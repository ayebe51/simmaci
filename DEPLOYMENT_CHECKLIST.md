# SK Submission Bugfix - Deployment Checklist

**Deployment Date:** 2026-04-15
**Commit:** 6f2c488
**Branch:** main

## Pre-Deployment ✅

- [x] All tests passing (38 tests, 235 assertions)
- [x] Bug condition tests passing (6 tests)
- [x] Preservation tests passing (7 tests)
- [x] Code committed with detailed message
- [x] Code pushed to origin/main

## Deployment Status

- [ ] Coolify auto-deploy triggered
- [ ] Build completed successfully
- [ ] All containers running (frontend, backend, db, redis)
- [ ] Backend migrations applied (if any)

## Post-Deployment Verification

### 1. Health Check
```bash
# Test API is responding
curl https://yourdomain.com/api/health

# Check backend logs
docker logs simmaci-backend --tail 100
```

### 2. Test Error Handling (Manual Testing)

**Test Case 1: Null school_id (if possible with test account)**
- Login as operator with null school_id
- Try to submit SK
- Expected: "Akun operator belum terhubung ke sekolah. Hubungi administrator."

**Test Case 2: Valid Submission (Happy Path)**
- Login as valid operator
- Submit SK with complete data
- Expected: 201 response, SK created successfully

### 3. Monitor Logs (First 24-48 Hours)

```bash
# Watch for errors in real-time
docker logs -f simmaci-backend | grep -i error

# Check Laravel logs
docker exec simmaci-backend tail -f storage/logs/laravel.log
```

### 4. Check Sentry (if configured)
- Monitor error rates
- Check for new exception types
- Verify specific error messages are being logged

## Rollback Plan (If Needed)

If critical issues occur:

```bash
# Option 1: Revert commit
git revert 6f2c488
git push origin main

# Option 2: Via Coolify Dashboard
# - Go to deployment history
# - Select previous deployment (02141db)
# - Click "Redeploy"
```

## Success Criteria

- [ ] No increase in error rates
- [ ] Users receive specific error messages (not "Server Error")
- [ ] Valid SK submissions continue to work
- [ ] No new exceptions in logs
- [ ] User feedback is positive

## Notes

- Bug fixed: Generic "Server Error" replaced with specific Indonesian messages
- Changes: Added comprehensive exception handling in SkDocumentController
- Tests: 13 new tests added (bug condition + preservation)
- Impact: Low risk - only error handling changed, core logic preserved

## Contact

If issues arise, check:
1. Laravel logs: `storage/logs/laravel.log`
2. Sentry dashboard (if configured)
3. Coolify deployment logs
4. This spec: `.kiro/specs/sk-submission-server-error/`
