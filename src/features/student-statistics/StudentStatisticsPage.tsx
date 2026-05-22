/**
 * StudentStatisticsPage
 * Main page with drill-down navigation for student statistics per jenjang.
 * Flow: JenjangSummaryCards → MadrasahListPanel → KelasDetailPanel
 *
 * Validates: Requirements 1.1, 1.4, 1.7, 1.8, 2.1, 2.5, 3.1, 7.2, 7.3, 7.4
 */

import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useJenjangStatistics } from '@/features/student-statistics/hooks/useJenjangStatistics';
import { useMadrasahByJenjang } from '@/features/student-statistics/hooks/useMadrasahByJenjang';
import { useKelasStatistics } from '@/features/student-statistics/hooks/useKelasStatistics';
import { JenjangSummaryCards } from './components/JenjangSummaryCards';
import { MadrasahListPanel } from './components/MadrasahListPanel';
import { KelasDetailPanel } from './components/KelasDetailPanel';
import { StatisticsSkeleton } from './components/StatisticsSkeleton';
import { ErrorFallback } from './components/ErrorFallback';
import type { MadrasahStatItem } from '@/features/student-statistics/services/studentStatisticsApi';

/** Timeout duration in milliseconds (10 seconds) */
const TIMEOUT_MS = 10_000;

export default function StudentStatisticsPage() {
  const queryClient = useQueryClient();

  // ── Drill-down state ──
  const [selectedJenjang, setSelectedJenjang] = useState<string | null>(null);
  const [selectedMadrasah, setSelectedMadrasah] = useState<MadrasahStatItem | null>(null);

  // ── Timeout state ──
  const [isTimedOut, setIsTimedOut] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── TanStack Query hooks ──
  const jenjangQuery = useJenjangStatistics();
  const madrasahQuery = useMadrasahByJenjang(selectedJenjang);
  const kelasQuery = useKelasStatistics(selectedMadrasah?.id ?? null);

  // Determine which query is actively loading
  const isInitialLoading =
    jenjangQuery.isLoading ||
    (selectedJenjang && madrasahQuery.isLoading) ||
    (selectedMadrasah && kelasQuery.isLoading);

  // Determine if there's an error
  const hasError =
    jenjangQuery.isError ||
    (selectedJenjang && madrasahQuery.isError) ||
    (selectedMadrasah && kelasQuery.isError);

  // ── Timeout handling ──
  useEffect(() => {
    if (isInitialLoading) {
      timeoutRef.current = setTimeout(() => {
        setIsTimedOut(true);
      }, TIMEOUT_MS);
    } else {
      // Clear timeout when loading finishes
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setIsTimedOut(false);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isInitialLoading]);

  // ── Handlers ──
  const handleSelectJenjang = (jenjang: string) => {
    setSelectedJenjang(jenjang);
    setSelectedMadrasah(null);
  };

  const handleSelectMadrasah = (madrasah: MadrasahStatItem) => {
    setSelectedMadrasah(madrasah);
  };

  const handleBackToJenjang = () => {
    setSelectedJenjang(null);
    setSelectedMadrasah(null);
  };

  const handleBackToMadrasah = () => {
    setSelectedMadrasah(null);
  };

  const handleRetry = () => {
    setIsTimedOut(false);
    queryClient.invalidateQueries({ queryKey: ['student-statistics'] });
  };

  // ── Render ──
  return (
    <div className="space-y-6">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Statistik Siswa per Jenjang
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Ringkasan jumlah siswa aktif berdasarkan jenjang pendidikan
        </p>
      </div>

      {/* Timeout state */}
      {isTimedOut && (
        <ErrorFallback
          message="Permintaan melebihi batas waktu. Silakan coba lagi."
          onRetry={handleRetry}
        />
      )}

      {/* Error state */}
      {!isTimedOut && hasError && (
        <ErrorFallback
          message="Gagal memuat data statistik. Silakan coba lagi."
          onRetry={handleRetry}
        />
      )}

      {/* Loading state (initial load only, not timeout/error) */}
      {!isTimedOut && !hasError && isInitialLoading && (
        <StatisticsSkeleton />
      )}

      {/* Content based on drill-down state */}
      {!isTimedOut && !hasError && !isInitialLoading && (
        <>
          {/* Level 3: Kelas detail */}
          {selectedMadrasah && (
            <KelasDetailPanel
              madrasahId={selectedMadrasah.id}
              madrasahName={selectedMadrasah.nama}
              data={kelasQuery.data}
              isLoading={kelasQuery.isFetching}
              onBack={handleBackToMadrasah}
            />
          )}

          {/* Level 2: Madrasah list */}
          {selectedJenjang && !selectedMadrasah && (
            <MadrasahListPanel
              jenjang={selectedJenjang}
              data={madrasahQuery.data}
              isLoading={madrasahQuery.isFetching}
              onSelectMadrasah={handleSelectMadrasah}
              onBack={handleBackToJenjang}
            />
          )}

          {/* Level 1: Jenjang summary cards */}
          {!selectedJenjang && (
            <JenjangSummaryCards
              data={jenjangQuery.data}
              onSelectJenjang={handleSelectJenjang}
            />
          )}
        </>
      )}
    </div>
  );
}
