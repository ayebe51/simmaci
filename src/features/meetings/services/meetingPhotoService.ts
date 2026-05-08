/**
 * Meeting Photo Service
 * Handles API calls for meeting photos (foto kegiatan) management
 */

import { apiClient } from '@/lib/api';
import { MeetingPhoto, UploadPhotosPayload } from '../types/meeting.types';

export const meetingPhotoService = {
  /**
   * Get all photos for a specific meeting
   */
  getByMeeting: async (meetingId: number): Promise<MeetingPhoto[]> => {
    const response = await apiClient.get(`/meetings/${meetingId}/photos`);
    return response.data;
  },

  /**
   * Get a single photo by ID
   */
  getById: async (meetingId: number, photoId: number): Promise<MeetingPhoto> => {
    const response = await apiClient.get(`/meetings/${meetingId}/photos/${photoId}`);
    return response.data;
  },

  /**
   * Upload photos for a meeting
   * Accepts multiple files and optional captions
   */
  upload: async (meetingId: number, files: File[], captions?: string[]): Promise<MeetingPhoto[]> => {
    const formData = new FormData();
    
    files.forEach((file, index) => {
      formData.append('photos[]', file);
      if (captions && captions[index]) {
        formData.append(`captions[${index}]`, captions[index]);
      }
    });

    const response = await apiClient.post(`/meetings/${meetingId}/photos`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 120000, // 2 minutes for large file uploads
    });
    return response.data;
  },

  /**
   * Update photo caption
   */
  updateCaption: async (meetingId: number, photoId: number, caption: string): Promise<MeetingPhoto> => {
    const response = await apiClient.put(`/meetings/${meetingId}/photos/${photoId}`, {
      caption,
    });
    return response.data;
  },

  /**
   * Delete a single photo
   */
  delete: async (meetingId: number, photoId: number): Promise<void> => {
    await apiClient.delete(`/meetings/${meetingId}/photos/${photoId}`);
  },

  /**
   * Delete multiple photos at once
   */
  deleteMultiple: async (meetingId: number, photoIds: number[]): Promise<void> => {
    await apiClient.post(`/meetings/${meetingId}/photos/delete-multiple`, {
      photo_ids: photoIds,
    });
  },

  /**
   * Download all photos as ZIP
   */
  downloadAsZip: async (meetingId: number): Promise<Blob> => {
    const response = await apiClient.get(`/meetings/${meetingId}/photos/download-zip`, {
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Get photo file URL for display
   */
  getFileUrl: (filePath: string): string => {
    if (!filePath) return '';
    if (filePath.startsWith('http')) return filePath;
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
    const storageUrl = baseUrl.replace('/api', '/storage');
    const cleanPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
    return `${storageUrl}/${cleanPath}`;
  },

  /**
   * Get thumbnail URL for display
   */
  getThumbnailUrl: (thumbnailPath: string | null): string => {
    if (!thumbnailPath) return '';
    return meetingPhotoService.getFileUrl(thumbnailPath);
  },
};
