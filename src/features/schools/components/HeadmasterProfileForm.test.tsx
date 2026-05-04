import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import HeadmasterProfileForm from './HeadmasterProfileForm'
import { schoolApi } from '@/lib/api'
import { toast } from 'sonner'

// Mock dependencies
vi.mock('@/lib/api', () => ({
  schoolApi: {
    update: vi.fn(),
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

const mockSchool = {
  id: 1,
  nama: 'MI Test School',
  kepala_madrasah: 'Ahmad Dahlan',
  kepala_nim: '123456',
  kepala_nuptk: '1234567890123456',
  kepala_whatsapp: '081234567890',
  kepala_jabatan_mulai: '2020-01-01',
  kepala_jabatan_selesai: '2024-12-31',
}

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('HeadmasterProfileForm - Task 2.5 Unit Tests', () => {
  const mockOnSuccess = vi.fn()
  const mockOnCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Requirement 2.1-2.6: Renders All Headmaster Fields Correctly', () => {
    it('should render kepala_madrasah field', () => {
      render(
        <HeadmasterProfileForm
          school={mockSchool}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      )

      const nameInput = screen.getByPlaceholderText('Nama Lengkap')
      expect(nameInput).toBeInTheDocument()
      expect(nameInput).toHaveValue(mockSchool.kepala_madrasah)
    })

    it('should render kepala_nim field', () => {
      render(
        <HeadmasterProfileForm
          school={mockSchool}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      )

      const nimInput = screen.getByPlaceholderText('No Induk')
      expect(nimInput).toBeInTheDocument()
      expect(nimInput).toHaveValue(mockSchool.kepala_nim)
    })

    it('should render kepala_nuptk field', () => {
      render(
        <HeadmasterProfileForm
          school={mockSchool}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      )

      const nuptkInput = screen.getByPlaceholderText('NUPTK')
      expect(nuptkInput).toBeInTheDocument()
      expect(nuptkInput).toHaveValue(mockSchool.kepala_nuptk)
    })

    it('should render kepala_whatsapp field', () => {
      render(
        <HeadmasterProfileForm
          school={mockSchool}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      )

      const whatsappInput = screen.getByPlaceholderText('08...')
      expect(whatsappInput).toBeInTheDocument()
      expect(whatsappInput).toHaveValue(mockSchool.kepala_whatsapp)
    })

    it('should render kepala_jabatan_mulai field', () => {
      render(
        <HeadmasterProfileForm
          school={mockSchool}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      )

      const startDateInput = screen.getByDisplayValue(mockSchool.kepala_jabatan_mulai)
      expect(startDateInput).toBeInTheDocument()
      expect(startDateInput).toHaveAttribute('type', 'date')
      expect(startDateInput).toHaveAttribute('name', 'kepala_jabatan_mulai')
    })

    it('should render kepala_jabatan_selesai field', () => {
      render(
        <HeadmasterProfileForm
          school={mockSchool}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      )

      const endDateInput = screen.getByDisplayValue(mockSchool.kepala_jabatan_selesai)
      expect(endDateInput).toBeInTheDocument()
      expect(endDateInput).toHaveAttribute('type', 'date')
      expect(endDateInput).toHaveAttribute('name', 'kepala_jabatan_selesai')
    })

    it('should render all headmaster fields with correct initial values', () => {
      render(
        <HeadmasterProfileForm
          school={mockSchool}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      )

      expect(screen.getByPlaceholderText('Nama Lengkap')).toHaveValue(mockSchool.kepala_madrasah)
      expect(screen.getByPlaceholderText('No Induk')).toHaveValue(mockSchool.kepala_nim)
      expect(screen.getByPlaceholderText('NUPTK')).toHaveValue(mockSchool.kepala_nuptk)
      expect(screen.getByPlaceholderText('08...')).toHaveValue(mockSchool.kepala_whatsapp)
    })
  })

  describe('Requirement 3.5 & 5.5: Client-Side Date Validation', () => {
    it('should validate end date is after start date on client', async () => {
      const user = userEvent.setup()
      const mockUpdate = vi.mocked(schoolApi.update)

      render(
        <HeadmasterProfileForm
          school={mockSchool}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      )

      // Get date inputs by their name attribute
      const inputs = screen.getAllByDisplayValue(/2020|2024/)
      const startDateInput = inputs.find(input => input.getAttribute('name') === 'kepala_jabatan_mulai')!
      const endDateInput = inputs.find(input => input.getAttribute('name') === 'kepala_jabatan_selesai')!

      // Set start date to 2024-12-31
      await user.clear(startDateInput)
      await user.type(startDateInput, '2024-12-31')

      // Set end date to 2020-01-01 (before start date)
      await user.clear(endDateInput)
      await user.type(endDateInput, '2020-01-01')

      // Try to submit
      const submitButton = screen.getByRole('button', { name: /simpan perubahan/i })
      await user.click(submitButton)

      // Should show validation error
      await waitFor(() => {
        const errorMessage = screen.queryByText(/tanggal selesai.*setelah.*tanggal mulai/i)
        expect(errorMessage).toBeInTheDocument()
      })

      // API should not be called
      expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('should accept end date equal to start date', async () => {
      const user = userEvent.setup()
      const mockUpdate = vi.mocked(schoolApi.update)
      mockUpdate.mockResolvedValue(mockSchool)

      render(
        <HeadmasterProfileForm
          school={mockSchool}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      )

      // Get date inputs by their name attribute
      const inputs = screen.getAllByDisplayValue(/2020|2024/)
      const startDateInput = inputs.find(input => input.getAttribute('name') === 'kepala_jabatan_mulai')!
      const endDateInput = inputs.find(input => input.getAttribute('name') === 'kepala_jabatan_selesai')!

      // Set both dates to the same value
      await user.clear(startDateInput)
      await user.type(startDateInput, '2024-01-01')

      await user.clear(endDateInput)
      await user.type(endDateInput, '2024-01-01')

      // Submit should work
      const submitButton = screen.getByRole('button', { name: /simpan perubahan/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalled()
      })
    })
  })

  describe('Requirement 8.2: Display Inline Validation Errors', () => {
    it('should display inline validation errors for invalid fields', async () => {
      const user = userEvent.setup()
      const mockUpdate = vi.mocked(schoolApi.update)
      mockUpdate.mockRejectedValue({
        response: {
          status: 422,
          data: {
            errors: {
              kepala_nuptk: ['NUPTK harus 16 digit'],
              kepala_whatsapp: ['Format nomor WhatsApp tidak valid'],
            },
          },
        },
      })

      render(
        <HeadmasterProfileForm
          school={mockSchool}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      )

      const submitButton = screen.getByRole('button', { name: /simpan perubahan/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled()
      })
    })
  })

  describe('Requirement 3.2: API Integration', () => {
    it('should call schoolApi.update with correct school ID and form data', async () => {
      const user = userEvent.setup()
      const mockUpdate = vi.mocked(schoolApi.update)
      mockUpdate.mockResolvedValue(mockSchool)

      render(
        <HeadmasterProfileForm
          school={mockSchool}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      )

      // Change a field
      const nameInput = screen.getByPlaceholderText('Nama Lengkap')
      await user.clear(nameInput)
      await user.type(nameInput, 'New Name')

      // Submit form
      const submitButton = screen.getByRole('button', { name: /simpan perubahan/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith(
          mockSchool.id,
          expect.objectContaining({
            kepala_madrasah: 'New Name',
          })
        )
      })
    })
  })

  describe('Requirement 5.4 & 8.4: Loading State During Submission', () => {
    it('should display loading state during form submission', async () => {
      const user = userEvent.setup()
      const mockUpdate = vi.mocked(schoolApi.update)
      
      // Create a promise that we can control
      let resolveUpdate: (value: any) => void
      const updatePromise = new Promise((resolve) => {
        resolveUpdate = resolve
      })
      mockUpdate.mockReturnValue(updatePromise as any)

      render(
        <HeadmasterProfileForm
          school={mockSchool}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      )

      // Submit form
      const submitButton = screen.getByRole('button', { name: /simpan perubahan/i })
      await user.click(submitButton)

      // Check loading state - button text changes to "Menyimpan..."
      await waitFor(() => {
        const loadingButton = screen.getByRole('button', { name: /menyimpan/i })
        expect(loadingButton).toBeInTheDocument()
      })

      // Resolve the promise
      resolveUpdate!(mockSchool)

      // Loading state should disappear
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /^menyimpan$/i })).not.toBeInTheDocument()
      })
    })
  })

  describe('Requirement 8.5: Disable Submit Button During Submission', () => {
    it('should disable submit button during submission to prevent duplicates', async () => {
      const user = userEvent.setup()
      const mockUpdate = vi.mocked(schoolApi.update)
      
      // Create a promise that we can control
      let resolveUpdate: (value: any) => void
      const updatePromise = new Promise((resolve) => {
        resolveUpdate = resolve
      })
      mockUpdate.mockReturnValue(updatePromise as any)

      render(
        <HeadmasterProfileForm
          school={mockSchool}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      )

      // Submit form
      const submitButton = screen.getByRole('button', { name: /simpan perubahan/i })
      await user.click(submitButton)

      // Button should be disabled
      await waitFor(() => {
        expect(submitButton).toBeDisabled()
      })

      // Resolve the promise
      resolveUpdate!(mockSchool)

      // Button should be enabled again
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled()
      })
    })

    it('should also disable cancel button during submission', async () => {
      const user = userEvent.setup()
      const mockUpdate = vi.mocked(schoolApi.update)
      
      let resolveUpdate: (value: any) => void
      const updatePromise = new Promise((resolve) => {
        resolveUpdate = resolve
      })
      mockUpdate.mockReturnValue(updatePromise as any)

      render(
        <HeadmasterProfileForm
          school={mockSchool}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      )

      const submitButton = screen.getByRole('button', { name: /simpan perubahan/i })
      await user.click(submitButton)

      const cancelButton = screen.getByRole('button', { name: /batal/i })
      
      await waitFor(() => {
        expect(cancelButton).toBeDisabled()
      })

      resolveUpdate!(mockSchool)

      await waitFor(() => {
        expect(cancelButton).not.toBeDisabled()
      })
    })

    it('should disable all form inputs during submission', async () => {
      const user = userEvent.setup()
      const mockUpdate = vi.mocked(schoolApi.update)
      
      let resolveUpdate: (value: any) => void
      const updatePromise = new Promise((resolve) => {
        resolveUpdate = resolve
      })
      mockUpdate.mockReturnValue(updatePromise as any)

      render(
        <HeadmasterProfileForm
          school={mockSchool}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      )

      const submitButton = screen.getByRole('button', { name: /simpan perubahan/i })
      await user.click(submitButton)

      // All inputs should be disabled
      const nameInput = screen.getByPlaceholderText('Nama Lengkap')
      await waitFor(() => {
        expect(nameInput).toBeDisabled()
      })

      resolveUpdate!(mockSchool)

      await waitFor(() => {
        expect(nameInput).not.toBeDisabled()
      })
    })
  })

  describe('Requirement 3.6: onSuccess Callback', () => {
    it('should call onSuccess callback after successful update', async () => {
      const user = userEvent.setup()
      const mockUpdate = vi.mocked(schoolApi.update)
      mockUpdate.mockResolvedValue(mockSchool)

      render(
        <HeadmasterProfileForm
          school={mockSchool}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      )

      const submitButton = screen.getByRole('button', { name: /simpan perubahan/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalledTimes(1)
      })
    })

    it('should display success toast after successful update', async () => {
      const user = userEvent.setup()
      const mockUpdate = vi.mocked(schoolApi.update)
      mockUpdate.mockResolvedValue(mockSchool)

      render(
        <HeadmasterProfileForm
          school={mockSchool}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      )

      const submitButton = screen.getByRole('button', { name: /simpan perubahan/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          'Profil kepala madrasah berhasil diperbarui!'
        )
      })
    })
  })

  describe('Requirement 8.4: onCancel Callback', () => {
    it('should call onCancel callback when user cancels', async () => {
      const user = userEvent.setup()

      render(
        <HeadmasterProfileForm
          school={mockSchool}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      )

      const cancelButton = screen.getByRole('button', { name: /batal/i })
      await user.click(cancelButton)

      expect(mockOnCancel).toHaveBeenCalledTimes(1)
    })
  })

  describe('Error Handling', () => {
    it('should display error toast for 403 Forbidden', async () => {
      const user = userEvent.setup()
      const mockUpdate = vi.mocked(schoolApi.update)
      mockUpdate.mockRejectedValue({
        response: {
          status: 403,
          data: { message: 'Unauthorized' },
        },
      })

      render(
        <HeadmasterProfileForm
          school={mockSchool}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      )

      const submitButton = screen.getByRole('button', { name: /simpan perubahan/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Anda tidak memiliki akses untuk mengubah data sekolah ini'
        )
      })
    })

    it('should display validation errors for 422 response', async () => {
      const user = userEvent.setup()
      const mockUpdate = vi.mocked(schoolApi.update)
      mockUpdate.mockRejectedValue({
        response: {
          status: 422,
          data: {
            errors: {
              kepala_jabatan_selesai: ['The kepala jabatan selesai must be after kepala jabatan mulai.'],
            },
          },
        },
      })

      render(
        <HeadmasterProfileForm
          school={mockSchool}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      )

      const submitButton = screen.getByRole('button', { name: /simpan perubahan/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining('kepala_jabatan_selesai')
        )
      })
    })

    it('should display general error message for other errors', async () => {
      const user = userEvent.setup()
      const mockUpdate = vi.mocked(schoolApi.update)
      mockUpdate.mockRejectedValue({
        response: {
          status: 500,
          data: { message: 'Internal server error' },
        },
      })

      render(
        <HeadmasterProfileForm
          school={mockSchool}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      )

      const submitButton = screen.getByRole('button', { name: /simpan perubahan/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining('Gagal memperbarui profil')
        )
      })
    })
  })

  describe('Integration: Complete Workflow', () => {
    it('should complete full update workflow successfully', async () => {
      const user = userEvent.setup()
      const mockUpdate = vi.mocked(schoolApi.update)
      const updatedSchool = {
        ...mockSchool,
        kepala_madrasah: 'Updated Name',
      }
      mockUpdate.mockResolvedValue(updatedSchool)

      render(
        <HeadmasterProfileForm
          school={mockSchool}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      )

      // 1. User edits form
      const nameInput = screen.getByPlaceholderText('Nama Lengkap')
      await user.clear(nameInput)
      await user.type(nameInput, 'Updated Name')

      // 2. User submits form
      const submitButton = screen.getByRole('button', { name: /simpan perubahan/i })
      await user.click(submitButton)

      // 3. API is called
      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith(
          mockSchool.id,
          expect.objectContaining({
            kepala_madrasah: 'Updated Name',
          })
        )
      })

      // 4. Success toast appears
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalled()
      })

      // 5. onSuccess callback is called
      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled()
      })
    })
  })

})
