import React from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, FileCheck, ScanLine, ArrowRight, Building, Mail, Phone, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const PublicServicesHub: React.FC = () => {
  const navigate = useNavigate();

  const services = [
    {
      title: 'Penerimaan Peserta Didik Baru (PPDB)',
      desc: 'Portal pendaftaran siswa baru secara online untuk seluruh madrasah MI, MTs, MA, dan SMK Ma\'arif se-Kabupaten Cilacap.',
      link: '/ppdb',
      btnLabel: 'Buka Portal PPDB',
      icon: GraduationCap,
      color: 'bg-emerald-600',
    },
    {
      title: 'Verifikasi Keaslian SK & Dokumen',
      desc: 'Cek validitas dan keaslian Surat Keputusan (SK) dan sertifikat resmi terbitan PC LP Ma\'arif NU Cilacap berbasis QR Code.',
      link: '/verify',
      btnLabel: 'Cek Verifikasi',
      icon: FileCheck,
      color: 'bg-blue-600',
    },
    {
      title: 'Scanner Presensi Kegiatan & Acara',
      desc: 'Akses scanner publik untuk presensi mandiri kegiatan rapat, seminar, dan acara resmi jam\'iyyah tanpa login.',
      link: '/scan',
      btnLabel: 'Buka Scanner',
      icon: ScanLine,
      color: 'bg-teal-600',
    },
  ];

  return (
    <section id="layanan" className="py-20 bg-white">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Title */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="text-xs font-black uppercase text-emerald-700 tracking-widest">
            Akses Layanan Publik
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Pusat Layanan SIMMACI
          </h2>
          <p className="text-slate-600 text-sm sm:text-base">
            Layanan digital resmi untuk masyarakat umum, wali murid, pendidik, dan pengurus madrasah.
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {services.map((srv) => {
            const Icon = srv.icon;
            return (
              <div
                key={srv.title}
                className="p-8 rounded-3xl bg-slate-50 border border-slate-200/80 hover:border-emerald-300 hover:shadow-xl transition-all duration-300 flex flex-col justify-between group"
              >
                <div className="space-y-4">
                  <div className={`w-14 h-14 rounded-2xl ${srv.color} text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform duration-300`}>
                    <Icon className="w-7 h-7" />
                  </div>
                  <h3 className="text-lg font-black text-slate-900 leading-snug">
                    {srv.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {srv.desc}
                  </p>
                </div>

                <div className="pt-6 mt-6 border-t border-slate-200/60">
                  <Button
                    onClick={() => navigate(srv.link)}
                    className="w-full h-11 rounded-xl bg-white hover:bg-slate-900 text-slate-900 hover:text-white border border-slate-200 font-bold text-xs uppercase tracking-wider transition-all duration-200 shadow-2xs gap-2"
                  >
                    <span>{srv.btnLabel}</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Official Footer */}
        <footer className="pt-16 mt-16 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
          <div className="flex items-center gap-4">
            <img
              src="/images/logo-maarif-hijau.png"
              alt="Logo LP Ma'arif NU"
              className="h-12 w-auto object-contain rounded-xs"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/logo-maarif-hijau.png';
              }}
            />
            <div>
              <h4 className="text-sm font-black text-slate-900">LP Ma'arif NU Cilacap</h4>
              <p className="text-xs text-slate-500">Sistem Informasi Manajemen (SIMMACI)</p>
            </div>
          </div>

          <div className="text-xs text-slate-500 space-y-1.5 md:text-right">
            <p className="font-semibold text-slate-700 flex items-center justify-center md:justify-end gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Sekretariat LP Ma'arif NU Cilacap:</span>
            </p>
            <p className="text-slate-600">
              Jl. Masjid No. 1/36, RT 01/RW 01, Kel. Sidanegara, Kec. Cilacap Tengah, Kab. Cilacap, Jawa Tengah 53223
            </p>
            <p className="flex items-center justify-center md:justify-end gap-3 text-slate-400">
              <span className="flex items-center gap-1">
                <Phone className="w-3 h-3 text-slate-400" />
                (0282) 521141
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Mail className="w-3 h-3 text-slate-400" />
                admin@maarifnucilacap.or.id
              </span>
            </p>
            <p className="text-slate-400 text-[11px] pt-1">
              © {new Date().getFullYear()} LP Ma'arif NU Cilacap. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </section>
  );
};
