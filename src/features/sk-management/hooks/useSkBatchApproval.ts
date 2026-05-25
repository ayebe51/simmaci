import { useCallback, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { skApi } from '@/lib/api';
import { SK_QUERY_KEYS } from '@/features/sk-management/utils/queryKeys';
import { DASHBOARD_QUERY_KEYS } from '@/features/dashboard/utils/queryKeys';

/**
 * Payload for batch SK approval/rejection.
 */
export interface BatchApprovalPayload {
  ids: number[];
  status: 'approved' | 'rejected';
  rejection_reason?: string;
}

/**
 * Response shape from the batch approval API.
 */
export interface BatchApprovalResponse {
  count: number;
  failed: { id: number; reason: string }[];
}

/**
 * Helper to optimistically update SK document statuses in the query cache.
 * Handles both array and paginated response shapes.
 */
function updateSkStatus(
  old: unknown,
  ids: number[],
  status: string
): unknown {
  if (!old) return old;

  const idSet = new Set(ids);

  // Handle paginated response: { data: [...], total, per_page, current_page }
  if (typeof old === 'object' && old !== null && 'data' in old && Array.isArray((old as any).data)) {
    return {
      ...(old as any),
      data: (old as any).data.map((item: any) =>
        idSet.has(item.id) ? { ...item, status } : item
      ),
    };
  }

  // Handle flat array response
  if (Array.isArray(old)) {
    return old.map((item: any) =>
      idSet.has(item.id) ? { ...item, status } : item
    );
  }

  return old;
}

/**
 * Custom hook for batch SK approval with optimistic updates.
 *
 * Features:
 * - Optimistic cache update on mutate (instant UI feedback)
 * - Rollback to previous state on server error
 * - Sonner toast error notification (5s duration)
 * - Invalidates SK and dashboard query keys on success
 * - Prevents duplicate submissions for in-flight mutation IDs
 *
 * @see Requirements 8.1, 8.2, 8.3, 8.4, 8.5
 */
export function useSkBatchApproval() {
  const queryClient = useQueryClient();
  const inFlightIds = useRef<Set<number>>(new Set());

  const mutation = useMutation<BatchApprovalResponse, Error, BatchApprovalPayload, { previous: unknown }>({
    mutationFn: (payload: BatchApprovalPayload) => {
      return skApi.batchUpdateStatus(payload.ids, payload.status, payload.rejection_reason);
    },

    onMutate: async (payload) => {
      // Track in-flight IDs
      payload.ids.forEach((id) => inFlightIds.current.add(id));

      // Cancel outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: SK_QUERY_KEYS.all });

      // Snapshot previous value for rollback
      const previous = queryClient.getQueryData(SK_QUERY_KEYS.all);

      // Optimistically update the cache
      queryClient.setQueriesData(
        { queryKey: SK_QUERY_KEYS.all },
        (old: unknown) => updateSkStatus(old, payload.ids, payload.status)
      );

      return { previous };
    },

    onError: (_err, payload, context) => {
      // Rollback to previous state
      if (context?.previous !== undefined) {
        queryClient.setQueryData(SK_QUERY_KEYS.all, context.previous);
      }

      // Remove from in-flight tracking
      payload.ids.forEach((id) => inFlightIds.current.delete(id));

      // Show error toast for 5 seconds
      toast.error('Gagal memproses persetujuan SK', {
        duration: 5000,
      });
    },

    onSuccess: (_response, payload) => {
      // Remove from in-flight tracking
      payload.ids.forEach((id) => inFlightIds.current.delete(id));

      // Invalidate SK-related queries to reconcile with server state
      queryClient.invalidateQueries({ queryKey: SK_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: SK_QUERY_KEYS.pending });
      queryClient.invalidateQueries({ queryKey: SK_QUERY_KEYS.revisions });

      // Invalidate dashboard queries
      queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEYS.stats });
      queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEYS.schoolStats });
      queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEYS.charts });
    },

    onSettled: (_data, _error, payload) => {
      // Safety net: ensure IDs are always cleaned up from in-flight set
      if (payload) {
        payload.ids.forEach((id) => inFlightIds.current.delete(id));
      }
    },
  });

  /**
   * Check if a specific SK document ID is currently in-flight.
   */
  const isIdInFlight = useCallback((id: number): boolean => {
    return inFlightIds.current.has(id);
  }, []);

  /**
   * Check if any of the given IDs are currently in-flight.
   */
  const hasInFlightIds = useCallback((ids: number[]): boolean => {
    return ids.some((id) => inFlightIds.current.has(id));
  }, []);

  /**
   * Submit a batch approval, preventing duplicate submissions.
   * If any of the provided IDs are already in-flight, those IDs are filtered out.
   * If all IDs are already in-flight, the mutation is not triggered.
   */
  const submitApproval = useCallback((payload: BatchApprovalPayload) => {
    // Filter out IDs that are already in-flight
    const newIds = payload.ids.filter((id) => !inFlightIds.current.has(id));
    if (newIds.length === 0) {
      return; // All IDs are already being processed
    }

    mutation.mutate({ ...payload, ids: newIds });
  }, [mutation]);

  return {
    ...mutation,
    /** Use this instead of `mutate` to get duplicate submission prevention */
    submitApproval,
    mutate: mutation.mutate,
    isIdInFlight,
    hasInFlightIds,
  };
}
