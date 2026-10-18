import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { schoolApi } from '@/lib/api';
import { useDebounce } from '@/hooks/useDebounce';
import SoftPageHeader from '@/components/ui/SoftPageHeader';
import { Button } from '@/components/ui/button';
import { ClipboardCheck, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

import { ReadinessKpiCards } from './components/readiness/ReadinessKpiCards';
import { ReadinessFilterBar } from './components/readiness/ReadinessFilterBar';

export default function DataReadinessPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // URL state management
  const initialStatus = searchParams.get('status') || 'incomplete';
  const initialKecamatan = searchParams.get('kecamatan') || 'all';
  const initialJenjang = searchParams.get('jenjang') || 'all';

  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 400);

  const [filterStatus, setFilterStatus] = useState<string>(initialStatus);
  const [filterKecamatan, setFilterKecamatan] = useState<string>(initialKecamatan);
  const [filterJenjang, setFilterJenjang] = useState<string>(initialJenjang);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [perPage, setPerPage] = useState<number>(20);

  // Sync state with URL when filters change
  const handleStatusChange = (newStatus: string) => {
    setFilterStatus(newStatus);
    setCurrentPage(1);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (newStatus === 'all') next.delete('status');
      else next.set('status', newStatus);
      return next;
    });
  };

  const handleKecamatanChange = (newKec: string) => {
    setFilterKecamatan(newKec);
    setCurrentPage(1);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (newKec === 'all') next.delete('kecamatan');
      else next.set('kecamatan', newKec);
      return next;
    });
  };

  const handleJenjangChange = (newJenjang: string) => {
    setFilterJenjang(newJenjang);
    setCurrentPage(1);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (newJenjang === 'all') next.delete('jenjang');
      else next.set('jenjang', newJenjang);
      return next;
    });
  };

  const handleResetAll = () => {
    setFilterStatus('all');
    setFilterKecamatan('all');
    setFilterJenjang('all');
    setSearchTerm('');
    setSearchParams({});
  };

  // API Query
  const { data, isFetching, refetch } = useQuery({
    queryKey: [
      'schools-data-readiness',
      debouncedSearch,
      filterKecamatan,
      filterJenjang,
      filterStatus,
      currentPage,
      perPage,
    ],
    queryFn: () =>
      schoolApi.getDataReadiness({
        search: debouncedSearch || undefined,
        kecamatan: filterKecamatan !== 'all' ? filterKecamatan : undefined,
        jenjang: filterJenjang !== 'all' ? filterJenjang : undefined,
        status: filterStatus,
        page: currentPage,
        per_page: perPage,
      }),
  });

  const summary = data?.summary;

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <SoftPageHeader
          title="Monitoring Kesiapan Data Satpen"
          description="Pantau kelengkapan penginputan data guru dan siswa madrasah se-Kabupaten Cilacap, isolasi madrasah yang belum lengkap, serta kelola estimasi jumlah siswa."
          icon={<ClipboardCheck className="w-6 h-6 text-emerald-600" />}
        />

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="rounded-xl h-10 border-slate-200 text-slate-700 font-bold hover:bg-slate-50 gap-2 shadow-sm"
          >
            <RefreshCw className={cn('w-4 h-4 text-emerald-600', isFetching && 'animate-spin')} />
            <span>Segarkan</span>
          </Button>
        </div>
      </div>

      {/* Interactive KPI Cards */}
      <ReadinessKpiCards
        summary={summary}
        filterStatus={filterStatus}
        onStatusChange={handleStatusChange}
      />

      {/* Filter Toolbar */}
      <ReadinessFilterBar
        searchTerm={searchTerm}
        debouncedSearch={debouncedSearch}
        filterStatus={filterStatus}
        filterKecamatan={filterKecamatan}
        filterJenjang={filterJenjang}
        onSearchChange={setSearchTerm}
        onStatusChange={handleStatusChange}
        onKecamatanChange={handleKecamatanChange}
        onJenjangChange={handleJenjangChange}
        onResetAll={handleResetAll}
      />
    </div>
  );
}
