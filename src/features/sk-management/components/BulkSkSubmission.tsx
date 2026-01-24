import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, FileSpreadsheet, CheckCircle, Upload } from "lucide-react"
import { useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import * as XLSX from "xlsx"
// TODO: Implement Convex File Storage
// import { api } from "@/lib/api"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useNavigate } from "react-router-dom"
import { useMutation } from "convex/react"
import { api as convexApi } from "../../../../convex/_generated/api"

export function BulkSkSubmission() {
  const navigate = useNavigate()
  
  // Convex mutations for bulk operations
  const bulkCreateTeacherMutation = useMutation(convexApi.teachers.bulkCreate)
  const createTeacherMutation = useMutation(convexApi.teachers.create)
  const createSkMutation = useMutation(convexApi.sk.create)
  
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [candidates, setCandidates] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isFullSync, setIsFullSync] = useState(false)
  const [autoApprove, setAutoApprove] = useState(false)
  const [debugLog, setDebugLog] = useState<string[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)
  
  // New State for Surat Permohonan
  const [suratPermohonanFile, setSuratPermohonanFile] = useState<File | null>(null)

  const log = (msg: string) => setDebugLog(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`])


  /* 
    Flexible Header Validation Logic 
    Maps internal ID -> Possible Excel Header strings (lowercase)
  */
  const HEADER_DEFINITIONS: Record<string, string[]> = {
    "Nama": ["nama", "nama lengkap", "nama guru"],
    "Tempat Lahir": ["tempat lahir", "tmp lahir"],
    "Tanggal Lahir": ["tanggal lahir", "tgl lahir", "tgl. lahir"],
    "Tempat/Tanggal Lahir": ["tempat/tanggal lahir", "ttl", "tempat tanggal lahir"],
    "Nomor Induk Ma'arif": ["nomor induk ma'arif", "niy", "nip", "nomor induk", "n.i.y", "nuptk", "pegid"],
    "Pendidikan Terakhir": ["pendidikan terakhir", "pendidikan", "ijazah terakhir"],
    "Unit Kerja": ["unit kerja", "satminkal", "tempat tugas", "lembaga", "nama madrasah", "sekolah"],
    "Tanggal Mulai Tugas": ["tanggal mulai tugas", "tmt", "mulai tugas", "tgl masuk", "tmt guru"],
    "Sertifikasi": ["sertifikasi", "sertifikat", "status sertifikasi", "sudah sertifikasi", "ket sertifikasi"],
    "Status": ["status", "status kepegawaian", "status guru"],
    "PDPKPNU": ["pdpkpnu", "pkpnu", "diklat", "status pdpkpnu", "ket pdpkpnu", "keterangan pdpkpnu", "sertifikat pdpkpnu", "lulus pdpkpnu"],
    "Kecamatan": ["kecamatan", "kec", "distrik", "wilayah"]
  }

  // We need at least these to form a valid submission
  const MIN_REQUIRED_MATCHES = 3; 

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    setDebugLog([])
    setUploadError(null)
    setCandidates([])

    if (file) {
      log(`File selected: ${file.name} (${file.size} bytes)`)
      const reader = new FileReader()
      reader.onload = (evt) => {
        try {
            const bstr = evt.target?.result
            const wb = XLSX.read(bstr, { type: "binary" })
            const wsname = wb.SheetNames[0]
            const ws = wb.Sheets[wsname]
            log(`Sheet loaded: ${wsname}`)
            
            // 1. Convert sheet to array of arrays to find header row
            const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as string[][]
            log(`Total rows found: ${rows.length}`)

            if (rows.length === 0) {
                setUploadError("File kosong or format tidak valid.")
                return
            }

            // 2. Simple Heuristic
            let headerRowIndex = -1
            let colMap: Record<string, string> = {} 
            const allKeys = Object.keys(HEADER_DEFINITIONS);

            log("Scanning for headers...")
            for (let i = 0; i < Math.min(rows.length, 15); i++) {
                // Fix: Use Array.from to handle sparse arrays from Excel ensuring no undefined cells
                const rowStr = Array.from(rows[i] || []).map(c => (c || "").toString().toLowerCase().trim())
                let matchedCount = 0
                const currentMap: Record<string, string> = {}

                allKeys.forEach(key => {
                    const possibleHeaders = HEADER_DEFINITIONS[key]
                    // Find index where header matches AND passes exclusion rules
                    const foundIndex = rowStr.findIndex((cell, idx) => {
                        const cellLower = cell.toLowerCase()
                        const isMatch = possibleHeaders.some(ph => cellLower.includes(ph))
                        
                        if (!isMatch) return false;

                        // EXCLUSION RULES to prevent collisions
                        if (key === "Status") {
                             // "Status Sertifikasi" should NOT match "Status" (Kepegawaian)
                             // UNLESS: It is the only match (which happens in Merged Headers)
                             // So we REMOVED the aggressive exclusion here to allow "Status" header to be found.
                             // We will handle the "Ya" values in the Extraction phase.
                        }
                        return true
                    })
                    
                    if (foundIndex >= 0) {
                        matchedCount++
                        currentMap[key] = String(foundIndex) 
                    }
                })
                
                if (matchedCount > 0) {
                    log(`Row ${i} matches: ${matchedCount} columns`)
                }

                if (matchedCount >= MIN_REQUIRED_MATCHES) {
                    headerRowIndex = i
                    colMap = currentMap
                    log(`Header found at row ${i}!`)
                if (headerRowIndex !== -1) {
                    // Log detected mapping
                    const detected = Object.keys(colMap).map(k => `${k} -> Index ${colMap[k]}`).join(", ")
                    log(`Detected Columns: ${detected}`)
                }
                break
                }
            }

            if (headerRowIndex === -1) {
                const msg = `Gagal menemukan header yang valid dalam 15 baris pertama.`
                log(msg)
                setUploadError(msg + " Pastikan ada kolom: Nama, NIP, Unit Kerja, dsb.")
                return
            }
            
            // CAPTURE ALL HEADERS for debugging
            const foundHeaders = (rows[headerRowIndex] || []).map(h => String(h).trim()).filter(h => h)
            log(`Raw Headers Found: ${foundHeaders.join(", ")}`)
            
            // 3. Extract Data
            const extractedData: any[] = []
            for(let r = headerRowIndex + 1; r < rows.length; r++) {
                const rawRow = rows[r]
                if(!rawRow || rawRow.length === 0) continue;
                
                const newObj: any = {}
                let hasData = false;

                allKeys.forEach(key => {
                    const colIdx = parseInt(colMap[key])
                    // Fix: Allow finding Status/PDPKPNU even if the primary cell (e.g. "Sertifikasi") is empty, 
                    // because we might need to check the "Honorer" column next to it.
                    if (!isNaN(colIdx)) {
                        let value = rawRow[colIdx]
                        
                        // For Checklist, value might be undefined (empty cell), but we still need to process checks
                        const isSpecialChecklist = (key === "Status" || key === "PDPKPNU");

                        if (value !== undefined || isSpecialChecklist) {
                        
                        // Default undefined to empty string for safety in logic
                        if (value === undefined) value = "";
                        
                        // Special Handling for TMT: Check if Excel Serial Date
                        if (key === "Tanggal Mulai Tugas") {
                            // If numeric and reasonably large (e.g. > 10000 fits dates > 1927)
                            if (typeof value === 'number' && value > 10000) {
                                value = excelDateToJSDate(value)
                            }
                        }

                        // Map Header Definition Keys to DTO Keys manually if needed
                        let dtoKey = key
                        if (key === "Kecamatan") dtoKey = "kecamatan"
                        if (key === "Nomor Induk Ma'arif") dtoKey = "nuptk"
                        if (key === "Nama") dtoKey = "nama"
                        if (key === "Unit Kerja") dtoKey = "satminkal" // Match backend field
                        if (key === "Pendidikan Terakhir") dtoKey = "pendidikanTerakhir"
                        if (key === "Tanggal Mulai Tugas") dtoKey = "tmt"
                        if (key === "Tempat/Tanggal Lahir") dtoKey = "ttl" // Handling logic needed? No, separate fields are better usually but backend doesn't have "ttl". 
                        // Wait, backend has birthPlace and birthDate. We handled split above. 
                        // If we have merged ttl, we might lose it if backend doesn't have ttl column. 
                        // But let's focus on Kecamatan first.

                        newObj[dtoKey.toLowerCase()] = value // Ensure property is lowercase (nama, status, etc)
                        
                        // Explicit Mapping for Special Cases
                         if (key === "Unit Kerja") { 
                             newObj["unitKerja"] = value; 
                             newObj["satminkal"] = value; 
                         }
                         else if (key === "Kecamatan") newObj["kecamatan"] = value
                         
                         // --- CHECKLIST FORMAT HANDLING ---
                         else if (key === "Sertifikasi") {
                             const valStr = String(value).toLowerCase().trim()
                             // Check if it's Ya/Sudah/Yes/V or text contains"sertifikasi"
                             const isCert = valStr === "ya" || valStr === "sudah" || valStr === "yes" || valStr === "v" || valStr.includes("sertifi")
                             newObj["sertifikasi"] = isCert ? "Ya" : "Tidak"
                         }
                         else if (key === "Status" || key === "PDPKPNU") {
                             const valStr = String(value).toLowerCase().trim()
                             const isChecklist = ["ya", "tidak", "true", "false", "v", "✓"].includes(valStr) || valStr === ""
                             
                             if (isChecklist) {
                                 const nextColVal = (rawRow[colIdx + 1] || "").toString().toLowerCase().trim()
                                 
                                 if (key === "Status") {
                                     // Col X = Sertifikasi, Col X+1 = Honorer
                                     if (valStr === "ya" || valStr === "v") newObj["status"] = "Sertifikasi"
                                     else if (nextColVal === "ya" || nextColVal === "v") newObj["status"] = "Honorer"
                                     else newObj["status"] = "-"
                                 }
                                 else if (key === "PDPKPNU") {
                                     // Col Y = Sudah, Col Y+1 = Belum
                                     if (valStr === "ya" || valStr === "v") newObj["pdpkpnu"] = "Sudah"
                                     else if (nextColVal === "ya" || nextColVal === "v") newObj["pdpkpnu"] = "Belum"
                                     else newObj["pdpkpnu"] = "Belum"
                                 }
                             } else {
                                 // Normal text format (e.g. "PNS", "Sudah")
                                 if (key === "Status") newObj["status"] = value
                                 if (key === "PDPKPNU") newObj["pdpkpnu"] = value
                             }
                         }
                         // ---------------------------------

                         else if (key === "Nama") newObj["nama"] = value
                         else if (key === "Nomor Induk Ma'arif") newObj["nuptk"] = value
                         else if (key === "Pendidikan Terakhir") newObj["pendidikanTerakhir"] = value
                         else if (key === "Tanggal Mulai Tugas") newObj["tmt"] = value
                         else newObj[dtoKey] = value
                        
                        hasData = true
                    }
                }
            })

                // Handle TTL Split/Merge
                if (!newObj["Tempat/Tanggal Lahir"]) {
                    if (newObj["Tempat Lahir"] && newObj["Tanggal Lahir"]) {
                         let dateStr = newObj["Tanggal Lahir"]
                         // Also fix numeric DOB if needed
                         if (typeof dateStr === 'number' && dateStr > 10000) {
                            dateStr = excelDateToJSDate(dateStr)
                         }
                         newObj["Tempat/Tanggal Lahir"] = `${newObj["Tempat Lahir"]}, ${dateStr}`
                    }
                }

                if (hasData && (newObj["nama"] || newObj["Nama"])) { // Support both just in case
                     extractedData.push(newObj)
                }
            }
            
            log(`Extracted ${extractedData.length} valid rows.`)
            setCandidates(extractedData)
            if(extractedData.length === 0) setUploadError("Header ditemukan tapi tidak ada data yang bisa diextract.")

        } catch (err: any) {
            log(`Error parsing: ${err.message}`)
            setUploadError("Error parsing file: " + err.message)
        }
      }
      reader.readAsBinaryString(file)
    }
  }

  // --- HELPER: Excel Serial to Date ---
  const excelDateToJSDate = (serial: number) => {
     // Excel base date is approx Dec 30 1899. 
     // Fast formula: (serial - 25569) * 86400 * 1000 for Unix ms, but let's use the Date dictionary method for stability
     // Adjust for leap year bug in Excel (1900 is strictly not leap, Excel says yes). 
     // For typical dates > 2000, simple offset is fine.
     const utc_days  = Math.floor(serial - 25569);
     const utc_value = utc_days * 86400;                                        
     const date_info = new Date(utc_value * 1000);
     
     // Improve robustness for local timezone offsets if needed, but usually UTC conversion is adequate for just Dates
     // Actually a simpler constructor approach:
     const date = new Date((serial - (25567 + 2)) * 86400 * 1000); 
     // 25569 is 1970-01-01. 
     
     // Let's use the most reliable "days add" method
     const d = new Date(1900, 0, serial - 1) // Excel counts from 1900-01-01 as 1. JS months are 0-indexed.
     
     // FIX: toISOString() uses UTC, which might be "Yesterday" if local time is +GMT (Indo is +7)
     // Use local date components instead to preserve "July 18"
     const year = d.getFullYear()
     const month = String(d.getMonth() + 1).padStart(2, '0')
     const day = String(d.getDate()).padStart(2, '0')
     
     return `${year}-${month}-${day}`
  }

  // --- LOGIC: Determine Jenis SK based on Rules ---
  const determineJenisSk = (pendidikan: string, tmt: string) => {
      // 1. Check Pendidikan
      const p = (pendidikan || "").toLowerCase()
      // Keywords for S1 or above
      const isSarjana = p.includes("s1") || p.includes("s.1") || p.includes("sarjana") || 
                        p.includes("s2") || p.includes("s.2") || p.includes("magister") ||
                        p.includes("s3") || p.includes("s.3") || p.includes("doktor") ||
                        p.includes("div") || p.includes("d4")

      if (!isSarjana) {
          return "SK Tenaga Kependidikan"
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
          return "SK Guru Tetap Yayasan" // Correct Enum Value
      } else {
          return "SK Guru Tidak Tetap" // Correct Enum Value
      }
  }

   
  const handleSubmit = async () => {
    if (candidates.length === 0) {
        alert("Tidak ada data calon SK yang valid. Upload file Excel terlebih dahulu.")
        return
    }

    let permohonanUrl = "";

    // 0. Upload Surat Permohonan if exists
    if (suratPermohonanFile) {
        log(`Upload skipped (Legacy backend removed): ${suratPermohonanFile.name}...`)
        // TODO: Implement Convex Storage
        permohonanUrl = "";  
    }

    setIsProcessing(true)

    try {
        // Map candidates to Teacher structure with precise fields
        const teachersToUpsert = candidates.map((c, i) => {
            // 🔥 CALCULATE PROPER STATUS (GTY/GTT/Tendik) based on Pendidikan + TMT
            const jenisSk = determineJenisSk(c["pendidikanTerakhir"], c["tmt"])
            let calculatedStatus = "Tendik"
            if (jenisSk.includes("Tetap")) calculatedStatus = "GTY"
            else if (jenisSk.includes("Tidak Tetap")) calculatedStatus = "GTT"
            
            // Map Sertifikasi (independent from status)
            const rawSertifikasi = c["sertifikasi"] || c["status"] || ""
            const isCertified = String(rawSertifikasi).toLowerCase().includes("ya") || String(rawSertifikasi).toLowerCase().includes("sudah") || String(rawSertifikasi).toLowerCase().includes("sertifi")

            // Map PDPKPNU
            const rawPdpkpnu = String(c["pdpkpnu"] || "").toLowerCase().trim()
            const pdpkpnu = (rawPdpkpnu.includes("sudah") || rawPdpkpnu.includes("lulus") || rawPdpkpnu.includes("yes") || rawPdpkpnu.includes("true") || rawPdpkpnu === "v") ? "Sudah" : "Belum"

            return {
                nuptk: c["nuptk"] ? String(c["nuptk"]) : `TMP-${Date.now()}-${i}`, 
                nama: c["nama"] ? String(c["nama"]) : "Tanpa Nama",
                status: calculatedStatus, 
                satminkal: c["unitKerja"] ? String(c["unitKerja"]) : "Lainnya",
                mapel: "-", 
                isCertified: isCertified,
                pdpkpnu: pdpkpnu,
                kecamatan: c["kecamatan"] || null, // FIX: Ensure this is passed to backend 
                
                // Metadata
                birthPlace: String((c["ttl"] || "").split(",")[0]).trim(),
                birthDate: String((c["ttl"] || "").split(",")[1] || "").trim(),
                pendidikanTerakhir: c["pendidikanTerakhir"] ? String(c["pendidikanTerakhir"]) : "-",
                tmt: c["tmt"] ? String(c["tmt"]) : "-",
                
                // New: Permohonan Link
                suratPermohonanUrl: permohonanUrl || null
            }
        })

        // 1. Sync Teachers to Master Data using Convex
        console.log("Upserting teachers via Convex:", teachersToUpsert.length, "rows")
        
        // Map to Convex schema format (using undefined for optional fields)
        const convexTeachers = teachersToUpsert.map(t => ({
            nuptk: t.nuptk,
            nama: t.nama,
            status: t.status || undefined,
            unitKerja: t.satminkal || undefined,
            mapel: t.mapel || undefined,
            kecamatan: t.kecamatan || undefined,
            phoneNumber: undefined,
            pdpkpnu: t.pdpkpnu || undefined,
            tempatLahir: t.birthPlace || undefined,
            tanggalLahir: t.birthDate || undefined,
            pendidikanTerakhir: t.pendidikanTerakhir || undefined,
            tmt: t.tmt || undefined, // 🔥 CRITICAL: Need TMT for GTY/GTT calculation
            isCertified: t.isCertified || undefined,
        }))
        
        log(`Mengirim ${convexTeachers.length} data guru ke Convex...`)
        let teacherIds: any[] = [];
        try {
            const bulkResult = await bulkCreateTeacherMutation({ teachers: convexTeachers })
            console.log("🔍 bulkCreate result:", bulkResult)
            console.log("🔍 bulkResult.ids:", bulkResult?.ids)
            console.log("🔍 bulkResult type:", typeof bulkResult)
            
            teacherIds = bulkResult?.ids || []
            log(`✅ ${teacherIds.length} teachers created. IDs: ${teacherIds.slice(0, 3).join(', ')}...`)
        } catch (err: any) {
            console.error("Convex bulkCreate failed", err)
            throw new Error(`Gagal menyimpan data guru: ${err.message}`)
        }

        // 2. Create SK Submissions using Convex
        // Get userId from localStorage
        const userStr = localStorage.getItem("user")
        const userId = userStr ? JSON.parse(userStr).id : "temp_user_id_placeholder"
        
        let successCount = 0;
        let errorCount = 0;
        const errors: string[] = [];
        
        for (let i = 0; i < candidates.length; i++) {
            const c = candidates[i]
            const jenisSk = determineJenisSk(c["pendidikanTerakhir"], c["tmt"])
            
            try {
                // Get teacher ID from bulkCreate result (same order as input)
                const teacherId = teacherIds[i]
                if (!teacherId) {
                    throw new Error(`Teacher ID not found at index ${i} for ${c["nama"]}`)
                }
                
                log(`Creating SK for ${c["nama"]} with Teacher ID: ${teacherId}...`)
                const skId = await createSkMutation({
                    nomorSk: `${String(successCount + 1).padStart(3, '0')}/SK/BULK/${new Date().getFullYear()}`,
                    jenisSk: jenisSk,
                    teacherId: teacherId,
                    nama: c["nama"] || "Tanpa Nama",
                    jabatan: "Guru",
                    unitKerja: c["unitKerja"] || "-",
                    tanggalPenetapan: new Date().toISOString().split('T')[0],
                    status: autoApprove ? "approved" : "draft",
                    fileUrl: permohonanUrl || undefined,
                    createdBy: userId,
                })
                log(`✅ SK created: ${skId}`)
                
                successCount++;
            } catch (e: any) {
                errorCount++;
                const errorMsg = `${c["nama"]}: ${e.message}`
                console.error("Failed to create SK for", c["nama"], e)
                log(`❌ Error untuk ${errorMsg}`)
                errors.push(errorMsg)
            }
        }
        
        const resultMessage = `Berhasil memproses!\n\nData Guru: ${convexTeachers.length}\nSK Berhasil: ${successCount}\nSK Gagal: ${errorCount}${errors.length > 0 ? '\n\nErrors:\n' + errors.slice(0, 5).join('\n') : ''}`
        alert(resultMessage)
        navigate("/dashboard/sk")

    } catch (e: any) {
        console.error("Bulk Submission Error:", e)
        alert("Terjadi kesalahan saat memproses data: " + (e.message || "Unknown error"))
    } finally {
        setIsProcessing(false)
    }
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
            <div className={`flex items-center gap-4 rounded-md border p-4 ${uploadError ? 'border-red-500 bg-red-50' : ''}`}>
                <FileSpreadsheet className={`h-8 w-8 ${uploadError ? 'text-red-500' : 'text-green-500'}`} />
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
            
            <div className="space-y-2 pt-2 border-t">
                 <Label>2. Upload Surat Permohonan (PDF)</Label>
                 <div className="flex items-center gap-4 rounded-md border p-4 bg-slate-50">
                    <Upload className="h-6 w-6 text-blue-600" />
                    <div className="flex-1">
                        <Input 
                            type="file" 
                            accept=".pdf" 
                            onChange={(e) => setSuratPermohonanFile(e.target.files?.[0] || null)} 
                        />
                        <p className="text-xs text-muted-foreground mt-1">Opsional: Lampirkan surat permohonan resmi dr lembaga.</p>
                    </div>
                </div>
            </div>

            {uploadError && (
                <div className="p-3 bg-red-100 text-red-700 text-sm rounded-md font-medium">
                    {uploadError}
                </div>
            )}
            
            {(debugLog.length > 0) && (
                 <div className="text-[10px] space-y-1 p-2 bg-slate-100 rounded border max-h-32 overflow-y-auto font-mono text-slate-600">
                    <div className="font-bold text-slate-800">Debug Log:</div>
                    {debugLog.map((l, i) => <div key={i}>{l}</div>)}
                 </div>
            )}
            
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
                                        <TableCell>{row["nama"]}</TableCell>
                                        <TableCell>{row["pendidikanTerakhir"]}</TableCell>
                                        <TableCell>{row["tmt"]}</TableCell>
                                        <TableCell className="font-semibold text-blue-600">
                                            {determineJenisSk(row["pendidikanTerakhir"], row["tmt"])}
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

        {/* PREVIEW SECTION */}
      {candidates.length > 0 && (
          <div className="mt-6 border rounded-md p-4 bg-slate-50">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  Preview Data ({candidates.length} baris)
              </h3>
              <div className="max-h-[250px] overflow-auto border bg-white rounded-md">
                   <Table>
                        <TableHeader className="bg-slate-100">
                             <TableRow>
                                 <TableHead>Nama</TableHead>
                                 <TableHead>NIP/NUPTK</TableHead>
                                 <TableHead>Pendidikan</TableHead>
                                 <TableHead>TMT (Tanggal Mulai)</TableHead>
                                 <TableHead>Status (Map/Raw)</TableHead>
                                 <TableHead>PDPKPNU (Map/Raw)</TableHead>
                             </TableRow>
                        </TableHeader>
                        <TableBody>
                             {candidates.slice(0, 10).map((c, i) => (
                                 <TableRow key={i}>
                                     <TableCell>{c["nama"]}</TableCell>
                                     <TableCell>{c["nuptk"] || "-"}</TableCell>
                                     <TableCell className={!c["pendidikanTerakhir"] ? "text-red-500 font-bold" : ""}>
                                         {c["pendidikanTerakhir"] || "MISSING"}
                                     </TableCell>
                                     <TableCell className={!c["tmt"] ? "text-red-500 font-bold" : ""}>
                                         {c["tmt"] || "MISSING"}
                                     </TableCell>
                                     <TableCell>{c["status"]}</TableCell>
                                 </TableRow>
                             ))}
                        </TableBody>
                   </Table>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                  * Menampilkan 10 baris pertama. Jika kolom Pendidikan atau TMT merah (MISSING), cek header file Excel anda. Header harus mengandung kata kunci seperti "Pendidikan" dan "TMT" atau "Tanggal Mulai Tugas".
              </p>
          </div>
      )}

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

             <div className="flex items-center space-x-2 border p-3 rounded-md bg-green-50 border-green-200">
                <Checkbox 
                    id="autoApprove" 
                    checked={autoApprove} 
                    onCheckedChange={(c) => setAutoApprove(!!c)} 
                />
                <div className="grid gap-1.5 leading-none">
                    <Label htmlFor="autoApprove" className="text-sm font-medium leading-none cursor-pointer">
                        Langsung Approve (Skip Review)
                    </Label>
                    <p className="text-xs text-muted-foreground">
                        SK yang diupload akan langsung berstatus "Approved" tanpa review di Dashboard SK. Gunakan hanya jika data sudah diverifikasi.
                    </p>
                </div>
             </div>

             <Button 
                onClick={handleSubmit} 
                disabled={isProcessing}
                className="w-full sm:w-auto"
            >
                {isProcessing ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Mengirim...</>
                ) : (
                    <><Upload className="mr-2 h-4 w-4" /> Kirim Pengajuan {candidates.length > 0 ? `(${candidates.length})` : ""}</>
                )}
            </Button>
        </div>

      </CardContent>
    </Card>
  )
}
