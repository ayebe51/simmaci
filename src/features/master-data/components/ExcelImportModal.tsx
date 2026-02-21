import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../../../components/ui/dialog"
import { Button } from "../../../components/ui/button"
import { FileSpreadsheet } from "lucide-react"
import FileUploadStep from "../../../features/emis-import/components/FileUploadStep"
import { useState } from "react"
import { toast } from "sonner"

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
}: ExcelImportModalProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  // Use controlled state if provided, otherwise use internal state
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen

  const handleFileAccepted = async (file: File, _: string[], data: Record<string, unknown>[]) => {
    if (onFileImport) {
        try {
            setIsUploading(true)
            await onFileImport(file)
            setIsUploading(false)
            if (isControlled && controlledOnClose) {
              controlledOnClose()
            } else {
              setInternalOpen(false)
            }
            if (onImportSuccess) {
              onImportSuccess()
            }
            toast.success("Berhasil mengimpor data!")
        } catch(error: unknown) {
            setIsUploading(false)
            toast.error("Gagal import: " + (error as Error).message)
        }
    } else if (onImport) {
        onImport(data)
        if (isControlled && controlledOnClose) {
          controlledOnClose()
        } else {
          setInternalOpen(false)
        }
        if (onImportSuccess) {
          onImportSuccess()
        }
        toast.success(`Berhasil mengimpor ${data.length} data!`)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (isControlled) {
      if (!newOpen && controlledOnClose) {
        controlledOnClose()
      }
    } else {
      setInternalOpen(newOpen)
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
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

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
        />

        {isUploading && <p className="text-center text-sm text-muted-foreground">Mengupload...</p>}
      </DialogContent>
    </Dialog>
  )
}
