/**
 * API service for WA Blast WAHA Gateway configuration.
 * Feature: wa-blast
 */

import { apiClient } from '@/lib/api';
import type { WaBlastConfig, SaveConfigPayload } from '../types/waBlast.types';

/**
 * Fetch the current WAHA Gateway configuration.
 * Note: API token is masked as '***' in the response.
 * Returns null if config doesn't exist yet (404).
 */
export async function getConfig(): Promise<WaBlastConfig | null> {
  try {
    const { data } = await apiClient.get<WaBlastConfig>('/wa-blast-config');
    return data;
  } catch (error: any) {
    // Return null if config doesn't exist yet (404)
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Save or update the WAHA Gateway configuration.
 * The API token will be encrypted before storage.
 */
export async function saveConfig(payload: SaveConfigPayload): Promise<WaBlastConfig> {
  const { data } = await apiClient.post<WaBlastConfig>('/wa-blast-config', payload);
  return data;
}

/**
 * Test the connection to WAHA Gateway using the saved configuration.
 * Returns a success/error message from the gateway.
 *
 * Note: apiClient interceptor unwraps { success, message, data } → data.
 * For test connection we need the outer wrapper, so we read the raw response.
 */
export async function testConnection(): Promise<{ success: boolean; message: string }> {
  try {
    // Use axios directly to bypass the interceptor unwrapping
    const response = await apiClient.post('/wa-blast-config/test');
    // After interceptor: if success=true, response.data = WAHA data payload
    // We treat any successful HTTP response as a successful connection
    return {
      success: true,
      message: (response as any)?.data?.message || 'Koneksi ke WAHA berhasil.',
    };
  } catch (error: any) {
    // HTTP error (4xx/5xx) — extract message from error response
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      'Gagal menghubungi WAHA Gateway. Periksa konfigurasi Anda.';
    return {
      success: false,
      message,
    };
  }
}
