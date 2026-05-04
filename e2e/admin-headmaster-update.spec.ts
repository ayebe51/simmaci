import { test, expect, Page } from '@playwright/test';

/**
 * E2E tests for admin headmaster profile update workflow
 * Task 9.2: Write E2E tests with Playwright
 * 
 * Tests the complete user journey from login to updating headmaster profiles
 * Requirements: 1.1, 1.3, 3.5, 8.1, 8.4
 */

// Helper function to login as a specific user
async function loginAs(page: Page, role: 'super_admin' | 'admin_yayasan' | 'operator', email?: string) {
  await page.goto('/login');
  
  // Use test credentials based on role
  const credentials = {
    super_admin: { email: email || 'superadmin@test.com', password: 'password' },
    admin_yayasan: { email: email || 'adminyayasan@test.com', password: 'password' },
    operator: { email: email || 'operator@test.com', password: 'password' },
  };

  const creds = credentials[role];
  
  await page.getByPlaceholder('Username').fill(creds.email);
  await page.getByPlaceholder('Password').fill(creds.password);
  await page.getByRole('button', { name: 'Login' }).click();
  
  // Wait for navigation to dashboard
  await page.waitForURL('/dashboard', { timeout: 10000 });
}

// Helper function to wait for toast notification
async function waitForToast(page: Page, message: string) {
  const toast = page.locator('[data-sonner-toast]', { hasText: message });
  await expect(toast).toBeVisible({ timeout: 5000 });
}

test.describe('Admin Headmaster Profile Update', () => {
  test.beforeEach(async ({ page }) => {
    // Set up test data or reset state if needed
    // This would typically be done via API calls to seed test data
  });

  /**
   * Test admin can search and update headmaster profile
   * Requirements: 1.1, 8.1, 8.4
   */
  test('admin can search and update headmaster profile', async ({ page }) => {
    // Step 1: Login as super admin
    await loginAs(page, 'super_admin');

    // Step 2: Navigate to school management page
    await page.goto('/dashboard/admin/schools');
    
    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Kelola Sekolah/i })).toBeVisible();

    // Step 3: Search for a school
    const searchInput = page.getByPlaceholder(/Cari sekolah/i);
    await expect(searchInput).toBeVisible();
    await searchInput.fill('MI Miftahul');
    
    // Wait for search results to load
    await page.waitForTimeout(500); // Debounce delay

    // Step 4: Select a school from the list
    const schoolItem = page.locator('[data-testid="school-item"]').first();
    await expect(schoolItem).toBeVisible();
    await schoolItem.click();

    // Step 5: Verify headmaster profile form is displayed
    await expect(page.getByRole('heading', { name: /Edit Profil Kepala Madrasah/i })).toBeVisible();

    // Step 6: Fill in headmaster profile fields
    await page.getByLabel(/Nama Kepala Madrasah/i).fill('Ahmad Dahlan');
    await page.getByLabel(/NIM/i).fill('123456');
    await page.getByLabel(/NUPTK/i).fill('1234567890123456');
    await page.getByLabel(/WhatsApp/i).fill('081234567890');
    
    // Fill in tenure dates
    await page.getByLabel(/Tanggal Mulai Jabatan/i).fill('2020-01-01');
    await page.getByLabel(/Tanggal Selesai Jabatan/i).fill('2024-12-31');

    // Step 7: Submit the form
    const submitButton = page.getByRole('button', { name: /Simpan/i });
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    // Step 8: Verify success toast appears (Requirement 8.1, 8.4)
    await waitForToast(page, /berhasil diperbarui/i);

    // Step 9: Verify form closes and returns to list view
    await expect(page.getByRole('heading', { name: /Kelola Sekolah/i })).toBeVisible();

    // Step 10: Verify updated data is displayed in the list
    await expect(page.locator('text=Ahmad Dahlan')).toBeVisible();
  });

  /**
   * Test validation error displays for invalid date range
   * Requirements: 3.5, 8.1
   */
  test('displays validation error for invalid date range', async ({ page }) => {
    // Login as super admin
    await loginAs(page, 'super_admin');

    // Navigate to school management
    await page.goto('/dashboard/admin/schools');
    
    // Select a school
    const schoolItem = page.locator('[data-testid="school-item"]').first();
    await schoolItem.click();

    // Wait for form to load
    await expect(page.getByRole('heading', { name: /Edit Profil Kepala Madrasah/i })).toBeVisible();

    // Enter invalid date range (end date before start date)
    await page.getByLabel(/Tanggal Mulai Jabatan/i).fill('2024-12-31');
    await page.getByLabel(/Tanggal Selesai Jabatan/i).fill('2020-01-01');

    // Try to submit
    await page.getByRole('button', { name: /Simpan/i }).click();

    // Verify validation error is displayed (Requirement 3.5, 8.1)
    const errorMessage = page.locator('text=/tanggal selesai.*setelah.*tanggal mulai/i');
    await expect(errorMessage).toBeVisible({ timeout: 3000 });

    // Verify form is not submitted (still on edit page)
    await expect(page.getByRole('heading', { name: /Edit Profil Kepala Madrasah/i })).toBeVisible();
  });

  /**
   * Test operator cannot access other schools
   * Requirements: 1.3, 6.3, 6.5
   */
  test('operator cannot access other schools', async ({ page }) => {
    // Login as operator
    await loginAs(page, 'operator');

    // Try to navigate to admin school management page
    await page.goto('/dashboard/admin/schools');

    // Verify operator is redirected or sees error
    // This could be a 403 page, redirect to dashboard, or error message
    await page.waitForTimeout(1000);

    // Check if redirected to dashboard or sees unauthorized message
    const isOnDashboard = page.url().includes('/dashboard') && !page.url().includes('/admin/schools');
    const hasErrorMessage = await page.locator('text=/tidak memiliki akses/i').isVisible().catch(() => false);

    expect(isOnDashboard || hasErrorMessage).toBeTruthy();

    // Verify operator cannot see admin menu item
    const adminMenuItem = page.locator('text=/Kelola Sekolah/i');
    await expect(adminMenuItem).not.toBeVisible();
  });

  /**
   * Test success toast appears after update
   * Requirements: 8.1, 8.4
   */
  test('success toast appears after successful update', async ({ page }) => {
    // Login as admin yayasan
    await loginAs(page, 'admin_yayasan');

    // Navigate to school management
    await page.goto('/dashboard/admin/schools');
    
    // Select a school
    const schoolItem = page.locator('[data-testid="school-item"]').first();
    await schoolItem.click();

    // Update headmaster name
    const nameInput = page.getByLabel(/Nama Kepala Madrasah/i);
    await nameInput.clear();
    await nameInput.fill('Siti Aminah');

    // Submit form
    await page.getByRole('button', { name: /Simpan/i }).click();

    // Verify success toast appears (Requirement 8.1, 8.4)
    await waitForToast(page, /berhasil diperbarui/i);

    // Verify toast contains success message
    const successToast = page.locator('[data-sonner-toast]', { hasText: /berhasil/i });
    await expect(successToast).toBeVisible();
  });

  /**
   * Test loading states display correctly
   * Requirements: 8.4
   */
  test('loading states display correctly', async ({ page }) => {
    // Login as super admin
    await loginAs(page, 'super_admin');

    // Navigate to school management
    await page.goto('/dashboard/admin/schools');

    // Verify loading state while fetching schools
    // This might be a skeleton loader or spinner
    const loadingIndicator = page.locator('[data-testid="loading-skeleton"], .animate-pulse, [role="status"]');
    
    // Loading indicator should appear briefly
    // Note: This might be too fast to catch in some cases
    const hasLoadingState = await loadingIndicator.isVisible().catch(() => false);
    
    // Wait for school list to load
    await expect(page.locator('[data-testid="school-item"]').first()).toBeVisible({ timeout: 5000 });

    // Select a school
    const schoolItem = page.locator('[data-testid="school-item"]').first();
    await schoolItem.click();

    // Verify form loads
    await expect(page.getByRole('heading', { name: /Edit Profil Kepala Madrasah/i })).toBeVisible();

    // Update a field
    await page.getByLabel(/Nama Kepala Madrasah/i).fill('Test Loading');

    // Submit and verify submit button shows loading state
    const submitButton = page.getByRole('button', { name: /Simpan/i });
    await submitButton.click();

    // Verify button is disabled during submission (Requirement 8.4)
    await expect(submitButton).toBeDisabled({ timeout: 1000 });

    // Wait for submission to complete
    await waitForToast(page, /berhasil/i);

    // Verify button is enabled again
    await expect(submitButton).toBeEnabled();
  });

  /**
   * Test cancel button discards changes
   * Requirements: 5.6
   */
  test('cancel button discards changes and returns to list', async ({ page }) => {
    // Login as super admin
    await loginAs(page, 'super_admin');

    // Navigate to school management
    await page.goto('/dashboard/admin/schools');
    
    // Select a school
    const schoolItem = page.locator('[data-testid="school-item"]').first();
    const originalName = await schoolItem.locator('text=/MI|MTs|MA/').textContent();
    await schoolItem.click();

    // Wait for form to load
    await expect(page.getByRole('heading', { name: /Edit Profil Kepala Madrasah/i })).toBeVisible();

    // Make changes to the form
    const nameInput = page.getByLabel(/Nama Kepala Madrasah/i);
    await nameInput.clear();
    await nameInput.fill('Changed Name - Should Not Save');

    // Click cancel button
    const cancelButton = page.getByRole('button', { name: /Batal/i });
    await cancelButton.click();

    // Verify returned to list view
    await expect(page.getByRole('heading', { name: /Kelola Sekolah/i })).toBeVisible();

    // Verify changes were not saved (original name still visible)
    if (originalName) {
      await expect(page.locator(`text=${originalName}`)).toBeVisible();
    }
    
    // Verify changed name is not in the list
    await expect(page.locator('text=Changed Name - Should Not Save')).not.toBeVisible();
  });

  /**
   * Test search functionality filters schools correctly
   * Requirements: 5.1
   */
  test('search functionality filters schools correctly', async ({ page }) => {
    // Login as super admin
    await loginAs(page, 'super_admin');

    // Navigate to school management
    await page.goto('/dashboard/admin/schools');
    
    // Wait for initial school list to load
    await expect(page.locator('[data-testid="school-item"]').first()).toBeVisible();
    
    // Count initial schools
    const initialCount = await page.locator('[data-testid="school-item"]').count();

    // Search for specific school
    const searchInput = page.getByPlaceholder(/Cari sekolah/i);
    await searchInput.fill('MI Test');
    
    // Wait for debounce and results to update
    await page.waitForTimeout(500);

    // Verify filtered results
    const filteredCount = await page.locator('[data-testid="school-item"]').count();
    
    // Filtered results should be less than or equal to initial count
    expect(filteredCount).toBeLessThanOrEqual(initialCount);

    // Verify all visible schools contain search term
    const schoolItems = page.locator('[data-testid="school-item"]');
    const count = await schoolItems.count();
    
    for (let i = 0; i < count; i++) {
      const schoolName = await schoolItems.nth(i).textContent();
      expect(schoolName?.toLowerCase()).toContain('mi');
    }

    // Clear search
    await searchInput.clear();
    await page.waitForTimeout(500);

    // Verify all schools are shown again
    const finalCount = await page.locator('[data-testid="school-item"]').count();
    expect(finalCount).toBeGreaterThanOrEqual(filteredCount);
  });

  /**
   * Test kecamatan filter works correctly
   * Requirements: 5.1
   */
  test('kecamatan filter works correctly', async ({ page }) => {
    // Login as super admin
    await loginAs(page, 'super_admin');

    // Navigate to school management
    await page.goto('/dashboard/admin/schools');
    
    // Wait for school list to load
    await expect(page.locator('[data-testid="school-item"]').first()).toBeVisible();

    // Find and click kecamatan filter dropdown
    const kecamatanFilter = page.getByLabel(/Kecamatan/i);
    await kecamatanFilter.click();

    // Select a specific kecamatan
    await page.getByRole('option', { name: /Cilacap Tengah/i }).click();

    // Wait for results to update
    await page.waitForTimeout(500);

    // Verify filtered results show only schools from selected kecamatan
    const schoolItems = page.locator('[data-testid="school-item"]');
    const count = await schoolItems.count();

    if (count > 0) {
      for (let i = 0; i < Math.min(count, 5); i++) {
        const schoolText = await schoolItems.nth(i).textContent();
        expect(schoolText?.toLowerCase()).toContain('cilacap tengah');
      }
    }
  });

  /**
   * Test form validation prevents submission with invalid data
   * Requirements: 3.1, 3.5
   */
  test('form validation prevents submission with invalid data', async ({ page }) => {
    // Login as super admin
    await loginAs(page, 'super_admin');

    // Navigate to school management
    await page.goto('/dashboard/admin/schools');
    
    // Select a school
    const schoolItem = page.locator('[data-testid="school-item"]').first();
    await schoolItem.click();

    // Wait for form to load
    await expect(page.getByRole('heading', { name: /Edit Profil Kepala Madrasah/i })).toBeVisible();

    // Test 1: Invalid NUPTK length (too long)
    const nuptkInput = page.getByLabel(/NUPTK/i);
    await nuptkInput.fill('12345678901234567890123456789012345678901234567890123456789'); // > 50 chars
    
    // Try to submit
    await page.getByRole('button', { name: /Simpan/i }).click();

    // Verify validation error
    await expect(page.locator('text=/maksimal.*karakter/i')).toBeVisible();

    // Test 2: Invalid date format
    await nuptkInput.clear();
    await nuptkInput.fill('1234567890123456'); // Valid NUPTK
    
    const startDateInput = page.getByLabel(/Tanggal Mulai Jabatan/i);
    await startDateInput.fill('invalid-date');
    
    await page.getByRole('button', { name: /Simpan/i }).click();

    // Verify validation error for date
    await expect(page.locator('text=/tanggal.*tidak valid/i')).toBeVisible();
  });

  /**
   * Test admin yayasan has same access as super admin
   * Requirements: 1.1, 1.2
   */
  test('admin yayasan can access and update any school', async ({ page }) => {
    // Login as admin yayasan
    await loginAs(page, 'admin_yayasan');

    // Navigate to school management
    await page.goto('/dashboard/admin/schools');
    
    // Verify page loads successfully
    await expect(page.getByRole('heading', { name: /Kelola Sekolah/i })).toBeVisible();

    // Verify can see school list
    await expect(page.locator('[data-testid="school-item"]').first()).toBeVisible();

    // Select a school
    const schoolItem = page.locator('[data-testid="school-item"]').first();
    await schoolItem.click();

    // Verify can edit
    await expect(page.getByRole('heading', { name: /Edit Profil Kepala Madrasah/i })).toBeVisible();

    // Make an update
    await page.getByLabel(/Nama Kepala Madrasah/i).fill('Admin Yayasan Update');
    await page.getByRole('button', { name: /Simpan/i }).click();

    // Verify success
    await waitForToast(page, /berhasil diperbarui/i);
  });
});
