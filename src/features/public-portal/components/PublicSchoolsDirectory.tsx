import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { publicPortalApi, PublicSchoolItem } from '../api/publicPortalApi';
import { useDebounce } from '@/hooks/useDebounce';
import { CILACAP_KECAMATAN, JENJANG_LIST } from '@/features/master-data/components/readiness/readinessConstants';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, School, MapPin, Building2, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

export const PublicSchoolsDirectory: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 400);
  const [selectedKecamatan, setSelectedKecamatan] = useState('all');
  const [selectedJenjang, setSelectedJenjang] = useState('all');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['public-schools-directory', debouncedSearch, selectedKecamatan, selectedJenjang, page],
    queryFn: () =>
      publicPortalApi.getSchoolsDirectory({
        search: debouncedSearch || undefined,
        kecamatan: selectedKecamatan !== 'all' ? selectedKecamatan : undefined,
        jenjang: selectedJenjang !== 'all' ? selectedJenjang : undefined,
        page,
        per_page: 9,
      }),
    staleTime: 5 * 60 * 1000,
  });

  const schools = data?.data || [];
  const totalPages = data?.last_page || 1;
  const totalItems = data?.total || 0;

  return (
    <section id="direktori" className="py-20 bg-slate-50 border-t border-slate-200/60">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Title */}
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 px-3 py-1 font-bold tracking-wider text-xs uppercase hover:bg-emerald-100">
            Direktori Lembaga
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Pencarian Satuan Pendidikan Ma'arif
          </h2>
          <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
            Temukan informasi resmi madrasah dan sekolah Ma'arif terakreditasi di seluruh wilayah Kabupaten Cilacap.
          </p>
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs mb-8 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            {/* Search Input */}
            <div className="sm:col-span-6 relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                type="text"
                placeholder="Cari nama madrasah atau NSM/NPSN..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="pl-10 h-11 rounded-xl border-slate-200 font-medium text-sm"
              />
            </div>

            {/* Kecamatan Select */}
            <div className="sm:col-span-6">
              <select
                value={selectedKecamatan}
                onChange={(e) => {
                  setSelectedKecamatan(e.target.value);
                  setPage(1);
                }}
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white font-medium text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">Semua Kecamatan (24 Wilayah)</option>
                {CILACAP_KECAMATAN.map((kec) => (
                  <option key={kec} value={kec}>
                    Kecamatan {kec}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Jenjang Badges Filter */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">
              Jenjang:
            </span>
            {['all', ...JENJANG_LIST].map((j) => {
              const active = selectedJenjang === j;
              return (
                <button
                  key={j}
                  onClick={() => {
                    setSelectedJenjang(j);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-colors ${
                    active
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {j === 'all' ? 'Semua Jenjang' : j}
                </button>
              );
            })}
            <div className="ml-auto text-xs font-semibold text-slate-500">
              Total {totalItems.toLocaleString('id-ID')} Satpen
            </div>
          </div>
        </div>

        {/* Directory Grid */}
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Memuat Direktori Satpen...
            </span>
          </div>
        ) : schools.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-3xl border border-dashed border-slate-200 p-8 space-y-3">
            <School className="w-10 h-10 text-slate-300 mx-auto" />
            <h4 className="text-base font-bold text-slate-700">Satuan Pendidikan Tidak Ditemukan</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Tidak ada data madrasah yang cocok dengan kata kunci pencarian atau filter kecamatan yang dipilih.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {schools.map((s: PublicSchoolItem) => (
              <div
                key={s.id}
                className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs hover:shadow-lg hover:border-emerald-200 transition-all duration-300 flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  {/* Jenjang & Akreditasi Badges */}
                  <div className="flex items-center justify-between">
                    <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 font-extrabold text-[11px] uppercase tracking-wide">
                      {s.jenjang || 'Madrasah'}
                    </Badge>
                    {s.akreditasi && (
                      <Badge variant="outline" className="text-[10px] font-bold text-slate-600 border-slate-200">
                        Akreditasi {s.akreditasi}
                      </Badge>
                    )}
                  </div>

                  {/* School Name */}
                  <h3 className="text-base font-black text-slate-900 group-hover:text-emerald-800 transition-colors line-clamp-2 leading-snug">
                    {s.nama}
                  </h3>

                  {/* NSM / NPSN */}
                  <div className="text-[11px] font-medium text-slate-400 space-x-2">
                    {s.nsm && <span>NSM: <b className="text-slate-600">{s.nsm}</b></span>}
                    {s.npsn && <span>• NPSN: <b className="text-slate-600">{s.npsn}</b></span>}
                  </div>

                  {/* Location Info */}
                  <div className="pt-2 text-xs text-slate-600 flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">
                      {s.alamat ? `${s.alamat}, ` : ''}Kec. {s.kecamatan || '-'}
                    </span>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-semibold text-emerald-700">LP Ma'arif NU Cilacap</span>
                  <span>{s.status_jamiyyah || "Jam'iyyah"}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-12">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-xl h-10 px-4 font-bold text-xs"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Sebelumnya
            </Button>
            <span className="text-xs font-bold text-slate-500 px-3">
              Halaman {page} dari {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-xl h-10 px-4 font-bold text-xs"
            >
              Selanjutnya
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </section>
  );
};
