import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import HeadmasterProfileForm from './HeadmasterProfileForm'
import { schoolApi, School } from '@/lib/api'

// Mock the API
vi.mock('@/lib/api', () => ({
  schoolApi: {
    update: vi.fn(),
  },
}))

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Helper to render component with React Query provider
function renderForm(props: any) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <HeadmasterProfileForm {...props} />
    </QueryClientProvider>
  )
}

// Mock school data
const mockSchool: School & {
  kepala_madrasah?: string | null
  kepala_nim?: string | null
  kepala_nuptk?: string | null
  kepala_whatsapp?: string | null
  kepala_jabatan_mulai?: string | null
  kepala_jabatan_selesai?: string | null
} = {
  id: 1,
  nama: 'MI Miftahul Huda',
  kecamatan: 'Cilacap Tengah',
  kepala_madrasah: 'Ahmad Dahlan',
  kepala_nim: '123456',
  kepala_nuptk: '1234567890123456',
  kepala_whatsapp: '081234567890',
  kepala_jabatan_mulai: '2020-01-01',
  kepala_jabatan_selesai: '2024-12-31',
}

describe('HeadmasterProfileForm - Validation Tests (Task 2.2)', () => {
  const mockOnSuccess = vi.fn()
  const mockOnCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Requirement 3.1: Validate input according to existing validation rules', () => {
    it('validates kepala_madrasah max length (255 characters)', async () => {
      const user = userEvent.setup()
      
      renderForm({
        school: mockSchool,
        onSuccess: mockOnSuccess,
        onCancel: mockOnCancel,
      })

      const nameInput = screen.getByPlaceholderText('Nama Lengkap')
      const longName = 'A'.repeat(256)
      
      await user.clear(nameInput)
      await user.type(nameInput, longName)
      
      const submitButton = screen.getByRole('button', { name: /Simpan Perubahan/i })
      await user.click(submitButton)

      // Should display inline error
      await waitFor(() => {
        expect(screen.getByText(/Nama maksimal 255 karakter/i)).toBeInTheDocument()
      })
      
      // Should not call API
      expect(schoolApi.update).not.toHaveBeenCalled()
    })

    it('validates kepala_nim max length (50 characters)', async () => {
      const user = userEvent.setup()
      
      renderForm({
        school: mockSchool,
        onSuccess: mockOnSuccess,
        onCancel: mockOnCancel,
      })

      const nimInput = screen.getByPlaceholderText('No Induk')
      const longNim = '1'.repeat(51)
      
      await user.clear(nimInput)
      await user.type(nimInput, longNim)
      
      const submitButton = screen.getByRole('button', { name: /Simpan Perubahan/i })
      await user.click(submitButton)

      // Should display inline error
      await waitFor(() => {
        expect(screen.getByText(/NIM maksimal 50 karakter/i)).toBeInTheDocument()
      })
      
      // Should not call API
      expect(schoolApi.update).not.toHaveBeenCalled()
    })

    it('validates kepala_nuptk max length (50 characters)', async () => {
      const user = userEvent.setup()
      
      renderForm({
        school: mockSchool,
        onSuccess: mockOnSuccess,
        onCancel: mockOnCancel,
      })

      const nuptkInput = screen.getByPlaceholderText('NUPTK')
      const longNuptk = '1'.repeat(51)
      
      await user.clear(nuptkInput)
      await user.type(nuptkInput, longNuptk)
      
      const submitButton = screen.getByRole('button', { name: /Simpan Perubahan/i })
      await user.click(submitButton)

      // Should display inline error
      await waitFor(() => {
        expect(screen.getByText(/NUPTK maksimal 50 karakter/i)).toBeInTheDocument()
      })
      
      // Should not call API
      expect(schoolApi.update).not.toHaveBeenCalled()
    })

    it('validates kepala_whatsapp max length (20 characters)', async () => {
      const user = userEvent.setup()
      
      renderForm({
        school: mockSchool,
        onSuccess: mockOnSuccess,
        onCancel: mockOnCancel,
      })

      const whatsappInput = screen.getByPlaceholderText('08...')
      const longWhatsapp = '0'.repeat(21)
      
      await user.clear(whatsappInput)
      await user.type(whatsappInput, longWhatsapp)
      
      const submitButton = screen.getByRole('button', { name: /Simpan Perubahan/i })
      await user.click(submitButton)

      // Should display inline error
      await waitFor(() => {
        expect(screen.getByText(/WhatsApp maksimal 20 karakter/i)).toBeInTheDocument()
      })
      
      // Should not call API
      expect(schoolApi.update).not.toHaveBeenCalled()
    })
  })

  describe('Requirement 3.3 & 3.4: Validate date formats for tenure dates', () => {
    it('accepts valid date format (YYYY-MM-DD)', async () => {
      const user = userEvent.setup()
      vi.mocked(schoolApi.update).mockResolvedValue(mockSchool)
      
      renderForm({
        school: { ...mockSchool, kepala_jabatan_mulai: '2020-01-01', kepala_jabatan_selesai: '2024-12-31' },
        onSuccess: mockOnSuccess,
        onCancel: mockOnCancel,
      })

      // HTML5 date inputs handle format validation automatically
      // The component uses type="date" which enforces YYYY-MM-DD format
      const submitButton = screen.getByRole('button', { name: /Simpan Perubahan/i })
      await user.click(submitButton)

      // Should call API with valid dates (no validation error)
      await waitFor(() => {
        expect(schoolApi.update).toHaveBeenCalled()
      })
    })
  })

  describe('Requirement 3.5: Validate end date is after or equal to start date', () => {
    it('rejects end date before start date', async () => {
      const user = userEvent.setup()
      
      renderForm({
        school: {
          ...mockSchool,
          kepala_jabatan_mulai: '2024-12-31',
          kepala_jabatan_selesai: '2020-01-01',
        },
        onSuccess: mockOnSuccess,
        onCancel: mockOnCancel,
      })

      const submitButton = screen.getByRole('button', { name: /Simpan Perubahan/i })
      await user.click(submitButton)

      // Should display inline error
      await waitFor(() => {
        expect(screen.getByText(/Tanggal selesai jabatan harus setelah atau sama dengan tanggal mulai jabatan/i)).toBeInTheDocument()
      })
      
      // Should not call API
      expect(schoolApi.update).not.toHaveBeenCalled()
    })

    it('accepts end date equal to start date', async () => {
      const user = userEvent.setup()
      vi.mocked(schoolApi.update).mockResolvedValue(mockSchool)
      
      renderForm({
        school: {
          ...mockSchool,
          kepala_jabatan_mulai: '2024-01-01',
          kepala_jabatan_selesai: '2024-01-01',
        },
        onSuccess: mockOnSuccess,
        onCancel: mockOnCancel,
      })

      const submitButton = screen.getByRole('button', { name: /Simpan Perubahan/i })
      await user.click(submitButton)

      // Should call API (no validation error)
      await waitFor(() => {
        expect(schoolApi.update).toHaveBeenCalled()
      })
    })

    it('accepts end date after start date', async () => {
      const user = userEvent.setup()
      vi.mocked(schoolApi.update).mockResolvedValue(mockSchool)
      
      renderForm({
        school: {
          ...mockSchool,
          kepala_jabatan_mulai: '2020-01-01',
          kepala_jabatan_selesai: '2024-12-31',
        },
        onSuccess: mockOnSuccess,
        onCancel: mockOnCancel,
      })

      const submitButton = screen.getByRole('button', { name: /Simpan Perubahan/i })
      await user.click(submitButton)

      // Should call API (no validation error)
      await waitFor(() => {
        expect(schoolApi.update).toHaveBeenCalled()
      })
    })
  })

  describe('Requirement 5.5: Display inline validation errors with form fields', () => {
    it('displays inline error message below the field with validation error', async () => {
      const user = userEvent.setup()
      
      renderForm({
        school: mockSchool,
        onSuccess: mockOnSuccess,
        onCancel: mockOnCancel,
      })

      const nameInput = screen.getByPlaceholderText('Nama Lengkap')
      const longName = 'A'.repeat(256)
      
      await user.clear(nameInput)
      await user.type(nameInput, longName)
      
      const submitButton = screen.getByRole('button', { name: /Simpan Perubahan/i })
      await user.click(submitButton)

      // Check that error is displayed inline (as a sibling element)
      await waitFor(() => {
        const errorElement = screen.getByText(/Nama maksimal 255 karakter/i)
        expect(errorElement).toBeInTheDocument()
        expect(errorElement).toHaveClass('text-red-600')
      })
    })

    it('displays multiple validation errors for multiple fields', async () => {
      const user = userEvent.setup()
      
      renderForm({
        school: mockSchool,
        onSuccess: mockOnSuccess,
        onCancel: mockOnCancel,
      })

      // Enter invalid data in multiple fields
      const nameInput = screen.getByPlaceholderText('Nama Lengkap')
      const nimInput = screen.getByPlaceholderText('No Induk')
      
      await user.clear(nameInput)
      await user.type(nameInput, 'A'.repeat(256))
      
      await user.clear(nimInput)
      await user.type(nimInput, '1'.repeat(51))
      
      const submitButton = screen.getByRole('button', { name: /Simpan Perubahan/i })
      await user.click(submitButton)

      // Both errors should be displayed
      await waitFor(() => {
        expect(screen.getByText(/Nama maksimal 255 karakter/i)).toBeInTheDocument()
        expect(screen.getByText(/NIM maksimal 50 karakter/i)).toBeInTheDocument()
      })
    })

    it('clears validation errors when field is corrected', async () => {
      const user = userEvent.setup()
      vi.mocked(schoolApi.update).mockResolvedValue(mockSchool)
      
      renderForm({
        school: mockSchool,
        onSuccess: mockOnSuccess,
        onCancel: mockOnCancel,
      })

      const nameInput = screen.getByPlaceholderText('Nama Lengkap')
      
      // Enter invalid data
      await user.clear(nameInput)
      await user.type(nameInput, 'A'.repeat(256))
      
      const submitButton = screen.getByRole('button', { name: /Simpan Perubahan/i })
      await user.click(submitButton)

      // Error should be displayed
      await waitFor(() => {
        expect(screen.getByText(/Nama maksimal 255 karakter/i)).toBeInTheDocument()
      })

      // Correct the data
      await user.clear(nameInput)
      await user.type(nameInput, 'Valid Name')
      
      await user.click(submitButton)

      // Error should be cleared and API should be called
      await waitFor(() => {
        expect(screen.queryByText(/Nama maksimal 255 karakter/i)).not.toBeInTheDocument()
        expect(schoolApi.update).toHaveBeenCalled()
      })
    })
  })

  describe('Additional validation scenarios', () => {
    it('accepts null values for all optional fields', async () => {
      const user = userEvent.setup()
      vi.mocked(schoolApi.update).mockResolvedValue(mockSchool)
      
      renderForm({
        school: {
          ...mockSchool,
          kepala_madrasah: null,
          kepala_nim: null,
          kepala_nuptk: null,
          kepala_whatsapp: null,
          kepala_jabatan_mulai: null,
          kepala_jabatan_selesai: null,
        },
        onSuccess: mockOnSuccess,
        onCancel: mockOnCancel,
      })

      const submitButton = screen.getByRole('button', { name: /Simpan Perubahan/i })
      await user.click(submitButton)

      // Should call API (no validation error)
      await waitFor(() => {
        expect(schoolApi.update).toHaveBeenCalled()
      })
    })

    it('accepts empty strings for all optional fields', async () => {
      const user = userEvent.setup()
      vi.mocked(schoolApi.update).mockResolvedValue(mockSchool)
      
      renderForm({
        school: {
          ...mockSchool,
          kepala_madrasah: '',
          kepala_nim: '',
          kepala_nuptk: '',
          kepala_whatsapp: '',
          kepala_jabatan_mulai: '',
          kepala_jabatan_selesai: '',
        },
        onSuccess: mockOnSuccess,
        onCancel: mockOnCancel,
      })

      const submitButton = screen.getByRole('button', { name: /Simpan Perubahan/i })
      await user.click(submitButton)

      // Should call API (no validation error)
      await waitFor(() => {
        expect(schoolApi.update).toHaveBeenCalled()
      })
    })
  })
})
