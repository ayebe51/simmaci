import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { BadgeCheck, Download, Upload, Loader2, Settings2 } from "lucide-react"
import { useState } from "react"
import { headmasterApi, mediaApi, authApi, skTemplateApi } from "@/lib/api"
import { getSkVerificationUrl } from "@/utils/verification"
import { toast } from "sonner"
import QRCode from "qrcode"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { useQuery } from "@tanstack/react-query"
import PizZip from "pizzip"
import Docxtemplater from "docxtemplater"
import ImageModule from "docxtemplater-image-module-free"
import { saveAs } from "file-saver"

export default function YayasanApprovalPage() {
  const user = authApi.getStoredUser()
  
  // 🔥 REST API QUERY
  const { data: requestsRes, isLoading, refetch } = useQuery({
    queryKey: ['headmaster-approvals'],
    queryFn: () => headmasterApi.list({ per_page: 100 })
  })

  const requests = requestsRes?.data || []

  // --- UI STATES ---
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  // --- SK SETTINGS ---
  const [nomorFormat, setNomorFormat] = useState("{NOMOR}/PC.L/A.II/H-34.B/{BULAN}/{TAHUN}")
  const [nomorStart, setNomorStart] = useState("0001")
  const [tanggalPenetapan, setTanggalPenetapan] = useState("")
  const [tahunAjaran, setTahunAjaran] = useState(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth() + 1
    return m >= 7 ? `${y}/${y + 1}` : `${y - 1}/${y}`
  })


  const handleApprove = async (id: number) => {
    setIsProcessing(true)
    try {
        await headmasterApi.approve(id, {
            nomor_sk: nomorStart,
            tanggal_penetapan: tanggalPenetapan || new Date().toISOString().split('T')[0]
        })
        toast.success("SK Kepala Disetujui!")
        refetch()
    } catch (e: any) {
        toast.error("Gagal: " + (e.response?.data?.message || "Unknown error"))
    } finally {
        setIsProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!selectedId || !rejectReason.trim()) return
    setIsProcessing(true)
    try {
        await headmasterApi.reject(selectedId, { rejection_reason: rejectReason })
        toast.success("SK Kepala Ditolak")
        setIsRejectModalOpen(false)
        refetch()
    } catch (e: any) {
        toast.error("Gagal: " + (e.response?.data?.message || "Unknown error"))
    } finally {
        setIsProcessing(false)
    }
  }

  const handleUploadSkFinal = async (file: File) => {
    if (!selectedId) return
    setIsProcessing(true)
    try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('folder', 'sk-final')
        const media = await mediaApi.upload(formData)
        await headmasterApi.update(selectedId, { sk_url: media.url })
        toast.success("SK Final Berhasil Diunggah")
        setIsUploadModalOpen(false)
        refetch()
    } catch (e: any) {
        toast.error("Gagal Upload")
    } finally {
        setIsProcessing(false)
    }
  }

  const handleGenerateSK = async (item: any) => {
    const loaderId = toast.loading("Menyiapkan Dokumen SK Kepala...")
    try {
        // 1. Deteksi varian template Kamad berdasarkan jabatan dan status kepegawaian
        const jabatan = (item.jabatan || item.teacher?.jabatan || "").toLowerCase()
        const nip = (item.teacher?.nip || "").replace(/[^0-9]/g, "")
        const statusKepegawaian = (item.teacher?.status_kepegawaian || "").toLowerCase()
        const isPns = nip.length >= 18 || statusKepegawaian.includes("pns") || statusKepegawaian.includes("asn")
        const isPlt = jabatan.includes("plt")

        let kamadSkType: string
        if (isPlt) {
            kamadSkType = "kamad_plt"
        } else if (isPns) {
            kamadSkType = "kamad_pns"
        } else {
            kamadSkType = "kamad_nonpns"
        }

        // 2. Ambil template aktif sesuai varian, fallback ke kamad_nonpns jika tidak ada
        let templateRes = await skTemplateApi.getActive(kamadSkType).catch(() => null)
        // getActive mengembalikan { success, data: { file_url, ... } } — ambil dari .data
        let templateData = templateRes?.data ?? templateRes
        if (!templateData?.file_url) {
            // Fallback: coba kamad_nonpns jika varian spesifik belum diupload
            if (kamadSkType !== "kamad_nonpns") {
                templateRes = await skTemplateApi.getActive("kamad_nonpns").catch(() => null)
                templateData = templateRes?.data ?? templateRes
            }
        }
        if (!templateData?.file_url) {
            throw new Error(`Template SK Kamad (${kamadSkType}) belum diupload. Silakan upload di menu Template SK.`)
        }

        // 3. Fetch template sebagai binary
        const resp = await fetch(templateData.file_url, {
            headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` }
        })
        if (!resp.ok) throw new Error("Gagal mengunduh template SK")
        const arrayBuffer = await resp.arrayBuffer()

        // 4. QR Code
        const verificationUrl = getSkVerificationUrl(item.id)
        const qrDataUrl = await QRCode.toDataURL(verificationUrl, { width: 400, margin: 1 })

        // 5. Format tanggal — parse manual YYYY-MM-DD untuk hindari timezone shift
        const tglPenetapan = tanggalPenetapan || new Date().toISOString().split('T')[0]
        const datePenetapan = new Date(tglPenetapan)
        const bulanRomawi = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"]
        const bulan = String(datePenetapan.getMonth() + 1).padStart(2, '0')
        const bulanRoma = bulanRomawi[datePenetapan.getMonth()]
        const tahun = datePenetapan.getFullYear()

        // Parse tanggal dengan aman (hindari timezone shift untuk format YYYY-MM-DD)
        const formatDateIndo = (dateStr: string | null | undefined) => {
            if (!dateStr) return "-"
            const months = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"]
            // Coba parse YYYY-MM-DD langsung (tanpa timezone shift)
            const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
            if (isoMatch) {
                const y = parseInt(isoMatch[1])
                const m = parseInt(isoMatch[2]) - 1
                const d = parseInt(isoMatch[3])
                return `${d} ${months[m]} ${y}`
            }
            // Fallback untuk format lain
            const d = new Date(dateStr)
            if (isNaN(d.getTime())) return "-"
            return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
        }

        // 6. Build nomor SK — NOMOR hanya nomor urut, NOMOR_LENGKAP = full string
        const nomorSk = nomorFormat
            .replace(/{NOMOR}/g, nomorStart)
            .replace(/{BULAN}/g, bulan)
            .replace(/{BL_ROMA}/g, bulanRoma)
            .replace(/{TAHUN}/g, String(tahun))

        const nim = item.teacher?.nomor_induk_maarif || "-"
        const nuptk = item.teacher?.nuptk || "-"

        // Tembusan standar SK Kepala Madrasah
        const tembusan = [
            "Ketua Pengurus Wilayah LP Ma'arif NU Jawa Tengah",
            "Ketua Pengurus Cabang NU Cilacap",
            "Kepala Kantor Kemenag Kabupaten Cilacap",
            "Kepala Madrasah yang bersangkutan",
            "Arsip",
        ].join("\n")

        // 7. Data untuk template
        const docData = {
            qrcode: qrDataUrl,
            NAMA: item.teacher?.nama || item.teacher_name || "",
            NIP: item.teacher?.nip || "-",
            GOLONGAN: item.teacher?.golongan || "-",
            // Tempat, Tanggal Lahir — lengkap
            "TEMPAT, TANGGAL LAHIR": `${item.teacher?.tempat_lahir || "-"}, ${formatDateIndo(item.teacher?.tanggal_lahir)}`,
            TEMPAT_LAHIR: item.teacher?.tempat_lahir || "-",
            TANGGAL_LAHIR: formatDateIndo(item.teacher?.tanggal_lahir),
            // NIM — semua alias yang mungkin dipakai di template
            NIM: nim,
            "NOMOR INDUK MA'ARIF": nim,
            NOMOR_INDUK_MAARIF: nim,
            NUPTK: nuptk,
            // Nomor SK — NOMOR = nomor urut saja, NOMOR_LENGKAP = full string
            NOMOR: nomorStart,
            NOMOR_LENGKAP: nomorSk,
            BULAN: bulan,
            BL_ROMA: bulanRoma,
            TAHUN: String(tahun),
            // Data lain
            PENDIDIKAN: item.teacher?.pendidikan_terakhir || "-",
            "UNIT KERJA": item.school?.nama || item.school_name || "",
            UNIT_KERJA: item.school?.nama || item.school_name || "",
            TMT: formatDateIndo(item.teacher?.tmt),
            "TMT GURU": formatDateIndo(item.teacher?.tmt),
            "TMT KEPALA": formatDateIndo(item.start_date),
            JABATAN: "Kepala Madrasah",
            MASA_BHAKTI: `${new Date(item.start_date).getFullYear()} - ${new Date(item.end_date).getFullYear()}`,
            "TANGGAL PENETAPAN": formatDateIndo(tglPenetapan),
            KECAMATAN: item.school?.kecamatan || "-",
            KABUPATEN: "Cilacap",
            "NOMOR SURAT PERMOHONAN": item.surat_permohonan_number || "-",
            "TANGGAL SURAT PERMOHONAN": formatDateIndo(item.surat_permohonan_date),
            "NOMOR SURAT REKOMENDASI": item.nomor_surat_rekomendasi || "-",
            "TANGGAL SURAT REKOMENDASI": formatDateIndo(item.tanggal_surat_rekomendasi),
            TAHUN_AJARAN: tahunAjaran,
            PERIODE: `Ke-${item.periode}` || "-",
            // Tembusan
            TEMBUSAN: tembusan,
            "TEMBUSAN 1": "Ketua Pengurus Wilayah LP Ma'arif NU Jawa Tengah",
            "TEMBUSAN 2": "Ketua Pengurus Cabang NU Cilacap",
            "TEMBUSAN 3": "Kepala Kantor Kemenag Kabupaten Cilacap",
            "TEMBUSAN 4": "Kepala Madrasah yang bersangkutan",
            "TEMBUSAN 5": "Arsip",
        }

        // 8. Generate DOCX
        const zip = new PizZip(arrayBuffer)

        // Auto-fix tag QR di document.xml jika perlu
        const docFile = zip.file("word/document.xml")
        if (docFile) {
            let content = docFile.asText()
            if (content.includes("qrcode") && !content.includes("%qrcode")) {
                content = content.replace(/{qrcode}/g, "{%qrcode}")
                zip.file("word/document.xml", content)
            }
        }

        const doc = new Docxtemplater(zip, {
            modules: [new ImageModule({
                centered: false,
                getImage: (tagValue: string) => {
                    const b64 = tagValue.replace(/^data:image\/(png|jpg|svg|svg\+xml);base64,/, "")
                    const bin = window.atob(b64)
                    const bytes = new Uint8Array(bin.length)
                    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
                    return bytes.buffer
                },
                getSize: () => [100, 100]
            })],
            paragraphLoop: true,
            linebreaks: true,
            nullGetter: () => ""
        })

        doc.render(docData)
        const out = doc.getZip().generate({ type: "blob" })
        const namaFile = `SK_Kamad_${(item.teacher?.nama || item.teacher_name || 'kepala').replace(/\s+/g, '_')}.docx`
        saveAs(out, namaFile)

        // Simpan nomor_sk dan tanggal_penetapan ke database untuk tracking masa jabatan
        try {
            await headmasterApi.update(item.id, {
                nomor_sk: nomorSk,
                tanggal_penetapan: tglPenetapan,
            })
        } catch (_) {
            // tidak blokir proses cetak jika update gagal
        }

        const varianLabel = isPlt ? "PLT" : isPns ? "PNS" : "Non-PNS"
        toast.success(`SK Kepala (${varianLabel}) Berhasil Dibuat!`, { id: loaderId })
    } catch (e: any) {
        console.error(e)
        toast.error(e.message || "Gagal membuat SK", { id: loaderId })
    }
  }

  return (
    <div className="space-y-10 pb-20">
        <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">Otoritas Ketua Yayasan</h1>
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2">
               <BadgeCheck className="w-4 h-4 text-emerald-500" /> Panel Persetujuan Struktural & Pengangkatan Kamad
            </p>
        </div>

        {/* Global Settings */}
        <Card className="border-0 shadow-sm bg-white rounded-[2.5rem] overflow-hidden">
             <CardHeader className="p-10 border-b bg-slate-50/50">
                <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-3">
                    <Settings2 className="w-5 h-5 text-blue-500" /> Format & Penomoran Kolektif
                </CardTitle>
            </CardHeader>
            <CardContent className="p-10 grid grid-cols-1 md:grid-cols-3 gap-10">
                <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Penomoran Otomatis</Label>
                    <div className="flex gap-2">
                        <Input value={nomorStart} onChange={e => setNomorStart(e.target.value)} className="w-24 h-12 rounded-xl font-black text-center border-slate-200" />
                        <Input value={nomorFormat} onChange={e => setNomorFormat(e.target.value)} className="flex-1 h-12 rounded-xl font-bold text-xs border-slate-200" />
                    </div>
                </div>
                <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Tanggal Penetapan SK</Label>
                    <Input type="date" value={tanggalPenetapan} onChange={e => setTanggalPenetapan(e.target.value)} className="h-12 rounded-xl border-slate-200 font-bold" />
                </div>
                <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Tahun Ajaran Aktif</Label>
                    <Input value={tahunAjaran} onChange={e => setTahunAjaran(e.target.value)} className="h-12 rounded-xl border-slate-200 font-bold" />
                </div>
            </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-white rounded-[2.5rem] overflow-hidden">
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader className="bg-slate-50 border-b border-slate-100">
                        <TableRow>
                            <TableHead className="p-8 text-[10px] font-black uppercase text-slate-400 tracking-widest">Informasi Calon</TableHead>
                            <TableHead className="p-8 text-[10px] font-black uppercase text-slate-400 tracking-widest">Madrasah Tujuan</TableHead>
                            <TableHead className="p-8 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Periode</TableHead>
                            <TableHead className="p-8 text-[10px] font-black uppercase text-slate-400 tracking-widest">Status</TableHead>
                            <TableHead className="p-8 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Opsi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={5} className="text-center py-24 animate-pulse uppercase font-black text-slate-300 text-xs italic tracking-widest">Syincing Approval Queue...</TableCell></TableRow>
                        ) : requests.length === 0 ? (
                            <TableRow><TableCell colSpan={5} className="text-center py-24 font-bold text-slate-300 text-xs italic">Tidak ada antrian pengajuan</TableCell></TableRow>
                        ) : requests.map((item: any) => (
                            <TableRow key={item.id} className="hover:bg-slate-50/30 transition-colors">
                                <TableCell className="p-8">
                                    <div className="font-black text-slate-800 text-sm tracking-tight">{item.teacher?.nama}</div>
                                    <div className="text-[9px] font-bold text-slate-400 uppercase mt-1">NIP: {item.teacher?.nip || '-'}</div>
                                </TableCell>
                                <TableCell className="p-8 font-bold text-slate-500 text-xs">{item.school?.nama}</TableCell>
                                <TableCell className="p-8 text-center font-black text-xs">
                                     <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg">Ke-{item.periode}</span>
                                </TableCell>
                                <TableCell className="p-8">
                                   <Badge className={cn("rounded-lg text-[9px] font-black uppercase px-3 py-1", 
                                       item.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 
                                       item.status === 'rejected' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                                   )}>
                                     {item.status === 'active' ? 'Disetujui' : item.status === 'rejected' ? 'Ditolak' : 'Menunggu'}
                                   </Badge>
                                </TableCell>
                                <TableCell className="p-8 text-right">
                                    <div className="flex justify-end gap-2">
                                        {item.status === 'pending' && (
                                            <>
                                                <Button size="sm" onClick={() => handleApprove(item.id)} disabled={isProcessing} className="h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest px-6 shadow-lg shadow-emerald-100">
                                                    {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Approve'}
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => { setSelectedId(item.id); setRejectReason(""); setIsRejectModalOpen(true)}} className="h-10 rounded-xl text-rose-600 font-black uppercase text-[10px] tracking-widest px-6 hover:bg-rose-50">Reject</Button>
                                            </>
                                        )}
                                        {item.status === 'active' && (
                                            <Button variant="outline" size="sm" onClick={() => handleGenerateSK(item)} className="h-10 rounded-xl border-slate-200 font-black uppercase text-[10px] tracking-widest px-6 shadow-sm">
                                                <Download className="w-4 h-4 mr-2 text-blue-500" /> Cetak SK
                                            </Button>
                                        )}
                                        <Button variant="ghost" size="sm" onClick={() => { setSelectedId(item.id); setIsUploadModalOpen(true)}} className="h-10 rounded-xl text-slate-400 font-black uppercase text-[10px] tracking-widest hover:bg-slate-100"><Upload className="w-4 h-4" /></Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </Card>

        {/* Modals */}
        <Dialog open={isRejectModalOpen} onOpenChange={setIsRejectModalOpen}>
            <DialogContent className="rounded-[2.5rem] p-10 border-0 shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-black uppercase tracking-tight text-rose-600 italic">Penolakan Kredensial</DialogTitle>
                    <DialogDescription className="font-bold text-slate-400 text-[10px] uppercase">Berikan alasan diskualifikasi atau penolakan</DialogDescription>
                </DialogHeader>
                <div className="py-8">
                    <textarea 
                        className="w-full h-32 rounded-2xl border-slate-200 p-4 font-bold text-sm bg-slate-50 focus:ring-rose-500"
                        placeholder="Masukkan alasan detail minimal 10 karakter..."
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                    />
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setIsRejectModalOpen(false)} className="rounded-xl font-black uppercase text-[10px] tracking-widest text-slate-400">Kembali</Button>
                    <Button onClick={handleReject} disabled={isProcessing || rejectReason.length < 10} className="h-14 px-10 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black uppercase text-xs tracking-widest shadow-xl shadow-rose-100">
                         {isProcessing ? <Loader2 className="animate-spin h-5 w-5" /> : 'Diskualifikasi Calon'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
            <DialogContent className="rounded-[2.5rem] p-10 border-0 shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-black uppercase tracking-tight italic">Upload SK Final (Manual)</DialogTitle>
                    <DialogDescription className="font-bold text-slate-400 text-[10px] uppercase">Arsip PDF bertanda tangan basah</DialogDescription>
                </DialogHeader>
                <div className="py-10 border-2 border-dashed border-slate-100 rounded-[2rem] flex flex-col items-center justify-center gap-4 bg-slate-50/50">
                    <Upload className="w-10 h-10 text-slate-200" />
                    <Input type="file" accept=".pdf" onChange={e => e.target.files?.[0] && handleUploadSkFinal(e.target.files[0])} className="hidden" id="sk-upload" />
                    <Button asChild className="rounded-xl font-black uppercase text-[10px] tracking-widest bg-white border shadow-sm text-slate-600 hover:bg-slate-50">
                        <label htmlFor="sk-upload">Pilih Berkas PDF</label>
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    </div>
  )
}
