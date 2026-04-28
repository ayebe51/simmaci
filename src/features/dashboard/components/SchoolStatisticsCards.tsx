import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/services/dashboardApi';
import { AffiliationCard } from './AffiliationCard';
import { JenjangCard } from './JenjangCard';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function SchoolStatisticsCards() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['school-statistics'],
    queryFn: () => dashboardApi.getSchoolStatistics(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (renamed from cacheTime in v5)
    refetchOnWindowFocus: false,
    retry: 1, // Reduce retry from 2 to 1
  });

  // Show error toast if request fails
  if (error) {
    toast.error('Gagal memuat statistik sekolah');
  }

  // Loading state with skeleton loaders
  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-0 shadow-sm bg-white rounded-2xl overflow-hidden">
          <CardContent className="p-6 md:p-8">
            <div className="space-y-4">
              <div className="h-6 bg-slate-200 rounded animate-pulse w-3/4" />
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-4 bg-slate-100 rounded animate-pulse" />
                    <div className="h-2 bg-slate-100 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-white rounded-2xl overflow-hidden">
          <CardContent className="p-6 md:p-8">
            <div className="space-y-4">
              <div className="h-6 bg-slate-200 rounded animate-pulse w-3/4" />
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-4 bg-slate-100 rounded animate-pulse" />
                    <div className="h-2 bg-slate-100 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state with fallback message
  if (error || !data) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-0 shadow-sm bg-white rounded-2xl overflow-hidden">
          <CardContent className="p-6 md:p-8">
            <p className="text-sm text-slate-500 text-center">
              Data statistik tidak tersedia
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-white rounded-2xl overflow-hidden">
          <CardContent className="p-6 md:p-8">
            <p className="text-sm text-slate-500 text-center">
              Data statistik tidak tersedia
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render cards with data
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <AffiliationCard data={data.affiliation} total={data.total} />
      <JenjangCard data={data.jenjang} total={data.total} />
    </div>
  );
}
