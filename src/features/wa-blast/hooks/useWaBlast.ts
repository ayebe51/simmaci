/**
 * TanStack Query hook for fetching a single WA Blast session detail.
 * Feature: wa-blast
 */

import { useQuery } from '@tanstack/react-query';
import { getBlast } from '../services/waBlastService';
import type { WaBlast, WaBlastRecipient } from '../types/waBlast.types';

export const WA_BLAST_DETAIL_QUERY_KEY = 'wa-blast-detail';

/**
 * Fetch detail of a single blast session including its recipients.
 *
 * @param id - Blast session ID
 * @returns TanStack Query result with blast detail and recipients
 */
export function useWaBlast(id: number) {
  return useQuery<WaBlast & { recipients: WaBlastRecipient[] }>({
    queryKey: [WA_BLAST_DETAIL_QUERY_KEY, id],
    queryFn: () => getBlast(id),
    enabled: !!id,
    staleTime: 10_000, // 10 seconds
  });
}
