/**
 * NimDialog — Dialog untuk menambahkan NIM (Nomor Induk Mengajar) guru.
 *
 * Tiga mode:
 *   - 'select'   : Tampilkan info guru + dua tombol pilihan
 *   - 'generate' : Preview NIM otomatis + konfirmasi simpan
 *   - 'manual'   : Input NIM manual + validasi inline
 *
 * Feature: nim-generator-sk
 * Requirements: 1, 2, 3, 4, 5, 6, 7
 */

import { useState } from 'react'
import { Loader2, Hash, Pencil, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { teacherApi } from '@/lib/api'

// ── Types ──────────────────────────────────────────────────────────────────

export interface TeacherForNim {
  id: number
  nama: string
  unit_kerja?: string
  nomor_induk_maarif?: string
  [key: string]: any
}

export interface NimDialogProps {
  /** Teacher yang akan diberi NIM */
  teacher: TeacherForNim
  /** Apakah dialog terbuka */
  open: boolean
  /** Dipanggil setelah NIM berhasil disimpan, dengan teacher yang sudah terupdate */
  onSuccess: (updatedTeacher: TeacherForNim) => void
  /** Dipanggil saat user membatalkan dialog */
  onCancel: () => void
}

type DialogMode = 'select' | 'generate' | 'manual'

// ── Component ──────────────────────────────────────────────────────────────

export function NimDialog({ teacher, open, onSuccess, onCancel }: NimDialogProps) {
  const [mode, setMode] = useState<DialogMode>('select')
  const [previewNim, setPreviewNim] = useState<string>('')
  const [manualNim, setManualNim] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [manualError, setManualError] = useState<string | null>(null)

  // Reset state saat dialog dibuka/ditutup
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      handleCancel()
    }
  }

  const handleCancel = () => {
    // Reset semua state sebelum memanggil onCancel
    setMode('select')
    setPreviewNim('')
    setManualNim('')
    setError(null)
    setManualError(null)
    onCancel()
  }

  const handleBack = () => {
    setMode('select')
    setPreviewNim('')
    setManualNim('')
    setError(null)
    setManualError(null)
  }

  // ── Mode: Generate ──────────────────────────────────────────────────────

  const handleSelectGenerate = async () => {
    setMode('generate')
    setError(null)
    setIsLoading(true)
    try {
      const result = await teacherApi.previewNim()
      setPreviewNim(result.nim)
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Gagal mengambil preview NIM.'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveGenerated = async () => {
    if (!previewNim) return
    setIsSaving(true)
    setError(null)
    try {
      const updated = await teacherApi.updateNim(teacher.id, previewNim)
      const updatedTeacher: TeacherForNim = {
        ...teacher,
        nomor_induk_maarif: updated.nomor_induk_maarif,
      }
      // Reset state sebelum memanggil onSuccess
      setMode('select')
      setPreviewNim('')
      onSuccess(updatedTeacher)
    } catch (err: any) {
      const apiErrors = err?.response?.data?.errors?.nim
      const msg = apiErrors
        ? apiErrors[0]
        : err?.response?.data?.message || err?.message || 'Gagal menyimpan NIM.'
      setError(msg)
    } finally {
      setIsSaving(false)
    }
  }

  // ── Mode: Manual ────────────────────────────────────────────────────────

  const handleSelectManual = () => {
    setMode('manual')
    setManualNim('')
    setManualError(null)
    setError(null)
  }

  /** Validasi client-side: hanya angka, tidak boleh kosong */
  const validateManualNim = (value: string): string | null => {
    if (!value.trim()) return 'NIM tidak boleh kosong.'
    if (!/^\d+$/.test(value)) return 'NIM harus berupa angka.'
    return null
  }

  const handleManualNimChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setManualNim(value)
    // Clear error saat user mengetik
    if (manualError) setManualError(null)
    if (error) setError(null)
  }

  const handleSaveManual = async () => {
    const validationError = validateManualNim(manualNim)
    if (validationError) {
      setManualError(validationError)
      return
    }

    setIsSaving(true)
    setError(null)
    setManualError(null)
    try {
      const updated = await teacherApi.updateNim(teacher.id, manualNim.trim())
      const updatedTeacher: TeacherForNim = {
        ...teacher,
        nomor_induk_maarif: updated.nomor_induk_maarif,
      }
      // Reset state sebelum memanggil onSuccess
      setMode('select')
      setManualNim('')
      onSuccess(updatedTeacher)
    } catch (err: any) {
      const apiErrors = err?.response?.data?.errors?.nim
      if (apiErrors) {
        // Inline error untuk duplikasi / format invalid dari server
        setManualError(apiErrors[0])
      } else {
        const msg = err?.response?.data?.message || err?.message || 'Gagal menyimpan NIM.'
        setError(msg)
      }
    } finally {
      setIsSaving(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="rounded-[2rem] p-0 overflow-hidden max-w-md">
        {/* Header */}
        <DialogHeader className="px-8 pt-8 pb-6 bg-slate-50 border-b border-slate-100">
          <div className="flex items-center gap-3 mb-1">
            <span className="p-2 bg-blue-100 rounded-xl text-blue-600">
              <Hash className="h-5 w-5" />
            </span>
            <DialogTitle className="text-lg font-black text-slate-800 uppercase tracking-tight">
              Tambah NIM Guru
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-slate-500 font-medium">
            Guru ini belum memiliki Nomor Induk Mengajar (NIM).
          </DialogDescription>
        </DialogHeader>

        <div className="px-8 py-6 space-y-6">
          {/* Info Guru */}
          <div className="bg-slate-50 rounded-2xl p-4 space-y-1">
            <p
              className="font-black text-slate-800 text-base"
              data-testid="teacher-nama"
            >
              {teacher.nama}
            </p>
            {teacher.unit_kerja && (
              <p
                className="text-sm text-slate-500 font-medium"
                data-testid="teacher-unit-kerja"
              >
                {teacher.unit_kerja}
              </p>
            )}
          </div>

          {/* ── Mode: Select ── */}
          {mode === 'select' && (
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                Pilih cara menambahkan NIM:
              </p>
              <Button
                onClick={handleSelectGenerate}
                className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-xs tracking-widest shadow-lg shadow-blue-100 flex items-center gap-3"
                data-testid="btn-generate-otomatis"
              >
                <Hash className="h-4 w-4" />
                Generate Otomatis
              </Button>
              <Button
                onClick={handleSelectManual}
                variant="outline"
                className="w-full h-14 rounded-2xl border-2 border-slate-200 hover:bg-slate-50 text-slate-700 font-black uppercase text-xs tracking-widest flex items-center gap-3"
                data-testid="btn-input-manual"
              >
                <Pencil className="h-4 w-4" />
                Input Manual
              </Button>
              <Button
                onClick={handleCancel}
                variant="ghost"
                className="w-full h-10 rounded-xl text-slate-400 hover:text-slate-600 font-bold text-xs uppercase tracking-widest"
                data-testid="btn-cancel-select"
              >
                Batal
              </Button>
            </div>
          )}

          {/* ── Mode: Generate ── */}
          {mode === 'generate' && (
            <div className="space-y-4">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                Preview NIM yang akan di-generate:
              </p>

              {isLoading && (
                <div
                  className="flex items-center justify-center py-6 text-slate-400"
                  data-testid="generate-loading"
                >
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span className="text-sm font-medium">Mengambil NIM berikutnya...</span>
                </div>
              )}

              {!isLoading && previewNim && (
                <div
                  className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-5 text-center"
                  data-testid="nim-preview"
                >
                  <p className="text-[10px] font-black uppercase text-blue-400 tracking-widest mb-1">
                    NIM yang akan disimpan
                  </p>
                  <p className="text-3xl font-black text-blue-700 tracking-wider">
                    {previewNim}
                  </p>
                </div>
              )}

              {error && (
                <div
                  className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3"
                  data-testid="generate-error"
                >
                  <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-600 font-medium">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleBack}
                  variant="outline"
                  className="flex-1 h-12 rounded-xl border-2 border-slate-200 font-bold text-xs uppercase tracking-widest"
                  disabled={isSaving}
                  data-testid="btn-back-generate"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Kembali
                </Button>
                <Button
                  onClick={handleSaveGenerated}
                  className="flex-1 h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest"
                  disabled={isLoading || isSaving || !previewNim || !!error}
                  data-testid="btn-save-generate"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                  )}
                  Simpan
                </Button>
              </div>
            </div>
          )}

          {/* ── Mode: Manual ── */}
          {mode === 'manual' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="nim-manual-input"
                  className="text-[10px] font-black uppercase text-slate-400 tracking-widest"
                >
                  Masukkan NIM
                </Label>
                <Input
                  id="nim-manual-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="Contoh: 113400139"
                  value={manualNim}
                  onChange={handleManualNimChange}
                  className={`h-14 rounded-2xl text-lg font-bold tracking-wider text-center border-2 ${
                    manualError
                      ? 'border-red-400 focus-visible:ring-red-300'
                      : 'border-slate-200'
                  }`}
                  disabled={isSaving}
                  data-testid="nim-manual-input"
                  aria-describedby={manualError ? 'nim-manual-error' : undefined}
                  aria-invalid={!!manualError}
                />
                {manualError && (
                  <div
                    id="nim-manual-error"
                    className="flex items-start gap-2"
                    data-testid="manual-error"
                    role="alert"
                  >
                    <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                    <p className="text-sm text-red-600 font-medium">{manualError}</p>
                  </div>
                )}
              </div>

              {/* Error umum (non-field) */}
              {error && !manualError && (
                <div
                  className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3"
                  data-testid="manual-general-error"
                >
                  <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-600 font-medium">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleBack}
                  variant="outline"
                  className="flex-1 h-12 rounded-xl border-2 border-slate-200 font-bold text-xs uppercase tracking-widest"
                  disabled={isSaving}
                  data-testid="btn-back-manual"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Kembali
                </Button>
                <Button
                  onClick={handleSaveManual}
                  className="flex-1 h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest"
                  disabled={isSaving}
                  data-testid="btn-save-manual"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                  )}
                  Simpan
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
