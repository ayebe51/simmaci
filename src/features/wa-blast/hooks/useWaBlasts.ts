/**
 * TanStack Query hook for fetching paginated list of WA Blast sessions.
 * Feature: wa-blast
 */

import { useQuery } from '@tanstack/react-query';
import { getBlasts } from '../services/waBlastService';
import type { BlastListParams, PaginatedResponse, WaBlast } from '../types/waBlast.types';

export const WA_BLASTS_QUERY_KEY = 'wa-blasts';

/**
 * Fetch paginated list of blast sessions with optional filters.
 *
 * @param params - Filter parameters (status, date_from, date_to, page, per_page)
 * @returns TanStack Query result with paginated blast sessions
 */
export function useWaBlasts(params?: BlastListParams) {
  return useQuery<PaginatedResponse<WaBlast>>({
    queryKey: [WA_BLASTS_QUERY_KEY, params],
    queryFn: () => getBlasts(params),
    staleTime: 30_000, // 30 seconds
  });
}
