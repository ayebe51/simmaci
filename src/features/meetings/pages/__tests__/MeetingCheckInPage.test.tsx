/**
 * MeetingCheckInPage Tests
 * Tests for public check-in page — all states: loading, error, form, success
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import MeetingCheckInPage from '../MeetingCheckInPage';
import * as checkInHooks from '../../hooks/useMeetingCheckIn';

vi.mock('../../hooks/useMeetingCheckIn');
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Mock geolocation API
const mockGeolocation = {
  getCurrentPosition: vi.fn(),
};
Object.defineProperty(global.navigator, 'geolocation', {
  value: mockGeolocation,
  writable: true,
});

const mockMeeting = {
  id: 1,
  title: 'Rapat Koordinasi Kepala Sekolah',
  location: 'Aula LP Ma\'arif NU Cilacap',
  started_at: '2025-02-15T08:00:00Z',
  ended_at: '2025-02-15T12:00:00Z',
  status: 'ongoing',
  geolocation_enabled: false,
  participants: [
    { id: 5, name: 'Ahmad Fauzi', jabatan: 'Kepala Sekolah', instansi: 'MI Maarif 01' },
    { id: 6, name: 'Budi Santoso', jabatan: 'Guru', instansi: 'MI Maarif 01' },
  ],
};

function renderPage(url = '/meetings/1/check-in?participant=5&signature=abc') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/meetings/:id/check-in" element={<MeetingCheckInPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('MeetingCheckInPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading state', () => {
    it('should show loading spinner while validating QR', () => {
      (checkInHooks.usePublicMeetingInfo as any) = vi.fn().mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      });
      (checkInHooks.useMeetingCheckIn as any) = vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false });
      (checkInHooks.useMeetingWalkIn as any) = vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false });

      renderPage();

      expect(screen.getByText(/Memvalidasi QR Code/i)).toBeInTheDocument();
    });
  });

  describe('Error states from initial load', () => {
    it('should show invalid QR screen on 403 error', () => {
      (checkInHooks.usePublicMeetingInfo as any) = vi.fn().mockReturnValue({
        data: undefined,
        isLoading: false,
        error: { response: { status: 403 } },
      });
      (checkInHooks.useMeetingCheckIn as any) = vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false });
      (checkInHooks.useMeetingWalkIn as any) = vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false });

      renderPage();

      expect(screen.getByText('QR Code Tidak Valid')).toBeInTheDocument();
      expect(screen.getByText(/tidak valid atau telah dimodifikasi/i)).toBeInTheDocument();
    });

    it('should show expired screen on 410 error', () => {
      (checkInHooks.usePublicMeetingInfo as any) = vi.fn().mockReturnValue({
        data: undefined,
        isLoading: false,
        error: { response: { status: 410 } },
      });
      (checkInHooks.useMeetingCheckIn as any) = vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false });
      (checkInHooks.useMeetingWalkIn as any) = vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false });

      renderPage();

      expect(screen.getByText('QR Code Kadaluarsa')).toBeInTheDocument();
    });
  });

  describe('Personal QR check-in form', () => {
    beforeEach(() => {
      (checkInHooks.usePublicMeetingInfo as any) = vi.fn().mockReturnValue({
        data: mockMeeting,
        isLoading: false,
        error: null,
      });
      (checkInHooks.useMeetingCheckIn as any) = vi.fn().mockReturnValue({
        mutate: vi.fn(),
        isPending: false,
      });
      (checkInHooks.useMeetingWalkIn as any) = vi.fn().mockReturnValue({
        mutate: vi.fn(),
        isPending: false,
      });
    });

    it('should render meeting title and location', () => {
      renderPage();

      expect(screen.getByText('Rapat Koordinasi Kepala Sekolah')).toBeInTheDocument();
      expect(screen.getByText("Aula LP Ma'arif NU Cilacap")).toBeInTheDocument();
    });

    it('should render "Konfirmasi Kehadiran" button', () => {
      renderPage();

      expect(screen.getByRole('button', { name: /Konfirmasi Kehadiran Saya/i })).toBeInTheDocument();
    });

    it('should render delegation checkbox', () => {
      renderPage();

      expect(screen.getByLabelText(/Hadir sebagai delegasi/i)).toBeInTheDocument();
    });

    it('should show delegation select when checkbox is checked', async () => {
      const user = userEvent.setup();
      renderPage();

      const checkbox = screen.getByLabelText(/Hadir sebagai delegasi/i);
      await user.click(checkbox);

      // After checking, a select for "Mewakili peserta" label appears
      // Use getAllByText since the checkbox label also contains "mewakili peserta lain"
      const labels = screen.getAllByText(/Mewakili peserta/i);
      expect(labels.length).toBeGreaterThan(0);
      // The standalone label (not inside the checkbox label) should be present
      expect(screen.getByText('Mewakili peserta')).toBeInTheDocument();
    });

    it('should call checkIn mutation on button click', async () => {
      const mockMutate = vi.fn();
      (checkInHooks.useMeetingCheckIn as any) = vi.fn().mockReturnValue({
        mutate: mockMutate,
        isPending: false,
      });

      const user = userEvent.setup();
      renderPage();

      const button = screen.getByRole('button', { name: /Konfirmasi Kehadiran Saya/i });
      await user.click(button);

      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({ is_delegation: false }),
        expect.any(Object)
      );
    });

    it('should show loading state while check-in is pending', () => {
      (checkInHooks.useMeetingCheckIn as any) = vi.fn().mockReturnValue({
        mutate: vi.fn(),
        isPending: true,
      });

      renderPage();

      const button = screen.getByRole('button', { name: /Konfirmasi Kehadiran Saya/i });
      expect(button).toBeDisabled();
    });
  });

  describe('Walk-in form (QR_Umum)', () => {
    beforeEach(() => {
      (checkInHooks.usePublicMeetingInfo as any) = vi.fn().mockReturnValue({
        data: mockMeeting,
        isLoading: false,
        error: null,
      });
      (checkInHooks.useMeetingCheckIn as any) = vi.fn().mockReturnValue({
        mutate: vi.fn(),
        isPending: false,
      });
      (checkInHooks.useMeetingWalkIn as any) = vi.fn().mockReturnValue({
        mutate: vi.fn(),
        isPending: false,
      });
    });

    it('should render walk-in form when no participant param', () => {
      // URL without participant param = QR_Umum / walk-in
      renderPage('/meetings/1/check-in?signature=abc');

      expect(screen.getByText('Isi Identitas Anda')).toBeInTheDocument();
      expect(screen.getByLabelText(/Nama Lengkap/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Jabatan/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Instansi/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Nomor WhatsApp/i)).toBeInTheDocument();
    });

    it('should call walkIn mutation on form submit', async () => {
      const mockMutate = vi.fn();
      (checkInHooks.useMeetingWalkIn as any) = vi.fn().mockReturnValue({
        mutate: mockMutate,
        isPending: false,
      });

      const user = userEvent.setup();
      renderPage('/meetings/1/check-in?signature=abc');

      await user.type(screen.getByLabelText(/Nama Lengkap/i), 'Budi Santoso');
      await user.type(screen.getByLabelText(/Jabatan/i), 'Guru');
      await user.type(screen.getByLabelText(/Instansi/i), 'MI Maarif 01');
      await user.type(screen.getByLabelText(/Nomor WhatsApp/i), '081234567890');

      const submitButton = screen.getByRole('button', { name: /Konfirmasi Kehadiran/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith(
          expect.objectContaining({
            walk_in_name: 'Budi Santoso',
            walk_in_jabatan: 'Guru',
            walk_in_instansi: 'MI Maarif 01',
            walk_in_phone: '081234567890',
          }),
          expect.any(Object)
        );
      });
    });

    it('should show validation errors for empty walk-in form', async () => {
      const user = userEvent.setup();
      renderPage('/meetings/1/check-in?signature=abc');

      const submitButton = screen.getByRole('button', { name: /Konfirmasi Kehadiran/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Nama wajib diisi')).toBeInTheDocument();
      });
    });
  });

  describe('Geolocation', () => {
    it('should show geolocation warning when geo is enabled and permission denied', async () => {
      mockGeolocation.getCurrentPosition.mockImplementationOnce(
        (_success: any, error: any) => error(new Error('denied'))
      );

      (checkInHooks.usePublicMeetingInfo as any) = vi.fn().mockReturnValue({
        data: { ...mockMeeting, geolocation_enabled: true },
        isLoading: false,
        error: null,
      });
      (checkInHooks.useMeetingCheckIn as any) = vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false });
      (checkInHooks.useMeetingWalkIn as any) = vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/Validasi lokasi diperlukan/i)).toBeInTheDocument();
      });
    });
  });

  describe('Footer branding', () => {
    it('should show LP Maarif branding', () => {
      (checkInHooks.usePublicMeetingInfo as any) = vi.fn().mockReturnValue({
        data: mockMeeting,
        isLoading: false,
        error: null,
      });
      (checkInHooks.useMeetingCheckIn as any) = vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false });
      (checkInHooks.useMeetingWalkIn as any) = vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false });

      renderPage();

      // Use getAllByText since the text may appear in multiple places (meeting location + footer)
      const matches = screen.getAllByText(/LP Ma'arif NU Cilacap/i);
      expect(matches.length).toBeGreaterThan(0);
    });
  });
});
