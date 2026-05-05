# E2E Tests for SIMMACI

This directory contains end-to-end tests using Playwright for the SIMMACI application.

## Test Files

- `auth.spec.ts` - Authentication flow tests
- `attendance.spec.ts` - Attendance feature E2E tests (spec: `.kiro/specs/attendance-api-fixes`)
- `admin-headmaster-update.spec.ts` - Admin headmaster update tests
- `school-autocomplete.spec.ts` - School autocomplete tests

## Prerequisites

### 1. Install Dependencies

```bash
npm install
npx playwright install
```

### 2. Backend Setup

The E2E tests require a running backend with test data. You have two options:

#### Option A: Use Test Database

1. Create a test database:
```bash
cd backend
cp .env .env.test
# Edit .env.test to use test database
php artisan migrate:fresh --seed --env=test
```

2. Run backend with test environment:
```bash
php artisan serve --env=test
```

#### Option B: Use Development Database

1. Ensure development database has test data:
```bash
cd backend
php artisan migrate:fresh --seed
```

2. Run backend:
```bash
php artisan serve
```

### 3. Create Test Operator User

For attendance tests, you need a test operator user. Run this in Laravel Tinker:

```bash
cd backend
php artisan tinker
```

```php
// Create test school
$school = \App\Models\School::create([
    'nama' => 'Sekolah Test E2E',
    'npsn' => '99999999',
    'alamat' => 'Jl. Test No. 1',
    'kecamatan_id' => 1,
    'jenjang' => 'MI',
]);

// Create test operator user
$user = \App\Models\User::create([
    'name' => 'Operator Test',
    'username' => 'operator_test',
    'email' => 'operator_test@example.com',
    'password' => bcrypt('password123'),
    'school_id' => $school->id,
]);

// Assign operator role
$user->assignRole('operator');

// Create test master data
$subject = \App\Models\AttendanceSubject::create([
    'school_id' => $school->id,
    'nama' => 'Matematika',
]);

$class = \App\Models\AttendanceClass::create([
    'school_id' => $school->id,
    'nama' => 'Kelas 7A',
]);

$schedule = \App\Models\AttendanceSchedule::create([
    'school_id' => $school->id,
    'jam_ke' => 1,
    'waktu_mulai' => '07:00',
    'waktu_selesai' => '08:00',
]);

// Create test teacher
$teacher = \App\Models\Teacher::create([
    'school_id' => $school->id,
    'nama' => 'Guru Test',
    'nip' => '1234567890',
]);

// Create test students
for ($i = 1; $i <= 5; $i++) {
    \App\Models\Student::create([
        'school_id' => $school->id,
        'nama' => "Siswa Test $i",
        'nisn' => "999999999$i",
        'class_id' => $class->id,
    ]);
}

// Create attendance settings with PIN
\App\Models\AttendanceSetting::create([
    'school_id' => $school->id,
    'scanner_pin' => '123456',
    'geolocation_enabled' => false,
]);
```

### 4. Update Test Credentials

Edit `e2e/attendance.spec.ts` and update the test credentials if needed:

```typescript
const TEST_OPERATOR = {
  username: 'operator_test',
  password: 'password123',
};
```

## Running Tests

### Run All E2E Tests

```bash
npm run test:e2e
```

### Run Specific Test File

```bash
npx playwright test e2e/attendance.spec.ts
```

### Run Specific Test Suite

```bash
npx playwright test e2e/attendance.spec.ts -g "Operator records student attendance"
```

### Run in UI Mode (Interactive)

```bash
npx playwright test --ui
```

### Run in Debug Mode

```bash
npx playwright test --debug
```

### Run with Headed Browser (See the browser)

```bash
npx playwright test --headed
```

## Test Structure

### Attendance E2E Tests

The attendance tests cover all requirements from the bugfix spec:

#### 12.1 - Operator Records Student Attendance
- Login as operator
- Navigate to Absensi Siswa via menu
- Select class and subject from dropdowns
- Mark attendance for students
- Save attendance
- Verify success message

**Requirements**: 2.1, 2.2, 2.12, 2.13, 2.15

#### 12.2 - Operator Uses QR Scanner
- Login as operator
- Navigate to Scanner QR via menu
- Enter PIN and verify
- Select teacher mode
- Verify scanner UI is accessible

**Requirements**: 2.9, 2.14, 2.15

#### 12.3 - Operator Manages Master Data
- Login as operator
- Navigate to Mata Pelajaran, Kelas, Jadwal Jam
- Create new records
- Edit existing records
- Verify all CRUD operations work

**Requirements**: 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.15

#### 12.4 - Operator Views Attendance Report
- Login as operator
- Navigate to Laporan Absensi
- Select filters (class, subject, date range)
- Generate report
- Verify report displays correct data
- Export to Excel/PDF

**Requirements**: 2.15, 3.2

#### 12.5 - Operator Configures Geofencing
- Login as operator
- Navigate to Pengaturan Absensi
- Enable geolocation tracking
- Click "Gunakan Lokasi Saat Ini" button
- Verify coordinates auto-filled
- Set geofence radius to 200 meters
- Save settings
- Record attendance with GPS capture

**Requirements**: 2.16, 2.19

## Troubleshooting

### Tests Fail with "Timeout"

- Ensure backend is running on `http://localhost:8000`
- Ensure frontend dev server is running on `http://localhost:5173`
- Increase timeout in `playwright.config.ts`

### Tests Fail with "Element not found"

- The UI might have changed. Update selectors in test files.
- Use Playwright Inspector to debug: `npx playwright test --debug`

### Tests Fail with "401 Unauthorized"

- Ensure test user exists in database
- Verify credentials in test file match database
- Check that Sanctum authentication is working

### Geolocation Tests Fail

- Geolocation permission is granted in test context
- Mock geolocation is set to `-7.123456, 109.123456`
- Ensure backend geofencing validation is not too strict for test coordinates

## CI/CD Integration

The tests are configured to run in CI via GitHub Actions. See `.github/workflows/` for configuration.

In CI mode:
- Tests run with 1 worker (sequential)
- Retries are disabled
- HTML report is generated

## Best Practices

1. **Isolation**: Each test should be independent and not rely on state from other tests
2. **Cleanup**: Tests should clean up any data they create (or use transactions)
3. **Selectors**: Use semantic selectors (role, text) over CSS selectors when possible
4. **Waits**: Use `waitForTimeout` sparingly; prefer `waitForSelector` or `waitForURL`
5. **Assertions**: Use Playwright's built-in assertions with timeout support

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright Selectors](https://playwright.dev/docs/selectors)
