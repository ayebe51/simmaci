/**
 * TanStack Query hooks for WA Blast Go-WA Gateway configuration.
 * Feature: wa-blast
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getConfig, saveConfig, testConnection } from '../services/waBlastConfigService';
import type { WaBlastConfig, SaveConfigPayload } from '../types/waBlast.types';

export const WA_BLAST_CONFIG_QUERY_KEY = 'wa-blast-config';

/**
 * Fetch the current Go-WA Gateway configuration.
 * Note: API token is masked as '***' in the response.
 */
export function useWaBlastConfig() {
  return useQuery<WaBlastConfig>({
    queryKey: [WA_BLAST_CONFIG_QUERY_KEY],
    queryFn: getConfig,
    staleTime: 300_000, // 5 minutes
    retry: false, // Don't retry if config doesn't exist yet
  });
}

/**
 * Save or update the Go-WA Gateway configuration.
 */
export function useSaveConfig() {
  const queryClient = useQueryClient();

  return useMutation<WaBlastConfig, Error, SaveConfigPayload>({
    mutationFn: saveConfig,
    onSuccess: () => {
      // Invalidate config query to refetch
      queryClient.invalidateQueries({ queryKey: [WA_BLAST_CONFIG_QUERY_KEY] });
    },
  });
}

/**
 * Test the connection to Go-WA Gateway using the saved configuration.
 */
export function useTestConnection() {
  return useMutation<{ success: boolean; message: string }, Error>({
    mutationFn: testConnection,
  });
}
