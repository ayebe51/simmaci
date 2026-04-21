import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { BadgeCheck, CheckCircle, Download, FileText, XCircle, Upload, Loader2, Search, Filter, Calendar, Settings2 } from "lucide-react"
import { useState, useMemo } from "react"
import { headmasterApi, mediaApi, authApi, settingApi } from "@/lib/api"
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
            nomor_sk: nomorStart, // In a real app, this might be more complex
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
        const media = await mediaApi.upload(file, 'sk-final')
        await headmasterApi.update(selectedId, { sk_url: media.url, status: 'Approved' })
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
    const loaderId = toast.loading("Menyiapkan Dokumen...")
    try {
        // 1. Fetch Template from Backend
        const settings = await settingApi.list();
        const templateKey = 'sk_template_kamad'; // simplified logic
        const templateBlob = settings.find((s: any) => s.key === templateKey)?.value;

        if (!templateBlob) throw new Error("Template SK tidak ditemukan di pengaturan sistem")

        // 2. QR Code
        const verificationUrl = getSkVerificationUrl(item.id);
        const qrDataUrl = await QRCode.toDataURL(verificationUrl, { width: 400, margin: 1 });

        // 3. Prepare Data
        const docData = {
            qrcode: qrDataUrl,
            NAMA: item.teacher?.nama || "",
            NIP: item.teacher?.nip || "-",
            UNIT_KERJA: item.school?.nama || "",
            JABATAN: "Kepala Madrasah",
            MASA_BHAKTI: `${new Date(item.start_date).getFullYear()} - ${new Date(item.end_date).getFullYear()}`,
            TANGGAL_PENETAPAN: tanggalPenetapan || new Date().toLocaleDateString("id-ID"),
            NOMOR_SK: `${nomorStart}/...`, // etc
            KABUPATEN: "Cilacap",
            TAHUN_AJARAN: tahunAjaran
        }

        // 4. Generate DOCX
        const cleanBase64 = templateBlob.replace(/^data:.*?;base64,/, "");
        const zip = new PizZip(cleanBase64, { base64: true });
        
        // Auto-fix tags for image module
        const docFile = zip.file("word/document.xml");
        if (docFile) {
            let content = docFile.asText();
            if (content.includes("qrcode") && !content.includes("%qrcode")) {
                content = content.replace(/{qrcode}/g, "{%qrcode}");
                zip.file("word/document.xml", content);
            }
        }

        const doc = new Docxtemplater(zip, {
            modules: [new ImageModule({
                centered: false,
                getImage: (tagValue: string) => {
                    const stringBase64 = tagValue.replace(/^data:image\/(png|jpg|svg|svg\+xml);base64,/, "");
                    const binaryString = window.atob(stringBase64);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
                    return bytes.buffer;
                },
                getSize: () => [100, 100]
            })],
            paragraphLoop: true,
            linebreaks: true,
            nullGetter: () => ""
        });

        doc.render(docData);
        const out = doc.getZip().generate({ type: "blob" });
        saveAs(out, `SK_Kamad_${item.teacher?.nama}.docx`);
        toast.success("SK Berhasil Dibuat", { id: loaderId })
    } catch (e: any) {
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
                                     <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg">Ke-{item.period_number}</span>
                                </TableCell>
                                <TableCell className="p-8">
                                   <Badge className={cn("rounded-lg text-[9px] font-black uppercase px-3 py-1", 
                                       item.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' : 
                                       item.status === 'Rejected' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                                   )}>{item.status}</Badge>
                                </TableCell>
                                <TableCell className="p-8 text-right">
                                    <div className="flex justify-end gap-2">
                                        {item.status === 'Pending' && (
                                            <>
                                                <Button size="sm" onClick={() => handleApprove(item.id)} className="h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest px-6 shadow-lg shadow-emerald-100">Approve</Button>
                                                <Button variant="ghost" size="sm" onClick={() => { setSelectedId(item.id); setRejectReason(""); setIsRejectModalOpen(true)}} className="h-10 rounded-xl text-rose-600 font-black uppercase text-[10px] tracking-widest px-6 hover:bg-rose-50">Reject</Button>
                                            </>
                                        )}
                                        {item.status === 'Approved' && (
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
