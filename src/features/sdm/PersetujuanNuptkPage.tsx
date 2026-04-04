import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { nuptkApi } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, Clock, Eye, Download, Loader2, Filter, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { Label } from "@/components/ui/label"

export function PersetujuanNuptkPage() {
    const [statusFilter, setStatusFilter] = useState<string>("Pending")
    
    // 🔥 REST API QUERY
    const { data: submissionsRes, isLoading, refetch } = useQuery({
        queryKey: ['nuptk-submissions-admin', statusFilter],
        queryFn: () => nuptkApi.list({ status: statusFilter !== 'All' ? statusFilter : undefined, per_page: 100 })
    })

    const submissions = submissionsRes?.data || []

    const [isApproveOpen, setIsApproveOpen] = useState(false)
    const [isRejectOpen, setIsRejectOpen] = useState(false)
    const [isDetailsOpen, setIsDetailsOpen] = useState(false)
    const [selectedSub, setSelectedSub] = useState<any>(null)
    const [isProcessing, setIsProcessing] = useState(false)

    // Approval Data
    const [recomNumber, setRecomNumber] = useState("")
    const [recomDate, setRecomDate] = useState("")
    const [rejectionReason, setRejectionReason] = useState("")

    const handleApprove = async () => {
        if (!recomNumber || !recomDate) return toast.error("Lengkapi data rekomendasi")
        setIsProcessing(true)
        try {
            await nuptkApi.approve(selectedSub.id, {
                nomor_surat_rekomendasi: recomNumber,
                tanggal_surat_rekomendasi: recomDate
            })
            toast.success("Pengajuan disetujui")
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
            await nuptkApi.reject(selectedSub.id, { rejection_reason: rejectionReason })
            toast.success("Pengajuan ditolak")
            setIsRejectOpen(false)
            refetch()
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Gagal menolak")
        } finally {
            setIsProcessing(false)
        }
    }

    return (
        <div className="space-y-10 pb-20">
            <div className="flex items-center justify-between">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase italic">Validasi Berkas NUPTK</h1>
                    <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2">
                        <AlertCircle className="w-3 h-3 text-blue-500" /> Verifikasi data & Terbitkan Surat Rekomendasi Resmi
                    </p>
                </div>
                <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl">
                    {["Pending", "Approved", "Rejected", "All"].map((s) => (
                        <Button key={s} variant="ghost" onClick={() => setStatusFilter(s)} className={`h-10 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${statusFilter === s ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}>
                            {s}
                        </Button>
                    ))}
                </div>
            </div>

            <Card className="border-0 shadow-sm bg-white rounded-[2.5rem] overflow-hidden">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-slate-50 border-b border-slate-100">
                            <TableRow>
                                <TableHead className="p-8 text-[10px] font-black uppercase text-slate-400 tracking-widest">Informasi Guru</TableHead>
                                <TableHead className="p-8 text-[10px] font-black uppercase text-slate-400 tracking-widest">Lembaga Induk</TableHead>
                                <TableHead className="p-8 text-[10px] font-black uppercase text-slate-400 tracking-widest">Tanggal</TableHead>
                                <TableHead className="p-8 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Status</TableHead>
                                <TableHead className="p-8 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Manajemen</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={5} className="text-center py-24 animate-pulse uppercase font-black text-slate-300 text-xs italic tracking-widest">Verifying Submission Data...</TableCell></TableRow>
                            ) : submissions.length === 0 ? (
                                <TableRow><TableCell colSpan={5} className="text-center py-24 font-bold text-slate-300 text-xs italic">Tidak ada pengajuan ditemukan</TableCell></TableRow>
                            ) : submissions.map((sub: any) => (
                                <TableRow key={sub.id} className="hover:bg-slate-50/30 transition-colors">
                                    <TableCell className="p-8">
                                        <div className="font-black text-slate-800 text-sm tracking-tight">{sub.teacher?.nama}</div>
                                        <div className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">NIP: {sub.teacher?.nip || '-'}</div>
                                    </TableCell>
                                    <TableCell className="p-8 font-bold text-slate-500 text-xs">{sub.school?.nama}</TableCell>
                                    <TableCell className="p-8 text-xs font-bold text-slate-400">{new Date(sub.submitted_at).toLocaleDateString("id-ID", {day:'numeric', month:'long', year:'numeric'})}</TableCell>
                                    <TableCell className="p-8 text-center">
                                        <div className={`inline-flex items-center px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-tight ${
                                            sub.status === "Approved" ? "bg-emerald-100 text-emerald-700" :
                                            sub.status === "Rejected" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                                        }`}>
                                            {sub.status === "Pending" && <Clock className="w-3 h-3 mr-2" />}
                                            {sub.status}
                                        </div>
                                    </TableCell>
                                    <TableCell className="p-8 text-right">
                                        <div className="flex justify-end gap-3">
                                            <Button variant="outline" size="sm" onClick={() => { setSelectedSub(sub); setIsDetailsOpen(true)}} className="h-10 rounded-xl px-4 border-slate-200 font-black uppercase text-[10px] tracking-widest">
                                                <Eye className="w-4 h-4 mr-2 text-blue-500" /> Berkas
                                            </Button>
                                            {sub.status === "Pending" && (
                                                <>
                                                    <Button onClick={() => { setSelectedSub(sub); setRecomNumber(""); setRecomDate(""); setIsApproveOpen(true)}} className="h-10 rounded-xl px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest">Valid</Button>
                                                    <Button variant="ghost" onClick={() => { setSelectedSub(sub); setRejectionReason(""); setIsRejectOpen(true)}} className="h-10 rounded-xl px-6 text-rose-600 font-black uppercase text-[10px] tracking-widest hover:bg-rose-50">Reject</Button>
                                                </>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </Card>

            {/* Details Modal */}
            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent className="max-w-2xl rounded-[2.5rem] p-10 border-0 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black uppercase tracking-tight">E-Dossier: {selectedSub?.teacher?.nama}</DialogTitle>
                        <DialogDescription className="font-bold text-slate-400 text-[10px] uppercase tracking-widest">Verifikasi Autentikasi Dokumen Fisik</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4 py-8">
                        <FileItem label="KARTU TANDA PENDUDUK" url={selectedSub?.dokumen_ktp_id} />
                        <FileItem label="IJAZAH PENDIDIKAN" url={selectedSub?.dokumen_ijazah_id} />
                        <FileItem label="SK PENGANGKATAN" url={selectedSub?.dokumen_pengangkatan_id} />
                        <FileItem label="SK PENUGASAN BERKALA" url={selectedSub?.dokumen_penugasan_id} />
                    </div>
                </DialogContent>
            </Dialog>

            {/* Approve Modal */}
            <Dialog open={isApproveOpen} onOpenChange={setIsApproveOpen}>
                <DialogContent className="rounded-[2.5rem] p-10 border-0 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black uppercase tracking-tight text-emerald-600 italic">Penerbitan Rekomendasi</DialogTitle>
                        <DialogDescription className="font-bold text-slate-400 text-[10px] uppercase">Input data surat pengantar untuk {selectedSub?.teacher?.nama}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 py-8">
                        <div className="space-y-2">
                             <Label className="text-[10px] font-black uppercase text-slate-400">Nomor Surat Rekomendasi</Label>
                             <Input placeholder="Contoh: 123/PC.LP/XII/2023" value={recomNumber} onChange={e => setRecomNumber(e.target.value)} className="h-14 rounded-2xl border-slate-200 font-black text-slate-800" />
                        </div>
                        <div className="space-y-2">
                             <Label className="text-[10px] font-black uppercase text-slate-400">Tanggal Terbit</Label>
                             <Input type="date" value={recomDate} onChange={e => setRecomDate(e.target.value)} className="h-14 rounded-2xl border-slate-200 font-bold" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsApproveOpen(false)} className="rounded-xl font-black uppercase text-[10px] tracking-widest text-slate-400">Batal</Button>
                        <Button onClick={handleApprove} disabled={isProcessing} className="h-14 px-10 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-xs tracking-widest shadow-xl shadow-emerald-100">
                             {isProcessing ? <Loader2 className="animate-spin h-5 w-5" /> : 'Terbitkan & Setujui'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reject Modal */}
            <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
                <DialogContent className="rounded-[2.5rem] p-10 border-0 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black uppercase tracking-tight text-rose-600 italic">Penolakan Berkas</DialogTitle>
                        <DialogDescription className="font-bold text-slate-400 text-[10px] uppercase">Berikan alasan mengapa pengajuan ini tidak valid</DialogDescription>
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

function FileItem({ label, url }: { label: string, url?: string }) {
    return (
        <div className="group relative bg-slate-50 p-6 rounded-3xl border border-slate-100 hover:border-blue-300 transition-all">
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">{label}</div>
            {url ? (
                <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between font-bold text-slate-700 hover:text-blue-600">
                    <span className="text-xs">Lihat Dokumen</span>
                    <Download className="w-4 h-4 text-slate-300 group-hover:text-blue-500" />
                </a>
            ) : (
                <span className="text-xs text-rose-400 font-bold italic">Berkas Kosong</span>
            )}
        </div>
    )
}
