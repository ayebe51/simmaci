/**
 * useMeeting Hook
 * TanStack Query hooks for single meeting detail and participant actions
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { meetingService } from '../services/meetingService';
import { toast } from 'sonner';

export const useMeeting = (id: number | null) => {
  return useQuery({
    queryKey: ['meeting', id],
    queryFn: () => {
      if (!id) throw new Error('Meeting ID is required');
      return meetingService.getById(id);
    },
    enabled: !!id,
    staleTime: 30_000,
  });
};

/** Manual check-in by admin */
export const useManualCheckIn = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ meetingId, participantId }: { meetingId: number; participantId: number }) =>
      meetingService.manualCheckIn(meetingId, participantId),
    onSuccess: (_, { meetingId }) => {
      queryClient.invalidateQueries({ queryKey: ['meeting', meetingId] });
      queryClient.invalidateQueries({ queryKey: ['meeting-attendance', meetingId] });
      toast.success('Check-in manual berhasil');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Gagal melakukan check-in manual';
      toast.error(message);
    },
  });
};

/** Reset check-in for a participant */
export const useResetCheckIn = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ meetingId, participantId }: { meetingId: number; participantId: number }) =>
      meetingService.resetCheckIn(meetingId, participantId),
    onSuccess: (_, { meetingId }) => {
      queryClient.invalidateQueries({ queryKey: ['meeting', meetingId] });
      queryClient.invalidateQueries({ queryKey: ['meeting-attendance', meetingId] });
      toast.success('Check-in berhasil direset. Peserta dapat menggunakan QR code yang sama untuk check-in ulang.');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Gagal mereset check-in';
      toast.error(message);
    },
  });
};

/** Regenerate QR code for a participant */
export const useRegenerateQr = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ meetingId, participantId }: { meetingId: number; participantId: number }) =>
      meetingService.regenerateQr(meetingId, participantId),
    onSuccess: (_, { meetingId }) => {
      queryClient.invalidateQueries({ queryKey: ['meeting', meetingId] });
      toast.success('QR Code berhasil di-regenerate');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Gagal regenerate QR Code';
      toast.error(message);
    },
  });
};

/** Download PDF report */
export const useDownloadMeetingPdf = () => {
  return useMutation({
    mutationFn: (meetingId: number) => meetingService.downloadPdf(meetingId),
    onSuccess: (blob, meetingId) => {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `laporan-rapat-${meetingId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Laporan PDF berhasil diunduh');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Gagal mengunduh laporan PDF';
      toast.error(message);
    },
  });
};

/** Download Excel report */
export const useDownloadMeetingExcel = () => {
  return useMutation({
    mutationFn: (meetingId: number) => meetingService.downloadExcel(meetingId),
    onSuccess: (blob, meetingId) => {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `laporan-rapat-${meetingId}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Laporan Excel berhasil diunduh');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Gagal mengunduh laporan Excel';
      toast.error(message);
    },
  });
};
