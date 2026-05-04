import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import AdminSchoolManagementPage from './AdminSchoolManagementPage'
import { schoolApi } from '@/lib/api'

// Mock the API
vi.mock('@/lib/api', () => ({
  schoolApi: {
    paginate: vi.fn(),
    update: vi.fn(),
  },
}))

// Mock HeadmasterProfileForm component
vi.mock('./components/HeadmasterProfileForm', () => ({
  default: ({ school, onSuccess, onCancel, isAdminMode }: any) => (
    <div data-testid="headmaster-profile-form">
      <div>School: {school.nama}</div>
      <div>Admin Mode: {isAdminMode ? 'Yes' : 'No'}</div>
      <button onClick={onSuccess} data-testid="form-success-btn">Success</button>
      <button onClick={onCancel} data-testid="form-cancel-btn">Cancel</button>
    </div>
  ),
}))

const mockSchools = [
  {
    id: 1,
    nama: 'MI Miftahul Huda',
    nsm: '111233445566',
    kecamatan: 'Cilacap Tengah',
    kepala_madrasah: 'Ahmad Dahlan',
    kepala_whatsapp: '081234567890',
    kepala_jabatan_mulai: '2020-01-01',
    kepala_jabatan_selesai: '2024-12-31',
  },
  {
    id: 2,
    nama: 'MTs Al-Ikhlas',
    nsm: '222344556677',
    kecamatan: 'Cilacap Selatan',
    kepala_madrasah: 'Siti Aminah',
    kepala_whatsapp: '082345678901',
    kepala_jabatan_mulai: '2021-06-01',
    kepala_jabatan_selesai: null,
  },
]

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </BrowserRouter>
  )
}

describe('AdminSchoolManagementPage - Task 3.3 Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock successful API response
    vi.mocked(schoolApi.paginate).mockResolvedValue({
      data: mockSchools,
      current_page: 1,
      last_page: 1,
      per_page: 15,
      total: 2,
    } as any)
  })

  it('should render school list correctly', async () => {
    render(<AdminSchoolManagementPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('MI Miftahul Huda')).toBeInTheDocument()
      expect(screen.getByText('MTs Al-Ikhlas')).toBeInTheDocument()
    })
  })

  it('should have click handler for school selection (Requirement 1)', async () => {
    render(<AdminSchoolManagementPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('MI Miftahul Huda')).toBeInTheDocument()
    })

    // Click on the school row
    const schoolRow = screen.getByText('MI Miftahul Huda').closest('tr')
    expect(schoolRow).toBeInTheDocument()
    
    fireEvent.click(schoolRow!)

    // Should display the form
    await waitFor(() => {
      expect(screen.getByTestId('headmaster-profile-form')).toBeInTheDocument()
    })
  })

  it('should display HeadmasterProfileForm when school is selected (Requirement 2)', async () => {
    render(<AdminSchoolManagementPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('MI Miftahul Huda')).toBeInTheDocument()
    })

    // Click on school
    const schoolRow = screen.getByText('MI Miftahul Huda').closest('tr')
    fireEvent.click(schoolRow!)

    // Verify form is displayed
    await waitFor(() => {
      const form = screen.getByTestId('headmaster-profile-form')
      expect(form).toBeInTheDocument()
      expect(screen.getByText('School: MI Miftahul Huda')).toBeInTheDocument()
    })
  })

  it('should pass selected school data to form component (Requirement 3)', async () => {
    render(<AdminSchoolManagementPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('MI Miftahul Huda')).toBeInTheDocument()
    })

    // Click on school
    const schoolRow = screen.getByText('MI Miftahul Huda').closest('tr')
    fireEvent.click(schoolRow!)

    // Verify school data is passed to form
    await waitFor(() => {
      expect(screen.getByText('School: MI Miftahul Huda')).toBeInTheDocument()
      expect(screen.getByText('Admin Mode: Yes')).toBeInTheDocument()
    })
  })

  it('should handle form success callback to refresh school list (Requirement 4)', async () => {
    render(<AdminSchoolManagementPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('MI Miftahul Huda')).toBeInTheDocument()
    })

    // Click on school to open form
    const schoolRow = screen.getByText('MI Miftahul Huda').closest('tr')
    fireEvent.click(schoolRow!)

    await waitFor(() => {
      expect(screen.getByTestId('headmaster-profile-form')).toBeInTheDocument()
    })

    // Clear previous calls
    vi.mocked(schoolApi.paginate).mockClear()

    // Click success button
    const successBtn = screen.getByTestId('form-success-btn')
    fireEvent.click(successBtn)

    // Should refetch school list
    await waitFor(() => {
      expect(schoolApi.paginate).toHaveBeenCalled()
    })

    // Should return to list view
    await waitFor(() => {
      expect(screen.queryByTestId('headmaster-profile-form')).not.toBeInTheDocument()
      expect(screen.getByText('MI Miftahul Huda')).toBeInTheDocument()
    })
  })

  it('should handle form cancel callback to return to list view (Requirement 5)', async () => {
    render(<AdminSchoolManagementPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('MI Miftahul Huda')).toBeInTheDocument()
    })

    // Click on school to open form
    const schoolRow = screen.getByText('MI Miftahul Huda').closest('tr')
    fireEvent.click(schoolRow!)

    await waitFor(() => {
      expect(screen.getByTestId('headmaster-profile-form')).toBeInTheDocument()
    })

    // Click cancel button
    const cancelBtn = screen.getByTestId('form-cancel-btn')
    fireEvent.click(cancelBtn)

    // Should return to list view
    await waitFor(() => {
      expect(screen.queryByTestId('headmaster-profile-form')).not.toBeInTheDocument()
      expect(screen.getByText('MI Miftahul Huda')).toBeInTheDocument()
    })
  })

  it('should search functionality filter schools correctly', async () => {
    render(<AdminSchoolManagementPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('MI Miftahul Huda')).toBeInTheDocument()
    })

    // Find search input
    const searchInput = screen.getByPlaceholderText('Cari nama sekolah...')
    expect(searchInput).toBeInTheDocument()

    // Type in search
    fireEvent.change(searchInput, { target: { value: 'Miftahul' } })

    // Wait for debounce and API call
    await waitFor(() => {
      expect(schoolApi.paginate).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'Miftahul',
        })
      )
    }, { timeout: 500 })
  })

  it('should display Edit button for each school', async () => {
    render(<AdminSchoolManagementPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('MI Miftahul Huda')).toBeInTheDocument()
    })

    // Find all Edit buttons
    const editButtons = screen.getAllByText('Edit')
    expect(editButtons.length).toBeGreaterThan(0)

    // Click Edit button
    fireEvent.click(editButtons[0])

    // Should display form
    await waitFor(() => {
      expect(screen.getByTestId('headmaster-profile-form')).toBeInTheDocument()
    })
  })

  it('should filter schools by kecamatan correctly', async () => {
    render(<AdminSchoolManagementPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('MI Miftahul Huda')).toBeInTheDocument()
    })

    // Find the kecamatan select trigger
    const selectTrigger = screen.getByRole('combobox')
    expect(selectTrigger).toBeInTheDocument()

    // Click to open the select
    fireEvent.click(selectTrigger)

    // Wait for options to appear and select one
    await waitFor(() => {
      const option = screen.getByRole('option', { name: 'Cilacap Tengah' })
      expect(option).toBeInTheDocument()
      fireEvent.click(option)
    })

    // Wait for API call with kecamatan filter
    await waitFor(() => {
      expect(schoolApi.paginate).toHaveBeenCalledWith(
        expect.objectContaining({
          kecamatan: 'Cilacap Tengah',
        })
      )
    })
  })
})
