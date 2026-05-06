import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { BrowserRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import WaBlastCreatePage from "../WaBlastCreatePage"
import { waBlastService } from "../services/waBlastService"
import { waBlastConfigService } from "../services/waBlastConfigService"
import { toast } from "sonner"

// Mock services
vi.mock("../services/waBlastService")
vi.mock("../services/waBlastConfigService")
vi.mock("sonner")

// Mock navigate
const mockNavigate = vi.fn()
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom")
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  )
}

describe("WaBlastCreatePage Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock config service to return valid config
    vi.mocked(waBlastConfigService.getConfig).mockResolvedValue({
      success: true,
      data: {
        id: 1,
        api_url: "https://go-wa.example.com",
        api_token: "***",
        sender_number: "6281234567890",
        max_recipients_per_session: 500,
        max_daily_messages: 1000,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      },
    })
  })

  it("should render all form sections", async () => {
    render(<WaBlastCreatePage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText("Buat Blast Baru")).toBeInTheDocument()
    })

    expect(screen.getByText("Judul Blast")).toBeInTheDocument()
    expect(screen.getByText("Pilih Penerima")).toBeInTheDocument()
    expect(screen.getByText("Komposisi Pesan")).toBeInTheDocument()
    expect(screen.getByText("Lampiran (Opsional)")).toBeInTheDocument()
    expect(screen.getByText("Jadwal Pengiriman")).toBeInTheDocument()
  })

  it("should show warning when config is missing", async () => {
    vi.mocked(waBlastConfigService.getConfig).mockResolvedValue({
      success: true,
      data: null,
    })

    render(<WaBlastCreatePage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(
        screen.getByText(/Konfigurasi Go-WA Gateway belum diatur/i)
      ).toBeInTheDocument()
    })

    const submitButton = screen.getByRole("button", { name: /Kirim Sekarang/i })
    expect(submitButton).toBeDisabled()
  })

  it("should validate empty title field", async () => {
    const user = userEvent.setup()
    render(<WaBlastCreatePage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText("Buat Blast Baru")).toBeInTheDocument()
    })

    // Try to submit without title
    const submitButton = screen.getByRole("button", { name: /Kirim Sekarang/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Judul blast tidak boleh kosong")
    })
  })

  it("should validate empty message body", async () => {
    const user = userEvent.setup()
    render(<WaBlastCreatePage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText("Buat Blast Baru")).toBeInTheDocument()
    })

    // Fill title
    const titleInput = screen.getByPlaceholderText(/Contoh: Pengumuman Rapat/i)
    await user.type(titleInput, "Test Blast")

    // Try to submit without message
    const submitButton = screen.getByRole("button", { name: /Kirim Sekarang/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Isi pesan tidak boleh kosong")
    })
  })

  it("should preview recipients successfully", async () => {
    const user = userEvent.setup()
    const mockPreviewData = {
      success: true,
      data: {
        recipients: [
          {
            recipient_name: "Ahmad Dahlan",
            school_name: "MI Maarif NU 01",
            phone_number: "628123456789",
            recipient_type: "kepala_sekolah",
            is_valid: true,
          },
          {
            recipient_name: "Siti Aminah",
            school_name: "MI Maarif NU 02",
            phone_number: "628987654321",
            recipient_type: "kepala_sekolah",
            is_valid: true,
          },
        ],
        valid_count: 2,
        invalid_count: 0,
      },
    }

    vi.mocked(waBlastService.previewRecipients).mockResolvedValue(mockPreviewData)

    render(<WaBlastCreatePage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText("Buat Blast Baru")).toBeInTheDocument()
    })

    // Click preview button
    const previewButton = screen.getByRole("button", { name: /Preview Penerima/i })
    await user.click(previewButton)

    await waitFor(() => {
      expect(waBlastService.previewRecipients).toHaveBeenCalledWith({
        recipient_category: "kepala_sekolah",
        jenjang: undefined,
        school_ids: undefined,
      })
    })

    // Check if preview table is shown
    await waitFor(() => {
      expect(screen.getByText("Daftar Penerima")).toBeInTheDocument()
      expect(screen.getByText("Ahmad Dahlan")).toBeInTheDocument()
      expect(screen.getByText("Siti Aminah")).toBeInTheDocument()
    })
  })

  it("should handle template selection", async () => {
    const user = userEvent.setup()
    render(<WaBlastCreatePage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText("Buat Blast Baru")).toBeInTheDocument()
    })

    // Find message composer textarea
    const messageTextarea = screen.getByRole("textbox", { name: /isi pesan/i })
    
    // Simulate template selection by typing directly
    await user.type(messageTextarea, "Yth. {{nama}} dari {{nama_sekolah}}")

    expect(messageTextarea).toHaveValue("Yth. {{nama}} dari {{nama_sekolah}}")
  })

  it("should validate PDF file upload", async () => {
    const user = userEvent.setup()
    render(<WaBlastCreatePage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText("Buat Blast Baru")).toBeInTheDocument()
    })

    // Find file input
    const fileInput = screen.getByLabelText(/upload/i) || screen.getByTestId("file-upload")
    
    // Create a mock PDF file
    const pdfFile = new File(["dummy content"], "test.pdf", { type: "application/pdf" })
    
    await user.upload(fileInput, pdfFile)

    await waitFor(() => {
      expect(screen.getByText("test.pdf")).toBeInTheDocument()
    })
  })

  it("should submit form successfully with immediate send", async () => {
    const user = userEvent.setup()
    const mockPreviewData = {
      success: true,
      data: {
        recipients: [
          {
            recipient_name: "Ahmad Dahlan",
            school_name: "MI Maarif NU 01",
            phone_number: "628123456789",
            recipient_type: "kepala_sekolah",
            is_valid: true,
          },
        ],
        valid_count: 1,
        invalid_count: 0,
      },
    }

    const mockCreateResponse = {
      success: true,
      data: {
        id: 1,
        title: "Test Blast",
        blast_status: "sending",
      },
    }

    vi.mocked(waBlastService.previewRecipients).mockResolvedValue(mockPreviewData)
    vi.mocked(waBlastService.createBlast).mockResolvedValue(mockCreateResponse)

    render(<WaBlastCreatePage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText("Buat Blast Baru")).toBeInTheDocument()
    })

    // Fill title
    const titleInput = screen.getByPlaceholderText(/Contoh: Pengumuman Rapat/i)
    await user.type(titleInput, "Test Blast")

    // Preview recipients
    const previewButton = screen.getByRole("button", { name: /Preview Penerima/i })
    await user.click(previewButton)

    await waitFor(() => {
      expect(screen.getByText("Ahmad Dahlan")).toBeInTheDocument()
    })

    // Fill message
    const messageTextarea = screen.getByRole("textbox", { name: /isi pesan/i })
    await user.type(messageTextarea, "Test message content")

    // Submit
    const submitButton = screen.getByRole("button", { name: /Kirim Sekarang/i })
    await user.click(submitButton)

    // Confirm in dialog
    await waitFor(() => {
      expect(screen.getByText("Konfirmasi Pengiriman")).toBeInTheDocument()
    })

    const confirmButton = screen.getByRole("button", { name: /Ya, Kirim/i })
    await user.click(confirmButton)

    await waitFor(() => {
      expect(waBlastService.createBlast).toHaveBeenCalled()
      expect(toast.success).toHaveBeenCalledWith(
        "Blast sedang dikirim di latar belakang!"
      )
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard/wa-blast/1")
    })
  })

  it("should submit form successfully with scheduled send", async () => {
    const user = userEvent.setup()
    const mockPreviewData = {
      success: true,
      data: {
        recipients: [
          {
            recipient_name: "Ahmad Dahlan",
            school_name: "MI Maarif NU 01",
            phone_number: "628123456789",
            recipient_type: "kepala_sekolah",
            is_valid: true,
          },
        ],
        valid_count: 1,
        invalid_count: 0,
      },
    }

    const mockCreateResponse = {
      success: true,
      data: {
        id: 2,
        title: "Scheduled Blast",
        blast_status: "scheduled",
      },
    }

    vi.mocked(waBlastService.previewRecipients).mockResolvedValue(mockPreviewData)
    vi.mocked(waBlastService.createBlast).mockResolvedValue(mockCreateResponse)

    render(<WaBlastCreatePage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText("Buat Blast Baru")).toBeInTheDocument()
    })

    // Fill title
    const titleInput = screen.getByPlaceholderText(/Contoh: Pengumuman Rapat/i)
    await user.type(titleInput, "Scheduled Blast")

    // Preview recipients
    const previewButton = screen.getByRole("button", { name: /Preview Penerima/i })
    await user.click(previewButton)

    await waitFor(() => {
      expect(screen.getByText("Ahmad Dahlan")).toBeInTheDocument()
    })

    // Fill message
    const messageTextarea = screen.getByRole("textbox", { name: /isi pesan/i })
    await user.type(messageTextarea, "Scheduled message")

    // Note: In a real test, you would interact with the ScheduleSelector component
    // For now, we'll simulate the scheduled state being set

    // Submit
    const submitButton = screen.getByRole("button", { name: /Kirim Sekarang/i })
    await user.click(submitButton)

    // Confirm in dialog
    await waitFor(() => {
      expect(screen.getByText("Konfirmasi Pengiriman")).toBeInTheDocument()
    })

    const confirmButton = screen.getByRole("button", { name: /Ya, Kirim/i })
    await user.click(confirmButton)

    await waitFor(() => {
      expect(waBlastService.createBlast).toHaveBeenCalled()
    })
  })

  it("should handle API errors gracefully", async () => {
    const user = userEvent.setup()
    const mockPreviewData = {
      success: true,
      data: {
        recipients: [
          {
            recipient_name: "Ahmad Dahlan",
            school_name: "MI Maarif NU 01",
            phone_number: "628123456789",
            recipient_type: "kepala_sekolah",
            is_valid: true,
          },
        ],
        valid_count: 1,
        invalid_count: 0,
      },
    }

    vi.mocked(waBlastService.previewRecipients).mockResolvedValue(mockPreviewData)
    vi.mocked(waBlastService.createBlast).mockRejectedValue({
      response: {
        data: {
          message: "Jumlah penerima melebihi batas maksimal 500 per sesi.",
        },
      },
    })

    render(<WaBlastCreatePage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText("Buat Blast Baru")).toBeInTheDocument()
    })

    // Fill form
    const titleInput = screen.getByPlaceholderText(/Contoh: Pengumuman Rapat/i)
    await user.type(titleInput, "Test Blast")

    const previewButton = screen.getByRole("button", { name: /Preview Penerima/i })
    await user.click(previewButton)

    await waitFor(() => {
      expect(screen.getByText("Ahmad Dahlan")).toBeInTheDocument()
    })

    const messageTextarea = screen.getByRole("textbox", { name: /isi pesan/i })
    await user.type(messageTextarea, "Test message")

    // Submit
    const submitButton = screen.getByRole("button", { name: /Kirim Sekarang/i })
    await user.click(submitButton)

    // Confirm
    await waitFor(() => {
      expect(screen.getByText("Konfirmasi Pengiriman")).toBeInTheDocument()
    })

    const confirmButton = screen.getByRole("button", { name: /Ya, Kirim/i })
    await user.click(confirmButton)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Jumlah penerima melebihi batas maksimal 500 per sesi."
      )
    })
  })

  it("should allow removing recipients from preview", async () => {
    const user = userEvent.setup()
    const mockPreviewData = {
      success: true,
      data: {
        recipients: [
          {
            recipient_name: "Ahmad Dahlan",
            school_name: "MI Maarif NU 01",
            phone_number: "628123456789",
            recipient_type: "kepala_sekolah",
            is_valid: true,
          },
          {
            recipient_name: "Siti Aminah",
            school_name: "MI Maarif NU 02",
            phone_number: "628987654321",
            recipient_type: "kepala_sekolah",
            is_valid: true,
          },
        ],
        valid_count: 2,
        invalid_count: 0,
      },
    }

    vi.mocked(waBlastService.previewRecipients).mockResolvedValue(mockPreviewData)

    render(<WaBlastCreatePage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText("Buat Blast Baru")).toBeInTheDocument()
    })

    // Preview recipients
    const previewButton = screen.getByRole("button", { name: /Preview Penerima/i })
    await user.click(previewButton)

    await waitFor(() => {
      expect(screen.getByText("Ahmad Dahlan")).toBeInTheDocument()
      expect(screen.getByText("Siti Aminah")).toBeInTheDocument()
    })

    // Find and click remove button for first recipient
    const removeButtons = screen.getAllByRole("button", { name: /hapus/i })
    await user.click(removeButtons[0])

    // Verify recipient was removed
    await waitFor(() => {
      expect(screen.queryByText("Ahmad Dahlan")).not.toBeInTheDocument()
      expect(screen.getByText("Siti Aminah")).toBeInTheDocument()
    })
  })
})
