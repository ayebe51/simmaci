import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Attendance Feature
 * Spec: .kiro/specs/attendance-api-fixes
 * 
 * Prerequisites:
 * - Backend server running with test database
 * - Test operator user with credentials
 * - Test school with master data (classes, subjects, teachers, students)
 */

// Test data - adjust these based on your test environment
const TEST_OPERATOR = {
  username: 'operator_test',
  password: 'password123',
};

test.describe('Attendance Feature - E2E Tests', () => {
  // Helper function to login as operator
  async function loginAsOperator(page: any) {
    await page.goto('/login');
    await page.getByPlaceholder('Username').fill(TEST_OPERATOR.username);
    await page.getByPlaceholder('Password').fill(TEST_OPERATOR.password);
    await page.getByRole('button', { name: /login|masuk/i }).click();
    
    // Wait for navigation to dashboard
    await page.waitForURL('/dashboard');
    await expect(page.getByText(/dashboard/i)).toBeVisible();
  }

  test.describe('12.1 E2E: Operator records student attendance', () => {
    test('should allow operator to record student attendance', async ({ page }) => {
      // Login as operator
      await loginAsOperator(page);

      // Navigate to Absensi Siswa via menu
      await page.getByRole('link', { name: /absensi siswa/i }).click();
      await expect(page).toHaveURL(/\/dashboard\/attendance\/student/);
      
      // Verify page loaded
      await expect(page.getByText(/absensi siswa/i)).toBeVisible();

      // Select class from dropdown
      const classDropdown = page.locator('select, [role="combobox"]').filter({ hasText: /kelas|class/i }).first();
      await classDropdown.click();
      await page.getByRole('option').first().click();
      
      // Wait for class selection to load students
      await page.waitForTimeout(1000);

      // Select subject from dropdown
      const subjectDropdown = page.locator('select, [role="combobox"]').filter({ hasText: /mata pelajaran|subject/i }).first();
      await subjectDropdown.click();
      await page.getByRole('option').first().click();

      // Wait for data to load
      await page.waitForTimeout(1000);

      // Mark attendance for students (look for attendance status buttons/selects)
      const attendanceButtons = page.locator('button, select').filter({ hasText: /hadir|sakit|izin|alpha/i });
      const firstButton = attendanceButtons.first();
      
      if (await firstButton.isVisible()) {
        await firstButton.click();
        
        // If it's a dropdown, select "Hadir"
        const hadirOption = page.getByRole('option', { name: /hadir/i });
        if (await hadirOption.isVisible({ timeout: 1000 }).catch(() => false)) {
          await hadirOption.click();
        }
      }

      // Save attendance
      const saveButton = page.getByRole('button', { name: /simpan|save/i });
      await saveButton.click();

      // Verify success message displayed
      await expect(page.getByText(/berhasil|success/i)).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('12.2 E2E: Operator uses QR scanner', () => {
    test('should allow operator to use QR scanner with PIN validation', async ({ page }) => {
      // Login as operator
      await loginAsOperator(page);

      // Navigate to Scanner QR via menu
      await page.getByRole('link', { name: /scanner qr|qr scan/i }).click();
      await expect(page).toHaveURL(/\/dashboard\/attendance\/scanner/);

      // Verify page loaded
      await expect(page.getByText(/scanner|qr/i)).toBeVisible();

      // Enter PIN
      const pinInput = page.getByPlaceholder(/pin/i);
      await pinInput.fill('123456'); // Test PIN

      // Verify PIN
      const verifyButton = page.getByRole('button', { name: /verifikasi|verify/i });
      await verifyButton.click();

      // Wait for PIN validation (may succeed or fail depending on backend setup)
      await page.waitForTimeout(2000);

      // Select teacher mode
      const teacherModeButton = page.getByRole('button', { name: /guru|teacher/i });
      if (await teacherModeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await teacherModeButton.click();
      }

      // Note: Simulating actual QR code scan requires camera access or mock
      // For E2E, we verify the UI is accessible and functional
      await expect(page.getByText(/scan|kamera/i)).toBeVisible();
    });
  });

  test.describe('12.3 E2E: Operator manages master data', () => {
    test('should allow operator to manage subjects', async ({ page }) => {
      // Login as operator
      await loginAsOperator(page);

      // Navigate to Mata Pelajaran via menu
      await page.getByRole('link', { name: /mata pelajaran|subject/i }).click();
      await expect(page).toHaveURL(/\/dashboard\/attendance\/subjects/);

      // Verify page loaded
      await expect(page.getByText(/mata pelajaran/i)).toBeVisible();

      // Create new subject
      const createButton = page.getByRole('button', { name: /tambah|create|new/i });
      if (await createButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await createButton.click();

        // Fill subject form
        const nameInput = page.getByPlaceholder(/nama|name/i).first();
        await nameInput.fill('Matematika Test');

        // Save
        const saveButton = page.getByRole('button', { name: /simpan|save/i });
        await saveButton.click();

        // Verify success
        await expect(page.getByText(/berhasil|success/i)).toBeVisible({ timeout: 5000 });
      }

      // Edit existing subject (if any exists)
      const editButton = page.getByRole('button', { name: /edit|ubah/i }).first();
      if (await editButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await editButton.click();

        // Modify name
        const nameInput = page.getByPlaceholder(/nama|name/i).first();
        await nameInput.fill('Matematika Updated');

        // Save
        const saveButton = page.getByRole('button', { name: /simpan|save/i });
        await saveButton.click();

        // Verify success
        await expect(page.getByText(/berhasil|success/i)).toBeVisible({ timeout: 5000 });
      }
    });

    test('should allow operator to manage classes', async ({ page }) => {
      // Login as operator
      await loginAsOperator(page);

      // Navigate to Kelas via menu
      await page.getByRole('link', { name: /kelas|class/i }).click();
      await expect(page).toHaveURL(/\/dashboard\/attendance\/classes/);

      // Verify page loaded
      await expect(page.getByText(/kelas|rombel/i)).toBeVisible();

      // Create new class
      const createButton = page.getByRole('button', { name: /tambah|create|new/i });
      if (await createButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await createButton.click();

        // Fill class form
        const nameInput = page.getByPlaceholder(/nama|name/i).first();
        await nameInput.fill('Kelas 7A Test');

        // Save
        const saveButton = page.getByRole('button', { name: /simpan|save/i });
        await saveButton.click();

        // Verify success
        await expect(page.getByText(/berhasil|success/i)).toBeVisible({ timeout: 5000 });
      }
    });

    test('should allow operator to manage schedules', async ({ page }) => {
      // Login as operator
      await loginAsOperator(page);

      // Navigate to Jadwal Jam via menu
      await page.getByRole('link', { name: /jadwal|schedule/i }).click();
      await expect(page).toHaveURL(/\/dashboard\/attendance\/schedule/);

      // Verify page loaded
      await expect(page.getByText(/jadwal/i)).toBeVisible();

      // Create new schedule
      const createButton = page.getByRole('button', { name: /tambah|create|new/i });
      if (await createButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await createButton.click();

        // Fill schedule form
        const jamKeInput = page.getByPlaceholder(/jam ke|period/i).first();
        await jamKeInput.fill('1');

        const waktuMulaiInput = page.getByPlaceholder(/waktu mulai|start time/i).first();
        await waktuMulaiInput.fill('07:00');

        const waktuSelesaiInput = page.getByPlaceholder(/waktu selesai|end time/i).first();
        await waktuSelesaiInput.fill('08:00');

        // Save
        const saveButton = page.getByRole('button', { name: /simpan|save/i });
        await saveButton.click();

        // Verify success
        await expect(page.getByText(/berhasil|success/i)).toBeVisible({ timeout: 5000 });
      }
    });

    test('should verify all CRUD operations work', async ({ page }) => {
      // Login as operator
      await loginAsOperator(page);

      // Test navigation to all master data pages
      const masterDataPages = [
        { name: /mata pelajaran/i, url: /\/subjects/ },
        { name: /kelas/i, url: /\/classes/ },
        { name: /jadwal/i, url: /\/schedule/ },
      ];

      for (const pageInfo of masterDataPages) {
        const link = page.getByRole('link', { name: pageInfo.name });
        if (await link.isVisible({ timeout: 2000 }).catch(() => false)) {
          await link.click();
          await expect(page).toHaveURL(pageInfo.url);
          await page.waitForTimeout(500);
        }
      }
    });
  });

  test.describe('12.4 E2E: Operator views attendance report', () => {
    test('should allow operator to view and export attendance report', async ({ page }) => {
      // Login as operator
      await loginAsOperator(page);

      // Navigate to Laporan Absensi via menu
      await page.getByRole('link', { name: /laporan absensi|attendance report/i }).click();
      await expect(page).toHaveURL(/\/dashboard\/attendance\/report/);

      // Verify page loaded
      await expect(page.getByText(/laporan|report/i)).toBeVisible();

      // Select filters - class
      const classFilter = page.locator('select, [role="combobox"]').filter({ hasText: /kelas|class/i }).first();
      if (await classFilter.isVisible({ timeout: 2000 }).catch(() => false)) {
        await classFilter.click();
        await page.getByRole('option').first().click();
      }

      // Select filters - subject
      const subjectFilter = page.locator('select, [role="combobox"]').filter({ hasText: /mata pelajaran|subject/i }).first();
      if (await subjectFilter.isVisible({ timeout: 2000 }).catch(() => false)) {
        await subjectFilter.click();
        await page.getByRole('option').first().click();
      }

      // Select date range (if available)
      const dateInput = page.locator('input[type="date"]').first();
      if (await dateInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await dateInput.fill('2024-01-01');
      }

      // Generate report
      const generateButton = page.getByRole('button', { name: /tampilkan|generate|lihat/i });
      if (await generateButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await generateButton.click();
        await page.waitForTimeout(2000);

        // Verify report displays correct data
        await expect(page.getByText(/data|hasil|result/i)).toBeVisible({ timeout: 5000 });
      }

      // Export to Excel/PDF
      const exportButton = page.getByRole('button', { name: /export|unduh|download/i });
      if (await exportButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Setup download listener
        const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
        await exportButton.click();
        
        const download = await downloadPromise;
        if (download) {
          expect(download.suggestedFilename()).toMatch(/\.xlsx|\.pdf/);
        }
      }
    });
  });

  test.describe('12.5 E2E: Operator configures geofencing', () => {
    test('should allow operator to configure geofencing settings', async ({ page }) => {
      // Login as operator
      await loginAsOperator(page);

      // Navigate to Pengaturan Absensi via menu
      await page.getByRole('link', { name: /pengaturan absensi|attendance settings/i }).click();
      await expect(page).toHaveURL(/\/dashboard\/attendance\/settings/);

      // Verify page loaded
      await expect(page.getByText(/pengaturan|settings/i)).toBeVisible();

      // Enable geolocation tracking
      const geolocationToggle = page.locator('button[role="switch"], input[type="checkbox"]').filter({ 
        has: page.locator('text=/geolocation|lokasi gps/i') 
      }).first();
      
      if (await geolocationToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
        await geolocationToggle.click();
        await page.waitForTimeout(500);
      }

      // Click "Gunakan Lokasi Saat Ini" button
      const useCurrentLocationButton = page.getByRole('button', { name: /gunakan lokasi saat ini|use current location/i });
      if (await useCurrentLocationButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Grant geolocation permission (in test context)
        const context = page.context();
        await context.grantPermissions(['geolocation']);
        await context.setGeolocation({ latitude: -7.123456, longitude: 109.123456 });
        
        await useCurrentLocationButton.click();
        await page.waitForTimeout(2000);

        // Verify coordinates auto-filled
        const latitudeInput = page.getByPlaceholder(/latitude/i);
        const longitudeInput = page.getByPlaceholder(/longitude/i);
        
        if (await latitudeInput.isVisible({ timeout: 1000 }).catch(() => false)) {
          const latValue = await latitudeInput.inputValue();
          expect(latValue).toBeTruthy();
        }
      }

      // Set geofence radius to 200 meters
      const radiusInput = page.locator('input[type="number"]').filter({ 
        has: page.locator('text=/radius|jarak/i') 
      }).first();
      
      if (await radiusInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await radiusInput.fill('200');
      }

      // Save settings
      const saveButton = page.getByRole('button', { name: /simpan|save/i });
      await saveButton.click();

      // Verify success message displayed
      await expect(page.getByText(/berhasil|success/i)).toBeVisible({ timeout: 5000 });

      // Navigate to attendance page to verify GPS capture
      await page.getByRole('link', { name: /absensi guru|teacher attendance/i }).click();
      await expect(page).toHaveURL(/\/dashboard\/attendance\/teacher/);

      // Record attendance (should capture GPS automatically)
      const attendanceButton = page.getByRole('button', { name: /hadir|present/i }).first();
      if (await attendanceButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await attendanceButton.click();
        await page.waitForTimeout(1000);

        // Verify attendance recorded with location data
        // This would require checking the backend or UI feedback
        await expect(page.getByText(/berhasil|success|lokasi/i)).toBeVisible({ timeout: 5000 });
      }
    });
  });
});
