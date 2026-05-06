/**
 * API service for WA Blast Go-WA Gateway configuration.
 * Feature: wa-blast
 */

import { apiClient } from '@/lib/api';
import type { WaBlastConfig, SaveConfigPayload } from '../types/waBlast.types';

/**
 * Fetch the current Go-WA Gateway configuration.
 * Note: API token is masked as '***' in the response.
 */
export async function getConfig(): Promise<WaBlastConfig> {
  const { data } = await apiClient.get<WaBlastConfig>('/wa-blast-config');
  return data;
}

/**
 * Save or update the Go-WA Gateway configuration.
 * The API token will be encrypted before storage.
 */
export async function saveConfig(payload: SaveConfigPayload): Promise<WaBlastConfig> {
  const { data } = await apiClient.post<WaBlastConfig>('/wa-blast-config', payload);
  return data;
}

/**
 * Test the connection to Go-WA Gateway using the saved configuration.
 * Returns a success/error message from the gateway.
 */
export async function testConnection(): Promise<{ success: boolean; message: string }> {
  const { data } = await apiClient.post<{ success: boolean; message: string }>(
    '/wa-blast-config/test',
  );
  return data;
}
