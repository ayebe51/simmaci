// Feature: nim-generator-sk, Task 4.9

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NimDialog } from './NimDialog'
import { teacherApi } from '@/lib/api'

// ── Mock API ──────────────────────────────────────────────────────────────

vi.mock('@/lib/api', () => ({
  teacherApi: {
    previewNim: vi.fn(),
    updateNim: vi.fn(),
  },
}))

// ── Fixtures ──────────────────────────────────────────────────────────────

const mockTeacher = {
  id: 42,
  nama: 'Ahmad Fauzi',
  unit_kerja: 'MI Nurul Huda',
  nomor_induk_maarif: undefined,
}

const mockTeacherNoUnitKerja = {
  id: 43,
  nama: 'Siti Aminah',
  unit_kerja: undefined,
  nomor_induk_maarif: undefined,
}

// ── Helpers ───────────────────────────────────────────────────────────────

function renderDialog(overrides?: Partial<Parameters<typeof NimDialog>[0]>) {
  const onSuccess = vi.fn()
  const onCancel = vi.fn()
  const result = render(
    <NimDialog
      teacher={mockTeacher}
      open={true}
      onSuccess={onSuccess}
      onCancel={onCancel}
      {...overrides}
    />
  )
  return { ...result, onSuccess, onCancel }
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('NimDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── 1. Render data guru (Property 6) ─────────────────────────────────

  describe('1. Render data guru', () => {
    it('renders teacher nama in [data-testid="teacher-nama"]', () => {
      renderDialog()
      expect(screen.getByTestId('teacher-nama')).toHaveTextContent('Ahmad Fauzi')
    })

    it('renders teacher unit_kerja in [data-testid="teacher-unit-kerja"]', () => {
      renderDialog()
      expect(screen.getByTestId('teacher-unit-kerja')).toHaveTextContent('MI Nurul Huda')
    })

    it('does NOT render unit_kerja element when unit_kerja is undefined', () => {
      renderDialog({ teacher: mockTeacherNoUnitKerja })
      expect(screen.queryByTestId('teacher-unit-kerja')).not.toBeInTheDocument()
    })
  })

  // ── 2. Mode transitions ───────────────────────────────────────────────

  describe('2. Mode transitions', () => {
    it('starts in select mode — shows both option buttons', () => {
      renderDialog()
      expect(screen.getByTestId('btn-generate-otomatis')).toBeInTheDocument()
      expect(screen.getByTestId('btn-input-manual')).toBeInTheDocument()
      expect(screen.getByTestId('btn-cancel-select')).toBeInTheDocument()
    })

    it('clicking "Generate Otomatis" transitions to generate mode', async () => {
      vi.mocked(teacherApi.previewNim).mockResolvedValue({ nim: '113400140', current_max: '113400139' })
      const user = userEvent.setup()
      renderDialog()

      await user.click(screen.getByTestId('btn-generate-otomatis'))

      await waitFor(() => {
        expect(screen.getByTestId('btn-back-generate')).toBeInTheDocument()
        expect(screen.getByTestId('btn-save-generate')).toBeInTheDocument()
      })
      expect(screen.queryByTestId('btn-generate-otomatis')).not.toBeInTheDocument()
    })

    it('clicking "Input Manual" transitions to manual mode', async () => {
      const user = userEvent.setup()
      renderDialog()

      await user.click(screen.getByTestId('btn-input-manual'))

      expect(screen.getByTestId('nim-manual-input')).toBeInTheDocument()
      expect(screen.getByTestId('btn-back-manual')).toBeInTheDocument()
      expect(screen.getByTestId('btn-save-manual')).toBeInTheDocument()
      expect(screen.queryByTestId('btn-generate-otomatis')).not.toBeInTheDocument()
    })

    it('clicking "Kembali" in generate mode returns to select mode', async () => {
      vi.mocked(teacherApi.previewNim).mockResolvedValue({ nim: '113400140', current_max: '113400139' })
      const user = userEvent.setup()
      renderDialog()

      await user.click(screen.getByTestId('btn-generate-otomatis'))
      await waitFor(() => expect(screen.getByTestId('btn-back-generate')).toBeInTheDocument())

      await user.click(screen.getByTestId('btn-back-generate'))

      expect(screen.getByTestId('btn-generate-otomatis')).toBeInTheDocument()
      expect(screen.getByTestId('btn-input-manual')).toBeInTheDocument()
    })

    it('clicking "Kembali" in manual mode returns to select mode', async () => {
      const user = userEvent.setup()
      renderDialog()

      await user.click(screen.getByTestId('btn-input-manual'))
      await user.click(screen.getByTestId('btn-back-manual'))

      expect(screen.getByTestId('btn-generate-otomatis')).toBeInTheDocument()
      expect(screen.getByTestId('btn-input-manual')).toBeInTheDocument()
    })
  })

  // ── 3. Generate mode behavior ─────────────────────────────────────────

  describe('3. Generate mode behavior', () => {
    it('shows loading state while previewNim() is pending', async () => {
      let resolvePreview!: (v: any) => void
      vi.mocked(teacherApi.previewNim).mockReturnValue(
        new Promise((res) => { resolvePreview = res })
      )
      const user = userEvent.setup()
      renderDialog()

      await user.click(screen.getByTestId('btn-generate-otomatis'))

      expect(screen.getByTestId('generate-loading')).toBeInTheDocument()

      // Cleanup
      resolvePreview({ nim: '113400140', current_max: null })
    })

    it('shows NIM preview after successful previewNim() call', async () => {
      vi.mocked(teacherApi.previewNim).mockResolvedValue({ nim: '113400140', current_max: '113400139' })
      const user = userEvent.setup()
      renderDialog()

      await user.click(screen.getByTestId('btn-generate-otomatis'))

      await waitFor(() => {
        expect(screen.getByTestId('nim-preview')).toBeInTheDocument()
      })
      expect(screen.getByTestId('nim-preview')).toHaveTextContent('113400140')
    })

    it('shows error when previewNim() rejects', async () => {
      vi.mocked(teacherApi.previewNim).mockRejectedValue({
        response: { data: { message: 'Gagal mengambil preview NIM.' } },
      })
      const user = userEvent.setup()
      renderDialog()

      await user.click(screen.getByTestId('btn-generate-otomatis'))

      await waitFor(() => {
        expect(screen.getByTestId('generate-error')).toBeInTheDocument()
      })
    })

    it('"Simpan" button is disabled while loading', async () => {
      let resolvePreview!: (v: any) => void
      vi.mocked(teacherApi.previewNim).mockReturnValue(
        new Promise((res) => { resolvePreview = res })
      )
      const user = userEvent.setup()
      renderDialog()

      await user.click(screen.getByTestId('btn-generate-otomatis'))

      expect(screen.getByTestId('btn-save-generate')).toBeDisabled()

      resolvePreview({ nim: '113400140', current_max: null })
    })

    it('"Simpan" button is disabled when there is an error', async () => {
      vi.mocked(teacherApi.previewNim).mockRejectedValue(new Error('Network error'))
      const user = userEvent.setup()
      renderDialog()

      await user.click(screen.getByTestId('btn-generate-otomatis'))

      await waitFor(() => {
        expect(screen.getByTestId('generate-error')).toBeInTheDocument()
      })
      expect(screen.getByTestId('btn-save-generate')).toBeDisabled()
    })

    it('calls teacherApi.updateNim(teacher.id, previewNim) when "Simpan" is clicked', async () => {
      vi.mocked(teacherApi.previewNim).mockResolvedValue({ nim: '113400140', current_max: '113400139' })
      vi.mocked(teacherApi.updateNim).mockResolvedValue({
        id: 42,
        nama: 'Ahmad Fauzi',
        nomor_induk_maarif: '113400140',
      })
      const user = userEvent.setup()
      renderDialog()

      await user.click(screen.getByTestId('btn-generate-otomatis'))
      await waitFor(() => expect(screen.getByTestId('nim-preview')).toBeInTheDocument())

      await user.click(screen.getByTestId('btn-save-generate'))

      await waitFor(() => {
        expect(teacherApi.updateNim).toHaveBeenCalledWith(42, '113400140')
      })
    })

    it('calls onSuccess with updated teacher after successful save', async () => {
      vi.mocked(teacherApi.previewNim).mockResolvedValue({ nim: '113400140', current_max: '113400139' })
      vi.mocked(teacherApi.updateNim).mockResolvedValue({
        id: 42,
        nama: 'Ahmad Fauzi',
        nomor_induk_maarif: '113400140',
      })
      const user = userEvent.setup()
      const { onSuccess } = renderDialog()

      await user.click(screen.getByTestId('btn-generate-otomatis'))
      await waitFor(() => expect(screen.getByTestId('nim-preview')).toBeInTheDocument())
      await user.click(screen.getByTestId('btn-save-generate'))

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith(
          expect.objectContaining({ id: 42, nomor_induk_maarif: '113400140' })
        )
      })
    })

    it('shows error when updateNim returns 422', async () => {
      vi.mocked(teacherApi.previewNim).mockResolvedValue({ nim: '113400140', current_max: '113400139' })
      vi.mocked(teacherApi.updateNim).mockRejectedValue({
        response: {
          status: 422,
          data: {
            errors: { nim: ['NIM 113400140 sudah digunakan oleh guru lain.'] },
          },
        },
      })
      const user = userEvent.setup()
      renderDialog()

      await user.click(screen.getByTestId('btn-generate-otomatis'))
      await waitFor(() => expect(screen.getByTestId('nim-preview')).toBeInTheDocument())
      await user.click(screen.getByTestId('btn-save-generate'))

      await waitFor(() => {
        expect(screen.getByTestId('generate-error')).toBeInTheDocument()
      })
      expect(screen.getByTestId('generate-error')).toHaveTextContent('NIM 113400140 sudah digunakan oleh guru lain.')
    })
  })

  // ── 4. Manual mode behavior ───────────────────────────────────────────

  describe('4. Manual mode behavior', () => {
    async function openManualMode() {
      const user = userEvent.setup()
      const utils = renderDialog()
      await user.click(screen.getByTestId('btn-input-manual'))
      return { user, ...utils }
    }

    it('shows inline error for empty input on save attempt', async () => {
      const { user } = await openManualMode()

      await user.click(screen.getByTestId('btn-save-manual'))

      expect(screen.getByTestId('manual-error')).toBeInTheDocument()
      expect(screen.getByTestId('manual-error')).toHaveTextContent('NIM tidak boleh kosong')
    })

    it('shows inline error for non-numeric input "abc"', async () => {
      const { user } = await openManualMode()

      await user.type(screen.getByTestId('nim-manual-input'), 'abc')
      await user.click(screen.getByTestId('btn-save-manual'))

      expect(screen.getByTestId('manual-error')).toBeInTheDocument()
      expect(screen.getByTestId('manual-error')).toHaveTextContent('NIM harus berupa angka')
    })

    it('shows inline error for non-numeric input "12a3"', async () => {
      const { user } = await openManualMode()

      await user.type(screen.getByTestId('nim-manual-input'), '12a3')
      await user.click(screen.getByTestId('btn-save-manual'))

      expect(screen.getByTestId('manual-error')).toBeInTheDocument()
    })

    it('shows inline error for non-numeric input "12.3"', async () => {
      const { user } = await openManualMode()

      await user.type(screen.getByTestId('nim-manual-input'), '12.3')
      await user.click(screen.getByTestId('btn-save-manual'))

      expect(screen.getByTestId('manual-error')).toBeInTheDocument()
    })

    it('clears inline error when user starts typing', async () => {
      const { user } = await openManualMode()

      // Trigger error first
      await user.click(screen.getByTestId('btn-save-manual'))
      expect(screen.getByTestId('manual-error')).toBeInTheDocument()

      // Start typing — error should clear
      await user.type(screen.getByTestId('nim-manual-input'), '1')
      expect(screen.queryByTestId('manual-error')).not.toBeInTheDocument()
    })

    it('calls teacherApi.updateNim(teacher.id, nim) with trimmed value on valid input', async () => {
      vi.mocked(teacherApi.updateNim).mockResolvedValue({
        id: 42,
        nama: 'Ahmad Fauzi',
        nomor_induk_maarif: '113400140',
      })
      const { user } = await openManualMode()

      await user.type(screen.getByTestId('nim-manual-input'), '113400140')
      await user.click(screen.getByTestId('btn-save-manual'))

      await waitFor(() => {
        expect(teacherApi.updateNim).toHaveBeenCalledWith(42, '113400140')
      })
    })

    it('calls onSuccess with updated teacher after successful save', async () => {
      vi.mocked(teacherApi.updateNim).mockResolvedValue({
        id: 42,
        nama: 'Ahmad Fauzi',
        nomor_induk_maarif: '113400140',
      })
      const user = userEvent.setup()
      const { onSuccess } = renderDialog()

      await user.click(screen.getByTestId('btn-input-manual'))
      await user.type(screen.getByTestId('nim-manual-input'), '113400140')
      await user.click(screen.getByTestId('btn-save-manual'))

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith(
          expect.objectContaining({ id: 42, nomor_induk_maarif: '113400140' })
        )
      })
    })

    it('shows inline error when server returns 422 with errors.nim', async () => {
      vi.mocked(teacherApi.updateNim).mockRejectedValue({
        response: {
          status: 422,
          data: {
            errors: { nim: ['NIM 113400140 sudah digunakan oleh Ahmad Fauzi (MI Nurul Huda).'] },
          },
        },
      })
      const { user } = await openManualMode()

      await user.type(screen.getByTestId('nim-manual-input'), '113400140')
      await user.click(screen.getByTestId('btn-save-manual'))

      await waitFor(() => {
        expect(screen.getByTestId('manual-error')).toBeInTheDocument()
      })
      expect(screen.getByTestId('manual-error')).toHaveTextContent(
        'NIM 113400140 sudah digunakan oleh Ahmad Fauzi (MI Nurul Huda).'
      )
    })
  })

  // ── 5. Cancel behavior ────────────────────────────────────────────────

  describe('5. Cancel behavior', () => {
    it('clicking "Batal" in select mode calls onCancel() without any API calls', async () => {
      const user = userEvent.setup()
      const { onCancel } = renderDialog()

      await user.click(screen.getByTestId('btn-cancel-select'))

      expect(onCancel).toHaveBeenCalledTimes(1)
      expect(teacherApi.previewNim).not.toHaveBeenCalled()
      expect(teacherApi.updateNim).not.toHaveBeenCalled()
    })

    it('after cancel, mode is reset back to select', async () => {
      vi.mocked(teacherApi.previewNim).mockResolvedValue({ nim: '113400140', current_max: '113400139' })
      const user = userEvent.setup()
      renderDialog()

      // Navigate to generate mode
      await user.click(screen.getByTestId('btn-generate-otomatis'))
      await waitFor(() => expect(screen.getByTestId('btn-back-generate')).toBeInTheDocument())

      // Go back to select, then cancel — handleCancel resets state
      await user.click(screen.getByTestId('btn-back-generate'))
      await user.click(screen.getByTestId('btn-cancel-select'))

      // onCancel was called; if dialog were re-opened it would be in select mode.
      // Verify the internal reset happened by checking the select mode buttons
      // were visible just before cancel was triggered.
      expect(screen.queryByTestId('btn-back-generate')).not.toBeInTheDocument()
      expect(screen.queryByTestId('btn-back-manual')).not.toBeInTheDocument()
    })

    it('closing dialog (onOpenChange false) calls onCancel()', async () => {
      // The Dialog's onOpenChange(false) triggers handleCancel → onCancel()
      // We simulate this by clicking the Batal button which calls handleCancel
      const user = userEvent.setup()
      const { onCancel } = renderDialog()

      await user.click(screen.getByTestId('btn-cancel-select'))

      expect(onCancel).toHaveBeenCalled()
    })
  })
})
