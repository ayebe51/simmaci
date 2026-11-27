import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import * as XLSX from "xlsx"
import { DateValidationErrorDialog } from "@/components/common/DateValidationErrorDialog"
import { BulkSkSubmission } from "./BulkSkSubmission"

const { mockUpload, mockBulkRequest, mockToastError, mockToastSuccess, mockToastLoading, mockToastDismiss } = vi.hoisted(() => ({
  mockUpload: vi.fn(),
  mockBulkRequest: vi.fn(),
  mockToastError: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastLoading: vi.fn(),
  mockToastDismiss: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  authApi: { getStoredUser: () => ({ id: 1, role: "operator", school_id: 1 }) },
  mediaApi: { upload: mockUpload },
  skApi: { bulkRequest: mockBulkRequest },
  teacherApi: {},
}))

vi.mock("sonner", () => ({
  toast: {
    error: mockToastError,
    success: mockToastSuccess,
    loading: mockToastLoading,
    dismiss: mockToastDismiss,
    warning: vi.fn(),
  },
}))

function createMockExcelFile(rowCount: number): File {
  const headers = [
    "Nama",
    "Tempat Lahir",
    "Tanggal Lahir",
    "NIM",
    "Pendidikan Terakhir",
    "Unit Kerja",
    "TMT",
    "Status",
    "PDPKPNU",
    "Kecamatan",
    "Baru/Perpanjangan",
  ]
  const rows = [headers]
  for (let i = 1; i <= rowCount; i++) {
    rows.push([
      `Guru Test ${i}`,
      "Cilacap",
      "03 Agustus 1992",
      `11349000${i}`,
      "S1 PAI",
      "MI Ma'arif 01",
      "15 Juli 2013",
      "GTY",
      "Lulus",
      "Cilacap Selatan",
      "Perpanjangan",
    ])
  }
  const ws = XLSX.utils.aoa_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Template")
  const bin = XLSX.write(wb, { bookType: "xlsx", type: "binary" })
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i) & 0xff
  }
  return new File([bytes], "Template_Bulk_SK.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
}

function renderBulkSk() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <BulkSkSubmission />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe("P0 — DateValidationErrorDialog source attribution", () => {
  it("does NOT blame Excel when source='form'", () => {
    render(
      <DateValidationErrorDialog
        isOpen={true}
        onClose={() => {}}
        source="form"
        errors={[
          {
            row: 1,
            column: "Tanggal Permohonan",
            value: "invalid",
            reason: "Format Tanggal Surat Permohonan pada formulir tidak valid.",
          },
        ]}
      />
    )

    expect(screen.getByText(/kesalahan tanggal pada formulir pengajuan/i)).toBeInTheDocument()
    expect(screen.queryByText(/pada file Excel/i)).not.toBeInTheDocument()
    expect(screen.getByText("Nilai Input")).toBeInTheDocument()
    expect(screen.queryByText("Nilai di Excel")).not.toBeInTheDocument()
  })

  it("preserves Excel wording when source is omitted or 'excel'", () => {
    render(
      <DateValidationErrorDialog
        isOpen={true}
        onClose={() => {}}
        errors={[
          {
            row: 2,
            column: "Tanggal Lahir",
            value: "11/12/2022",
            reason: "Format tanggal numerik dengan garis miring ditolak.",
          },
        ]}
      />
    )

    expect(screen.getByText(/kesalahan tanggal pada file Excel/i)).toBeInTheDocument()
    expect(screen.getByText("Nilai di Excel")).toBeInTheDocument()
  })
})

describe("P0 — BulkSkSubmission payload separation & error reporting", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpload.mockResolvedValue({ url: "https://example.com/surat.pdf" })
  })

  it("sends tanggal_permohonan and nomor_permohonan at root level (NOT injected into each Excel document row)", async () => {
    mockBulkRequest.mockResolvedValue({ success: true, queued: true, count: 8 })

    const { container } = renderBulkSk()

    // 1. Upload Excel (8 teachers)
    const excelInput = container.querySelector('input[accept=".xlsx, .xls"]') as HTMLInputElement
    fireEvent.change(excelInput, { target: { files: [createMockExcelFile(8)] } })

    await waitFor(() => {
      expect(screen.getByText(/Terdeteksi 8 data valid/i)).toBeInTheDocument()
    })

    // 2. Upload PDF + fill No. Surat & Tgl. Surat
    const pdfInput = container.querySelector('input[accept=".pdf"]') as HTMLInputElement
    const pdfFile = new File(["%PDF-1.4"], "surat.pdf", { type: "application/pdf" })
    fireEvent.change(pdfInput, { target: { files: [pdfFile] } })

    const noSuratInput = screen.getByPlaceholderText("Nomor...")
    fireEvent.change(noSuratInput, { target: { value: "008/SK/2026" } })

    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement
    fireEvent.change(dateInput, { target: { value: "2026-08-11" } })

    // 3. Click submit
    const submitBtn = screen.getByRole("button", { name: /Proses 8 Data/i })
    expect(submitBtn).not.toBeDisabled()
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockBulkRequest).toHaveBeenCalledTimes(1)
    })

    const sentPayload = mockBulkRequest.mock.calls[0][0]
    expect(sentPayload.nomor_permohonan).toBe("008/SK/2026")
    expect(sentPayload.tanggal_permohonan).toBe("2026-08-11")
    expect(sentPayload.documents).toHaveLength(8)

    // Ensure tanggal_permohonan is NOT injected into each Excel teacher row
    for (const doc of sentPayload.documents) {
      expect(doc).not.toHaveProperty("tanggal_permohonan")
      expect(doc).not.toHaveProperty("nomor_permohonan")
      expect(doc.tanggal_lahir).toBe("03 Agustus 1992")
      expect(doc.tmt).toBe("15 Juli 2013")
    }
  })

  it("shows form error toast (NOT Excel modal) when backend returns 422 Laravel validation error on tanggal_permohonan", async () => {
    mockBulkRequest.mockRejectedValue({
      response: {
        status: 422,
        data: {
          message: "Format Tanggal Surat Permohonan pada formulir tidak valid.",
          errors: {
            tanggal_permohonan: [
              "Format Tanggal Surat Permohonan pada formulir tidak valid. Gunakan pemilih tanggal (format YYYY-MM-DD).",
            ],
          },
        },
      },
    })

    const { container } = renderBulkSk()

    const excelInput = container.querySelector('input[accept=".xlsx, .xls"]') as HTMLInputElement
    fireEvent.change(excelInput, { target: { files: [createMockExcelFile(2)] } })

    await waitFor(() => {
      expect(screen.getByText(/Terdeteksi 2 data valid/i)).toBeInTheDocument()
    })

    const pdfInput = container.querySelector('input[accept=".pdf"]') as HTMLInputElement
    fireEvent.change(pdfInput, {
      target: { files: [new File(["%PDF-1.4"], "surat.pdf", { type: "application/pdf" })] },
    })
    fireEvent.change(screen.getByPlaceholderText("Nomor..."), { target: { value: "001/SK/2026" } })
    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement
    fireEvent.change(dateInput, { target: { value: "2026-08-11" } })

    fireEvent.click(screen.getByRole("button", { name: /Proses 2 Data/i }))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalled()
    })

    const toastMsg = String(mockToastError.mock.calls[0][0])
    expect(toastMsg).toMatch(/formulir/i)
    expect(toastMsg).not.toMatch(/file Excel/i)
    expect(screen.queryByText(/kesalahan tanggal pada file Excel/i)).not.toBeInTheDocument()
  })
})
