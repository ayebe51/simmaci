import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { FileDown, Loader2, Search, Archive, BadgeCheck, Settings, CheckCircle, RotateCcw, Trash2 } from "lucide-react"
import { useState, useEffect } from "react"
// Removed: import { saveAs } from "file-saver" - using native browser download instead
import JSZip from "jszip"
import PizZip from "pizzip"
import Docxtemplater from "docxtemplater"
import { Link } from "react-router-dom"
import ImageModule from "docxtemplater-image-module-free"
import QRCode from "qrcode"
import { useConvex } from "convex/react"
import { api } from "../../../convex/_generated/api"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

// Helper: Convert Base64 DataURL to ArrayBuffer (Required by ImageModule)
function base64DataURLToArrayBuffer(dataURL: string) {
  const base64Regex = /^data:image\/(png|jpg|svg|svg\+xml);base64,/;
  if (!base64Regex.test(dataURL)) {
    return false;
  }
  const stringBase64 = dataURL.replace(base64Regex, "");
  let binaryString;
  if (typeof window !== "undefined") {
    binaryString = window.atob(stringBase64);
  } else {
    throw new Error("Window not defined for base64 decoding");
  }
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    const ascii = binaryString.charCodeAt(i);
    bytes[i] = ascii;
  }
  return bytes.buffer;
}

// Helper to load base64 template to binary string (Legacy/Unused - Removed)
    // Remove data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,
    const block = base64.split(";base64,");
    const realData = block[1] ? block[1] : Base64String(base64) ? base64 : null; // simplified
    if (!realData) return null
    return atob(realData)
}

// Simple Base64 check
const Base64String = (str: string) => {
    try {
        return btoa(atob(str)) === str;
    } catch {
        return false;
    }
}

// Helper: Add 1 year to Indonesian Date String (e.g., "16 Juli 2024" -> "16 Juli 2025")
const addOneYearIndonesian = (dateStr: string) => {
    if (!dateStr || dateStr === "-") return "-"
    try {
        const parts = dateStr.split(" ")
        if (parts.length < 3) return dateStr // Safety check
        const year = parseInt(parts[parts.length - 1])
        if (isNaN(year)) return dateStr
        
        // Replace year with year + 1
        parts[parts.length - 1] = (year + 1).toString()
        return parts.join(" ")
    } catch (e) {
        return dateStr
    }
}


const generateBulkSkZip = async (
  candidates: any[],
  filename = "SK_Masal_Maarif.zip",
  debugData?: any,
  convexClient?: any // Injected Convex Client
) => {
    const zip = new JSZip()
    const folder = zip.folder("SK_Generated")
    
    // Add Debug File
    if (debugData) {
        folder?.file("DEBUG_DATA_MAPPING.json", JSON.stringify(debugData, null, 2))
    }
    
    // Cache templates to avoid repeated localStorage reads/decodes
    const templateCache: Record<string, string | null> = {}
    
    // Mapping Jenis SK to Template ID
    // Updated to accept full data object for complex logic
    const getTemplateId = (data: any) => {
        const jenis = (data.jenisSk || data.status || "").toLowerCase()
        const jabatan = (data.jabatan || "").toLowerCase()
        // const status = (data.statusKepegawaian || "").toLowerCase() // not reliable if undefined
        const nip = (data.nip || "").replace(/[^0-9]/g, "")

        if (jenis.includes("tetap yayasan") || jenis.includes("gty")) return "sk_template_gty"
        if (jenis.includes("tidak tetap") || jenis.includes("gtt")) return "sk_template_gtt"
        
        // Complex Kamad Logic
        if (jenis.includes("kepala") || jenis.includes("kamad")) {
             if (jabatan.includes("plt") || jabatan.includes("pelaksana")) {
                 return "sk_template_kamad_plt"
             }
             // PNS Check: Valid NIP usually means PNS. 
             // Also check statusKepegawaian if available, but NIP > 10 digits is strong signal
             const isPns = nip.length > 10 || (data.statusKepegawaian || "").includes("PNS") || (data.statusKepegawaian || "").includes("ASN")
             
             if (isPns) return "sk_template_kamad_pns"
             return "sk_template_kamad_nonpns"
        }
        
        return "sk_template_tendik" // Default to Tendik
    }

    let successCount = 0;
    const errors: string[] = []

    for (const data of candidates) {
        try {
            const templateId = getTemplateId(data)
            
            // NEW: Fetch from Cloud if not cached
            if (templateCache[templateId] === undefined) {
                if (convexClient) {
                   try {
                       // Direct API usage via client
                       const result = await convexClient.query(api.settings_cloud.getContent, { key: templateId });
                       if (result) {
                            // Convert Base64 if needed
                            if (!result.startsWith("http")) {
                                 const base64 = result.split(',')[1] || result;
                                 templateCache[templateId] = atob(base64);
                            } else {
                                // URL Mode fallback
                                 templateCache[templateId] = null; // Not supporting URL in bulk yet efficiently
                            }
                       } else {
                            templateCache[templateId] = null;
                       }
                   } catch (e) {
                       console.error("Cloud Fetch Error", e)
                       templateCache[templateId] = null;
                   }
                }
                
                // Fallback to LocalStorage if Cloud failed or Client not provided
                if (!templateCache[templateId]) {
                    templateCache[templateId] = loadTemplate(templateId)
                }
            }

            const content = templateCache[templateId]
            if (!content) {
                errors.push(`Template tidak ditemukan untuk ${data.nama} (ID: ${templateId}). Upload di Settings.`)
                continue
            }

            // QR Code Generation
            let qrDataUrl = "";
            try {
                // Use _id for verification URL, fallback to nomorSk if needed
                const docId = data._id || data.nomorSk || "INVALID";
                const verificationUrl = `${window.location.origin}/verify/${docId}`;
                qrDataUrl = await QRCode.toDataURL(verificationUrl, { width: 400, margin: 1 });
            } catch (err) {
                console.error("QR Generated Failed", err);
            }

            const pzip = new PizZip(content);

            // Configure Image Module
            const imageOpts = {
                getImage: function (tagValue: string, tagName: string) {
                    return base64DataURLToArrayBuffer(tagValue);
                },
                getSize: function (img: any, tagValue: string, tagName: string) {
                    // Force 100x100px for QR Codes
                    if (tagName === "qrcode") return [100, 100];
                    return [100, 100];
                },
            };
            const imageModule = new ImageModule(imageOpts);

            const doc = new Docxtemplater(pzip, {
                paragraphLoop: true,
                linebreaks: true,
                modules: [imageModule],
                // Fix: Return empty string instead of "undefined" text
                nullGetter: (part) => {
                     // console.warn("Missing tag:", part.value) 
                     return "" 
                }
            });

            // Render with QR Code
            doc.render({
                ...data,
                qrcode: qrDataUrl // {%qrcode} tag in Docx
            });

            const out = doc.getZip().generate({
                type: "uint8array",
                mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            });

            
            const safeName = (data.nama || "document").replace(/[^a-z0-9]/gi, '_').substring(0, 50)
            folder?.file(`${safeName}_SK.docx`, out)
            successCount++

        } catch (error: any) {
            console.error("Gen Error", error)
            errors.push(`Gagal generate untuk ${data.nama}: ${error.message}`)
        }
    }

    if (errors.length > 0) {
        folder?.file("ERRORS_REPORT.txt", errors.join("\n"))
    }
    
    
    if (successCount === 0 && errors.length > 0) {
        // alert(`Gagal Generate SK!\n\n${errors[0]}\n\n(Cek file ERRORS_REPORT.txt di dalam ZIP untuk detail lengkap)`)
        // return { successCount, errorCount: errors.length, error: errors[0] }
    }

    // CRITICAL FIX: Wrap ZIP generation in try-catch
    try {
        const content = await zip.generateAsync({ type: "blob" })
        
        // FIXED: Use native browser download with Chrome compatibility
        const url = URL.createObjectURL(content)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        link.type = 'application/zip' // Chrome needs explicit type
        link.rel = 'noopener' // Security best practice
        link.style.display = 'none'
        document.body.appendChild(link)
        
        // Force click for download
        link.click()
        
        // Cleanup after download triggered (increased delay for Chrome)
        setTimeout(() => {
            document.body.removeChild(link)
            URL.revokeObjectURL(url)
        }, 250)
        
        console.log(`✅ ZIP saved: ${filename}, Size: ${content.size} bytes`)
    } catch (zipError: any) {
        console.error("❌ CRITICAL: ZIP Generation Failed!", zipError)
        // alert(`CRITICAL ERROR: Gagal membuat file ZIP!\n\nError: ${zipError.message}\n\nSilakan cek console untuk detail.`)
        throw zipError // Re-throw to prevent false success
    }
    
    return { successCount, errorCount: errors.length, firstError: errors[0] }
}

// 🔥 CONVEX REAL-TIME
import { useQuery, useMutation } from "convex/react"
import { api as convexApi } from "../../../convex/_generated/api"

export default function SkGeneratorPage() {
  const convex = useConvex()
  // Use Convex query to get teachers
  
  // 🔥 ONLY SHOW TEACHERS WHO HAVE SUBMITTED SK
  // Teachers from master data import won't appear here
  // Only teachers who submitted SK via submission form will show
  const teachersData = useQuery(convexApi.sk.getTeachersWithSk, { isVerified: true }) || []
  
  // MUTATIONS
  // MUTATIONS
  const createSk = useMutation(convexApi.sk.create)
  const deleteTeacher = useMutation(convexApi.sk.deleteTeacher)
  const deleteAllTeachers = useMutation(convexApi.sk.deleteAllTeachers)
  // FIXED: Point to the correct new mutation
  const deleteAllSkHistory = useMutation(convexApi.sk.deleteAllSk) 
  const markAsGenerated = useMutation(convexApi.sk.markTeacherAsGenerated) 
  
  // STATES
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [hasStoredTemplate, setHasStoredTemplate] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  
  // Dialog State
  const [dialogState, setDialogState] = useState({
      open: false,
      title: "",
      message: "",
      isError: false
  })
  const itemsPerPage = 10

  const [nomorMulai, setNomorMulai] = useState("0001")
  const [nomorFormat, setNomorFormat] = useState("{NOMOR}/PC.L/A.II/H-34.B/24.29/{TANGGAL}/{BULAN}/{TAHUN}")
  
  // New States for Surat Masuk & Validity
  const [nomorSuratMasuk, setNomorSuratMasuk] = useState("")
  const [tanggalSuratMasuk, setTanggalSuratMasuk] = useState("")
  const [tahunAjaran, setTahunAjaran] = useState(() => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() // 0 = Jan, 6 = July
    
    // If Month is July (6) or later -> 2025/2026
    // If Month is before July -> 2024/2025
    if (currentMonth >= 6) { 
        return `${currentYear}/${currentYear + 1}`
    } else {
        return `${currentYear - 1}/${currentYear}`
    }
  })
  
  const [tanggalPenetapan, setTanggalPenetapan] = useState("")
  // New: Global Kecamatan Fallback
  const [defaultKecamatan, setDefaultKecamatan] = useState("") 

  // Helper function to calculate +1 Year
  const calculateValidityDate = (startDateStr: string): string => {
      // Check if Date is valid?
      // Simple implementation
      return "-"
  }
  
  // ... (Lines 249-876 skipped) ...

  const handleReset = async () => {
    if (!confirm("⚠️ PERINGATAN KERAS!\n\nApakah anda yakin ingin MENGHAPUS SEMUA DATA GURU?\nTindakan ini tidak dapat dibatalkan.")) return
    
    // Double confirmation
    if(!confirm("Yakin? Data akan hilang selamanya.")) return

    setIsLoading(true)
    try {
        await deleteAllTeachers()
        await deleteAllSkHistory() // Also wipe SK History to prevent duplicates
        setNomorMulai("0001") // Reset Counter
        alert("Semua data guru antrean DAN riwayat SK berhasil dihapus.\nNomor Surat kembali ke 0001.")
    } catch (e: any) {
        console.error(e)
        alert("Gagal menghapus data: " + e.message)
    } finally {
        setIsLoading(false)
    }
  }

  const handleResetSkHistoryOnly = async () => {
    if (!confirm("⚠️ KONFIRMASI PENTING \n\nApakah anda yakin ingin menghapus HANYA RIWAYAT SK?\n\n- Data guru antrean TETAP ADA.\n- Nomor SK yang sudah terbentuk akan DIHAPUS.\n- Anda bisa generate ulang dari awal.\n\nLanjutkan?")) return
    
    setIsLoading(true)
    try {
        const res = await deleteAllSkHistory()
        setNomorMulai("0001") // Reset Counter
        alert(`✅ Berhasil menghapus ${res.count} Riwayat SK.\nData Guru aman.\nSilakan generate ulang.`)
    } catch (e: any) {
        console.error(e)
        alert("Gagal menghapus riwayat SK: " + e.message)
    } finally {
        setIsLoading(false)
    }
  }


  
  // Teachers loaded via Convex useQuery (real-time, no need for manual fetch)
  useEffect(() => {
    // 2. Check for ANY stored template

    if (
        localStorage.getItem("sk_template_gty_blob") || 
        localStorage.getItem("sk_template_gtt_blob") || 
        localStorage.getItem("sk_template_kamad_blob") || 
        localStorage.getItem("sk_template_tendik_blob")
    ) {
        setHasStoredTemplate(true)
    }
  }, [])

  // Filter logic
  const filteredTeachers = teachersData.filter(t => 
    // Only show active teachers
    (t.isActive !== false) &&
    ((t.nama?.toLowerCase() || "").includes(searchTerm.toLowerCase()) || 
    (t.unitKerja?.toLowerCase() || "").includes(searchTerm.toLowerCase()))
  )

  // Pagination Logic
  const totalPages = Math.ceil(filteredTeachers.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const currentData = filteredTeachers.slice(startIndex, startIndex + itemsPerPage)

  // Selection Logic
  const handleSelectAllForPage = (checked: boolean) => {
    const next = new Set(selectedIds)
    currentData.forEach(t => {
        if (checked) next.add(t._id)
        else next.delete(t._id)
    })
    setSelectedIds(next)
  }

  

  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  useEffect(() => {
        const u = localStorage.getItem("user")
        if (u) {
            const user = JSON.parse(u)
            setIsSuperAdmin(user.role === "super_admin")
        }
  }, [])
  
  const handleBulkSign = () => {
      // Stub for future bulk sign action
      alert(`Menandatangani ${selectedIds.size} SK secara digital (Simulasi)...`)
  }

  const handleSelectOne = (id: string, checked: boolean) => {
    const next = new Set(selectedIds)
    if (checked) {
      next.add(id)
    } else {
      next.delete(id)
    }
    setSelectedIds(next)
  }



  // --- SMART LOGIC: Template Inspector & Validator ---
  const inspectTemplate = () => {
      const templateId = "sk_template_gty" 
      const content = loadTemplate(templateId) || loadTemplate("sk_template_tendik")
      
      if (!content) {
          alert("Tidak ada template yang tersimpan. Upload dulu!")
          return
      }

      try {
          const zip = new PizZip(content)
          const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true })
          const text = doc.getFullText()
          // Robust Regex: Matches {VAR}, {{VAR}}, { VAR }, {Variable Name}
          const matchedTags = text.match(/\{{1,2}[^{}\n\r]+\}{1,2}/g) || []
          
          // Clean tags: remove braces and trim whitespace
          const uniqueTags = Array.from(new Set(matchedTags.map(t => t.replace(/[\{\}]/g, '').trim())))

          // Create a dummy data object with ALL available keys to check against
          const sampleData = {
              ...teachersData[0], // base props
              jenisSk: "SK Guru Tetap",
              // Uppercase
              NAMA: "Sample", NAMA_LENGKAP: "Sample", NAMA_GURU: "Sample",
              NIP: "123", NUPTK: "123", NOMOR_INDUK: "123", "NOMOR INDUK MAARIF": "123",
              JABATAN: "Guru", UNIT_KERJA: "Madrasah", "UNIT KERJA": "Madrasah", STATUS: "Aktif",
              TTL: "City, 01-01-1990", "TEMPAT/TANGGAL LAHIR": "City, 01-01-1990",
              PENDIDIKAN: "S1", TMT: "2010-01-01",
              KECAMATAN: "Cilacap", NOMOR_SURAT: "123/SK/2025", TANGGAL_PENETAPAN: "01 Januari 2025",
              NOMOR: "123", TANGGAL: "01", BULAN: "Januari", TAHUN: "2025", "TANGGAL LENGKAP": "01 Januari 2025",
              // Lowercase
              nama: "x", nip: "x", nuptk: "x", nomor_induk: "x",
              jabatan: "x", unit_kerja: "x", status: "x", ttl: "x", pendidikan: "x", tmt: "x",
              kecamatan: "x", nomor_surat: "x", tanggal_penetapan: "x",
              // Title
              Nama: "x", Nip: "x", Nuptk: "x", Nomor_Induk: "x", Jabatan: "x", Unit_Kerja: "x",
              Status: "x", Ttl: "x", Pendidikan: "x", Tmt: "x",
              Kecamatan: "x", Nomor_Surat: "x", Tanggal_Penetapan: "x",
              KETUA_NAMA: "x", KETUA_NIP: "x", SEKRETARIS_NAMA: "x", SEKRETARIS_NIP: "x"
          }

          const availableKeys = new Set(Object.keys(sampleData))
          
          const found = []
          const missing = []

          uniqueTags.forEach(tag => {
              if (availableKeys.has(tag)) found.push(tag)
              else missing.push(tag)
          })

          let msg = `[HASIL ANALISA TEMPLATE]\n\n`
          
          if (uniqueTags.length === 0) {
              msg += `❌ TIDAK DITEMUKAN VARIABEL APAPUN!\n\n`
              msg += `Saya tidak menemukan tanda kurung { } atau {{ }} di dalam file Word anda.\n`
              msg += `Pastikan anda menulis variabel seperti ini: {NAMA}, {NIP}, dll.\n`
              msg += `Jangan gunakan [ ] atau < >.`
              alert(msg)
              return
          }

          msg += `Ditemukan ${uniqueTags.length} variabel: ${uniqueTags.join(", ")}\n`

          if (found.length > 0) {
              msg += `\n✅ BERHASIL MATCH (${found.length}):\n${found.join(", ")}\n`
          }

          if (missing.length > 0) {
              msg += `\n⚠️ TIDAK DIKENALI (${missing.length}):\n${missing.join(", ")}\n`
              msg += `\nSOLUSI: Rename variabel di Word anda menjadi salah satu ini:\n`
              msg += `NAMA, NUPTK, TTL, PENDIDIKAN, TMT, JABATAN, UNIT_KERJA, KECAMATAN, NOMOR_SURAT, TANGGAL_PENETAPAN\n`
          } else {
              msg += `\n🎉 SEMPURNA! Semua variabel valid.`
          }

          alert(msg)

      } catch (e: any) {
          alert("Error: " + e.message)
      }
  }

  // Duplicate handleGenerate removed


  // --- SMART LOGIC: Explain Classification ---
  const explainClassification = (t: any) => {
      const p = (t.pendidikanTerakhir || "").toLowerCase()
      const n = (t.nama || "").toLowerCase()
      const tmt = t.tmt

      let log = `[Analisa Logika SK - ${t.nama}]\n`

      // 1. Check Education / Title
      const educationKeywords = ["s1", "s.1", "sarjana", "s2", "s.2", "magister", "s3", "s.3", "doktor", "div", "d4"]
      const titleKeywords = ["s.pd", "s.ag", "s.e", "s.kom", "s.h", "s.sos", "s.hum", "s.ip", "m.pd", "m.ag", "m.e", "m.kom", "dra.", "drs.", "lc.", "b.a"]

      const hasEdu = educationKeywords.some(k => p.includes(k))
      const hasTitle = titleKeywords.some(k => n.includes(k))

      log += `1. Cek Pendidikan/Gelar:\n`
      log += `   - Data Pendidikan: "${t.pendidikanTerakhir}" -> ${hasEdu ? "LULUS (S1+)" : "TIDAK (Belum S1)"}\n`
      log += `   - Cek Gelar di Nama: "${t.nama}" -> ${hasTitle ? "LULUS (Ada Gelar)" : "TIDAK"}\n`

      if (!hasEdu && !hasTitle) {
          log += `\nKESIMPULAN: TENDIK\n(Karena tidak ditemukan tanda S1 atau gelar akademik)`
          alert(log)
          return
      }

      // 2. Check Tenure
      log += `\n2. Cek Masa Kerja (TMT):\n`
      let tmtDate = new Date()
       if (tmt && typeof tmt === 'string' && tmt.includes("/")) {
          const parts = tmt.split("/")
          if (parts.length === 3) tmtDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`)
      } else if (tmt) {
          tmtDate = new Date(tmt)
      }

      const now = new Date()
      let yearsDiff = now.getFullYear() - tmtDate.getFullYear()
      const m = now.getMonth() - tmtDate.getMonth()
      if (m < 0 || (m === 0 && now.getDate() < tmtDate.getDate())) yearsDiff--

      log += `   - TMT Tercatat: ${t.tmt || 'Kosong'} (Dibaca: ${tmtDate.toDateString()})\n`
      log += `   - Masa Kerja: ${yearsDiff} Tahun\n`
      log += `   - Syarat GTY: Minimal 2 Tahun\n`

      if (yearsDiff >= 2) {
          log += `\nKESIMPULAN: GTY (Guru Tetap Yayasan)\n(Berpendidikan S1/Gelar DAN Masa Kerja >= 2 Tahun)`
      } else {
          log += `\nKESIMPULAN: GTT (Guru Tidak Tetap)\n(Berpendidikan S1/Gelar tapi Masa Kerja < 2 Tahun)`
      }
      
      alert(log)
  }

  // --- HELPER: Parse Date Robustly ---
  const parseIndonesianDate = (dateStr: any): Date | null => {
      if (!dateStr) return null
      
      const str = String(dateStr).trim()

      
      // 0. Excel Serial Date check (Simple 5 digit number)
      if (/^\d{5}$/.test(str)) {
          try {
             const serial = parseInt(str, 10);
             // Convert Excel serial to JS Date (rough approximation sufficient for dates)
             // (serial - 25569) * 86400 * 1000
             return new Date((serial - 25569) * 86400 * 1000);
          } catch (e) {
              console.error("Failed to parse serial date", e);
          }
      }

      // 1. Try Standard Date
      const d = new Date(str)
      if (!isNaN(d.getTime()) && !/^\d+$/.test(str)) return d // Avoid plain numbers being treated as ms timestamp unless filtered above

      // 2. Try DD/MM/YYYY or DD-MM-YYYY
      const parts = str.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/)
      if (parts) {
          // parts[1] is Day, parts[2] is Month, parts[3] is Year
          return new Date(`${parts[3]}-${parts[2]}-${parts[1]}`)
      }

      // 3. Try Indonesian/English Month Names with varying delimiters (space, dash, slash)
      // e.g. "15 Juli 2020", "18-Jul-2011", "01/Des/2023"
      const months: {[key: string]: string} = {
          'januari': '01', 'februari': '02', 'maret': '03', 'april': '04', 'mei': '05', 'juni': '06',
          'juli': '07', 'agustus': '08', 'september': '09', 'oktober': '10', 'november': '11', 'desember': '12',
          'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06',
          'jul': '07', 'aug': '08', 'agt': '08', 'sep': '09', 'oct': '10', 'okt': '10', 'nov': '11', 'dec': '12', 'des': '12'
      }

      // Split by space, dash, or slash
      const txtParts = str.split(/[\s\-\/]+/)
      
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

  // --- LOGIC: Determine Jenis SK ---
  // FIXED: Added fallback logic to respect existing Status for overrides
  const determineJenisSk = (pendidikan: string, tmt: string, nama: string, jabatan: string, explicitStatus?: string) => {
      // 0. Explicit Override (GTY/GTT/Kamad)
      if (explicitStatus) {
         const s = explicitStatus.toLowerCase()
         if (s === "gty" || s.includes("guru tetap yayasan") || s.includes("tetap yayasan") || s.includes("sertifikasi")) return "SK Guru Tetap Yayasan"
         if (s === "gtt" || s.includes("guru tidak tetap") || s.includes("tidak tetap") || s.includes("honorer")) return "SK Guru Tidak Tetap"
         if (s === "kamad" || s.includes("kepala")) return "SK Kepala Madrasah"
      }
      
      const p = (pendidikan || "").toLowerCase()
      const n = (nama || "").toLowerCase()
      const j = (jabatan || "").toLowerCase()

      console.log(`[determineJenisSk] nama: ${nama}, tmt: ${tmt}, pendidikan: ${pendidikan}`)

      // 0. Check Kamad
      if (j.includes("kepala") || j.includes("kamad")) return "SK Kepala Madrasah"

      // Keywords for S1 or above (Check Pendidikan AND Name titles)
      const educationKeywords = ["s1", "s.1", "sarjana", "s2", "s.2", "magister", "s3", "s.3", "doktor", "div", "d4"]
      const titleKeywords = ["s.pd", "s.ag", "s.e", "s.kom", "s.h", "s.sos", "s.hum", "s.ip", "m.pd", "m.ag", "m.e", "m.kom", "dra.", "drs.", "lc.", "b.a"]
      
      const isSarjana = educationKeywords.some(k => p.includes(k)) || 
                        titleKeywords.some(k => n.includes(k))

      if (!isSarjana) return "SK Tenaga Kependidikan"

      // Check Tenure - ONLY if TMT exists
      if (!tmt || tmt.trim() === '') {
        console.warn(`[determineJenisSk] TMT kosong untuk ${nama}! Default ke GTT`)
        return "SK Guru Tidak Tetap"
      }

      const tmtDate = parseIndonesianDate(tmt)
      if (!tmtDate) {
        console.warn(`[determineJenisSk] TMT tidak bisa di-parse: ${tmt} untuk ${nama}. Default ke GTT`)
        return "SK Guru Tidak Tetap"
      }

      const now = new Date()
      let yearsDiff = now.getFullYear() - tmtDate.getFullYear()
      const m = now.getMonth() - tmtDate.getMonth()
      if (m < 0 || (m === 0 && now.getDate() < tmtDate.getDate())) yearsDiff--

      console.log(`[determineJenisSk] ${nama}: TMT Date=${tmtDate.toLocaleDateString()}, Years=${yearsDiff}`)

      if (yearsDiff >= 2) return "SK Guru Tetap Yayasan"
      else return "SK Guru Tidak Tetap"
  }

  // --- HELPER: Roman Numerals ---
  const toRoman = (num: number): string => {
      const roman = {M:1000,CM:900,D:500,CD:400,C:100,XC:90,L:50,XL:40,X:10,IX:9,V:5,IV:4,I:1}
      let str = '', i
      for ( i in roman ) {
          while ( num >= roman[i as keyof typeof roman] ) {
              str += i
              num -= roman[i as keyof typeof roman]
          }
      }
      return str
  }

  // Generate Handler
  const handleGenerate = async () => {
    if (selectedIds.size === 0) return alert("Pilih minimal satu data guru.")

    setIsGenerating(true)
    try {
      // Get selected teacher objects
      const selectedData = teachersData.filter(t => selectedIds.has(t._id))
      
      // Get Settings for Signers
      const settingsStr = localStorage.getItem("app_settings")
      const settings = settingsStr ? JSON.parse(settingsStr) : {}

      // PREPARE DATE COMPONENTS
      // Default to today if empty
      const finalTanggalPenetapan = tanggalPenetapan || new Date().toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})
      
      // Try to parse day, month, year from string like "01 Januari 2025" or ISO
      // Simple parse assume: DD Month YYYY or YYYY-MM-DD
      const dateObj = parseIndonesianDate(tanggalPenetapan) || new Date()
      const dd = String(dateObj.getDate()).padStart(2, '0')
      const mm = String(dateObj.getMonth() + 1).padStart(2, '0') // 07
      const mmAngka = String(dateObj.getMonth() + 1) // 7
      const mmRoma = toRoman(dateObj.getMonth() + 1)
      const yyyy = dateObj.getFullYear()

      // Calculate +1 Year Validity
      const tanggalHabisBerlaku = calculateValidityDate(finalTanggalPenetapan)
      const tanggalSuratMasukFormatted = parseIndonesianDate(tanggalSuratMasuk) 
            ? parseIndonesianDate(tanggalSuratMasuk)!.toLocaleDateString('id-ID', {day: '2-digit', month: 'long', year: 'numeric'})
            : (tanggalSuratMasuk || "-")

      // Map teacher data to template keys clearly
      const mappedData = selectedData.map((t, idx) => {
              const derivedJenisSk = determineJenisSk((t as any).pendidikanTerakhir, t.tmt, t.nama, (t as any).jabatan, t.status)
              
              const tmt = t.tmt || ''
          const tmtParsed = parseIndonesianDate(tmt)
          const tmtFormatted = tmtParsed 
                ? tmtParsed.toLocaleDateString('id-ID', {day: '2-digit', month: 'long', year: 'numeric'}) 
                : (tmt || '-')

          // Auto-Numbering Logic
          // Parse Start Number
          let currentSeq = parseInt(nomorMulai) || 1
          currentSeq += idx // Increment
          const seqStr = String(currentSeq).padStart(4, '0')
          
          const generatedNomor = nomorFormat
              .replace(/{NO}/g, seqStr)
              .replace(/{NOMOR}/g, seqStr)
              .replace(/{SEQ}/g, seqStr)
              .replace(/{HL}/g, dd)
              .replace(/{DD}/g, dd)
              .replace(/{TANGGAL}/g, dd)
              .replace(/{MM}/g, mm)
              .replace(/{BL}/g, mmAngka) // "7"
              .replace(/{BULAN}/g, mmAngka) // "7" (User Request)
              .replace(/{BL_ROMA}/g, mmRoma)
              .replace(/{TH}/g, String(yyyy))
              .replace(/{YYYY}/g, String(yyyy))
              .replace(/{TAHUN}/g, String(yyyy))


          // Fallback Kecamatan Logic:
          // 1. Teacher Data (highest priority) -> 2. Global Input -> 3. "....."
          const rawKecamatan = (t as any).kecamatan
          const kecamatan = (rawKecamatan && rawKecamatan.length > 2) ? rawKecamatan : (defaultKecamatan || ".....")


          // TTL Construction - FIX: Use correct field names from database
          const birthPlace = (t as any).tempatLahir || ""
          const birthDate = (t as any).tanggalLahir || ""
          let ttl = "-"
          if(birthPlace || birthDate) {
              ttl = `${birthPlace}${birthPlace && birthDate ? ', ' : ''}${birthDate}`
          }

          return {
            ...t,
            jenisSk: derivedJenisSk,

            // Uppercase
            NAMA: t.nama,
            NOMOR_SURAT: generatedNomor,
            TANGGAL_PENETAPAN: finalTanggalPenetapan,
            KECAMATAN: kecamatan,
            
            // Extensive Aliases (Kitchen Sink)
            NOMOR: seqStr,
            "NOMOR INDUK MAARIF": t.nuptk || t.nip || '-',
            "UNIT KERJA": t.unitKerja || '-',
            "TEMPAT/TANGGAL LAHIR": ttl,
            "TANGGAL LENGKAP": finalTanggalPenetapan,
            TANGGAL: dd,
            BULAN: mmAngka,
            NAMA_BULAN: dateObj.toLocaleDateString('id-ID', {month: 'long'}),
            TAHUN: String(yyyy),
            
            // Request Letter & Validity
            NOMOR_SURAT_MASUK: nomorSuratMasuk || "-",
            NOMOR_SURAT_PERMOHONAN: nomorSuratMasuk || "-",
            NO_SURAT_PERMOHONAN: nomorSuratMasuk || "-",
            NOMOR_PERMOHONAN: nomorSuratMasuk || "-",
            NO_PERMOHONAN: nomorSuratMasuk || "-",
            
            TANGGAL_SURAT_MASUK: tanggalSuratMasukFormatted,
            TANGGAL_SURAT_PERMOHONAN: tanggalSuratMasukFormatted,
            TGL_SURAT_PERMOHONAN: tanggalSuratMasukFormatted,
            TANGGAL_PERMOHONAN: tanggalSuratMasukFormatted,
            TGL_PERMOHONAN: tanggalSuratMasukFormatted,
            
            TAHUN_AJARAN: tahunAjaran,
            TAHUN_PELAJARAN: tahunAjaran,
            TH_AJARAN: tahunAjaran,
            TH_PELAJARAN: tahunAjaran,
            
            TANGGAL_HABIS_BERLAKU: addOneYearIndonesian(finalTanggalPenetapan),
            TANGGAL_BERAKHIR: addOneYearIndonesian(finalTanggalPenetapan),
            "TANGGAL > 1 TAHUN SEJAK PENETAPAN": addOneYearIndonesian(finalTanggalPenetapan),
            MASA_BERLAKU: addOneYearIndonesian(finalTanggalPenetapan),

            NAMA_LENGKAP: t.nama,
            NAMA_GURU: t.nama,
            NIP: t.nip || t.nuptk || '-',
            NUPTK: t.nuptk || '-',
            NOMOR_INDUK: t.nuptk || t.nip || '-',
            JABATAN: t.mapel === '-' ? 'Guru' : t.mapel,
            UNIT_KERJA: t.unitKerja || '-',
            STATUS: t.status,
            TTL: ttl,
            PENDIDIKAN: (t as any).pendidikanTerakhir || '-',
            TMT: tmtFormatted,
            TANGGAL_MULAI_TUGAS: tmtFormatted,
            TGL_MULAI_TUGAS: tmtFormatted,

            // Lowercase
            nama: t.nama,
            nip: t.nip || t.nuptk || '-',
            nuptk: t.nuptk || '-',
            nomor_induk: t.nuptk || t.nip || '-',
            jabatan: t.mapel === '-' ? 'Guru' : t.mapel,
            unit_kerja: t.unitKerja || '-',
            status: t.status,
            ttl: ttl,
            pendidikan: (t as any).pendidikanTerakhir || '-',
            tmt: tmtFormatted,

            pangkat: (t as any).pangkat || "-", // Fallback common field
            golongan: (t as any).golongan || "-",

            // --- KITCHEN SINK ALIASES (Space, TitleCase, dots) ---
            "Nomor Surat Permohonan": nomorSuratMasuk || "-",
            "No. Surat Permohonan": nomorSuratMasuk || "-",
            "Nomor Permohonan": nomorSuratMasuk || "-",
            "No Surat Permohonan": nomorSuratMasuk || "-",

            "Tanggal Surat Permohonan": tanggalSuratMasukFormatted,
            "Tgl. Surat Permohonan": tanggalSuratMasukFormatted,
            "Tanggal Permohonan": tanggalSuratMasukFormatted,
            "Tgl Surat Permohonan": tanggalSuratMasukFormatted,
            
            "Tahun Ajaran": tahunAjaran,
            "Th. Ajaran": tahunAjaran,
            "Th Ajaran": tahunAjaran,
            
            // --- ALL CAPS SPACES (User might format like this) ---
            "NOMOR SURAT PERMOHONAN": nomorSuratMasuk || "-",
            "NO SURAT PERMOHONAN": nomorSuratMasuk || "-",
            "TANGGAL SURAT PERMOHONAN": tanggalSuratMasukFormatted,
            "TGL SURAT PERMOHONAN": tanggalSuratMasukFormatted,
            "TAHUN AJARAN": tahunAjaran,
            "TH AJARAN": tahunAjaran,
            "TAHUN PELAJARAN": tahunAjaran,
            "TH PELAJARAN": tahunAjaran,
            
            // Title Case Space
            "Tahun Pelajaran": tahunAjaran,
            "Th Pelajaran": tahunAjaran,

            // Inject Global Signers
            KETUA_NAMA: settings.signerKetuaName || "H. Munib",
            KETUA_NIP: settings.signerKetuaNip || "-",
            SEKRETARIS_NAMA: settings.signerSekretarisName || "-",
            SEKRETARIS_NIP: settings.signerSekretarisNip || "-"
        }
      })
      
      console.log("MAPPED DATA SAMPLE:", mappedData[0]) // Debug Log

      // --- 1. PRE-ARCHIVE: Create SKs first to get IDs ---
      const finalData: any[] = []
      let successCount = 0

      for (const item of mappedData) {
          try {
              // Create SK in DB
              const skId = await createSk({
                  jenisSk: item.jenisSk,
                  status: "active",
                  nama: item.nama,
                  teacherId: (item as any)._id, // Original Teacher ID
                  jabatan: item.JABATAN,
                  unitKerja: item.UNIT_KERJA || "LP Maarif NU Cilacap",
                  nomorSk: item.NOMOR_SURAT,
                  tanggalPenetapan: item.TANGGAL_PENETAPAN,
                  fileUrl: "Generated via Bulk ZIP",
                  createdBy: "System"
              })

              // MODIFIED (SAFEGUARD): User requested NOT to delete teacher data after generation
              // Use Soft-Cleanup instead: Mark as Generated
              if ((item as any)._id) {
                 await markAsGenerated({ id: (item as any)._id })
              }

              // PUSH WITH NEW ID (For QR Code)
              finalData.push({
                  ...item,
                  _id: skId, // <--- CRITICAL: Overwrite with SK ID
                  original_teacher_id: (item as any)._id
              })
              successCount++

          } catch (err: any) {
              console.error("Failed to archive SK:", item.nama, err)
              // If archive fails, we probably shouldn't generate the file? 
              // Or maybe generate but with invalid QR? 
              // Better to skip to ensure consistency.
              // alert(`Gagal menyimpan data untuk ${item.nama}: ${err.message}`)
          }
      }

      if (finalData.length === 0) {
          setIsGenerating(false)
          return
      }
      
      // --- 2. GENERATE ZIP (Now using valid SK IDs) ---
      const res = await generateBulkSkZip(finalData, "SK_Masal_Maarif.zip", finalData, convex) 
      
      if (res.successCount > 0) {
          // Auto-Increment
          const nextStart = (parseInt(nomorMulai) || 0) + res.successCount
          setNomorMulai(String(nextStart).padStart(4, '0'))
          
          setDialogState({
              open: true,
              title: "Generasi SK Berhasil! 🎉",
              message: `Berhasil membuat ${res.successCount} berkas SK.\nData juga telah tersimpan otomatis di database.\n\nNomor Surat berikutnya: ${String(nextStart).padStart(4, '0')}`,
              isError: false
          })
      } else if (res.errorCount > 0) {
           setDialogState({
              open: true,
              title: "Gagal Generate SK ❌",
              message: `Gagal membuat dokumen: \n${res.firstError || "Unknown Error"}\n\nCek file ERRORS_REPORT.txt di dalam ZIP (jika terdownload) untuk detail lengkap.`,
              isError: true
          })
      }
      
      setIsGenerating(false)
    } catch (e: any) {
        console.error("❌ Critical Gen Error:", e)
        setDialogState({
              open: true,
              title: "System Error ⚠️",
              message: `Terjadi kesalahan sistem saat generate.\nError: ${e.message || e}`,
              isError: true
        })
        setIsGenerating(false)
    }
  }




  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
            <h1 className="text-2xl font-bold tracking-tight">Generator SK Masal</h1>
            <p className="text-muted-foreground">Pilih data guru dan terbitkan SK secara otomatis.</p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" onClick={handleResetSkHistoryOnly} className="text-amber-600 border-amber-200 hover:bg-amber-50" title="Hapus Riwayat SK saja (Guru Aman)">
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset SK History
            </Button>
            <Button variant="destructive" onClick={handleReset} disabled={isLoading} title="Hapus Data Guru + Riwayat SK">
                <Trash2 className="mr-2 h-4 w-4" /> Hapus Semua Data
            </Button>
             <Button variant="outline" asChild>
                <Link to="/dashboard/settings">
                    <Settings className="mr-2 h-4 w-4" /> Atur Template & Tanda Tangan
                </Link>
            </Button>
        </div>
      </div>

      {/* Removed Tabs wrapper - Archive moved to Arsip SK Unit page */}
      <div className="space-y-4">
        {/* GLOBAL SETTINGS CARD */}
        <Card className="mb-4 bg-slate-50/50 border-blue-100">
            <CardHeader className="pb-3 border-b bg-slate-50">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-700">
                    <Settings className="h-4 w-4 text-blue-600"/> Pengaturan Surat Keputusan (Global)
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 grid sm:grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2 sm:col-span-1">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Format Nomor Surat (Otomatis)</label>
                    <div className="flex gap-2">
                        <Input 
                            value={nomorMulai}
                            onChange={e => setNomorMulai(e.target.value)}
                            placeholder="Start (0001)"
                            className="w-20 bg-white"
                            title="Nomor Awal"
                        />
                        <Button 
                            variant="sketch" 
                            size="icon" 
                            className="bg-white border-input border text-slate-500 hover:text-black hover:bg-slate-100"
                            title="Reset Nomor ke 0001"
                            onClick={() => setNomorMulai("0001")}
                        >
                            <RotateCcw className="h-4 w-4" />
                        </Button>
                        <Input 
                            value={nomorFormat}
                            onChange={e => setNomorFormat(e.target.value)}
                            placeholder="Format: {NO}/SK/{BL_ROMA}/{TH}"
                            className="flex-1 bg-white"
                        />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                        Gunakan kode: <code>{"{NOMOR}"}</code> (urut), <code>{"{BL_ROMA}"}</code> (III), <code>{"{TANGGAL}"}</code> (01), <code>{"{BULAN}"}</code> (07), <code>{"{TAHUN}"}</code> (2025). 
                        <br/> Preview: <span className="font-mono bg-slate-100 px-1">{nomorFormat.replace('{NOMOR}', nomorMulai).replace('{NO}', nomorMulai).replace('{BL_ROMA}', 'VII').replace('{TH}', '2025').replace('{TAHUN}', '2025')}</span>
                    </p>
                </div>
                <div className="space-y-2 col-span-2 sm:col-span-1">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Tanggal Penetapan</label>

                    <Input 
                        placeholder="Contoh: 1 Juli 2025" 
                        value={tanggalPenetapan}
                        onChange={e => setTanggalPenetapan(e.target.value)}
                        className="bg-white"
                    />
                    <p className="text-[10px] text-muted-foreground">Otomatis mengganti <code>{"{TANGGAL_PENETAPAN}"}</code>.</p>
                </div>
                
                {/* SURAT MASUK & TAHUN AJARAN */}
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-2 mt-2">
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">No. Surat Permohonan</label>
                        <Input 
                            value={nomorSuratMasuk}
                            onChange={e => setNomorSuratMasuk(e.target.value)}
                            placeholder="Contoh: 005/MWC/..."
                            className="bg-white"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Tgl. Surat Permohonan</label>
                         <Input 
                            value={tanggalSuratMasuk}
                            onChange={e => setTanggalSuratMasuk(e.target.value)}
                            placeholder="Contoh: 20 Juni 2025"
                            className="bg-white"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Tahun Ajaran (Auto)</label>
                         <Input 
                            value={tahunAjaran}
                            onChange={e => setTahunAjaran(e.target.value)}
                            placeholder="Contoh: 2024/2025"
                            className="bg-white"
                        />
                    </div>
                     <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Kecamatan (Default)</label>
                         <Input 
                            value={defaultKecamatan}
                            onChange={e => setDefaultKecamatan(e.target.value)}
                            placeholder="Isi jika kecamatan di data guru kosong"
                            className="bg-white"
                        />
                    </div>
                </div>
            </CardContent>
        </Card>

        {/* GUIDANCE BOX */}
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-md mb-4">
            <div className="flex justify-between items-start">
                <div>
                     <h3 className="font-bold text-blue-800 mb-1">Panduan Template Word</h3>
                     <p className="text-sm text-blue-700 mb-2">
                        Agar data terisi otomatis, anda <strong>WAJIB</strong> menggunakan tanda kurung <code>{"{ }"}</code> di file Word.
                        <br/><span className="text-xs opacity-75">Klik kode dibawah untuk copy:</span>
                    </p>
                </div>
                <div>
                     {hasStoredTemplate ? (
                         <div className="flex items-center gap-2 text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded">
                            <CheckCircle className="h-3 w-3" /> Template Aktif: {localStorage.getItem("sk_template_name")}
                         </div>
                     ) : (
                         <div className="flex items-center gap-2 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-1 rounded">
                            <Archive className="h-3 w-3" /> Template Belum Ada
                         </div>
                     )}
                </div>
            </div>
            
            <div className="flex flex-wrap gap-2 mb-3">
                {["{NAMA}", "{NIP}", "{TTL}", "{PENDIDIKAN}", "{TMT}", "{JABATAN}", "{UNIT_KERJA}", "{KECAMATAN}", "{NOMOR_SURAT}", "{NOMOR}", "{TANGGAL_PENETAPAN}", "{TANGGAL_HABIS_BERLAKU}", "{NOMOR_SURAT_MASUK}", "{TANGGAL_SURAT_MASUK}", "{TAHUN_AJARAN}"].map(tag => (
                    <span key={tag} 
                          onClick={() => {navigator.clipboard.writeText(tag); alert(`Copied: ${tag}`)}}
                          className="bg-white px-2 py-1 rounded border text-xs font-mono font-bold select-all cursor-pointer hover:bg-slate-100 shadow-sm transition-colors text-blue-800" 
                          title="Klik untuk copy">
                        {tag}
                    </span>
                ))}
            </div>
            
            <div className="flex gap-2">
                 <Button variant="outline" size="sm" onClick={inspectTemplate} className="gap-2 bg-white hover:bg-slate-100 text-blue-700 border-blue-300 h-8 text-xs">
                    <Search className="h-3 w-3" />
                    Analisa Template & Cek Variabel
                </Button>
                {!hasStoredTemplate && (
                    <Link to="/dashboard/settings">
                        <Button variant="default" size="sm" className="h-8 text-xs">Upload Template dulu</Button>
                    </Link>
                )}
            </div>
        </div>

            {/* Step 2: Select Data (Now Main Step) */}
            <Card>
                <CardHeader className="pb-3 card-header-compact">
                     <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <CardTitle className="text-base">Pilih Data Penerima SK ({selectedIds.size} dipilih)</CardTitle>
                             <Button variant="ghost" size="icon" title="Refresh Data">
                                <Search className="h-4 w-4" /> {/* Reusing search icon as refresh temporarily or import RefreshCw */}
                            </Button>
                        </div>
                         <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Cari nama..."
                                className="pl-9 w-[250px]"
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setCurrentPage(1); // Reset to page 1 on search
                                }}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border max-h-[500px] overflow-auto">
                        <Table>
                            <TableHeader className="bg-slate-50 sticky top-0 z-10">
                                <TableRow>
                                    <TableHead className="w-[50px]">
                                        <Checkbox 
                                            checked={
                                                currentData.length > 0 && 
                                                currentData.every(t => selectedIds.has(t._id))
                                            }
                                            onCheckedChange={(c) => handleSelectAllForPage(!!c)}
                                        />
                                    </TableHead>
                                    <TableHead>Nama Lengkap</TableHead>
                                    <TableHead>Pendidikan</TableHead>
                                    <TableHead>NIP/NIY</TableHead>
                                    <TableHead>Jabatan</TableHead>
                                    <TableHead>Unit Kerja</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-24 text-center">
                                            <Loader2 className="h-6 w-6 animate-spin mx-auto"/>
                                            <span className="text-xs text-muted-foreground">Memuat data guru...</span>
                                        </TableCell>
                                    </TableRow>
                                ) : currentData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-24 text-center">
                                            {searchTerm ? "Tidak ada data yang cocok dengan pencarian." : "Data kosong. Lakukan input SK atau upload kolektif dulu."}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    currentData.map((t) => (
                                        <TableRow key={t._id} data-state={selectedIds.has(t._id) ? "selected" : ""}  >
                                            <TableCell>
                                                <Checkbox 
                                                    checked={selectedIds.has(t._id)}
                                                    onCheckedChange={(c) => handleSelectOne(t._id, !!c)}
                                                />
                                            </TableCell>
                                            <TableCell className="font-medium">{t.nama}</TableCell>
                                            <TableCell>{t.pendidikanTerakhir || '-'}</TableCell>
                                            <TableCell>{t.nuptk || t.nip || '-'}</TableCell>
                                            <TableCell>{t.mapel || '-'}</TableCell>
                                            <TableCell>{t.unitKerja || (t as any).satminkal || '-'}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    {t.status}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                 <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-6 w-6 text-blue-500 hover:text-blue-700"
                                                    title="Analisa Logika (AI)"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        explainClassification(t)
                                                    }}
                                                 >
                                                    <span className="text-xs font-bold">(?)</span>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination Controls */}
                     <div className="flex items-center justify-end space-x-2 py-4">
                        <div className="flex-1 text-sm text-muted-foreground">
                            Halaman {currentPage} dari {totalPages} ({filteredTeachers.length} data)
                        </div>
                        <div className="space-x-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                            >
                                Sebelumnya
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages || totalPages === 0}
                            >
                                Selanjutnya
                            </Button>
                        </div>
                    </div>

                </CardContent>
            </Card>

            {/* Floating Action Bar for Generation */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white border shadow-lg rounded-full px-6 py-3 flex items-center gap-4 z-50 animate-in slide-in-from-bottom-5">
                    <span className="font-medium">{selectedIds.size} Data Dipilih</span>
                    <Button onClick={handleGenerate} disabled={isGenerating || !hasStoredTemplate}>
                        {isGenerating ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
                        ) : (
                            <><FileDown className="mr-2 h-4 w-4" /> Generate SK Masal</>
                        )}
                    </Button>
                    
                    {isSuperAdmin && (
                        <Button 
                            variant="secondary"
                            className="bg-purple-100 text-purple-700 hover:bg-purple-200"
                            disabled={selectedIds.size === 0 || isGenerating}
                            onClick={handleBulkSign}
                        >
                            <BadgeCheck className="mr-2 h-4 w-4" /> Sign Digital
                        </Button>
                    )}
                </div>
            )}
      </div>
      {/* DIALOG POPUP */}
      <AlertDialog open={dialogState.open} onOpenChange={(open) => setDialogState(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle className={dialogState.isError ? "text-red-600" : "text-green-600"}>
                {dialogState.title}
            </AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line text-slate-700">
                {dialogState.message}
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogAction onClick={() => setDialogState(prev => ({ ...prev, open: false }))} className={dialogState.isError ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}>
                OK, Mengerti
            </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
        </AlertDialog>
    </div>
  )
}
