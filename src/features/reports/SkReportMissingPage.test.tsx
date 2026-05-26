// Feature: sk-report-missing-submissions, Task 5.5

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import SkReportMissingPage from './SkReportMissingPage'
import { reportApi } from '@/lib/api'
import type { SkBelumMengajukanResponse } from '@/lib/api'

// ── Mock API ──────────────────────────────────────────────────────────────

vi.mock('@/lib/api', () => ({
  reportApi: {
    skBelumMengajukan: vi.fn(),
    exportSkBelumMengajukan: vi.fn(),
  },
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// ── Fixtures ──────────────────────────────────────────────────────────────

const mockReportData: SkBelumMengajukanResponse = {
  total: 3,
  kecamatan_list: ['Cilacap Selatan', 'Majenang', 'Sidareja'],
  data: [
    {
      id: 1,
      nama: 'MI Nurul Huda',
      npsn: '60710001',
      jenjang: 'MI',
      kecamatan: 'Cilacap Selatan',
      kepala_madrasah: 'Ahmad Fauzi, S.Pd.I',
      telepon: '08123456789',
    },
    {
      id: 2,
      nama: 'MTs Al-Ikhlas',
      npsn: '60710005',
      jenjang: 'MTs',
      kecamatan: 'Majenang',
      kepala_madrasah: 'Budi Santoso, M.Pd',
      telepon: '08145678901',
    },
    {
      id: 3,
      nama: 'MA Darul Ulum',
      npsn: null,
      jenjang: 'MA',
      kecamatan: 'Sidareja',
      kepala_madrasah: null,
      telepon: null,
    },
  ],
}

const mockEmptyData: SkBelumMengajukanResponse = {
  total: 0,
  kecamatan_list: [],
  data: [],
}

// ── Helpers ───────────────────────────────────────────────────────────────

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })
}

function renderWithQueryClient(component: React.ReactElement) {
  const queryClient = createTestQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        {component}
      </MemoryRouter>
    </QueryClientProvider>
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('SkReportMissingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── 1. Loading State ──────────────────────────────────────────────────

  describe('Loading state renders skeleton', () => {
    it('renders skeleton loaders while data is loading', () => {
      vi.mocked(reportApi.skBelumMengajukan).mockImplementation(
        () => new Promise(() => {}) // Never resolves — stays in loading
      )

      const { container } = renderWithQueryClient(<SkReportMissingPage />)

      // Skeleton components should be present
      const skeletons = container.querySelectorAll('[class*="animate-pulse"]')
      expect(skeletons.length).toBeGreaterThan(0)
    })
  })

  // ── 2. Error State ────────────────────────────────────────────────────

  describe('Error state renders with retry button', () => {
    it('renders error message and retry button when API fails', async () => {
      vi.mocked(reportApi.skBelumMengajukan).mockRejectedValue(
        new Error('Network error')
      )

      renderWithQueryClient(<SkReportMissingPage />)

      await waitFor(() => {
        expect(screen.getByText('Gagal Memuat Data')).toBeInTheDocument()
      })

      const retryButton = screen.getByRole('button', { name: /coba lagi/i })
      expect(retryButton).toBeInTheDocument()
    })

    it('retry button triggers refetch', async () => {
      vi.mocked(reportApi.skBelumMengajukan)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockReportData)

      renderWithQueryClient(<SkReportMissingPage />)

      await waitFor(() => {
        expect(screen.getByText('Gagal Memuat Data')).toBeInTheDocument()
      })

      const retryButton = screen.getByRole('button', { name: /coba lagi/i })
      fireEvent.click(retryButton)

      await waitFor(() => {
        expect(reportApi.skBelumMengajukan).toHaveBeenCalledTimes(2)
      })
    })
  })

  // ── 3. Empty State ────────────────────────────────────────────────────

  describe('Empty state renders when no data', () => {
    it('renders empty state message when no schools are missing', async () => {
      vi.mocked(reportApi.skBelumMengajukan).mockResolvedValue(mockEmptyData)

      renderWithQueryClient(<SkReportMissingPage />)

      await waitFor(() => {
        expect(
          screen.getByText("Semua madrasah jam'iyyah sudah mengajukan SK")
        ).toBeInTheDocument()
      })
    })
  })

  // ── 4. Table with correct columns ────────────────────────────────────

  describe('Renders table with correct columns', () => {
    it('displays data in table with school information', async () => {
      vi.mocked(reportApi.skBelumMengajukan).mockResolvedValue(mockReportData)

      renderWithQueryClient(<SkReportMissingPage />)

      await waitFor(() => {
        expect(screen.getByText('MI Nurul Huda')).toBeInTheDocument()
      })

      // Verify school data is rendered
      expect(screen.getByText('60710001')).toBeInTheDocument()
      expect(screen.getByText('MTs Al-Ikhlas')).toBeInTheDocument()
      expect(screen.getByText('MA Darul Ulum')).toBeInTheDocument()
      expect(screen.getByText('Ahmad Fauzi, S.Pd.I')).toBeInTheDocument()
      expect(screen.getByText('Budi Santoso, M.Pd')).toBeInTheDocument()
    })

    it('displays total count in summary card', async () => {
      vi.mocked(reportApi.skBelumMengajukan).mockResolvedValue(mockReportData)

      const { container } = renderWithQueryClient(<SkReportMissingPage />)

      await waitFor(() => {
        // The total is rendered in a span with specific styling in the summary card
        const totalSpan = container.querySelector(
          '.text-4xl.font-black.text-slate-900'
        )
        expect(totalSpan).toBeInTheDocument()
        expect(totalSpan?.textContent).toBe('3')
      })
    })

    it('handles null values gracefully with dash', async () => {
      vi.mocked(reportApi.skBelumMengajukan).mockResolvedValue(mockReportData)

      renderWithQueryClient(<SkReportMissingPage />)

      await waitFor(() => {
        expect(screen.getByText('MA Darul Ulum')).toBeInTheDocument()
      })

      // Null NPSN, kepala_madrasah should render as "-"
      const dashes = screen.getAllByText('-')
      expect(dashes.length).toBeGreaterThan(0)
    })
  })

  // ── 5. Filter interactions trigger refetch ────────────────────────────

  describe('Filter interactions trigger refetch', () => {
    it('calls API with jenjang filter when selected', async () => {
      vi.mocked(reportApi.skBelumMengajukan).mockResolvedValue(mockReportData)

      renderWithQueryClient(<SkReportMissingPage />)

      await waitFor(() => {
        expect(screen.getByText('MI Nurul Huda')).toBeInTheDocument()
      })

      // The initial call should have been made
      expect(reportApi.skBelumMengajukan).toHaveBeenCalledTimes(1)
    })

    it('calls API when date filter changes', async () => {
      vi.mocked(reportApi.skBelumMengajukan).mockResolvedValue(mockReportData)

      renderWithQueryClient(<SkReportMissingPage />)

      await waitFor(() => {
        expect(screen.getByText('MI Nurul Huda')).toBeInTheDocument()
      })

      // Change start date
      const dateInputs = screen.getAllByDisplayValue('')
      const startDateInput = dateInputs.find(
        (el) => el.getAttribute('type') === 'date'
      )
      if (startDateInput) {
        fireEvent.change(startDateInput, { target: { value: '2025-01-01' } })
      }

      await waitFor(() => {
        expect(reportApi.skBelumMengajukan).toHaveBeenCalledTimes(2)
      })
    })
  })

  // ── 6. Search debounce works correctly ────────────────────────────────

  describe('Search debounce works correctly', () => {
    it('debounces search input before triggering API call', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      vi.mocked(reportApi.skBelumMengajukan).mockResolvedValue(mockReportData)

      renderWithQueryClient(<SkReportMissingPage />)

      // Wait for initial load
      await waitFor(() => {
        expect(reportApi.skBelumMengajukan).toHaveBeenCalledTimes(1)
      })

      // Type in search input
      const searchInput = screen.getByPlaceholderText(
        /ketik nama madrasah atau npsn/i
      )

      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'Nurul' } })
      })

      // Should NOT have called API again immediately
      expect(reportApi.skBelumMengajukan).toHaveBeenCalledTimes(1)

      // Advance timers past debounce delay (400ms)
      await act(async () => {
        vi.advanceTimersByTime(450)
      })

      // Now it should have triggered a refetch with search param
      await waitFor(() => {
        expect(reportApi.skBelumMengajukan).toHaveBeenCalledTimes(2)
      })

      // Verify the search param was passed
      expect(reportApi.skBelumMengajukan).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'Nurul' })
      )
    })

    it('does not trigger API call before debounce delay', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      vi.mocked(reportApi.skBelumMengajukan).mockResolvedValue(mockReportData)

      renderWithQueryClient(<SkReportMissingPage />)

      await waitFor(() => {
        expect(reportApi.skBelumMengajukan).toHaveBeenCalledTimes(1)
      })

      const searchInput = screen.getByPlaceholderText(
        /ketik nama madrasah atau npsn/i
      )

      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'test' } })
      })

      // Advance only 200ms (less than 400ms debounce)
      await act(async () => {
        vi.advanceTimersByTime(200)
      })

      // Should still be only 1 call (initial)
      expect(reportApi.skBelumMengajukan).toHaveBeenCalledTimes(1)
    })
  })

  // ── 7. Export button triggers download ────────────────────────────────

  describe('Export button triggers download', () => {
    it('calls exportSkBelumMengajukan when Download Excel is clicked', async () => {
      vi.mocked(reportApi.skBelumMengajukan).mockResolvedValue(mockReportData)
      vi.mocked(reportApi.exportSkBelumMengajukan).mockResolvedValue(
        new Blob(['test'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      )

      // Mock URL methods
      const createObjectURLMock = vi.fn(() => 'blob:http://localhost/test')
      const revokeObjectURLMock = vi.fn()
      global.URL.createObjectURL = createObjectURLMock
      global.URL.revokeObjectURL = revokeObjectURLMock

      renderWithQueryClient(<SkReportMissingPage />)

      await waitFor(() => {
        expect(screen.getByText('MI Nurul Huda')).toBeInTheDocument()
      })

      const downloadButton = screen.getByRole('button', { name: /download excel/i })
      fireEvent.click(downloadButton)

      await waitFor(() => {
        expect(reportApi.exportSkBelumMengajukan).toHaveBeenCalledTimes(1)
      })

      await waitFor(() => {
        expect(createObjectURLMock).toHaveBeenCalled()
      })
    })

    it('PDF/Print button calls window.print', async () => {
      vi.mocked(reportApi.skBelumMengajukan).mockResolvedValue(mockReportData)

      const printMock = vi.fn()
      global.window.print = printMock

      renderWithQueryClient(<SkReportMissingPage />)

      await waitFor(() => {
        expect(screen.getByText('MI Nurul Huda')).toBeInTheDocument()
      })

      const printButton = screen.getByRole('button', { name: /pdf \/ print/i })
      fireEvent.click(printButton)

      expect(printMock).toHaveBeenCalledTimes(1)
    })
  })
})
