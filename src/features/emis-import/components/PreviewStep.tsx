import { useMemo, useState } from "react"
import { toast } from "sonner"
import { CheckCircle, AlertCircle, Save, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
// 🔥 CONVEX for bulk import
import { useMutation } from "convex/react"
import { api as convexApi } from "../../../../convex/_generated/api"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface PreviewStepProps {
    data: any[]
    mapping: Record<string, string>
    onBack: () => void
    onFinish: () => void
}

export function PreviewStep({ data, mapping, onBack, onFinish }: PreviewStepProps) {
    const [isSaving, setIsSaving] = useState(false)
    
    // 🔥 CONVEX MUTATION for bulk import
    const bulkCreateMutation = useMutation(convexApi.students.bulkCreate)

  // Transform Data
  const transformedData = useMemo(() => {
      return data.map((row, idx) => {
          // Explicitly cast to Record<string, unknown> to allow dynamic property access
          const newRow: Record<string, unknown> & { _id: number, _errors: string[] } = { _id: idx, _errors: [] }
          Object.entries(mapping).forEach(([targetKey, sourceHeader]) => {
              newRow[targetKey] = row[sourceHeader]
          })

          // Validation Logic
          if (!newRow.nisn) newRow._errors.push("NISN wajib diisi")
          else if (!/^\d{10}$/.test(String(newRow.nisn))) newRow._errors.push("Format NISN salah (10 digit)")

          if (!newRow.nik) newRow._errors.push("NIK wajib diisi")
          else if (!/^\d{16}$/.test(String(newRow.nik))) newRow._errors.push("Format NIK salah (16 digit)")

          if (!newRow.name) newRow._errors.push("Nama wajib diisi")
          if (!newRow.gender) newRow._errors.push("JK wajib diisi")
          if (!newRow.class) newRow._errors.push("Kelas wajib diisi")
          
          if (!newRow.birthDate) newRow._errors.push("Tgl Lahir wajib diisi")
          if (!newRow.birthPlace) newRow._errors.push("Tempat Lahir wajib diisi")

          return newRow
      })
  }, [data, mapping])

  const invalidRows = transformedData.filter(r => r._errors.length > 0)
  const validCount = transformedData.length - invalidRows.length

  const handleSave = async () => {
      setIsSaving(true)
      try {
          // Filter only valid rows and map EMIS fields to student schema
          const validData = transformedData
            .filter(r => r._errors.length === 0)
            .map((row) => ({
              nisn: String(row.nisn),
              nama: String(row.name || ''),
              nomorIndukMaarif: row.nomorIndukMaarif ? String(row.nomorIndukMaarif) : undefined,
              jenisKelamin: row.gender ? String(row.gender) : undefined,
              tempatLahir: row.birthPlace ? String(row.birthPlace) : undefined,
              tanggalLahir: row.birthDate ? String(row.birthDate) : undefined,
              alamat: row.alamat ? String(row.alamat) : undefined,
              kecamatan: row.kecamatan ? String(row.kecamatan) : undefined,
              namaSekolah: row.namaSekolah ? String(row.namaSekolah) : undefined,
              kelas: row.class ? String(row.class) : undefined,
              nomorTelepon: row.nomorTelepon ? String(row.nomorTelepon) : undefined,
              namaWali: row.namaWali ? String(row.namaWali) : undefined,
            }))
          
          if (validData.length === 0) {
              toast.error("Tidak ada data valid untuk disimpan")
              return
          }

          // 🔥 CALL CONVEX MUTATION
          const result = await bulkCreateMutation({ students: validData })
          toast.success(`Berhasil menyimpan ${result.count} data siswa`)
          onFinish()
      } catch (err: any) {
          toast.error(err.message || "Gagal menyimpan data")
      } finally {
          setIsSaving(false)
      }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
         <h3 className="text-lg font-semibold">Validasi & Preview</h3>
         <div className="mt-2 flex gap-4 text-sm">
             <div className="rounded-md bg-green-50 px-3 py-1 text-green-700">
                 <CheckCircle className="mr-1 inline h-4 w-4"/> {validCount} Baris Valid
             </div>
             <div className="rounded-md bg-red-50 px-3 py-1 text-red-700">
                 <AlertCircle className="mr-1 inline h-4 w-4"/> {invalidRows.length} Baris Error
             </div>
         </div>
      </div>

      <div className="max-h-[500px] overflow-auto rounded-md border">
        <Table>
            <TableHeader>
                <TableRow>
                     <TableHead className="w-[50px]">No</TableHead>
                     <TableHead>NISN</TableHead>
                     <TableHead>Nama Lengkap</TableHead>
                     <TableHead>JK</TableHead>
                     <TableHead>Kelas</TableHead>
                     <TableHead>Status</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {transformedData.slice(0, 50).map((row, i) => (
                    <TableRow key={row._id} className={row._errors.length > 0 ? "bg-red-50 hover:bg-red-100" : ""}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell>{String(row.nisn || '-')}</TableCell>
                        <TableCell>{String(row.name || '-')}</TableCell>
                        <TableCell>{String(row.gender || '-')}</TableCell>
                        <TableCell>{String(row.class || '-')}</TableCell>
                        <TableCell>
                            {row._errors.length > 0 ? (
                                <span className="text-xs font-medium text-red-600">
                                    {row._errors.join(", ")}
                                </span>
                            ) : (
                                <span className="text-xs text-green-600">OK</span>
                            )}
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">* Menampilkan 50 data pertama.</p>

      <div className="mt-8 flex justify-between">
          <Button variant="outline" onClick={onBack} disabled={isSaving}>
              <ArrowLeft className="mr-2 h-4 w-4"/> Kembali
          </Button>
          <Button onClick={handleSave} disabled={isSaving || (invalidRows.length > 0 && validCount === 0)}>
              {isSaving ? "Menyimpan..." : `Simpan ${validCount} Data Valid`} <Save className="ml-2 h-4 w-4"/>
          </Button>
      </div>
    </div>
  )
}
