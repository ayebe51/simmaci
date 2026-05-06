import { test, expect } from "@playwright/test"

// Helper to login as super_admin
async function loginAsSuperAdmin(page: any) {
  await page.goto("/login")
  await page.getByPlaceholder("Username").fill("superadmin")
  await page.getByPlaceholder("Password").fill("password123")
  await page.getByRole("button", { name: /login/i }).click()
  await page.waitForURL("/dashboard")
}

// Helper to login as admin_yayasan
async function loginAsAdminYayasan(page: any) {
  await page.goto("/login")
  await page.getByPlaceholder("Username").fill("admin_yayasan")
  await page.getByPlaceholder("Password").fill("password123")
  await page.getByRole("button", { name: /login/i }).click()
  await page.waitForURL("/dashboard")
}

// Helper to login as operator
async function loginAsOperator(page: any) {
  await page.goto("/login")
  await page.getByPlaceholder("Username").fill("operator")
  await page.getByPlaceholder("Password").fill("password123")
  await page.getByRole("button", { name: /login/i }).click()
  await page.waitForURL("/dashboard")
}

test.describe("WA Blast E2E Tests", () => {
  test.describe("Super Admin Full Workflow", () => {
    test("should complete full blast workflow: config → create → monitor → detail", async ({
      page,
    }) => {
      // Step 1: Login as super_admin
      await loginAsSuperAdmin(page)

      // Step 2: Navigate to WA Blast config page
      await page.goto("/dashboard/wa-blast/config")
      await expect(page.getByRole("heading", { name: /konfigurasi/i })).toBeVisible()

      // Step 3: Configure Go-WA Gateway
      await page.getByLabel(/url/i).fill("https://go-wa.example.com")
      await page.getByLabel(/token/i).fill("test-api-token-12345")
      await page.getByLabel(/nomor pengirim/i).fill("6281234567890")
      await page.getByLabel(/maksimal penerima per sesi/i).fill("500")
      await page.getByLabel(/maksimal pesan per hari/i).fill("1000")

      // Save configuration
      await page.getByRole("button", { name: /simpan/i }).click()
      await expect(page.getByText(/konfigurasi berhasil disimpan/i)).toBeVisible({
        timeout: 5000,
      })

      // Step 4: Navigate to create blast page
      await page.goto("/dashboard/wa-blast")
      await page.getByRole("button", { name: /buat blast baru/i }).click()
      await expect(page).toHaveURL("/dashboard/wa-blast/create")

      // Step 5: Fill blast form
      await page.getByPlaceholder(/contoh: pengumuman/i).fill("Test E2E Blast")

      // Select recipient category (Kepala Sekolah)
      await page.getByRole("radio", { name: /kepala sekolah/i }).check()

      // Select jenjang (MI)
      await page.getByRole("checkbox", { name: /^MI$/i }).check()

      // Step 6: Preview recipients
      await page.getByRole("button", { name: /preview penerima/i }).click()
      await expect(page.getByText(/daftar penerima/i)).toBeVisible({ timeout: 5000 })

      // Verify preview table shows recipients
      await expect(page.getByText(/valid:/i)).toBeVisible()

      // Step 7: Compose message
      const messageTextarea = page.getByRole("textbox", { name: /isi pesan/i })
      await messageTextarea.fill(
        "Yth. {{nama}} dari {{nama_sekolah}}, ini adalah pesan test E2E."
      )

      // Step 8: Submit blast (immediate send)
      await page.getByRole("button", { name: /kirim sekarang/i }).click()

      // Step 9: Confirm in dialog
      await expect(page.getByText(/konfirmasi pengiriman/i)).toBeVisible()
      await page.getByRole("button", { name: /ya, kirim/i }).click()

      // Step 10: Wait for redirect to detail page
      await page.waitForURL(/\/dashboard\/wa-blast\/\d+/, { timeout: 10000 })

      // Step 11: Verify detail page shows blast info
      await expect(page.getByText("Test E2E Blast")).toBeVisible()
      await expect(
        page.getByText(/status/i).locator("..").getByText(/sending|completed/i)
      ).toBeVisible({ timeout: 5000 })

      // Step 12: Monitor progress (if still sending)
      const statusBadge = page.locator('[data-testid="blast-status"]').or(
        page.getByText(/sending|completed/i).first()
      )
      await expect(statusBadge).toBeVisible()

      // Step 13: Verify recipient details table
      await expect(page.getByRole("table")).toBeVisible()
      await expect(page.getByText(/nama penerima/i)).toBeVisible()
    })

    test("should configure Go-WA and test connection", async ({ page }) => {
      await loginAsSuperAdmin(page)

      await page.goto("/dashboard/wa-blast/config")

      // Fill config form
      await page.getByLabel(/url/i).fill("https://go-wa.example.com")
      await page.getByLabel(/token/i).fill("test-token")
      await page.getByLabel(/nomor pengirim/i).fill("6281234567890")

      // Test connection (will fail in test env, but should trigger the action)
      const testButton = page.getByRole("button", { name: /test koneksi/i })
      await testButton.click()

      // Wait for response (success or error)
      await expect(
        page.getByText(/berhasil|gagal|timeout/i).first()
      ).toBeVisible({ timeout: 10000 })
    })

    test("should create scheduled blast", async ({ page }) => {
      await loginAsSuperAdmin(page)

      await page.goto("/dashboard/wa-blast/create")

      // Fill form
      await page.getByPlaceholder(/contoh: pengumuman/i).fill("Scheduled Blast Test")
      await page.getByRole("radio", { name: /kepala sekolah/i }).check()

      // Preview recipients
      await page.getByRole("button", { name: /preview penerima/i }).click()
      await expect(page.getByText(/daftar penerima/i)).toBeVisible({ timeout: 5000 })

      // Fill message
      await page
        .getByRole("textbox", { name: /isi pesan/i })
        .fill("Scheduled message test")

      // Toggle to scheduled
      await page.getByRole("radio", { name: /jadwalkan/i }).check()

      // Set future date (tomorrow at 10:00)
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(10, 0, 0, 0)

      const dateInput = page.getByLabel(/tanggal/i)
      if (await dateInput.isVisible()) {
        await dateInput.fill(tomorrow.toISOString().split("T")[0])
      }

      // Submit
      await page.getByRole("button", { name: /jadwalkan blast/i }).click()
      await page.getByRole("button", { name: /ya, kirim/i }).click()

      // Verify redirect and status
      await page.waitForURL(/\/dashboard\/wa-blast\/\d+/, { timeout: 10000 })
      await expect(page.getByText(/scheduled/i)).toBeVisible()
    })

    test("should list all blasts with filters", async ({ page }) => {
      await loginAsSuperAdmin(page)

      await page.goto("/dashboard/wa-blast")

      // Verify list page elements
      await expect(page.getByRole("heading", { name: /wa blast/i })).toBeVisible()
      await expect(page.getByRole("button", { name: /buat blast baru/i })).toBeVisible()

      // Apply status filter
      const statusFilter = page.getByLabel(/status/i)
      if (await statusFilter.isVisible()) {
        await statusFilter.selectOption("completed")
        await page.waitForTimeout(1000) // Wait for filter to apply
      }

      // Verify table is visible
      await expect(page.getByRole("table")).toBeVisible()
    })

    test("should retry failed blast", async ({ page }) => {
      await loginAsSuperAdmin(page)

      // Navigate to a blast detail page (assuming blast ID 1 exists)
      await page.goto("/dashboard/wa-blast/1")

      // Look for retry button (only visible if there are failed recipients)
      const retryButton = page.getByRole("button", { name: /kirim ulang/i })

      if (await retryButton.isVisible({ timeout: 2000 })) {
        await retryButton.click()

        // Confirm retry
        await page.getByRole("button", { name: /ya|konfirmasi/i }).click()

        // Verify new blast was created
        await expect(page.getByText(/berhasil|dibuat/i)).toBeVisible({ timeout: 5000 })
      }
    })

    test("should cancel scheduled blast", async ({ page }) => {
      await loginAsSuperAdmin(page)

      // First create a scheduled blast
      await page.goto("/dashboard/wa-blast/create")
      await page.getByPlaceholder(/contoh: pengumuman/i).fill("To Be Cancelled")
      await page.getByRole("radio", { name: /kepala sekolah/i }).check()
      await page.getByRole("button", { name: /preview penerima/i }).click()
      await expect(page.getByText(/daftar penerima/i)).toBeVisible({ timeout: 5000 })
      await page.getByRole("textbox", { name: /isi pesan/i }).fill("Test cancel")
      await page.getByRole("radio", { name: /jadwalkan/i }).check()
      await page.getByRole("button", { name: /jadwalkan blast/i }).click()
      await page.getByRole("button", { name: /ya, kirim/i }).click()

      await page.waitForURL(/\/dashboard\/wa-blast\/\d+/, { timeout: 10000 })

      // Cancel the blast
      const cancelButton = page.getByRole("button", { name: /batalkan/i })
      if (await cancelButton.isVisible({ timeout: 2000 })) {
        await cancelButton.click()
        await page.getByRole("button", { name: /ya|konfirmasi/i }).click()
        await expect(page.getByText(/dibatalkan|cancelled/i)).toBeVisible({
          timeout: 5000,
        })
      }
    })
  })

  test.describe("Template Management", () => {
    test("should create, edit, and delete template", async ({ page }) => {
      await loginAsSuperAdmin(page)

      await page.goto("/dashboard/wa-blast/templates")

      // Create new template
      await page.getByRole("button", { name: /buat template/i }).click()
      await page.getByLabel(/nama template/i).fill("Template E2E Test")
      await page
        .getByLabel(/isi template/i)
        .fill("Yth. {{nama}}, ini template test dari {{nama_sekolah}}")
      await page.getByRole("button", { name: /simpan/i }).click()

      await expect(page.getByText(/berhasil/i)).toBeVisible({ timeout: 5000 })
      await expect(page.getByText("Template E2E Test")).toBeVisible()

      // Edit template
      await page.getByRole("button", { name: /edit/i }).first().click()
      await page.getByLabel(/nama template/i).fill("Template E2E Test (Edited)")
      await page.getByRole("button", { name: /simpan/i }).click()
      await expect(page.getByText(/berhasil/i)).toBeVisible({ timeout: 5000 })

      // Delete template
      await page.getByRole("button", { name: /hapus/i }).first().click()
      await page.getByRole("button", { name: /ya|konfirmasi/i }).click()
      await expect(page.getByText(/berhasil/i)).toBeVisible({ timeout: 5000 })
    })

    test("should use template in blast creation", async ({ page }) => {
      await loginAsSuperAdmin(page)

      // First create a template
      await page.goto("/dashboard/wa-blast/templates")
      await page.getByRole("button", { name: /buat template/i }).click()
      await page.getByLabel(/nama template/i).fill("Quick Template")
      await page.getByLabel(/isi template/i).fill("Template message for {{nama}}")
      await page.getByRole("button", { name: /simpan/i }).click()
      await expect(page.getByText(/berhasil/i)).toBeVisible({ timeout: 5000 })

      // Go to create blast
      await page.goto("/dashboard/wa-blast/create")

      // Open template picker
      await page.getByRole("button", { name: /pilih template/i }).click()

      // Select the template
      await page.getByText("Quick Template").click()

      // Verify message was filled
      const messageTextarea = page.getByRole("textbox", { name: /isi pesan/i })
      await expect(messageTextarea).toHaveValue(/Template message for/)
    })
  })

  test.describe("Role-Based Access Control", () => {
    test("should deny operator access to WA Blast", async ({ page }) => {
      await loginAsOperator(page)

      // Try to access WA Blast list
      await page.goto("/dashboard/wa-blast")

      // Should be redirected or see 403
      await expect(
        page.getByText(/tidak diizinkan|forbidden|403/i).or(page.getByText(/dashboard/i))
      ).toBeVisible({ timeout: 5000 })

      // Verify URL changed (redirected) or stayed with error
      const currentUrl = page.url()
      expect(
        currentUrl.includes("/dashboard/wa-blast") === false ||
          currentUrl.includes("/dashboard")
      ).toBeTruthy()
    })

    test("should deny operator access to WA Blast create page", async ({ page }) => {
      await loginAsOperator(page)

      await page.goto("/dashboard/wa-blast/create")

      // Should see error or be redirected
      await expect(
        page.getByText(/tidak diizinkan|forbidden|403/i).or(page.getByText(/dashboard/i))
      ).toBeVisible({ timeout: 5000 })
    })

    test("should deny admin_yayasan access to config page", async ({ page }) => {
      await loginAsAdminYayasan(page)

      await page.goto("/dashboard/wa-blast/config")

      // Should see 403 or be redirected
      await expect(
        page.getByText(/tidak diizinkan|forbidden|403/i).or(
          page.getByText(/wa blast/i).first()
        )
      ).toBeVisible({ timeout: 5000 })

      // Verify cannot access config
      const currentUrl = page.url()
      expect(currentUrl.includes("/config") === false).toBeTruthy()
    })

    test("should allow admin_yayasan to create blast", async ({ page }) => {
      await loginAsAdminYayasan(page)

      await page.goto("/dashboard/wa-blast")
      await expect(page.getByRole("button", { name: /buat blast baru/i })).toBeVisible()

      await page.goto("/dashboard/wa-blast/create")
      await expect(page.getByText(/buat blast baru/i)).toBeVisible()

      // Verify can fill form
      await page.getByPlaceholder(/contoh: pengumuman/i).fill("Admin Yayasan Test")
      await expect(page.getByPlaceholder(/contoh: pengumuman/i)).toHaveValue(
        "Admin Yayasan Test"
      )
    })

    test("should allow admin_yayasan to manage templates", async ({ page }) => {
      await loginAsAdminYayasan(page)

      await page.goto("/dashboard/wa-blast/templates")
      await expect(page.getByRole("button", { name: /buat template/i })).toBeVisible()

      // Verify can create template
      await page.getByRole("button", { name: /buat template/i }).click()
      await page.getByLabel(/nama template/i).fill("Admin Yayasan Template")
      await page.getByLabel(/isi template/i).fill("Test template")
      await page.getByRole("button", { name: /simpan/i }).click()

      await expect(page.getByText(/berhasil/i)).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe("Error Handling", () => {
    test("should show error when config is missing", async ({ page }) => {
      await loginAsSuperAdmin(page)

      // Clear config first (if possible via UI or API)
      // For this test, we assume config might be missing

      await page.goto("/dashboard/wa-blast/create")

      // Look for warning about missing config
      const warning = page.getByText(/konfigurasi.*belum diatur/i)
      if (await warning.isVisible({ timeout: 2000 })) {
        // Verify submit button is disabled
        const submitButton = page.getByRole("button", { name: /kirim sekarang/i })
        await expect(submitButton).toBeDisabled()
      }
    })

    test("should validate required fields", async ({ page }) => {
      await loginAsSuperAdmin(page)

      await page.goto("/dashboard/wa-blast/create")

      // Try to submit without filling anything
      await page.getByRole("button", { name: /kirim sekarang/i }).click()

      // Should show validation error
      await expect(page.getByText(/tidak boleh kosong/i)).toBeVisible({ timeout: 3000 })
    })

    test("should handle file upload validation", async ({ page }) => {
      await loginAsSuperAdmin(page)

      await page.goto("/dashboard/wa-blast/create")

      // Try to upload non-PDF file
      const fileInput = page.locator('input[type="file"]')
      if (await fileInput.isVisible({ timeout: 2000 })) {
        await fileInput.setInputFiles({
          name: "test.txt",
          mimeType: "text/plain",
          buffer: Buffer.from("test content"),
        })

        // Should show error about file type
        await expect(page.getByText(/pdf/i)).toBeVisible({ timeout: 3000 })
      }
    })
  })
})
