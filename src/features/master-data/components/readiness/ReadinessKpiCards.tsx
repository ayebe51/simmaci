import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SchoolReadinessSummary } from '@/lib/api';

interface ReadinessKpiCardsProps {
  summary?: SchoolReadinessSummary;
  filterStatus: string;
  onStatusChange: (status: string) => void;
}

export function ReadinessKpiCards({
  summary,
  filterStatus,
  onStatusChange,
}: ReadinessKpiCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Card: Incomplete / Perlu Tindakan */}
      <Card
        onClick={() => onStatusChange(filterStatus === 'incomplete' ? 'all' : 'incomplete')}
        className={cn(
          'border-2 cursor-pointer transition-all duration-200 rounded-2xl shadow-sm hover:shadow-md relative overflow-hidden',
          filterStatus === 'incomplete'
            ? 'border-amber-500 bg-amber-50/70 shadow-amber-100'
            : 'border-slate-200/80 bg-white hover:border-amber-300'
        )}
      >
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Belum Lengkap</span>
            </span>
            <Badge
              className={cn(
                'text-[10px] font-extrabold',
                filterStatus === 'incomplete'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-100 text-amber-800 border-amber-200'
              )}
            >
              {filterStatus === 'incomplete' ? 'Aktif Terfilter' : 'Klik Filter'}
            </Badge>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {summary?.incomplete_count ?? 0}
            </p>
            <span className="text-xs font-bold text-slate-500">
              dari {summary?.total_schools ?? 0} Satpen
            </span>
          </div>
          <p className="text-[11px] text-amber-900/80 font-medium mt-1">
            Guru kosong, siswa kosong, atau keduanya
          </p>
        </CardContent>
      </Card>

      {/* Card: Sudah Lengkap */}
      <Card
        onClick={() => onStatusChange(filterStatus === 'complete' ? 'all' : 'complete')}
        className={cn(
          'border-2 cursor-pointer transition-all duration-200 rounded-2xl shadow-sm hover:shadow-md relative overflow-hidden',
          filterStatus === 'complete'
            ? 'border-emerald-500 bg-emerald-50/70 shadow-emerald-100'
            : 'border-slate-200/80 bg-white hover:border-emerald-300'
        )}
      >
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Sudah Lengkap</span>
            </span>
            <Badge
              className={cn(
                'text-[10px] font-extrabold',
                filterStatus === 'complete'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-100 text-emerald-800 border-emerald-200'
              )}
            >
              {summary?.completion_percentage ?? 0}%
            </Badge>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {summary?.complete_count ?? 0}
            </p>
            <span className="text-xs font-bold text-emerald-700">Satpen Tertib</span>
          </div>
          <p className="text-[11px] text-emerald-900/80 font-medium mt-1">
            Sudah menginput guru & siswa aktif
          </p>
        </CardContent>
      </Card>

      {/* Card: Hanya Data Guru */}
      <Card
        onClick={() => onStatusChange(filterStatus === 'teachers_only' ? 'all' : 'teachers_only')}
        className={cn(
          'border-2 cursor-pointer transition-all duration-200 rounded-2xl shadow-sm hover:shadow-md relative overflow-hidden',
          filterStatus === 'teachers_only'
            ? 'border-sky-500 bg-sky-50/70 shadow-sky-100'
            : 'border-slate-200/80 bg-white hover:border-sky-300'
        )}
      >
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-sky-800 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-4 h-4 text-sky-600" />
              <span>Hanya Guru</span>
            </span>
            <Badge
              className={cn(
                'text-[10px] font-extrabold',
                filterStatus === 'teachers_only'
                  ? 'bg-sky-600 text-white'
                  : 'bg-sky-100 text-sky-800 border-sky-200'
              )}
            >
              Siswa = 0
            </Badge>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {summary?.teachers_only_count ?? 0}
            </p>
            <span className="text-xs font-bold text-sky-700">Satpen</span>
          </div>
          <p className="text-[11px] text-sky-900/80 font-medium mt-1">
            Guru sudah ada, belum isi siswa
          </p>
        </CardContent>
      </Card>

      {/* Card: Kosong Total */}
      <Card
        onClick={() => onStatusChange(filterStatus === 'empty' ? 'all' : 'empty')}
        className={cn(
          'border-2 cursor-pointer transition-all duration-200 rounded-2xl shadow-sm hover:shadow-md relative overflow-hidden',
          filterStatus === 'empty'
            ? 'border-rose-500 bg-rose-50/70 shadow-rose-100'
            : 'border-slate-200/80 bg-white hover:border-rose-300'
        )}
      >
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>Kosong Total</span>
            </span>
            <Badge
              className={cn(
                'text-[10px] font-extrabold',
                filterStatus === 'empty'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-100 text-rose-800 border-rose-200'
              )}
            >
              Prioritas
            </Badge>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {summary?.empty_count ?? 0}
            </p>
            <span className="text-xs font-bold text-rose-700">Satpen Kosong</span>
          </div>
          <p className="text-[11px] text-rose-900/80 font-medium mt-1">
            Belum ada data guru maupun siswa
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
