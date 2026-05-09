/**
 * useMeetingAttendance Hook Tests
 * Tests for real-time polling hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useMeetingAttendance } from '../useMeetingAttendance';
import { meetingService } from '../../services/meetingService';

vi.mock('../../services/meetingService');

const mockMeetingService = meetingService as typeof meetingService & {
  getById: ReturnType<typeof vi.fn>;
};

const mockMeeting = {
  id: 1,
  title: 'Rapat Koordinasi',
  status: 'ongoing',
  attendance_stats: { total: 10, present: 4, absent: 6, delegation: 1, walk_in: 0, percentage: 40 },
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useMeetingAttendance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch meeting data for attendance', async () => {
    mockMeetingService.getById = vi.fn().mockResolvedValueOnce(mockMeeting);

    const { result } = renderHook(() => useMeetingAttendance(1), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.attendance_stats.total).toBe(10);
    expect(result.current.data?.attendance_stats.present).toBe(4);
    expect(mockMeetingService.getById).toHaveBeenCalledWith(1);
  });

  it('should not fetch when meetingId is null', () => {
    mockMeetingService.getById = vi.fn();

    const { result } = renderHook(() => useMeetingAttendance(null), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(false);
    expect(mockMeetingService.getById).not.toHaveBeenCalled();
  });

  it('should use meeting-attendance query key', async () => {
    mockMeetingService.getById = vi.fn().mockResolvedValueOnce(mockMeeting);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    renderHook(() => useMeetingAttendance(1), { wrapper });

    await waitFor(() => {
      const cache = queryClient.getQueryCache().findAll({ queryKey: ['meeting-attendance', 1] });
      expect(cache.length).toBeGreaterThan(0);
    });
  });

  it('should set isError on failure', async () => {
    mockMeetingService.getById = vi.fn().mockRejectedValueOnce(new Error('Server error'));

    const { result } = renderHook(() => useMeetingAttendance(1), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
