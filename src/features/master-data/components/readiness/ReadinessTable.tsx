import React from 'react';
import { SchoolReadinessItem } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CheckCircle2, Loader2 } from 'lucide-react';

interface ReadinessTableProps {
  schools: SchoolReadinessItem[];
  totalSchools: number;
  isLoading: boolean;
  filterStatus: string;
  currentPage: number;
  perPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
  onOpenQuickEdit: (school: SchoolReadinessItem) => void;
  onSendWa: (school: SchoolReadinessItem) => void;
}

export function ReadinessTable({
  schools,
  isLoading,
  filterStatus,
}: ReadinessTableProps) {
  return (
    <Card className="rounded-2xl border-slate-200 shadow-sm bg-white overflow-hidden">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/80 border-b border-slate-100">
              <TableRow>
                <TableHead className="w-12 text-center text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  No
                </TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-wider min-w-[260px]">
                  Nama Satpen & Wilayah
                </TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-wider w-24 text-center">
                  Jenjang
                </TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-wider text-center w-28">
                  Guru Aktif
                </TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-wider text-center min-w-[220px]">
                  Data Siswa
                </TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-wider text-center w-36">
                  Status
                </TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-wider min-w-[190px]">
                  Kepala & Kontak
                </TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-wider text-center w-28">
                  Aksi
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                      <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                      <span className="text-xs font-bold uppercase tracking-wider">
                        Memuat data kesiapan satpen...
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : schools.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                      <CheckCircle2 className="w-10 h-10 text-emerald-400/40" />
                      <h4 className="font-bold text-slate-700 text-sm">
                        Tidak ada madrasah ditemukan
                      </h4>
                      <p className="text-xs text-slate-400 max-w-sm">
                        {filterStatus === 'incomplete'
                          ? 'Luar biasa! Tidak ada madrasah dengan data yang belum lengkap pada filter ini.'
                          : 'Coba ubah kata kunci pencarian atau sesuaikan filter wilayah.'}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
