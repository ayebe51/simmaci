import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { MapPin, GraduationCap, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.14,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

const highlightItemVariants = {
  hidden: { opacity: 0, scale: 0.9, y: 15 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

export const PublicHeroSection: React.FC = () => {
  const navigate = useNavigate();

  const scrollToSection = (id: string) => {
    const element = document.querySelector(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const trustHighlights = [
    {
      value: '24',
      label: 'Kecamatan Terdata',
    },
    {
      value: 'MI',
      label: 'Pendidikan Dasar',
    },
    {
      value: 'MTs • MA • SMK',
      label: 'Pendidikan Menengah',
    },
    {
      value: '100%',
      label: 'Aswaja An-Nahdliyah',
    },
  ];

  return (
    <section id="hero" className="relative pt-12 pb-24 md:pt-20 md:pb-32 overflow-hidden bg-gradient-to-b from-emerald-950 via-slate-900 to-slate-950 text-white">
      {/* 1. Background Grid Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:24px_24px] opacity-15 pointer-events-none" />

      {/* 2. Konsep B: Ambient Breathing Emerald Aurora Orbs */}
      <motion.div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] sm:w-[900px] h-[350px] sm:h-[450px] bg-gradient-to-r from-emerald-600/30 via-teal-500/20 to-emerald-700/30 blur-[130px] rounded-full pointer-events-none -z-0"
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0.35, 0.6, 0.35],
          rotate: [0, 3, 0],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      <motion.div
        className="absolute -top-24 -left-24 w-[380px] h-[380px] bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none -z-0"
        animate={{
          scale: [1, 1.25, 1],
          x: [0, 25, 0],
          y: [0, 20, 0],
        }}
        transition={{
          duration: 11,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      <motion.div
        className="absolute bottom-12 -right-24 w-[420px] h-[420px] bg-teal-500/15 blur-[120px] rounded-full pointer-events-none -z-0"
        animate={{
          scale: [1, 1.18, 1],
          x: [0, -25, 0],
          y: [0, -15, 0],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* 3. Konsep A: Staggered Content Animation */}
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          className="text-center max-w-4xl mx-auto space-y-6"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Official Verification Badge dengan Micro-Float */}
          <motion.div variants={itemVariants} className="flex justify-center">
            <motion.div
              className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-emerald-900/60 border border-emerald-500/30 text-emerald-300 text-xs font-bold tracking-wider uppercase backdrop-blur-md shadow-lg shadow-emerald-950/40"
              animate={{
                y: [-2, 2, -2],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              <img
                src="/images/logo-maarif-hijau.png"
                alt="Logo LP Ma'arif NU"
                className="w-4 h-4 object-contain rounded-xs shrink-0"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/logo-maarif-hijau.png';
                }}
              />
              <span>Portal Basis Data Resmi • LP Ma'arif NU Cilacap</span>
              <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            </motion.div>
          </motion.div>

          {/* Main Title */}
          <motion.h1
            variants={itemVariants}
            className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.15] text-white"
          >
            Sistem Informasi Manajemen Terpadu{' '}
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-200 bg-clip-text text-transparent">
              Ma'arif NU Cilacap
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={itemVariants}
            className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed"
          >
            Mewujudkan tata kelola madrasah dan sekolah Ma'arif yang transparan, akuntabel, dan berbasis data digital di 24 kecamatan se-Kabupaten Cilacap.
          </motion.p>

          {/* Action CTA Buttons dengan Hover Physics */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
          >
            <motion.div
              className="w-full sm:w-auto"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                size="lg"
                onClick={() => scrollToSection('#sebaran')}
                className="w-full sm:w-auto h-13 px-8 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm uppercase tracking-wider shadow-lg shadow-emerald-900/40 gap-2.5 transition-all"
              >
                <MapPin className="w-4 h-4" />
                <span>Jelajahi Peta Sebaran</span>
              </Button>
            </motion.div>

            <motion.div
              className="w-full sm:w-auto"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate('/ppdb')}
                className="w-full sm:w-auto h-13 px-8 rounded-2xl bg-white/10 hover:bg-white/20 text-white border-white/20 font-bold text-sm uppercase tracking-wider backdrop-blur-md gap-2.5 transition-all"
              >
                <GraduationCap className="w-4 h-4 text-emerald-300" />
                <span>Pusat PPDB Terpadu</span>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </Button>
            </motion.div>
          </motion.div>

          {/* Trust Highlights Grid dengan Staggered Cards & Micro-Hover */}
          <motion.div
            variants={itemVariants}
            className="pt-10 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto border-t border-white/10"
          >
            {trustHighlights.map((item) => (
              <motion.div
                key={item.label}
                variants={highlightItemVariants}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="p-3.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-transparent hover:border-emerald-500/30 transition-all duration-300 text-center cursor-default backdrop-blur-2xs"
              >
                <div className="text-2xl font-black text-emerald-400 tracking-tight">
                  {item.value}
                </div>
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
                  {item.label}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};
