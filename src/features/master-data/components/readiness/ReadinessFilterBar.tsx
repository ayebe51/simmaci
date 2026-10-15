import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Filter, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CILACAP_KECAMATAN, JENJANG_LIST } from './readinessConstants';

interface ReadinessFilterBarProps {
  searchTerm: string;
  debouncedSearch: string;
  filterStatus: string;
  filterKecamatan: string;
  filterJenjang: string;
  onSearchChange: (value: string) => void;
  onStatusChange: (status: string) => void;
  onKecamatanChange: (kec: string) => void;
  onJenjangChange: (jenjang: string) => void;
  onResetAll: () => void;
}

export function ReadinessFilterBar({
  searchTerm,
  debouncedSearch,
  filterStatus,
  filterKecamatan,
  filterJenjang,
  onSearchChange,
  onStatusChange,
  onKecamatanChange,
  onJenjangChange,
  onResetAll,
}: ReadinessFilterBarProps) {
  const hasActiveFilters =
    filterStatus !== 'all' ||
    filterKecamatan !== 'all' ||
    filterJenjang !== 'all' ||
    Boolean(debouncedSearch);

  return (
    <Card className="rounded-2xl border-slate-200 shadow-sm bg-white overflow-hidden">
      <CardContent className="p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
          {/* Search Input */}
          <div className="lg:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <Input
              placeholder="Cari nama madrasah, NSM, NPSN, kepala..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9.5 h-10 text-xs rounded-xl border-slate-200"
            />
            {searchTerm && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter Status */}
          <div className="lg:col-span-3">
            <Select value={filterStatus} onValueChange={onStatusChange}>
              <SelectTrigger className="h-10 text-xs rounded-xl border-slate-200 font-medium">
                <div className="flex items-center gap-2 truncate">
                  <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <SelectValue placeholder="Status Kelengkapan" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-xl text-xs">
                <SelectItem value="incomplete" className="font-bold text-amber-700">
                  ⚠️ Belum Lengkap (Semua Masalah)
                </SelectItem>
                <SelectItem value="all">Semua Status Satpen</SelectItem>
                <SelectItem value="complete" className="text-emerald-700 font-semibold">
                  🟢 Sudah Lengkap (Guru & Siswa)
                </SelectItem>
                <SelectItem value="teachers_only" className="text-sky-700">
                  🟡 Hanya Guru (Siswa Kosong)
                </SelectItem>
                <SelectItem value="students_only" className="text-indigo-700">
                  🟡 Hanya Siswa (Guru Kosong)
                </SelectItem>
                <SelectItem value="empty" className="text-rose-700 font-semibold">
                  🔴 Kosong Total (Guru 0 & Siswa 0)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filter Kecamatan */}
          <div className="lg:col-span-3">
            <Select value={filterKecamatan} onValueChange={onKecamatanChange}>
              <SelectTrigger className="h-10 text-xs rounded-xl border-slate-200 font-medium">
                <SelectValue placeholder="Pilih Kecamatan" />
              </SelectTrigger>
              <SelectContent className="rounded-xl text-xs max-h-60">
                <SelectItem value="all">Semua Kecamatan (24 Wilayah)</SelectItem>
                {CILACAP_KECAMATAN.map((kec) => (
                  <SelectItem key={kec} value={kec}>
                    Kecamatan {kec}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filter Jenjang */}
          <div className="lg:col-span-2">
            <Select value={filterJenjang} onValueChange={onJenjangChange}>
              <SelectTrigger className="h-10 text-xs rounded-xl border-slate-200 font-medium">
                <SelectValue placeholder="Jenjang" />
              </SelectTrigger>
              <SelectContent className="rounded-xl text-xs">
                <SelectItem value="all">Semua Jenjang</SelectItem>
                {JENJANG_LIST.map((j) => (
                  <SelectItem key={j} value={j}>
                    Jenjang {j}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Active Filter Badges */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 flex-wrap text-xs text-slate-500">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Filter Aktif:
            </span>

            {filterStatus !== 'all' && (
              <Badge
                variant="outline"
                className="gap-1 rounded-lg text-[11px] font-bold border-amber-300 text-amber-800 bg-amber-50"
              >
                Status: {filterStatus}
                <X
                  className="w-3 h-3 cursor-pointer hover:text-slate-900"
                  onClick={() => onStatusChange('all')}
                />
              </Badge>
            )}

            {filterKecamatan !== 'all' && (
              <Badge
                variant="outline"
                className="gap-1 rounded-lg text-[11px] font-bold border-emerald-300 text-emerald-800 bg-emerald-50"
              >
                Kecamatan: {filterKecamatan}
                <X
                  className="w-3 h-3 cursor-pointer hover:text-slate-900"
                  onClick={() => onKecamatanChange('all')}
                />
              </Badge>
            )}

            {filterJenjang !== 'all' && (
              <Badge
                variant="outline"
                className="gap-1 rounded-lg text-[11px] font-bold border-blue-300 text-blue-800 bg-blue-50"
              >
                Jenjang: {filterJenjang}
                <X
                  className="w-3 h-3 cursor-pointer hover:text-slate-900"
                  onClick={() => onJenjangChange('all')}
                />
              </Badge>
            )}

            {debouncedSearch && (
              <Badge
                variant="outline"
                className="gap-1 rounded-lg text-[11px] font-bold border-slate-300 text-slate-700 bg-slate-50"
              >
                Cari: "{debouncedSearch}"
                <X
                  className="w-3 h-3 cursor-pointer hover:text-slate-900"
                  onClick={() => onSearchChange('')}
                />
              </Badge>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={onResetAll}
              className="h-6 px-2 text-[10px] font-bold text-slate-400 hover:text-slate-700"
            >
              Reset Semua Filter
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
