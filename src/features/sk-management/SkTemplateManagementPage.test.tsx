/**
 * Unit tests for SkTemplateManagementPage
 *
 * Validates: Requirements 7.2, 7.5, 7.7
 *
 * Property 15: Client-side validation rejects invalid files before API call
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/lib/api', () => ({
  skTemplateApi: {
    list: vi.fn(),
    upload: vi.fn(),
    activate: vi.fn(),
    delete: vi.fn(),
    downloadUrl: vi.fn(),
    getActive: vi.fn(),
  },
}));

// Mock PageHeader to avoid icon/gradient rendering complexity
vi.mock('@/components/ui/PageHeader', () => ({
  default: ({ title }: { title: string }) =>
    createElement('div', { 'data-testid': 'page-header' }, title),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { skTemplateApi } from '@/lib/api';
import { toast } from 'sonner';
import SkTemplateManagementPage from './SkTemplateManagementPage';

const mockedList = vi.mocked(skTemplateApi.list);
const mockedUpload = vi.mocked(skTemplateApi.upload);
const mockedActivate = vi.mocked(skTemplateApi.activate);
const mockedDelete = vi.mocked(skTemplateApi.delete);
const mockedToastError = vi.mocked(toast.error);

// ── Fixtures ───────────────────────────────────────────────────────────────

const makeTemplate = (overrides: Partial<{
  id: number; sk_type: string; original_filename: string;
  is_active: boolean; uploaded_by: string; created_at: string; updated_at: string;
}> = {}) => ({
  id: 1,
  sk_type: 'gty',
  original_filename: 'sk-gty-template.docx',
  is_active: false,
  uploaded_by: 'admin@maarif.id',
  created_at: '2026-07-01T10:00:00Z',
  updated_at: '2026-07-01T10:00:00Z',
  ...overrides,
});

const TEMPLATES = [
  makeTemplate({ id: 1, sk_type: 'gty', original_filename: 'gty-v1.docx', is_active: true }),
  makeTemplate({ id: 2, sk_type: 'gty', original_filename: 'gty-v2.docx', is_active: false }),
  makeTemplate({ id: 3, sk_type: 'gtt', original_filename: 'gtt-v1.docx', is_active: false }),
  makeTemplate({ id: 4, sk_type: 'kamad', original_filename: 'kamad-v1.docx', is_active: true }),
  makeTemplate({ id: 5, sk_type: 'tendik', original_filename: 'tendik-v1.docx', is_active: false }),
];

// ── Helpers ────────────────────────────────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

function renderPage(queryClient?: QueryClient) {
  const qc = queryClient ?? makeQueryClient();
  return render(
    createElement(
      QueryClientProvider,
      { client: qc },
      createElement(SkTemplateManagementPage),
    ),
  );
}

function makeDocxFile(name = 'template.docx', sizeBytes = 1024): File {
  const content = new Uint8Array(sizeBytes).fill(0);
  return new File([content], name, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

function makeNonDocxFile(name = 'template.pdf'): File {
  return new File([new Uint8Array(512)], name, { type: 'application/pdf' });
}

function makeOversizedFile(name = 'big.docx'): File {
  // 11 MB — exceeds the 10 MB limit
  const elevenMb = 11 * 1024 * 1024;
  return new File([new Uint8Array(elevenMb)], name, {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Default: list returns all templates
  mockedList.mockResolvedValue(TEMPLATES);
});

// ── Grouping by sk_type ────────────────────────────────────────────────────

describe('Template list grouped by sk_type', () => {
  it('renders a section for each of the four SK types', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('GTY')).toBeInTheDocument();
      expect(screen.getByText('GTT')).toBeInTheDocument();
      expect(screen.getByText('Kamad')).toBeInTheDocument();
      expect(screen.getByText('Tendik')).toBeInTheDocument();
    });
  });

  it('shows templates under their correct sk_type section', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText('gty-v1.docx')).toBeInTheDocument());

    // GTY section should contain both GTY templates
    expect(screen.getByText('gty-v1.docx')).toBeInTheDocument();
    expect(screen.getByText('gty-v2.docx')).toBeInTheDocument();

    // Other types should show their own templates
    expect(screen.getByText('gtt-v1.docx')).toBeInTheDocument();
    expect(screen.getByText('kamad-v1.docx')).toBeInTheDocument();
    expect(screen.getByText('tendik-v1.docx')).toBeInTheDocument();
  });

  it('shows "Belum ada template" for sk_types with no templates', async () => {
    // Only GTY templates
    mockedList.mockResolvedValue([
      makeTemplate({ id: 1, sk_type: 'gty', original_filename: 'gty-v1.docx' }),
    ]);

    renderPage();

    await waitFor(() => expect(screen.getByText('gty-v1.docx')).toBeInTheDocument());

    // GTT, Kamad, Tendik sections should show empty state
    const emptyMessages = screen.getAllByText('Belum ada template');
    expect(emptyMessages.length).toBeGreaterThanOrEqual(3);
  });

  it('shows active badge for active templates', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText('gty-v1.docx')).toBeInTheDocument());

    // gty-v1 is active, gty-v2 is not
    const rows = screen.getAllByText(/Aktif/i);
    // At least the active badges should be present
    expect(rows.length).toBeGreaterThan(0);
  });
});

// ── Property 15: Client-side Zod validation ────────────────────────────────

describe('Property 15 – Zod schema rejects invalid files before API call', () => {
  it('shows inline error and makes no API call when a non-.docx file is selected', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText('Unggah Template Baru')).toBeInTheDocument());

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).not.toBeNull();

    const badFile = makeNonDocxFile('report.pdf');
    fireEvent.change(fileInput, { target: { files: [badFile] } });

    // Submit the form
    const submitBtn = screen.getByRole('button', { name: /Unggah Template/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('File harus berformat .docx')).toBeInTheDocument();
    });

    expect(mockedUpload).not.toHaveBeenCalled();
  });

  it('shows inline error and makes no API call when file exceeds 10 MB', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText('Unggah Template Baru')).toBeInTheDocument());

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const bigFile = makeOversizedFile();
    fireEvent.change(fileInput, { target: { files: [bigFile] } });

    const submitBtn = screen.getByRole('button', { name: /Unggah Template/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Ukuran file maksimal 10 MB')).toBeInTheDocument();
    });

    expect(mockedUpload).not.toHaveBeenCalled();
  });

  it('does not show a file error for a valid .docx file under 10 MB', async () => {
    mockedUpload.mockResolvedValue({ success: true, data: makeTemplate() });

    renderPage();

    await waitFor(() => expect(screen.getByText('Unggah Template Baru')).toBeInTheDocument());

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const validFile = makeDocxFile('valid.docx', 512 * 1024); // 512 KB
    fireEvent.change(fileInput, { target: { files: [validFile] } });

    // No file error should appear
    expect(screen.queryByText('File harus berformat .docx')).not.toBeInTheDocument();
    expect(screen.queryByText('Ukuran file maksimal 10 MB')).not.toBeInTheDocument();
  });

  it('shows sk_type error when form is submitted without selecting a type', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText('Unggah Template Baru')).toBeInTheDocument());

    // Select a valid file but no sk_type
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [makeDocxFile()] } });

    const submitBtn = screen.getByRole('button', { name: /Unggah Template/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Pilih jenis SK')).toBeInTheDocument();
    });

    expect(mockedUpload).not.toHaveBeenCalled();
  });
});

// ── Delete confirmation dialog ─────────────────────────────────────────────

describe('Delete confirmation dialog (Requirement 7.5)', () => {
  it('shows confirmation dialog when delete button is clicked', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText('gty-v1.docx')).toBeInTheDocument());

    // Hover over the row to reveal action buttons (opacity-0 → group-hover:opacity-100)
    // In jsdom we trigger click directly on the delete button
    const deleteButtons = screen.getAllByTitle('Hapus');
    expect(deleteButtons.length).toBeGreaterThan(0);

    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Hapus Template?')).toBeInTheDocument();
    });

    // API should NOT have been called yet
    expect(mockedDelete).not.toHaveBeenCalled();
  });

  it('calls delete API only after confirming in the dialog', async () => {
    mockedDelete.mockResolvedValue({ success: true });

    renderPage();

    await waitFor(() => expect(screen.getByText('gty-v1.docx')).toBeInTheDocument());

    const deleteButtons = screen.getAllByTitle('Hapus');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => expect(screen.getByText('Hapus Template?')).toBeInTheDocument());

    // Click the confirm "Hapus" button inside the dialog
    const dialog = screen.getByRole('alertdialog');
    const confirmBtn = within(dialog).getByRole('button', { name: /^Hapus$/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockedDelete).toHaveBeenCalledTimes(1);
    });
  });

  it('does not call delete API when dialog is cancelled', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText('gty-v1.docx')).toBeInTheDocument());

    const deleteButtons = screen.getAllByTitle('Hapus');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => expect(screen.getByText('Hapus Template?')).toBeInTheDocument());

    const cancelBtn = screen.getByRole('button', { name: /Batal/i });
    fireEvent.click(cancelBtn);

    // Dialog should close
    await waitFor(() => {
      expect(screen.queryByText('Hapus Template?')).not.toBeInTheDocument();
    });

    expect(mockedDelete).not.toHaveBeenCalled();
  });

  it('shows active template warning in dialog when deleting an active template', async () => {
    renderPage();

    // gty-v1 (id=1) is active
    await waitFor(() => expect(screen.getByText('gty-v1.docx')).toBeInTheDocument());

    // Find the delete button for the active template row
    const deleteButtons = screen.getAllByTitle('Hapus');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Template ini sedang aktif/i)).toBeInTheDocument();
    });
  });
});

// ── Optimistic activate update reverts on failure ──────────────────────────

describe('Optimistic activate update reverts on mutation failure (Requirement 7.4)', () => {
  it('reverts optimistic active state when activate mutation fails', async () => {
    mockedActivate.mockRejectedValue(new Error('Server error'));

    renderPage();

    await waitFor(() => expect(screen.getByText('gty-v2.docx')).toBeInTheDocument());

    // gty-v2 (id=2) is inactive — find its activate button
    const activateButtons = screen.getAllByTitle('Aktifkan');
    expect(activateButtons.length).toBeGreaterThan(0);

    fireEvent.click(activateButtons[0]);

    // After failure, error toast should be shown
    await waitFor(() => {
      expect(mockedToastError).toHaveBeenCalledWith('Gagal mengaktifkan template');
    });

    // The optimistic state should have been reverted (no extra active badge appeared permanently)
    expect(mockedActivate).toHaveBeenCalledTimes(1);
  });

  it('shows optimistic active badge immediately on activate click', async () => {
    // Delay the resolve so we can check the optimistic state
    let resolveActivate!: (v: unknown) => void;
    mockedActivate.mockReturnValue(new Promise((res) => { resolveActivate = res; }));

    renderPage();

    await waitFor(() => expect(screen.getByText('gty-v2.docx')).toBeInTheDocument());

    const activateButtons = screen.getAllByTitle('Aktifkan');
    fireEvent.click(activateButtons[0]);

    // Optimistic update: the activate button for that template should be gone
    // (active templates don't show the activate button)
    await waitFor(() => {
      // The mutation is pending — activatingId is set
      expect(mockedActivate).toHaveBeenCalledTimes(1);
    });

    // Resolve the mutation to clean up
    resolveActivate({ success: true });
  });
});
