import React from 'react';
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
import { Edit3 } from 'lucide-react';

interface QuickEditManualModalProps {
  editSchool: SchoolReadinessItem | null;
  manualCountInput: string;
  isPending: boolean;
  onClose: () => void;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function QuickEditManualModal({
  editSchool,
  manualCountInput,
  isPending,
  onClose,
  onInputChange,
  onSubmit,
}: QuickEditManualModalProps) {
  return (
    <Dialog open={Boolean(editSchool)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="rounded-2xl sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="text-base font-black text-slate-900 flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-emerald-600" />
            <span>Input Jumlah Siswa (Estimasi)</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Isi perkiraan jumlah siswa untuk <b>{editSchool?.nama}</b> jika data siswa rinci belum sempat diinput.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4 pt-2">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Kecamatan:</span>
              <span className="font-bold text-slate-800">{editSchool?.kecamatan}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Jenjang:</span>
              <span className="font-bold text-slate-800">{editSchool?.jenjang}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Data Siswa Rinci Saat Ini:</span>
              <span className="font-bold text-blue-700">
                {editSchool?.students_detail_count || 0} Siswa
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
              Jumlah Siswa Estimasi / Agregat:
            </label>
            <Input
              type="number"
              min="0"
              max="100000"
              placeholder="Contoh: 150"
              value={manualCountInput}
              onChange={(e) => onInputChange(e.target.value)}
              autoFocus
              className="h-11 rounded-xl text-sm font-extrabold text-emerald-900"
            />
            <p className="text-[11px] text-slate-400">
              Kosongkan untuk menghapus estimasi manual. Angka ini otomatis digunakan pada peta sebaran dan rekapitulasi yayasan.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
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
              className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-extrabold text-xs px-5"
            >
              {isPending ? 'Menyimpan...' : 'Simpan Jumlah Siswa'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
