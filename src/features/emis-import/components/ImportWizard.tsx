import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"
import FileUploadStep from "./FileUploadStep"
import MappingStep from "./MappingStep"
import { PreviewStep } from "./PreviewStep"

export type ImportStep = 1 | 2 | 3 | 4

export default function ImportWizard() {
  const [step, setStep] = useState<ImportStep>(1)
  const [file, setFile] = useState<File | null>(null)
  const [rawHeaders, setRawHeaders] = useState<string[]>([])
  const [rawData, setRawData] = useState<Record<string, unknown>[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})

  const handleFileAccepted = (acceptedFile: File, headers: string[], data: Record<string, unknown>[]) => {
    setFile(acceptedFile)
    setRawHeaders(headers)
    setRawData(data)
    setStep(2)
  }

  const handleMappingComplete = (newMapping: Record<string, string>) => {
      setMapping(newMapping)
      setStep(3)
  }

  return (
    <div className="space-y-8">
      {/* Stepper Indicator */}
      <div className="relative after:absolute after:inset-x-0 after:top-1/2 after:block after:h-0.5 after:-translate-y-1/2 after:rounded-lg after:bg-muted">
        <ol className="relative z-10 flex justify-between text-sm font-medium text-gray-500">
            {[
                { id: 1, label: "Upload File" },
                { id: 2, label: "Mapping Data" },
                { id: 3, label: "Validasi & Preview" },
                { id: 4, label: "Selesai" }
            ].map((s) => (
                <li key={s.id} className="flex items-center gap-2 bg-background p-2">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full ${step >= s.id ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        {step > s.id ? <Check className="h-4 w-4" /> : s.id}
                    </span>
                    <span className={step >= s.id ? "text-primary" : ""}>{s.label}</span>
                </li>
            ))}
        </ol>
      </div>

      <Card className="min-h-[400px]">
        {step === 1 && (
            <FileUploadStep onFileAccepted={handleFileAccepted} />
        )}
        {step === 2 && (
             <MappingStep 
                headers={rawHeaders} 
                sampleData={rawData.slice(0, 5)} 
                onNext={handleMappingComplete}
                onBack={() => setStep(1)}
             />
        )}
        {step === 3 && (
            <PreviewStep 
                data={rawData} 
                mapping={mapping} 
                onBack={() => setStep(2)}
                onFinish={() => setStep(4)}
            />
        )}
        {step === 4 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="mb-4 rounded-full bg-green-100 p-6">
                    <Check className="h-10 w-10 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold">Import Berhasil!</h2>
                <p className="mb-8 text-muted-foreground">Data dari {file?.name} telah berhasil diproses dan disimpan ke database.</p>
                <Button onClick={() => {
                    setStep(1)
                    setFile(null)
                    setRawData([])
                }}>Import File Lain</Button>
            </div>
        )}
      </Card>
    </div>
  )
}
