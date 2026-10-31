import React from 'react';
import { SchoolReadinessItem } from '@/lib/api';
import { TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit3, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReadinessTableRowProps {
  item: SchoolReadinessItem;
  rowNumber: number;
  onOpenQuickEdit: (school: SchoolReadinessItem) => void;
  onSendWa: (school: SchoolReadinessItem) => void;
}

export function ReadinessTableRow({
  item,
  rowNumber,
  onOpenQuickEdit,
  onSendWa,
}: ReadinessTableRowProps) {
  const hasWhatsapp = Boolean(item.kepala_whatsapp || item.telepon);
  const rawJenjang = (item.jenjang || '').toUpperCase().trim();
  const isMiSd =
    rawJenjang.includes('MI') ||
    rawJenjang.includes('SD') ||
    item.nama.toUpperCase().startsWith('MI ') ||
    item.nama.toUpperCase().includes('IBTIDAIYAH');

  return (
    <TableRow
      className={cn(
        'hover:bg-slate-50/60 transition-colors',
        item.completeness_status === 'empty' && 'bg-rose-50/20',
        item.completeness_status === 'teachers_only' && 'bg-amber-50/15'
      )}
    >
      {/* No */}
      <TableCell className="text-center text-xs font-bold text-slate-400">
        {rowNumber}
      </TableCell>

      {/* Nama & Wilayah */}
      <TableCell>
        <div className="space-y-1">
          <span className="font-extrabold text-xs text-slate-900 block leading-snug">
            {item.nama}
          </span>
          <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-slate-500">
            <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
              NSM: {item.nsm || '-'}
            </span>
            <span>•</span>
            <span className="font-bold text-emerald-700">
              Kec. {item.kecamatan || '-'}
            </span>
          </div>
        </div>
      </TableCell>

      {/* Jenjang */}
      <TableCell className="text-center">
        <Badge
          variant="outline"
          className="bg-emerald-50 text-emerald-800 border-emerald-200 font-black text-[10px]"
        >
          {item.jenjang || 'Lainnya'}
        </Badge>
      </TableCell>

      {/* Guru Aktif */}
      <TableCell className="text-center">
        {item.teachers_count > 0 ? (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs font-extrabold hover:bg-emerald-100">
            👨‍🏫 {item.teachers_count}
          </Badge>
        ) : (
          <Badge className="bg-rose-100 text-rose-700 border-rose-200 text-xs font-extrabold hover:bg-rose-100">
            0 Guru
          </Badge>
        )}
      </TableCell>

      {/* Data Siswa & Quick Edit Manual */}
      <TableCell>
        <div className="flex items-center justify-between gap-2 bg-slate-50/90 p-2 rounded-xl border border-slate-200/80 hover:border-emerald-300 transition-colors">
          <div className="space-y-0.5">
            {item.effective_students_count > 0 ? (
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {item.student_source === 'manual' ? (
                    <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[11px] font-black hover:bg-amber-100">
                      📝 {item.effective_students_count} Siswa (Manual Terpercaya)
                    </Badge>
                  ) : (
                    <Badge className="bg-blue-100 text-blue-900 border-blue-300 text-[11px] font-black hover:bg-blue-100">
                      🎓 {item.effective_students_count} Siswa (Data Tersedia)
                    </Badge>
                  )}
                  {item.students_detail_count > 0 && item.jumlah_siswa_manual && item.jumlah_siswa_manual > 0 && (
                    <span
                      className="text-[9px] font-black px-1.5 py-0.5 rounded border text-amber-800 bg-amber-50 border-amber-300"
                      title="Data input manual dijadikan acuan terpercaya"
                    >
                      Prioritas Manual
                    </span>
                  )}
                </div>

                {/* Sub-line showing both values if both exist or detail is partial */}
                <div className="text-[10px] text-slate-500 font-medium pt-0.5">
                  {item.students_detail_count > 0 && item.jumlah_siswa_manual && item.jumlah_siswa_manual > 0 ? (
                    <span>
                      Manual (Terpercaya): <b>{item.jumlah_siswa_manual}</b> • Rinci: <span className="text-slate-400">{item.students_detail_count}</span>
                    </span>
                  ) : item.students_detail_count > 0 ? (
                    <span>
                      Data Tersedia (Rinci): <b>{item.students_detail_count}</b> siswa • <span className="text-slate-400">Manual: -</span>
                    </span>
                  ) : item.jumlah_siswa_manual && item.jumlah_siswa_manual > 0 ? (
                    <span
                      title={
                        item.jumlah_siswa_per_kelas
                          ? Object.entries(item.jumlah_siswa_per_kelas)
                              .map(([k, v]) => `${k}: ${v} siswa`)
                              .join(' • ')
                          : undefined
                      }
                      className={item.jumlah_siswa_per_kelas ? 'cursor-help' : ''}
                    >
                      Manual: <b>{item.jumlah_siswa_manual}</b> {item.jumlah_siswa_per_kelas ? '(Per Kelas)' : ''}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="space-y-0.5">
                <Badge className="bg-slate-200/80 text-slate-600 border-slate-300 text-[10px] font-bold hover:bg-slate-200/80">
                  0 Siswa (Kosong)
                </Badge>
                <div className="text-[10px] text-slate-400">Belum ada data</div>
              </div>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenQuickEdit(item)}
            title="Isi / Ubah Jumlah Siswa Manual (Total atau Per Kelas)"
            className="h-7 px-2 rounded-lg text-emerald-800 bg-white hover:bg-emerald-50 hover:border-emerald-300 border-slate-200 shadow-xs flex items-center gap-1 font-bold text-[10px] shrink-0"
          >
            <Edit3 className="w-3 h-3 text-emerald-600" />
            <span className="hidden sm:inline">Input Manual</span>
          </Button>
        </div>
      </TableCell>

      {/* Status Kelengkapan */}
      <TableCell className="text-center">
        {item.completeness_status === 'complete' ? (
          <Badge className="bg-emerald-600 text-white font-extrabold text-[10px] px-2 py-0.5 shadow-sm">
            🟢 Lengkap
          </Badge>
        ) : item.completeness_status === 'teachers_only' ? (
          <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-extrabold text-[10px] px-2 py-0.5">
            🟡 Kurang Siswa
          </Badge>
        ) : item.completeness_status === 'students_only' ? (
          <Badge className="bg-sky-100 text-sky-800 border-sky-300 font-extrabold text-[10px] px-2 py-0.5">
            🟡 Kurang Guru
          </Badge>
        ) : (
          <Badge className="bg-rose-600 text-white font-extrabold text-[10px] px-2 py-0.5 shadow-sm">
            🔴 Kosong
          </Badge>
        )}
      </TableCell>

      {/* Kepala & Kontak */}
      <TableCell>
        <div className="space-y-0.5 text-xs">
          <span className="font-bold text-slate-800 block truncate max-w-[180px]">
            {item.kepala_madrasah || <i className="text-slate-400">Belum diset</i>}
          </span>
          <span className="text-[10px] font-mono text-slate-500 block">
            {item.kepala_whatsapp || item.telepon || '-'}
          </span>
        </div>
      </TableCell>

      {/* Aksi (Hubungi WA) */}
      <TableCell className="text-center">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onSendWa(item)}
          title={hasWhatsapp ? 'Kirim Pengingat WhatsApp' : 'Lihat Template Pesan WA'}
          className={cn(
            'h-8 px-2.5 rounded-xl font-bold text-xs gap-1.5 transition-all shadow-sm',
            hasWhatsapp
              ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
              : 'bg-slate-50 hover:bg-slate-100 text-slate-500 border-slate-200'
          )}
        >
          <MessageCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>Ingatkan</span>
        </Button>
      </TableCell>
    </TableRow>
  );
}
