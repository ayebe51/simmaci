import { apiClient } from '@/lib/api';
import { PpdbPeriod, PpdbRegistration, PpdbStats } from '@/types/ppdb';

export const ppdbService = {
  // ── Public Endpoints ──
  getPublicSchools: async (params?: { jenjang?: string; kecamatan?: string; search?: string; page?: number; per_page?: number }) => {
    const { data } = await apiClient.get('/ppdb/schools', { params });
    return data;
  },

  getPublicSchoolDetail: async (id: number) => {
    const { data } = await apiClient.get(`/ppdb/schools/${id}`);
    return data.data;
  },

  registerOnline: async (formData: FormData) => {
    const { data } = await apiClient.post('/ppdb/register', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  checkStatus: async (query: string) => {
    const { data } = await apiClient.get('/ppdb/status', { params: { q: query } });
    return data.data;
  },

  // ── Admin / Operator Endpoints ──
  getStats: async (params?: { school_id?: number; period_id?: number }) => {
    const { data } = await apiClient.get('/ppdb/stats', { params });
    return data.data as PpdbStats;
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
    return data;
  },

  getRegistrationDetail: async (id: number) => {
    const { data } = await apiClient.get(`/ppdb/registrations/${id}`);
    return data.data as PpdbRegistration;
  },

  verifyRegistration: async (id: number, payload: { status: string; verification_notes?: string }) => {
    const { data } = await apiClient.post(`/ppdb/registrations/${id}/verify`, payload);
    return data;
  },

  submitScore: async (id: number, payload: {
    test_score?: number;
    interview_score?: number;
    achievement_score?: number;
    decision: 'accepted' | 'reserved' | 'rejected';
    selection_notes?: string;
  }) => {
    const { data } = await apiClient.post(`/ppdb/registrations/${id}/score`, payload);
    return data;
  },

  confirmReregistration: async (id: number) => {
    const { data } = await apiClient.post(`/ppdb/registrations/${id}/reregister`);
    return data;
  },

  // ── Period & Waves Endpoints ──
  getPeriods: async (params?: { school_id?: number; academic_year?: string; page?: number }) => {
    const { data } = await apiClient.get('/ppdb/periods', { params });
    return data;
  },

  getPeriodDetail: async (id: number) => {
    const { data } = await apiClient.get(`/ppdb/periods/${id}`);
    return data.data as PpdbPeriod;
  },

  createPeriod: async (payload: Partial<PpdbPeriod>) => {
    const { data } = await apiClient.post('/ppdb/periods', payload);
    return data.data as PpdbPeriod;
  },

  updatePeriod: async (id: number, payload: Partial<PpdbPeriod>) => {
    const { data } = await apiClient.put(`/ppdb/periods/${id}`, payload);
    return data.data as PpdbPeriod;
  },

  deletePeriod: async (id: number) => {
    const { data } = await apiClient.delete(`/ppdb/periods/${id}`);
    return data;
  },

  exportData: async (params?: { school_id?: number; period_id?: number; status?: string }) => {
    const { data } = await apiClient.get('/ppdb/export', { params });
    return data.data;
  },
};
