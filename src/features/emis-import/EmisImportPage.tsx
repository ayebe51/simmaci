import ImportWizard from "./components/ImportWizard"
import { api } from "@/lib/api"

export default function EmisImportPage() {
  // The following code block seems to be intended for a component that handles the upload logic,
  // likely within the ImportWizard or a similar component.
  // For the purpose of this edit, it's placed here as per the instruction's structure,
  // assuming `parsedData`, `setIsUploading`, `setFile`, `setParsedData`, `setStep`, `fileInputRef`, and `toast`
  // would be defined or imported within this scope if this function were to be used directly here.
  // However, given the existing `ImportWizard` component, this logic might belong inside it.
  // I'm placing it here as a standalone function for now, as the instruction doesn't provide context
  // on where these variables are defined.
  // This function is not called anywhere in the current EmisImportPage component.


  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
         <h1 className="text-3xl font-bold tracking-tight">Import Data</h1>
         <p className="text-muted-foreground">Upload file export EMIS (Excel/CSV) untuk memperbarui data Sekolah, Guru, dan Siswa.</p>
      </div>

      <ImportWizard />

      <div className="rounded-lg border bg-blue-50 p-4 text-sm text-blue-900">
         <strong>Catatan:</strong> Pastikan format file sesuai dengan template standar EMIS terbaru. Sistem akan otomatis mendeteksi kolom yang sesuai.
      </div>
    </div>
  )
}
