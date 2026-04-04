import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { nuptkApi, teacherApi, mediaApi, authApi } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Send, UploadCloud, CheckCircle, XCircle, Clock, Loader2, Search, FileText } from "lucide-react"
import { toast } from "sonner"

export function PengajuanNuptkPage() {
    const user = authApi.getStoredUser()
    const isOperator = user?.role === "operator"

    const [searchTerm, setSearchTerm] = useState("")
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedTeacher, setSelectedTeacher] = useState<any>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [files, setFiles] = useState<{
        ktp?: string,
        ijazah?: string,
        pengangkatan?: string,
        penugasan?: string
    }>({})

    // 🔥 REST API QUERIES
    const { data: teachersRes, isLoading: loadingTeachers } = useQuery({
        queryKey: ['teachers-nuptk-eligible', searchTerm],
        queryFn: () => teacherApi.list({ 
            search: searchTerm || undefined,
            per_page: 50
        })
    })

    const { data: submissionsRes, isLoading: loadingSubmissions, refetch: refetchSubmissions } = useQuery({
        queryKey: ['nuptk-submissions-history'],
        queryFn: () => nuptkApi.list({ per_page: 50 })
    })

    const teachers = teachersRes?.data || []
    const submissions = submissionsRes?.data || []

    // Filter eligible: NUPTK is null/empty/dummy
    const eligibleTeachers = teachers.filter((t: any) => {
        if (!t.nuptk) return true;
        const s = String(t.nuptk).trim();
        return s === "" || s === "-" || s === "0" || s.startsWith("TMP-");
    })

    const isTeacherSubmitted = (teacherId: number) => {
        return submissions.some((s: any) => s.teacher_id === teacherId && s.status !== "Rejected")
    }

    const onFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: keyof typeof files) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (file.size > 2 * 1024 * 1024) return toast.error("Max 2MB")

        const loaderId = toast.loading(`Uploading ${type}...`)
        try {
            const res = await mediaApi.upload(file, 'nuptk-docs')
            setFiles(prev => ({ ...prev, [type]: res.url }))
            toast.success(`${type} diunggah`, { id: loaderId })
        } catch (error) {
            toast.error(`Gagal upload ${type}`, { id: loaderId })
        }
    }

    const handleSubmit = async () => {
        if (Object.keys(files).length < 4) return toast.error("Lengkapi dokumen!")
        setIsSubmitting(true)
        try {
            await nuptkApi.store({
                teacher_id: selectedTeacher.id,
                school_id: selectedTeacher.school_id,
                dokumen_ktp_id: files.ktp,
                dokumen_ijazah_id: files.ijazah,
                dokumen_pengangkatan_id: files.pengangkatan,
                dokumen_penugasan_id: files.penugasan
            })
            toast.success("Berhasil mengajukan NUPTK")
            setIsModalOpen(false)
            setFiles({})
            refetchSubmissions()
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Gagal kirim")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="space-y-10 pb-20">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">Rekomendasi NUPTK</h1>
                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                   Ajukan Surat Pengantar Penerbitan NUPTK ke PC LP Ma'arif NU
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* Eligible Teachers */}
                <Card className="border-0 shadow-sm bg-white rounded-[2.5rem] overflow-hidden">
                    <CardHeader className="p-8 border-b bg-slate-50/50">
                        <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-widest">Guru Belum Ber-NUPTK</CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input placeholder="Cari nama guru..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="h-12 rounded-xl pl-12 border-slate-200" />
                        </div>
                        <div className="rounded-2xl border border-slate-100 h-[400px] overflow-auto">
                            <Table>
                                <TableHeader className="bg-slate-50 sticky top-0 z-10">
                                    <TableRow>
                                        <TableHead className="text-[9px] font-black uppercase text-slate-400 py-4 pl-6">Profil Guru</TableHead>
                                        <TableHead className="text-[9px] font-black uppercase text-slate-400 py-4 text-right pr-6">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loadingTeachers ? (
                                        <TableRow><TableCell colSpan={2} className="text-center py-20 animate-pulse text-[10px] uppercase font-black text-slate-300">Syncing Eligible List...</TableCell></TableRow>
                                    ) : eligibleTeachers.map((t: any) => (
                                        <TableRow key={t.id} className="hover:bg-slate-50/50">
                                            <TableCell className="pl-6 py-4">
                                                <div className="font-bold text-slate-800 text-sm">{t.nama}</div>
                                                <div className="text-[9px] font-bold text-slate-400 uppercase">{t.status || 'GTY'}</div>
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                {isTeacherSubmitted(t.id) ? (
                                                    <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-0 text-[9px] font-black uppercase px-3 py-1">In Process</Badge>
                                                ) : (
                                                    <Button size="sm" onClick={() => { setSelectedTeacher(t); setIsModalOpen(true)}} className="h-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[10px] tracking-widest px-6 shadow-lg shadow-blue-100">Ajukan</Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                {/* History */}
                <Card className="border-0 shadow-sm bg-white rounded-[2.5rem] overflow-hidden">
                    <CardHeader className="p-8 border-b bg-slate-50/50">
                        <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-widest">Riwayat Pengajuan Rekomendasi</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 h-[500px] overflow-auto">
                        <Table>
                             <TableHeader className="bg-slate-50 sticky top-0 z-10">
                                <TableRow>
                                    <TableHead className="text-[9px] font-black uppercase text-slate-400 py-4 pl-6">Penerima & Tgl</TableHead>
                                    <TableHead className="text-[9px] font-black uppercase text-slate-400 py-4">Status & Alasan</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {submissions.map((s: any) => (
                                    <TableRow key={s.id}>
                                        <TableCell className="pl-6 py-5">
                                            <div className="font-bold text-slate-800 text-sm">{s.teacher?.nama}</div>
                                            <div className="text-[9px] font-black text-slate-400 uppercase mt-1">{new Date(s.submitted_at).toLocaleDateString("id-ID")}</div>
                                        </TableCell>
                                        <TableCell className="py-5 pr-6">
                                             <div className={`inline-flex items-center px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-tight mb-1 ${
                                                 s.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' :
                                                 s.status === 'Rejected' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                                             }`}>
                                                 {s.status === 'Pending' && <Clock className="w-3 h-3 mr-1.5" />}
                                                 {s.status}
                                             </div>
                                             {s.rejection_reason && <div className="text-[9px] font-bold text-rose-500 max-w-[150px] leading-relaxed">Ket: {s.rejection_reason}</div>}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-2xl rounded-[2.5rem] p-10 border-0 shadow-2xl">
                    <DialogHeader className="space-y-3">
                        <DialogTitle className="text-2xl font-black uppercase tracking-tight">Kirim Berkas Persyaratan</DialogTitle>
                        <DialogDescription className="font-medium text-slate-400">Ajukan NUPTK untuk <span className="text-blue-600 font-bold">{selectedTeacher?.nama}</span>. Seluruh dokumen wajib diunggah.</DialogDescription>
                    </DialogHeader>
                    
                    <div className="grid grid-cols-2 gap-6 py-8">
                        <UploadBox label="SCAN KTP ASLI" id="ktp" hasFile={!!files.ktp} onChange={(e: any) => onFileUpload(e, "ktp")} />
                        <UploadBox label="IJAZAH (SD-TERAKHIR)" id="ijazah" hasFile={!!files.ijazah} onChange={(e: any) => onFileUpload(e, "ijazah")} />
                        <UploadBox label="SK PENGANGKATAN" id="pengangkatan" hasFile={!!files.pengangkatan} onChange={(e: any) => onFileUpload(e, "pengangkatan")} />
                        <UploadBox label="SK PENUGASAN (KAMAD)" id="penugasan" hasFile={!!files.penugasan} onChange={(e: any) => onFileUpload(e, "penugasan")} />
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="rounded-xl font-black uppercase text-[10px] tracking-widest text-slate-400">Batalkan</Button>
                        <Button onClick={handleSubmit} disabled={isSubmitting || Object.keys(files).length < 4} className="h-14 px-10 rounded-2xl bg-slate-900 hover:bg-black text-white font-black uppercase text-xs tracking-widest shadow-xl shadow-slate-200">
                            {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5 text-blue-400" />}
                            Proses Pengajuan
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

function UploadBox({ label, id, hasFile, onChange }: any) {
    return (
        <div className={`relative border-2 border-dashed rounded-[1.5rem] p-6 flex flex-col items-center justify-center text-center transition-all group ${hasFile ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-100 hover:border-blue-400 bg-slate-50/50'}`}>
            <input type="file" id={id} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" accept=".pdf,image/png,image/jpeg" onChange={onChange} />
            {hasFile ? (
                <>
                    <div className="bg-emerald-100 p-3 rounded-full mb-3"><CheckCircle className="h-6 w-6 text-emerald-600" /></div>
                    <span className="text-[10px] font-black uppercase text-emerald-600 tracking-widest">Document Secured</span>
                </>
            ) : (
                <>
                    <div className="bg-white p-3 rounded-full mb-3 shadow-sm group-hover:scale-110 transition-transform"><UploadCloud className="h-6 w-6 text-slate-400" /></div>
                    <span className="text-[10px] font-black uppercase text-slate-600 tracking-widest">{label}</span>
                    <span className="text-[8px] font-bold text-slate-300 uppercase mt-1">Max 2MB (PDF/JPG)</span>
                </>
            )}
        </div>
    )
}
