import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AffiliationStats } from '@/services/dashboardApi';

interface AffiliationCardProps {
  data: AffiliationStats;
  total: number;
}

export function AffiliationCard({ data, total }: AffiliationCardProps) {
  // Calculate percentages
  const calculatePercentage = (count: number): number => {
    if (total === 0) return 0;
    return Math.round((count / total) * 100);
  };

  const categories = [
    {
      label: 'Jama\'ah / Afiliasi',
      count: data.jamaah,
      percentage: calculatePercentage(data.jamaah),
    },
    {
      label: 'Jam\'iyyah',
      count: data.jamiyyah,
      percentage: calculatePercentage(data.jamiyyah),
    },
    {
      label: 'Tidak Terdefinisi',
      count: data.undefined,
      percentage: calculatePercentage(data.undefined),
    },
  ];

  return (
    <Card className="border-0 shadow-sm bg-white rounded-2xl overflow-hidden">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg md:text-xl font-bold text-slate-800">
          Statistik Afiliasi Sekolah
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 md:p-8 pt-0">
        <div className="space-y-5">
          {categories.map((category, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm md:text-base font-medium text-slate-700">
                  {category.label}
                </span>
                <span className="text-sm md:text-base font-bold text-slate-900">
                  {category.count} ({category.percentage}%)
                </span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${category.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 pt-4 border-t border-slate-100">
          <p className="text-sm md:text-base text-slate-600 font-medium">
            Total: <span className="font-bold text-slate-900">{total} sekolah</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
