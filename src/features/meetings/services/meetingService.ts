/**
 * Meeting Service
 * Handles all API calls for meeting management, attendance, and reports
 */

import { apiClient } from '@/lib/api';
import {
  Meeting,
  CreateMeetingPayload,
  UpdateMeetingPayload,
  CheckInPayload,
  WalkInPayload,
  MeetingListParams,
  PaginatedResponse,
  CheckInResponse,
} from '../types/meeting.types';

export const meetingService = {
  // ── List & Detail ──

  list: async (params?: MeetingListParams): Promise<PaginatedResponse<Meeting>> => {
    const response = await apiClient.get('/meetings', { params });
    return response.data.data ?? response.data;
  },

  getById: async (id: number): Promise<Meeting> => {
    const response = await apiClient.get(`/meetings/${id}`);
    return response.data.data ?? response.data;
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

  // ── Public Check-In (no auth) ──

  validateCheckInUrl: async (meetingId: string, queryString: string): Promise<Meeting> => {
    const response = await apiClient.get(
      `/public/meetings/${meetingId}/check-in?${queryString}`,
      { headers: { Authorization: undefined } }
    );
    return response.data.data ?? response.data;
  },

  checkIn: async (
    meetingId: string,
    queryString: string,
    payload: CheckInPayload
  ): Promise<CheckInResponse> => {
    const formData = new FormData();
    formData.append('is_delegation', String(payload.is_delegation));
    if (payload.delegated_for_participant_id) {
      formData.append('delegated_for_participant_id', String(payload.delegated_for_participant_id));
    }
    if (payload.delegation_letter) {
      formData.append('delegation_letter', payload.delegation_letter);
    }
    if (payload.latitude !== undefined) formData.append('latitude', String(payload.latitude));
    if (payload.longitude !== undefined) formData.append('longitude', String(payload.longitude));

    const response = await apiClient.post(
      `/public/meetings/${meetingId}/check-in?${queryString}`,
      formData,
      { headers: { Authorization: undefined, 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  },

  walkIn: async (
    meetingId: string,
    queryString: string,
    payload: WalkInPayload
  ): Promise<CheckInResponse> => {
    const response = await apiClient.post(
      `/public/meetings/${meetingId}/walk-in?${queryString}`,
      payload,
      { headers: { Authorization: undefined } }
    );
    return response.data;
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
