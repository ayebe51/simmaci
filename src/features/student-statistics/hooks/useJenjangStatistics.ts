/**
 * useJenjangStatistics Hook
 * TanStack Query hook for fetching per-jenjang student statistics
 */

import { useQuery } from '@tanstack/react-query';
import { studentStatisticsApi } from '@/features/student-statistics/services/studentStatisticsApi';

export const useJenjangStatistics = () => {
  return useQuery({
    queryKey: ['student-statistics', 'per-jenjang'],
    queryFn: () => studentStatisticsApi.getPerJenjang(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
};
