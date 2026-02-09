import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, FileSpreadsheet, CheckCircle, Upload } from "lucide-react"
import { useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import * as XLSX from "xlsx"
import { saveAs } from "file-saver"
import { api } from "@/lib/api"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"

export function BulkSkSubmission() {
  const navigate = useNavigate()
  
  // Convex mutations for bulk operations
  const bulkCreateTeacherMutation = useMutation(convexApi.teachers.bulkCreate)
  const generateUploadUrl = useMutation(convexApi.files.generateUploadUrl)
  
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [candidates, setCandidates] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isFullSync, setIsFullSync] = useState(false)
  const [autoApprove, setAutoApprove] = useState(false)
  const [debugLog, setDebugLog] = useState<string[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)
  
  // New State for Surat Permohonan
  const [suratPermohonanFile, setSuratPermohonanFile] = useState<File | null>(null)

  // MODAL STATES
  const [showValidationModal, setShowValidationModal] = useState(false)
  const [validationData, setValidationData] = useState<{row: number, mapping: string, preview: any} | null>(null)
  
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [successData, setSuccessData] = useState<{count: number}>({count: 0})

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

  // EXCLUSION RULES to prevent collisions
  const HEADER_EXCLUSIONS: Record<string, string[]> = {
      "Status": ["sertifikasi", "pernikahan", "kawin", "pdpkpnu", "sosial"], // "Status Sertifikasi" != "Status" (Kepegawaian)
      "Sertifikasi": [],
      "PDPKPNU": [],
  }

  const handleDownloadTemplate = () => {
    // Defines standard headers for the template
    const headers = [
      "Nama", 
      "Tempat/Tanggal Lahir", 
      "Nomor Induk Ma'arif", 
      "Pendidikan Terakhir", 
      "Unit Kerja", 
      "Tanggal Mulai Tugas", 
      "Sertifikasi", 
      "Status", 
      "PDPKPNU", 
      "Kecamatan"
    ];

    // Create a dummy row to help user understand the format
    const sampleRow = [
      "Ahmad Contoh, S.Pd",
      "Cilacap, 12-05-1990",
      "123456789",
      "S1 Pendidikan Agama Islam",
      "MI Ma'arif 01 Cilacap",
      "01-07-2015",
      "Sudah",
      "GTY",
      "Lulus Angkatan 1",
      "Cilacap Selatan"
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
    
    // Auto-width columns roughly
    ws["!cols"] = headers.map(() => ({ wch: 25 }));
    ws["!cols"][0] = { wch: 30 }; // Nama wider
    ws["!cols"][4] = { wch: 30 }; // Unit Kerja wider

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Guru");
    
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    saveAs(blob, "Template_Data_Guru_Maarif.xlsx");
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
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
                    const exclusions = HEADER_EXCLUSIONS[key] || []

                    // Find index where header matches AND passes exclusion rules
                    const foundIndex = rowStr.findIndex((cell, _idx) => {
                        const cellLower = cell.toLowerCase()
                        const isMatch = possibleHeaders.some(ph => cellLower.includes(ph))
                        const isExcluded = exclusions.some(ex => cellLower.includes(ex))
                        
                        if (!isMatch) return false;
                        if (isExcluded) return false;

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
                    const detected = Object.keys(colMap).map(k => `${k} -> Index ${colMap[k]} (${rows[i][parseInt(colMap[k])]})`).join("\n")
                    log(`Detected Columns:\n${detected}`)
                    
                    // Show Estetik Modal
                    setValidationData({
                        row: i + 1,
                        mapping: detected,
                        preview: rows[i+1] // Preview First Data Row if exists
                    })
                    setShowValidationModal(true)
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
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                let hasData = false

                // Extract Raw Values first using the Map
                const rawVals: Record<string, any> = {}
                allKeys.forEach(k => {
                    const idx = parseInt(colMap[k])
                    if (!isNaN(idx)) rawVals[k] = rawRow[idx]
                })

                // Parse Fields
                newObj["nama"] = rawVals["Nama"]
                newObj["nuptk"] = rawVals["Nomor Induk Ma'arif"]
                newObj["unitKerja"] = rawVals["Unit Kerja"]
                newObj["satminkal"] = rawVals["Unit Kerja"] // Duplicate for safety
                newObj["kecamatan"] = rawVals["Kecamatan"]
                newObj["pendidikanTerakhir"] = rawVals["Pendidikan Terakhir"]
                
                // Parse Dates using Robust Parser
                const tmtDate = parseIndonesianDate(rawVals["Tanggal Mulai Tugas"])
                newObj["tmt"] = tmtDate ? tmtDate.toISOString().split('T')[0] : ""
                
                // Parse TTL (Tempat/Tanggal Lahir logic)
                // If we have separate columns
                const dobDate = parseIndonesianDate(rawVals["Tanggal Lahir"])
                const dobStr = dobDate ? dobDate.toISOString().split('T')[0] : (rawVals["Tanggal Lahir"] || "")
                const pob = rawVals["Tempat Lahir"] || ""
                
                if (pob || dobStr) {
                    newObj["ttl"] = `${pob}, ${dobStr}`
                } else {
                     newObj["ttl"] = rawVals["Tempat/Tanggal Lahir"] || ""
                }
                
                // Parse Certification
                const sertifVal = String(rawVals["Sertifikasi"] || "").toLowerCase()
                newObj["sertifikasi"] = (sertifVal.includes("ya") || sertifVal.includes("sudah") || sertifVal === 'v') ? "Ya" : "Tidak"
                
                // Parse PDPKPNU
                const pdpVal = String(rawVals["PDPKPNU"] || "").toLowerCase()
                newObj["pdpkpnu"] = (pdpVal.includes("sudah") || pdpVal.includes("lulus") || pdpVal === 'v') ? "Sudah" : "Belum"
                
                // Parse Status
                newObj["status"] = rawVals["Status"] || ""
                
                // Calculate Jenis SK (using the robust TMT date we just parsed)
                // Ensure tmtDate is passed as Date or string? determineJenisSk expects string but parses it again. 
                // Let's pass the already formatted string
                if (newObj["nama"]) {
                    extractedData.push(newObj)
                    hasData = true
                }
                
                // DEBUG: Row 0 Analysis
                if (r === headerRowIndex + 1) {
                    const debugColMap = Object.entries(colMap).map(([k, v]) => `${k}:Index ${v}`).join(', ')
                    alert(`🔍 Analysis Baris Data Pertama:\n\nNama: ${newObj["nama"]}\nUnit: ${newObj["unitKerja"]}\nTMT Raw: ${rawVals["Tanggal Mulai Tugas"]}\nTMT Parsed: ${newObj["tmt"]}\nTTL: ${newObj["ttl"]}\n\nDetected Cols: ${debugColMap}`)
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

  // --- HELPER: Parse Date Robustly (Unified with TeacherListPage) ---
  const parseIndonesianDate = (dateStr: any): Date | null => {
      if (!dateStr) return null
      
      // 1. Direct Number (Excel Serial)
      if (typeof dateStr === 'number') {
          const excelEpoch = new Date(1899, 11, 30);
          return new Date(excelEpoch.getTime() + dateStr * 24 * 60 * 60 * 1000)
      }

      const str = String(dateStr).trim()
      
      // 2. Stringified Number (Excel Serial) - allow decimals
      if (/^[\d.]+$/.test(str) && !isNaN(parseFloat(str))) { 
          const val = parseFloat(str)
          // Heuristic: Excel dates are usually > 10000 (after 1927). 
          if (val > 1000) {
              const excelEpoch = new Date(1899, 11, 30);
              return new Date(excelEpoch.getTime() + val * 24 * 60 * 60 * 1000)
          }
      }

      // 3. Standard Date
      const d = new Date(str)
      if (!isNaN(d.getTime()) && !/^\d+$/.test(str)) return d
      
      // 4. DD/MM/YYYY
      const parts = str.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/)
      if (parts) return new Date(`${parts[3]}-${parts[2]}-${parts[1]}`)
      
      // 5. Indonesian Months
      const months: {[key: string]: string} = {
          'januari': '01', 'februari': '02', 'maret': '03', 'april': '04', 'mei': '05', 'juni': '06',
          'juli': '07', 'agustus': '08', 'september': '09', 'oktober': '10', 'november': '11', 'desember': '12',
          'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06',
          'jul': '07', 'aug': '08', 'agt': '08', 'sep': '09', 'oct': '10', 'okt': '10', 'nov': '11', 'dec': '12', 'des': '12'
      }

      const txtParts = str.split(/[\s\-/]+/)
      if (txtParts.length >= 3) {
          const day = txtParts[0].replace(/[^0-9]/g, '')
          const monthTxt = txtParts[1].toLowerCase()
          const year = txtParts[2].replace(/[^0-9]/g, '')
          
          if (months[monthTxt] && year && day) {
              return new Date(`${year}-${months[monthTxt]}-${day}`)
          }
      }

      return null
  }

  // --- LOGIC: Determine Jenis SK based on Rules ---
  // MODIFIED: Accepts 'explicitStatus' from Excel to override calculation
  const determineJenisSk = (pendidikan: string, tmt: string, explicitStatus?: string) => {
      // 0. Explicit Override
      if (explicitStatus) {
          const s = explicitStatus.toLowerCase()
          if (s.includes("gty") || s.includes("tetap yayasan") || s.includes("sertifikasi")) return "SK Guru Tetap Yayasan"
          if (s.includes("gtt") || s.includes("tidak tetap") || s.includes("honorer")) return "SK Guru Tidak Tetap"
          if (s.includes("kamad") || s.includes("kepala")) return "SK Kepala Madrasah"
          if (s.includes("tendik") || s.includes("kependidikan")) return "SK Tenaga Kependidikan"
      }

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
      // FIXED: Use robust date parser
      const tmtDate = parseIndonesianDate(tmt)
      
      // Fallback if Date is invalid -> GTT
      if (!tmtDate || isNaN(tmtDate.getTime())) {
          console.warn("Invalid TMT Date:", tmt);
          return "SK Guru Tidak Tetap"; 
      }

      const now = new Date()
      // Calculate difference in specific years
      let yearsDiff = now.getFullYear() - tmtDate.getFullYear()
      const m = now.getMonth() - tmtDate.getMonth()
      if (m < 0 || (m === 0 && now.getDate() < tmtDate.getDate())) {
          yearsDiff--
      }

      // Default calculation if explicit status invalid or missing
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
        log(`Mengupload surat permohonan: ${suratPermohonanFile.name}...`)
        try {
            // STEP 1: Get Upload URL
            const postUrl = await generateUploadUrl();
            
            // STEP 2: POST the file
            const result = await fetch(postUrl, {
                method: "POST",
                headers: { "Content-Type": suratPermohonanFile.type },
                body: suratPermohonanFile,
            });

            if (!result.ok) throw new Error(`Upload failed: ${result.statusText}`);
            
            const { storageId } = await result.json();
            permohonanUrl = storageId; // Store Storage ID (Backend will resolve it)
            
            log(`Upload berhasil. Storage ID: ${storageId}`);
        } catch (e: any) {
            log(`Gagal upload file: ${e.message}`);
            alert("Gagal mengupload surat permohonan! " + e.message);
            setIsProcessing(false);
            return;
        }
    }

    setIsProcessing(true)

    try {
        // Map candidates to Teacher structure with precise fields
        const teachersToUpsert = candidates.map((c, i) => {
            // 🔥 CALCULATE PROPER STATUS (GTY/GTT/Tendik)
            // PASS EXPLICIT STATUS FROM EXCEL TO OVERRIDE CALCULATION
            const jenisSk = determineJenisSk(c["pendidikanTerakhir"], c["tmt"], c["status"])
            
            let calculatedStatus = "Tendik"
            if (jenisSk.includes("Tetap Yayasan")) calculatedStatus = "GTY"
            else if (jenisSk.includes("Tidak Tetap")) calculatedStatus = "GTT"
            else if (jenisSk.includes("Kepala")) calculatedStatus = "Kamad"
            
            // Map Sertifikasi (already processed in loop)
            const isCertified = c["sertifikasi"] === "Ya"

            // Map PDPKPNU (already processed in loop)
            const pdpkpnu = c["pdpkpnu"] || "Belum"

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

        // --- DEBUG PAYLOAD INSPECTOR ---
        if (convexTeachers.length > 0) {
            const sample = convexTeachers[0]
            // Debug payload removed
            // console.log("Payload Check:", payload)
            console.log("PAYLOAD FULL:", convexTeachers)
        }
        // -------------------------------
        
        // -------------------------------
        
        log(`Mengirim ${convexTeachers.length} data guru ke Convex...`)
        let teacherIds: any[] = [];
        try {
            const bulkResult = await bulkCreateTeacherMutation({ 
                teachers: convexTeachers,
                isFullSync: isFullSync,
                suratPermohonanUrl: permohonanUrl || undefined
            })
            console.log("🔍 bulkCreate result:", bulkResult)
            
            // ERROR HANDLING: Check for partial failures
            if (bulkResult.errors && bulkResult.errors.length > 0) {
                 const sampleError = bulkResult.errors[0]
                 const errorMsg = `Gagal menyimpan ${bulkResult.errors.length} data Guru. Contoh error: ${typeof sampleError === 'string' ? sampleError : JSON.stringify(sampleError)}`
                 console.error(errorMsg)
                 alert(errorMsg)
                 // If all failed, stop here
                 if (!bulkResult.ids || bulkResult.ids.length === 0) {
                     throw new Error("Semua data guru gagal disimpan. Cek format Excel anda.")
                 }
            }
            
            teacherIds = bulkResult?.ids || []
            log(`✅ ${teacherIds.filter(id => id).length} teachers created/updated.`)
            
        } catch (err: any) {
            console.error("Convex bulkCreate failed", err)
            throw new Error(`Gagal menyimpan data guru (System Error): ${err.message}`)
        }

        // 2. SK Submission Creation REMOVED to prevent premature data entry.
        // The SK will be created ONLY when generated in SK Generator page.
        
        setSuccessData({ count: convexTeachers.length })
        setShowSuccessModal(true)
        
        // Removed Navigate - Let user click OK on modal to navigate
        // navigate("/dashboard/sk") 

    } catch (e: any) {
        console.error("Bulk Submission Error:", e)
        const msg = "Terjadi kesalahan saat memproses data: " + (e.message || "Unknown error")
        toast.error(msg)
        setUploadError(msg)
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
        
        {/* Template Download Section */}
        <div 
          className="flex items-center gap-4 p-4 border rounded-lg bg-green-50 hover:bg-green-100 transition-colors cursor-pointer group mb-6"
          onClick={handleDownloadTemplate}
        >
            <div className="p-2 bg-green-200 rounded-md group-hover:bg-green-300 transition-colors">
              <FileSpreadsheet className="h-6 w-6 text-green-800" />
            </div>
            <div>
               <h4 className="font-semibold text-sm text-green-900">Download Template Guru</h4>
               <p className="text-xs text-green-700">Format .xlsx standar sistem</p>
            </div>
            <div className="ml-auto">
                <Button variant="outline" size="sm" className="bg-white hover:bg-green-50 border-green-200 text-green-800">
                  Download
                </Button>
            </div>
        </div>

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
                                 <TableHead>Sertifikasi (Raw)</TableHead>
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
                                     <TableCell>{c["sertifikasi"]}</TableCell>
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

             {/* ADMIN ONLY: Auto Approve */}
             {["admin", "super_admin"].includes(JSON.parse(localStorage.getItem("user") || "{}")?.role) && (
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
             )}

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
   {/* --- ESTETIK MODALS --- */}

      {/* 1. VALIDATION MODAL */}
      <Dialog open={showValidationModal} onOpenChange={setShowValidationModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2 text-green-600 mb-2">
                <CheckCircle className="h-6 w-6" />
                <DialogTitle>File Excel Terbaca!</DialogTitle>
            </div>
            <DialogDescription>
              Sistem berhasil membaca struktur Excel anda.
            </DialogDescription>
          </DialogHeader>
          
          <div className="bg-slate-50 p-4 rounded-md text-sm border font-mono whitespace-pre-wrap max-h-[300px] overflow-auto">
             <div className="font-bold text-slate-700 mb-2">Header ditemukan di Baris {validationData?.row}</div>
             <div className="text-slate-600">{validationData?.mapping}</div>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowValidationModal(false)}>
              Lanjut Proses
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. SUCCESS MODAL */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="max-w-md text-center">
            <div className="flex flex-col items-center justify-center py-6 gap-4">
                <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                    <CheckCircle className="h-10 w-10" />
                </div>
                <DialogTitle className="text-2xl font-bold text-green-700">Berhasil!</DialogTitle>
                <div className="text-slate-600">
                    <p className="font-semibold text-lg">{successData.count} Data Guru Masuk Antrean.</p>
                    <p className="text-sm mt-2 text-slate-500">
                        Data sudah otomatis <b>Verified</b> dan masuk ke Generator SK.
                    </p>
                </div>
                
                <Button 
                    className="w-full mt-4 bg-green-600 hover:bg-green-700" 
                    onClick={() => {
                        setShowSuccessModal(false)
                        navigate("/dashboard/sk/generator") // Go straight to Generator
                    }}
                >
                    Buka Generator SK
                </Button>
            </div>
        </DialogContent>
      </Dialog>

    </Card>
  )
}
// End of file
