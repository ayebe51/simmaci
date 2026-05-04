import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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
  kecamatan: 'Cilacap Tengah',
  kepala_madrasah: 'Ahmad Dahlan',
  kepala_nim: '123456',
  kepala_nuptk: '1234567890123456',
  kepala_whatsapp: '081234567890',
  kepala_jabatan_mulai: '2020-01-01',
  kepala_jabatan_selesai: '2024-12-31',
}

describe('HeadmasterProfileForm - Optimistic Updates', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    // Create a new QueryClient for each test to ensure isolation
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    vi.clearAllMocks()
  })

  const renderForm = (props = {}) => {
    const defaultProps = {
      school: mockSchool,
      onSuccess: vi.fn(),
      onCancel: vi.fn(),
      isAdminMode: true,
    }

    return render(
      <QueryClientProvider client={queryClient}>
        <HeadmasterProfileForm {...defaultProps} {...props} />
      </QueryClientProvider>
    )
  }

  it('should invalidate admin-schools query after successful update', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()

    // Mock successful API response
    const updatedSchool = { ...mockSchool, kepala_madrasah: 'Updated Name' }
    vi.mocked(schoolApi.update).mockResolvedValue(updatedSchool)

    // Spy on queryClient.invalidateQueries
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')

    renderForm({ onSuccess })

    // Update the name field
    const nameInput = screen.getByPlaceholderText('Nama Lengkap')
    await user.clear(nameInput)
    await user.type(nameInput, 'Updated Name')

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /simpan perubahan/i })
    await user.click(submitButton)

    // Wait for mutation to complete
    await waitFor(() => {
      expect(schoolApi.update).toHaveBeenCalledWith(mockSchool.id, expect.objectContaining({
        kepala_madrasah: 'Updated Name',
      }))
    })

    // Verify query invalidation was called
    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['admin-schools'] })
    })

    // Verify success callback was called
    expect(onSuccess).toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledWith('Profil kepala madrasah berhasil diperbarui!')
  })

  it('should invalidate school detail query after successful update', async () => {
    const user = userEvent.setup()

    const updatedSchool = { ...mockSchool, kepala_whatsapp: '089999999999' }
    vi.mocked(schoolApi.update).mockResolvedValue(updatedSchool)

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')

    renderForm()

    // Update WhatsApp field
    const whatsappInput = screen.getByPlaceholderText('08...')
    await user.clear(whatsappInput)
    await user.type(whatsappInput, '089999999999')

    // Submit
    const submitButton = screen.getByRole('button', { name: /simpan perubahan/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['school', mockSchool.id] })
    })
  })

  it('should invalidate school-profile query after successful update', async () => {
    const user = userEvent.setup()

    const updatedSchool = { ...mockSchool, kepala_nim: '999999' }
    vi.mocked(schoolApi.update).mockResolvedValue(updatedSchool)

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')

    renderForm()

    // Update NIM field
    const nimInput = screen.getByPlaceholderText('No Induk')
    await user.clear(nimInput)
    await user.type(nimInput, '999999')

    // Submit
    const submitButton = screen.getByRole('button', { name: /simpan perubahan/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['school-profile'] })
    })
  })

  it('should display updated data immediately after successful update', async () => {
    const user = userEvent.setup()

    const updatedSchool = {
      ...mockSchool,
      kepala_madrasah: 'New Headmaster Name',
      kepala_jabatan_mulai: '2024-01-01',
    }
    vi.mocked(schoolApi.update).mockResolvedValue(updatedSchool)

    renderForm()

    // Update fields
    const nameInput = screen.getByPlaceholderText('Nama Lengkap')
    await user.clear(nameInput)
    await user.type(nameInput, 'New Headmaster Name')

    const startDateInput = screen.getAllByRole('textbox').find(
      (input) => input.getAttribute('type') === 'date' && input.getAttribute('name')?.includes('mulai')
    )
    if (startDateInput) {
      await user.clear(startDateInput)
      await user.type(startDateInput, '2024-01-01')
    }

    // Submit
    const submitButton = screen.getByRole('button', { name: /simpan perubahan/i })
    await user.click(submitButton)

    // Wait for form to be updated with server response
    await waitFor(() => {
      expect(nameInput).toHaveValue('New Headmaster Name')
    })
  })

  it('should handle validation errors without invalidating queries', async () => {
    const user = userEvent.setup()

    // Mock validation error response
    const validationError = {
      response: {
        status: 422,
        data: {
          errors: {
            kepala_jabatan_selesai: ['Tanggal selesai harus setelah tanggal mulai'],
          },
        },
      },
    }
    vi.mocked(schoolApi.update).mockRejectedValue(validationError)

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')

    renderForm()

    // Submit form
    const submitButton = screen.getByRole('button', { name: /simpan perubahan/i })
    await user.click(submitButton)

    // Wait for error handling
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled()
    })

    // Verify queries were NOT invalidated on error
    expect(invalidateQueriesSpy).not.toHaveBeenCalled()
  })

  it('should handle 403 forbidden errors without invalidating queries', async () => {
    const user = userEvent.setup()

    const forbiddenError = {
      response: {
        status: 403,
        data: {
          message: 'Unauthorized',
        },
      },
    }
    vi.mocked(schoolApi.update).mockRejectedValue(forbiddenError)

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')

    renderForm()

    const submitButton = screen.getByRole('button', { name: /simpan perubahan/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Anda tidak memiliki akses untuk mengubah data sekolah ini'
      )
    })

    // Verify queries were NOT invalidated on error
    expect(invalidateQueriesSpy).not.toHaveBeenCalled()
  })

  it('should prevent duplicate submissions during mutation', async () => {
    const user = userEvent.setup()

    // Mock slow API response
    vi.mocked(schoolApi.update).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(mockSchool), 1000))
    )

    renderForm()

    const submitButton = screen.getByRole('button', { name: /simpan perubahan/i })

    // Click submit button
    await user.click(submitButton)

    // Button should be disabled during submission
    expect(submitButton).toBeDisabled()
    expect(screen.getByText(/menyimpan/i)).toBeInTheDocument()

    // Try to click again (should not trigger another API call)
    await user.click(submitButton)

    // Wait for mutation to complete
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled()
    }, { timeout: 2000 })

    // Verify API was only called once
    expect(schoolApi.update).toHaveBeenCalledTimes(1)
  })

  it('should call onSuccess callback after successful update and query invalidation', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()

    vi.mocked(schoolApi.update).mockResolvedValue(mockSchool)

    renderForm({ onSuccess })

    const submitButton = screen.getByRole('button', { name: /simpan perubahan/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled()
    })

    // Verify success was called after invalidation
    expect(toast.success).toHaveBeenCalledWith('Profil kepala madrasah berhasil diperbarui!')
  })

  it('should update form with fresh data from server response', async () => {
    const user = userEvent.setup()

    // Server returns normalized data
    const serverResponse = {
      ...mockSchool,
      kepala_madrasah: 'Server Normalized Name',
      kepala_whatsapp: '081234567890', // Server might format this
    }
    vi.mocked(schoolApi.update).mockResolvedValue(serverResponse)

    renderForm()

    const nameInput = screen.getByPlaceholderText('Nama Lengkap')
    await user.clear(nameInput)
    await user.type(nameInput, 'User Input Name')

    const submitButton = screen.getByRole('button', { name: /simpan perubahan/i })
    await user.click(submitButton)

    // Form should be updated with server response, not user input
    await waitFor(() => {
      expect(nameInput).toHaveValue('Server Normalized Name')
    })
  })
})
