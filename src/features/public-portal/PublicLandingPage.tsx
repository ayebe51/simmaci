import React from 'react';
import { PublicNavbar } from './components/PublicNavbar';
import { PublicHeroSection } from './components/PublicHeroSection';
import { PublicStatsCards } from './components/PublicStatsCards';
import { PublicLeadershipSection } from './components/PublicLeadershipSection';
import { DistributionMap } from '@/features/dashboard/components/DistributionMap';
import { PublicSchoolsDirectory } from './components/PublicSchoolsDirectory';
import { PublicServicesHub } from './components/PublicServicesHub';
import { Badge } from '@/components/ui/badge';

export default function PublicLandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* 1. Sticky Navigation */}
      <PublicNavbar />

      <main className="flex-1">
        {/* 2. Hero Section */}
        <PublicHeroSection />

        {/* 3. Live Macro Stats */}
        <PublicStatsCards />

        {/* 4. Leadership Showcase (Ketua & Sekretaris) */}
        <PublicLeadershipSection />

        {/* 5. Interactive Distribution Map */}
        <section id="sebaran" className="py-20 bg-white border-t border-slate-200/60">
          <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="text-center max-w-4xl mx-auto space-y-3">
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 px-3 py-1 font-bold tracking-wider text-xs uppercase hover:bg-emerald-100">
                Peta Sebaran Interaktif
              </Badge>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight sm:whitespace-nowrap">
                Sebaran Madrasah & Sekolah se-Kabupaten Cilacap
              </h2>
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed max-w-2xl mx-auto">
                Visualisasi geografis sebaran satuan pendidikan formal (MI, MTs, MA, SMK),
                <br className="hidden sm:inline" />
                {' '}serta persebaran pendidik dan peserta didik di 24 wilayah kecamatan.
              </p>
            </div>

            {/* Map Canvas & Filters */}
            <div className="rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden bg-white">
              <DistributionMap isPublic={true} />
            </div>
          </div>
        </section>

        {/* 6. Public Schools Directory */}
        <PublicSchoolsDirectory />

        {/* 7. Services Hub & Official Footer */}
        <PublicServicesHub />
      </main>
    </div>
  );
}
