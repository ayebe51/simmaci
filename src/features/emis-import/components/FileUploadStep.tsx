import { Button } from "@/components/ui/button"
import { UploadCloud, FileSpreadsheet, Loader2 } from "lucide-react"
import { useCallback, useState } from "react"
import * as XLSX from "xlsx"
import * as mammoth from "mammoth"

interface FileUploadStepProps {
  onFileAccepted: (file: File, headers: string[], data: Record<string, unknown>[]) => void
  disabled?: boolean

}

export default function FileUploadStep({ onFileAccepted, disabled }: FileUploadStepProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const processFile = useCallback((file: File) => {
    setIsProcessing(true)
    const reader = new FileReader()

    reader.onload = async (e) => {
        try {
            const data = e.target?.result
            if (!data) return

            let jsonData: Record<string, unknown>[] = []

            if (file.name.endsWith(".docx") || file.name.endsWith(".doc")) {
                 try {
                     // Use static import
                     const arrayBuffer = data as ArrayBuffer;
                     const result = await mammoth.convertToHtml({ arrayBuffer });
                     const html = result.value;
                     
                     const parser = new DOMParser();
                     const doc = parser.parseFromString(html, 'text/html');
                     const table = doc.querySelector('table');

                     if (table) {
                         const rows = Array.from(table.querySelectorAll('tr'));
                         if (rows.length > 0) {
                             const headers = Array.from(rows[0].querySelectorAll('td, th')).map(cell => cell.textContent?.trim() || "");
                             jsonData = rows.slice(1).map(row => {
                                 const cells = Array.from(row.querySelectorAll('td'));
                                 const obj: Record<string, unknown> = {};
                                 headers.forEach((header, index) => {
                                     obj[header] = cells[index]?.textContent?.trim() || "";
                                 });
                                 return obj;
                             });
                         }
                     } else {
                         throw new Error("Tidak ditemukan tabel dalam file Word ini.");
                     }
                 } catch (err: any) {
                     console.error("Mammoth error:", err);
                     throw new Error("Gagal memproses file Word: " + err.message);
                 }
            } else {
                // EXCEL / CSV Processing
                const workbook = XLSX.read(data, { type: 'binary' })
                const sheetName = workbook.SheetNames[0]
                const sheet = workbook.Sheets[sheetName]
                jsonData = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as Record<string, unknown>[]
            }
            
            if (jsonData.length > 0) {
                 const headers = Object.keys(jsonData[0] as object)
                 // Artificial delay for UX
                 setTimeout(() => {
                    onFileAccepted(file, headers, jsonData)
                    setIsProcessing(false)
                 }, 800)
            } else {
                alert("File kosong atau format tidak valid")
                setIsProcessing(false)
            }
        } catch (error: any) {
            console.error(error)
            alert(error.message || "Gagal membaca file")
            setIsProcessing(false)
        }
    }
    
    if (file.name.endsWith(".docx") || file.name.endsWith(".doc")) {
        reader.readAsArrayBuffer(file)
    } else {
        reader.readAsBinaryString(file)
    }
  }, [onFileAccepted])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const files = e.dataTransfer.files
    if (files.length > 0) {
        processFile(files[0])
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          processFile(e.target.files[0])
      }
  }

  return (
    <div className="flex h-full flex-col items-center justify-center p-12 text-center">
      <div 
        className={`flex w-full max-w-xl flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 transition-colors
            ${isDragOver ? "border-primary bg-blue-50" : "border-slate-200 bg-slate-50"}
        `}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        <div className="mb-4 rounded-full bg-slate-100 p-4">
             {isProcessing ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <UploadCloud className="h-8 w-8 text-slate-500" />}
        </div>
        
        <h3 className="mb-1 text-lg font-semibold">
            {isProcessing ? "Memproses File..." : "Upload File EMIS"}
        </h3>
        <p className="mb-6 text-sm text-muted-foreground">
             Drag & drop file Excel (.xlsx), Word (.docx) atau CSV di sini.
        </p>

        <div className="relative">
             <input 
                type="file" 
                accept=".xlsx, .xls, .csv, .docx, .doc" 
                aria-label="Upload Excel, CSV, or Word file"
                className="absolute inset-0 cursor-pointer opacity-0"
                onChange={handleFileSelect}
                disabled={isProcessing}
            />
            <Button disabled={isProcessing}>Pilih File</Button>
        </div>
      </div>


    </div>
  )
}
