import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { getHeadmasterRecommendation, approveHeadmasterRecommendation, rejectHeadmasterRecommendation } from "@/services/headmasterRecommendation.service"
import { authApi } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { ArrowLeft, Clock, Download, CheckCircle, XCircle, AlertCircle, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Card } from "@/components/ui/card"

export function HeadmasterRecommendationDetailPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const user = authApi.getStoredUser()
    const isOperator = user?.role === "operator"

    const { data: recData, isLoading, refetch } = useQuery({
        queryKey: ['headmaster-recommendation', id],
        queryFn: () => getHeadmasterRecommendation(id as string),
        enabled: !!id
    })

    const recommendation = recData?.data || recData

    const [isApproveOpen, setIsApproveOpen] = useState(false)
    const [isRejectOpen, setIsRejectOpen] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const [rejectionReason, setRejectionReason] = useState("")

    const handleApprove = async () => {
        setIsProcessing(true)
        try {
            await approveHeadmasterRecommendation(id as string)
            toast.success("Rekomendasi disetujui")
            setIsApproveOpen(false)
            refetch()
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Gagal menyetujui")
        } finally {
            setIsProcessing(false)
        }
    }

    const handleReject = async () => {
        if (!rejectionReason.trim()) return toast.error("Alasan wajib diisi")
        setIsProcessing(true)
        try {
            await rejectHeadmasterRecommendation(id as string, { rejection_reason: rejectionReason })
            toast.success("Pengajuan ditolak")
            setIsRejectOpen(false)
            refetch()
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Gagal menolak")
        } finally {
            setIsProcessing(false)
        }
    }

    if (isLoading) {
        return <div className="p-20 text-center animate-pulse font-bold text-slate-400">Loading details...</div>
    }

    if (!recommendation) {
        return <div className="p-20 text-center font-bold text-rose-400">Data tidak ditemukan</div>
    }

    const docs = recommendation.documents || {}

    return (
        <div className="space-y-8 pb-20">
            <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={() => navigate(-1)} className="rounded-full w-12 h-12 p-0 hover:bg-slate-100">
                    <ArrowLeft className="w-5 h-5 text-slate-600" />
                </Button>
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">Detail Rekomendasi Kepala</h1>
                    <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                        {recommendation.teacher?.nama} • {recommendation.school?.nama}
                    </p>
                </div>
            </div>

            <Card className="border-0 shadow-sm bg-white rounded-[2.5rem] p-10 space-y-8">
                <div className="flex items-center justify-between border-b border-slate-100 pb-8">
                    <div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status Pengajuan</div>
                        <div className={`inline-flex items-center px-4 py-2 rounded-xl text-xs font-black uppercase tracking-tight ${
                            recommendation.status === "Approved" ? "bg-emerald-100 text-emerald-700" :
                            recommendation.status === "Rejected" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                        }`}>
                            {recommendation.status === "Pending" && <Clock className="w-4 h-4 mr-2" />}
                            {recommendation.status === "Approved" && <CheckCircle className="w-4 h-4 mr-2" />}
                            {recommendation.status === "Rejected" && <XCircle className="w-4 h-4 mr-2" />}
                            {recommendation.status}
                        </div>
                        {recommendation.status === "Rejected" && (
                            <div className="mt-3 text-xs font-bold text-rose-500 bg-rose-50 p-3 rounded-xl border border-rose-100">
                                <span className="uppercase tracking-widest text-[9px] block mb-1">Alasan Penolakan:</span>
                                {recommendation.rejection_reason}
                            </div>
                        )}
                        {recommendation.is_reappointment && (
                            <div className="mt-3 text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg inline-flex items-center border border-blue-100">
                                <AlertCircle className="w-3 h-3 mr-1.5" /> Pengajuan Kembali (Sudah Pernah Menjabat)
                            </div>
                        )}
                    </div>

                    {(user?.role === 'super_admin' || user?.role === 'admin_yayasan') && recommendation.status === "Pending" && (
                        <div className="flex gap-3">
                            <Button onClick={() => setIsApproveOpen(true)} className="h-12 rounded-2xl px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest shadow-xl shadow-emerald-100">
                                Setujui
                            </Button>
                            <Button variant="ghost" onClick={() => setIsRejectOpen(true)} className="h-12 rounded-2xl px-8 text-rose-600 font-black uppercase text-[10px] tracking-widest hover:bg-rose-50">
                                Tolak
                            </Button>
                        </div>
                    )}
                </div>

                <div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 mb-6">Dokumen Persyaratan</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <FileItem label="1. Daftar Riwayat Hidup" url={docs.cv} required />
                        <FileItem label="2. Kartu PTK" url={docs.kartu_ptk} required />
                        <FileItem label="3. FC Legalisir Ijazah S1" url={docs.ijazah_s1} required />
                        <FileItem label="4. FC Sertifikat Pendidik" url={docs.sertifikat_pendidik} />
                        <FileItem label="5. FC SK Guru Awal & Terakhir" url={docs.sk_guru} required />
                        <FileItem label="6. FC SK PNS Terakhir" url={docs.sk_pns} />
                        <FileItem label="7. SK Pengalaman Manajerial" url={docs.pengalaman_manajerial} required />
                        <FileItem label="8. Bukti Masa Kerja > 6 Tahun" url={docs.masa_kerja} required />
                        <FileItem label="9. Form Ajuan SIMPATIKA (A09)" url={docs.form_a09} required />
                        <FileItem label="10. SK Sehat & Bebas NAPZA" url={docs.keterangan_sehat} required />
                        <FileItem label="11. Surat Bebas Hukuman Disiplin" url={docs.bebas_hukuman} required />
                        <FileItem label="12. Surat Bebas Pidana" url={docs.bebas_pidana} required />
                        <FileItem label="13. PK Guru (2 th) min BAIK" url={docs.pk_guru} required />
                        
                        {recommendation.is_reappointment && (
                            <FileItem label="14. PK Kepala (4 th) min BAIK" url={docs.pk_kepala} required />
                        )}
                        
                        <FileItem label="15. KTP (< 55 Tahun)" url={docs.ktp} required />
                        <FileItem label="16. Surat Rekomendasi" url={docs.rekomendasi} required />
                    </div>
                </div>
            </Card>

            {/* Approve Modal */}
            <Dialog open={isApproveOpen} onOpenChange={setIsApproveOpen}>
                <DialogContent className="rounded-[2.5rem] p-10 border-0 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black uppercase tracking-tight text-emerald-600">Persetujuan</DialogTitle>
                        <DialogDescription className="font-bold text-slate-400 text-[10px] uppercase">
                            Setujui rekomendasi kepala untuk {recommendation.teacher?.nama}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-8">
                        <p className="text-sm font-bold text-slate-600">Anda yakin semua dokumen telah diverifikasi dan valid?</p>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsApproveOpen(false)} className="rounded-xl font-black uppercase text-[10px] tracking-widest text-slate-400">Batal</Button>
                        <Button onClick={handleApprove} disabled={isProcessing} className="h-14 px-10 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-xs tracking-widest shadow-xl shadow-emerald-100">
                             {isProcessing ? <Loader2 className="animate-spin h-5 w-5" /> : 'Setujui Pengajuan'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reject Modal */}
            <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
                <DialogContent className="rounded-[2.5rem] p-10 border-0 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black uppercase tracking-tight text-rose-600">Penolakan Berkas</DialogTitle>
                        <DialogDescription className="font-bold text-slate-400 text-[10px] uppercase">
                            Berikan alasan penolakan
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-8">
                        <Label className="text-[10px] font-black uppercase text-slate-400">Alasan Penolakan</Label>
                        <Input placeholder="Contoh: Dokumen KTP tidak terbaca / buram" value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} className="h-14 rounded-2xl border-slate-200 mt-2 font-bold" />
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsRejectOpen(false)} className="rounded-xl font-black uppercase text-[10px] tracking-widest text-slate-400">Batal</Button>
                        <Button onClick={handleReject} disabled={isProcessing} className="h-14 px-10 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black uppercase text-xs tracking-widest shadow-xl shadow-rose-100">
                             {isProcessing ? <Loader2 className="animate-spin h-5 w-5" /> : 'Kirim Penolakan'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

function FileItem({ label, url, required }: { label: string, url?: string, required?: boolean }) {
    return (
        <div className="group relative bg-slate-50 p-6 rounded-3xl border border-slate-100 hover:border-blue-300 transition-all flex flex-col justify-between h-[120px]">
            <div>
                <div className="text-[10px] font-black text-slate-600 uppercase tracking-tight leading-relaxed">{label}</div>
                {!required && <div className="text-[8px] font-bold text-amber-500 uppercase mt-0.5">(Opsional)</div>}
            </div>
            <div className="mt-4">
                {url ? (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between font-bold text-slate-700 hover:text-blue-600">
                        <span className="text-xs">Lihat Dokumen</span>
                        <Download className="w-4 h-4 text-slate-300 group-hover:text-blue-500" />
                    </a>
                ) : (
                    <span className="text-xs text-rose-400 font-bold italic">Belum Diunggah</span>
                )}
            </div>
        </div>
    )
}
