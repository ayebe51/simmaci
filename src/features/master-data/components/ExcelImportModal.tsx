import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../../../components/ui/dialog"
import { Button } from "../../../components/ui/button"
import { FileSpreadsheet } from "lucide-react"
import FileUploadStep from "../../../features/emis-import/components/FileUploadStep"
import { useState } from "react"
import { toast } from "sonner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table"
interface ExcelImportModalProps {
  title: string
  description: string
  onImport?: (data: Record<string, unknown>[]) => void
  onFileImport?: (file: File) => Promise<void>
  triggerLabel?: string | React.ReactNode
  // Controlled mode props (optional)
  isOpen?: boolean
  onClose?: () => void
  entityType?: string
  onImportSuccess?: () => void
  // Template download (OLD - deprecated, use FileUploadStep handlers)
  onDownloadTemplate?: () => void
  templateUrl?: string
  enablePreview?: boolean
}

export default function ExcelImportModal({ 
  title, 
  description, 
  onImport, 
  onFileImport, 
  triggerLabel = "Import Excel",
  isOpen: controlledOpen,
  onClose: controlledOnClose,
  onImportSuccess,
  onDownloadTemplate,
  templateUrl,
  enablePreview = false,
}: ExcelImportModalProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  
  // Preview states
  const [previewData, setPreviewData] = useState<Record<string, unknown>[] | null>(null)
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  // Use controlled state if provided, otherwise use internal state
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen

  const closeModal = () => {
    if (isControlled && controlledOnClose) {
      controlledOnClose()
    } else {
      setInternalOpen(false)
    }
    // Reset preview
    setTimeout(() => {
      setPreviewData(null)
      setSelectedFile(null)
      setPreviewHeaders([])
    }, 300)
  }

  const processImport = async (file: File, data: Record<string, unknown>[]) => {
    if (onFileImport) {
        try {
            setIsUploading(true)
            await onFileImport(file)
            setIsUploading(false)
            closeModal()
            if (onImportSuccess) onImportSuccess()
            toast.success("Berhasil mengimpor data!")
        } catch(error: unknown) {
            setIsUploading(false)
            toast.error("Gagal import: " + (error as Error).message)
        }
    } else if (onImport) {
        try {
            setIsUploading(true)
            await onImport(data)
            setIsUploading(false)
            closeModal()
            if (onImportSuccess) onImportSuccess()
        } catch(error: unknown) {
            setIsUploading(false)
            toast.error("Gagal import: " + (error as Error).message)
        }
    }
  }

  const handleFileAccepted = async (file: File, headers: string[], data: Record<string, unknown>[]) => {
    if (enablePreview) {
      setPreviewHeaders(headers)
      setPreviewData(data)
      setSelectedFile(file)
      return
    }
    await processImport(file, data)
  }

  const handleConfirmImport = async () => {
    if (!selectedFile || !previewData) return
    await processImport(selectedFile, previewData)
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      closeModal()
    } else {
      if (!isControlled) {
        setInternalOpen(true)
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!isControlled && (
        <DialogTrigger asChild>
          {typeof triggerLabel === 'string' ? (
            <Button variant="outline" className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              {triggerLabel}
            </Button>
          ) : (
            <button type="button">{triggerLabel}</button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className={previewData ? "sm:max-w-4xl" : "sm:max-w-xl"}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {!previewData ? (
          <>
            {onDownloadTemplate && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
                <p className="text-sm text-blue-800 font-medium mb-2">ℹ️ Download Template</p>
                <p className="text-xs text-blue-700 mb-3">
                  Anda bisa download template Excel terlebih dahulu, lalu isi data sesuai format yang sudah ditentukan.
                </p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={onDownloadTemplate}
                  className="w-full"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Download Template Excel
                </Button>
              </div>
            )}

            <FileUploadStep
              onFileAccepted={handleFileAccepted}
              disabled={isUploading}
              templateUrl={templateUrl}
            />

            {isUploading && <p className="text-center text-sm text-muted-foreground">Mengupload...</p>}
          </>
        ) : (
          <div className="space-y-4">
             <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl text-sm text-blue-800">
               <strong>Preview Data (Dry Run)</strong> - Ditemukan <strong>{previewData.length}</strong> baris data. Silakan tinjau beberapa baris pertama sebelum mengimpor.
             </div>
             
             <div className="max-h-[50vh] overflow-auto border rounded-xl shadow-inner">
               <Table>
                 <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                    <TableRow>
                       <TableHead className="w-12 text-center text-xs font-bold">No</TableHead>
                       {previewHeaders.slice(0, 8).map(h => (
                          <TableHead key={h} className="whitespace-nowrap text-xs font-bold">{h}</TableHead>
                       ))}
                    </TableRow>
                 </TableHeader>
                 <TableBody>
                    {previewData.slice(0, 50).map((row, i) => (
                       <TableRow key={i} className="hover:bg-slate-50">
                          <TableCell className="text-center text-xs text-slate-500">{i + 1}</TableCell>
                          {previewHeaders.slice(0, 8).map(h => (
                             <TableCell key={h} className="whitespace-nowrap text-xs truncate max-w-[200px]">
                                {String(row[h] ?? '')}
                             </TableCell>
                          ))}
                       </TableRow>
                    ))}
                 </TableBody>
               </Table>
             </div>
             
             {previewData.length > 50 && (
               <p className="text-center text-xs text-slate-500 font-medium">Menampilkan 50 baris pertama dari {previewData.length} total baris...</p>
             )}
             
             <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
               <Button variant="outline" onClick={() => setPreviewData(null)} disabled={isUploading}>Batal / Pilih Ulang</Button>
               <Button onClick={handleConfirmImport} disabled={isUploading} className="bg-emerald-600 hover:bg-emerald-700 font-semibold shadow-sm">
                 {isUploading ? "Memproses Import..." : "Konfirmasi & Import"}
               </Button>
             </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
