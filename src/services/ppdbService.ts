import { apiClient } from '@/lib/api';
import { PpdbPeriod, PpdbRegistration, PpdbStats } from '@/types/ppdb';

const unwrap = <T = any>(res: any): T => {
  if (res && typeof res === 'object' && res.data !== undefined) {
    return res.data as T;
  }
  return res as T;
};

export const ppdbService = {
  // ── Public Endpoints ──
  getPublicSchools: async (params?: { jenjang?: string; kecamatan?: string; search?: string; page?: number; per_page?: number }) => {
    const { data } = await apiClient.get('/ppdb/schools', { params });
    return unwrap(data);
  },

  getPublicSchoolDetail: async (id: number | string) => {
    const { data } = await apiClient.get(`/ppdb/schools/${id}`);
    return unwrap(data);
  },

  registerOnline: async (formData: FormData) => {
    const { data } = await apiClient.post('/ppdb/register', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  checkStatus: async (query: string) => {
    const { data } = await apiClient.get('/ppdb/status', { params: { q: query } });
    return unwrap(data);
  },

  // ── Admin / Operator Endpoints ──
  getStats: async (params?: { school_id?: number; period_id?: number }) => {
    const { data } = await apiClient.get('/ppdb/stats', { params });
    return unwrap<PpdbStats>(data);
  },

  getRegistrations: async (params?: {
    page?: number;
    per_page?: number;
    school_id?: number;
    period_id?: number;
    status?: string;
    track?: string;
    search?: string;
  }) => {
    const { data } = await apiClient.get('/ppdb/registrations', { params });
    return unwrap(data);
  },

  getRegistrationDetail: async (id: number) => {
    const { data } = await apiClient.get(`/ppdb/registrations/${id}`);
    return unwrap<PpdbRegistration>(data);
  },

  verifyRegistration: async (id: number, payload: { status: string; verification_notes?: string }) => {
    const { data } = await apiClient.post(`/ppdb/registrations/${id}/verify`, payload);
    return unwrap(data);
  },

  submitScore: async (id: number, payload: {
    test_score?: number;
    interview_score?: number;
    achievement_score?: number;
    decision: 'accepted' | 'reserved' | 'rejected';
    selection_notes?: string;
  }) => {
    const { data } = await apiClient.post(`/ppdb/registrations/${id}/score`, payload);
    return unwrap(data);
  },

  confirmReregistration: async (id: number) => {
    const { data } = await apiClient.post(`/ppdb/registrations/${id}/reregister`);
    return unwrap(data);
  },

  // ── Period & Waves Endpoints ──
  getPeriods: async (params?: { school_id?: number; academic_year?: string; page?: number }) => {
    const { data } = await apiClient.get('/ppdb/periods', { params });
    return unwrap(data);
  },

  getPeriodDetail: async (id: number) => {
    const { data } = await apiClient.get(`/ppdb/periods/${id}`);
    return unwrap<PpdbPeriod>(data);
  },

  createPeriod: async (payload: Partial<PpdbPeriod>) => {
    const { data } = await apiClient.post('/ppdb/periods', payload);
    return unwrap<PpdbPeriod>(data);
  },

  updatePeriod: async (id: number, payload: Partial<PpdbPeriod>) => {
    const { data } = await apiClient.put(`/ppdb/periods/${id}`, payload);
    return unwrap<PpdbPeriod>(data);
  },

  deletePeriod: async (id: number) => {
    const { data } = await apiClient.delete(`/ppdb/periods/${id}`);
    return unwrap(data);
  },

  exportData: async (params?: { school_id?: number; period_id?: number; status?: string }) => {
    const { data } = await apiClient.get('/ppdb/export', { params });
    return unwrap(data);
  },
};
