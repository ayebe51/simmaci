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
import { FileDown, Loader2, Search, Archive, BadgeCheck, Settings, CheckCircle, RotateCcw, Eye, Trash2, AlertCircle } from "lucide-react"
import { useState, useEffect, useMemo } from "react"
import JSZip from "jszip"
import PizZip from "pizzip"
import Docxtemplater from "docxtemplater"
import { Link } from "react-router-dom"
import ImageModule from "docxtemplater-image-module-free"
import QRCode from "qrcode"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { skApi, teacherApi, authApi } from "@/lib/api"
import { useSkTemplate } from "@/features/sk-management/hooks/useSkTemplate"
import { calculatePeriode } from "@/features/sk-management/utils/calculatePeriode"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// --- TYPES ---
interface TeacherCandidate {
    id: number;
    nama: string;
    nip?: string;
    nuptk?: string;
    jabatan?: string;
    unit_kerja?: string;
    status?: string;
    tmt?: string;
    tempat_lahir?: string;
    tanggal_lahir?: string;
    pendidikan_terakhir?: string;
    pangkat?: string;
    golongan?: string;
    mapel?: string;
    kecamatan?: string;
    status_kepegawaian?: string;
    [key: string]: any; 
}

// Helper: Convert Base64 DataURL to ArrayBuffer (Required by ImageModule)
function base64DataURLToArrayBuffer(dataURL: string) {
  const base64Regex = /^data:image\/(png|jpg|svg|svg\+xml);base64,/;
  if (!base64Regex.test(dataURL)) return false;
  const stringBase64 = dataURL.replace(base64Regex, "");
  let binaryString;
  if (typeof window !== "undefined") {
    binaryString = window.atob(stringBase64);
  } else {
    binaryString = Buffer.from(stringBase64, "base64").toString("binary");
  }
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Helper to Roman Numerals
const toRoman = (num: number): string => {
    const roman = {M:1000,CM:900,D:500,CD:400,C:100,XC:90,L:50,XL:40,X:10,IX:9,V:5,IV:4,I:1}
    let str = '', i
    for ( i in roman ) {
        while ( num >= (roman as any)[i] ) {
            str += i
            num -= (roman as any)[i]
        }
    }
    return str
}

export default function SkGeneratorPage() {
  const queryClient = useQueryClient()
  const user = authApi.getStoredUser()
  const isSuperAdmin = ["super_admin", "admin_yayasan", "admin"].includes(user?.role)

  const [searchTerm, setSearchTerm] = useState("")
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [isGenerating, setIsGenerating] = useState(false)
  
  // Settings States
  const [nomorMulai, setNomorMulai] = useState("0001")
  const [nomorFormat, setNomorFormat] = useState("{NOMOR}/PC.L/A.II/H-34.B/24.29/{PERIODE}/{BULAN}/{TAHUN}")
  const [tanggalPenetapan, setTanggalPenetapan] = useState(() => new Date().toISOString().split('T')[0])
  const [nomorSuratMasuk, setNomorSuratMasuk] = useState("")
  const [tanggalSuratMasuk, setTanggalSuratMasuk] = useState("")
  const [combineInOneFile, setCombineInOneFile] = useState(false)
  const [tahunAjaran, setTahunAjaran] = useState(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth() + 1 // 1–12
    return m >= 7 ? `${y}/${y + 1}` : `${y - 1}/${y}`
  })

  const [defaultKecamatan, setDefaultKecamatan] = useState("")

  // 🔥 SK Template hooks — resolved once per session via TanStack Query cache
  const skTemplateGty = useSkTemplate('gty')
  const skTemplateGtt = useSkTemplate('gtt')
  const skTemplateKamad = useSkTemplate('kamad')
  const skTemplateTendik = useSkTemplate('tendik')

  const skTemplateByType: Record<string, ReturnType<typeof useSkTemplate>> = {
    sk_template_gty: skTemplateGty,
    sk_template_gtt: skTemplateGtt,
    sk_template_kamad: skTemplateKamad,
    sk_template_tendik: skTemplateTendik,
  }

  // 🔥 REST API QUERIES
  
  // 1. SK Request Candidates (Pending SkDocuments)
  const { data: candidatesData, isLoading: isCandidatesLoading } = useQuery({
    queryKey: ['sk-candidates-generator', searchTerm, page],
    queryFn: () => skApi.list({
      status: 'pending',
      search: searchTerm,
      page: page,
      per_page: 10
    })
  })

  // 2. Last SK Number for Auto-Increment
  const { data: lastSkData } = useQuery({
    queryKey: ['last-sk-number'],
    queryFn: () => skApi.list({ per_page: 1 })
  })

  useEffect(() => {
    if (lastSkData?.data?.[0]?.nomor_sk) {
        // Regex to match the starting sequence of the SK number (e.g., REQ/2026/0001 -> 0001)
        // Or specific formats like 0001/PC.L/...
        const match = lastSkData.data[0].nomor_sk.match(/^(\d+)/) || lastSkData.data[0].nomor_sk.match(/REQ\/\d+\/(\d+)/);
        if (match) {
            const next = String(parseInt(match[1]) + 1).padStart(4, '0');
            setNomorMulai(next);
        }
    }
  }, [lastSkData])

  // Mutations
  const updateSkMutation = useMutation({
    mutationFn: ({ id, data }: { id: number, data: any }) => skApi.update(id, data)
  })

  const markVerifiedMutation = useMutation({
    mutationFn: (id: number) => teacherApi.update(id, { is_verified: true })
  })

  // Bulk Generation Logic
  const handleGenerate = async () => {
    if (selectedIds.size === 0) {
        toast.warning("Pilih minimal satu data guru.")
        return
    }

    setIsGenerating(true)
    try {
        const selectedTeachers = (candidatesData?.data || []).filter((t: any) => selectedIds.has(t.id))
        const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]
        const dateObj = new Date()
        const dd = String(dateObj.getDate()).padStart(2, '0')
        const mmRoma = toRoman(dateObj.getMonth() + 1)
        const yyyy = dateObj.getFullYear()

        const allItemsByGroup: Record<string, any[]> = {}
        const masterBuffersByGroup: Record<string, ArrayBuffer> = {}
        // Template buffers fetched from resolved URLs (useSkTemplate hook provides the URL)
        const templateCache: Record<string, any> = {}

        const templateIdMapping: Record<string, string> = {
            'sk_template_gty': 'Guru_Tetap_Yayasan',
            'sk_template_gtt': 'Guru_Tidak_Tetap',
            'sk_template_kamad': 'Kepala_Madrasah',
            'sk_template_tendik': 'Tenaga_Kependidikan'
        }

        // Custom parser to handle spaces inside braces { NAMA } -> {NAMA}
        const customParser = (tag: string) => {
            const cleanTag = tag.replace(/^[%#/]/, "").trim().toLowerCase();
            return {
                get(scope: any) {
                    if (cleanTag === ".") return scope;
                    
                    // Look through all keys in a case-insensitive way
                    for (const k in scope) {
                        if (k.toLowerCase() === cleanTag) return scope[k];
                    }
                    return ""; 
                }
            };
        };

        const zip = new JSZip()
        const folder = zip.folder("SK_Generated")

        const tglPenetapanVal = tanggalPenetapan ? new Date(tanggalPenetapan) : new Date()

        for (let i = 0; i < selectedTeachers.length; i++) {
            const t = selectedTeachers[i]
            const teacher = t.teacher || {}
            
            // 1. Determine Template - Prioritize status, fallback to jenis_sk
            const teacherStatus = (teacher.status || "").toLowerCase();
            const jenis = (t.jenis_sk || "").toLowerCase()
            
            let templateId = "sk_template_tendik" // Default
            
            if (teacherStatus.includes("gty") || teacherStatus.includes("tetap yayasan") || 
                jenis.includes("gty") || jenis.includes("tetap yayasan")) {
                templateId = "sk_template_gty"
            } else if (teacherStatus.includes("gtt") || teacherStatus.includes("tidak tetap") || 
                       jenis.includes("gtt") || jenis.includes("tidak tetap") || 
                       jenis.includes("tidak tetap") || teacherStatus.includes("guru")) {
                templateId = "sk_template_gtt"
            } else if (teacherStatus.includes("kamad") || teacherStatus.includes("kepala") || 
                       jenis.includes("kamad") || jenis.includes("kepala")) {
                templateId = "sk_template_kamad"
            }
            
            // 2. Fetch Template if not cached
            if (!templateCache[templateId]) {
                const hookResult = skTemplateByType[templateId]
                if (hookResult?.error) {
                    toast.error(hookResult.error)
                    continue
                }
                const templateUrl = hookResult?.templateUrl
                if (!templateUrl) {
                    toast.error(`Template ${templateId} tidak tersedia.`)
                    continue
                }
                const resp = await fetch(templateUrl)
                if (!resp.ok) throw new Error(`Gagal mengunduh template: ${templateId}`)
                const arrayBuffer = await resp.arrayBuffer()
                const bytes = new Uint8Array(arrayBuffer)
                let binary = ''
                for (let b = 0; b < bytes.byteLength; b++) {
                    binary += String.fromCharCode(bytes[b])
                }
                templateCache[templateId] = { binary, buffer: arrayBuffer }
            }
            
            const cached = templateCache[templateId]
            if (!cached) {
                toast.error(`Template ${templateId} tidak ditemukan.`)
                continue
            }

            // 3. Prepare Mapping Data
            const currentSeq = (parseInt(nomorMulai) || 1) + i
            const seqStr = String(currentSeq).padStart(4, '0')

            const tmtRaw = t.tmt || teacher.tmt
            if (!tmtRaw) {
                console.error(`TMT tidak ditemukan untuk guru: ${teacher.nama || t.nama}`)
                continue
            }
            const periodeValue = calculatePeriode(tmtRaw, tglPenetapanVal)
            const periodeStr = String(periodeValue)

            const generatedNomor = nomorFormat
                .replace(/{NOMOR}/g, seqStr)
                .replace(/{PERIODE}/g, templateId !== "sk_template_kamad" ? periodeStr : "")
                .replace(/{BULAN}/g, String(dateObj.getMonth() + 1))
                .replace(/{BL_ROMA}/g, mmRoma)
                .replace(/{TAHUN}/g, String(yyyy))

            const verificationUrl = `${window.location.origin}/verify/sk/${generatedNomor}`
            const qrCodeData = await QRCode.toDataURL(verificationUrl, { width: 400, margin: 1 })

             const formatDateIndo = (dateStr: any) => {
                if (!dateStr) return "-"
                try {
                    const indos = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]
                    
                    // 1. If it already contains Indonesian month names, return as is
                    if (typeof dateStr === 'string' && indos.some(m => dateStr.includes(m))) {
                        return dateStr
                    }

                    // 2. Handle YYYY-MM-DD specifically (common from DB/Excel)
                    if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                        const [y, m, d] = dateStr.split('-')
                        const mIdx = parseInt(m) - 1
                        if (mIdx >= 0 && mIdx < 12) {
                            return `${parseInt(d)} ${indos[mIdx]} ${y}`
                        }
                    }

                    // 3. Handle DD/MM/YYYY or DD-MM-YYYY
                    if (typeof dateStr === 'string') {
                        const directMatch = dateStr.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
                        if (directMatch) {
                            const d = directMatch[1].padStart(2, '0')
                            const mIdx = parseInt(directMatch[2]) - 1
                            const y = directMatch[3]
                            if (mIdx >= 0 && mIdx < 12) return `${parseInt(d)} ${indos[mIdx]} ${y}`
                        }
                    }

                    // 4. Fallback to native Date
                    const d = new Date(dateStr)
                    if (isNaN(d.getTime())) return dateStr

                    const day = d.getDate()
                    const month = indos[d.getMonth()]
                    const year = d.getFullYear()
                    return `${day} ${month} ${year}`
                } catch {
                    return dateStr
                }
            }

            const identity = {
                nama: t.nama || teacher.nama,
                tempat_lahir: t.tempat_lahir || teacher.tempat_lahir,
                tanggal_lahir: formatDateIndo(t.tanggal_lahir || teacher.tanggal_lahir),
                pendidikan_terakhir: t.pendidikan_terakhir || teacher.pendidikan_terakhir,
                unit_kerja: t.unit_kerja || teacher.unit_kerja,
                tmt: formatDateIndo(t.tmt || teacher.tmt),
                tanggal_mulai_tugas: formatDateIndo(t.tmt || teacher.tmt),
                nomor_induk_maarif: t.nomor_induk_maarif || teacher.nomor_induk_maarif || t.nip || teacher.nip || "-",
                kecamatan: t.kecamatan || teacher.kecamatan || defaultKecamatan
            }

            const birthDateStr = identity.tanggal_lahir || "-"
            const tempatTglLahir = (identity.tempat_lahir || "") + (birthDateStr !== "-" ? ", " + birthDateStr : "")

            const tglBerakhirVal = new Date(tglPenetapanVal)
            tglBerakhirVal.setFullYear(tglBerakhirVal.getFullYear() + 1)
            tglBerakhirVal.setDate(tglBerakhirVal.getDate() - 1)

            const renderData: any = {
                ...teacher,
                ...t,
                ...identity,
                nomor_sk: generatedNomor,
                "NOMOR": seqStr,
                "TANGGAL": dd,
                "BULAN": String(dateObj.getMonth() + 1),
                "TAHUN": String(yyyy),
                "BL_ROMA": mmRoma,
                "NAMA": identity.nama,
                "UNIT KERJA": identity.unit_kerja || "-",
                "NOMOR INDUK MAARIF": identity.nomor_induk_maarif,
                "NOMOR INDUK MA'ARIF": identity.nomor_induk_maarif,
                "NOMOR_INDUK_MAARIF": identity.nomor_induk_maarif,
                "NIM": identity.nomor_induk_maarif,
                "TEMPAT/TANGGAL LAHIR": tempatTglLahir,
                "PENDIDIKAN": identity.pendidikan_terakhir || "-",
                "Pendidikan": identity.pendidikan_terakhir || "-",
                "TMT": identity.tmt,
                "TMT GURU": identity.tmt,
                "TANGGAL MULAI TUGAS": identity.tmt,
                "TANGGAL_MULAI_TUGAS": identity.tmt,
                "tanggal_mulai_tugas": identity.tmt,
                "TANGGAL PENETAPAN": formatDateIndo(tanggalPenetapan),
                "TAHUN PELAJARAN": tahunAjaran,
                "TANGGAL LENGKAP": formatDateIndo(tanggalPenetapan),
                "TANGGAL_BERAKHIR": formatDateIndo(tglBerakhirVal.toISOString()),
                "NOMOR SURAT PERMOHONAN": t.nomor_permohonan || t.nomor_surat_permohonan || teacher.nomor_permohonan || nomorSuratMasuk || "-",
                "TANGGAL SURAT PERMOHONAN": formatDateIndo(t.tanggal_permohonan || t.tanggal_surat_permohonan || teacher.tanggal_permohonan || tanggalSuratMasuk),
                "KECAMATAN": identity.kecamatan || "-",
                "qrcode": qrCodeData,
                "image": qrCodeData,
                "PERIODE": templateId !== "sk_template_kamad" ? periodeStr : ""
            }

            if (combineInOneFile) {
                if (!allItemsByGroup[templateId]) {
                    allItemsByGroup[templateId] = []
                    masterBuffersByGroup[templateId] = cached.buffer
                }
                allItemsByGroup[templateId].push(renderData)
            } else {
                const pzip = new PizZip(cached.binary)
                const doc = new Docxtemplater(pzip, {
                    paragraphLoop: true,
                    linebreaks: true,
                    parser: customParser,
                    modules: [new ImageModule({
                        getImage: (tag: string) => base64DataURLToArrayBuffer(tag),
                        getSize: () => [120, 120]
                    })],
                    nullGetter: () => ""
                })

                doc.render(renderData)
                const out = doc.getZip().generate({ type: "uint8array" })
                folder?.file(`${(teacher.nama || t.nama).replace(/\s+/g, '_')}_SK.docx`, out)
            }

            // Sync to Backend
            try {
                await updateSkMutation.mutateAsync({
                    id: t.id,
                    data: {
                        nomor_sk: generatedNomor,
                        status: "approved",
                        tanggal_penetapan: formatDateIndo(tanggalPenetapan),
                        tahun_ajaran: tahunAjaran,
                        file_url: combineInOneFile ? "Generated via Bulk (Collective Group)" : "Generated via Bulk (ZIP)"
                    }
                })
                if (t.teacher_id) await markVerifiedMutation.mutateAsync(t.teacher_id)
            } catch (err) {}
        }

        if (combineInOneFile) {
            const groupIds = Object.keys(allItemsByGroup)
            for (const tId of groupIds) {
                const groupItems = allItemsByGroup[tId]
                const masterBuffer = masterBuffersByGroup[tId]
                if (!masterBuffer) continue

                const collectivePzip = new PizZip(masterBuffer)
                let docXml = collectivePzip.file("word/document.xml").asText()
                
                const bodyMatch = docXml.match(/<w:body>(.*?)<\/w:body>/s)
                if (bodyMatch) {
                    let bodyInner = bodyMatch[1].trim()
                    
                    let sectPr = ""
                    const sectMatch = bodyInner.match(/(<w:sectPr.*?>.*?<\/w:sectPr>)$/s)
                    if (sectMatch) {
                        sectPr = sectMatch[1]
                        bodyInner = bodyInner.substring(0, bodyInner.length - sectPr.length).trim()
                    }

                    const startLoopParagraph = '<w:p><w:r><w:t>{#items}</w:t></w:r></w:p>'
                    const pageBreakParagraph = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'
                    const endLoopParagraph = '<w:p><w:r><w:t>{/items}</w:t></w:r></w:p>'
                    
                    const newBodyXml = `<w:body>${startLoopParagraph}${bodyInner}${pageBreakParagraph}${endLoopParagraph}${sectPr}</w:body>`
                    docXml = docXml.replace(/<w:body>.*?<\/w:body>/s, () => newBodyXml)
                    
                    collectivePzip.file("word/document.xml", docXml)

                    const doc = new Docxtemplater(collectivePzip, {
                        paragraphLoop: true,
                        linebreaks: true,
                        parser: customParser,
                        modules: [new ImageModule({
                            getImage: (tag: string) => base64DataURLToArrayBuffer(tag),
                            getSize: () => [120, 120]
                        })],
                        nullGetter: () => ""
                    })

                    doc.render({ items: groupItems })
                    const finalOut = doc.getZip().generate({ type: "blob" })
                    const groupLabel = templateIdMapping[tId] || tId.replace('sk_template_', '')
                    const fileName = `SK_Kolektif_${groupLabel}_${new Date().getTime()}.docx`

                    if (groupIds.length > 1) {
                        folder?.file(fileName, finalOut)
                    } else {
                        saveAs(finalOut, fileName)
                    }
                }
            }

            if (groupIds.length > 1) {
                const zipBlob = await zip.generateAsync({ type: "blob" })
                saveAs(zipBlob, `SK_Kolektif_GABUNGAN_${new Date().getTime()}.zip`)
            }
        } else {
            const zipBlob = await zip.generateAsync({ type: "blob" })
            saveAs(zipBlob, `SK_Generated_TERPISAH_${new Date().getTime()}.zip`)
        }
        toast.success("Berhasil generate SK.")
        queryClient.invalidateQueries({ queryKey: ['sk-candidates-generator'] })
        setSelectedIds(new Set())
    } catch (error: any) {
        console.error(error)
        toast.error("Gagal generate SK: " + (error.message || "Unknown error"))
    } finally {
        setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
            <h1 className="text-3xl font-black tracking-tight text-blue-900 uppercase">Generator SK Masal</h1>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Penerbitan Dokumen SK secara kolektif untuk Madrasah</p>
        </div>
        <div className="flex gap-2">
             <Button variant="outline" asChild className="rounded-xl font-bold uppercase text-xs">
                <Link to="/dashboard/settings">
                    <Settings className="mr-2 h-4 w-4" /> Atur Template
                </Link>
            </Button>
        </div>
      </div>

      <Card className="border-0 shadow-sm bg-white rounded-[2.5rem] overflow-hidden">
        <CardHeader className="p-8 border-b bg-slate-50/50">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Nomor Urut Mulai</label>
                    <div className="flex gap-2">
                        <Input value={nomorMulai} onChange={e => setNomorMulai(e.target.value)} className="h-11 rounded-xl bg-white border-slate-200" />
                        <Button variant="outline" size="icon" onClick={() => setNomorMulai("0001")} className="h-11 w-11 rounded-xl text-slate-400"><RotateCcw className="h-4 w-4"/></Button>
                    </div>
                </div>
                <div className="space-y-2 lg:col-span-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Format Nomor SK</label>
                    <Input value={nomorFormat} onChange={e => setNomorFormat(e.target.value)} className="h-11 rounded-xl bg-white border-slate-200" />
                    <p className="text-[10px] text-slate-400">
                        Placeholder: <code>{"{NOMOR}"}</code> urutan, <code>{"{PERIODE}"}</code> tahun masa kerja dari TMT,{" "}
                        <code>{"{BULAN}"}</code> bulan, <code>{"{BL_ROMA}"}</code> bulan romawi, <code>{"{TAHUN}"}</code> tahun
                    </p>
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Tahun Ajaran</label>
                    <Input value={tahunAjaran} onChange={e => setTahunAjaran(e.target.value)} className="h-11 rounded-xl bg-white border-slate-200" />
                </div>
                <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Output</label>
                    <div className="flex items-center space-x-2 h-11">
                        <Checkbox 
                            id="combine" 
                            checked={combineInOneFile} 
                            onCheckedChange={(val) => setCombineInOneFile(!!val)} 
                        />
                        <label htmlFor="combine" className="text-xs font-bold text-slate-600 cursor-pointer select-none">Gabung dalam 1 file Word</label>
                    </div>
                </div>
            </div>
        </CardHeader>
        <CardContent className="p-0">
            <div className="p-8 flex items-center justify-between border-b border-slate-50">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-600 h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black text-white">2</div>
                    <h3 className="text-sm font-bold text-slate-700">Pilih Calon Penerima SK ({selectedIds.size})</h3>
                </div>
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                    <Input placeholder="Cari nama..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 h-10 border-slate-200 rounded-xl text-xs" />
                </div>
            </div>

            <Table>
                <TableHeader className="bg-slate-50/50">
                    <TableRow className="hover:bg-transparent border-slate-100">
                        <TableHead className="w-12 pl-8">
                            <Checkbox 
                                checked={candidatesData?.data?.length > 0 && selectedIds.size === candidatesData.data.length}
                                onCheckedChange={(c) => {
                                    if(c) setSelectedIds(new Set(candidatesData.data.map((t: any) => t.id)))
                                    else setSelectedIds(new Set())
                                }}
                            />
                        </TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-widest py-5">Nama Lengkap</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-widest py-5">Jenis SK</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-widest py-5">Unit Kerja</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-widest py-5">Jabatan</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-widest py-5 text-right pr-8">Surat Permohonan</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isCandidatesLoading ? (
                        <TableRow><TableCell colSpan={6} className="h-32 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500"/></TableCell></TableRow>
                    ) : candidatesData?.data?.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="h-40 text-center opacity-30 text-xs font-bold uppercase tracking-widest">Tidak ada antrean calon SK</TableCell></TableRow>
                    ) : (
                        candidatesData.data.map((t: any) => (
                            <TableRow key={t.id} className="hover:bg-slate-50/50 border-slate-50">
                                <TableCell className="pl-8">
                                    <Checkbox 
                                        checked={selectedIds.has(t.id)} 
                                        onCheckedChange={(c) => {
                                            const s = new Set(selectedIds)
                                            if(c) s.add(t.id) 
                                            else s.delete(t.id)
                                            setSelectedIds(s)
                                        }} 
                                    />
                                </TableCell>
                                <TableCell className="font-bold text-slate-800 text-sm">{t.nama}</TableCell>
                                <TableCell className="text-xs text-slate-500 font-medium">{t.jenis_sk || "-"}</TableCell>
                                <TableCell className="text-xs text-slate-600 font-bold">{t.unit_kerja || "-"}</TableCell>
                                <TableCell className="text-xs text-slate-500">{t.jabatan || "-"}</TableCell>
                                <TableCell className="text-right pr-8">
                                    {t.surat_permohonan_url ? (
                                        <Button variant="ghost" size="sm" asChild className="h-8 text-[10px] font-black uppercase text-blue-600">
                                            <a href={t.surat_permohonan_url} target="_blank" rel="noreferrer"><Eye className="mr-1 h-3 w-3" /> Lihat PDF</a>
                                        </Button>
                                    ) : <span className="text-[10px] text-slate-300">N/A</span>}
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>

            {!isCandidatesLoading && candidatesData?.total > 0 && (
                <div className="p-8 bg-slate-50/50 flex items-center justify-between border-t border-slate-100">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total {candidatesData.total} Kandidat</span>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="rounded-xl h-9 px-4">Sebelumnya</Button>
                        <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(candidatesData.total / 10)} className="rounded-xl h-9 px-4">Berikutnya</Button>
                    </div>
                </div>
            )}
        </CardContent>
      </Card>

      {selectedIds.size > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white rounded-[2rem] px-8 py-5 flex items-center gap-6 z-50 shadow-2xl animate-in slide-in-from-bottom-10">
            <div className="flex items-center gap-3 border-r border-slate-700 pr-6">
                <div className="bg-blue-600 h-8 w-8 rounded-full flex items-center justify-center text-xs font-black">{selectedIds.size}</div>
                <span className="text-sm font-black uppercase tracking-widest text-slate-300">Item Terpilih</span>
            </div>
            <Button onClick={handleGenerate} disabled={isGenerating} className="bg-blue-600 hover:bg-blue-700 h-11 px-8 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-900/50">
                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                Generate & Terbitkan SK
            </Button>
        </div>
      )}
      <div className="fixed bottom-4 right-4 text-[8px] font-black text-slate-300 uppercase tracking-widest pointer-events-none opacity-50">
          Simmaci Engine v1.1 - Final Data Patch
      </div>
    </div>
  )
}
