/**
 * Unit tests for IjazahUploadField component.
 *
 * Feature: sk-ijazah-upload
 * Validates: Requirements 1.1–1.8
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import IjazahUploadField from './IjazahUploadField';
import * as apiModule from '@/lib/api';

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('@/lib/api', () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

const mockApiClient = vi.mocked(apiModule.apiClient);

// Helper to create a mock File
function createMockFile(name: string, type: string, sizeBytes: number): File {
  const file = new File(['x'.repeat(sizeBytes)], name, { type });
  return file;
}

// Default props
const defaultProps = {
  value: null,
  onChange: vi.fn(),
  isGelarChange: false,
  isPendidikanChange: false,
  schoolId: 42,
  disabled: false,
};

describe('IjazahUploadField', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Rendering ────────────────────────────────────────────────────────────────

  it('renders upload button in idle state', () => {
    render(<IjazahUploadField {...defaultProps} />);

    expect(screen.getByText(/Pilih File PDF Ijazah/i)).toBeInTheDocument();
    expect(screen.getByText(/PDF, maks. 5 MB/i)).toBeInTheDocument();
  });

  it('shows "Wajib" badge when isGelarChange is true', () => {
    render(<IjazahUploadField {...defaultProps} isGelarChange={true} />);

    expect(screen.getByText('Wajib')).toBeInTheDocument();
  });

  it('shows "Wajib" badge when isPendidikanChange is true', () => {
    render(<IjazahUploadField {...defaultProps} isPendidikanChange={true} />);

    expect(screen.getByText('Wajib')).toBeInTheDocument();
  });

  it('shows gelar change warning when isGelarChange is true', () => {
    render(<IjazahUploadField {...defaultProps} isGelarChange={true} />);

    expect(
      screen.getByText(/Perubahan gelar pada nama memerlukan scan ijazah sebagai bukti/i)
    ).toBeInTheDocument();
  });

  it('shows pendidikan change warning when isPendidikanChange is true', () => {
    render(<IjazahUploadField {...defaultProps} isPendidikanChange={true} />);

    expect(
      screen.getByText(/Upload ijazah diperlukan jika ada perubahan gelar\/pendidikan/i)
    ).toBeInTheDocument();
  });

  it('does not show warnings when no changes detected', () => {
    render(<IjazahUploadField {...defaultProps} />);

    expect(
      screen.queryByText(/Perubahan gelar pada nama/i)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Upload ijazah diperlukan/i)
    ).not.toBeInTheDocument();
  });

  // ── File type validation ─────────────────────────────────────────────────────

  it('rejects non-PDF files and shows error message', async () => {
    render(<IjazahUploadField {...defaultProps} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const jpgFile = createMockFile('photo.jpg', 'image/jpeg', 100 * 1024);

    fireEvent.change(input, { target: { files: [jpgFile] } });

    await waitFor(() => {
      expect(screen.getByText('File harus berformat PDF.')).toBeInTheDocument();
    });

    expect(defaultProps.onChange).not.toHaveBeenCalled();
  });

  it('rejects Word documents and shows error message', async () => {
    render(<IjazahUploadField {...defaultProps} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const docFile = createMockFile(
      'document.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      100 * 1024
    );

    fireEvent.change(input, { target: { files: [docFile] } });

    await waitFor(() => {
      expect(screen.getByText('File harus berformat PDF.')).toBeInTheDocument();
    });
  });

  // ── File size validation ─────────────────────────────────────────────────────

  it('rejects files larger than 5MB and shows error message', async () => {
    render(<IjazahUploadField {...defaultProps} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const largeFile = createMockFile('large.pdf', 'application/pdf', 6 * 1024 * 1024);

    fireEvent.change(input, { target: { files: [largeFile] } });

    await waitFor(() => {
      expect(screen.getByText('Ukuran file maksimal 5 MB.')).toBeInTheDocument();
    });

    expect(defaultProps.onChange).not.toHaveBeenCalled();
  });

  // ── Successful upload ────────────────────────────────────────────────────────

  it('shows file name after successful upload', async () => {
    const mockPath = 'ijazah/42/abc123.pdf';
    (mockApiClient.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { path: mockPath, disk: 's3', filename: 'ijazah.pdf' },
    });

    render(<IjazahUploadField {...defaultProps} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const pdfFile = createMockFile('ijazah.pdf', 'application/pdf', 1024 * 1024);

    fireEvent.change(input, { target: { files: [pdfFile] } });

    await waitFor(() => {
      expect(screen.getByText('ijazah.pdf')).toBeInTheDocument();
    });

    expect(defaultProps.onChange).toHaveBeenCalledWith(mockPath);
  });

  it('shows loading indicator during upload', async () => {
    // Make the upload hang
    (mockApiClient.post as ReturnType<typeof vi.fn>).mockImplementationOnce(
      () => new Promise(() => {}) // Never resolves
    );

    render(<IjazahUploadField {...defaultProps} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const pdfFile = createMockFile('ijazah.pdf', 'application/pdf', 1024 * 1024);

    fireEvent.change(input, { target: { files: [pdfFile] } });

    await waitFor(() => {
      expect(screen.getByText(/Mengunggah/i)).toBeInTheDocument();
    });
  });

  // ── Upload failure ───────────────────────────────────────────────────────────

  it('shows error message and retry button when upload fails', async () => {
    (mockApiClient.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Network error')
    );

    render(<IjazahUploadField {...defaultProps} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const pdfFile = createMockFile('ijazah.pdf', 'application/pdf', 1024 * 1024);

    fireEvent.change(input, { target: { files: [pdfFile] } });

    await waitFor(() => {
      expect(
        screen.getByText('Gagal mengunggah file. Silakan coba lagi.')
      ).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Coba Lagi/i })).toBeInTheDocument();
    expect(defaultProps.onChange).not.toHaveBeenCalled();
  });

  // ── File removal ─────────────────────────────────────────────────────────────

  it('resets to idle state after removing uploaded file', async () => {
    const mockPath = 'ijazah/42/abc123.pdf';
    (mockApiClient.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { path: mockPath, disk: 's3', filename: 'ijazah.pdf' },
    });

    render(<IjazahUploadField {...defaultProps} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const pdfFile = createMockFile('ijazah.pdf', 'application/pdf', 1024 * 1024);

    // Upload file
    fireEvent.change(input, { target: { files: [pdfFile] } });

    await waitFor(() => {
      expect(screen.getByText('ijazah.pdf')).toBeInTheDocument();
    });

    // Remove file
    const removeButton = screen.getByLabelText('Hapus file ijazah');
    fireEvent.click(removeButton);

    // Should return to idle state
    await waitFor(() => {
      expect(screen.getByText(/Pilih File PDF Ijazah/i)).toBeInTheDocument();
    });

    // onChange should have been called with null
    expect(defaultProps.onChange).toHaveBeenLastCalledWith(null);
  });

  // ── Disabled state ───────────────────────────────────────────────────────────

  it('disables the upload button when disabled prop is true', () => {
    render(<IjazahUploadField {...defaultProps} disabled={true} />);

    const button = screen.getByText(/Pilih File PDF Ijazah/i).closest('button');
    expect(button).toBeDisabled();
  });

  // ── Format hint ──────────────────────────────────────────────────────────────

  it('always shows format hint "PDF, maks. 5 MB"', () => {
    render(<IjazahUploadField {...defaultProps} />);

    expect(screen.getByText(/PDF, maks. 5 MB/i)).toBeInTheDocument();
  });

  // ── Upload folder path ───────────────────────────────────────────────────────

  it('uploads to correct folder path with schoolId', async () => {
    (mockApiClient.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { path: 'ijazah/42/abc.pdf', disk: 's3', filename: 'ijazah.pdf' },
    });

    render(<IjazahUploadField {...defaultProps} schoolId={42} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const pdfFile = createMockFile('ijazah.pdf', 'application/pdf', 1024 * 1024);

    fireEvent.change(input, { target: { files: [pdfFile] } });

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/files/upload',
        expect.any(FormData),
        expect.any(Object)
      );
    });

    // Verify the FormData contains the correct folder
    const callArgs = (mockApiClient.post as ReturnType<typeof vi.fn>).mock.calls[0];
    const formData = callArgs[1] as FormData;
    expect(formData.get('folder')).toBe('ijazah/42');
  });
});
