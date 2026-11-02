import React, { useState, useEffect, useMemo } from 'react';
import { SchoolReadinessItem } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Edit3, GraduationCap, Calculator, Info, Layers, Hash, Sparkles } from 'lucide-react';
import { getGradeLevelsForSchool, resolveSchoolJenjang } from './readinessConstants';

interface QuickEditManualModalProps {
  editSchool: SchoolReadinessItem | null;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (data: { total: number | null; perClass: Record<string, number> | null }) => void;
}

export function QuickEditManualModal({
  editSchool,
  isPending,
  onClose,
  onSubmit,
}: QuickEditManualModalProps) {
  const gradeLevels = useMemo(() => {
    if (!editSchool) return null;
    return getGradeLevelsForSchool(editSchool.jenjang, editSchool.nama);
  }, [editSchool]);

  const [inputMode, setInputMode] = useState<'per_class' | 'total'>('per_class');
  const [classCounts, setClassCounts] = useState<Record<string, string>>({});
  const [singleManualInput, setSingleManualInput] = useState<string>('');
  const [siswaBaruCounts, setSiswaBaruCounts] = useState<{ y1: string; y2: string; y3: string }>({
    y1: '',
    y2: '',
    y3: '',
  });

  // Initialize inputs whenever editSchool changes
  useEffect(() => {
    if (!editSchool) {
      setClassCounts({});
      setSingleManualInput('');
      setSiswaBaruCounts({ y1: '', y2: '', y3: '' });
      return;
    }

    const hasPerClassData =
      editSchool.jumlah_siswa_per_kelas &&
      Object.keys(editSchool.jumlah_siswa_per_kelas).length > 0;

    const existing = editSchool.jumlah_siswa_per_kelas || {};

    // Default to per_class if grade levels are available, else direct total
    if (gradeLevels && gradeLevels.length > 0) {
      setInputMode(hasPerClassData || !editSchool.jumlah_siswa_manual ? 'per_class' : 'total');

      const initialMap: Record<string, string> = {};
      gradeLevels.forEach((lvl) => {
        const val = existing[lvl] ?? existing[lvl.replace('Kelas ', '')] ?? '';
        initialMap[lvl] = val !== '' && val !== null && val !== undefined ? String(val) : '';
      });
      setClassCounts(initialMap);
    } else {
      setInputMode('total');
    }

    setSiswaBaruCounts({
      y1: existing.siswa_baru_2024 !== undefined && existing.siswa_baru_2024 !== null ? String(existing.siswa_baru_2024) : '',
      y2: existing.siswa_baru_2025 !== undefined && existing.siswa_baru_2025 !== null ? String(existing.siswa_baru_2025) : '',
      y3: existing.siswa_baru_2026 !== undefined && existing.siswa_baru_2026 !== null ? String(existing.siswa_baru_2026) : '',
    });

    setSingleManualInput(
      editSchool.jumlah_siswa_manual !== null && editSchool.jumlah_siswa_manual !== undefined
        ? String(editSchool.jumlah_siswa_manual)
        : ''
    );
  }, [editSchool, gradeLevels]);

  // Live Auto-Sum calculation for per-class mode
  const autoSum = useMemo(() => {
    if (!gradeLevels) return 0;
    let sum = 0;
    Object.values(classCounts).forEach((val) => {
      const parsed = parseInt(val, 10);
      if (!isNaN(parsed) && parsed > 0) {
        sum += parsed;
      }
    });
    return sum;
  }, [classCounts, gradeLevels]);

  const handleClassInputChange = (level: string, value: string) => {
    setClassCounts((prev) => ({
      ...prev,
      [level]: value,
    }));
  };

  // Current computed manual count based on active mode
  const activeManualTotal = useMemo(() => {
    if (inputMode === 'per_class') {
      return autoSum;
    }
    const parsed = parseInt(singleManualInput.trim(), 10);
    return isNaN(parsed) || parsed < 0 ? 0 : parsed;
  }, [inputMode, autoSum, singleManualInput]);

  const detailCount = editSchool?.students_detail_count ?? 0;

  const isMiSd = useMemo(() => {
    if (!editSchool) return false;
    const rawJenjang = (editSchool.jenjang || '').toUpperCase().trim();
    return (
      rawJenjang.includes('MI') ||
      rawJenjang.includes('SD') ||
      editSchool.nama.toUpperCase().startsWith('MI ') ||
      editSchool.nama.toUpperCase().includes('IBTIDAIYAH')
    );
  }, [editSchool]);

  const effectivePreview = useMemo(() => {
    return activeManualTotal > 0 ? activeManualTotal : detailCount;
  }, [detailCount, activeManualTotal]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSchool) return;

    if (inputMode === 'per_class' && gradeLevels && gradeLevels.length > 0) {
      const numericMap: Record<string, number> = {};
      let hasAnyValue = false;

      Object.entries(classCounts).forEach(([lvl, strVal]) => {
        const trimmed = strVal.trim();
        if (trimmed !== '') {
          const parsed = parseInt(trimmed, 10);
          if (!isNaN(parsed) && parsed >= 0) {
            numericMap[lvl] = parsed;
            hasAnyValue = true;
          }
        }
      });

      // Optional Siswa Baru 3 Tahun overrides
      if (siswaBaruCounts.y1.trim() !== '') {
        const p1 = parseInt(siswaBaruCounts.y1.trim(), 10);
        if (!isNaN(p1) && p1 >= 0) numericMap['siswa_baru_2024'] = p1;
      }
      if (siswaBaruCounts.y2.trim() !== '') {
        const p2 = parseInt(siswaBaruCounts.y2.trim(), 10);
        if (!isNaN(p2) && p2 >= 0) numericMap['siswa_baru_2025'] = p2;
      }
      if (siswaBaruCounts.y3.trim() !== '') {
        const p3 = parseInt(siswaBaruCounts.y3.trim(), 10);
        if (!isNaN(p3) && p3 >= 0) numericMap['siswa_baru_2026'] = p3;
      }

      if (!hasAnyValue && Object.keys(numericMap).length === 0) {
        // All emptied -> clear manual students
        onSubmit({ total: null, perClass: null });
      } else {
        onSubmit({ total: autoSum, perClass: numericMap });
      }
    } else {
      const trimmed = singleManualInput.trim();
      const countVal = trimmed === '' ? null : parseInt(trimmed, 10);
      onSubmit({ total: countVal, perClass: null });
    }
  };

  return (
    <Dialog open={Boolean(editSchool)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="rounded-2xl sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-base font-black text-slate-900 flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-emerald-600" />
            <span>Input Jumlah Siswa Manual</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Isi atau sesuaikan jumlah siswa manual untuk <b>{editSchool?.nama}</b>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Info & Comparison Card */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">
                Kec. {editSchool?.kecamatan} • Jenjang {editSchool ? resolveSchoolJenjang(editSchool.jenjang, editSchool.nama) : '-'}
              </span>
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] font-extrabold">
                {gradeLevels ? `${gradeLevels.length} Tingkat Kelas` : 'Agregat'}
              </Badge>
            </div>

            {/* Comparison Metrics: Detail vs Manual vs Effective Max */}
            <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-slate-200/60">
              <div className="bg-white p-2 rounded-lg border border-slate-100 text-center">
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Rinci Upload:</span>
                <span className="text-sm font-black text-blue-700">{detailCount}</span>
                <span className="text-[9px] text-slate-400 block">Siswa</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-100 text-center">
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Input Manual:</span>
                <span className="text-sm font-black text-amber-700">{activeManualTotal}</span>
                <span className="text-[9px] text-slate-400 block">Siswa</span>
              </div>
              <div className="bg-emerald-50/80 p-2 rounded-lg border border-emerald-200 text-center">
                <span className="text-[9px] uppercase font-black text-emerald-800 block">
                  Data Efektif:
                </span>
                <span className="text-sm font-black text-emerald-800">{effectivePreview}</span>
                <span className="text-[9px] text-emerald-600 font-bold block">
                  {activeManualTotal > 0 ? 'Manual Terpercaya' : detailCount > 0 ? 'Data Tersedia (Rinci)' : 'Belum Ada Data'}
                </span>
              </div>
            </div>
          </div>

          {/* Mode Selector Toggle (if grade levels supported) */}
          {gradeLevels && gradeLevels.length > 0 && (
            <div className="flex items-center p-1 bg-slate-100 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => setInputMode('per_class')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  inputMode === 'per_class'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Rincian Per Kelas</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setInputMode('total');
                  if (!singleManualInput && autoSum > 0) {
                    setSingleManualInput(String(autoSum));
                  }
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  inputMode === 'total'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Hash className="w-3.5 h-3.5" />
                <span>Total Langsung</span>
              </button>
            </div>
          )}

          {/* Mode 1: Per-Class Grid */}
          {inputMode === 'per_class' && gradeLevels && gradeLevels.length > 0 ? (
            <div className="space-y-3">
              <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4 text-emerald-600" />
                <span>Rincian Siswa Per Tingkat Kelas:</span>
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {gradeLevels.map((lvl) => (
                  <div key={lvl} className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/80 space-y-1">
                    <span className="text-[11px] font-bold text-slate-600 block">{lvl}</span>
                    <Input
                      type="number"
                      min="0"
                      max="10000"
                      placeholder="0"
                      value={classCounts[lvl] ?? ''}
                      onChange={(e) => handleClassInputChange(lvl, e.target.value)}
                      className="h-9 rounded-lg text-sm font-extrabold text-slate-900 bg-white"
                    />
                  </div>
                ))}
              </div>

              {/* Real-time Auto-Sum Card */}
              <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-white p-3.5 rounded-xl border border-emerald-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                    <Calculator className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-black text-emerald-800 tracking-wider block">
                      Total Siswa Manual (Auto-Sum):
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      Penjumlahan otomatis seluruh rombel
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-emerald-800 tracking-tight">
                    {autoSum}
                  </span>
                  <span className="text-xs font-bold text-emerald-600 ml-1">Siswa</span>
                </div>
              </div>
            </div>
          ) : (
            /* Mode 2: Single Total Direct Input */
            <div className="space-y-2">
              <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Hash className="w-4 h-4 text-emerald-600" />
                <span>Total Jumlah Siswa Manual:</span>
              </label>
              <div className="relative">
                <Input
                  type="number"
                  min="0"
                  max="100000"
                  placeholder="Masukkan total siswa (misal: 416)"
                  value={singleManualInput}
                  onChange={(e) => setSingleManualInput(e.target.value)}
                  className="h-11 rounded-xl text-base font-extrabold text-slate-900 pl-4 pr-16 bg-white"
                />
                <span className="absolute right-3.5 top-3 text-xs font-bold text-slate-400">
                  Siswa
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Masukkan total siswa riil sekolah secara langsung jika tidak ingin mengisi rincian per kelas.
              </p>
            </div>
          )}

          {/* Section: Siswa Baru 3 Tahun Terakhir (Optional Override) */}
          <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Siswa Baru 3 Tahun Terakhir (Opsional):</span>
              </span>
              <span className="text-[10px] text-slate-400">Otomatis terisi jika kosong</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-500 block">2024/2025</span>
                <Input
                  type="number"
                  min="0"
                  placeholder="Auto"
                  value={siswaBaruCounts.y1}
                  onChange={(e) => setSiswaBaruCounts((p) => ({ ...p, y1: e.target.value }))}
                  className="h-8 rounded-lg text-xs font-bold bg-white"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-500 block">2025/2026</span>
                <Input
                  type="number"
                  min="0"
                  placeholder="Auto"
                  value={siswaBaruCounts.y2}
                  onChange={(e) => setSiswaBaruCounts((p) => ({ ...p, y2: e.target.value }))}
                  className="h-8 rounded-lg text-xs font-bold bg-white"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-500 block">2026/2027</span>
                <Input
                  type="number"
                  min="0"
                  placeholder="Auto"
                  value={siswaBaruCounts.y3}
                  onChange={(e) => setSiswaBaruCounts((p) => ({ ...p, y3: e.target.value }))}
                  className="h-8 rounded-lg text-xs font-bold bg-white"
                />
              </div>
            </div>
          </div>

          {/* Educational Note */}
          <div className="p-2.5 bg-blue-50/70 rounded-xl border border-blue-200/60 text-[11px] text-blue-900 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <span>
              <b>Aturan Terpercaya:</b> Data input manual dijadikan acuan terpercaya utama. Jika madrasah belum diinput manual, sistem otomatis menggunakan data siswa yang sudah ada sebelumnya ({detailCount} siswa) sehingga data tetap lengkap.
            </span>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="rounded-xl font-bold text-xs"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-extrabold text-xs px-5 shadow-xs"
            >
              {isPending ? 'Menyimpan...' : 'Simpan Jumlah Siswa'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
