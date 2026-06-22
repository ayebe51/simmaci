/**
 * JenjangSummaryCards Component
 * Displays summary cards for each jenjang category with student counts and percentages.
 * Each card is clickable to trigger drill-down to madrasah list.
 *
 * Validates: Requirements 1.4, 1.8
 */

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { GraduationCap, Users, School, BookOpen, HelpCircle, MoreHorizontal } from 'lucide-react';
import type { JenjangSummaryResponse } from '@/features/student-statistics/services/studentStatisticsApi';

interface JenjangSummaryCardsProps {
  data: JenjangSummaryResponse | undefined;
  onSelectJenjang: (jenjang: string) => void;
}

/** Icon and color mapping for each jenjang category */
const jenjangConfig: Record<string, { icon: React.ElementType; color: string; bgColor: string }> = {
  RA: {
    icon: BookOpen,
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
  },
  MI: {
    icon: School,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  MTs: {
    icon: GraduationCap,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
  },
  MA: {
    icon: Users,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
  'Tidak Terdefinisi': {
    icon: HelpCircle,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
  },
  Lainnya: {
    icon: MoreHorizontal,
    color: 'text-slate-600',
    bgColor: 'bg-slate-50',
  },
};

/** Canonical order for displaying jenjang categories */
const JENJANG_ORDER = ['TK/RA', 'RA', 'MI', 'MTs', 'MA', 'SMA', 'SMK', 'Tidak Terdefinisi', 'Lainnya'];

export function JenjangSummaryCards({ data, onSelectJenjang }: JenjangSummaryCardsProps) {
  if (!data) return null;

  // Build a map from the API data for quick lookup
  const categoryMap = new Map(
    data.categories.map((item) => [item.jenjang, item])
  );

  return (
    <div className="space-y-6">
      {/* Total student count */}
      <div className="flex items-center gap-3 px-1">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-100">
          <Users className="w-5 h-5 text-emerald-700" />
        </div>
        <div>
          <p className="text-sm text-slate-500">Total Siswa Aktif</p>
          <p className="text-2xl font-bold text-slate-900">
            {data.total.toLocaleString('id-ID')}
          </p>
        </div>
      </div>

      {/* Jenjang cards grid */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {JENJANG_ORDER.map((jenjang) => {
          const item = categoryMap.get(jenjang);
          const count = item?.jumlah_siswa ?? 0;
          const percentage = item?.persentase ?? 0;
          const config = jenjangConfig[jenjang] ?? jenjangConfig['Lainnya'];
          const Icon = config.icon;

          return (
            <Card
              key={jenjang}
              role="button"
              tabIndex={0}
              aria-label={`Lihat detail ${jenjang}: ${count} siswa (${percentage}%)`}
              onClick={() => onSelectJenjang(jenjang)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectJenjang(jenjang);
                }
              }}
              className={cn(
                'border-0 shadow-sm bg-white rounded-2xl overflow-hidden cursor-pointer',
                'transition-all duration-200 hover:shadow-md hover:scale-[1.02]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2'
              )}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-500">{jenjang}</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {count.toLocaleString('id-ID')}
                    </p>
                    <p className="text-sm text-slate-500">
                      {percentage}% dari total
                    </p>
                  </div>
                  <div className={cn('flex items-center justify-center w-10 h-10 rounded-xl', config.bgColor)}>
                    <Icon className={cn('w-5 h-5', config.color)} />
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-4 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      config.color.replace('text-', 'bg-')
                    )}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
