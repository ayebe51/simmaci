import { apiClient } from '@/lib/api';

export interface HeadmasterRecommendation {
  id: number;
  school_id: number;
  teacher_id: number;
  status: 'Pending' | 'Approved' | 'Rejected';
  documents: {
    cv?: string;
    kartu_ptk?: string;
    ijazah_s1?: string;
    sertifikat_pendidik?: string;
    sk_guru?: string;
    sk_pns?: string;
    pengalaman_manajerial?: string;
    masa_kerja?: string;
    form_a09?: string;
    keterangan_sehat?: string;
    bebas_hukuman?: string;
    bebas_pidana?: string;
    pk_guru?: string;
    pk_kepala?: string;
    ktp?: string;
    rekomendasi?: string;
  };
  submitted_at?: string;
  approved_at?: string;
  approver_id?: number;
  rejection_reason?: string;
  is_reappointment: boolean;
  school?: any;
  teacher?: any;
  approver?: any;
}

export const getHeadmasterRecommendations = async (params?: any) => {
  const response = await apiClient.get('/headmaster-recommendations', { params });
  return response.data;
};

export const getHeadmasterRecommendation = async (id: number | string) => {
  const response = await apiClient.get(`/headmaster-recommendations/${id}`);
  return response.data;
};

export const submitHeadmasterRecommendation = async (data: any) => {
  const response = await apiClient.post('/headmaster-recommendations', data);
  return response.data;
};

export const approveHeadmasterRecommendation = async (id: number | string) => {
  const response = await apiClient.post(`/headmaster-recommendations/${id}/approve`);
  return response.data;
};

export const rejectHeadmasterRecommendation = async (id: number | string, data: { rejection_reason: string }) => {
  const response = await apiClient.post(`/headmaster-recommendations/${id}/reject`, data);
  return response.data;
};
