/**
 * useMeetingCheckIn Hook Tests
 * Tests for public check-in and walk-in mutations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  usePublicMeetingInfo,
  useMeetingCheckIn,
  useMeetingWalkIn,
} from '../useMeetingCheckIn';
import { meetingService } from '../../services/meetingService';

vi.mock('../../services/meetingService');
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockMeetingService = meetingService as typeof meetingService & {
  validateCheckInUrl: ReturnType<typeof vi.fn>;
  checkIn: ReturnType<typeof vi.fn>;
  walkIn: ReturnType<typeof vi.fn>;
};

const mockMeeting = {
  id: 1,
  title: 'Rapat Koordinasi',
  location: 'Aula',
  started_at: '2025-02-15T08:00:00Z',
  ended_at: '2025-02-15T12:00:00Z',
  status: 'ongoing',
  geolocation_enabled: false,
  participants: [
    { id: 5, name: 'Ahmad Fauzi', jabatan: 'Kepala Sekolah', instansi: 'MI Maarif 01' },
  ],
};

const mockCheckInResponse = {
  success: true,
  message: 'Check-in berhasil',
  data: {
    attendance_id: 10,
    participant_name: 'Ahmad Fauzi',
    checked_in_at: '2025-02-15T09:00:00.123456Z',
    device_info: { browser: 'Chrome', device_type: 'mobile', os: 'Android', os_version: '13', browser_version: '120', user_agent: 'Mozilla/5.0' },
    is_delegation: false,
  },
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('usePublicMeetingInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch meeting info for check-in page', async () => {
    mockMeetingService.validateCheckInUrl = vi.fn().mockResolvedValueOnce(mockMeeting);

    const { result } = renderHook(
      () => usePublicMeetingInfo('1', 'participant=5&signature=abc'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.id).toBe(1);
    expect(result.current.data?.title).toBe('Rapat Koordinasi');
    expect(mockMeetingService.validateCheckInUrl).toHaveBeenCalledWith('1', 'participant=5&signature=abc');
  });

  it('should not fetch when meetingId is undefined', () => {
    mockMeetingService.validateCheckInUrl = vi.fn();

    const { result } = renderHook(
      () => usePublicMeetingInfo(undefined, 'signature=abc'),
      { wrapper: createWrapper() }
    );

    expect(result.current.isLoading).toBe(false);
    expect(mockMeetingService.validateCheckInUrl).not.toHaveBeenCalled();
  });

  it('should not retry on error (signed URL errors should not be retried)', async () => {
    const error = { response: { status: 403, data: { message: 'Invalid signature' } } };
    mockMeetingService.validateCheckInUrl = vi.fn().mockRejectedValueOnce(error);

    const { result } = renderHook(
      () => usePublicMeetingInfo('1', 'signature=invalid'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    // retry: false means it should only be called once
    expect(mockMeetingService.validateCheckInUrl).toHaveBeenCalledTimes(1);
  });
});

describe('useMeetingCheckIn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call meetingService.checkIn with payload', async () => {
    mockMeetingService.checkIn = vi.fn().mockResolvedValueOnce(mockCheckInResponse);

    const { result } = renderHook(
      () => useMeetingCheckIn('1', 'participant=5&signature=abc'),
      { wrapper: createWrapper() }
    );

    const payload = { is_delegation: false };

    await act(async () => {
      result.current.mutate(payload);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockMeetingService.checkIn).toHaveBeenCalledWith('1', 'participant=5&signature=abc', payload);
    expect(result.current.data?.data.participant_name).toBe('Ahmad Fauzi');
  });

  it('should call meetingService.checkIn with delegation payload', async () => {
    mockMeetingService.checkIn = vi.fn().mockResolvedValueOnce({
      ...mockCheckInResponse,
      data: { ...mockCheckInResponse.data, is_delegation: true, delegated_for_name: 'Budi' },
    });

    const { result } = renderHook(
      () => useMeetingCheckIn('1', 'participant=5&signature=abc'),
      { wrapper: createWrapper() }
    );

    const payload = { is_delegation: true, delegated_for_participant_id: 3 };

    await act(async () => {
      result.current.mutate(payload);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockMeetingService.checkIn).toHaveBeenCalledWith('1', 'participant=5&signature=abc', payload);
  });

  it('should handle 409 already checked-in error', async () => {
    const { toast } = await import('sonner');
    mockMeetingService.checkIn = vi.fn().mockRejectedValueOnce({
      response: { status: 409, data: { message: 'Anda sudah check-in pada 09:00' } },
    });

    const { result } = renderHook(
      () => useMeetingCheckIn('1', 'participant=5&signature=abc'),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      result.current.mutate({ is_delegation: false });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('Anda sudah check-in pada 09:00');
  });

  it('should handle 410 expired token error', async () => {
    const { toast } = await import('sonner');
    mockMeetingService.checkIn = vi.fn().mockRejectedValueOnce({
      response: { status: 410, data: { message: 'QR Code sudah tidak berlaku' } },
    });

    const { result } = renderHook(
      () => useMeetingCheckIn('1', 'participant=5&signature=abc'),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      result.current.mutate({ is_delegation: false });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('QR Code sudah tidak berlaku');
  });

  it('should handle 429 rate limit error', async () => {
    const { toast } = await import('sonner');
    mockMeetingService.checkIn = vi.fn().mockRejectedValueOnce({
      response: { status: 429, data: { message: 'Terlalu banyak percobaan' } },
    });

    const { result } = renderHook(
      () => useMeetingCheckIn('1', 'participant=5&signature=abc'),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      result.current.mutate({ is_delegation: false });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('Terlalu banyak percobaan');
  });
});

describe('useMeetingWalkIn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call meetingService.walkIn with walk-in payload', async () => {
    const walkInResponse = {
      success: true,
      message: 'Check-in berhasil',
      data: {
        attendance_id: 11,
        participant_name: 'Budi Santoso',
        checked_in_at: '2025-02-15T09:30:00Z',
        device_info: null,
        is_delegation: false,
      },
    };
    mockMeetingService.walkIn = vi.fn().mockResolvedValueOnce(walkInResponse);

    const { result } = renderHook(
      () => useMeetingWalkIn('1', 'signature=abc'),
      { wrapper: createWrapper() }
    );

    const payload = {
      walk_in_name: 'Budi Santoso',
      walk_in_jabatan: 'Guru',
      walk_in_instansi: 'MI Maarif 01',
      walk_in_phone: '081234567890',
    };

    await act(async () => {
      result.current.mutate(payload);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockMeetingService.walkIn).toHaveBeenCalledWith('1', 'signature=abc', payload);
    expect(result.current.data?.data.participant_name).toBe('Budi Santoso');
  });

  it('should handle walk-in error', async () => {
    const { toast } = await import('sonner');
    mockMeetingService.walkIn = vi.fn().mockRejectedValueOnce({
      response: { status: 422, data: { message: 'Nomor WA tidak valid' } },
    });

    const { result } = renderHook(
      () => useMeetingWalkIn('1', 'signature=abc'),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      result.current.mutate({
        walk_in_name: 'Budi',
        walk_in_jabatan: 'Guru',
        walk_in_instansi: 'MI',
        walk_in_phone: 'invalid',
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('Nomor WA tidak valid');
  });
});
