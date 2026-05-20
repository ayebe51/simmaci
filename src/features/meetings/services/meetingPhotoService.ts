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
    // Backend returns { photos: [...], count: N }
    const data = response.data;
    const photos: any[] = Array.isArray(data) ? data : (data?.photos ?? []);
    // Normalize backend fields to frontend MeetingPhoto shape
    return photos.map((p: any) => ({
      id: p.id,
      meeting_id: p.meeting_id ?? meetingId,
      file_path: p.file_path ?? p.photo_url ?? '',
      thumbnail_path: p.thumbnail_path ?? p.thumbnail_url ?? null,
      caption: p.caption ?? null,
      uploaded_by: p.uploaded_by ?? 0,
      uploaded_by_name: p.uploaded_by_name ?? '',
      created_at: p.created_at ?? p.uploaded_at ?? '',
      updated_at: p.updated_at ?? p.uploaded_at ?? '',
    }));
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
    
    files.forEach((file) => {
      formData.append('photos[]', file);
    });
    if (captions) {
      captions.forEach((caption, index) => {
        if (caption) formData.append(`captions[${index}]`, caption);
      });
    }

    const response = await apiClient.post(`/meetings/${meetingId}/photos`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    });
    // Backend returns { photos: [...], count: N }
    const data = response.data;
    const photos: any[] = Array.isArray(data) ? data : (data?.photos ?? []);
    return photos.map((p: any) => ({
      id: p.id,
      meeting_id: meetingId,
      file_path: p.file_path ?? p.photo_url ?? '',
      thumbnail_path: p.thumbnail_path ?? p.thumbnail_url ?? null,
      caption: p.caption ?? null,
      uploaded_by: p.uploaded_by ?? 0,
      uploaded_by_name: p.uploaded_by_name ?? '',
      created_at: p.created_at ?? p.uploaded_at ?? '',
      updated_at: p.updated_at ?? p.uploaded_at ?? '',
    }));
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
   * Backend route: GET /meetings/{id}/photos/download
   */
  downloadAsZip: async (meetingId: number): Promise<Blob> => {
    const response = await apiClient.get(`/meetings/${meetingId}/photos/download`, {
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Get photo file URL for display.
   * In production, photos are served via MinIO proxy at /api/minio/{path}.
   * Backend returns relative paths like /minio/{storage_path}.
   * If the path is already a full URL, return as-is.
   */
  getFileUrl: (filePath: string): string => {
    if (!filePath) return '';
    if (filePath.startsWith('http')) return filePath;
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
    const cleanPath = filePath.startsWith('/') ? filePath : `/${filePath}`;
    return `${baseUrl}${cleanPath}`;
  },

  /**
   * Get thumbnail URL for display
   */
  getThumbnailUrl: (thumbnailPath: string | null): string => {
    if (!thumbnailPath) return '';
    return meetingPhotoService.getFileUrl(thumbnailPath);
  },
};
