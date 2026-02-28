import { useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, Clock, Eye, Download } from "lucide-react"
import { toast } from "sonner"
import SoftPageHeader from "@/components/ui/SoftPageHeader"
import { Id } from "../../../convex/_generated/dataModel"

export function PersetujuanNuptkPage() {
    const submissions = useQuery(api.nuptk.listRequests, {}) || []
    
    // Status Filter
    const [statusFilter, setStatusFilter] = useState<"All" | "Pending" | "Approved" | "Rejected">("Pending")
    
    // Approval Modal State
    const [isApproveOpen, setIsApproveOpen] = useState(false)
    const [isRejectOpen, setIsRejectOpen] = useState(false)
    const [selectedSub, setSelectedSub] = useState<any>(null)
    const [rejectionReason, setRejectionReason] = useState("")
    const [isProcessing, setIsProcessing] = useState(false)

    // Details Modal State
    const [isDetailsOpen, setIsDetailsOpen] = useState(false)

    const updateStatus = useMutation(api.nuptk.updateStatus)

    const handleApprove = async () => {
        if (!selectedSub) return
        setIsProcessing(true)
        const loadingId = toast.loading("Memproses persetujuan...")
        try {
            await updateStatus({
                id: selectedSub._id,
                status: "Approved"
            })
            toast.success("Pengajuan disetujui!", { id: loadingId })
            setIsApproveOpen(false)
            setSelectedSub(null)
        } catch (error: any) {
            toast.error(error.message || "Gagal menyetujui pengajuan", { id: loadingId })
        } finally {
            setIsProcessing(false)
        }
    }

    const handleReject = async () => {
        if (!selectedSub || !rejectionReason.trim()) {
            toast.error("Alasan penolakan wajib diisi!")
            return
        }
        setIsProcessing(true)
        const loadingId = toast.loading("Memproses penolakan...")
        try {
            await updateStatus({
                id: selectedSub._id,
                status: "Rejected",
                rejectionReason
            })
            toast.success("Pengajuan ditolak", { id: loadingId })
            setIsRejectOpen(false)
            setSelectedSub(null)
            setRejectionReason("")
        } catch (error: any) {
            toast.error(error.message || "Gagal menolak pengajuan", { id: loadingId })
        } finally {
            setIsProcessing(false)
        }
    }

    const filteredSubmissions = submissions.filter(s => statusFilter === "All" || s.status === statusFilter)

    return (
        <div className="space-y-6">
            <SoftPageHeader 
                title="Persetujuan NUPTK"
                description="Verifikasi dokumen dan berikan keputusan atas pengajuan NUPTK dari lembaga."
            />

            <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white/60 backdrop-blur-xl overflow-hidden relative z-10 flex flex-col h-full rounded-2xl">
                <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[60%] bg-emerald-400/10 blur-[100px] pointer-events-none rounded-full" />
                <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[60%] bg-blue-400/10 blur-[100px] pointer-events-none rounded-full" />
                <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-white/60 bg-white/40">
                    <CardTitle className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">Antrean Pengajuan</CardTitle>
                    <div className="flex gap-2">
                        <Button variant={statusFilter === "Pending" ? "default" : "outline"} onClick={() => setStatusFilter("Pending")} size="sm" className={statusFilter === "Pending" ? "bg-emerald-600 hover:bg-emerald-700" : ""}>Pending</Button>
                        <Button variant={statusFilter === "Approved" ? "default" : "outline"} onClick={() => setStatusFilter("Approved")} size="sm" className={statusFilter === "Approved" ? "bg-emerald-600 hover:bg-emerald-700" : ""}>Disetujui</Button>
                        <Button variant={statusFilter === "Rejected" ? "default" : "outline"} onClick={() => setStatusFilter("Rejected")} size="sm" className={statusFilter === "Rejected" ? "bg-red-600 hover:bg-red-700" : ""}>Ditolak</Button>
                        <Button variant={statusFilter === "All" ? "default" : "outline"} onClick={() => setStatusFilter("All")} size="sm" className={statusFilter === "All" ? "bg-emerald-600 hover:bg-emerald-700" : ""}>Semua</Button>
                    </div>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="rounded-md border h-[550px] overflow-auto">
                        <Table>
                            <TableHeader className="bg-emerald-50/80 sticky top-0 z-10 shadow-sm backdrop-blur-sm">
                                <TableRow className="border-b border-emerald-100/60">
                                    <TableHead className="font-semibold text-emerald-800">Nama Guru</TableHead>
                                    <TableHead className="font-semibold text-emerald-800">Lembaga Induk</TableHead>
                                    <TableHead className="font-semibold text-emerald-800">Tanggal Pengajuan</TableHead>
                                    <TableHead className="font-semibold text-emerald-800">Status</TableHead>
                                    <TableHead className="text-right font-semibold text-emerald-800">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredSubmissions.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center h-48 text-muted-foreground">
                                            Tidak ada data pengajuan dengan status {statusFilter}.
                                        </TableCell>
                                    </TableRow>
                                ) : filteredSubmissions.map(sub => (
                                    <TableRow key={sub._id}>
                                        <TableCell className="font-medium">{sub.teacherName}</TableCell>
                                        <TableCell>{sub.schoolName}</TableCell>
                                        <TableCell>{new Date(sub.submittedAt).toLocaleDateString("id-ID", { day: '2-digit', month: 'long', year: 'numeric' })}</TableCell>
                                        <TableCell>
                                            {sub.status === "Pending" && <Badge variant="secondary" className="bg-amber-100 text-amber-800"><Clock className="w-3 h-3 mr-1"/> Pending</Badge>}
                                            {sub.status === "Approved" && <Badge variant="secondary" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1"/> Disetujui</Badge>}
                                            {sub.status === "Rejected" && <Badge variant="secondary" className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1"/> Ditolak</Badge>}
                                        </TableCell>
                                        <TableCell className="text-right flex justify-end gap-2">
                                            <Button variant="outline" size="sm" onClick={() => {
                                                setSelectedSub(sub)
                                                setIsDetailsOpen(true)
                                            }}>
                                                <Eye className="w-4 h-4 mr-1" /> Berkas
                                            </Button>
                                            
                                            {sub.status === "Pending" && (
                                                <>
                                                    <Button variant="outline" size="sm" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => {
                                                        setSelectedSub(sub)
                                                        setIsApproveOpen(true)
                                                    }}>
                                                        Setujui
                                                    </Button>
                                                    <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => {
                                                        setSelectedSub(sub)
                                                        setRejectionReason("")
                                                        setIsRejectOpen(true)
                                                    }}>
                                                        Tolak
                                                    </Button>
                                                </>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Berkas Modal */}
            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Berkas Persyaratan: {selectedSub?.teacherName}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <FileLink label="1. KTP" storageId={selectedSub?.dokumenKtpId} />
                        <FileLink label="2. Ijazah (SD s/d Terakhir)" storageId={selectedSub?.dokumenIjazahId} />
                        <FileLink label="3. SK Pengangkatan" storageId={selectedSub?.dokumenPengangkatanId} />
                        <FileLink label="4. SK Penugasan (Min. 2 Tahun)" storageId={selectedSub?.dokumenPenugasanId} />
                    </div>
                </DialogContent>
            </Dialog>

            {/* Approve Modal */}
            <Dialog open={isApproveOpen} onOpenChange={setIsApproveOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Setujui Pengajuan</DialogTitle>
                    </DialogHeader>
                    <p className="py-4 text-sm text-slate-600">
                        Apakah Anda yakin ingin menyetujui pengajuan rekomendasi NUPTK untuk <b>{selectedSub?.teacherName}</b> dari lembaga <b>{selectedSub?.schoolName}</b>?
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsApproveOpen(false)}>Batal</Button>
                        <Button onClick={handleApprove} disabled={isProcessing} className="bg-green-600 hover:bg-green-700">Ya, Setujui</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reject Modal */}
            <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-red-600">Tolak Pengajuan</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <label className="text-sm font-medium mb-1 block">Alasan Penolakan</label>
                        <Input 
                            placeholder="Contoh: Dokumen KTP buram / Ijazah tidak terbaca" 
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsRejectOpen(false)}>Batal</Button>
                        <Button onClick={handleReject} disabled={isProcessing || !rejectionReason.trim()} variant="destructive">Tolak Pengajuan</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

function FileLink({ label, storageId }: { label: string, storageId?: string }) {
    const url = useQuery(api.nuptk.getDocumentUrl, { storageId }) || null
    
    return (
        <div className="flex justify-between items-center p-3 border rounded-lg bg-slate-50">
            <span className="text-sm font-medium">{label}</span>
            {url ? (
                <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center text-xs bg-white border shadow-sm px-3 py-1.5 rounded-md hover:bg-slate-100 transition-colors text-blue-600">
                    <Download className="w-3 h-3 mr-1" /> Unduh / Lihat
                </a>
            ) : (
                <span className="text-xs text-red-500 italic">Berkas Kosong</span>
            )}
        </div>
    )
}
