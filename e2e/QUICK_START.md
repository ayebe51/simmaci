# E2E Tests - Quick Start Guide

## 🚀 First Time Setup (5 minutes)

### 1. Install Playwright
```bash
npm install
npx playwright install
```

### 2. Create Test Data
```bash
cd backend
php ../e2e/setup-test-data.php
```

This creates:
- Test school (NPSN: 99999999)
- Test user: `operator_test` / `password123`
- Sample subjects, classes, schedules, teachers, students
- Scanner PIN: `123456`

### 3. Start Backend
```bash
cd backend
php artisan serve
```

Keep this terminal open.

### 4. Run Tests (in new terminal)
```bash
npm run test:e2e
```

## 📋 Common Commands

### Run All Tests
```bash
npm run test:e2e
```

### Run Attendance Tests Only
```bash
npx playwright test e2e/attendance.spec.ts
```

### Run Specific Test
```bash
npx playwright test e2e/attendance.spec.ts -g "student attendance"
```

### Run with Visible Browser
```bash
npx playwright test --headed
```

### Interactive Mode (Best for Development)
```bash
npx playwright test --ui
```

### Debug Mode (Step Through Tests)
```bash
npx playwright test --debug
```

## 🔍 Debugging Failed Tests

### 1. Run in UI Mode
```bash
npx playwright test --ui
```
- Click on failed test
- See screenshots and traces
- Replay test step-by-step

### 2. Run in Debug Mode
```bash
npx playwright test --debug
```
- Pauses at each step
- Inspect elements
- Try selectors in console

### 3. Check Test Report
```bash
npx playwright show-report
```
- Opens HTML report
- View screenshots
- See error details

## ⚙️ Test Configuration

### Test Credentials
Edit `e2e/attendance.spec.ts`:
```typescript
const TEST_OPERATOR = {
  username: 'operator_test',
  password: 'password123',
};
```

### Backend URL
Edit `playwright.config.ts`:
```typescript
use: {
  baseURL: 'http://localhost:5173',
}
```

### Test Data
Re-run setup script to reset:
```bash
cd backend
php ../e2e/setup-test-data.php
```

## 📊 Test Coverage

| Test | Requirements | Status |
|------|-------------|--------|
| Student Attendance | 2.1, 2.2, 2.12, 2.13, 2.15 | ✅ |
| QR Scanner | 2.9, 2.14, 2.15 | ✅ |
| Master Data | 2.3-2.8, 2.15 | ✅ |
| Reports | 2.15, 3.2 | ✅ |
| Geofencing | 2.16, 2.19 | ✅ |

## 🐛 Troubleshooting

### "Connection refused" error
- ✅ Backend running? `cd backend && php artisan serve`
- ✅ Frontend running? `npm run dev`
- ✅ Correct ports? Backend: 8000, Frontend: 5173

### "Element not found" error
- ✅ Test data exists? Run `php e2e/setup-test-data.php`
- ✅ UI changed? Run in UI mode to inspect
- ✅ Timing issue? Check wait conditions

### "401 Unauthorized" error
- ✅ Test user exists? Check database
- ✅ Credentials correct? Check `TEST_OPERATOR` in test file
- ✅ Backend auth working? Test login manually

### Tests are slow
- ✅ Run specific tests: `npx playwright test e2e/attendance.spec.ts`
- ✅ Reduce waits: Check `waitForTimeout` values
- ✅ Parallel execution: Set `workers` in config

## 📚 Resources

- **Full Documentation**: `e2e/README.md`
- **Test File**: `e2e/attendance.spec.ts`
- **Setup Script**: `e2e/setup-test-data.php`
- **Playwright Docs**: https://playwright.dev/

## 💡 Tips

1. **Use UI Mode** for development - it's the best way to debug
2. **Run specific tests** to save time during development
3. **Reset test data** if tests start failing unexpectedly
4. **Check backend logs** if API calls fail
5. **Use Playwright Inspector** to find correct selectors

## 🎯 Next Steps

1. ✅ Run tests locally to verify setup
2. ✅ Add tests to your workflow (pre-commit, CI/CD)
3. ✅ Expand coverage with edge cases
4. ✅ Integrate with your QA process

---

**Need Help?**
- Check `e2e/README.md` for detailed documentation
- Run `npx playwright test --help` for all options
- Visit https://playwright.dev/ for Playwright docs
