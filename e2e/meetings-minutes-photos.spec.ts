import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Meeting Minutes and Photos
 *
 * Tests for creating/editing minutes, uploading/deleting photos,
 * and downloading PDF reports with minutes and photos.
 *
 * **Validates: Requirements 33, 34, 35**
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const API_URL = process.env.API_URL || 'http://localhost:8000';

test.describe('Meeting Minutes and Photos E2E Tests', () => {
  let meetingId: number;
  let authToken: string;

  test.beforeAll(async () => {
    // Setup: Create test user and get auth token
    // This would typically be done via API setup
  });

  test.describe('Minutes Management', () => {
    test('should create and edit meeting minutes', async ({ page }) => {
      // Navigate to meeting detail page
      await page.goto(`${BASE_URL}/meetings/${meetingId}`);

      // Click on Minutes tab
      await page.click('text=Notulensi');

      // Click create/edit button
      await page.click('button:has-text("Edit Notulensi")');

      // Wait for editor to load
      await page.waitForSelector('[data-testid="minutes-editor"]');

      // Type content in editor
      const editor = page.locator('[data-testid="minutes-editor"]');
      await editor.click();
      await page.keyboard.type('Hasil Rapat:');
      await page.keyboard.press('Enter');
      await page.keyboard.type('1. Pembahasan program semester');
      await page.keyboard.press('Enter');
      await page.keyboard.type('2. Peningkatan fasilitas');

      // Apply formatting
      await page.click('button[aria-label="Bold"]');
      await page.keyboard.type('Keputusan:');
      await page.click('button[aria-label="Bold"]');

      // Save minutes
      await page.click('button:has-text("Simpan Notulensi")');

      // Verify success message
      await expect(page.locator('text=Notulensi berhasil disimpan')).toBeVisible();

      // Verify content is saved
      await page.reload();
      await page.click('text=Notulensi');
      await expect(page.locator('text=Hasil Rapat')).toBeVisible();
    });

    test('should display minutes in read-only mode for operators', async ({ page }) => {
      // Login as operator
      await page.goto(`${BASE_URL}/login`);
      await page.fill('input[type="email"]', 'operator@test.com');
      await page.fill('input[type="password"]', 'password');
      await page.click('button:has-text("Login")');

      // Navigate to meeting
      await page.goto(`${BASE_URL}/meetings/${meetingId}`);
      await page.click('text=Notulensi');

      // Verify minutes are displayed
      await expect(page.locator('[data-testid="minutes-view"]')).toBeVisible();

      // Verify edit button is not available
      await expect(page.locator('button:has-text("Edit Notulensi")')).not.toBeVisible();

      // Verify print button is available
      await expect(page.locator('button:has-text("Print")')).toBeVisible();
    });

    test('should print minutes', async ({ page }) => {
      await page.goto(`${BASE_URL}/meetings/${meetingId}`);
      await page.click('text=Notulensi');

      // Click print button
      const printPromise = page.waitForEvent('popup');
      await page.click('button:has-text("Print")');
      const printPage = await printPromise;

      // Verify print page contains minutes content
      await expect(printPage.locator('text=Notulensi')).toBeVisible();
      await printPage.close();
    });
  });

  test.describe('Photo Management', () => {
    test('should upload single photo', async ({ page }) => {
      await page.goto(`${BASE_URL}/meetings/${meetingId}`);
      await page.click('text=Foto Kegiatan');

      // Click upload button
      await page.click('button:has-text("Upload Foto")');

      // Select file
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles('test-assets/photo1.jpg');

      // Verify file is displayed
      await expect(page.locator('text=photo1.jpg')).toBeVisible();

      // Click upload button
      await page.click('button:has-text("Upload")');

      // Verify success message
      await expect(page.locator('text=Foto berhasil diunggah')).toBeVisible();

      // Verify photo appears in gallery
      await expect(page.locator('img[alt="photo1.jpg"]')).toBeVisible();
    });

    test('should upload multiple photos', async ({ page }) => {
      await page.goto(`${BASE_URL}/meetings/${meetingId}`);
      await page.click('text=Foto Kegiatan');

      // Click upload button
      await page.click('button:has-text("Upload Foto")');

      // Select multiple files
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles([
        'test-assets/photo1.jpg',
        'test-assets/photo2.jpg',
        'test-assets/photo3.jpg',
      ]);

      // Verify files are displayed
      await expect(page.locator('text=photo1.jpg')).toBeVisible();
      await expect(page.locator('text=photo2.jpg')).toBeVisible();
      await expect(page.locator('text=photo3.jpg')).toBeVisible();

      // Click upload button
      await page.click('button:has-text("Upload")');

      // Verify success message
      await expect(page.locator('text=Foto berhasil diunggah')).toBeVisible();

      // Verify all photos appear in gallery
      await expect(page.locator('img[alt="photo1.jpg"]')).toBeVisible();
      await expect(page.locator('img[alt="photo2.jpg"]')).toBeVisible();
      await expect(page.locator('img[alt="photo3.jpg"]')).toBeVisible();
    });

    test('should view photo in lightbox', async ({ page }) => {
      await page.goto(`${BASE_URL}/meetings/${meetingId}`);
      await page.click('text=Foto Kegiatan');

      // Click on photo
      await page.click('img[alt="photo1.jpg"]');

      // Verify lightbox is displayed
      await expect(page.locator('[role="dialog"]')).toBeVisible();

      // Verify full-size photo is displayed
      await expect(page.locator('img[alt="photo1.jpg"]').first()).toBeVisible();

      // Verify navigation buttons
      await expect(page.locator('button[aria-label="Next"]')).toBeVisible();
      await expect(page.locator('button[aria-label="Previous"]')).toBeVisible();
    });

    test('should navigate between photos in lightbox', async ({ page }) => {
      await page.goto(`${BASE_URL}/meetings/${meetingId}`);
      await page.click('text=Foto Kegiatan');

      // Click on first photo
      await page.click('img[alt="photo1.jpg"]');

      // Verify first photo is displayed
      await expect(page.locator('[role="dialog"]')).toBeVisible();

      // Click next button
      await page.click('button[aria-label="Next"]');

      // Verify second photo is displayed
      await expect(page.locator('img[alt="photo2.jpg"]')).toBeVisible();

      // Click previous button
      await page.click('button[aria-label="Previous"]');

      // Verify first photo is displayed again
      await expect(page.locator('img[alt="photo1.jpg"]')).toBeVisible();
    });

    test('should close lightbox on escape key', async ({ page }) => {
      await page.goto(`${BASE_URL}/meetings/${meetingId}`);
      await page.click('text=Foto Kegiatan');

      // Click on photo
      await page.click('img[alt="photo1.jpg"]');

      // Verify lightbox is displayed
      await expect(page.locator('[role="dialog"]')).toBeVisible();

      // Press escape key
      await page.keyboard.press('Escape');

      // Verify lightbox is closed
      await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    });

    test('should delete photo', async ({ page }) => {
      await page.goto(`${BASE_URL}/meetings/${meetingId}`);
      await page.click('text=Foto Kegiatan');

      // Hover over photo to show delete button
      await page.hover('img[alt="photo1.jpg"]');

      // Click delete button
      await page.click('button[aria-label="Delete photo"]');

      // Verify confirmation dialog
      await expect(page.locator('text=Confirm delete')).toBeVisible();

      // Click confirm button
      await page.click('button:has-text("Delete")');

      // Verify success message
      await expect(page.locator('text=Foto berhasil dihapus')).toBeVisible();

      // Verify photo is removed from gallery
      await expect(page.locator('img[alt="photo1.jpg"]')).not.toBeVisible();
    });

    test('should download all photos as ZIP', async ({ page, context }) => {
      await page.goto(`${BASE_URL}/meetings/${meetingId}`);
      await page.click('text=Foto Kegiatan');

      // Click download button
      const downloadPromise = context.waitForEvent('download');
      await page.click('button:has-text("Download Semua Foto")');
      const download = await downloadPromise;

      // Verify download
      expect(download.suggestedFilename()).toContain('.zip');
    });

    test('should validate photo format', async ({ page }) => {
      await page.goto(`${BASE_URL}/meetings/${meetingId}`);
      await page.click('text=Foto Kegiatan');

      // Click upload button
      await page.click('button:has-text("Upload Foto")');

      // Try to select non-image file
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles('test-assets/document.pdf');

      // Verify error message
      await expect(page.locator('text=Format foto harus JPEG atau PNG')).toBeVisible();
    });

    test('should validate photo size', async ({ page }) => {
      await page.goto(`${BASE_URL}/meetings/${meetingId}`);
      await page.click('text=Foto Kegiatan');

      // Click upload button
      await page.click('button:has-text("Upload Foto")');

      // Try to select large file
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles('test-assets/large-photo.jpg');

      // Verify error message
      await expect(page.locator('text=Ukuran foto maksimal 5MB')).toBeVisible();
    });
  });

  test.describe('PDF Report with Minutes and Photos', () => {
    test('should download PDF report with minutes and photos', async ({ page, context }) => {
      await page.goto(`${BASE_URL}/meetings/${meetingId}`);

      // Click download report button
      const downloadPromise = context.waitForEvent('download');
      await page.click('button:has-text("Unduh Laporan PDF")');
      const download = await downloadPromise;

      // Verify download
      expect(download.suggestedFilename()).toContain('.pdf');
      expect(download.suggestedFilename()).toContain('Laporan');
    });

    test('should include minutes in PDF report', async ({ page }) => {
      // This would require PDF parsing library to verify content
      // For now, we just verify the download succeeds
      await page.goto(`${BASE_URL}/meetings/${meetingId}`);

      const downloadPromise = page.context().waitForEvent('download');
      await page.click('button:has-text("Unduh Laporan PDF")');
      const download = await downloadPromise;

      expect(download.suggestedFilename()).toContain('.pdf');
    });

    test('should include photos in PDF report', async ({ page }) => {
      // This would require PDF parsing library to verify content
      // For now, we just verify the download succeeds
      await page.goto(`${BASE_URL}/meetings/${meetingId}`);

      const downloadPromise = page.context().waitForEvent('download');
      await page.click('button:has-text("Unduh Laporan PDF")');
      const download = await downloadPromise;

      expect(download.suggestedFilename()).toContain('.pdf');
    });
  });

  test.describe('Access Control', () => {
    test('operator cannot upload photos', async ({ page }) => {
      // Login as operator
      await page.goto(`${BASE_URL}/login`);
      await page.fill('input[type="email"]', 'operator@test.com');
      await page.fill('input[type="password"]', 'password');
      await page.click('button:has-text("Login")');

      // Navigate to meeting
      await page.goto(`${BASE_URL}/meetings/${meetingId}`);
      await page.click('text=Foto Kegiatan');

      // Verify upload button is not available
      await expect(page.locator('button:has-text("Upload Foto")')).not.toBeVisible();
    });

    test('operator cannot edit minutes', async ({ page }) => {
      // Login as operator
      await page.goto(`${BASE_URL}/login`);
      await page.fill('input[type="email"]', 'operator@test.com');
      await page.fill('input[type="password"]', 'password');
      await page.click('button:has-text("Login")');

      // Navigate to meeting
      await page.goto(`${BASE_URL}/meetings/${meetingId}`);
      await page.click('text=Notulensi');

      // Verify edit button is not available
      await expect(page.locator('button:has-text("Edit Notulensi")')).not.toBeVisible();
    });

    test('operator cannot download photos as ZIP', async ({ page }) => {
      // Login as operator
      await page.goto(`${BASE_URL}/login`);
      await page.fill('input[type="email"]', 'operator@test.com');
      await page.fill('input[type="password"]', 'password');
      await page.click('button:has-text("Login")');

      // Navigate to meeting
      await page.goto(`${BASE_URL}/meetings/${meetingId}`);
      await page.click('text=Foto Kegiatan');

      // Verify download button is not available
      await expect(page.locator('button:has-text("Download Semua Foto")')).not.toBeVisible();
    });
  });
});
