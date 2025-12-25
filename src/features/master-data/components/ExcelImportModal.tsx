import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../../../components/ui/dialog"
import { Button } from "../../../components/ui/button"
import { FileSpreadsheet } from "lucide-react"
import FileUploadStep from "../../../features/emis-import/components/FileUploadStep"
import { useState } from "react"

interface ExcelImportModalProps {
  title: string
  description: string
  onImport: (data: Record<string, unknown>[]) => void
  triggerLabel?: string
}

export default function ExcelImportModal({ title, description, onImport, triggerLabel = "Import Excel" }: ExcelImportModalProps) {
  const [open, setOpen] = useState(false)

  const handleFileAccepted = (_: File, __: string[], data: Record<string, unknown>[]) => {
    onImport(data)
    setOpen(false)
    // In a real app, this would be a toast
    window.alert(`Berhasil mengimpor ${data.length} data!`)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="py-6">
             <FileUploadStep onFileAccepted={handleFileAccepted} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
