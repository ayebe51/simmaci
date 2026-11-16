import React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AlertTriangle, XCircle, FileSpreadsheet } from "lucide-react"

export interface DateValidationErrorItem {
  sheet?: string
  row: number
  column: string
  value: string
  reason: string
}

interface DateValidationErrorDialogProps {
  isOpen: boolean
  onClose: () => void
  errors: DateValidationErrorItem[]
  title?: string
}

export function DateValidationErrorDialog({
  isOpen,
  onClose,
  errors,
  title = "Format Tanggal Tidak Sesuai!",
}: DateValidationErrorDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="space-y-2 pb-2">
          <div className="flex items-center gap-2 text-rose-600">
            <div className="rounded-full bg-rose-100 p-2">
              <XCircle className="h-5 w-5" />
            </div>
            <DialogTitle className="text-lg font-bold text-slate-900">
              {title}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-600 leading-relaxed">
            SIMMACI hanya menerima tanggal yang <strong>mencantumkan nama bulan</strong> (contoh: <code>11 Nov 2022</code>, <code>11 November 2022</code>, <code>11 Nopember 2022</code>). Format numerik ambigu (seperti <code>11/12/2022</code> atau <code>2022-12-11</code>) ditolak untuk menjaga integritas data. Seluruh proses import telah <strong>dibatalkan tanpa perubahan data</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="my-2 rounded-lg border border-rose-200 bg-rose-50/60 p-3 text-xs text-rose-800">
          <div className="flex items-center gap-1.5 font-semibold mb-1">
            <AlertTriangle className="h-4 w-4 text-rose-600" />
            Ditemukan {errors.length} kesalahan tanggal pada file Excel:
          </div>
          <p className="text-[11px] text-rose-700">
            Silakan perbaiki format tanggal pada sel terkait di file Excel Anda, lalu unggah kembali.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto border rounded-lg">
          <Table>
            <TableHeader className="bg-slate-50 sticky top-0 z-10">
              <TableRow>
                <TableHead className="w-16 text-center text-xs font-bold">Baris</TableHead>
                <TableHead className="text-xs font-bold">Kolom</TableHead>
                <TableHead className="text-xs font-bold">Nilai di Excel</TableHead>
                <TableHead className="text-xs font-bold">Alasan Penolakan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {errors.map((err, idx) => (
                <TableRow key={idx} className="hover:bg-slate-50/70">
                  <TableCell className="text-center text-xs font-semibold text-slate-700">
                    {err.row}
                  </TableCell>
                  <TableCell className="text-xs font-medium text-slate-800">
                    {err.column}
                  </TableCell>
                  <TableCell className="text-xs">
                    <code className="rounded bg-rose-100/80 px-1.5 py-0.5 font-mono text-rose-700">
                      {err.value || "(kosong)"}
                    </code>
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">
                    {err.reason}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <DialogFooter className="pt-3 border-t">
          <Button onClick={onClose} variant="default" className="w-full sm:w-auto">
            Tutup & Perbaiki File
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DateValidationErrorDialog
