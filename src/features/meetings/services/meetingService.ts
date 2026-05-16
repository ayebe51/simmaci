/**
 * Meeting Service
 * Handles all API calls for meeting management, attendance, and reports
 */

import { apiClient } from '@/lib/api';
import {
  Meeting,
  CreateMeetingPayload,
  UpdateMeetingPayload,
  MeetingListParams,
  PaginatedResponse,
} from '../types/meeting.types';

export const meetingService = {
  // ── List & Detail ──

  list: async (params?: MeetingListParams): Promise<PaginatedResponse<Meeting>> => {
    const response = await apiClient.get('/meetings', { params });
    // apiClient interceptor unwraps { success, message, data: { items, meta } } → data = { items, meta }
    const d = response.data;
    if (d && d.items !== undefined) {
      return {
        data: d.items,
        current_page: d.meta?.currentPage ?? 1,
        last_page: d.meta?.lastPage ?? 1,
        per_page: d.meta?.perPage ?? 20,
        total: d.meta?.total ?? 0,
      };
    }
    return d;
  },

  getById: async (id: number): Promise<Meeting> => {
    const response = await apiClient.get(`/meetings/${id}`);
    // Backend show() returns { meeting, attendance_stats }
    // apiClient interceptor unwraps outer { success, message, data } → data = { meeting, attendance_stats }
    const d = response.data;
    if (d && d.meeting) {
      return {
        ...d.meeting,
        attendance_stats: d.attendance_stats ?? d.meeting.attendance_stats,
      };
    }
    return d;
  },

  // ── CRUD ──

  create: async (payload: CreateMeetingPayload): Promise<Meeting> => {
    const response = await apiClient.post('/meetings', payload);
    return response.data.data ?? response.data;
  },

  update: async (id: number, payload: Partial<UpdateMeetingPayload>): Promise<Meeting> => {
    const response = await apiClient.put(`/meetings/${id}`, payload);
    return response.data.data ?? response.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/meetings/${id}`);
  },

  // ── Participant Actions ──

  manualCheckIn: async (meetingId: number, participantId: number): Promise<void> => {
    await apiClient.post(`/meetings/${meetingId}/participants/${participantId}/check-in`);
  },

  resetCheckIn: async (meetingId: number, participantId: number): Promise<void> => {
    await apiClient.post(`/meetings/${meetingId}/participants/${participantId}/reset-check-in`);
  },

  regenerateQr: async (meetingId: number, participantId: number): Promise<void> => {
    await apiClient.post(`/meetings/${meetingId}/participants/${participantId}/regenerate-qr`);
  },

  // ── Reports ──

  downloadPdf: async (meetingId: number): Promise<Blob> => {
    const response = await apiClient.get(`/meetings/${meetingId}/report/pdf`, {
      responseType: 'blob',
    });
    return response.data;
  },

  downloadExcel: async (meetingId: number): Promise<Blob> => {
    const response = await apiClient.get(`/meetings/${meetingId}/report/excel`, {
      responseType: 'blob',
    });
    return response.data;
  },

  // ── File URL helpers ──

  getFileUrl: (path: string): string => {
    const base = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace('/api', '');
    return `${base}/storage/${path}`;
  },
};
