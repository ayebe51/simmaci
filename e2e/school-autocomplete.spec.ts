import { test, expect } from '@playwright/test';

test.describe('School Autocomplete', () => {
  // Mock data for testing
  const mockSchools = [
    { id: 1, nama: 'MI Darwata Glempang', kecamatan: 'Adipala' },
    { id: 2, nama: 'MTs NU Cilacap', kecamatan: 'Cilacap Tengah' },
    { id: 3, nama: 'MA Al-Hikmah', kecamatan: 'Kroya' },
    { id: 4, nama: 'SD Negeri 1 Cilacap', kecamatan: 'Cilacap Selatan' }
  ];

  test.beforeEach(async ({ page }) => {
    // Mock the schools API endpoint
    await page.route('**/api/schools*', async (route) => {
      const url = new URL(route.request().url());
      const search = url.searchParams.get('search') || '';
      
      // Filter schools based on search query
      const filteredSchools = search.length >= 2 
        ? mockSchools.filter(school => 
            school.nama.toLowerCase().includes(search.toLowerCase())
          )
        : mockSchools;
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(filteredSchools)
      });
    });

    // Mock auth API to return different user types
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          name: 'Test User',
          role: 'operator', // Default to operator, will be overridden in specific tests
          school_id: 1,
          unit: 'MI Darwata Glempang'
        })
      });
    });

    // Mock school profile API for operators
    await page.route('**/api/schools/profile', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          nama: 'MI Darwata Glempang',
          kecamatan: 'Adipala'
        })
      });
    });
  });

  test('should display autocomplete suggestions when typing', async ({ page }) => {
    // Navigate to SK submission page
    await page.goto('/dashboard/sk/submit');
    
    // Wait for the page to load
    await expect(page.getByText('Pengajuan SK Baru')).toBeVisible();
    
    // Find the school autocomplete button (combobox trigger)
    const schoolCombobox = page.getByRole('combobox').filter({ hasText: /Unit Kerja|Madrasah/ }).first();
    await expect(schoolCombobox).toBeVisible();
    
    // Click to open the autocomplete
    await schoolCombobox.click();
    
    // Wait for the popover to open
    await expect(page.getByPlaceholder('Cari madrasah...')).toBeVisible();
    
    // Type in the search input
    const searchInput = page.getByPlaceholder('Cari madrasah...');
    await searchInput.fill('MI');
    
    // Wait for suggestions to appear
    await expect(page.getByText('MI Darwata Glempang')).toBeVisible();
    
    // Verify that filtered results are shown
    await expect(page.getByText('MI Darwata Glempang')).toBeVisible();
    await expect(page.getByText('Kec. Adipala')).toBeVisible();
    
    // Verify that non-matching schools are not shown
    await expect(page.getByText('MTs NU Cilacap')).not.toBeVisible();
  });

  test('should populate field when selecting from autocomplete', async ({ page }) => {
    await page.goto('/dashboard/sk/submit');
    
    // Open the autocomplete
    const schoolCombobox = page.getByRole('combobox').filter({ hasText: /Unit Kerja|Madrasah/ }).first();
    await schoolCombobox.click();
    
    // Type to search
    const searchInput = page.getByPlaceholder('Cari madrasah...');
    await searchInput.fill('MTs');
    
    // Wait for and click on a suggestion
    await expect(page.getByText('MTs NU Cilacap')).toBeVisible();
    await page.getByText('MTs NU Cilacap').click();
    
    // Verify the field is populated with the selected school
    await expect(schoolCombobox).toContainText('MTs NU Cilacap');
    
    // Verify the popover is closed
    await expect(page.getByPlaceholder('Cari madrasah...')).not.toBeVisible();
  });

  test('should show minimum character requirement message', async ({ page }) => {
    await page.goto('/dashboard/sk/submit');
    
    // Open the autocomplete
    const schoolCombobox = page.getByRole('combobox').filter({ hasText: /Unit Kerja|Madrasah/ }).first();
    await schoolCombobox.click();
    
    // Type only 1 character
    const searchInput = page.getByPlaceholder('Cari madrasah...');
    await searchInput.fill('M');
    
    // Verify minimum character message is shown
    await expect(page.getByText('Ketik minimal 2 karakter untuk mencari')).toBeVisible();
  });
  test('should show loading state while fetching', async ({ page }) => {
    // Add delay to the API response to test loading state
    await page.route('**/api/schools*', async (route) => {
      // Add a small delay to simulate network request
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSchools)
      });
    });

    await page.goto('/dashboard/sk/submit');
    
    // Open the autocomplete
    const schoolCombobox = page.getByRole('combobox').filter({ hasText: /Unit Kerja|Madrasah/ }).first();
    await schoolCombobox.click();
    
    // Type to trigger search
    const searchInput = page.getByPlaceholder('Cari madrasah...');
    await searchInput.fill('MI');
    
    // Verify loading state appears briefly
    await expect(page.getByText('Memuat...')).toBeVisible();
  });

  test('should show "not found" message for no results', async ({ page }) => {
    await page.goto('/dashboard/sk/submit');
    
    // Open the autocomplete
    const schoolCombobox = page.getByRole('combobox').filter({ hasText: /Unit Kerja|Madrasah/ }).first();
    await schoolCombobox.click();
    
    // Type a search that won't match any schools
    const searchInput = page.getByPlaceholder('Cari madrasah...');
    await searchInput.fill('XYZ');
    
    // Verify "not found" message is shown
    await expect(page.getByText('Madrasah tidak ditemukan')).toBeVisible();
  });

  test('operator cannot edit pre-populated school field', async ({ page }) => {
    // Mock auth API to return operator with assigned school
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          name: 'Operator User',
          role: 'operator',
          school_id: 1,
          unit: 'MI Darwata Glempang'
        })
      });
    });

    await page.goto('/dashboard/sk/submit');
    
    // Wait for the school profile to load and populate the field
    await page.waitForTimeout(500); // Give time for the useEffect to run
    
    // Find the school autocomplete button
    const schoolCombobox = page.getByRole('combobox').filter({ hasText: /Unit Kerja|Madrasah/ }).first();
    
    // Verify the field is pre-populated with the operator's school
    await expect(schoolCombobox).toContainText('MI Darwata Glempang');
    
    // Verify the field is disabled (should have disabled attribute or styling)
    await expect(schoolCombobox).toBeDisabled();
  });

  test('super admin can use free-text entry', async ({ page }) => {
    // Mock auth API to return super admin
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          name: 'Super Admin',
          role: 'super_admin',
          school_id: null,
          unit: null
        })
      });
    });

    await page.goto('/dashboard/sk/submit');
    
    // For super admin, there should be a regular text input instead of autocomplete
    const unitKerjaInput = page.locator('input[placeholder="Nama Madrasah"]');
    await expect(unitKerjaInput).toBeVisible();
    
    // Verify super admin can type freely
    await unitKerjaInput.fill('Sekolah Baru Test');
    await expect(unitKerjaInput).toHaveValue('Sekolah Baru Test');
    
    // Verify there's no autocomplete combobox for super admin
    const schoolCombobox = page.getByRole('combobox').filter({ hasText: /Unit Kerja|Madrasah/ });
    await expect(schoolCombobox).not.toBeVisible();
  });

  test('admin yayasan can use free-text entry', async ({ page }) => {
    // Mock auth API to return admin yayasan
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          name: 'Admin Yayasan',
          role: 'admin_yayasan',
          school_id: null,
          unit: null
        })
      });
    });

    await page.goto('/dashboard/sk/submit');
    
    // For admin yayasan, there should be a regular text input instead of autocomplete
    const unitKerjaInput = page.locator('input[placeholder="Nama Madrasah"]');
    await expect(unitKerjaInput).toBeVisible();
    
    // Verify admin yayasan can type freely
    await unitKerjaInput.fill('Madrasah Admin Test');
    await expect(unitKerjaInput).toHaveValue('Madrasah Admin Test');
  });

  test('should display validation error for invalid school selection', async ({ page }) => {
    await page.goto('/dashboard/sk/submit');
    
    // Try to submit form without selecting a school
    const submitButton = page.getByRole('button', { name: /Simpan & Ajukan/i });
    
    // Fill required fields first
    await page.getByPlaceholder('Pilih Jenis SK').click();
    await page.getByText('SK Guru Tetap Yayasan').click();
    
    await page.getByPlaceholder('Cth: Ahmad Subagyo, S.Pd').fill('Test Teacher');
    await page.getByPlaceholder('Cth: Guru Mapel, Kamad...').fill('Guru');
    await page.getByPlaceholder('Kota Kelahiran').fill('Jakarta');
    await page.locator('input[type="date"]').first().fill('1990-01-01');
    
    await page.getByPlaceholder('Pilih Pendidikan').click();
    await page.getByText('S1').click();
    
    await page.locator('input[type="date"]').nth(1).fill('2020-01-01');
    
    // Try to submit without selecting school
    await submitButton.click();
    
    // Verify validation error is shown
    await expect(page.getByText('Madrasah tidak valid. Pilih dari daftar yang tersedia.')).toBeVisible();
  });

  test('should cache search results for performance', async ({ page }) => {
    let apiCallCount = 0;
    
    // Count API calls
    await page.route('**/api/schools*', async (route) => {
      apiCallCount++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSchools)
      });
    });

    await page.goto('/dashboard/sk/submit');
    
    // Open autocomplete and search
    const schoolCombobox = page.getByRole('combobox').filter({ hasText: /Unit Kerja|Madrasah/ }).first();
    await schoolCombobox.click();
    
    const searchInput = page.getByPlaceholder('Cari madrasah...');
    await searchInput.fill('MI');
    
    // Wait for results
    await expect(page.getByText('MI Darwata Glempang')).toBeVisible();
    
    // Close and reopen with same search - should use cache
    await page.keyboard.press('Escape');
    await schoolCombobox.click();
    await searchInput.fill('MI');
    
    // Wait a bit to ensure any potential API call would have happened
    await page.waitForTimeout(200);
    
    // Should still show results from cache
    await expect(page.getByText('MI Darwata Glempang')).toBeVisible();
    
    // API should only be called once due to caching
    expect(apiCallCount).toBe(1);
  });

  test('should handle keyboard navigation', async ({ page }) => {
    await page.goto('/dashboard/sk/submit');
    
    // Open the autocomplete
    const schoolCombobox = page.getByRole('combobox').filter({ hasText: /Unit Kerja|Madrasah/ }).first();
    await schoolCombobox.click();
    
    // Type to search
    const searchInput = page.getByPlaceholder('Cari madrasah...');
    await searchInput.fill('M');
    
    // Wait for results
    await expect(page.getByText('MI Darwata Glempang')).toBeVisible();
    
    // Use arrow keys to navigate
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    
    // Press Enter to select
    await page.keyboard.press('Enter');
    
    // Verify selection was made
    await expect(schoolCombobox).toContainText('MTs NU Cilacap');
  });

  test('should debounce search input', async ({ page }) => {
    let apiCallCount = 0;
    
    // Count API calls with delay
    await page.route('**/api/schools*', async (route) => {
      apiCallCount++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSchools)
      });
    });

    await page.goto('/dashboard/sk/submit');
    
    // Open the autocomplete
    const schoolCombobox = page.getByRole('combobox').filter({ hasText: /Unit Kerja|Madrasah/ }).first();
    await schoolCombobox.click();
    
    const searchInput = page.getByPlaceholder('Cari madrasah...');
    
    // Type rapidly - should be debounced
    await searchInput.type('MI', { delay: 50 });
    
    // Wait for debounce period (300ms) plus a bit more
    await page.waitForTimeout(400);
    
    // Should only make one API call due to debouncing
    expect(apiCallCount).toBe(1);
  });
});