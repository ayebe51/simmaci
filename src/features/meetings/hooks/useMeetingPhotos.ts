/**
 * useMeetingPhotos Hook
 * TanStack Query hooks for meeting photos management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { meetingPhotoService } from '../services/meetingPhotoService';
import { MeetingPhoto } from '../types/meeting.types';
import { toast } from 'sonner';

/**
 * Fetch all photos for a specific meeting
 */
export const useMeetingPhotos = (meetingId: number | null) => {
  return useQuery({
    queryKey: ['meeting-photos', meetingId],
    queryFn: () => {
      if (!meetingId) throw new Error('Meeting ID is required');
      return meetingPhotoService.getByMeeting(meetingId);
    },
    enabled: !!meetingId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Fetch a single photo by ID
 */
export const useMeetingPhoto = (meetingId: number | null, photoId: number | null) => {
  return useQuery({
    queryKey: ['meeting-photo', meetingId, photoId],
    queryFn: () => {
      if (!meetingId || !photoId) throw new Error('Meeting ID and Photo ID are required');
      return meetingPhotoService.getById(meetingId, photoId);
    },
    enabled: !!meetingId && !!photoId,
  });
};

/**
 * Upload photos for a meeting
 */
export const useUploadMeetingPhotos = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ meetingId, files, captions }: { meetingId: number; files: File[]; captions?: string[] }) =>
      meetingPhotoService.upload(meetingId, files, captions),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['meeting-photos', variables.meetingId],
      });
      queryClient.invalidateQueries({
        queryKey: ['meeting', variables.meetingId],
      });
      toast.success(`${data.length} foto berhasil diunggah`);
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Gagal mengunggah foto';
      toast.error(message);
    },
  });
};

/**
 * Update photo caption
 */
export const useUpdatePhotoCaption = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ meetingId, photoId, caption }: { meetingId: number; photoId: number; caption: string }) =>
      meetingPhotoService.updateCaption(meetingId, photoId, caption),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ['meeting-photos', data.meeting_id],
      });
      queryClient.invalidateQueries({
        queryKey: ['meeting-photo', data.meeting_id, data.id],
      });
      toast.success('Keterangan foto berhasil diperbarui');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Gagal memperbarui keterangan foto';
      toast.error(message);
    },
  });
};

/**
 * Delete a single photo
 */
export const useDeleteMeetingPhoto = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ meetingId, photoId }: { meetingId: number; photoId: number }) =>
      meetingPhotoService.delete(meetingId, photoId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['meeting-photos', variables.meetingId],
      });
      queryClient.invalidateQueries({
        queryKey: ['meeting', variables.meetingId],
      });
      toast.success('Foto berhasil dihapus');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Gagal menghapus foto';
      toast.error(message);
    },
  });
};

/**
 * Delete multiple photos at once
 */
export const useDeleteMultipleMeetingPhotos = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ meetingId, photoIds }: { meetingId: number; photoIds: number[] }) =>
      meetingPhotoService.deleteMultiple(meetingId, photoIds),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['meeting-photos', variables.meetingId],
      });
      queryClient.invalidateQueries({
        queryKey: ['meeting', variables.meetingId],
      });
      toast.success(`${variables.photoIds.length} foto berhasil dihapus`);
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Gagal menghapus foto';
      toast.error(message);
    },
  });
};

/**
 * Download all photos as ZIP
 */
export const useDownloadPhotosAsZip = () => {
  return useMutation({
    mutationFn: (meetingId: number) => meetingPhotoService.downloadAsZip(meetingId),
    onSuccess: (blob, meetingId) => {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `foto-rapat-${meetingId}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Foto berhasil diunduh');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Gagal mengunduh foto';
      toast.error(message);
    },
  });
};
