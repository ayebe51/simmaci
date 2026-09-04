import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { ppdbService } from '@/services/ppdbService';
import { 
  GraduationCap, 
  Search, 
  MapPin, 
  Calendar, 
  Users, 
  ChevronRight, 
  FileCheck2, 
  CheckCircle2, 
  ArrowRight, 
  Building2, 
  BookOpen, 
  Sparkles,
  PhoneCall,
  ShieldCheck,
  Award,
  UserPlus,
  Copy
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const JENJANG_OPTIONS = ['Semua Jenjang', 'MI', 'MTs', 'MA', 'SMK'];

const KECAMATAN_CILACAP = [
  'Semua Kecamatan', 'Adipala', 'Bantarsari', 'Binangun', 'Cilacap Selatan', 
  'Cilacap Tengah', 'Cilacap Utara', 'Cimanggu', 'Cipari', 'Dayeuhluhur', 
  'Gandrungmangu', 'Jeruklegi', 'Karangpucung', 'Kawunganten', 'Kedungreja', 
  'Kesugihan', 'Kroya', 'Majenang', 'Maos', 'Nusawungu', 'Patimuan', 
  'Sampang', 'Sidareja', 'Wanareja'
];

export default function PpdbLandingPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedJenjang, setSelectedJenjang] = useState('Semua Jenjang');
  const [selectedKecamatan, setSelectedKecamatan] = useState('Semua Kecamatan');

  const { data: schoolsData, isLoading } = useQuery({
    queryKey: ['ppdb-public-schools', selectedJenjang, selectedKecamatan, searchTerm],
    queryFn: () => ppdbService.getPublicSchools({
      jenjang: selectedJenjang !== 'Semua Jenjang' ? selectedJenjang : undefined,
      kecamatan: selectedKecamatan !== 'Semua Kecamatan' ? selectedKecamatan : undefined,
      search: searchTerm || undefined,
      per_page: 24,
    }),
  });

  const schools = Array.isArray(schoolsData) 
    ? schoolsData 
    : (schoolsData?.items || schoolsData?.data?.items || schoolsData?.data || []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-emerald-50/20 to-slate-50 text-slate-900">
      {/* ── Top Header Navigation ── */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/80 border-b border-emerald-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-md shadow-emerald-600/20 font-black text-lg">
              M
            </div>
            <div>
              <span className="font-extrabold text-emerald-950 text-lg tracking-tight block leading-tight">
                PPDB TERPADU
              </span>
              <span className="text-[11px] font-semibold text-emerald-600 tracking-wider block leading-tight">
                LP MA'ARIF NU CILACAP
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              size="sm"
              onClick={() => navigate('/ppdb/daftar')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-sm flex items-center gap-1.5"
            >
              <UserPlus className="w-4 h-4" />
              Daftar Sekarang
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/ppdb/status')}
              className="border-emerald-200 text-emerald-800 hover:bg-emerald-50 hover:text-emerald-900 rounded-xl font-medium"
            >
              <FileCheck2 className="w-4 h-4 mr-1.5 text-emerald-600" />
              Lacak Status
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/login')}
              className="text-slate-600 hover:text-slate-900 rounded-xl"
            >
              Login Operator
            </Button>
          </div>
        </div>
      </header>

      {/* ── Hero Section ── */}
      <section className="relative overflow-hidden py-16 lg:py-20 bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-950 text-white">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-400/30 px-3.5 py-1 text-xs font-semibold rounded-full mb-5 inline-flex items-center gap-1.5 backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
            Penerimaan Peserta Didik Baru Terpadu Se-Kabupaten Cilacap
          </Badge>
          
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight max-w-4xl mx-auto leading-tight">
            Satu Pintu Masuk Madrasah & Sekolah <span className="text-emerald-300">Ma'arif NU</span>
          </h1>

          <p className="mt-5 text-base sm:text-lg text-emerald-100/90 max-w-2xl mx-auto font-normal leading-relaxed">
            Daftar madrasah jenjang MI, MTs, MA, dan SMK di bawah naungan LP Ma'arif NU Cilacap secara online, transparan, dan terintegrasi langsung dengan Data Induk Siswa.
          </p>

          {/* Quick CTA Actions */}
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button
              size="lg"
              onClick={() => navigate('/ppdb/daftar')}
              className="bg-emerald-400 hover:bg-emerald-300 text-emerald-950 font-black px-8 py-3 rounded-2xl shadow-xl shadow-black/20 transition-all hover:scale-[1.03] flex items-center gap-2"
            >
              <UserPlus className="w-5 h-5 text-emerald-950" />
              Daftar Online Sekarang
            </Button>
            <Button
              size="lg"
              onClick={() => {
                const el = document.getElementById('search-directory');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="bg-white text-emerald-900 hover:bg-emerald-50 font-bold px-7 py-3 rounded-2xl shadow-xl shadow-black/10 transition-all hover:scale-[1.02]"
            >
              <Search className="w-5 h-5 mr-2 text-emerald-700" />
              Pilih Madrasah di Direktori
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate('/ppdb/status')}
              className="border-emerald-400/40 text-emerald-100 hover:bg-white/10 font-semibold px-6 py-3 rounded-2xl backdrop-blur-sm"
            >
              <FileCheck2 className="w-5 h-5 mr-2 text-emerald-300" />
              Lacak Pendaftaran
            </Button>
          </div>
        </div>
      </section>

      {/* ── 4-Step Registration Workflow ── */}
      <section className="py-12 bg-white border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-xl mx-auto mb-10">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-widest block mb-1">
              Panduan Praktis
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Alur Pendaftaran 4 Langkah
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              {
                step: '01',
                title: 'Pilih Madrasah',
                desc: 'Tentukan jenjang (MI/MTs/MA/SMK), lokasi kecamatan, dan jalur pendaftaran sesuai minat.',
                icon: Building2,
              },
              {
                step: '02',
                title: 'Isi Biodata & Berkas',
                desc: 'Lengkapi data calon siswa, orang tua, serta unggah dokumen persyaratan (KK, Akta, Foto).',
                icon: BookOpen,
              },
              {
                step: '03',
                title: 'Seleksi & Pengumuman',
                desc: 'Pantau status verifikasi berkas dan ikuti jadwal tes/wawancara dari madrasah pilihan.',
                icon: Award,
              },
              {
                step: '04',
                title: 'Daftar Ulang & Aktif',
                desc: 'Konfirmasi daftar ulang dan data otomatis tercatat di Data Induk Siswa SIMMACI.',
                icon: CheckCircle2,
              },
            ].map((item, idx) => (
              <div 
                key={idx} 
                className="relative p-6 rounded-2xl bg-slate-50 border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all duration-300 group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold group-hover:scale-110 transition-transform">
                    <item.icon className="w-6 h-6 text-emerald-700" />
                  </div>
                  <span className="text-2xl font-black text-slate-300 group-hover:text-emerald-400 transition-colors">
                    {item.step}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1.5">{item.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Quick Registration Banner */}
          <div className="mt-10 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-emerald-50 via-teal-50/60 to-emerald-50 border border-emerald-200/80 flex flex-col sm:flex-row items-center justify-between gap-5 shadow-sm">
            <div className="flex items-center gap-4 text-center sm:text-left">
              <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-emerald-600/20">
                <UserPlus className="w-7 h-7" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-lg">Siap Mendaftarkan Putra/Putri Anda?</h4>
                <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-xl">
                  Buka formulir pendaftaran 5 langkah sekarang. Pilih madrasah tujuan, isi biodata, dan unggah berkas secara mandiri.
                </p>
              </div>
            </div>
            <Button
              size="lg"
              onClick={() => navigate('/ppdb/daftar')}
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-8 h-12 rounded-2xl shadow-md shrink-0 flex items-center gap-2 transition-all hover:scale-[1.02]"
            >
              Mulai Pendaftaran Online
              <ArrowRight className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* ── Directory & School Search ── */}
      <section id="search-directory" className="py-14 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-widest block mb-1">
              Direktori Lembaga
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Cari & Pilih Madrasah Tujuan
            </h2>
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Menampilkan <span className="font-bold text-emerald-800">{schools.length}</span> madrasah/sekolah
          </div>
        </div>

        {/* Filter Controls */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm mb-8 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Search Input */}
            <div className="md:col-span-6 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari nama madrasah, NPSN, atau kata kunci..."
                className="pl-10 rounded-xl bg-slate-50 border-slate-200 h-11 text-sm focus-visible:ring-emerald-600"
              />
            </div>

            {/* Kecamatan Filter */}
            <div className="md:col-span-3">
              <Select value={selectedKecamatan} onValueChange={setSelectedKecamatan}>
                <SelectTrigger className="rounded-xl bg-slate-50 border-slate-200 h-11 text-sm">
                  <SelectValue placeholder="Pilih Kecamatan" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {KECAMATAN_CILACAP.map((kec) => (
                    <SelectItem key={kec} value={kec}>{kec}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Jenjang Filter */}
            <div className="md:col-span-3 flex gap-1.5 overflow-x-auto">
              {JENJANG_OPTIONS.map((jenjang) => (
                <button
                  key={jenjang}
                  onClick={() => setSelectedJenjang(jenjang)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-1 ${
                    selectedJenjang === jenjang
                      ? 'bg-emerald-700 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {jenjang}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* School Cards Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-64 rounded-2xl bg-slate-200/70 animate-pulse" />
            ))}
          </div>
        ) : schools.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-300 p-8">
            <Building2 className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-800">Tidak ada madrasah yang sesuai kriteria</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Coba sesuaikan kata kunci pencarian atau ganti filter kecamatan dan jenjang sekolah.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {schools.map((school: any) => {
              const activePeriods = school.ppdb_periods || school.ppdbPeriods || [];
              const hasActivePeriod = activePeriods.length > 0;
              const period = hasActivePeriod ? activePeriods[0] : null;

              return (
                <Card 
                  key={school.id}
                  className="rounded-2xl border-slate-200/80 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-950/5 transition-all duration-300 flex flex-col justify-between overflow-hidden group bg-white"
                >
                  <CardHeader className="p-5 pb-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <Badge className="bg-emerald-100 text-emerald-800 border-0 font-bold text-xs uppercase px-2.5 py-0.5 rounded-lg">
                        {school.jenjang || 'Madrasah'}
                      </Badge>
                      {school.akreditasi && (
                        <Badge variant="outline" className="text-[11px] border-slate-200 text-slate-600 font-medium">
                          Akreditasi {school.akreditasi}
                        </Badge>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-800 transition-colors line-clamp-2">
                      {school.nama}
                    </h3>

                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{school.kecamatan || 'Kabupaten Cilacap'}</span>
                      {school.npsn && <span className="text-slate-300">•</span>}
                      {school.npsn && <span>NPSN {school.npsn}</span>}
                    </div>
                  </CardHeader>

                  <CardContent className="p-5 pt-0">
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 my-3 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Status PPDB:</span>
                        <Badge className={`text-[10px] font-semibold ${
                          hasActivePeriod 
                            ? 'bg-emerald-600 text-white' 
                            : 'bg-amber-100 text-amber-800 border-amber-200'
                        }`}>
                          {hasActivePeriod ? 'Pendaftaran Dibuka' : 'Jadwal Reguler'}
                        </Badge>
                      </div>

                      {period && (
                        <div className="flex items-center justify-between text-slate-600">
                          <span>Gelombang:</span>
                          <span className="font-semibold text-slate-800">{period.wave_name}</span>
                        </div>
                      )}
                      
                      {period?.quota > 0 && (
                        <div className="flex items-center justify-between text-slate-600">
                          <span>Daya Tampung:</span>
                          <span className="font-semibold text-emerald-800">{period.quota} Kuota</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => navigate(`/ppdb/daftar/${school.npsn || school.id}`)}
                        className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl text-xs h-10 shadow-sm flex items-center justify-center gap-1.5 transition-all"
                      >
                        Daftar ke Madrasah Ini
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        title="Salin Tautan Pendaftaran Langsung"
                        onClick={() => {
                          const url = `${window.location.origin}/ppdb/daftar/${school.npsn || school.id}`;
                          navigator.clipboard.writeText(url);
                          toast.success(`Tautan PPDB ${school.nama} berhasil disalin!`);
                        }}
                        className="h-10 w-10 rounded-xl border-slate-200 text-slate-600 hover:text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50 shrink-0"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Footer ── */}
      <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold">
              M
            </div>
            <div>
              <p className="font-bold text-white text-sm">LP Ma'arif NU Cabang Cilacap</p>
              <p className="text-slate-500">Sistem Informasi Manajemen Terpadu & PPDB Online</p>
            </div>
          </div>

          <div className="text-center md:text-right text-slate-500">
            <p>© {new Date().getFullYear()} SIMMACI • Lembaga Pendidikan Ma'arif NU Cilacap.</p>
            <p className="mt-0.5">Maju Bersama Pendidikan Ma'arif NU Berkarakter Aswaja.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
