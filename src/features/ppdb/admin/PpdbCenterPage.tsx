import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ppdbService } from '@/services/ppdbService';
import { authApi } from '@/lib/api';
import { 
  GraduationCap, 
  Users, 
  FileCheck2, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Search, 
  Filter, 
  Download, 
  Plus, 
  Eye, 
  Award, 
  RefreshCw, 
  Settings, 
  Calendar, 
  ExternalLink,
  ShieldCheck,
  Building2,
  FileText,
  UserCheck,
  Trash2,
  Lock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import SoftPageHeader from '@/components/ui/SoftPageHeader';
import { PpdbRegistration, PpdbPeriod } from '@/types/ppdb';

export default function PpdbCenterPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const user = authApi.getStoredUser();
  const isSuperAdmin = ['super_admin', 'admin_yayasan'].includes(user?.role);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [trackFilter, setTrackFilter] = useState('ALL');
  const [selectedReg, setSelectedReg] = useState<PpdbRegistration | null>(null);

  // Verification Dialog State
  const [isVerifyOpen, setIsVerifyOpen] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState('verified');
  const [verifyNotes, setVerifyNotes] = useState('');

  // Scoring Dialog State
  const [isScoreOpen, setIsScoreOpen] = useState(false);
  const [testScore, setTestScore] = useState<string>('');
  const [interviewScore, setInterviewScore] = useState<string>('');
  const [decision, setDecision] = useState<'accepted' | 'reserved' | 'rejected'>('accepted');
  const [selectionNotes, setSelectionNotes] = useState('');

  // Period Dialog State
  const [isPeriodModalOpen, setIsPeriodModalOpen] = useState(false);
  const [periodForm, setPeriodForm] = useState<Partial<PpdbPeriod>>({
    academic_year: '2026/2027',
    wave_name: 'Gelombang 1 - Reguler',
    quota: 100,
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    announcement_date: new Date(Date.now() + 35 * 86400000).toISOString().split('T')[0],
    reregistration_end_date: new Date(Date.now() + 45 * 86400000).toISOString().split('T')[0],
    is_active: true,
  });

  // Queries
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['ppdb-stats'],
    queryFn: () => ppdbService.getStats(),
  });

  const { data: registrationsData, isLoading: isLoadingRegs } = useQuery({
    queryKey: ['ppdb-registrations', statusFilter, trackFilter, searchTerm],
    queryFn: () => ppdbService.getRegistrations({
      status: statusFilter !== 'ALL' ? statusFilter : undefined,
      track: trackFilter !== 'ALL' ? trackFilter : undefined,
      search: searchTerm || undefined,
      per_page: 50,
    }),
  });

  const { data: periodsData } = useQuery({
    queryKey: ['ppdb-periods'],
    queryFn: () => ppdbService.getPeriods(),
  });

  const { data: schoolsList } = useQuery({
    queryKey: ['ppdb-schools-selector'],
    queryFn: () => ppdbService.getPublicSchools({ per_page: 200 }),
    enabled: isSuperAdmin,
  });

  const registrations: PpdbRegistration[] = registrationsData?.data?.items || registrationsData?.data || [];
  const periods: PpdbPeriod[] = periodsData?.data?.items || periodsData?.data || [];
  const schools = schoolsList?.data?.items || schoolsList?.data || [];

  // Mutations
  const verifyMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) => ppdbService.verifyRegistration(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ppdb-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['ppdb-stats'] });
      setIsVerifyOpen(false);
      toast.success('Status verifikasi berkas berhasil diperbarui!');
    },
    onError: () => toast.error('Gagal memperbarui verifikasi berkas.'),
  });

  const scoreMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) => ppdbService.submitScore(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ppdb-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['ppdb-stats'] });
      setIsScoreOpen(false);
      toast.success('Hasil seleksi & keputusan berhasil disimpan!');
    },
    onError: () => toast.error('Gagal menyimpan hasil seleksi.'),
  });

  const reregisterMutation = useMutation({
    mutationFn: (id: number) => ppdbService.confirmReregistration(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['ppdb-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['ppdb-stats'] });
      toast.success('Daftar Ulang Selesai! Data otomatis disinkronkan ke Data Induk Siswa.');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Gagal memproses daftar ulang.');
    },
  });

  const createPeriodMutation = useMutation({
    mutationFn: (payload: any) => ppdbService.createPeriod(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ppdb-periods'] });
      queryClient.invalidateQueries({ queryKey: ['ppdb-stats'] });
      queryClient.invalidateQueries({ queryKey: ['ppdb-public-schools'] });
      queryClient.invalidateQueries({ queryKey: ['ppdb-schools-selector'] });
      queryClient.invalidateQueries({ queryKey: ['ppdb-selected-school'] });
      setIsPeriodModalOpen(false);
      setActiveTab('periods');
      toast.success('Gelombang PPDB berhasil ditambahkan!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Gagal menambahkan gelombang PPDB.');
    },
  });

  const deletePeriodMutation = useMutation({
    mutationFn: (id: number) => ppdbService.deletePeriod(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ppdb-periods'] });
      queryClient.invalidateQueries({ queryKey: ['ppdb-stats'] });
      queryClient.invalidateQueries({ queryKey: ['ppdb-public-schools'] });
      queryClient.invalidateQueries({ queryKey: ['ppdb-selected-school'] });
      toast.success('Gelombang PPDB berhasil dihapus!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Gagal menghapus gelombang PPDB.');
    },
  });

  const canManagePeriod = (period: PpdbPeriod) => {
    if (isSuperAdmin) return true;
    if (user?.school_id && period.school_id === user.school_id) return true;
    return false;
  };

  // Export Excel Handler
  const handleExport = async () => {
    try {
      const data = await ppdbService.exportData();
      if (!data || data.length === 0) {
        toast.error('Tidak ada data untuk diekspor.');
        return;
      }

      // Convert to CSV download
      const headers = Object.keys(data[0]).join(',');
      const rows = data.map((row: any) => 
        Object.values(row).map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',')
      ).join('\n');

      const blob = new Blob([`${headers}\n${rows}`], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Rekap_PPDB_Maarif_Cilacap_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      toast.success('Data PPDB berhasil diekspor!');
    } catch {
      toast.error('Gagal mengekspor data.');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'submitted':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Menunggu Verifikasi</Badge>;
      case 'verified':
        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Berkas Valid</Badge>;
      case 'revision_needed':
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Perlu Perbaikan</Badge>;
      case 'accepted':
        return <Badge className="bg-emerald-600 text-white font-bold">Lolos / Diterima</Badge>;
      case 'reserved':
        return <Badge className="bg-purple-100 text-purple-800 border-purple-200">Cadangan</Badge>;
      case 'reregistered':
        return <Badge className="bg-emerald-700 text-white font-bold">🎓 Terdaftar Aktif</Badge>;
      case 'rejected':
        return <Badge className="bg-rose-100 text-rose-800 border-rose-200">Tidak Diterima</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ── Soft Glass Header ── */}
      <SoftPageHeader
        title="Pusat PPDB Terpadu"
        description="Portal manajemen penerimaan peserta didik baru satu pintu, verifikasi berkas online, penilaian hasil seleksi, dan otomatisasi sinkronisasi langsung ke Data Induk Siswa SIMMACI."
        icon={<GraduationCap className="w-6 h-6 text-emerald-600" />}
      />

      {/* ── Role & Madrasah Scope Banner ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white/70 backdrop-blur-md px-5 py-3 rounded-2xl border border-slate-200/80 shadow-xs text-xs">
        <div className="flex items-center gap-2.5 flex-wrap">
          {isSuperAdmin ? (
            <Badge className="bg-emerald-700 text-white font-bold py-1 px-3">
              👑 Super Admin / PC LP Ma'arif
            </Badge>
          ) : (
            <Badge className="bg-blue-700 text-white font-bold py-1 px-3 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              Operator Satpen: {user?.unit || user?.school?.name || user?.name || 'Madrasah'}
            </Badge>
          )}
          <span className="text-slate-600 font-medium text-xs">
            {isSuperAdmin 
              ? 'Akses penuh: Mengelola gelombang serentak se-kabupaten & memantau seluruh pendaftaran madrasah.'
              : `Akses terbatas: Memverifikasi & mengelola pendaftar khusus ${user?.unit || user?.school?.name || 'madrasah Anda'}.`}
          </span>
        </div>
      </div>

      {/* ── Tabbed Navigation ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-white/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-wrap gap-1 h-auto">
          <TabsTrigger value="dashboard" className="rounded-xl px-4 py-2 text-xs font-bold data-[state=active]:bg-emerald-700 data-[state=active]:text-white">
            📊 Ringkasan & Statistik
          </TabsTrigger>
          <TabsTrigger value="registrations" className="rounded-xl px-4 py-2 text-xs font-bold data-[state=active]:bg-emerald-700 data-[state=active]:text-white">
            📝 Data Pendaftar ({registrations.length})
          </TabsTrigger>
          <TabsTrigger value="selection" className="rounded-xl px-4 py-2 text-xs font-bold data-[state=active]:bg-emerald-700 data-[state=active]:text-white">
            🏆 Seleksi & Nilai
          </TabsTrigger>
          <TabsTrigger value="reregistration" className="rounded-xl px-4 py-2 text-xs font-bold data-[state=active]:bg-emerald-700 data-[state=active]:text-white">
            ⚡ Daftar Ulang & Auto-Sync
          </TabsTrigger>
          <TabsTrigger value="periods" className="rounded-xl px-4 py-2 text-xs font-bold data-[state=active]:bg-emerald-700 data-[state=active]:text-white">
            ⚙️ Pengaturan Gelombang
          </TabsTrigger>
        </TabsList>

        {/* ════════ TAB 1: DASHBOARD & STATISTIK ════════ */}
        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="rounded-2xl border-slate-200 shadow-sm bg-white p-5">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Total Pendaftar</span>
                <Users className="w-4 h-4 text-emerald-600" />
              </div>
              <span className="text-2xl font-black text-slate-900">{stats?.total_registrations || 0}</span>
              <p className="text-[11px] text-slate-500 mt-1">Seluruh jalur & gelombang</p>
            </Card>

            <Card className="rounded-2xl border-slate-200 shadow-sm bg-white p-5">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Berkas Terverifikasi</span>
                <FileCheck2 className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-2xl font-black text-blue-900">{stats?.verified || 0}</span>
              <p className="text-[11px] text-blue-600 mt-1">{stats?.submitted || 0} pendaftar baru</p>
            </Card>

            <Card className="rounded-2xl border-slate-200 shadow-sm bg-white p-5">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Dinyatakan Lolos</span>
                <Award className="w-4 h-4 text-emerald-600" />
              </div>
              <span className="text-2xl font-black text-emerald-900">{stats?.accepted || 0}</span>
              <p className="text-[11px] text-emerald-600 mt-1">Siap daftar ulang</p>
            </Card>

            <Card className="rounded-2xl border-slate-200 shadow-sm bg-white p-5 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-emerald-200">
              <div className="flex items-center justify-between text-emerald-800 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Tersinkron ke Siswa</span>
                <UserCheck className="w-4 h-4 text-emerald-700" />
              </div>
              <span className="text-2xl font-black text-emerald-950">{stats?.reregistered || 0}</span>
              <p className="text-[11px] text-emerald-700 font-medium mt-1">100% Otomatis terintegrasi</p>
            </Card>
          </div>

          {/* Quick Actions Card */}
          <Card className="rounded-3xl border-slate-200 shadow-sm bg-white p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="font-extrabold text-base text-slate-900">
                  Integrasi Satu Pintu & Ekspor Rekapitulasi
                </h3>
                <p className="text-xs text-slate-500 max-w-xl">
                  Data calon siswa yang telah menyelesaikan proses daftar ulang otomatis disinkronisasi ke Master Siswa SIMMACI dengan identitas resmi NISN/NIK dan QR Code profil.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={handleExport}
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold h-10"
                >
                  <Download className="w-4 h-4 mr-1.5 text-emerald-700" />
                  Ekspor Excel (EMIS / Dapodik)
                </Button>
                <Button
                  onClick={() => window.open('/ppdb', '_blank')}
                  size="sm"
                  className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold h-10"
                >
                  <ExternalLink className="w-4 h-4 mr-1.5" />
                  Buka Portal Publik
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* ════════ TAB 2: DATA PENDAFTAR & VERIFIKASI ════════ */}
        <TabsContent value="registrations" className="space-y-4">
          <Card className="rounded-3xl border-slate-200 shadow-sm bg-white p-6">
            {/* Filter Bar */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-3 mb-6">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Cari nama, No. Reg, atau NISN..."
                  className="pl-9 rounded-xl h-10 text-xs bg-slate-50"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="rounded-xl h-10 text-xs w-44 bg-slate-50">
                    <SelectValue placeholder="Status Verifikasi" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Semua Status</SelectItem>
                    <SelectItem value="submitted">Menunggu Verifikasi</SelectItem>
                    <SelectItem value="verified">Berkas Valid</SelectItem>
                    <SelectItem value="revision_needed">Perlu Perbaikan</SelectItem>
                    <SelectItem value="accepted">Diterima</SelectItem>
                    <SelectItem value="reregistered">Terdaftar Aktif</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={trackFilter} onValueChange={setTrackFilter}>
                  <SelectTrigger className="rounded-xl h-10 text-xs w-36 bg-slate-50">
                    <SelectValue placeholder="Jalur" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Semua Jalur</SelectItem>
                    <SelectItem value="reguler">Reguler</SelectItem>
                    <SelectItem value="prestasi">Prestasi</SelectItem>
                    <SelectItem value="tahfidz">Tahfidz</SelectItem>
                    <SelectItem value="afirmasi">Afirmasi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-600 font-bold">
                    <th className="py-3 px-3">No. Registrasi</th>
                    <th className="py-3 px-3">Nama Calon Siswa</th>
                    <th className="py-3 px-3">Madrasah Tujuan</th>
                    <th className="py-3 px-3">Jalur</th>
                    <th className="py-3 px-3">Asal Sekolah</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {registrations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        Belum ada data pendaftar yang sesuai filter.
                      </td>
                    </tr>
                  ) : (
                    registrations.map((reg) => (
                      <tr key={reg.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-3 font-mono font-bold text-emerald-950">
                          {reg.registration_number}
                        </td>
                        <td className="py-3.5 px-3">
                          <p className="font-bold text-slate-900">{reg.nama_lengkap}</p>
                          <p className="text-[11px] text-slate-500">NIK: {reg.nik} • WA: {reg.no_whatsapp}</p>
                        </td>
                        <td className="py-3.5 px-3 font-medium text-slate-700">
                          {reg.school?.nama}
                        </td>
                        <td className="py-3.5 px-3">
                          <Badge variant="outline" className="text-[10px] uppercase font-bold">
                            {reg.track}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-3 text-slate-600">{reg.asal_sekolah}</td>
                        <td className="py-3.5 px-3">{getStatusBadge(reg.status)}</td>
                        <td className="py-3.5 px-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedReg(reg);
                              setVerifyStatus(reg.status);
                              setVerifyNotes(reg.verification_notes || '');
                              setIsVerifyOpen(true);
                            }}
                            className="rounded-xl h-8 px-3 text-xs border-slate-200 text-slate-700 hover:text-emerald-800 hover:bg-emerald-50"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            Verifikasi
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ════════ TAB 3: SELEKSI & PENILAIAN ════════ */}
        <TabsContent value="selection" className="space-y-4">
          <Card className="rounded-3xl border-slate-200 shadow-sm bg-white p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">
                  Input Nilai & Penetapan Hasil Seleksi
                </h3>
                <p className="text-xs text-slate-500">
                  Masukkan skor tes keagamaan/Aswaja, wawancara, dan tetapkan keputusan kelulusan.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-600 font-bold">
                    <th className="py-3 px-3">No. Reg</th>
                    <th className="py-3 px-3">Nama Siswa</th>
                    <th className="py-3 px-3">Jalur</th>
                    <th className="py-3 px-3">Nilai Tes</th>
                    <th className="py-3 px-3">Nilai Wawancara</th>
                    <th className="py-3 px-3">Skor Akhir</th>
                    <th className="py-3 px-3">Keputusan</th>
                    <th className="py-3 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {registrations.filter(r => ['verified', 'accepted', 'reserved', 'rejected', 'reregistered'].includes(r.status)).map((reg) => (
                    <tr key={reg.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-3 font-mono font-bold text-slate-900">{reg.registration_number}</td>
                      <td className="py-3.5 px-3 font-bold text-slate-800">{reg.nama_lengkap}</td>
                      <td className="py-3.5 px-3 uppercase text-[10px] font-bold text-slate-600">{reg.track}</td>
                      <td className="py-3.5 px-3 font-semibold">{reg.test_score ?? '-'}</td>
                      <td className="py-3.5 px-3 font-semibold">{reg.interview_score ?? '-'}</td>
                      <td className="py-3.5 px-3 font-black text-emerald-900">{reg.final_score ?? '-'}</td>
                      <td className="py-3.5 px-3">{getStatusBadge(reg.status)}</td>
                      <td className="py-3.5 px-3 text-right">
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedReg(reg);
                            setTestScore(reg.test_score ? String(reg.test_score) : '');
                            setInterviewScore(reg.interview_score ? String(reg.interview_score) : '');
                            setDecision((['accepted', 'reserved', 'rejected'].includes(reg.status) ? reg.status : 'accepted') as any);
                            setSelectionNotes(reg.selection_notes || '');
                            setIsScoreOpen(true);
                          }}
                          className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl h-8 px-3 text-xs"
                        >
                          <Award className="w-3.5 h-3.5 mr-1" />
                          Nilai / Luluskan
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ════════ TAB 4: DAFTAR ULANG & AUTO-SYNC ════════ */}
        <TabsContent value="reregistration" className="space-y-4">
          <Card className="rounded-3xl border-slate-200 shadow-sm bg-white p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">
                  Konfirmasi Daftar Ulang & Auto-Sync ke Data Induk Siswa
                </h3>
                <p className="text-xs text-slate-500">
                  Siswa yang diverifikasi telah daftar ulang otomatis dimasukkan ke Master Siswa SIMMACI.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-600 font-bold">
                    <th className="py-3 px-3">No. Registrasi</th>
                    <th className="py-3 px-3">Nama Siswa</th>
                    <th className="py-3 px-3">Madrasah</th>
                    <th className="py-3 px-3">Status PPDB</th>
                    <th className="py-3 px-3">Status Data Induk</th>
                    <th className="py-3 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {registrations.filter(r => ['accepted', 'reregistered'].includes(r.status)).map((reg) => (
                    <tr key={reg.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-3 font-mono font-bold">{reg.registration_number}</td>
                      <td className="py-3.5 px-3">
                        <p className="font-bold text-slate-900">{reg.nama_lengkap}</p>
                        <p className="text-[11px] text-slate-500">NISN: {reg.nisn || '-'}</p>
                      </td>
                      <td className="py-3.5 px-3 text-slate-700">{reg.school?.nama}</td>
                      <td className="py-3.5 px-3">{getStatusBadge(reg.status)}</td>
                      <td className="py-3.5 px-3">
                        {reg.is_reregistered ? (
                          <div className="space-y-0.5">
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold text-[10px]">
                              ✓ Tersinkronisasi
                            </Badge>
                            <span className="block text-[10px] text-slate-700 font-medium">
                              Siswa Aktif {reg.student?.kelas ? `(Kelas ${reg.student.kelas})` : ''}
                            </span>
                            {reg.nisn && (
                              <span className="block text-[9px] text-slate-400 font-mono">
                                NISN: {reg.nisn}
                              </span>
                            )}
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-amber-700 border-amber-300 text-[10px]">
                            Menunggu Daftar Ulang
                          </Badge>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        {!reg.is_reregistered ? (
                          <Button
                            size="sm"
                            disabled={reregisterMutation.isPending}
                            onClick={() => reregisterMutation.mutate(reg.id)}
                            className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl h-8 px-3 text-xs font-bold"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            Konfirmasi Daftar Ulang
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate('/dashboard/students-center')}
                            className="rounded-xl h-8 px-3 text-xs text-emerald-800 hover:bg-emerald-50"
                          >
                            Buka Master Siswa →
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ════════ TAB 5: PENGATURAN GELOMBANG ════════ */}
        <TabsContent value="periods" className="space-y-4">
          <Card className="rounded-3xl border-slate-200 shadow-sm bg-white p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">
                  Gelombang & Kuota PPDB
                </h3>
                <p className="text-xs text-slate-500">
                  Atur jadwal buka/tutup pendaftaran, kuota daya tampung, dan tanggal pengumuman.
                </p>
              </div>

              <Button
                onClick={() => setIsPeriodModalOpen(true)}
                size="sm"
                className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold h-10"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Tambah Gelombang Baru
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {periods.map((period) => (
                <div 
                  key={period.id}
                  className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 relative flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Badge className="bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        {period.academic_year}
                      </Badge>
                      <Badge className={period.is_active ? 'bg-emerald-600 text-white text-[10px]' : 'bg-slate-300 text-slate-700 text-[10px]'}>
                        {period.is_active ? 'Aktif' : 'Non-Aktif'}
                      </Badge>
                    </div>

                    <h4 className="font-bold text-sm text-slate-900 mb-1">{period.wave_name}</h4>
                    {period.school ? (
                      <p className="text-xs text-emerald-800 font-semibold mb-2 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{period.school.nama}</span>
                      </p>
                    ) : (
                      <p className="text-xs text-teal-700 font-semibold mb-2 flex items-center gap-1.5">
                        <span className="text-sm">🌐</span>
                        <span>Berlaku Serentak (Semua Madrasah)</span>
                      </p>
                    )}

                    <div className="space-y-1 text-xs text-slate-600">
                      <p>• <strong>Pendaftaran:</strong> {period.start_date} s.d. {period.end_date}</p>
                      <p>• <strong>Pengumuman:</strong> {period.announcement_date || '-'}</p>
                      <p>• <strong>Daya Tampung:</strong> <span className="font-bold text-emerald-800">{period.quota} Kuota</span></p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200/80 flex justify-between items-center text-[11px] text-slate-500">
                    <span>{period.registrations_count || 0} Pendaftar</span>
                    <div className="flex items-center gap-2">
                      {!canManagePeriod(period) ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 font-medium bg-slate-200/60 px-2 py-0.5 rounded-full">
                          <Lock className="w-3 h-3" /> Serentak (Read-only)
                        </span>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={deletePeriodMutation.isPending}
                          onClick={() => {
                            if (window.confirm(`Hapus gelombang "${period.wave_name}"?`)) {
                              deletePeriodMutation.mutate(period.id);
                            }
                          }}
                          className="h-7 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg text-xs"
                          title="Hapus Gelombang"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" /> Hapus
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {periods.length === 0 && (
                <div className="col-span-3 text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Calendar className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-700">Belum ada gelombang PPDB yang terdaftar</p>
                  <p className="text-xs text-slate-400 mt-0.5">Klik tombol 'Tambah Gelombang Baru' di atas untuk membuka periode penerimaan siswa baru.</p>
                </div>
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Dialog Verifikasi Berkas ── */}
      <Dialog open={isVerifyOpen} onOpenChange={setIsVerifyOpen}>
        <DialogContent className="max-w-xl rounded-3xl p-6 bg-white">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900">
              Verifikasi Berkas Calon Siswa
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Periksa dokumen pendaftaran dan tentukan status validasi.
            </DialogDescription>
          </DialogHeader>

          {selectedReg && (
            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                <p><strong>Nama:</strong> {selectedReg.nama_lengkap} ({selectedReg.registration_number})</p>
                <p><strong>Jalur:</strong> {selectedReg.track?.toUpperCase()} • <strong>Asal Sekolah:</strong> {selectedReg.asal_sekolah}</p>
                <p><strong>No WhatsApp:</strong> {selectedReg.no_whatsapp}</p>
              </div>

              {/* Uploaded Documents Link Preview */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700">Dokumen yang Diunggah:</Label>
                <div className="grid grid-cols-2 gap-2">
                  {selectedReg.foto_url && (
                    <a href={selectedReg.foto_url} target="_blank" rel="noreferrer" className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-emerald-50 text-emerald-800 font-semibold flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" /> Pas Foto 3x4 ↗
                    </a>
                  )}
                  {selectedReg.kk_url && (
                    <a href={selectedReg.kk_url} target="_blank" rel="noreferrer" className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-emerald-50 text-emerald-800 font-semibold flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" /> Kartu Keluarga ↗
                    </a>
                  )}
                  {selectedReg.akta_url && (
                    <a href={selectedReg.akta_url} target="_blank" rel="noreferrer" className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-emerald-50 text-emerald-800 font-semibold flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" /> Akta Kelahiran ↗
                    </a>
                  )}
                  {selectedReg.ijazah_url && (
                    <a href={selectedReg.ijazah_url} target="_blank" rel="noreferrer" className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-emerald-50 text-emerald-800 font-semibold flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" /> Ijazah / SKL ↗
                    </a>
                  )}
                  {selectedReg.prestasi_url && (
                    <a href={selectedReg.prestasi_url} target="_blank" rel="noreferrer" className="p-2.5 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-900 font-semibold flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5" /> Piagam Prestasi ↗
                    </a>
                  )}
                </div>
              </div>

              {/* Status Decision */}
              <div className="space-y-1.5 pt-2">
                <Label className="text-xs font-bold text-slate-700">Status Verifikasi *</Label>
                <Select value={verifyStatus} onValueChange={setVerifyStatus}>
                  <SelectTrigger className="rounded-xl h-10 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="verified">✅ Berkas Valid & Diterima</SelectItem>
                    <SelectItem value="revision_needed">⚠️ Perlu Perbaikan Berkas</SelectItem>
                    <SelectItem value="rejected">❌ Berkas Ditolak</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Revision Notes */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Catatan untuk Calon Siswa (Opsional / Terkirim via WA)</Label>
                <Textarea
                  value={verifyNotes}
                  onChange={(e) => setVerifyNotes(e.target.value)}
                  placeholder="Contoh: Foto KK kurang jelas, mohon unggah ulang foto yang lebih terang."
                  className="rounded-xl text-xs"
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter className="pt-4 flex justify-between">
            <Button variant="outline" onClick={() => setIsVerifyOpen(false)} className="rounded-xl text-xs">
              Batal
            </Button>
            <Button
              disabled={verifyMutation.isPending}
              onClick={() => {
                if (selectedReg) {
                  verifyMutation.mutate({
                    id: selectedReg.id,
                    payload: { status: verifyStatus, verification_notes: verifyNotes },
                  });
                }
              }}
              className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold px-5"
            >
              Simpan Verifikasi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog Scoring & Seleksi ── */}
      <Dialog open={isScoreOpen} onOpenChange={setIsScoreOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 bg-white">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900">
              Input Nilai Seleksi & Keputusan
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Masukkan perolehan nilai tes dan tetapkan status kelulusan.
            </DialogDescription>
          </DialogHeader>

          {selectedReg && (
            <div className="space-y-3.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="font-bold text-slate-900">{selectedReg.nama_lengkap}</span>
                <p className="text-slate-500 text-[11px]">{selectedReg.registration_number}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Nilai Tes Keagamaan</Label>
                  <Input
                    type="number"
                    value={testScore}
                    onChange={(e) => setTestScore(e.target.value)}
                    placeholder="0 - 100"
                    className="rounded-xl h-10 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Nilai Wawancara</Label>
                  <Input
                    type="number"
                    value={interviewScore}
                    onChange={(e) => setInterviewScore(e.target.value)}
                    placeholder="0 - 100"
                    className="rounded-xl h-10 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Keputusan Hasil Seleksi *</Label>
                <Select value={decision} onValueChange={(val) => setDecision(val as any)}>
                  <SelectTrigger className="rounded-xl h-10 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="accepted">🎉 DITERIMA (Lolos Seleksi)</SelectItem>
                    <SelectItem value="reserved">📋 CADANGAN</SelectItem>
                    <SelectItem value="rejected">❌ TIDAK DITERIMA</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Catatan Tambahan</Label>
                <Input
                  value={selectionNotes}
                  onChange={(e) => setSelectionNotes(e.target.value)}
                  placeholder="Catatan prestasi / peringkat"
                  className="rounded-xl h-10 text-xs"
                />
              </div>
            </div>
          )}

          <DialogFooter className="pt-3">
            <Button variant="outline" onClick={() => setIsScoreOpen(false)} className="rounded-xl text-xs">
              Batal
            </Button>
            <Button
              disabled={scoreMutation.isPending}
              onClick={() => {
                if (selectedReg) {
                  scoreMutation.mutate({
                    id: selectedReg.id,
                    payload: {
                      test_score: testScore ? Number(testScore) : undefined,
                      interview_score: interviewScore ? Number(interviewScore) : undefined,
                      decision,
                      selection_notes: selectionNotes,
                    },
                  });
                }
              }}
              className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold px-5"
            >
              Simpan Keputusan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog Tambah Gelombang Baru ── */}
      <Dialog open={isPeriodModalOpen} onOpenChange={setIsPeriodModalOpen}>
        <DialogContent className="max-w-lg rounded-3xl p-6 bg-white">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900">
              Buka Gelombang PPDB Baru
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Buat periode pendaftaran baru beserta kuota daya tampung madrasah.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs">
            {isSuperAdmin && (
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Satuan Pendidikan / Madrasah Tujuan *</Label>
                <Select
                  value={periodForm.school_id ? String(periodForm.school_id) : 'ALL'}
                  onValueChange={(val) => setPeriodForm(p => ({ ...p, school_id: val === 'ALL' ? null : Number(val) }))}
                >
                  <SelectTrigger className="rounded-xl h-10 text-xs bg-slate-50">
                    <SelectValue placeholder="Pilih Madrasah atau Serentak" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    <SelectItem value="ALL">🌐 Berlaku Serentak (Semua Madrasah se-Kabupaten)</SelectItem>
                    {schools.map((sch: any) => (
                      <SelectItem key={sch.id} value={String(sch.id)}>
                        [{sch.jenjang || 'Madrasah'}] {sch.nama} - {sch.kecamatan}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Tahun Ajaran *</Label>
                <Input
                  value={periodForm.academic_year}
                  onChange={(e) => setPeriodForm(p => ({ ...p, academic_year: e.target.value }))}
                  placeholder="2026/2027"
                  className="rounded-xl h-10 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Nama Gelombang *</Label>
                <Input
                  value={periodForm.wave_name}
                  onChange={(e) => setPeriodForm(p => ({ ...p, wave_name: e.target.value }))}
                  placeholder="Contoh: Gelombang 1 - Reguler"
                  className="rounded-xl h-10 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Tanggal Mulai Buka *</Label>
                <Input
                  type="date"
                  value={periodForm.start_date}
                  onChange={(e) => setPeriodForm(p => ({ ...p, start_date: e.target.value }))}
                  className="rounded-xl h-10 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Tanggal Ditutup *</Label>
                <Input
                  type="date"
                  value={periodForm.end_date}
                  onChange={(e) => setPeriodForm(p => ({ ...p, end_date: e.target.value }))}
                  className="rounded-xl h-10 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Tanggal Pengumuman</Label>
                <Input
                  type="date"
                  value={periodForm.announcement_date}
                  onChange={(e) => setPeriodForm(p => ({ ...p, announcement_date: e.target.value }))}
                  className="rounded-xl h-10 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Daya Tampung / Kuota *</Label>
                <Input
                  type="number"
                  value={periodForm.quota}
                  onChange={(e) => setPeriodForm(p => ({ ...p, quota: Number(e.target.value) }))}
                  placeholder="Jumlah siswa"
                  className="rounded-xl h-10 text-xs"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-3">
            <Button variant="outline" onClick={() => setIsPeriodModalOpen(false)} className="rounded-xl text-xs">
              Batal
            </Button>
            <Button
              disabled={createPeriodMutation.isPending}
              onClick={() => createPeriodMutation.mutate(periodForm)}
              className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold px-5"
            >
              Simpan Gelombang
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
