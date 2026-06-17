import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { useState, useEffect } from "react"
import { Loader2 } from "lucide-react"

interface PreviewData {
  id: number
  nim: string | null
  nama_file: string
  nama_db: string
  unit_file: string
  unit_db: string
  status: string
  action: string
  message: string
  target_id: number | null
  payload: any
}

interface ImportPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  previews: PreviewData[]
  onCommit: (selectedRows: PreviewData[]) => Promise<void>
  isCommitting: boolean
}

export default function ImportPreviewModal({
  isOpen,
  onClose,
  previews,
  onCommit,
  isCommitting
}: ImportPreviewModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  // Select all by default when previews change, except SKIP actions
  useEffect(() => {
    if (isOpen && previews.length > 0) {
      setSelectedIds(new Set(previews.filter(p => p.action !== 'SKIP').map(p => p.id)))
    }
  }, [isOpen, previews])

  const toggleSelection = (id: number) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setSelectedIds(newSet)
  }

  const toggleAll = () => {
    const validPreviews = previews.filter(p => p.action !== 'SKIP')
    if (selectedIds.size === validPreviews.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(validPreviews.map(p => p.id)))
    }
  }

  const handleCommit = async () => {
    const selectedRows = previews.filter(p => selectedIds.has(p.id))
    await onCommit(selectedRows)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'INSERT_BARU':
        return <Badge className="bg-emerald-500">Baru</Badge>
      case 'UPDATE_AMAN':
        return <Badge className="bg-blue-500">Update Data</Badge>
      case 'TAKEOVER':
        return <Badge className="bg-orange-500">Ambil Alih NIM</Badge>
      case 'KONFLIK':
        return <Badge className="bg-red-500">Konflik</Badge>
      case 'KONFLIK_INTERNAL':
        return <Badge className="bg-red-700">Ganda di File</Badge>
      case 'MANUAL':
        return <Badge className="bg-slate-500">Manual</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(v) => { if (!isCommitting) onClose() }}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col p-6 rounded-[2rem]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Preview Import Data Guru</DialogTitle>
          <DialogDescription>
            Silakan periksa data sebelum diimpor. Terdapat <strong>{previews.length}</strong> baris dari file.
            Sistem secara otomatis mendeteksi kecocokan data dengan database.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto mt-4 border border-slate-100 rounded-xl">
          <Table className="relative">
            <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
              <TableRow>
                <TableHead className="w-10 text-center">
                  <Checkbox 
                    checked={selectedIds.size > 0 && selectedIds.size === previews.length}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead className="min-w-[100px] font-bold text-slate-700">NIM</TableHead>
                <TableHead className="min-w-[200px] font-bold text-slate-700">Nama (File Excel)</TableHead>
                <TableHead className="min-w-[200px] font-bold text-slate-700">Nama (Database)</TableHead>
                <TableHead className="min-w-[150px] font-bold text-slate-700">Unit Kerja (Excel)</TableHead>
                <TableHead className="min-w-[150px] font-bold text-slate-700">Unit Kerja (DB)</TableHead>
                <TableHead className="min-w-[120px] font-bold text-slate-700">Status</TableHead>
                <TableHead className="min-w-[200px] font-bold text-slate-700">Keterangan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {previews.map(row => (
                <TableRow key={row.id} className={(row.status === 'KONFLIK' || row.status === 'KONFLIK_INTERNAL') ? 'bg-red-50/50' : 'hover:bg-slate-50/50'}>
                  <TableCell className="text-center">
                    <Checkbox 
                      checked={selectedIds.has(row.id)}
                      onCheckedChange={() => toggleSelection(row.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium text-emerald-700">{row.nim || '-'}</TableCell>
                  <TableCell className="font-semibold text-slate-800">{row.nama_file}</TableCell>
                  <TableCell className="text-slate-500 italic">{row.nama_db || '-'}</TableCell>
                  <TableCell className="text-sm">{row.unit_file}</TableCell>
                  <TableCell className="text-slate-500 italic text-sm">{row.unit_db || '-'}</TableCell>
                  <TableCell>{getStatusBadge(row.status)}</TableCell>
                  <TableCell className="text-xs text-slate-600 leading-tight">{row.message}</TableCell>
                </TableRow>
              ))}
              {previews.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-slate-500 font-medium">
                    Tidak ada data preview.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <DialogFooter className="mt-6 flex gap-3">
          <Button variant="outline" className="rounded-xl border-slate-200 text-slate-600 font-bold" onClick={onClose} disabled={isCommitting}>Batal</Button>
          <Button onClick={handleCommit} disabled={selectedIds.size === 0 || isCommitting} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold text-white">
            {isCommitting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Menyimpan...</>
            ) : (
              `Simpan ${selectedIds.size} Data Terpilih`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
