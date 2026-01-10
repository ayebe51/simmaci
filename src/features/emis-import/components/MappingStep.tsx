import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table" // Note: Assuming we have Table component
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react"
import { useEffect, useState } from "react"

// Defines the internal schema we expect
const TARGET_SCHEMA = [
    { key: "nisn", label: "NISN", required: true },
    { key: "nik", label: "NIK", required: true },
    { key: "name", label: "Nama Lengkap", required: true },
    { key: "gender", label: "Jenis Kelamin (L/P)", required: true },
    { key: "birthPlace", label: "Tempat Lahir", required: false },
    { key: "birthDate", label: "Tanggal Lahir", required: false },
    { key: "class", label: "Kelas", required: true },
    { key: "fatherName", label: "Nama Ayah", required: false },
    { key: "motherName", label: "Nama Ibu", required: false },
    { key: "address", label: "Alamat", required: false },
]

interface MappingStepProps {
  headers: string[]
  sampleData: Record<string, unknown>[] // First few rows to show examples
  onNext: (mapping: Record<string, string>) => void
  onBack: () => void
}

export default function MappingStep({ headers, sampleData, onNext, onBack }: MappingStepProps) {
  const [mapping, setMapping] = useState<Record<string, string>>({})

  // Auto-map logic
  useEffect(() => {
    const initialMapping: Record<string, string> = {}
    TARGET_SCHEMA.forEach(field => {
        // Simple fuzzy match: check if header includes field key or label parts
        const match = headers.find(h => 
            h.toLowerCase().includes(field.key) || 
            h.toLowerCase().includes(field.label.split(" ")[0].toLowerCase())
        )
        if (match) {
            initialMapping[field.key] = match
        }
    })
    setMapping(initialMapping)
  }, [headers])

  const handleMapChange = (targetKey: string, sourceHeader: string) => {
      setMapping(prev => ({ ...prev, [targetKey]: sourceHeader }))
  }

  const isFormValid = TARGET_SCHEMA.every(field => !field.required || mapping[field.key])

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
         <div>
            <h3 className="text-lg font-semibold">Mapping Data</h3>
            <p className="text-sm text-muted-foreground">Pasangkan kolom dari file Excel Anda ke kolom sistem Database SIM Maarif.</p>
         </div>
         <Button variant="outline" size="sm" onClick={() => setMapping({})}>
            <RotateCcw className="mr-2 h-4 w-4"/> Reset Mapping
         </Button>
      </div>

      <div className="rounded-md border">
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="w-[300px]">Kolom Sistem (Target)</TableHead>
                    <TableHead className="w-[300px]">Kolom File Excel (Sumber)</TableHead>
                    <TableHead>Contoh Data (Baris 1)</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {TARGET_SCHEMA.map((field) => {
                    const selectedSource = mapping[field.key]
                    const sampleValue = selectedSource && sampleData.length > 0 ? sampleData[0][selectedSource] : "-"
                    
                    return (
                        <TableRow key={field.key}>
                            <TableCell>
                                <div className="flex flex-col">
                                    <span className="font-medium">
                                        {field.label} {field.required && <span className="text-red-500">*</span>}
                                    </span>
                                    <span className="text-xs text-muted-foreground">{field.key}</span>
                                </div>
                            </TableCell>
                            <TableCell>
                                <Select 
                                    value={selectedSource || ""} 
                                    onValueChange={(val) => handleMapChange(field.key, val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Pilih Kolom..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {headers.map(h => (
                                            <SelectItem key={h} value={h}>{h}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                                {String(sampleValue)}
                            </TableCell>
                        </TableRow>
                    )
                })}
            </TableBody>
        </Table>
      </div>

      <div className="mt-8 flex justify-between">
          <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="mr-2 h-4 w-4"/> Kembali
          </Button>
          <Button onClick={() => onNext(mapping)} disabled={!isFormValid}>
              Lanjut Validasi <ArrowRight className="ml-2 h-4 w-4"/>
          </Button>
      </div>
    </div>
  )
}
