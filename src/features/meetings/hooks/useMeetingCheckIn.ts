/**
 * useMeetingCheckIn Hook
 * Mutations for public check-in and walk-in flows
 */

import { useMutation, useQuery } from '@tanstack/react-query';
import { meetingService } from '../services/meetingService';
import { CheckInPayload, WalkInPayload } from '../types/meeting.types';
import { toast } from 'sonner';

/** Validate signed URL and fetch meeting info (public, no auth) */
export const usePublicMeetingInfo = (meetingId: string | undefined, queryString: string) => {
  return useQuery({
    queryKey: ['public-meeting-checkin', meetingId, queryString],
    queryFn: () => meetingService.validateCheckInUrl(meetingId!, queryString),
    enabled: !!meetingId,
    retry: false,
    staleTime: Infinity, // don't refetch — signed URL is static
  });
};

/** QR_Personal check-in */
export const useMeetingCheckIn = (meetingId: string | undefined, queryString: string) => {
  return useMutation({
    mutationFn: (payload: CheckInPayload) =>
      meetingService.checkIn(meetingId!, queryString, payload),
    onError: (error: any) => {
      const status = error.response?.status;
      const message = error.response?.data?.message;
      if (status === 409) {
        toast.error(message || 'Anda sudah melakukan check-in sebelumnya');
      } else if (status === 410) {
        toast.error(message || 'QR Code sudah tidak berlaku');
      } else if (status === 429) {
        toast.error(message || 'Terlalu banyak percobaan. Silakan tunggu beberapa menit.');
      } else if (status === 422) {
        toast.error(message || 'Validasi gagal. Periksa kembali data Anda.');
      } else {
        toast.error(message || 'Gagal melakukan check-in');
      }
    },
  });
};

/** QR_Umum walk-in */
export const useMeetingWalkIn = (meetingId: string | undefined, queryString: string) => {
  return useMutation({
    mutationFn: (payload: WalkInPayload) =>
      meetingService.walkIn(meetingId!, queryString, payload),
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Gagal melakukan check-in';
      toast.error(message);
    },
  });
};
