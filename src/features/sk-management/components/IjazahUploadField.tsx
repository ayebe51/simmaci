/**
 * IjazahUploadField — Component for uploading ijazah PDF scan in SK revision form.
 *
 * Feature: sk-ijazah-upload
 * Validates: Requirements 1.1–1.8, 2.1, 2.2, 2.5
 */

import { useRef, useState } from 'react';
import { Loader2, Paperclip, Trash2, AlertCircle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { apiClient } from '@/lib/api';

// ── Constants ──────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_FILE_SIZE_KB = 5120; // 5120 KB

// ── Types ──────────────────────────────────────────────────────────────────────

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

export interface IjazahUploadFieldProps {
  /** Path/URL of the already-uploaded file (controlled value) */
  value: string | null;
  /** Called with the new path when upload succeeds, or null when file is removed */
  onChange: (path: string | null) => void;
  /** Whether the revision involves a change in academic degree (nama field) */
  isGelarChange: boolean;
  /** Whether the revision involves a change in pendidikan_terakhir */
  isPendidikanChange: boolean;
  /** School ID used to build the upload folder path for tenant isolation */
  schoolId: number | null;
  /** Disables the component when true */
  disabled?: boolean;
}

// ── Validation helpers (exported for property testing) ────────────────────────

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates a file for ijazah upload.
 * Checks MIME type (must be application/pdf) and size (≤ 5 MB).
 */
export function validateIjazahFile(file: { type: string; size: number }): FileValidationResult {
  if (file.type !== 'application/pdf') {
    return { valid: false, error: 'File harus berformat PDF.' };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: 'Ukuran file maksimal 5 MB.' };
  }
  return { valid: true };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function IjazahUploadField({
  value,
  onChange,
  isGelarChange,
  isPendidikanChange,
  schoolId,
  disabled = false,
}: IjazahUploadFieldProps) {
  const [uploadState, setUploadState] = useState<UploadState>(value ? 'success' : 'idle');
  const [fileName, setFileName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isRequired = isGelarChange || isPendidikanChange;

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so the same file can be re-selected after removal
    if (fileInputRef.current) fileInputRef.current.value = '';

    // Client-side validation
    const validation = validateIjazahFile({ type: file.type, size: file.size });
    if (!validation.valid) {
      setErrorMessage(validation.error ?? 'File tidak valid.');
      setUploadState('error');
      return;
    }

    // Upload
    setUploadState('uploading');
    setErrorMessage(null);

    try {
      const folder = schoolId ? `ijazah/${schoolId}` : 'ijazah';
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', folder);

      const response = await apiClient.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });

      const data = response.data;
      const path: string = data?.path ?? data?.url ?? '';

      setFileName(file.name);
      setUploadState('success');
      onChange(path);
    } catch {
      setUploadState('error');
      setErrorMessage('Gagal mengunggah file. Silakan coba lagi.');
    }
  };

  const handleRemove = () => {
    setUploadState('idle');
    setFileName(null);
    setErrorMessage(null);
    onChange(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRetry = () => {
    setUploadState('idle');
    setErrorMessage(null);
    fileInputRef.current?.click();
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      {/* Label */}
      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
        Scan Ijazah
        {isRequired && (
          <span className="bg-amber-100 text-amber-700 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">
            Wajib
          </span>
        )}
      </Label>

      {/* Contextual warning messages */}
      {isPendidikanChange && (
        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700 font-medium">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
          <span>Upload ijazah diperlukan jika ada perubahan gelar/pendidikan.</span>
        </div>
      )}
      {isGelarChange && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700 font-medium">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
          <span>Perubahan gelar pada nama memerlukan scan ijazah sebagai bukti.</span>
        </div>
      )}

      {/* Upload area */}
      {uploadState === 'idle' && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={handleFileChange}
            disabled={disabled}
            aria-label="Upload scan ijazah PDF"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="h-12 w-full rounded-xl border-dashed border-slate-300 text-slate-500 hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50 font-bold text-xs uppercase tracking-widest"
          >
            <Paperclip className="h-4 w-4 mr-2" />
            Pilih File PDF Ijazah
          </Button>
        </div>
      )}

      {uploadState === 'uploading' && (
        <div className="h-12 flex items-center justify-center gap-3 bg-slate-50 rounded-xl border border-slate-200">
          <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
            Mengunggah...
          </span>
        </div>
      )}

      {uploadState === 'success' && (
        <div className="h-12 flex items-center justify-between gap-3 bg-emerald-50 rounded-xl border border-emerald-200 px-4">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="text-xs font-bold text-emerald-700 truncate">
              {fileName ?? 'Ijazah berhasil diunggah'}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            disabled={disabled}
            className="h-8 w-8 p-0 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 shrink-0"
            aria-label="Hapus file ijazah"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}

      {uploadState === 'error' && (
        <div className="space-y-2">
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-red-500" />
            <span className="text-xs font-bold text-red-700">{errorMessage}</span>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleRetry}
            disabled={disabled}
            className="h-10 w-full rounded-xl border-dashed border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs uppercase tracking-widest"
          >
            <Paperclip className="h-4 w-4 mr-2" />
            Coba Lagi
          </Button>
        </div>
      )}

      {/* Format hint */}
      <p className="text-[10px] text-slate-400 font-medium">
        PDF, maks. {MAX_FILE_SIZE_KB / 1024} MB
      </p>
    </div>
  );
}
