import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { BadgeCheck, Download, Upload, Loader2, Settings2, Trash2 } from "lucide-react"
import { useState } from "react"
import { headmasterApi, mediaApi, authApi, skTemplateApi, schoolApi } from "@/lib/api"
import { getSkVerificationUrl } from "@/utils/verification"
import { toast } from "sonner"
import QRCode from "qrcode"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import PizZip from "pizzip"
import Docxtemplater from "docxtemplater"
import ImageModule from "docxtemplater-image-module-free"
import { saveAs } from "file-saver"

export default function YayasanApprovalPage() {
  const user = authApi.getStoredUser()
  const queryClient = useQueryClient()
  
  // 🔥 REST API QUERY
  const { data: requestsRes, isLoading, refetch } = useQuery({
    queryKey: ['headmaster-approvals'],
    queryFn: () => headmasterApi.list({ per_page: 100 }),
    staleTime: 0, // Selalu fetch fresh — jangan pakai cache
  })

  const requests = requestsRes?.data || []

  // --- UI STATES ---
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  // --- SK SETTINGS — persisten di localStorage ---
  const [nomorFormat, setNomorFormat] = useState(() =>
    localStorage.getItem('kamad_nomor_format') || "{NOMOR}/PC.L/A.II/H-34.B/{BULAN}/{TAHUN}"
  )
  const [nomorStart, setNomorStart] = useState(() =>
    localStorage.getItem('kamad_nomor_start') || "0001"
  )
  const [tanggalPenetapan, setTanggalPenetapan] = useState(() =>
    localStorage.getItem('kamad_tanggal_penetapan') || ""
  )
  const [jenisKepala, setJenisKepala] = useState<"auto" | "nonpns" | "pns" | "plt">(() =>
    (localStorage.getItem('kamad_jenis_kepala') as any) || "auto"
  )
  const [tahunAjaran, setTahunAjaran] = useState(() => {
    if (localStorage.getItem('kamad_tahun_ajaran')) return localStorage.getItem('kamad_tahun_ajaran')!
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth() + 1
    return m >= 7 ? `${y}/${y + 1}` : `${y - 1}/${y}`
  })

  // Simpan ke localStorage setiap kali berubah
  const updateNomorFormat = (v: string) => { setNomorFormat(v); localStorage.setItem('kamad_nomor_format', v) }
  const updateNomorStart  = (v: string) => { setNomorStart(v);  localStorage.setItem('kamad_nomor_start', v) }
  const updateTanggal     = (v: string) => { setTanggalPenetapan(v); localStorage.setItem('kamad_tanggal_penetapan', v) }
  const updateJenisKepala = (v: string) => { setJenisKepala(v as any); localStorage.setItem('kamad_jenis_kepala', v) }
  const updateTahunAjaran = (v: string) => { setTahunAjaran(v); localStorage.setItem('kamad_tahun_ajaran', v) }


  const handleDeleteTenure = async () => {
    if (!deleteTarget || isProcessing) return
    setIsProcessing(true)
    try {
        await headmasterApi.delete(deleteTarget.id)
        setIsDeleteModalOpen(false)
        setDeleteTarget(null)
        // Invalidate dan refetch paksa — buang semua cache headmaster
        await queryClient.invalidateQueries({ queryKey: ['headmaster-approvals'] })
        await refetch()
        toast.success(`Pengajuan ${deleteTarget.teacher?.nama || deleteTarget.teacher_name} berhasil dihapus.`)
    } catch (e: any) {
        toast.error("Gagal hapus: " + (e.response?.data?.message || e.message))
    } finally {
        setIsProcessing(false)
    }
  }

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
        // 0. Fetch data guru terbaru dulu — dipakai untuk deteksi PNS dan pengisian template
        let teacherData: any = item.teacher || {}
        if (item.teacher_id) {
            try {
                const { teacherApi } = await import("@/lib/api")
                const freshTeacher = await teacherApi.get(item.teacher_id)
                if (freshTeacher?.id) teacherData = freshTeacher
            } catch (_) { /* fallback ke data relasi */ }
        }

        // 1. Deteksi varian template Kamad berdasarkan jabatan dan status kepegawaian
        const jabatan = (item.jabatan || teacherData?.jabatan || "").toLowerCase()
        const nip = (teacherData?.nip || item.teacher?.nip || "").replace(/[^0-9]/g, "")
        const statusKepegawaian = (teacherData?.status || item.teacher?.status || "").toLowerCase()
        const golongan = (item.golongan || teacherData?.golongan || "").trim()

        const isPlt = jenisKepala === "plt"
            || (jenisKepala === "auto" && jabatan.includes("plt"))

        // PNS jika override manual, atau deteksi otomatis dari data guru fresh
        const isPns = jenisKepala === "pns"
            || (jenisKepala === "auto" && (
                nip.length >= 18
                || statusKepegawaian.includes("pns")
                || statusKepegawaian.includes("asn")
                || golongan.length > 0
            ))

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
            throw new Error(`Template SK Kamad (${kamadSkType}) belum diupload atau belum diaktifkan. Silakan periksa di menu Template SK.`);
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

        // Fetch data guru terbaru sudah dilakukan di awal fungsi (step 0)
        const nim = teacherData?.nomor_induk_maarif || item.teacher?.nomor_induk_maarif || ""
        const nuptk = teacherData?.nuptk || item.teacher?.nuptk || ""
        const schoolKecamatan = item.school?.kecamatan || "-"
        const unitKerja = item.school?.nama || item.school_name || ""

        // Tembusan — samakan dengan generator SK biasa
        const tembusanList = [
            { nomor: 1, isi: "LP Ma'arif NU PWNU Jawa Tengah" },
            { nomor: 2, isi: "PCNU Cilacap" },
            { nomor: 3, isi: `Perwakilan LP Ma'arif NU MWCNU Kecamatan ${schoolKecamatan}`.trim() },
            { nomor: 4, isi: `Kepala ${unitKerja}`.trim() },
            { nomor: 5, isi: `BP3MNU ${unitKerja}`.trim() },
            { nomor: 6, isi: "Arsip" },
        ]

        // 7. Data untuk template
        const docData = {
            qrcode: qrDataUrl,
            NAMA: teacherData?.nama || item.teacher?.nama || item.teacher_name || "",
            NIP: teacherData?.nip || item.teacher?.nip || "",
            GOLONGAN: item.golongan || teacherData?.golongan || item.teacher?.golongan || "",
            // Tempat, Tanggal Lahir — lengkap
            "TEMPAT, TANGGAL LAHIR": `${teacherData?.tempat_lahir || item.teacher?.tempat_lahir || "-"}, ${formatDateIndo(teacherData?.tanggal_lahir || item.teacher?.tanggal_lahir)}`,
            TEMPAT_LAHIR: teacherData?.tempat_lahir || item.teacher?.tempat_lahir || "-",
            TANGGAL_LAHIR: formatDateIndo(teacherData?.tanggal_lahir || item.teacher?.tanggal_lahir),
            // NIM — semua alias termasuk Unicode right single quote (U+2019) yang dipakai template
            NIM: nim,
            "Nomor Induk Ma\u2019arif": nim,
            "NOMOR INDUK MA\u2019ARIF": nim,   // ← ini yang ada di template .docx (U+2019)
            "Nomor Induk Ma'arif": nim,         // apostrof biasa fallback
            "NOMOR INDUK MA'ARIF": nim,
            "NOMOR INDUK MAARIF": nim,
            "Nomor Induk Maarif": nim,
            NOMOR_INDUK_MAARIF: nim,
            "nomor_induk_maarif": nim,
            NUPTK: nuptk,
            // Nomor SK — NOMOR = nomor urut saja, NOMOR_LENGKAP = full string
            NOMOR: nomorStart,
            NOMOR_LENGKAP: nomorSk,
            BULAN: bulan,
            BL_ROMA: bulanRoma,
            TAHUN: String(tahun),
            // Data lain
            PENDIDIKAN: item.teacher?.pendidikan_terakhir || "-",
            "PENDIDIKAN TERAKHIR": item.teacher?.pendidikan_terakhir || "-",
            "UNIT KERJA": unitKerja,
            UNIT_KERJA: unitKerja,
            TMT: formatDateIndo(teacherData?.tmt || item.teacher?.tmt),
            "TMT GURU": formatDateIndo(teacherData?.tmt || item.teacher?.tmt),
            "TMT KEPALA": formatDateIndo(item.start_date),
            JABATAN: "Kepala Madrasah",
            MASA_BHAKTI: `${new Date(item.start_date).getFullYear()} - ${new Date(item.end_date).getFullYear()}`,
            "TANGGAL PENETAPAN": formatDateIndo(tglPenetapan),
            "TANGGAL_PENETAPAN": formatDateIndo(tglPenetapan),
            KECAMATAN: schoolKecamatan,
            KABUPATEN: "Cilacap",
            "NOMOR SURAT PERMOHONAN": item.surat_permohonan_number || "-",
            "TANGGAL SURAT PERMOHONAN": formatDateIndo(item.surat_permohonan_date),
            "NOMOR SURAT REKOMENDASI": item.nomor_surat_rekomendasi || "-",
            "TANGGAL SURAT REKOMENDASI": formatDateIndo(item.tanggal_surat_rekomendasi),
            TAHUN_AJARAN: tahunAjaran,
            PERIODE: `Ke-${item.periode}` || "-",
            // Tembusan — array untuk {#tembusan}{nomor}. {isi}{/tembusan} loop di template
            tembusan: tembusanList,
            // Fallback: individual placeholder jika template menggunakan {TEMBUSAN 1} dst
            "TEMBUSAN 1": tembusanList[0].isi,
            "TEMBUSAN 2": tembusanList[1].isi,
            "TEMBUSAN 3": tembusanList[2].isi,
            "TEMBUSAN 4": tembusanList[3].isi,
            "TEMBUSAN 5": tembusanList[4].isi,
            "TEMBUSAN 6": tembusanList[5].isi,
            // Fallback satu blok teks (jika template pakai {TEMBUSAN} saja)
            TEMBUSAN: tembusanList.map(t => `${t.nomor}. ${t.isi}`).join("\n"),
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

        // Simpan nomor_sk dan tanggal_penetapan ke headmaster_tenures untuk tracking masa jabatan
        try {
            await headmasterApi.update(item.id, {
                nomor_sk: nomorSk,
                tanggal_penetapan: tglPenetapan,
            })
        } catch (_) {
            // tidak blokir proses cetak jika update gagal
        }

        // Sinkronisasi ke profil sekolah — isi jabatan mulai/selesai otomatis dari data SK
        try {
            const schoolId = item.school_id ?? item.school?.id
            if (schoolId) {
                await schoolApi.update(schoolId, {
                    kepala_madrasah: item.teacher?.nama || item.teacher_name || undefined,
                    kepala_nim: item.teacher?.nomor_induk_maarif || undefined,
                    kepala_nuptk: item.teacher?.nuptk || undefined,
                    kepala_jabatan_mulai: item.start_date || tglPenetapan,
                    kepala_jabatan_selesai: item.end_date || undefined,
                })
            }
        } catch (_) {
            // tidak blokir proses cetak jika sinkronisasi profil gagal
        }

        const varianLabel = isPlt ? "PLT" : isPns ? "PNS" : "Non-PNS"
        toast.success(`SK Kepala (${varianLabel}) Berhasil Dibuat!`, { id: loaderId })

        // Auto-increment nomorStart untuk cetak berikutnya — simpan ke localStorage
        const currentNum = parseInt(nomorStart, 10)
        if (!isNaN(currentNum)) {
            updateNomorStart(String(currentNum + 1).padStart(nomorStart.length, '0'))
        }
    } catch (e: any) {
        console.error(e)
        toast.error(e.message || "Gagal membuat SK", { id: loaderId })
    }
  }

  return (
    <div className="space-y-10 pb-20">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-2">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 truncate">Otoritas Ketua Yayasan</h1>
          <p className="text-sm text-slate-500 mt-1 flex items-center gap-2 truncate">
             <BadgeCheck className="w-4 h-4 text-emerald-600 shrink-0" /> Panel Persetujuan Struktural & Pengangkatan Kamad
          </p>
        </div>
      </div>

        {/* Global Settings */}
        <Card className="border-0 shadow-sm bg-white rounded-[2.5rem] overflow-hidden">
             <CardHeader className="p-10 border-b bg-slate-50/50">
                <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-3">
                    <Settings2 className="w-5 h-5 text-blue-500" /> Format & Penomoran Kolektif
                </CardTitle>
            </CardHeader>
            <CardContent className="p-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
                <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Penomoran Otomatis</Label>
                    <div className="flex gap-2">
                        <Input value={nomorStart} onChange={e => updateNomorStart(e.target.value)} className="w-24 h-12 rounded-xl font-black text-center border-slate-200" />
                        <Input value={nomorFormat} onChange={e => updateNomorFormat(e.target.value)} className="flex-1 h-12 rounded-xl font-bold text-xs border-slate-200" />
                    </div>
                </div>
                <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Tanggal Penetapan SK</Label>
                    <Input type="date" value={tanggalPenetapan} onChange={e => updateTanggal(e.target.value)} className="h-12 rounded-xl border-slate-200 font-bold" />
                </div>
                <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Tahun Ajaran Aktif</Label>
                    <Input value={tahunAjaran} onChange={e => updateTahunAjaran(e.target.value)} className="h-12 rounded-xl border-slate-200 font-bold" />
                </div>
                <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Jenis Kepala (Template)</Label>
                    <Select value={jenisKepala} onValueChange={(v) => updateJenisKepala(v)}>
                        <SelectTrigger className="h-12 rounded-xl border-slate-200 font-bold">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="auto">Otomatis (dari data guru)</SelectItem>
                            <SelectItem value="nonpns">Non-PNS / GTY / GTT</SelectItem>
                            <SelectItem value="pns">PNS / ASN</SelectItem>
                            <SelectItem value="plt">PLT (Pelaksana Tugas)</SelectItem>
                        </SelectContent>
                    </Select>
                    {jenisKepala === "auto" && <p className="text-[10px] text-slate-400">Deteksi otomatis dari NIP/status/golongan guru</p>}
                </div>
            </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-white rounded-[2.5rem] overflow-hidden">
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10 shadow-sm">
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
                                        {user?.role === 'super_admin' && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                title="Hapus pengajuan"
                                                onClick={() => { setDeleteTarget(item); setIsDeleteModalOpen(true) }}
                                                className="h-10 w-10 rounded-xl text-rose-400 hover:text-rose-600 hover:bg-rose-50"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        )}
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

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteModalOpen} onOpenChange={(v) => { if (!isProcessing) { setIsDeleteModalOpen(v); if (!v) setDeleteTarget(null) } }}>
            <DialogContent className="rounded-[2.5rem] p-10 border-0 shadow-2xl sm:max-w-md">
                <DialogHeader className="items-center text-center">
                    <div className="bg-rose-50 h-16 w-16 rounded-3xl flex items-center justify-center mb-4 mx-auto">
                        <Trash2 className="h-8 w-8 text-rose-500" />
                    </div>
                    <DialogTitle className="text-xl font-black uppercase tracking-tight text-rose-600">Hapus Pengajuan?</DialogTitle>
                    <DialogDescription className="font-bold text-slate-500 text-xs pt-2">
                        Pengajuan SK Kepala berikut akan dihapus permanen:
                        <br />
                        <span className="text-slate-800 font-black">{deleteTarget?.teacher?.nama || deleteTarget?.teacher_name}</span>
                        <br />
                        <span className="text-slate-500">{deleteTarget?.school?.nama || deleteTarget?.school_name} — Periode Ke-{deleteTarget?.periode}</span>
                        <br /><br />
                        Aktivitas ini tetap tercatat di log. Tindakan tidak dapat dibatalkan.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="mt-6 flex gap-3 sm:justify-center">
                    <Button variant="outline" onClick={() => { setIsDeleteModalOpen(false); setDeleteTarget(null) }} disabled={isProcessing} className="flex-1 h-12 rounded-2xl font-black uppercase text-xs tracking-widest">
                        Batal
                    </Button>
                    <Button onClick={handleDeleteTenure} disabled={isProcessing} className="flex-1 h-12 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black uppercase text-xs tracking-widest shadow-xl shadow-rose-100">
                        {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Ya, Hapus'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>            <DialogContent className="rounded-[2.5rem] p-10 border-0 shadow-2xl">
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
