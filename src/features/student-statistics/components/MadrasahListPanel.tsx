/**
 * MadrasahListPanel Component
 * Displays a table of madrasah for a selected jenjang category with student counts.
 * Each row is clickable to drill-down to kelas detail.
 * Includes a "Download Rekap" button for Excel export.
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 5.1, 5.2, 5.3, 5.4, 5.5
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { studentStatisticsApi } from '@/features/student-statistics/services/studentStatisticsApi';
import { downloadExcel } from '@/features/student-statistics/utils/downloadExcel';
import type { MadrasahStatItem } from '@/features/student-statistics/services/studentStatisticsApi';

interface MadrasahListPanelProps {
  jenjang: string;
  data: MadrasahStatItem[] | undefined;
  isLoading: boolean;
  onSelectMadrasah: (madrasah: MadrasahStatItem) => void;
  onBack: () => void;
}

export function MadrasahListPanel({
  jenjang,
  data,
  isLoading,
  onSelectMadrasah,
  onBack,
}: MadrasahListPanelProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadRekap = async () => {
    setIsDownloading(true);
    try {
      const blob = await studentStatisticsApi.exportRekapPerJenjang(jenjang);
      const timestamp = new Date()
        .toISOString()
        .replace(/[-:T]/g, '')
        .slice(0, 15)
        .replace(/(\d{8})(\d{6}).*/, '$1_$2');
      downloadExcel(blob, `Rekap_Siswa_${jenjang}_${timestamp}.xlsx`);
    } catch {
      toast.error('Gagal mengunduh file Excel');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            aria-label="Kembali ke ringkasan jenjang"
            className="hover:bg-emerald-50"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Daftar Madrasah — {jenjang}
            </h2>
            <p className="text-sm text-slate-500">
              {data ? `${data.length} madrasah` : 'Memuat...'}
            </p>
          </div>
        </div>

        <Button
          variant="mint"
          size="sm"
          onClick={handleDownloadRekap}
          disabled={isDownloading || isLoading}
          aria-label={`Download rekap siswa jenjang ${jenjang}`}
        >
          {isDownloading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Download Rekap
        </Button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-14 rounded-xl bg-slate-100 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && data && data.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
            <Loader2 className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-sm text-slate-500">
            Tidak ada madrasah untuk jenjang {jenjang}
          </p>
        </div>
      )}

      {/* Table */}
      {!isLoading && data && data.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80">
                <th className="px-4 py-3 text-left font-medium text-slate-600 w-12">
                  No
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">
                  Nama Madrasah
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-600 w-32">
                  NPSN
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">
                  Kecamatan
                </th>
                <th className="px-4 py-3 text-right font-medium text-slate-600 w-32">
                  Jumlah Siswa
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((madrasah, index) => (
                <tr
                  key={madrasah.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Lihat detail kelas ${madrasah.nama}`}
                  onClick={() => onSelectMadrasah(madrasah)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectMadrasah(madrasah);
                    }
                  }}
                  className={cn(
                    'border-b border-slate-50 cursor-pointer',
                    'transition-colors duration-150 hover:bg-emerald-50/50',
                    'focus-visible:outline-none focus-visible:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500'
                  )}
                >
                  <td className="px-4 py-3 text-slate-500">{index + 1}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {madrasah.nama}
                  </td>
                  <td className="px-4 py-3 text-slate-600 font-mono text-xs">
                    {madrasah.npsn}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {madrasah.kecamatan || '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={cn(
                        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
                        madrasah.jumlah_siswa > 0
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                      )}
                    >
                      {madrasah.jumlah_siswa.toLocaleString('id-ID')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
