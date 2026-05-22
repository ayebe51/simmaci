/**
 * useKelasStatistics Hook
 * TanStack Query hook for fetching per-kelas student statistics for a madrasah
 */

import { useQuery } from '@tanstack/react-query';
import { studentStatisticsApi } from '@/features/student-statistics/services/studentStatisticsApi';

export const useKelasStatistics = (madrasahId: number | null) => {
  return useQuery({
    queryKey: ['student-statistics', 'kelas', madrasahId],
    queryFn: () => studentStatisticsApi.getPerKelas(madrasahId!),
    enabled: !!madrasahId,
    retry: 1,
  });
};
