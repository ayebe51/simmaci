/**
 * Student Statistics API Service
 * Handles all API calls for student statistics per jenjang feature
 */

import { apiClient } from '@/lib/api';

// ── Interfaces ──

export interface JenjangStatItem {
  jenjang: string; // "TK/RA" | "RA" | "MI" | "MTs" | "MA" | "SMA" | "SMK" | "Tidak Terdefinisi" | "Lainnya"
  jumlah_siswa: number;
  persentase: number; // 0-100, rounded
}

export interface JenjangSummaryResponse {
  categories: JenjangStatItem[];
  total: number;
}

export interface MadrasahStatItem {
  id: number;
  nama: string;
  npsn: string;
  kecamatan: string;
  jumlah_siswa: number;
}

export interface KelasStatItem {
  kelas: string;
  jumlah_siswa: number;
}

// ── API Service ──

export const studentStatisticsApi = {
  /**
   * Get aggregated student counts per jenjang category.
   * Returns categories (RA, MI, MTs, MA, Tidak Terdefinisi, Lainnya) with counts and percentages.
   */
  getPerJenjang: async (): Promise<JenjangSummaryResponse> => {
    const response = await apiClient.get('/student-statistics/per-jenjang');
    return response.data;
  },

  /**
   * Get list of madrasah with active student counts for a given jenjang category.
   * Sorted by student count descending.
   */
  getMadrasahByJenjang: async (jenjang: string): Promise<MadrasahStatItem[]> => {
    const response = await apiClient.get(`/student-statistics/per-jenjang/${jenjang}/madrasah`);
    return response.data;
  },

  /**
   * Get student counts per kelas for a specific madrasah.
   * Sorted alphanumerically with "Belum Ditentukan" last.
   */
  getPerKelas: async (madrasahId: number): Promise<KelasStatItem[]> => {
    const response = await apiClient.get(`/student-statistics/madrasah/${madrasahId}/per-kelas`);
    return response.data;
  },

  /**
   * Download Excel file with student counts per kelas for a specific madrasah.
   */
  exportPerKelas: async (madrasahId: number): Promise<Blob> => {
    const response = await apiClient.get(`/student-statistics/madrasah/${madrasahId}/per-kelas/export`, {
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Download Excel rekap file with total student counts per madrasah for a jenjang.
   */
  exportRekapPerJenjang: async (jenjang: string): Promise<Blob> => {
    const response = await apiClient.get(`/student-statistics/per-jenjang/${jenjang}/export`, {
      responseType: 'blob',
    });
    return response.data;
  },
};
