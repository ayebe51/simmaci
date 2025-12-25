import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, FileSpreadsheet, CheckCircle, Upload } from "lucide-react"
import { useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import * as XLSX from "xlsx"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useNavigate } from "react-router-dom"

export function BulkSkSubmission() {
  const navigate = useNavigate()
  const [candidates, setCandidates] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isFullSync, setIsFullSync] = useState(false)

  /* 
    Flexible Header Validation Logic 
    Maps internal ID -> Possible Excel Header strings (lowercase)
  */
  const HEADER_DEFINITIONS: Record<string, string[]> = {
    "Nama": ["nama", "nama lengkap", "nama guru"],
    "Tempat/Tanggal Lahir": ["tempat/tanggal lahir", "ttl", "tempat tanggal lahir", "tgl lahir"],
    "Nomor Induk Ma'arif": ["nomor induk ma'arif", "niy", "nip", "nomor induk", "n.i.y"],
    "Pendidikan Terakhir": ["pendidikan terakhir", "pendidikan", "ijazah terakhir"],
    "Unit Kerja": ["unit kerja", "satminkal", "tempat tugas", "lembaga"],
    "Tanggal Mulai Tugas": ["tanggal mulai tugas", "tmt", "mulai tugas", "tgl masuk"],
    "Status": ["status", "status kepegawaian", "status guru"],
    "PDPKPNU": ["pdpkpnu", "pkpnu", "diklat"]
  }

  const REQUIRED_FIELD_KEYS = Object.keys(HEADER_DEFINITIONS)

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (evt) => {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: "binary" })
        const wsname = wb.SheetNames[0]
        const ws = wb.Sheets[wsname]
        
        // 1. Convert sheet to array of arrays to find header row
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as string[][]
        if (rows.length === 0) {
            alert("File kosong or format tidak valid.")
            return
        }

        // 2. Simple Heuristic: Look for a row that contains enough 'required' keywords
        // We look at the first 5 rows to handle Title rows etc.
        let headerRowIndex = -1
        let colMap: Record<string, string> = {} // Internal Key -> Actual Excel Column Name

        for (let i = 0; i < Math.min(rows.length, 5); i++) {
            const rowStr = rows[i].map(c => (c || "").toString().toLowerCase().trim())
            let matchedCount = 0
            const currentMap: Record<string, string> = {}

            // Check how many required fields we can find in this row
            REQUIRED_FIELD_KEYS.forEach(key => {
                const possibleHeaders = HEADER_DEFINITIONS[key]
                // Find if any possible header exists in this row
                const foundIndex = rowStr.findIndex(cell => possibleHeaders.includes(cell))
                if (foundIndex >= 0) {
                    matchedCount++
                    // Store the ACTUAL original column name for data extraction
                    currentMap[key] = rows[i][foundIndex]
                }
            })

            // If we found at least 4 required columns, assume this is the header (lenient)
            if (matchedCount >= 4) {
                headerRowIndex = i
                colMap = currentMap
                break
            }
        }

        if (headerRowIndex === -1) {
             const friendlyList = REQUIRED_FIELD_KEYS.join(", ")
             alert(`Gagal menemukan baris header yang valid! Pastikan file memiliki kolom:\n${friendlyList}\n\n(Baris pertama atau kedua).`)
             setCandidates([])
             return
        }

        // 3. Extract Data using the found header row and mapping
        // We use sheet_to_json with range option to skip title rows
        const rawData = XLSX.utils.sheet_to_json(ws, { range: headerRowIndex }) as any[]
        
        // Normalize the objects using our colMap
        const normalizedData = rawData.map(row => {
            const newRow: any = {}
            REQUIRED_FIELD_KEYS.forEach(key => {
                const actualColName = colMap[key]
                if (actualColName) {
                    newRow[key] = row[actualColName]
                }
            })
            return newRow
        })
        
        setCandidates(normalizedData)
      }
      reader.readAsBinaryString(file)
    }
  }

  // --- LOGIC: Determine Jenis SK based on Rules ---
  const determineJenisSk = (pendidikan: string, tmt: string) => {
      // 1. Check Pendidikan
      const p = (pendidikan || "").toLowerCase()
      // Keywords for S1 or above
      const isSarjana = p.includes("s1") || p.includes("s-1") || p.includes("sarjana") || 
                        p.includes("s2") || p.includes("s-2") || p.includes("magister") ||
                        p.includes("s3") || p.includes("s-3") || p.includes("doktor") ||
                        p.includes("div") || p.includes("d4")

      if (!isSarjana) {
          // If < S1 -> Tenaga Kependidikan
          // (Assuming D1, D2, D3, SMA, SMK, MA falls here)
          return "Tenaga Kependidikan"
      }

      // 2. Check Tenure (Masa Kerja) via TMT
      // TMT format might be DD/MM/YYYY or YYYY-MM-DD or Excel Serial Date
      let tmtDate = new Date()
      // Try to parse basic formats
      if (tmt && typeof tmt === 'string' && tmt.includes("/")) {
          const parts = tmt.split("/")
          // Assuming DD/MM/YYYY
          if (parts.length === 3) tmtDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`)
      } else if (tmt) {
          tmtDate = new Date(tmt)
      }

      const now = new Date()
      // Calculate difference in specific years
      let yearsDiff = now.getFullYear() - tmtDate.getFullYear()
      const m = now.getMonth() - tmtDate.getMonth()
      if (m < 0 || (m === 0 && now.getDate() < tmtDate.getDate())) {
          yearsDiff--
      }

      if (yearsDiff >= 2) {
          return "GTY" // Guru Tetap Yayasan
      } else {
          return "GTT" // Guru Tidak Tetap
      }
  }

  const handleSubmit = async () => {
    if (candidates.length === 0) return
    setIsProcessing(true)

    // Simulate API submission
    setTimeout(() => {
        console.log("Submitting bulk data:", candidates)
        
        // Save to Master Data
        const existing = localStorage.getItem("app_teachers")
        let teachers = existing ? JSON.parse(existing) : []

        // Map candidates to Teacher structure with precise fields
        const newTeachers = candidates.map((c, i) => {
            // Map Status to internal value (PNS/Sertifikasi/Honorer)
            let status = "Lainnya"
            const rawStatus = (c["Status"] || "").toString().toLowerCase()
            if (rawStatus.includes("pns")) status = "PNS"
            else if (rawStatus.includes("sertifi")) status = "Sertifikasi"
            else if (rawStatus.includes("honorer") || rawStatus.includes("gtt") || rawStatus.includes("gty") || rawStatus.includes("sukwan")) status = "Honorer"

            // Map PDPKPNU
            const rawPdpkpnu = (c["PDPKPNU"] || "").toString().toLowerCase()
            const pdpkpnu = rawPdpkpnu === "sudah" || rawPdpkpnu === "yes" || rawPdpkpnu === "true" || rawPdpkpnu === "lulus"

            // Calculate Jenis SK (The New Logic)
            const jenisSk = determineJenisSk(c["Pendidikan Terakhir"], c["Tanggal Mulai Tugas"])

            return {
                id: `bulk-${Date.now()}-${i}`,
                nip: c["Nomor Induk Ma'arif"] || "-", 
                nama: c["Nama"] || "Tanpa Nama",
                status: status, // Kepegawaian (PNS/Sertifikasi/Honorer)
                jenisSk: jenisSk, // Klasifikasi (GTY/GTT/Tenaga Kependidikan)
                mapel: "-", 
                unitKerja: c["Unit Kerja"] || "-",
                sertifikasi: status === "Sertifikasi",
                pdpkpnu: pdpkpnu, 
                // Metadata
                tempatTanggalLahir: c["Tempat/Tanggal Lahir"],
                pendidikanTerakhir: c["Pendidikan Terakhir"],
                tmt: c["Tanggal Mulai Tugas"],
                isActive: true
            }
        })

        // Verify we have at least names
        const validTeachers = newTeachers.filter(t => t.nama !== "Tanpa Nama")
        let summaryMsg = `Berhasil memproses ${validTeachers.length} data.`

        if (isFullSync) {
            // Full Sync Logic
            const targetUnits = new Set(validTeachers.map(t => t.unitKerja))
            
            // Set isActive=false for ALL existing teachers in targetUnits
            teachers = teachers.map((t: any) => 
                targetUnits.has(t.unitKerja) ? { ...t, isActive: false } : t
            )
            // Push new active teachers
            teachers = [...teachers, ...validTeachers]
            
            summaryMsg += ` (Mode Sinkronisasi: Data lama di unit kerja terkait telah dinonaktifkan).`
        } else {
            // Normal Append
            teachers = [...teachers, ...validTeachers]
        }
        
        localStorage.setItem("app_teachers", JSON.stringify(teachers))
        
        alert(summaryMsg)
        setIsProcessing(false)
        navigate("/dashboard/master/teachers")
    }, 1000)
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Pengajuan Kolektif</CardTitle>
        <CardDescription>
          Upload file Excel berisi daftar nama guru/siswa untuk diajukan SK-nya secara bersamaan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        <div className="space-y-2">
            <Label>1. Upload File Excel (.xlsx)</Label>
            <div className="flex items-center gap-4 rounded-md border p-4">
                <FileSpreadsheet className="h-8 w-8 text-green-500" />
                <div className="flex-1">
                    <Input 
                        type="file" 
                        accept=".xlsx, .xls" 
                        onChange={handleExcelUpload} 
                    />
                     <p className="text-xs text-muted-foreground mt-1 text-red-600 font-medium">
                        Wajib Header: Nama, Tempat/Tanggal Lahir, Nomor Induk Ma'arif, Pendidikan terakhir, Unit Kerja, Tanggal Mulai Tugas, Status, PDPKPNU
                    </p>
                </div>
            </div>
            
            {candidates.length > 0 && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-2 rounded">
                        <CheckCircle className="h-4 w-4" />
                        <span>Terdeteksi {candidates.length} data.</span>
                    </div>

                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]">No</TableHead>
                                    <TableHead>Nama</TableHead>
                                    <TableHead>Pendidikan</TableHead>
                                    <TableHead>TMT</TableHead>
                                    <TableHead>Jenis SK (Auto)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {candidates.slice(0, 5).map((row, i) => (
                                    <TableRow key={i}>
                                        <TableCell>{i + 1}</TableCell>
                                        <TableCell>{row["Nama"]}</TableCell>
                                        <TableCell>{row["Pendidikan Terakhir"]}</TableCell>
                                        <TableCell>{row["Tanggal Mulai Tugas"]}</TableCell>
                                        <TableCell className="font-semibold text-blue-600">
                                            {determineJenisSk(row["Pendidikan Terakhir"], row["Tanggal Mulai Tugas"])}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        {candidates.length > 5 && (
                            <p className="p-2 text-center text-xs text-muted-foreground bg-slate-50">
                                ... dan {candidates.length - 5} data lainnya.
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>

        <div className="flex flex-col gap-3 pt-4">
             <div className="flex items-center space-x-2 border p-3 rounded-md bg-amber-50 border-amber-200">
                <Checkbox 
                    id="fullSync" 
                    checked={isFullSync} 
                    onCheckedChange={(c) => setIsFullSync(!!c)} 
                />
                <div className="grid gap-1.5 leading-none">
                    <Label htmlFor="fullSync" className="text-sm font-medium leading-none cursor-pointer">
                        Mode Sinkronisasi Penuh
                    </Label>
                    <p className="text-xs text-muted-foreground">
                        Jika dicentang, guru di Unit Kerja yang sama tetapi TIDAK ADA di file Excel ini akan otomatis dinonaktifkan (dianggap keluar/resign).
                    </p>
                </div>
             </div>

             <Button 
                onClick={handleSubmit} 
                disabled={candidates.length === 0 || isProcessing}
                className="w-full sm:w-auto"
            >
                {isProcessing ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Mengirim...</>
                ) : (
                    <><Upload className="mr-2 h-4 w-4" /> Kirim Pengajuan ({candidates.length})</>
                )}
            </Button>
        </div>

      </CardContent>
    </Card>
  )
}
