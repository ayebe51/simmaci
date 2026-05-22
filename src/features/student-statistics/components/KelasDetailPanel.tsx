/**
 * KelasDetailPanel Component
 * Displays a table of kelas with student counts for a selected madrasah.
 * Includes download button for per-kelas Excel export.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */

import { useState } from 'react';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { studentStatisticsApi } from '@/features/student-statistics/services/studentStatisticsApi';
import { downloadExcel } from '@/features/student-statistics/utils/downloadExcel';
import type { KelasStatItem } from '@/features/student-statistics/services/studentStatisticsApi';

interface KelasDetailPanelProps {
  madrasahId: number;
  madrasahName: string;
  data: KelasStatItem[] | undefined;
  isLoading: boolean;
  onBack: () => void;
}

export function KelasDetailPanel({
  madrasahId,
  madrasahName,
  data,
  isLoading,
  onBack,
}: KelasDetailPanelProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const total = data?.reduce((sum, item) => sum + item.jumlah_siswa, 0) ?? 0;

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const blob = await studentStatisticsApi.exportPerKelas(madrasahId);
      const sanitizedName = madrasahName.replace(/[^a-zA-Z0-9]/g, '_');
      const timestamp = new Date()
        .toISOString()
        .replace(/[-:T]/g, '')
        .slice(0, 15)
        .replace(/(\d{8})(\d{6}).*/, '$1_$2');
      const filename = `Jumlah_Siswa_${sanitizedName}_${timestamp}.xlsx`;
      downloadExcel(blob, filename);
    } catch {
      toast.error('Gagal mengunduh file Excel');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            aria-label="Kembali ke daftar madrasah"
            className="shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-slate-900 truncate">
              {madrasahName}
            </h3>
            <p className="text-sm text-slate-500">Detail per kelas</p>
          </div>
        </div>

        <Button
          variant="mint"
          size="sm"
          onClick={handleDownload}
          disabled={isDownloading || isLoading}
          className="shrink-0"
        >
          {isDownloading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Download Excel
        </Button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
          <span className="ml-2 text-sm text-slate-500">Memuat data...</span>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && data && data.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-slate-500">
            Tidak ada siswa aktif di madrasah ini
          </p>
        </div>
      )}

      {/* Table */}
      {!isLoading && data && data.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-emerald-50">
                <th className="px-4 py-3 text-left font-medium text-emerald-800 w-12">
                  No
                </th>
                <th className="px-4 py-3 text-left font-medium text-emerald-800">
                  Kelas
                </th>
                <th className="px-4 py-3 text-right font-medium text-emerald-800">
                  Jumlah Siswa
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, index) => (
                <tr
                  key={item.kelas}
                  className={cn(
                    'border-t border-slate-100',
                    'transition-colors hover:bg-slate-50'
                  )}
                >
                  <td className="px-4 py-3 text-slate-500">{index + 1}</td>
                  <td className="px-4 py-3 text-slate-900 font-medium">
                    {item.kelas}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {item.jumlah_siswa.toLocaleString('id-ID')}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-emerald-200 bg-emerald-50/50">
                <td className="px-4 py-3" colSpan={2}>
                  <span className="font-semibold text-emerald-800">Total</span>
                </td>
                <td className="px-4 py-3 text-right font-bold text-emerald-800">
                  {total.toLocaleString('id-ID')}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
