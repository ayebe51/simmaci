/**
 * MeetingListPage Tests
 * Tests for meeting list page rendering, filtering, and navigation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import MeetingListPage from '../MeetingListPage';
import * as useMeetingsHook from '../../hooks/useMeetings';

vi.mock('../../hooks/useMeetings');
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

const mockUseMeetings = useMeetingsHook.useMeetings as ReturnType<typeof vi.fn>;

const mockMeetings = [
  {
    id: 1,
    title: 'Rapat Koordinasi Kepala Sekolah',
    status: 'upcoming' as const,
    started_at: '2025-02-15T08:00:00Z',
    ended_at: '2025-02-15T12:00:00Z',
    location: 'Aula LP Ma\'arif NU Cilacap',
    attendance_stats: { total: 10, present: 0, absent: 10, delegation: 0, walk_in: 0, percentage: 0 },
  },
  {
    id: 2,
    title: 'Rapat Evaluasi Semester',
    status: 'completed' as const,
    started_at: '2025-01-10T08:00:00Z',
    ended_at: '2025-01-10T12:00:00Z',
    location: 'Ruang Rapat',
    attendance_stats: { total: 8, present: 7, absent: 1, delegation: 0, walk_in: 0, percentage: 87 },
  },
];

function renderPage(userRole = 'super_admin') {
  localStorage.setItem('user_data', JSON.stringify({ role: userRole, name: 'Admin' }));
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MeetingListPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('MeetingListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('Loading state', () => {
    it('should show skeleton cards while loading', () => {
      (useMeetingsHook.useMeetings as any) = vi.fn().mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
      });

      renderPage();

      // Skeleton cards have animate-pulse class
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Error state', () => {
    it('should show error message on failure', () => {
      (useMeetingsHook.useMeetings as any) = vi.fn().mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
      });

      renderPage();

      expect(screen.getByText(/Gagal memuat daftar rapat/i)).toBeInTheDocument();
    });
  });

  describe('Empty state', () => {
    it('should show empty state when no meetings', () => {
      (useMeetingsHook.useMeetings as any) = vi.fn().mockReturnValue({
        data: { data: [], last_page: 1 },
        isLoading: false,
        isError: false,
      });

      renderPage();

      expect(screen.getByText(/Belum ada rapat/i)).toBeInTheDocument();
    });

    it('should show create hint for admin in empty state', () => {
      (useMeetingsHook.useMeetings as any) = vi.fn().mockReturnValue({
        data: { data: [], last_page: 1 },
        isLoading: false,
        isError: false,
      });

      renderPage('super_admin');

      expect(screen.getByText(/Klik "Buat Rapat"/i)).toBeInTheDocument();
    });
  });

  describe('Meeting list rendering', () => {
    beforeEach(() => {
      (useMeetingsHook.useMeetings as any) = vi.fn().mockReturnValue({
        data: { data: mockMeetings, last_page: 1 },
        isLoading: false,
        isError: false,
      });
    });

    it('should render meeting titles', () => {
      renderPage();

      expect(screen.getByText('Rapat Koordinasi Kepala Sekolah')).toBeInTheDocument();
      expect(screen.getByText('Rapat Evaluasi Semester')).toBeInTheDocument();
    });

    it('should render meeting locations', () => {
      renderPage();

      expect(screen.getByText("Aula LP Ma'arif NU Cilacap")).toBeInTheDocument();
      expect(screen.getByText('Ruang Rapat')).toBeInTheDocument();
    });

    it('should render attendance stats', () => {
      renderPage();

      // Meeting 1: 0/10 hadir
      expect(screen.getByText(/0 \/ 10 hadir/)).toBeInTheDocument();
      // Meeting 2: 7/8 hadir with percentage
      expect(screen.getByText(/7 \/ 8 hadir/)).toBeInTheDocument();
      expect(screen.getByText('(87%)')).toBeInTheDocument();
    });

    it('should render status badges', () => {
      renderPage();

      expect(screen.getByText('Akan Datang')).toBeInTheDocument();
      expect(screen.getByText('Selesai')).toBeInTheDocument();
    });

    it('should render "Lihat Detail" buttons for each meeting', () => {
      renderPage();

      const detailButtons = screen.getAllByRole('button', { name: /Lihat Detail/i });
      expect(detailButtons).toHaveLength(2);
    });
  });

  describe('Admin controls', () => {
    it('should show "Buat Rapat" button for super_admin', () => {
      (useMeetingsHook.useMeetings as any) = vi.fn().mockReturnValue({
        data: { data: [], last_page: 1 },
        isLoading: false,
        isError: false,
      });

      renderPage('super_admin');

      expect(screen.getByRole('button', { name: /Buat Rapat/i })).toBeInTheDocument();
    });

    it('should show "Buat Rapat" button for admin_yayasan', () => {
      (useMeetingsHook.useMeetings as any) = vi.fn().mockReturnValue({
        data: { data: [], last_page: 1 },
        isLoading: false,
        isError: false,
      });

      renderPage('admin_yayasan');

      expect(screen.getByRole('button', { name: /Buat Rapat/i })).toBeInTheDocument();
    });

    it('should NOT show "Buat Rapat" button for operator', () => {
      (useMeetingsHook.useMeetings as any) = vi.fn().mockReturnValue({
        data: { data: [], last_page: 1 },
        isLoading: false,
        isError: false,
      });

      renderPage('operator');

      expect(screen.queryByRole('button', { name: /Buat Rapat/i })).not.toBeInTheDocument();
    });
  });

  describe('Filters', () => {
    it('should render search input', () => {
      (useMeetingsHook.useMeetings as any) = vi.fn().mockReturnValue({
        data: { data: [], last_page: 1 },
        isLoading: false,
        isError: false,
      });

      renderPage();

      expect(screen.getByPlaceholderText(/Cari judul rapat/i)).toBeInTheDocument();
    });

    it('should render status filter select', () => {
      (useMeetingsHook.useMeetings as any) = vi.fn().mockReturnValue({
        data: { data: [], last_page: 1 },
        isLoading: false,
        isError: false,
      });

      renderPage();

      // The select trigger shows the current value label
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });
  });

  describe('Pagination', () => {
    it('should show pagination when last_page > 1', () => {
      (useMeetingsHook.useMeetings as any) = vi.fn().mockReturnValue({
        data: { data: mockMeetings, last_page: 3 },
        isLoading: false,
        isError: false,
      });

      renderPage();

      expect(screen.getByText(/Halaman 1 dari 3/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Berikutnya/i })).toBeInTheDocument();
    });

    it('should NOT show pagination when last_page is 1', () => {
      (useMeetingsHook.useMeetings as any) = vi.fn().mockReturnValue({
        data: { data: mockMeetings, last_page: 1 },
        isLoading: false,
        isError: false,
      });

      renderPage();

      expect(screen.queryByText(/Halaman/)).not.toBeInTheDocument();
    });

    it('should disable "Sebelumnya" on first page', () => {
      (useMeetingsHook.useMeetings as any) = vi.fn().mockReturnValue({
        data: { data: mockMeetings, last_page: 3 },
        isLoading: false,
        isError: false,
      });

      renderPage();

      const prevButton = screen.getByRole('button', { name: /Sebelumnya/i });
      expect(prevButton).toBeDisabled();
    });
  });

  describe('Page header', () => {
    it('should render page title', () => {
      (useMeetingsHook.useMeetings as any) = vi.fn().mockReturnValue({
        data: { data: [], last_page: 1 },
        isLoading: false,
        isError: false,
      });

      renderPage();

      expect(screen.getByText('Rapat Yayasan')).toBeInTheDocument();
    });

    it('should render page subtitle', () => {
      (useMeetingsHook.useMeetings as any) = vi.fn().mockReturnValue({
        data: { data: [], last_page: 1 },
        isLoading: false,
        isError: false,
      });

      renderPage();

      expect(screen.getByText(/Kelola rapat dan absensi peserta/i)).toBeInTheDocument();
    });
  });
});
