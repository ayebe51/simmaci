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
  tk_ra: number;
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

export interface DistrictSchool {
  id: number;
  nama: string;
  npsn?: string | null;
  nsm?: string | null;
  jenjang: string;
  status_jamiyyah?: string | null;
  alamat?: string | null;
  teachers_count: number;
  tendiks_count: number;
  students_count: number;
}

export interface DistrictStat {
  nama: string;
  kode: string;
  schools_count: number;
  teachers_count: number;
  tendiks_count: number;
  students_count: number;
  jenjang_breakdown: Record<string, number>;
  schools: DistrictSchool[];
}

export interface DistributionMapData {
  summary: {
    total_schools: number;
    total_teachers: number;
    total_tendiks: number;
    total_students: number;
    total_districts_covered: number;
    total_districts: number;
  };
  districts: DistrictStat[];
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

  /**
   * Get distribution map statistics (by 24 kecamatan in Kab. Cilacap)
   * 
   * @returns Promise<DistributionMapData>
   * @throws Error if request fails
   */
  getDistributionMap: async (): Promise<DistributionMapData> => {
    try {
      const response = await apiClient.get('/dashboard/distribution-map', {
        timeout: 10000,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch distribution map data:', error);
      throw error;
    }
  },
};

