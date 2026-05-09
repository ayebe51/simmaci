/**
 * useMeeting Hook Tests
 * Tests for single meeting detail and participant action mutations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useMeeting,
  useManualCheckIn,
  useResetCheckIn,
  useRegenerateQr,
  useDownloadMeetingPdf,
  useDownloadMeetingExcel,
} from '../useMeeting';
import { meetingService } from '../../services/meetingService';

vi.mock('../../services/meetingService');
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockMeetingService = meetingService as typeof meetingService & {
  getById: ReturnType<typeof vi.fn>;
  manualCheckIn: ReturnType<typeof vi.fn>;
  resetCheckIn: ReturnType<typeof vi.fn>;
  regenerateQr: ReturnType<typeof vi.fn>;
  downloadPdf: ReturnType<typeof vi.fn>;
  downloadExcel: ReturnType<typeof vi.fn>;
};

const mockMeeting = {
  id: 1,
  title: 'Rapat Koordinasi',
  status: 'ongoing',
  started_at: '2025-02-15T08:00:00Z',
  ended_at: '2025-02-15T12:00:00Z',
  location: 'Aula',
  attendance_stats: { total: 5, present: 2, absent: 3, delegation: 0, walk_in: 0, percentage: 40 },
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useMeeting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch meeting by id', async () => {
    mockMeetingService.getById = vi.fn().mockResolvedValueOnce(mockMeeting);

    const { result } = renderHook(() => useMeeting(1), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.id).toBe(1);
    expect(result.current.data?.title).toBe('Rapat Koordinasi');
    expect(mockMeetingService.getById).toHaveBeenCalledWith(1);
  });

  it('should not fetch when id is null', () => {
    mockMeetingService.getById = vi.fn();

    const { result } = renderHook(() => useMeeting(null), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(false);
    expect(mockMeetingService.getById).not.toHaveBeenCalled();
  });

  it('should set isError on failure', async () => {
    mockMeetingService.getById = vi.fn().mockRejectedValueOnce(new Error('Not found'));

    const { result } = renderHook(() => useMeeting(999), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useManualCheckIn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call meetingService.manualCheckIn with correct ids', async () => {
    mockMeetingService.manualCheckIn = vi.fn().mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useManualCheckIn(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.mutate({ meetingId: 1, participantId: 5 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockMeetingService.manualCheckIn).toHaveBeenCalledWith(1, 5);
  });
});

describe('useResetCheckIn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call meetingService.resetCheckIn with correct ids', async () => {
    mockMeetingService.resetCheckIn = vi.fn().mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useResetCheckIn(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.mutate({ meetingId: 1, participantId: 5 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockMeetingService.resetCheckIn).toHaveBeenCalledWith(1, 5);
  });
});

describe('useRegenerateQr', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call meetingService.regenerateQr with correct ids', async () => {
    mockMeetingService.regenerateQr = vi.fn().mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useRegenerateQr(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.mutate({ meetingId: 1, participantId: 5 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockMeetingService.regenerateQr).toHaveBeenCalledWith(1, 5);
  });
});

describe('useDownloadMeetingPdf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
  });

  it('should call meetingService.downloadPdf and trigger download', async () => {
    const mockBlob = new Blob(['pdf'], { type: 'application/pdf' });
    mockMeetingService.downloadPdf = vi.fn().mockResolvedValueOnce(mockBlob);

    // Spy on click without mocking createElement (avoids infinite recursion)
    const clickSpy = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string, ...args: any[]) => {
      const el = originalCreateElement(tag, ...args);
      if (tag === 'a') vi.spyOn(el as HTMLAnchorElement, 'click').mockImplementation(clickSpy);
      return el;
    });

    const { result } = renderHook(() => useDownloadMeetingPdf(), { wrapper: createWrapper() });

    await act(async () => { result.current.mutate(1); });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockMeetingService.downloadPdf).toHaveBeenCalledWith(1);
    expect(global.URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
    vi.restoreAllMocks();
  });
});

describe('useDownloadMeetingExcel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
  });

  it('should call meetingService.downloadExcel and trigger download', async () => {
    const mockBlob = new Blob(['excel'], { type: 'application/vnd.ms-excel' });
    mockMeetingService.downloadExcel = vi.fn().mockResolvedValueOnce(mockBlob);

    const clickSpy = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string, ...args: any[]) => {
      const el = originalCreateElement(tag, ...args);
      if (tag === 'a') vi.spyOn(el as HTMLAnchorElement, 'click').mockImplementation(clickSpy);
      return el;
    });

    const { result } = renderHook(() => useDownloadMeetingExcel(), { wrapper: createWrapper() });

    await act(async () => { result.current.mutate(1); });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockMeetingService.downloadExcel).toHaveBeenCalledWith(1);
    expect(global.URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
    vi.restoreAllMocks();
  });
});
