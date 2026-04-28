import { apiClient } from '@/lib/api';

/**
 * Dashboard API Service
 * Provides methods for fetching dashboard statistics
 */

// ── TypeScript Interfaces ──

export interface AffiliationStats {
  jamaah: number;
  jamiyyah: number;
  undefined: number;
}

export interface JenjangStats {
  mi_sd: number;
  mts_smp: number;
  ma_sma_smk: number;
  lainnya: number;
  undefined: number;
}

export interface SchoolStatisticsData {
  affiliation: AffiliationStats;
  jenjang: JenjangStats;
  total: number;
}

// ── Dashboard API Methods ──

export const dashboardApi = {
  /**
   * Get school statistics by affiliation and jenjang
   * Returns aggregated counts for dashboard display
   * 
   * @returns Promise<SchoolStatisticsData>
   * @throws Error if request fails
   */
  getSchoolStatistics: async (): Promise<SchoolStatisticsData> => {
    try {
      const response = await apiClient.get('/dashboard/school-statistics', {
        timeout: 10000, // 10 second timeout
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch school statistics:', error);
      throw error;
    }
  },
};
