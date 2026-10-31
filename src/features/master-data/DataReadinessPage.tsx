import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { schoolApi, SchoolReadinessItem } from '@/lib/api';
import { useDebounce } from '@/hooks/useDebounce';
import { getCurrentUser } from '@/lib/authHelpers';
import SoftPageHeader from '@/components/ui/SoftPageHeader';
import { Button } from '@/components/ui/button';
import { ClipboardCheck, Download, RefreshCw, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

import {
  normalizeWhatsappNumber,
  generateWaMessage,
} from './components/readiness/readinessConstants';
import { exportReadinessToExcel } from './components/readiness/readinessExport';
import { ReadinessKpiCards } from './components/readiness/ReadinessKpiCards';
import { ReadinessFilterBar } from './components/readiness/ReadinessFilterBar';
import { ReadinessTable } from './components/readiness/ReadinessTable';
import { QuickEditManualModal } from './components/readiness/QuickEditManualModal';
import { WhatsAppReminderModal } from './components/readiness/WhatsAppReminderModal';

export default function DataReadinessPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Strict Role Guard: Only Super Admin can access Monitoring Pendataan
  const currentUser = getCurrentUser();
  const isSuperAdmin = currentUser?.role === 'super_admin';

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

  // Quick edit modal state
  const [editSchool, setEditSchool] = useState<SchoolReadinessItem | null>(null);

  // WhatsApp dialog state
  const [waSchool, setWaSchool] = useState<SchoolReadinessItem | null>(null);
  const [isExporting, setIsExporting] = useState(false);

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
  const { data, isLoading, isFetching, refetch } = useQuery({
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
    enabled: isSuperAdmin,
  });

  const summary = data?.summary;
  const schools = data?.data || [];
  const totalPages = data?.last_page || 1;

  // Quick update mutation
  const quickUpdateMutation = useMutation({
    mutationFn: ({
      schoolId,
      count,
      perClass,
    }: {
      schoolId: number;
      count: number | null;
      perClass?: Record<string, number> | null;
    }) => schoolApi.updateManualStudents(schoolId, count, perClass),
    onSuccess: (res) => {
      toast.success(res.message || 'Jumlah siswa berhasil diperbarui!');
      setEditSchool(null);
      queryClient.invalidateQueries({ queryKey: ['schools-data-readiness'] });
      queryClient.invalidateQueries({ queryKey: ['distribution-map-data'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Gagal menyimpan jumlah siswa');
    },
  });

  const handleOpenQuickEdit = (school: SchoolReadinessItem) => {
    setEditSchool(school);
  };

  const handleSaveQuickEdit = (data: { total: number | null; perClass: Record<string, number> | null }) => {
    if (!editSchool) return;

    quickUpdateMutation.mutate({
      schoolId: editSchool.id,
      count: data.total,
      perClass: data.perClass,
    });
  };

  const handleSendWa = (school: SchoolReadinessItem) => {
    const rawPhone = school.kepala_whatsapp || school.telepon;
    const phone = normalizeWhatsappNumber(rawPhone);
    if (!phone) {
      toast.warning('Nomor WhatsApp Kepala Madrasah / Lembaga belum terdata');
      setWaSchool(school);
      return;
    }

    const msg = generateWaMessage(school);
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const handleCopyWaMessage = (school: SchoolReadinessItem) => {
    const msg = generateWaMessage(school);
    navigator.clipboard.writeText(msg);
    toast.success('Pesan pengingat WhatsApp berhasil disalin ke clipboard!');
  };

  const handleExportExcel = async (exportType: 'incomplete' | 'all') => {
    setIsExporting(true);
    await exportReadinessToExcel({
      exportType,
      debouncedSearch,
      filterKecamatan,
      filterJenjang,
    });
    setIsExporting(false);
  };

  // Access Denied screen for non-Super Admin
  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center max-w-md mx-auto space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shadow-sm">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-slate-900 tracking-tight">
          Akses Khusus Super Admin
        </h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          Mohon maaf, menu dan fitur Monitoring Kesiapan Data hanya dapat diakses oleh akun Super Administrator PC LP Ma'arif NU Kabupaten Cilacap.
        </p>
        <Button
          onClick={() => navigate('/dashboard')}
          className="rounded-xl font-bold text-xs bg-emerald-700 hover:bg-emerald-800 text-white"
        >
          Kembali ke Dashboard
        </Button>
      </div>
    );
  }

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

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExportExcel('incomplete')}
            disabled={isExporting}
            className="rounded-xl h-10 border-amber-300 text-amber-800 bg-amber-50/60 hover:bg-amber-100 font-bold gap-2 shadow-sm"
          >
            <Download className="w-4 h-4 text-amber-600" />
            <span>Ekspor Belum Lengkap (.xlsx)</span>
          </Button>

          <Button
            size="sm"
            onClick={() => handleExportExcel('all')}
            disabled={isExporting}
            className="rounded-xl h-10 bg-emerald-700 hover:bg-emerald-800 text-white font-bold gap-2 shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>Ekspor Data Siswa (.xlsx)</span>
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

      {/* Main Table */}
      <ReadinessTable
        schools={schools}
        totalSchools={data?.total ?? 0}
        isLoading={isLoading}
        filterStatus={filterStatus}
        currentPage={currentPage}
        perPage={perPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        onPerPageChange={(newPerPage) => {
          setPerPage(newPerPage);
          setCurrentPage(1);
        }}
        onOpenQuickEdit={handleOpenQuickEdit}
        onSendWa={handleSendWa}
      />

      {/* Quick Edit Modal */}
      <QuickEditManualModal
        editSchool={editSchool}
        isPending={quickUpdateMutation.isPending}
        onClose={() => setEditSchool(null)}
        onSubmit={handleSaveQuickEdit}
      />

      {/* WhatsApp Reminder Template Modal */}
      <WhatsAppReminderModal
        school={waSchool}
        onClose={() => setWaSchool(null)}
        onCopy={handleCopyWaMessage}
        onSend={handleSendWa}
      />
    </div>
  );
}
