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
import { FileDown, Loader2, Search, Archive, BadgeCheck, Settings, CheckCircle, RotateCcw, Eye } from "lucide-react"
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
import { toast } from "sonner"

// --- TYPES ---
interface Teacher {
    _id: string;
    _creationTime?: number;
    nama: string;
    nip?: string;
    nuptk?: string;
    jabatan?: string;
    unitKerja?: string;
    status?: string;
    tmt?: string;
    tempatLahir?: string;
    tanggalLahir?: string;
    pendidikanTerakhir?: string;
    pangkat?: string;
    golongan?: string;
    mapel?: string;
    satminkal?: string;
    suratPermohonanUrl?: string | null;
    nomorSk?: string;
    jenisSk?: string;
    statusKepegawaian?: string;
    kecamatan?: string;
    isActive?: boolean;
    createdAt: number;
    updatedAt: number;
    [key: string]: any; 
}

interface CleanupResult {
    teachersDeleted?: number;
    skDeleted?: number;
    draftsDeleted?: number;
    success?: boolean;
}

interface ConvexClientMinimal {
    query: (q: any, args: any) => Promise<any>;
}


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
    binaryString = new Buffer(stringBase64, "base64").toString("binary");
  }
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    const ascii = binaryString.charCodeAt(i);
    bytes[i] = ascii;
  }
  return bytes.buffer;
}

// Helper to load base64 template to binary string
const loadTemplate = (key: string): string | null => {
    const base64 = localStorage.getItem(key + "_blob")
    if (!base64) return null
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
        
        parts[parts.length - 1] = (year + 1).toString()
        return parts.join(" ")
    } catch {
        return dateStr
    }
}


const generateBulkSkZip = async (
  candidates: Teacher[],
  filename = "SK_Masal_Maarif.zip",
  debugData?: unknown,
  convexClient?: ConvexClientMinimal // Injected Convex Client
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
     
    const getTemplateId = (data: Teacher) => {
        try {
            const jenis = (data.jenisSk || data.status || "").toLowerCase()
            const jabatan = (data.jabatan || "").toLowerCase()
            const nip = (data.nip || "").replace(/[^0-9]/g, "")

            if (jenis.includes("tetap yayasan") || jenis.includes("gty")) return "sk_template_gty"
            if (jenis.includes("tidak tetap") || jenis.includes("gtt")) return "sk_template_gtt"
            
            // Complex Kamad Logic
            if (jenis.includes("kepala") || jenis.includes("kamad")) {
                 if (jabatan.includes("plt") || jabatan.includes("pelaksana")) {
                     return "sk_template_kamad_plt"
                 }
                 const isPns = nip.length > 10 || (data.statusKepegawaian || "").includes("PNS") || (data.statusKepegawaian || "").includes("ASN")
                 
                 if (isPns) return "sk_template_kamad_pns"
                 return "sk_template_kamad_nonpns"
            }
            
            return "sk_template_tendik" // Default to Tendik
        } catch (e) {
            console.error("Error determining template ID:", e);
            return "sk_template_tendik";
        }
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
                getImage: function (tagValue: string) {
                    return base64DataURLToArrayBuffer(tagValue);
                },
                 
                getSize: function (img: unknown, _tagValue: string, tagName: string) {
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
                nullGetter: () => {
                     // console.warn("Missing tag:", part.value) 
                     return "" 
                }
            });

            // Format Dates to Indonesian
            const renderData = { ...data };
            
            // Helper for Indo Date
            const months = [
                "Januari", "Februari", "Maret", "April", "Mei", "Juni",
                "Juli", "Agustus", "September", "Oktober", "November", "Desember"
            ];

            const formatIndoDate = (dateStr: string) => {
                if (!dateStr) return "";
                try {
                    const parts = dateStr.split("-");
                    if (parts.length === 3) {
                         const day = parseInt(parts[2]);
                         const month = parseInt(parts[1]) - 1;
                         const year = parseInt(parts[0]);
                         if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                             return `${day} ${months[month]} ${year}`;
                         }
                    }
                    const d = new Date(dateStr);
                    if (!isNaN(d.getTime())) {
                        return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
                    }
                } catch (e) {
                    console.error("Date format error", e);
                }
                return dateStr;
            };

            if (renderData.tanggalLahir) {
                renderData.tanggalLahir = formatIndoDate(renderData.tanggalLahir as string);
                renderData["tanggallahir"] = renderData.tanggalLahir;
            }

            // Proactively format other common date fields
            if (renderData.tmt) {
                 renderData.tmt = formatIndoDate(renderData.tmt as string);
                 renderData["TMT"] = renderData.tmt; // Common uppercase key
            }

            if (renderData.tanggalPenetapan) {
                 renderData.tanggalPenetapan = formatIndoDate(renderData.tanggalPenetapan as string);
            }
            
            // Format CreatedAt / Tanggal SK
            // Priority: createdAt > _creationTime > Now
            const rawCreated = renderData.createdAt || renderData._creationTime;
            
            if (rawCreated) {
                 const d = new Date(rawCreated as string | number);
                 if (!isNaN(d.getTime())) {
                     renderData["tanggal_sk"] = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
                     renderData["Tanggal_SK"] = renderData["tanggal_sk"];
                 }
            } else {
                 // Default to today if missing
                 const d = new Date();
                 renderData["tanggal_sk"] = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
            }

            // Render with QR Code
            doc.render({
                ...renderData,
                qrcode: qrDataUrl // {%qrcode} tag in Docx
            });

            const out = doc.getZip().generate({
                type: "uint8array",
                mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            });

            
            const safeName = (data.nama || "document").replace(/[^a-z0-9]/gi, '_').substring(0, 50)
            folder?.file(`${safeName}_SK.docx`, out)
            successCount++

        } catch (error: unknown) {
            console.error("Gen Error", error)
             
            errors.push(`Gagal generate untuk ${data.nama}: ${(error as Error)?.message || String(error)}`)
        }
    }

    if (errors.length > 0) {
        folder?.file("ERRORS_REPORT.txt", errors.join("\n"))
    }
    
    
    if (successCount === 0 && errors.length > 0) {
        toast.error(`Gagal Generate SK! ${errors[0]}`)
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
    } catch (zipError: unknown) {
        console.error("❌ CRITICAL: ZIP Generation Failed!", zipError)
         
        toast.error(`CRITICAL ERROR: Gagal membuat file ZIP! ${(zipError as any)?.message || String(zipError)}`)
        throw zipError // Re-throw to prevent false success
    }
    
    return { successCount, errorCount: errors.length, errors }
}

// 🔥 CONVEX REAL-TIME
import { useQuery, useMutation } from "convex/react"
import { api as convexApi } from "../../../convex/_generated/api"
// import { toast } from "sonner" // Moved to top

// ... imports
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AlertCircle, Trash2 } from "lucide-react"

export default function SkGeneratorPage() {
  const convex = useConvex()
  
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [token, setToken] = useState<string | undefined>(undefined)

  useEffect(() => {
        const u = localStorage.getItem("user")
        const t = localStorage.getItem("token")
        if (t) setToken(t)
        
        if (u) {
            const user = JSON.parse(u)
            setCurrentUser(user)
            setIsSuperAdmin(user.role === "super_admin")
        }
  }, [])

  const teachersDataRaw = useQuery(convexApi.sk.getTeachersWithSk, {
      userRole: currentUser?.role,
      userUnit: currentUser?.unit || currentUser?.unitKerja,
      token: token
  })
  const isQueryLoading = teachersDataRaw === undefined
  const teachersData = (teachersDataRaw || []) as Teacher[]


  // MUTATIONS
  const createSk = useMutation(convexApi.sk.create)
  // Unused mutations removed
  const markAsGenerated = useMutation(convexApi.sk.markTeacherAsGenerated) 
  // FIXED: Add CleanSK hook for Smart Reset
  const cleanSk = useMutation(convexApi.cleanup.cleanSk)

  
  // MODAL STATES
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showHistoryConfirm, setShowHistoryConfirm] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)

  const [successCount, setSuccessCount] = useState(0)

  // TEXT RESULT MODAL (For Inspector & Explainer)
  const [textResultOpen, setTextResultOpen] = useState(false)
  const [textResultTitle, setTextResultTitle] = useState("")
  const [textResultContent, setTextResultContent] = useState("")

  const showTextResult = (title: string, content: string) => {
      setTextResultTitle(title)
      setTextResultContent(content)
      setTextResultOpen(true)
  }

  // RESTORED STATES
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [hasStoredTemplate, setHasStoredTemplate] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
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

  // Auto-fill Surat Permohonan fields based on selection
  useEffect(() => {
    if (selectedIds.size > 0 && teachersData.length > 0) {
      // Find the first selected teacher with valid surat permohonan data
      const selectedTeachers = teachersData.filter(t => selectedIds.has(t._id));
      const teacherWithSurat = selectedTeachers.find(t => t.nomorSuratPermohonan || t.tanggalSuratPermohonan);

      if (teacherWithSurat) {
        if (teacherWithSurat.nomorSuratPermohonan && !nomorSuratMasuk) {
            setNomorSuratMasuk(teacherWithSurat.nomorSuratPermohonan);
        }
        if (teacherWithSurat.tanggalSuratPermohonan && !tanggalSuratMasuk) {
            setTanggalSuratMasuk(teacherWithSurat.tanggalSuratPermohonan);
        }
      }
    }
  }, [selectedIds, teachersData]);

    const handleReset = async () => {
        // TRIGGER MODAL INSTEAD OF NATIVE CONFIRM
        setShowResetConfirm(true)
    }

    const performReset = async () => {
        setIsLoading(true)
        try {
            // Delete Teachers (Candidates), Keep SK
             
            const res = await cleanSk({ deleteTeachers: true, deleteSk: false }) as CleanupResult
            toast.success(`Selesai! Dihapus: ${res.teachersDeleted} data guru.`)
            setTimeout(() => window.location.reload(), 1000)
        } catch (e) {
            console.error(e)
             
            const errMsg = (e as any)?.message || String(e)
            toast.error("Gagal reset data: " + errMsg)
        } finally {
            setIsLoading(false)
            setShowResetConfirm(false)
        }
    }

  const handleResetSkHistoryOnly = async () => {
        // TRIGGER MODAL INSTEAD OF NATIVE CONFIRM
        setShowHistoryConfirm(true)
  }

  const performResetHistory = async () => {
    setIsLoading(true)
    try {
        // Delete SK, Keep Teachers
         
        const res: any = await cleanSk({ deleteTeachers: false, deleteSk: true })
        setNomorMulai("0001") // Reset Counter
        toast.success(`✅ Berhasil reset ${res.skDeleted} Riwayat SK.`)
        setTimeout(() => window.location.reload(), 1000)
    } catch (e) {
         toast.error("Gagal hapus history: " + e)
    } finally {
        setIsLoading(false)
        setShowHistoryConfirm(false)
    }
  }


  
  // Teachers loaded via Convex useQuery (real-time, no need for manual fetch)
  
  // 🔥 FETCH LAST SK NUMBER FOR AUTO-INCREMENT
  const lastSkNumber = useQuery(convexApi.sk.getLastSkNumber)

  useEffect(() => {
    if (lastSkNumber) {
        // Try to parse the sequence number from formats like "0045/PC.L..."
        // Look for the first 4 digits
        const match = lastSkNumber.match(/^(\d{4})/);
        if (match) {
            const lastSeq = parseInt(match[1]);
            if (!isNaN(lastSeq)) {
                // Auto-increment by 1
                const nextSeq = String(lastSeq + 1).padStart(4, '0');
                setNomorMulai(nextSeq);
                toast.info(`Nomor SK otomatis dilanjutkan ke: ${nextSeq}`);
            }
        }
    }
  }, [lastSkNumber])
  
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
  ).sort((a, b) => ((b.updatedAt || b.createdAt || 0) as number) - ((a.updatedAt || a.createdAt || 0) as number)) // Sort Recently Updated First

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

  

  
  const handleBulkSign = () => {
      // Stub for future bulk sign action
      toast.info(`Menandatangani ${selectedIds.size} SK secara digital (Simulasi)...`)
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
          toast.error("Tidak ada template yang tersimpan. Upload dulu!")
          return
      }

      try {
          const zip = new PizZip(content)
          const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true })
          const text = doc.getFullText()
          // Robust Regex: Matches {VAR}, {{VAR}}, { VAR }, {Variable Name}
          const matchedTags = text.match(/\{{1,2}[^{}\n\r]+\}{1,2}/g) || []
          
          // Clean tags: remove braces and trim whitespace
          const uniqueTags = Array.from(new Set(matchedTags.map(t => t.replace(/[{}]/g, '').trim())))

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
          
          const found: string[] = []
          const missing: string[] = []

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
              showTextResult("Analisa Template: GAGAL", msg)
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

          showTextResult("Hasil Analisa Template", msg)

      } catch (e: unknown) {
           
          const errMsg = (e as any)?.message || String(e)
          toast.error("Error Analisa: " + errMsg)
      }
  }

  // Duplicate handleGenerate removed


  // --- SMART LOGIC: Explain Classification ---
   
  const explainClassification = (t: Teacher) => {
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
          showTextResult("Analisa Logika SK (AI)", log)
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
      
      showTextResult("Analisa Logika SK (AI)", log)
  }

  // --- HELPER: Parse Date Robustly ---
   
  const parseIndonesianDate = (dateStr: unknown): Date | null => {
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
      const parts = str.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/)
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
      const txtParts = str.split(/[\s-/]+/)
      
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
    if (selectedIds.size === 0) {
        toast.warning("Pilih minimal satu data guru.")
        return
    }

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
      const tanggalSuratMasukFormatted = parseIndonesianDate(tanggalSuratMasuk) 
            ? parseIndonesianDate(tanggalSuratMasuk)!.toLocaleDateString('id-ID', {day: '2-digit', month: 'long', year: 'numeric'})
            : (tanggalSuratMasuk || "-")
      // Map teacher data to template keys clearly
      const mappedData = selectedData.map((t, idx) => {
               
              const derivedJenisSk = determineJenisSk(t.pendidikanTerakhir || "", t.tmt || "", t.nama || "", t.jabatan || "", t.status)
              // 2. Parse TMT (Tanggal Mulai Tugas)
              const tmtDate = parseIndonesianDate(String(t.tmt || ""))
              // let masaKerjaTahun = 0 // Unused
              const tmtFormatted = tmtDate 
                ? tmtDate.toLocaleDateString('id-ID', {day: '2-digit', month: 'long', year: 'numeric'}) 
                : (t.tmt || '-')

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

      for (const item of mappedData) {
          try {
              // Create SK in DB
              const skId = await createSk({
                  jenisSk: item.jenisSk,
                  status: "active",
                  nama: item.nama,
                   
                  teacherId: (item as any)._id, // Original Teacher ID
                  jabatan: item.JABATAN,
                  // IMPROVED: Fallback to Current User's Unit if Teacher's unit is missing
                  unitKerja: item.UNIT_KERJA !== '-' ? item.UNIT_KERJA : (currentUser?.unitKerja || "LP Maarif NU Cilacap"),
                  nomorSk: item.NOMOR_SURAT,
                  tanggalPenetapan: item.TANGGAL_PENETAPAN,
                  fileUrl: "Generated via Bulk ZIP",
                  createdBy: "System",
                  token: token, // Pass token from state
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

          } catch (err: unknown) {
              console.error("Failed to archive SK:", item.nama, err)
               
              const errMsg = (err as any)?.message || String(err)
              // If archive fails, we probably shouldn't generate the file? 
              // Or maybe generate but with invalid QR? 
              // Better to skip to ensure consistency.
              toast.error(`Gagal menyimpan data untuk ${item.nama}: ${errMsg}`)
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
           
           // Show Success Modal
           setSuccessCount(res.successCount)
           
           if (res.errorCount > 0) {
               toast.warning(`Selesai dengan ${res.errorCount} kesalahan. Cek log konsol atau coba lagi untuk data yang gagal.`)
           }
           
           setShowSuccessModal(true)
       } else if (res.errorCount > 0) {
           toast.error(`Gagal membuat dokumen: ${res.errors[0]}`)
       }
       
       setIsGenerating(false)
     } catch (e) {
        console.error("❌ Critical Gen Error:", e)
         
        const errMsg = (e as any)?.message || String(e)
        toast.error(`Terjadi kesalahan sistem saat generate! ${errMsg}`)
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
                            variant="outline" 
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
                        <div className="flex gap-1">
                            <Input 
                                value={nomorSuratMasuk}
                                onChange={e => setNomorSuratMasuk(e.target.value)}
                                placeholder="Contoh: 005/MWC/..."
                                className="bg-white"
                            />
                            {/* VIEW LETTER BUTTON */}
                            {(() => {
                                 
                                const url = teachersData?.find((t: any) => selectedIds.has(t._id) && t.suratPermohonanUrl)?.suratPermohonanUrl
                                return (
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        type="button"
                                        disabled={!url}
                                        title={url ? "Lihat Surat Permohonan (Preview)" : "Pilih salah satu guru ditabel bawah untuk melihat surat"}
                                        onClick={() => url && window.open(url, '_blank')}
                                        className="bg-white hover:bg-blue-50 text-blue-600 border-blue-200"
                                    >
                                        <Eye className="h-4 w-4" />
                                    </Button>
                                )
                            })()}
                        </div>
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
                        onClick={() => {navigator.clipboard.writeText(tag); toast.success(`Copied: ${tag}`)}}
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
                                {isQueryLoading || isLoading ? (
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
                                            { }
                                            <TableCell>{t.unitKerja || t.satminkal || '-'}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    {t.status}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                 <div className="flex gap-1">
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

                                                { }
                                                {(t as any).suratPermohonanUrl && (
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-6 w-6 text-orange-500 hover:text-orange-700"
                                                        title="Lihat Surat Permohonan"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                             
                                                            window.open((t as any).suratPermohonanUrl, '_blank')
                                                        }}
                                                    >
                                                        <FileDown className="h-4 w-4" />
                                                    </Button>
                                                )}
                                                </div>
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

      {/* --- ESTETIK MODALS (Using Dialog because AlertDialog component is missing) --- */}
      
      {/* 1. RESET DATA CANDIDATE */}
      <Dialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 text-red-600 mb-2">
                <Trash2 className="h-6 w-6" />
                <DialogTitle className="text-xl">Konfirmasi Hapus</DialogTitle>
            </div>
            <DialogDescription className="text-base text-slate-700">
              Yakin ingin menghapus <b>SEMUA Data Calon Guru</b> di halaman ini?
              <br /><br />
              <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-800 flex gap-2 items-start">
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                      <strong>Perhatian:</strong>
                      <ul className="list-disc ml-4 mt-1 space-y-1">
                          <li>Data Guru (Master) <b>TETAP AMAN</b>.</li>
                          <li>Data Pengajuan akan <b>DIHAPUS</b> dari antrean.</li>
                          <li>Gunakan ini jika upload Excel anda salah/double.</li>
                      </ul>
                  </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowResetConfirm(false)} disabled={isLoading}>
                Batal
            </Button>
            <Button 
                onClick={(e) => { e.preventDefault(); performReset(); }}
                className="bg-red-600 hover:bg-red-700 text-white"
                disabled={isLoading}
            >
                {isLoading ? "Menghapus..." : "Ya, Hapus Semua"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* 3. SUCCESS GENERATION MODAL */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="max-w-md text-center">
            <div className="flex flex-col items-center justify-center py-6 gap-4">
            <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-2">
                <CheckCircle className="h-10 w-10" />
            </div>
            <DialogTitle className="text-2xl font-bold text-green-700">Selesai!</DialogTitle>
            <div className="text-slate-600">
                Berhasil membuat <b>{successCount} SK</b>.
                <br/>
                File SK sudah otomatis terunduh (ZIP).
                <br/>
                Data SK juga sudah tersimpan di database.
            </div>
            <Button className="w-full mt-4 bg-green-600 hover:bg-green-700" onClick={() => setShowSuccessModal(false)}>
                Tutup & Lanjutkan
            </Button>
            </div>
        </DialogContent>
      </Dialog>
      <Dialog open={showHistoryConfirm} onOpenChange={setShowHistoryConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 text-amber-600 mb-2">
                <AlertCircle className="h-6 w-6" />
                <DialogTitle className="text-xl">Reset Riwayat SK</DialogTitle>
            </div>
            <DialogDescription className="text-base text-slate-700">
              Yakin ingin menghapus <b>SEMUA Riwayat SK</b> yang sudah terbit?
              <br /><br />
              <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800">
                  ⚠️ <b>Nomor SK akan di-reset kembali ke 0001.</b>
                  <br/>
                  Pastikan anda sudah mem-backup/download SK penting sebelumnya.
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2 sm:gap-0">
             <Button variant="outline" onClick={() => setShowHistoryConfirm(false)} disabled={isLoading}>
                Batal
            </Button>
            <Button 
                onClick={(e) => { e.preventDefault(); performResetHistory(); }}
                className="bg-amber-600 hover:bg-amber-700 text-white"
                disabled={isLoading}
            >
                {isLoading ? "Mereset..." : "Ya, Reset History"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* 4. TEXT RESULT MODAL (LOGS/INSPECTOR) */}
      <Dialog open={textResultOpen} onOpenChange={setTextResultOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
                <Search className="h-5 w-5 text-blue-600" />
                {textResultTitle}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto bg-slate-50 p-4 rounded-md border text-sm font-mono whitespace-pre-wrap">
              {textResultContent}
          </div>
          <DialogFooter>
            <Button onClick={() => setTextResultOpen(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      </div>
    </div>
  )
}
