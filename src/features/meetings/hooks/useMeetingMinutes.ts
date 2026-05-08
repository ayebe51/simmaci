/**
 * useMeetingMinutes Hook
 * TanStack Query hooks for meeting minutes management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { meetingMinutesService } from '../services/meetingMinutesService';
import { MeetingMinutes, CreateMinutesPayload, UpdateMinutesPayload } from '../types/meeting.types';
import { toast } from 'sonner';

/**
 * Fetch minutes for a specific meeting
 */
export const useMeetingMinutes = (meetingId: number | null) => {
  return useQuery({
    queryKey: ['meeting-minutes', meetingId],
    queryFn: () => {
      if (!meetingId) throw new Error('Meeting ID is required');
      return meetingMinutesService.getByMeeting(meetingId);
    },
    enabled: !!meetingId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Create new minutes for a meeting
 */
export const useCreateMeetingMinutes = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateMinutesPayload) => meetingMinutesService.create(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ['meeting-minutes', data.meeting_id],
      });
      queryClient.invalidateQueries({
        queryKey: ['meeting', data.meeting_id],
      });
      toast.success('Notulensi berhasil dibuat');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Gagal membuat notulensi';
      toast.error(message);
    },
  });
};

/**
 * Update existing minutes
 */
export const useUpdateMeetingMinutes = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ meetingId, payload }: { meetingId: number; payload: UpdateMinutesPayload }) =>
      meetingMinutesService.update(meetingId, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ['meeting-minutes', data.meeting_id],
      });
      queryClient.invalidateQueries({
        queryKey: ['meeting', data.meeting_id],
      });
      toast.success('Notulensi berhasil diperbarui');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Gagal memperbarui notulensi';
      toast.error(message);
    },
  });
};

/**
 * Delete minutes for a meeting
 */
export const useDeleteMeetingMinutes = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (meetingId: number) => meetingMinutesService.delete(meetingId),
    onSuccess: (_, meetingId) => {
      queryClient.invalidateQueries({
        queryKey: ['meeting-minutes', meetingId],
      });
      queryClient.invalidateQueries({
        queryKey: ['meeting', meetingId],
      });
      toast.success('Notulensi berhasil dihapus');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Gagal menghapus notulensi';
      toast.error(message);
    },
  });
};

/**
 * Export minutes as PDF
 */
export const useExportMinutesPdf = () => {
  return useMutation({
    mutationFn: (meetingId: number) => meetingMinutesService.exportPdf(meetingId),
    onSuccess: (blob, meetingId) => {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `notulensi-rapat-${meetingId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Notulensi berhasil diunduh');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Gagal mengunduh notulensi';
      toast.error(message);
    },
  });
};

/**
 * Export minutes as DOCX
 */
export const useExportMinutesDocx = () => {
  return useMutation({
    mutationFn: (meetingId: number) => meetingMinutesService.exportDocx(meetingId),
    onSuccess: (blob, meetingId) => {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `notulensi-rapat-${meetingId}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Notulensi berhasil diunduh');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Gagal mengunduh notulensi';
      toast.error(message);
    },
  });
};
