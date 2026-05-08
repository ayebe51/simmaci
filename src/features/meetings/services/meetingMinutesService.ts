/**
 * Meeting Minutes Service
 * Handles API calls for meeting minutes (notulensi) management
 */

import { apiClient } from '@/lib/api';
import { MeetingMinutes, CreateMinutesPayload, UpdateMinutesPayload } from '../types/meeting.types';

export const meetingMinutesService = {
  /**
   * Get minutes for a specific meeting
   */
  getByMeeting: async (meetingId: number): Promise<MeetingMinutes | null> => {
    try {
      const response = await apiClient.get(`/meetings/${meetingId}/minutes`);
      return response.data;
    } catch (error: any) {
      // 404 means no minutes exist yet, which is fine
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Create new minutes for a meeting
   */
  create: async (payload: CreateMinutesPayload): Promise<MeetingMinutes> => {
    const response = await apiClient.post(`/meetings/${payload.meeting_id}/minutes`, {
      content: payload.content,
    });
    return response.data;
  },

  /**
   * Update existing minutes
   */
  update: async (meetingId: number, payload: UpdateMinutesPayload): Promise<MeetingMinutes> => {
    const response = await apiClient.put(`/meetings/${meetingId}/minutes`, {
      content: payload.content,
    });
    return response.data;
  },

  /**
   * Delete minutes for a meeting
   */
  delete: async (meetingId: number): Promise<void> => {
    await apiClient.delete(`/meetings/${meetingId}/minutes`);
  },

  /**
   * Get minutes as HTML (for viewing)
   */
  getHtml: async (meetingId: number): Promise<string> => {
    const response = await apiClient.get(`/meetings/${meetingId}/minutes/html`);
    return response.data.html;
  },

  /**
   * Export minutes as PDF
   */
  exportPdf: async (meetingId: number): Promise<Blob> => {
    const response = await apiClient.get(`/meetings/${meetingId}/minutes/export/pdf`, {
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Export minutes as DOCX
   */
  exportDocx: async (meetingId: number): Promise<Blob> => {
    const response = await apiClient.get(`/meetings/${meetingId}/minutes/export/docx`, {
      responseType: 'blob',
    });
    return response.data;
  },
};
