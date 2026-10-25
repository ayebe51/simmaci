import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { publicPortalApi } from '../api/publicPortalApi';
import { School, Users, GraduationCap, MapPin, Loader2 } from 'lucide-react';

export const PublicStatsCards: React.FC = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['public-portal-stats'],
    queryFn: () => publicPortalApi.getStats(),
    staleTime: 10 * 60 * 1000,
  });

  const cards = [
    {
      label: 'Satuan Pendidikan',
      sublabel: 'MI, MTs, MA, & SMK Aktif',
      value: stats?.total_schools,
      icon: School,
      color: 'text-emerald-700',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-100',
    },
    {
      label: 'Pendidik & Tendik',
      sublabel: 'Guru & Tenaga Kependidikan',
      value: stats ? (stats.total_teachers + stats.total_tendiks) : undefined,
      icon: Users,
      color: 'text-blue-700',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-100',
    },
    {
      label: 'Peserta Didik',
      sublabel: 'Siswa Formal Terdata',
      value: stats?.total_students,
      icon: GraduationCap,
      color: 'text-teal-700',
      bgColor: 'bg-teal-50',
      borderColor: 'border-teal-100',
    },
    {
      label: 'Wilayah Layanan',
      sublabel: 'Kecamatan di Kab. Cilacap',
      value: stats?.total_districts ?? 24,
      icon: MapPin,
      color: 'text-amber-700',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-100',
    },
  ];

  return (
    <section id="statistik" className="py-16 bg-white relative z-20 -mt-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className={`p-6 rounded-3xl bg-white border ${card.borderColor} shadow-xs hover:shadow-lg transition-all duration-300 flex items-start gap-4 group`}
            >
              <div className={`p-4 rounded-2xl ${card.bgColor} ${card.color} shrink-0 group-hover:scale-110 transition-transform duration-300`}>
                <Icon className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-black uppercase text-slate-400 tracking-wider">
                  {card.label}
                </p>
                <div className="text-2xl sm:text-3xl font-black text-slate-900 leading-none">
                  {isLoading ? (
                    <div className="h-8 w-20 bg-slate-100 animate-pulse rounded-lg" />
                  ) : (
                    (card.value ?? 0).toLocaleString('id-ID')
                  )}
                </div>
                <p className="text-[11px] font-medium text-slate-500">
                  {card.sublabel}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
