import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, GraduationCap, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';

export const PublicHeroSection: React.FC = () => {
  const navigate = useNavigate();

  const scrollToSection = (id: string) => {
    const element = document.querySelector(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section id="hero" className="relative pt-12 pb-20 md:pt-20 md:pb-28 overflow-hidden bg-gradient-to-b from-emerald-950 via-slate-900 to-slate-950 text-white">
      {/* Background patterns */}
      <div className="absolute inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:24px_24px] opacity-15 pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-emerald-600/20 blur-[120px] rounded-full pointer-events-none -z-0" />

      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-4xl mx-auto space-y-6">
          {/* Official Verification Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-900/60 border border-emerald-500/30 text-emerald-300 text-xs font-bold tracking-wider uppercase backdrop-blur-md">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Portal Basis Data Resmi • PC LP Ma'arif NU Kabupaten Cilacap</span>
          </div>

          {/* Main Title */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.15] text-white">
            Sistem Informasi Manajemen Terpadu{' '}
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-200 bg-clip-text text-transparent">
              Ma'arif NU Cilacap
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Mewujudkan tata kelola madrasah dan sekolah Ma'arif yang transparan, akuntabel, dan berbasis data digital di 24 kecamatan se-Kabupaten Cilacap.
          </p>

          {/* Action CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Button
              size="lg"
              onClick={() => scrollToSection('#sebaran')}
              className="w-full sm:w-auto h-13 px-8 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm uppercase tracking-wider shadow-lg shadow-emerald-900/40 gap-2.5"
            >
              <MapPin className="w-4 h-4" />
              <span>Jelajahi Peta Sebaran</span>
            </Button>

            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate('/ppdb')}
              className="w-full sm:w-auto h-13 px-8 rounded-2xl bg-white/10 hover:bg-white/20 text-white border-white/20 font-bold text-sm uppercase tracking-wider backdrop-blur-md gap-2.5"
            >
              <GraduationCap className="w-4 h-4 text-emerald-300" />
              <span>Pusat PPDB Terpadu</span>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </Button>
          </div>

          {/* Trust Highlights */}
          <div className="pt-10 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto border-t border-white/10">
            <div className="p-3 text-center">
              <div className="text-2xl font-black text-emerald-400">24</div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Kecamatan Terdata</div>
            </div>
            <div className="p-3 text-center">
              <div className="text-2xl font-black text-emerald-400">MI • MTs</div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Pendidikan Dasar</div>
            </div>
            <div className="p-3 text-center">
              <div className="text-2xl font-black text-emerald-400">MA • SMK</div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Pendidikan Menengah</div>
            </div>
            <div className="p-3 text-center">
              <div className="text-2xl font-black text-emerald-400">100%</div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Aswaja An-Nahdliyah</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
