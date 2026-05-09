/**
 * useMeetingAttendance Hook
 * Real-time polling hook for meeting attendance stats (every 10 seconds)
 */

import { useQuery } from '@tanstack/react-query';
import { meetingService } from '../services/meetingService';

export const useMeetingAttendance = (meetingId: number | null) => {
  return useQuery({
    queryKey: ['meeting-attendance', meetingId],
    queryFn: () => {
      if (!meetingId) throw new Error('Meeting ID is required');
      return meetingService.getById(meetingId);
    },
    enabled: !!meetingId,
    refetchInterval: 10_000,          // polling setiap 10 detik
    refetchIntervalInBackground: false, // hentikan jika tab tidak aktif
    staleTime: 5_000,
  });
};
