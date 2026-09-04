import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ppdbService } from '@/services/ppdbService';
import { 
  Search, 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  XCircle, 
  Building2, 
  User, 
  Award, 
  Printer, 
  FileCheck2,
  Calendar,
  Sparkles,
  MapPin,
  QrCode
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export default function PpdbStatusCheckPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialQuery = searchParams.get('reg') || searchParams.get('q') || '';

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [activeQuery, setActiveQuery] = useState(initialQuery);

  const { data: registration, isLoading, isError } = useQuery({
    queryKey: ['ppdb-status-check', activeQuery],
    queryFn: () => ppdbService.checkStatus(activeQuery),
    enabled: !!activeQuery.trim(),
    retry: false,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      toast.error('Masukkan Nomor Registrasi, NISN, atau NIK.');
      return;
    }
    setActiveQuery(searchQuery.trim());
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'submitted':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Menunggu Verifikasi Berkas</Badge>;
      case 'verified':
        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Berkas Terverifikasi</Badge>;
      case 'revision_needed':
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Perlu Perbaikan Berkas</Badge>;
      case 'accepted':
        return <Badge className="bg-emerald-600 text-white font-bold">🎉 Dinyatakan DITERIMA</Badge>;
      case 'reserved':
        return <Badge className="bg-purple-100 text-purple-800 border-purple-200">Daftar Cadangan</Badge>;
      case 'reregistered':
        return <Badge className="bg-emerald-700 text-white font-bold">🎓 Resmi Terdaftar (Daftar Ulang Selesai)</Badge>;
      case 'rejected':
        return <Badge className="bg-rose-100 text-rose-800 border-rose-200">Belum Lolos Seleksi</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* ── Top Header ── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 print:hidden">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/ppdb')}
            className="text-slate-600 hover:text-emerald-800 rounded-xl"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Kembali ke Beranda
          </Button>

          <span className="font-extrabold text-emerald-950 text-sm tracking-tight">
            STATUS & PENGUMUMAN PPDB
          </span>

          <Button
            size="sm"
            onClick={() => navigate('/ppdb/daftar')}
            className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs"
          >
            Daftar Baru
          </Button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 pt-8">
        {/* Search Box */}
        <Card className="rounded-3xl border-slate-200 shadow-sm bg-white p-6 mb-8 print:hidden">
          <form onSubmit={handleSearch} className="space-y-3">
            <h2 className="text-base font-bold text-slate-800">
              Lacak Status Pendaftaran & Pengumuman
            </h2>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Masukkan Nomor Registrasi (PPDB-2026-xxx), NISN, atau NIK"
                  className="pl-10 rounded-xl h-11 text-sm bg-slate-50"
                />
              </div>
              <Button
                type="submit"
                disabled={isLoading}
                className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl px-6 h-11 text-xs font-bold"
              >
                {isLoading ? 'Mencari...' : 'Cek Status'}
              </Button>
            </div>
          </form>
        </Card>

        {/* ── Result Card ── */}
        {isLoading && (
          <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 animate-pulse space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-200 mx-auto" />
            <div className="h-4 bg-slate-200 rounded max-w-xs mx-auto" />
          </div>
        )}

        {isError && !isLoading && (
          <div className="p-8 text-center bg-white rounded-3xl border border-dashed border-rose-200 text-slate-600 space-y-2">
            <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
            <h3 className="font-bold text-slate-800">Data Pendaftaran Tidak Ditemukan</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Pastikan nomor yang Anda masukkan sesuai dengan Nomor Registrasi, NISN, atau NIK saat mendaftar.
            </p>
          </div>
        )}

        {registration && !isLoading && (
          <div className="space-y-6">
            {/* Main Status Header Card */}
            <Card className="rounded-3xl border-slate-200 shadow-sm bg-white overflow-hidden">
              <CardHeader className="p-6 border-b border-slate-100 bg-gradient-to-r from-emerald-50/50 to-teal-50/30">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
                      Nomor Registrasi:
                    </span>
                    <span className="text-xl font-black text-emerald-950 font-mono">
                      {registration.registration_number}
                    </span>
                  </div>
                  <div>{getStatusBadge(registration.status)}</div>
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-6">
                {/* Visual Progress Steps */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                  <span className="text-xs font-bold text-slate-700 block">Progres Pendaftaran:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-center text-xs">
                    {/* 1. Submitted */}
                    <div className="p-2.5 rounded-xl bg-emerald-100/70 text-emerald-900 font-semibold flex sm:flex-col items-center justify-between sm:justify-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                      <span>1. Terdaftar</span>
                    </div>

                    {/* 2. Document Verification */}
                    <div className={`p-2.5 rounded-xl font-semibold flex sm:flex-col items-center justify-between sm:justify-center gap-1 ${
                      registration.status === 'revision_needed'
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : ['verified', 'accepted', 'reserved', 'reregistered'].includes(registration.status)
                          ? 'bg-emerald-100/70 text-emerald-900'
                          : 'bg-slate-200/60 text-slate-500'
                    }`}>
                      {['verified', 'accepted', 'reserved', 'reregistered'].includes(registration.status) ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                      ) : registration.status === 'revision_needed' ? (
                        <AlertTriangle className="w-4 h-4 text-amber-700" />
                      ) : (
                        <Clock className="w-4 h-4 text-slate-400" />
                      )}
                      <span>2. Verifikasi Berkas</span>
                    </div>

                    {/* 3. Selection Result */}
                    <div className={`p-2.5 rounded-xl font-semibold flex sm:flex-col items-center justify-between sm:justify-center gap-1 ${
                      ['accepted', 'reregistered'].includes(registration.status)
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : registration.status === 'reserved'
                          ? 'bg-purple-100 text-purple-900'
                          : registration.status === 'rejected'
                            ? 'bg-rose-100 text-rose-900'
                            : 'bg-slate-200/60 text-slate-500'
                    }`}>
                      {['accepted', 'reregistered'].includes(registration.status) ? (
                        <Award className="w-4 h-4" />
                      ) : (
                        <Clock className="w-4 h-4" />
                      )}
                      <span>3. Hasil Seleksi</span>
                    </div>

                    {/* 4. Reregistration / Sync */}
                    <div className={`p-2.5 rounded-xl font-semibold flex sm:flex-col items-center justify-between sm:justify-center gap-1 ${
                      registration.is_reregistered || registration.status === 'reregistered'
                        ? 'bg-emerald-700 text-white shadow-sm'
                        : 'bg-slate-200/60 text-slate-500'
                    }`}>
                      {registration.is_reregistered ? (
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      ) : (
                        <Clock className="w-4 h-4" />
                      )}
                      <span>4. Daftar Ulang</span>
                    </div>
                  </div>

                  {/* Notes / Instructions */}
                  {registration.verification_notes && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 mt-2">
                      <strong>Catatan Panitia PPDB:</strong> {registration.verification_notes}
                    </div>
                  )}
                </div>

                {/* Candidate Information Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 space-y-1">
                    <span className="text-slate-500">Nama Lengkap:</span>
                    <p className="font-bold text-slate-900 text-sm">{registration.nama_lengkap}</p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 space-y-1">
                    <span className="text-slate-500">NISN / Asal Sekolah:</span>
                    <p className="font-bold text-slate-900 text-sm">
                      {registration.nisn || '-'} ({registration.asal_sekolah})
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 space-y-1">
                    <span className="text-slate-500">Madrasah Pilihan:</span>
                    <p className="font-bold text-emerald-900 text-sm">{registration.school?.nama}</p>
                    <p className="text-slate-500">{registration.school?.kecamatan}</p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 space-y-1">
                    <span className="text-slate-500">Jalur & Gelombang:</span>
                    <p className="font-bold text-slate-900 text-sm">
                      Jalur {registration.track?.toUpperCase()} ({registration.period?.wave_name})
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-2 flex flex-wrap justify-end gap-3 print:hidden">
                  <Button
                    onClick={() => window.print()}
                    variant="outline"
                    className="rounded-xl border-slate-300 text-xs font-semibold h-10"
                  >
                    <Printer className="w-4 h-4 mr-1.5 text-slate-600" />
                    Cetak Bukti Pendaftaran
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Printable Registration Card (Visible on Print) */}
            <div className="p-8 rounded-3xl border-2 border-emerald-800 bg-white space-y-6 hidden print:block">
              <div className="text-center border-b-2 border-emerald-800 pb-4">
                <h2 className="text-lg font-black text-emerald-950">LP MA'ARIF NU CABANG CILACAP</h2>
                <h3 className="text-base font-bold text-slate-800">KARTU TANDA BUKTI PENDAFTARAN PPDB ONLINE</h3>
                <p className="text-xs text-slate-600">Tahun Ajaran {registration.period?.academic_year || '2026/2027'}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p><strong>Nomor Registrasi:</strong> {registration.registration_number}</p>
                  <p><strong>Nama Lengkap:</strong> {registration.nama_lengkap}</p>
                  <p><strong>NISN:</strong> {registration.nisn || '-'}</p>
                  <p><strong>Asal Sekolah:</strong> {registration.asal_sekolah}</p>
                </div>
                <div>
                  <p><strong>Madrasah Tujuan:</strong> {registration.school?.nama}</p>
                  <p><strong>Jalur Masuk:</strong> {registration.track?.toUpperCase()}</p>
                  <p><strong>Status Terakhir:</strong> {registration.status?.toUpperCase()}</p>
                  <p><strong>Tanggal Daftar:</strong> {registration.submitted_at}</p>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4 flex justify-between items-center text-xs text-slate-500">
                <span>Dokumen ini diterbitkan secara otomatis oleh SIMMACI.</span>
                <span>Cilacap, {new Date().toLocaleDateString('id-ID')}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
