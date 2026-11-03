import React, { useState } from 'react';
import { Award, CheckCircle2, Quote, ZoomIn } from 'lucide-react';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';
import { Badge } from '@/components/ui/badge';

interface LeaderProfile {
  name: string;
  role: string;
  subRole: string;
  imageSrc: string;
  quote: string;
  initials: string;
}

const LEADERS: LeaderProfile[] = [
  {
    name: 'H. Ali Sodiqin, S.Ag., M.Pd.I.',
    role: 'Ketua Pengurus Cabang',
    subRole: 'LP Ma\'arif NU Cilacap',
    imageSrc: '/images/pimpinan/ketua.png',
    quote:
      'Transformasi digital SIMMACI adalah ikhtiar strategis dalam menghadirkan tata kelola pendidikan madrasah Ma\'arif yang transparan, akuntabel, dan bermartabat demi melahirkan generasi unggul Ahlussunnah wal Jama\'ah.',
    initials: 'AS',
  },
  {
    name: 'Ngadino, S.Pd.I., M.Pd.',
    role: 'Sekretaris Pengurus Cabang',
    subRole: 'LP Ma\'arif NU Cilacap',
    imageSrc: '/images/pimpinan/sekretaris.png',
    quote:
      'Integrasi dan keandalan data pendidik, tenaga kependidikan, serta peserta didik menjadi pondasi utama kami dalam melayani, membina, dan memajukan seluruh satuan pendidikan Ma\'arif se-Kabupaten Cilacap.',
    initials: 'NG',
  },
];

export const PublicLeadershipSection: React.FC = () => {
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const handleImgError = (name: string) => {
    setImgErrors((prev) => ({ ...prev, [name]: true }));
  };

  return (
    <section id="pimpinan" className="py-20 bg-gradient-to-b from-slate-50 via-emerald-50/20 to-white relative overflow-hidden">
      {/* Decorative background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-emerald-100/40 blur-3xl -z-10 rounded-full pointer-events-none" />

      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 px-3 py-1 font-bold tracking-wider text-xs uppercase hover:bg-emerald-100">
            Kepemimpinan & Amanat
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Pimpinan LP Ma'arif NU Cilacap
          </h2>
          <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
            Komitmen teguh dalam mengawal mutu pendidikan, digitalisasi layanan kelembagaan, dan pemberdayaan madrasah se-Kabupaten Cilacap.
          </p>
        </div>

        {/* Leaders Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
          {LEADERS.map((leader, idx) => {
            const hasError = imgErrors[leader.name];

            return (
              <div
                key={leader.name}
                className="group relative bg-white rounded-3xl p-6 sm:p-8 border border-emerald-100 shadow-sm hover:shadow-xl hover:border-emerald-300 transition-all duration-300 flex flex-col justify-between"
              >
                {/* Top Badge */}
                <div className="flex items-center justify-between pb-6 border-b border-slate-100">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <Award className="w-5 h-5" />
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-900">
                      PC LP Ma'arif NU Cilacap
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-600 text-[11px] font-bold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Terverifikasi Resmi</span>
                  </div>
                </div>

                {/* Profile Content */}
                <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start pt-6">
                  {/* Photo Frame */}
                  <div className="relative shrink-0">
                    <div
                      className="w-44 h-56 sm:w-48 sm:h-60 rounded-2xl overflow-hidden bg-gradient-to-tr from-emerald-800 to-teal-600 p-1 shadow-md shadow-emerald-950/10 hover:shadow-xl hover:border-emerald-500 transition-all duration-300 cursor-pointer group/photo relative"
                      onClick={() => {
                        setLightboxIndex(idx);
                        setLightboxOpen(true);
                      }}
                      title="Klik untuk melihat foto resolusi penuh"
                    >
                      <div className="w-full h-full rounded-xl overflow-hidden bg-slate-100 relative">
                        {!hasError ? (
                          <>
                            <img
                              src={leader.imageSrc}
                              alt={leader.name}
                              onError={() => handleImgError(leader.name)}
                              className="w-full h-full object-cover object-center scale-[1.18] transition-transform duration-300 group-hover/photo:scale-[1.24]"
                            />
                            {/* Hover overlay hint */}
                            <div className="absolute inset-0 bg-slate-900/20 opacity-0 group-hover/photo:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                              <div className="bg-white/95 backdrop-blur-sm text-emerald-900 text-xs font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 transform translate-y-1 group-hover/photo:translate-y-0 transition-transform duration-300">
                                <ZoomIn className="w-3.5 h-3.5 text-emerald-700" />
                                <span>Perbesar Foto</span>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-full rounded-xl bg-emerald-800 flex flex-col items-center justify-center text-white p-2">
                            <span className="text-2xl font-black">{leader.initials}</span>
                            <span className="text-[10px] text-emerald-200 uppercase tracking-widest text-center mt-1">
                              Foto Pimpinan
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Info & Title */}
                  <div className="flex-1 text-center sm:text-left space-y-2.5 sm:pt-2">
                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-snug">
                      {leader.name}
                    </h3>
                    <div className="space-y-0.5">
                      <p className="text-sm font-extrabold text-emerald-700 uppercase tracking-wide">
                        {leader.role}
                      </p>
                      <p className="text-xs font-semibold text-slate-500">
                        {leader.subRole}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Quote Card */}
                <div className="mt-6 pt-5 border-t border-slate-100 bg-emerald-50/30 rounded-2xl p-4 sm:p-5 relative">
                  <Quote className="w-6 h-6 text-emerald-600/30 absolute top-3 right-3" />
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed italic relative z-10">
                    "{leader.quote}"
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lightbox Preview */}
      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        index={lightboxIndex}
        slides={LEADERS.map((leader) => ({
          src: leader.imageSrc,
          title: `${leader.name} - ${leader.role} (${leader.subRole})`,
        }))}
      />
    </section>
  );
};
