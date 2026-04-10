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
import { skApi, teacherApi, settingApi, authApi } from "@/lib/api"
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
  const [nomorFormat, setNomorFormat] = useState("{NOMOR}/PC.L/A.II/H-34.B/24.29/{TANGGAL}/{BULAN}/{TAHUN}")
  const [tanggalPenetapan, setTanggalPenetapan] = useState("")
  const [nomorSuratMasuk, setNomorSuratMasuk] = useState("")
  const [tanggalSuratMasuk, setTanggalSuratMasuk] = useState("")
  const [tahunAjaran, setTahunAjaran] = useState(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth() + 1 // 1–12
    return m >= 7 ? `${y}/${y + 1}` : `${y - 1}/${y}`
  })

  const [defaultKecamatan, setDefaultKecamatan] = useState("")

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
        const lastNum = lastSkData.data[0].nomor_sk.match(/^(\d{4})/);
        if (lastNum) {
            const next = String(parseInt(lastNum[1]) + 1).padStart(4, '0');
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
    const zip = new JSZip()
    const folder = zip.folder("SK_Generated")
    const templateCache: Record<string, any> = {}

    try {
        const selectedTeachers = (candidatesData?.data || []).filter((t: any) => selectedIds.has(t.id))
        const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]
        const dateObj = new Date()
        const dd = String(dateObj.getDate()).padStart(2, '0')
        const mmAngka = String(dateObj.getMonth() + 1)
        const mmRoma = toRoman(dateObj.getMonth() + 1)
        const yyyy = dateObj.getFullYear()

        for (let i = 0; i < selectedTeachers.length; i++) {
            const t = selectedTeachers[i]
            
            // 1. Determine Template
            const jenis = (t.jenis_sk || "").toLowerCase()
            let templateId = "sk_template_tendik"
            if (jenis.includes("gty") || jenis.includes("tetap yayasan")) templateId = "sk_template_gty"
            else if (jenis.includes("gtt") || jenis.includes("tidak tetap")) templateId = "sk_template_gtt"
            else if (jenis.includes("kamad") || jenis.includes("kepala")) templateId = "sk_template_kamad"

            // 2. Fetch Template if not cached
            if (!templateCache[templateId]) {
                const res = await settingApi.get(templateId)
                if (res?.value) {
                    const base64 = res.value.split(";base64,")[1] || res.value
                    templateCache[templateId] = atob(base64)
                }
            }

            const content = templateCache[templateId]
            if (!content) {
                toast.error(`Template ${templateId} tidak ditemukan.`)
                continue
            }

            // 3. Prepare Mapping Data
            const currentSeq = (parseInt(nomorMulai) || 1) + i
            const seqStr = String(currentSeq).padStart(4, '0')
            const generatedNomor = nomorFormat
                .replace(/{NOMOR}/g, seqStr)
                .replace(/{TANGGAL}/g, dd)
                .replace(/{BULAN}/g, mmAngka)
                .replace(/{BL_ROMA}/g, mmRoma)
                .replace(/{TAHUN}/g, String(yyyy))

            const verificationUrl = `${window.location.origin}/verify/sk/${generatedNomor}`
            const qrDataUrl = await QRCode.toDataURL(verificationUrl, { width: 400, margin: 1 })

            const renderData = {
                ...t,
                nomor_sk: generatedNomor,
                tanggal_penetapan: tanggalPenetapan || `${dd} ${months[dateObj.getMonth()]} ${yyyy}`,
                qrcode: qrDataUrl,
                TAHUN_PELAJARAN: tahunAjaran,
                KECAMATAN: t.kecamatan || defaultKecamatan || "....."
            }

            // 4. Generate DOCX
            const pzip = new PizZip(content)
            const doc = new Docxtemplater(pzip, {
                paragraphLoop: true,
                linebreaks: true,
                modules: [new ImageModule({
                    getImage: (tag: string) => base64DataURLToArrayBuffer(tag),
                    getSize: () => [100, 100]
                })],
                nullGetter: () => ""
            })

            doc.render(renderData)
            const out = doc.getZip().generate({ type: "uint8array" })
            folder?.file(`${t.nama.replace(/\s+/g, '_')}_SK.docx`, out)

            // 5. Sync to Backend
            await updateSkMutation.mutateAsync({
                id: t.id,
                data: {
                    nomor_sk: generatedNomor,
                    status: "approved",
                    tanggal_penetapan: renderData.tanggal_penetapan,
                    file_url: "Generated via Bulk ZIP"
                }
            })
            
            if (t.teacher_id) {
                await markVerifiedMutation.mutateAsync(t.teacher_id)
            }
        }

        const zipBlob = await zip.generateAsync({ type: "blob" })
        const url = URL.createObjectURL(zipBlob)
        const link = document.createElement('a')
        link.href = url
        link.download = "SK_Masal_Maarif.zip"
        link.click()
        
        toast.success(`Berhasil menerbitkan ${selectedIds.size} SK!`)
        queryClient.invalidateQueries({ queryKey: ['sk-candidates-generator'] })
        setSelectedIds(new Set())
    } catch (e: any) {
        console.error(e)
        toast.error("Gagal generate SK: " + e.message)
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
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Tahun Ajaran</label>
                    <Input value={tahunAjaran} onChange={e => setTahunAjaran(e.target.value)} className="h-11 rounded-xl bg-white border-slate-200" />
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
    </div>
  )
}
