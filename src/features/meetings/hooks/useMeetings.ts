/**
 * useMeetings Hook
 * TanStack Query hooks for meeting list and CRUD operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { meetingService } from '../services/meetingService';
import {
  CreateMeetingPayload,
  UpdateMeetingPayload,
  MeetingListParams,
} from '../types/meeting.types';
import { toast } from 'sonner';

export const MEETINGS_KEY = 'meetings';

/** Paginated list of meetings */
export const useMeetings = (params?: MeetingListParams) => {
  return useQuery({
    queryKey: [MEETINGS_KEY, params],
    queryFn: () => meetingService.list(params),
    staleTime: 30_000,
  });
};

/** Create a new meeting */
export const useCreateMeeting = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateMeetingPayload) => meetingService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MEETINGS_KEY] });
      toast.success('Rapat berhasil dibuat');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Gagal membuat rapat';
      toast.error(message);
    },
  });
};

/** Update an existing meeting */
export const useUpdateMeeting = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<UpdateMeetingPayload> }) =>
      meetingService.update(id, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [MEETINGS_KEY] });
      queryClient.invalidateQueries({ queryKey: ['meeting', data.id] });
      toast.success('Rapat berhasil diperbarui');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Gagal memperbarui rapat';
      toast.error(message);
    },
  });
};

/** Soft-delete a meeting */
export const useDeleteMeeting = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => meetingService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MEETINGS_KEY] });
      toast.success('Rapat berhasil dihapus');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Gagal menghapus rapat';
      toast.error(message);
    },
  });
};
