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
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { ReadinessTableRow } from './ReadinessTableRow';

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
  totalSchools,
  isLoading,
  filterStatus,
  currentPage,
  perPage,
  totalPages,
  onPageChange,
  onPerPageChange,
  onOpenQuickEdit,
  onSendWa,
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
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-wider text-center min-w-[260px]">
                  Data Siswa (Max Rinci / Manual)
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
              ) : (
                schools.map((item, idx) => {
                  const rowNumber = (currentPage - 1) * perPage + idx + 1;
                  return (
                    <ReadinessTableRow
                      key={item.id}
                      item={item}
                      rowNumber={rowNumber}
                      onOpenQuickEdit={onOpenQuickEdit}
                      onSendWa={onSendWa}
                    />
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Menampilkan baris per halaman:</span>
            <Select
              value={String(perPage)}
              onValueChange={(val) => onPerPageChange(parseInt(val, 10))}
            >
              <SelectTrigger className="h-8 w-20 text-xs rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl text-xs">
                <SelectItem value="15">15</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <span className="ml-2">
              Total <b>{totalSchools}</b> Satpen
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1 || isLoading}
              className="h-8 rounded-lg text-xs font-bold"
            >
              Sebelumnya
            </Button>
            <span className="text-xs font-bold text-slate-700 px-2">
              Halaman {currentPage} dari {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages || isLoading}
              className="h-8 rounded-lg text-xs font-bold"
            >
              Selanjutnya
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
