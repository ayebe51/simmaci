import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useSkBatchApproval } from './useSkBatchApproval';
import { SK_QUERY_KEYS } from '@/features/sk-management/utils/queryKeys';
import { DASHBOARD_QUERY_KEYS } from '@/features/dashboard/utils/queryKeys';

// Mock dependencies
vi.mock('@/lib/api', () => ({
  skApi: {
    batchUpdateStatus: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { skApi } from '@/lib/api';
import { toast } from 'sonner';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return {
    queryClient,
    wrapper: ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children),
  };
}

describe('useSkBatchApproval', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should optimistically update cache with flat array on mutate', async () => {
    const { queryClient, wrapper } = createWrapper();
    const mockData = [
      { id: 1, nama: 'Test 1', status: 'pending' },
      { id: 2, nama: 'Test 2', status: 'pending' },
    ];

    queryClient.setQueryData(SK_QUERY_KEYS.all, mockData);
    (skApi.batchUpdateStatus as any).mockResolvedValue({ count: 1, failed: [] });

    const { result } = renderHook(() => useSkBatchApproval(), { wrapper });

    act(() => {
      result.current.mutate({ ids: [1], status: 'approved' });
    });

    // Cache should be optimistically updated before server responds
    await waitFor(() => {
      const cached = queryClient.getQueryData(SK_QUERY_KEYS.all) as any[];
      expect(cached[0].status).toBe('approved');
      expect(cached[1].status).toBe('pending');
    });
  });

  it('should optimistically update cache with paginated shape', async () => {
    const { queryClient, wrapper } = createWrapper();
    const paginatedData = {
      data: [
        { id: 1, nama: 'Test 1', status: 'pending' },
        { id: 2, nama: 'Test 2', status: 'pending' },
      ],
      total: 2,
      per_page: 25,
      current_page: 1,
    };

    queryClient.setQueryData(SK_QUERY_KEYS.all, paginatedData);
    (skApi.batchUpdateStatus as any).mockResolvedValue({ count: 1, failed: [] });

    const { result } = renderHook(() => useSkBatchApproval(), { wrapper });

    act(() => {
      result.current.mutate({ ids: [1], status: 'approved' });
    });

    await waitFor(() => {
      const cached = queryClient.getQueryData(SK_QUERY_KEYS.all) as any;
      expect(cached.data[0].status).toBe('approved');
      expect(cached.data[1].status).toBe('pending');
      expect(cached.total).toBe(2);
    });
  });

  it('should rollback cache on error and show toast with 5s duration', async () => {
    const { queryClient, wrapper } = createWrapper();
    const mockData = [
      { id: 1, nama: 'Test 1', status: 'pending' },
    ];

    queryClient.setQueryData(SK_QUERY_KEYS.all, mockData);
    (skApi.batchUpdateStatus as any).mockRejectedValue(new Error('Server error'));

    const { result } = renderHook(() => useSkBatchApproval(), { wrapper });

    act(() => {
      result.current.mutate({ ids: [1], status: 'approved' });
    });

    // Wait for the mutation to complete with error
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Cache should be rolled back to original state
    const cached = queryClient.getQueryData(SK_QUERY_KEYS.all) as any[];
    expect(cached[0].status).toBe('pending');

    // Toast should be shown with correct params
    expect(toast.error).toHaveBeenCalledWith('Gagal memproses persetujuan SK', {
      duration: 5000,
    });
  });

  it('should invalidate SK and dashboard queries on success', async () => {
    const { queryClient, wrapper } = createWrapper();

    queryClient.setQueryData(SK_QUERY_KEYS.all, [{ id: 1, status: 'pending' }]);
    queryClient.setQueryData(SK_QUERY_KEYS.pending, [{ id: 1 }]);
    queryClient.setQueryData(DASHBOARD_QUERY_KEYS.stats, { total: 10 });

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    (skApi.batchUpdateStatus as any).mockResolvedValue({ count: 1, failed: [] });

    const { result } = renderHook(() => useSkBatchApproval(), { wrapper });

    act(() => {
      result.current.mutate({ ids: [1], status: 'approved' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Verify invalidation calls for SK queries
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: SK_QUERY_KEYS.all });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: SK_QUERY_KEYS.pending });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: SK_QUERY_KEYS.revisions });

    // Verify invalidation calls for dashboard queries
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: DASHBOARD_QUERY_KEYS.stats });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: DASHBOARD_QUERY_KEYS.schoolStats });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: DASHBOARD_QUERY_KEYS.charts });
  });

  it('should prevent duplicate submissions via submitApproval', async () => {
    const { queryClient, wrapper } = createWrapper();

    queryClient.setQueryData(SK_QUERY_KEYS.all, [
      { id: 1, status: 'pending' },
      { id: 2, status: 'pending' },
    ]);

    let resolveFirst: (value: any) => void;
    const firstPromise = new Promise((resolve) => {
      resolveFirst = resolve;
    });

    (skApi.batchUpdateStatus as any).mockImplementation(() => firstPromise);

    const { result } = renderHook(() => useSkBatchApproval(), { wrapper });

    // First submission via submitApproval
    act(() => {
      result.current.submitApproval({ ids: [1, 2], status: 'approved' });
    });

    // Wait for mutation to be in-flight
    await waitFor(() => {
      expect(skApi.batchUpdateStatus).toHaveBeenCalledTimes(1);
    });

    // IDs should be tracked as in-flight
    expect(result.current.isIdInFlight(1)).toBe(true);
    expect(result.current.isIdInFlight(2)).toBe(true);

    // Second submission with same IDs — should be blocked
    act(() => {
      result.current.submitApproval({ ids: [1, 2], status: 'approved' });
    });

    // Still only one API call
    expect(skApi.batchUpdateStatus).toHaveBeenCalledTimes(1);

    // Resolve the first mutation
    await act(async () => {
      resolveFirst!({ count: 2, failed: [] });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // IDs should be cleared
    expect(result.current.isIdInFlight(1)).toBe(false);
    expect(result.current.isIdInFlight(2)).toBe(false);
  });

  it('should clear in-flight IDs after mutation settles', async () => {
    const { queryClient, wrapper } = createWrapper();

    queryClient.setQueryData(SK_QUERY_KEYS.all, [
      { id: 1, status: 'pending' },
      { id: 2, status: 'pending' },
    ]);

    (skApi.batchUpdateStatus as any).mockResolvedValue({ count: 2, failed: [] });

    const { result } = renderHook(() => useSkBatchApproval(), { wrapper });

    act(() => {
      result.current.mutate({ ids: [1, 2], status: 'approved' });
    });

    // After success, IDs should be cleared
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // IDs should no longer be in-flight
    expect(result.current.isIdInFlight(1)).toBe(false);
    expect(result.current.isIdInFlight(2)).toBe(false);
    expect(result.current.hasInFlightIds([1, 2])).toBe(false);
  });
});
