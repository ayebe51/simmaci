/**
 * useMadrasahByJenjang Hook
 * TanStack Query hook for fetching madrasah list by jenjang category
 */

import { useQuery } from '@tanstack/react-query';
import { studentStatisticsApi } from '@/features/student-statistics/services/studentStatisticsApi';

export const useMadrasahByJenjang = (jenjang: string | null) => {
  return useQuery({
    queryKey: ['student-statistics', 'madrasah', jenjang],
    queryFn: () => studentStatisticsApi.getMadrasahByJenjang(jenjang!),
    enabled: !!jenjang,
    retry: 1,
  });
};
