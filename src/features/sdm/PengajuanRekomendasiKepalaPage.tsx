import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { teacherApi, mediaApi, authApi } from "@/lib/api"
import { 
    getHeadmasterRecommendations, 
    submitHeadmasterRecommendation 
} from "@/services/headmasterRecommendation.service"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Send, UploadCloud, CheckCircle, Clock, Loader2, Search, ArrowLeft } from "lucide-react"
import { toast } from "sonner"

export function PengajuanRekomendasiKepalaPage() {
    const user = authApi.getStoredUser()
    const isOperator = user?.role === "operator"

    const [searchTerm, setSearchTerm] = useState("")
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedTeacher, setSelectedTeacher] = useState<any>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    
    // Form state
    const [isReappointment, setIsReappointment] = useState(false)
    const [files, setFiles] = useState<{
        cv?: string;
        kartu_ptk?: string;
        ijazah_s1?: string;
        sertifikat_pendidik?: string;
        sk_guru?: string;
        sk_pns?: string;
        pengalaman_manajerial?: string;
        masa_kerja?: string;
        form_a09?: string;
        keterangan_sehat?: string;
        bebas_hukuman?: string;
        bebas_pidana?: string;
        pk_guru?: string;
        pk_kepala?: string;
        ktp?: string;
        rekomendasi?: string;
    }>({})

    // REST API QUERIES
    const { data: teachersRes, isLoading: loadingTeachers } = useQuery({
        queryKey: ['teachers-headmaster-eligible', searchTerm],
        queryFn: () => teacherApi.list({ 
            search: searchTerm || undefined,
            per_page: 50
        })
    })

    const { data: submissionsRes, isLoading: loadingSubmissions, refetch: refetchSubmissions } = useQuery({
        queryKey: ['headmaster-recommendation-history'],
        queryFn: () => getHeadmasterRecommendations({ per_page: 50 })
    })

    const teachers = teachersRes?.data || []
    const submissions = submissionsRes?.data || []

    const eligibleTeachers = teachers

    const isTeacherSubmitted = (teacherId: number) => {
        return submissions.some((s: any) => s.teacher_id === teacherId && s.status !== "Rejected")
    }

    const onFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: keyof typeof files) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (file.size > 5 * 1024 * 1024) return toast.error("Max 5MB")

        const loaderId = toast.loading(`Uploading...`)
        try {
            const res = await mediaApi.upload(file, 'headmaster-docs')
            setFiles(prev => ({ ...prev, [type]: res.url }))
            toast.success(`Dokumen diunggah`, { id: loaderId })
        } catch (error) {
            toast.error(`Gagal upload dokumen`, { id: loaderId })
        }
    }

    const handleSubmit = async () => {
        // Validate required files
        const requiredFiles = [
            'cv', 'kartu_ptk', 'ijazah_s1', 'sk_guru', 
            'pengalaman_manajerial', 'masa_kerja', 'form_a09', 
            'keterangan_sehat', 'bebas_hukuman', 'bebas_pidana', 
            'pk_guru', 'ktp', 'rekomendasi'
        ]
        
        for (const req of requiredFiles) {
            if (!files[req as keyof typeof files]) {
                return toast.error("Ada dokumen wajib yang belum diunggah!")
            }
        }

        if (isReappointment && !files.pk_kepala) {
            return toast.error("PK Kepala Madrasah wajib diunggah untuk pengajuan kembali!")
        }

        setIsSubmitting(true)
        try {
            await submitHeadmasterRecommendation({
                teacher_id: selectedTeacher.id,
                school_id: selectedTeacher.school_id,
                is_reappointment: isReappointment,
                documents: files
            })
            toast.success("Berhasil mengajukan permohonan rekomendasi kepala")
            setIsModalOpen(false)
            setFiles({})
            setIsReappointment(false)
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
                <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">Permohonan Rekomendasi Kepala</h1>
                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                   Ajukan Surat Rekomendasi Kepala Madrasah ke PC LP Ma'arif NU
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* Eligible Teachers */}
                <Card className="border-0 shadow-sm bg-white rounded-[2.5rem] overflow-hidden">
                    <CardHeader className="p-8 border-b bg-slate-50/50">
                        <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-widest">Pilih Calon Kepala</CardTitle>
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
                                        <TableRow><TableCell colSpan={2} className="text-center py-20 animate-pulse text-[10px] uppercase font-black text-slate-300">Loading List...</TableCell></TableRow>
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
                        <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-widest">Riwayat Pengajuan</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 h-[500px] overflow-auto">
                        <Table>
                             <TableHeader className="bg-slate-50 sticky top-0 z-10">
                                <TableRow>
                                    <TableHead className="text-[9px] font-black uppercase text-slate-400 py-4 pl-6">Calon & Tgl</TableHead>
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
                <DialogContent className="max-w-4xl rounded-[2.5rem] p-10 border-0 shadow-2xl h-[90vh] overflow-hidden flex flex-col">
                    <DialogHeader className="space-y-3 shrink-0">
                        <DialogTitle className="text-2xl font-black uppercase tracking-tight">Kirim Berkas Persyaratan</DialogTitle>
                        <DialogDescription className="font-medium text-slate-400">Ajukan Rekomendasi Kepala untuk <span className="text-blue-600 font-bold">{selectedTeacher?.nama}</span>.</DialogDescription>
                    </DialogHeader>
                    
                    <div className="flex-1 overflow-y-auto pr-4 py-6 space-y-8">
                        <div className="flex items-center space-x-3 bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                            <Checkbox 
                                id="reappointment" 
                                checked={isReappointment} 
                                onCheckedChange={(c) => setIsReappointment(!!c)} 
                            />
                            <Label htmlFor="reappointment" className="text-sm font-bold text-blue-900 cursor-pointer">
                                Guru ini sudah pernah menjabat sebagai Kepala Madrasah sebelumnya (Pengajuan Kembali)
                            </Label>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <UploadBox label="1. Daftar Riwayat Hidup *" id="cv" hasFile={!!files.cv} onChange={(e: any) => onFileUpload(e, "cv")} />
                            <UploadBox label="2. Kartu PTK *" id="kartu_ptk" hasFile={!!files.kartu_ptk} onChange={(e: any) => onFileUpload(e, "kartu_ptk")} />
                            <UploadBox label="3. FC Legalisir Ijasah S1 *" id="ijazah_s1" hasFile={!!files.ijazah_s1} onChange={(e: any) => onFileUpload(e, "ijazah_s1")} />
                            <UploadBox label="4. FC Sertifikat Pendidik" id="sertifikat_pendidik" hasFile={!!files.sertifikat_pendidik} onChange={(e: any) => onFileUpload(e, "sertifikat_pendidik")} optional />
                            <UploadBox label="5. FC SK Guru Awal & Terakhir *" id="sk_guru" hasFile={!!files.sk_guru} onChange={(e: any) => onFileUpload(e, "sk_guru")} />
                            <UploadBox label="6. FC SK PNS Terakhir" id="sk_pns" hasFile={!!files.sk_pns} onChange={(e: any) => onFileUpload(e, "sk_pns")} optional />
                            <UploadBox label="7. SK Pengalaman Manajerial *" id="pengalaman_manajerial" hasFile={!!files.pengalaman_manajerial} onChange={(e: any) => onFileUpload(e, "pengalaman_manajerial")} />
                            <UploadBox label="8. Bukti Masa Kerja > 6 Tahun *" id="masa_kerja" hasFile={!!files.masa_kerja} onChange={(e: any) => onFileUpload(e, "masa_kerja")} />
                            <UploadBox label="9. Form Ajuan SIMPATIKA (A09) *" id="form_a09" hasFile={!!files.form_a09} onChange={(e: any) => onFileUpload(e, "form_a09")} />
                            <UploadBox label="10. SK Sehat & Bebas NAPZA *" id="keterangan_sehat" hasFile={!!files.keterangan_sehat} onChange={(e: any) => onFileUpload(e, "keterangan_sehat")} />
                            <UploadBox label="11. Surat Bebas Hukuman Disiplin *" id="bebas_hukuman" hasFile={!!files.bebas_hukuman} onChange={(e: any) => onFileUpload(e, "bebas_hukuman")} />
                            <UploadBox label="12. Surat Bebas Pidana *" id="bebas_pidana" hasFile={!!files.bebas_pidana} onChange={(e: any) => onFileUpload(e, "bebas_pidana")} />
                            <UploadBox label="13. PK Guru (2 th) min BAIK *" id="pk_guru" hasFile={!!files.pk_guru} onChange={(e: any) => onFileUpload(e, "pk_guru")} />
                            
                            {isReappointment && (
                                <UploadBox label="14. PK Kepala (4 th) min BAIK *" id="pk_kepala" hasFile={!!files.pk_kepala} onChange={(e: any) => onFileUpload(e, "pk_kepala")} />
                            )}
                            
                            <UploadBox label="15. KTP (< 55 Tahun) *" id="ktp" hasFile={!!files.ktp} onChange={(e: any) => onFileUpload(e, "ktp")} />
                            <UploadBox label="16. Surat Rekomendasi Kepala/Pengawas *" id="rekomendasi" hasFile={!!files.rekomendasi} onChange={(e: any) => onFileUpload(e, "rekomendasi")} />
                        </div>
                    </div>

                    <DialogFooter className="shrink-0 pt-6">
                        <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="rounded-xl font-black uppercase text-[10px] tracking-widest text-slate-400">Batalkan</Button>
                        <Button onClick={handleSubmit} disabled={isSubmitting} className="h-14 px-10 rounded-2xl bg-slate-900 hover:bg-black text-white font-black uppercase text-xs tracking-widest shadow-xl shadow-slate-200">
                            {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5 text-blue-400" />}
                            Kirim Persyaratan
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

function UploadBox({ label, id, hasFile, onChange, optional = false }: any) {
    return (
        <div className={`relative border-2 border-dashed rounded-[1.5rem] p-4 flex flex-col items-center justify-center text-center transition-all group min-h-[140px] ${hasFile ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-100 hover:border-blue-400 bg-slate-50/50'}`}>
            <input type="file" id={id} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" accept=".pdf,image/png,image/jpeg" onChange={onChange} />
            {hasFile ? (
                <>
                    <div className="bg-emerald-100 p-2 rounded-full mb-2"><CheckCircle className="h-5 w-5 text-emerald-600" /></div>
                    <span className="text-[9px] font-black uppercase text-emerald-600 tracking-widest leading-relaxed">Document Secured</span>
                </>
            ) : (
                <>
                    <div className="bg-white p-2 rounded-full mb-2 shadow-sm group-hover:scale-110 transition-transform"><UploadCloud className="h-5 w-5 text-slate-400" /></div>
                    <span className="text-[10px] font-black uppercase text-slate-600 tracking-tight leading-relaxed">{label}</span>
                    {optional && <span className="text-[8px] font-bold text-amber-500 uppercase mt-1">(Opsional)</span>}
                </>
            )}
        </div>
    )
}
