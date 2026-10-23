import { apiClient } from '@/lib/api';

export interface PublicPortalStats {
  total_schools: number;
  total_teachers: number;
  total_tendiks: number;
  total_students: number;
  total_districts: number;
  updated_at: string;
}

export interface PublicSchoolItem {
  id: number;
  nama: string;
  nsm?: string | null;
  npsn?: string | null;
  jenjang?: string | null;
  status_jamiyyah?: string | null;
  akreditasi?: string | null;
  kecamatan?: string | null;
  alamat?: string | null;
  telepon?: string | null;
}

export interface PublicSchoolsDirectoryResponse {
  data: PublicSchoolItem[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export const publicPortalApi = {
  getStats: async (): Promise<PublicPortalStats> => {
    const res = await apiClient.get('/public/portal/stats');
    return res.data?.data || res.data;
  },

  getDistributionMap: async () => {
    const res = await apiClient.get('/public/portal/distribution-map');
    return res.data?.data || res.data;
  },

  getSchoolsDirectory: async (params?: {
    search?: string;
    kecamatan?: string;
    jenjang?: string;
    page?: number;
    per_page?: number;
  }): Promise<PublicSchoolsDirectoryResponse> => {
    const res = await apiClient.get('/public/portal/schools-directory', { params });
    return res.data;
  },
};
