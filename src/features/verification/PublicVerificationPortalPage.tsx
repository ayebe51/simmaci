import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ShieldCheck,
  Search,
  FileCheck,
  User,
  GraduationCap,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ScanLine,
} from 'lucide-react';
import { verificationApi } from '@/lib/api';

type Category = 'sk' | 'teacher' | 'student';

export default function PublicVerificationPortalPage() {
  const navigate = useNavigate();
  const [category, setCategory] = useState<Category>('sk');
  const [queryCode, setQueryCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ status: 'idle' | 'success' | 'not_found' | 'expired'; data?: any; message?: string }>({ status: 'idle' });

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = queryCode.trim();
    if (!q) return;

    setIsLoading(true);
    setResult({ status: 'idle' });

    try {
      if (category === 'sk') {
        const res = await verificationApi.verifyBySk(q);
        const d = res?.data?.data ?? res?.data;
        if (d?.nomor_sk) {
          setResult({ status: d.is_expired ? 'expired' : 'success', data: d });
        } else {
          setResult({ status: 'not_found', message: `Nomor SK "${q}" tidak ditemukan dalam database atau belum aktif.` });
        }
      } else if (category === 'teacher') {
        const res = await verificationApi.verifyByNim(q);
        const d = res?.data?.data ?? res?.data;
        if (d?.nama || d?.nuptk || d?.nip) {
          setResult({ status: 'success', data: d });
        } else {
          setResult({ status: 'not_found', message: `Data Guru/PTK "${q}" tidak ditemukan dalam sistem.` });
        }
      } else {
        const res = await verificationApi.verifyByNisn(q);
        const d = res?.data?.data ?? res?.data;
        if (d?.nama || d?.nisn) {
          setResult({ status: 'success', data: d });
        } else {
          setResult({ status: 'not_found', message: `Data Siswa NISN "${q}" tidak ditemukan dalam sistem.` });
        }
      }
    } catch {
      setResult({ status: 'not_found', message: `Data dengan nomor identitas "${q}" tidak terdaftar dalam sistem resmi.` });
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = [
    { key: 'sk' as Category, label: 'Surat Keputusan (SK)', icon: FileCheck, ph: 'Contoh: 012/PC/LP.Maarif/SK/VII/2025' },
    { key: 'teacher' as Category, label: 'Pendidik / Guru', icon: User, ph: 'Masukkan NUPTK atau NIM Guru...' },
    { key: 'student' as Category, label: 'Siswa (NISN)', icon: GraduationCap, ph: 'Masukkan NISN Siswa...' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-10">
        <div className="container max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src="/images/logo-maarif-hijau.png" alt="Logo" className="h-9 w-auto object-contain" onError={(e) => { (e.target as HTMLImageElement).src = '/logo-maarif-hijau.png'; }} />
            <div>
              <span className="font-black text-sm text-slate-900 block leading-none">LP Ma'arif NU Cilacap</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Portal Verifikasi Resmi</span>
            </div>
          </Link>
          <Link to="/" className="text-xs font-bold text-slate-500 hover:text-emerald-700 flex items-center gap-1.5 transition-colors">
            <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Kembali ke Beranda</span>
          </Link>
        </div>
      </header>

      <main className="container max-w-3xl mx-auto px-4 py-12 flex-1">
        <div className="text-center space-y-3 mb-8">
          <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto shadow-xs">
            <ShieldCheck className="w-8 h-8 text-emerald-700" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Verifikasi Keaslian Dokumen & Legalitas</h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
            Periksa keabsahan SK, identitas Pendidik (PTK), dan legalitas siswa terbitan resmi PC LP Ma'arif NU Kabupaten Cilacap.
          </p>
        </div>

        <Card className="rounded-3xl border border-slate-200/90 shadow-lg bg-white overflow-hidden mb-8">
          <CardHeader className="border-b border-slate-100 pb-5">
            <div className="flex flex-wrap items-center justify-center gap-2">
              {tabs.map((t) => {
                const Icon = t.icon;
                const active = category === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => { setCategory(t.key); setResult({ status: 'idle' }); }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${active ? 'bg-emerald-700 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    <Icon className="w-3.5 h-3.5" /> <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </CardHeader>

          <CardContent className="p-6 sm:p-8 space-y-6">
            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase text-slate-500 tracking-wider mb-2">
                  {category === 'sk' ? 'Nomor Surat Keputusan (SK)' : category === 'teacher' ? 'NUPTK / NIM Guru' : 'NISN Siswa'}
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    required
                    value={queryCode}
                    onChange={(e) => setQueryCode(e.target.value)}
                    placeholder={tabs.find((t) => t.key === category)?.ph}
                    className="h-12 pl-4 pr-10 rounded-xl border-slate-200 font-medium text-sm focus:ring-emerald-500"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <Button type="submit" disabled={isLoading || !queryCode.trim()} className="w-full sm:flex-1 h-11 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs uppercase tracking-wider shadow-xs gap-2">
                  {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Memverifikasi...</span></> : <><ShieldCheck className="w-4 h-4" /><span>Periksa Keaslian Dokumen</span></>}
                </Button>
                <Button type="button" variant="outline" onClick={() => navigate('/scan')} className="w-full sm:w-auto h-11 rounded-xl border-slate-200 text-slate-700 font-bold text-xs gap-2">
                  <ScanLine className="w-4 h-4 text-emerald-600" /> <span>Scan QR Code</span>
                </Button>
              </div>
            </form>

            {result.status === 'success' && result.data && (
              <div className="mt-6 p-6 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-4 animate-in fade-in duration-300">
                <div className="flex items-center gap-3 pb-3 border-b border-emerald-200/60">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0" />
                  <div>
                    <Badge className="bg-emerald-700 text-white font-extrabold text-[10px] uppercase tracking-wider mb-1">Dokumen Sah & Terverifikasi</Badge>
                    <h3 className="text-base font-black text-slate-900 leading-snug">Data Terdaftar Resmi di LP Ma'arif NU Cilacap</h3>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
                  {category === 'sk' && (
                    <>
                      <div><span className="text-slate-500 font-medium block">Nomor SK:</span><span className="font-mono font-bold text-slate-800 break-all">{result.data.nomor_sk}</span></div>
                      <div><span className="text-slate-500 font-medium block">Penerima / PTK:</span><span className="font-bold text-slate-900">{result.data.nama || '-'}</span></div>
                      <div><span className="text-slate-500 font-medium block">Jabatan / Tugas:</span><span className="font-bold text-slate-800">{result.data.jabatan || '-'}</span></div>
                      <div><span className="text-slate-500 font-medium block">Satuan Pendidikan:</span><span className="font-bold text-emerald-800">{result.data.school?.nama || result.data.unit_kerja || '-'}</span></div>
                      <div><span className="text-slate-500 font-medium block">Tanggal Penetapan:</span><span className="font-semibold text-slate-800">{result.data.tanggal_penetapan || '-'}</span></div>
                      <div><span className="text-slate-500 font-medium block">Status:</span><span className="font-bold text-emerald-700 uppercase">Aktif / Berlaku</span></div>
                    </>
                  )}
                  {category === 'teacher' && (
                    <>
                      <div><span className="text-slate-500 font-medium block">Nama Pendidik:</span><span className="font-bold text-slate-900">{result.data.nama || '-'}</span></div>
                      <div><span className="text-slate-500 font-medium block">NUPTK / NIP:</span><span className="font-mono font-bold text-slate-800">{result.data.nuptk || result.data.nip || '-'}</span></div>
                      <div><span className="text-slate-500 font-medium block">Pangkalan Satpen:</span><span className="font-bold text-emerald-800">{result.data.school?.nama || result.data.unit_kerja || '-'}</span></div>
                      <div><span className="text-slate-500 font-medium block">Status:</span><span className="font-semibold text-slate-800">{result.data.status || 'Aktif'}</span></div>
                    </>
                  )}
                  {category === 'student' && (
                    <>
                      <div><span className="text-slate-500 font-medium block">Nama Siswa:</span><span className="font-bold text-slate-900">{result.data.nama || '-'}</span></div>
                      <div><span className="text-slate-500 font-medium block">NISN:</span><span className="font-mono font-bold text-slate-800">{result.data.nisn || '-'}</span></div>
                      <div><span className="text-slate-500 font-medium block">Madrasah:</span><span className="font-bold text-emerald-800">{result.data.school?.nama || '-'}</span></div>
                      <div><span className="text-slate-500 font-medium block">Status:</span><span className="font-bold text-emerald-700">Aktif Terdaftar</span></div>
                    </>
                  )}
                </div>
              </div>
            )}

            {result.status === 'expired' && result.data && (
              <div className="mt-6 p-6 rounded-2xl bg-amber-50 border border-amber-200 space-y-2 animate-in fade-in duration-300">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-7 h-7 text-amber-600 shrink-0" />
                  <div>
                    <Badge className="bg-amber-600 text-white font-extrabold text-[10px] uppercase tracking-wider mb-1">Masa Berlaku Kadaluarsa</Badge>
                    <h3 className="text-sm font-black text-slate-900">SK Ditemukan Namun Telah Habis Masa Berlaku</h3>
                  </div>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed">
                  SK nomor <b>{result.data.nomor_sk}</b> telah berakhir masa berlakunya pada {result.data.tanggal_kadaluarsa || '-'}.
                </p>
              </div>
            )}

            {result.status === 'not_found' && (
              <div className="mt-6 p-6 rounded-2xl bg-red-50 border border-red-200 text-center space-y-2 animate-in fade-in duration-300">
                <XCircle className="w-9 h-9 text-red-500 mx-auto" />
                <h4 className="text-sm font-bold text-red-900">Data Tidak Ditemukan</h4>
                <p className="text-xs text-red-700 max-w-md mx-auto leading-relaxed">{result.message}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 text-xs text-slate-500 space-y-2">
          <p className="font-bold text-slate-700 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Keamanan & Validasi Digital LP Ma'arif NU Cilacap</span>
          </p>
          <p className="leading-relaxed">
            Seluruh Surat Keputusan dan dokumen resmi dilengkapi QR Code kriptografis. Jika ada ketidaksesuaian data fisik dengan verifikasi sistem, hubungi sekretariat resmi PC LP Ma'arif NU Cilacap.
          </p>
        </div>
      </main>

      <footer className="bg-white border-t border-slate-100 py-6 text-center text-xs text-slate-400">
        <p>© {new Date().getFullYear()} SIMMACI • PC LP Ma'arif NU Kabupaten Cilacap</p>
      </footer>
    </div>
  );
}
