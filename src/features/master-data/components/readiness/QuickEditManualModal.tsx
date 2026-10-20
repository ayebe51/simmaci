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
import { Edit3, GraduationCap, Calculator, Info } from 'lucide-react';
import { getGradeLevelsForSchool } from './readinessConstants';

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

  const [classCounts, setClassCounts] = useState<Record<string, string>>({});
  const [singleManualInput, setSingleManualInput] = useState<string>('');

  // Initialize inputs whenever editSchool changes
  useEffect(() => {
    if (!editSchool) {
      setClassCounts({});
      setSingleManualInput('');
      return;
    }

    if (gradeLevels && gradeLevels.length > 0) {
      const initialMap: Record<string, string> = {};
      const existing = editSchool.jumlah_siswa_per_kelas || {};
      gradeLevels.forEach((lvl) => {
        const val = existing[lvl] ?? existing[lvl.replace('Kelas ', '')] ?? '';
        initialMap[lvl] = val !== '' && val !== null && val !== undefined ? String(val) : '';
      });
      setClassCounts(initialMap);
    } else {
      setSingleManualInput(
        editSchool.jumlah_siswa_manual !== null && editSchool.jumlah_siswa_manual !== undefined
          ? String(editSchool.jumlah_siswa_manual)
          : ''
      );
    }
  }, [editSchool, gradeLevels]);

  // Live Auto-Sum calculation
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSchool) return;

    if (gradeLevels && gradeLevels.length > 0) {
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

      if (!hasAnyValue) {
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
      <DialogContent className="rounded-2xl sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-base font-black text-slate-900 flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-emerald-600" />
            <span>Input Siswa Per Tingkat Kelas</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Isi perkiraan jumlah siswa per rombel kelas untuk <b>{editSchool?.nama}</b>. Total akan dihitung otomatis.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Info Card */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Wilayah & Jenjang:</span>
              <span className="font-bold text-slate-800">
                Kec. {editSchool?.kecamatan} • Jenjang {editSchool?.jenjang || '-'}
              </span>
            </div>
            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] font-extrabold">
              {gradeLevels ? `${gradeLevels.length} Tingkat Kelas` : 'Agregat'}
            </Badge>
          </div>

          {/* Form Content: Per-Class Grid or Fallback */}
          {gradeLevels && gradeLevels.length > 0 ? (
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
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                    <Calculator className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-black text-emerald-800 tracking-wider block">
                      Total Jumlah Siswa (Otomatis):
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      Hasil penjumlahan seluruh tingkat kelas
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
            <div className="space-y-2">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Jenjang <b>{editSchool?.jenjang || editSchool?.nama}</b> tidak memiliki tingkatan kelas formal MI/MTs/MA/SMK. Masukkan total siswa secara manual di bawah ini jika diperlukan.
                </span>
              </div>
              <Input
                type="number"
                min="0"
                max="100000"
                placeholder="Total Siswa"
                value={singleManualInput}
                onChange={(e) => setSingleManualInput(e.target.value)}
                className="h-10 rounded-xl text-sm font-bold text-slate-900"
              />
            </div>
          )}

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
              className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-extrabold text-xs px-5 shadow-sm"
            >
              {isPending ? 'Menyimpan...' : 'Simpan Rincian Siswa'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
