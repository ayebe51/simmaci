/**
 * useMeetings Hook Tests
 * Tests for list, create, update, delete meeting mutations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useMeetings, useCreateMeeting, useUpdateMeeting, useDeleteMeeting } from '../useMeetings';
import { meetingService } from '../../services/meetingService';

vi.mock('../../services/meetingService');
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockMeetingService = meetingService as typeof meetingService & {
  list: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

const mockPaginatedResponse = {
  data: [
    {
      id: 1,
      title: 'Rapat Koordinasi',
      status: 'upcoming',
      started_at: '2025-02-15T08:00:00Z',
      ended_at: '2025-02-15T12:00:00Z',
      location: 'Aula',
      attendance_stats: { total: 5, present: 0, absent: 5, delegation: 0, walk_in: 0, percentage: 0 },
    },
  ],
  current_page: 1,
  last_page: 1,
  per_page: 20,
  total: 1,
  from: 1,
  to: 1,
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useMeetings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch meetings list successfully', async () => {
    mockMeetingService.list = vi.fn().mockResolvedValueOnce(mockPaginatedResponse);

    const { result } = renderHook(() => useMeetings(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(1);
    expect(result.current.data?.data[0].title).toBe('Rapat Koordinasi');
  });

  it('should pass params to meetingService.list', async () => {
    mockMeetingService.list = vi.fn().mockResolvedValueOnce(mockPaginatedResponse);

    const params = { status: 'upcoming' as const, page: 1 };
    renderHook(() => useMeetings(params), { wrapper: createWrapper() });

    await waitFor(() => expect(mockMeetingService.list).toHaveBeenCalledWith(params));
  });

  it('should set isLoading true initially', () => {
    mockMeetingService.list = vi.fn().mockReturnValue(new Promise(() => {})); // never resolves

    const { result } = renderHook(() => useMeetings(), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(true);
  });

  it('should set isError true on failure', async () => {
    mockMeetingService.list = vi.fn().mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useMeetings(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCreateMeeting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call meetingService.create with payload', async () => {
    const newMeeting = { id: 2, title: 'Rapat Baru', status: 'upcoming' };
    mockMeetingService.create = vi.fn().mockResolvedValueOnce(newMeeting);

    const { result } = renderHook(() => useCreateMeeting(), { wrapper: createWrapper() });

    const payload = {
      title: 'Rapat Baru',
      location: 'Aula',
      started_at: '2025-03-01T08:00:00Z',
      ended_at: '2025-03-01T12:00:00Z',
      school_ids: [],
      geolocation_enabled: false,
      participants: [],
      send_invitation_wa: false,
      send_reminder_wa: false,
    };

    await act(async () => {
      result.current.mutate(payload);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockMeetingService.create).toHaveBeenCalledWith(payload);
  });

  it('should set isError on failure', async () => {
    mockMeetingService.create = vi.fn().mockRejectedValueOnce({
      response: { data: { message: 'Validasi gagal' } },
    });

    const { result } = renderHook(() => useCreateMeeting(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.mutate({
        title: '',
        location: '',
        started_at: '',
        ended_at: '',
        school_ids: [],
        geolocation_enabled: false,
        participants: [],
        send_invitation_wa: false,
        send_reminder_wa: false,
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateMeeting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call meetingService.update with id and payload', async () => {
    const updatedMeeting = { id: 1, title: 'Updated Title' };
    mockMeetingService.update = vi.fn().mockResolvedValueOnce(updatedMeeting);

    const { result } = renderHook(() => useUpdateMeeting(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.mutate({ id: 1, payload: { title: 'Updated Title' } });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockMeetingService.update).toHaveBeenCalledWith(1, { title: 'Updated Title' });
  });
});

describe('useDeleteMeeting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call meetingService.delete with id', async () => {
    mockMeetingService.delete = vi.fn().mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useDeleteMeeting(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.mutate(1);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockMeetingService.delete).toHaveBeenCalledWith(1);
  });
});
