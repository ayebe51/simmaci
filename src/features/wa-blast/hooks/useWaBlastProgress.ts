/**
 * TanStack Query hook for polling WA Blast delivery progress.
 * Feature: wa-blast
 *
 * Automatically polls every 5 seconds when blast_status is 'sending'.
 */

import { useQuery } from '@tanstack/react-query';
import { getBlastProgress } from '../services/waBlastService';
import type { BlastProgress, BlastStatus } from '../types/waBlast.types';

export const WA_BLAST_PROGRESS_QUERY_KEY = 'wa-blast-progress';

interface UseWaBlastProgressOptions {
  /** Current blast status — polling is only active when status is 'sending' */
  blastStatus?: BlastStatus;
}

/**
 * Fetch real-time delivery progress for a blast session.
 * Automatically polls every 5 seconds when blast_status is 'sending'.
 *
 * @param id - Blast session ID
 * @param options - Options including current blast status
 * @returns TanStack Query result with blast progress
 */
export function useWaBlastProgress(id: number, options?: UseWaBlastProgressOptions) {
  const isSending = options?.blastStatus === 'sending';

  return useQuery<BlastProgress>({
    queryKey: [WA_BLAST_PROGRESS_QUERY_KEY, id],
    queryFn: () => getBlastProgress(id),
    enabled: !!id && isSending,
    refetchInterval: isSending ? 5_000 : false, // Poll every 5 seconds when sending
    staleTime: 0, // Always fetch fresh data when polling
  });
}
