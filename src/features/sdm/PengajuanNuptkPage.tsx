import { useState } from "react"
import { useQuery, useMutation, useAction } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Send, UploadCloud, CheckCircle, XCircle, Clock, FileIcon, Search } from "lucide-react"
import { toast } from "sonner"
import SoftPageHeader from "@/components/ui/SoftPageHeader"

export function PengajuanNuptkPage() {
    const userStr = localStorage.getItem("user")
    const user = userStr ? JSON.parse(userStr) : null;
    const isOperator = user?.role === "operator"
    const schoolId = isOperator ? user.schoolId : undefined

    const teachers = useQuery(api.teachers.listAll, { 
        token: localStorage.getItem("token") || "",
        schoolId: isOperator ? (user.schoolId as any) : undefined 
    }) || []
    const submissions = useQuery(api.nuptk.listRequests, { 
        schoolId: isOperator ? (user.schoolId as any) : undefined 
    }) || []
    
    // Filter teachers who don't have NUPTK OR their NUPTK is just a temporary ID, dummy "-/0", or strictly blank whitespace
    const eligibleTeachers = teachers.filter(t => {
        if (!t.nuptk) return true;
        const strVal = String(t.nuptk).trim();
        return strVal === "" || strVal === "-" || strVal === "0" || strVal.toLowerCase() === "belum ada" || strVal.startsWith("TMP-");
    });
    
    // Check if teacher already has pending/approved request
    const isTeacherSubmitted = (teacherId: string) => {
        return submissions.some(s => s.teacherId === teacherId && s.status !== "Rejected")
    }

    const [searchTerm, setSearchTerm] = useState("")

    // Submission Modal State
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedTeacher, setSelectedTeacher] = useState<any>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    
    // File IDs
    const [files, setFiles] = useState<{
        ktp?: string,
        ijazah?: string,
        pengangkatan?: string,
        penugasan?: string
    }>({})

    const uploadToDrive = useAction((api as any).drive.uploadFile)
    const submitRequest = useMutation(api.nuptk.submitRequest)
    const removeRequest = useMutation(api.nuptk.removeRequest)

    const handleUploadClick = () => {
        // Trigger generic file input. For simplicity we use standard input elements below
    }

    const onFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: keyof typeof files) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (file.size > 2 * 1024 * 1024) {
            toast.error("Ukuran file maksimal 2MB")
            return
        }

        const loadingId = toast.loading(`Mengunggah file ${type}...`)
        try {
            // 1. Convert to Base64
            const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve((reader.result as string).split(',')[1]);
                reader.onerror = reject;
            });

            // 2. Determine Extension
            const ext = file.type.includes('pdf') ? 'pdf' : (file.type.includes('png') ? 'png' : 'jpg');

            // 3. Upload to Google Drive
            const result: any = await uploadToDrive({
                fileData: base64,
                fileName: `REQ_NUPTK_${type.toUpperCase()}_${Date.now()}.${ext}`,
                mimeType: file.type
            });

            if (!result || result.success === false) {
                throw new Error(result?.error || "Gagal menghubungi Google Drive");
            }
            
            // 4. Construct direct embed link
            const driveUrl = `https://lh3.googleusercontent.com/d/${result.id}`;

            setFiles(prev => ({ ...prev, [type]: driveUrl }))
            toast.success(`Berhasil mengunggah ${type}`, { id: loadingId })
        } catch (error: any) {
            console.error(error)
            toast.error(`Gagal mengunggah ${type}: ${error.message}`, { id: loadingId })
        }
    }

    const handleSubmit = async () => {
        if (!files.ktp || !files.ijazah || !files.pengangkatan || !files.penugasan) {
            toast.error("Mohon lengkapi semua dokumen persyaratan!")
            return
        }

        setIsSubmitting(true)
        try {
            await submitRequest({
                teacherId: selectedTeacher._id,
                schoolId: selectedTeacher.schoolId,
                dokumenKtpId: files.ktp as any,
                dokumenIjazahId: files.ijazah as any,
                dokumenPengangkatanId: files.pengangkatan as any,
                dokumenPenugasanId: files.penugasan as any,
            })
            toast.success("Berhasil mengajukan permohonan rekomendasi NUPTK!")
            setIsModalOpen(false)
            setFiles({})
            setSelectedTeacher(null)
        } catch (error: any) {
            toast.error(error.message || "Gagal mengajukan permohonan")
        } finally {
            setIsSubmitting(false)
        }
    }

    const displayedTeachers = eligibleTeachers.filter(t => 
        t.nama?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="space-y-6">
            <SoftPageHeader 
                title="Pengajuan Rekomendasi NUPTK"
                description="Ajukan permohonan Surat Rekomendasi Penerbitan NUPTK dengan melampirkan persyaratan."
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white/60 backdrop-blur-xl overflow-hidden relative z-10 flex flex-col h-full rounded-2xl">
                    <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[60%] bg-emerald-400/10 blur-[100px] pointer-events-none rounded-full" />
                    <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[60%] bg-blue-400/10 blur-[100px] pointer-events-none rounded-full" />
                    <CardHeader className="pb-4 border-b border-white/60 bg-white/40">
                        <CardTitle className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">Daftar Guru Tanpa NUPTK</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="relative mb-4">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Cari nama guru..."
                                className="pl-9"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="rounded-md border h-[400px] overflow-auto">
                            <Table>
                                <TableHeader className="bg-emerald-50/80 sticky top-0 z-10 shadow-sm backdrop-blur-sm">
                                    <TableRow className="border-b border-emerald-100/60">
                                        <TableHead className="font-semibold text-emerald-800">Nama Guru</TableHead>
                                        <TableHead className="text-right font-semibold text-emerald-800">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {displayedTeachers.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={2} className="text-center h-24 text-muted-foreground">
                                                Tidak ada guru yang memenuhi syarat pengajuan baru.
                                            </TableCell>
                                        </TableRow>
                                    ) : displayedTeachers.map(teacher => {
                                        const submitted = isTeacherSubmitted(teacher._id as string)
                                        return (
                                            <TableRow key={teacher._id}>
                                                <TableCell className="font-medium">{teacher.nama}</TableCell>
                                                <TableCell className="text-right">
                                                    {submitted ? (
                                                        <Badge variant="outline" className="bg-amber-50 text-amber-700">Sudah Diajukan</Badge>
                                                    ) : (
                                                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover-lift" onClick={() => {
                                                            setSelectedTeacher(teacher)
                                                            setFiles({})
                                                            setIsModalOpen(true)
                                                        }}>
                                                            Ajukan
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white/60 backdrop-blur-xl overflow-hidden relative z-10 flex flex-col h-full rounded-2xl">
                    <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[60%] bg-emerald-400/10 blur-[100px] pointer-events-none rounded-full" />
                    <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[60%] bg-blue-400/10 blur-[100px] pointer-events-none rounded-full" />
                    <CardHeader className="pb-4 border-b border-white/60 bg-white/40">
                        <CardTitle className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">Riwayat Pengajuan</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border h-[460px] overflow-auto">
                            <Table>
                                <TableHeader className="bg-emerald-50/80 sticky top-0 z-10 shadow-sm backdrop-blur-sm">
                                    <TableRow className="border-b border-emerald-100/60">
                                        <TableHead className="font-semibold text-emerald-800">Nama Guru</TableHead>
                                        <TableHead className="font-semibold text-emerald-800">Status</TableHead>
                                        <TableHead className="text-right font-semibold text-emerald-800">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {submissions.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center h-24 text-muted-foreground">
                                                Belum ada riwayat pengajuan.
                                            </TableCell>
                                        </TableRow>
                                    ) : submissions.map(sub => (
                                        <TableRow key={sub._id}>
                                            <TableCell>
                                                <div className="font-medium">{sub.teacherName}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {new Date(sub.submittedAt).toLocaleDateString("id-ID")}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {sub.status === "Pending" && <Badge variant="secondary" className="bg-amber-100 text-amber-800"><Clock className="w-3 h-3 mr-1"/> Pending</Badge>}
                                                {sub.status === "Approved" && <Badge variant="secondary" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1"/> Disetujui</Badge>}
                                                {sub.status === "Rejected" && (
                                                    <div className="flex flex-col gap-1 items-start">
                                                        <Badge variant="secondary" className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1"/> Ditolak</Badge>
                                                        {sub.rejectionReason && <span className="text-[10px] text-red-600">Alasan: {sub.rejectionReason}</span>}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {sub.status === "Pending" && (
                                                    <Button variant="ghost" size="sm" className="text-red-500" onClick={async () => {
                                                        if(confirm("Batal mengajukan NUPTK untuk guru ini?")) {
                                                            await removeRequest({ id: sub._id as any })
                                                            toast.success("Pengajuan dibatalkan")
                                                        }
                                                    }}>Batal</Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Ajukan NUPTK: {selectedTeacher?.nama}</DialogTitle>
                        <DialogDescription>
                            Unggah 4 dokumen wajib berformat PDF/JPG untuk persyaratan pengajuan rekomendasi NUPTK.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="grid grid-cols-2 gap-4 py-4">
                        <UploadBox 
                            label="1. KTP" 
                            id="ktp"
                            hasFile={!!files.ktp} 
                            onChange={(e) => onFileUpload(e, "ktp")} 
                        />
                        <UploadBox 
                            label="2. Ijazah (SD s/d Terakhir)" 
                            id="ijazah"
                            hasFile={!!files.ijazah} 
                            onChange={(e) => onFileUpload(e, "ijazah")} 
                        />
                        <UploadBox 
                            label="3. SK Pengangkatan (PNS/Ketua Yayasan)" 
                            id="pengangkatan"
                            hasFile={!!files.pengangkatan} 
                            onChange={(e) => onFileUpload(e, "pengangkatan")} 
                        />
                        <UploadBox 
                            label="4. SK Penugasan (Kepala Sekolah)" 
                            id="penugasan"
                            hasFile={!!files.penugasan} 
                            onChange={(e) => onFileUpload(e, "penugasan")} 
                            description="Pembagian jam mengajar (Min 2 Tahun)"
                        />
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>Batal</Button>
                        <Button onClick={handleSubmit} disabled={isSubmitting || Object.keys(files).length < 4} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover-lift">
                            {isSubmitting ? "Mengirim..." : (
                                <><Send className="mr-2 h-4 w-4"/> Kirim Pengajuan</>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

function UploadBox({ label, id, hasFile, onChange, description }: { label: string, id: string, hasFile: boolean, onChange: any, description?: string }) {
    return (
        <div className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center transition-colors ${hasFile ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-300 hover:border-emerald-400 bg-slate-50/50'}`}>
            {hasFile ? (
                <>
                    <CheckCircle className="h-8 w-8 text-emerald-500 mb-2" />
                    <span className="font-medium text-emerald-700 text-sm">Berhasil Diunggah</span>
                </>
            ) : (
                <>
                    <UploadCloud className="h-8 w-8 text-slate-400 mb-2" />
                    <span className="font-medium text-sm">{label}</span>
                    {description && <span className="text-xs text-muted-foreground mt-1">{description}</span>}
                    <div className="mt-3 relative">
                        <Input 
                            type="file" 
                            id={id}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                            accept=".pdf,image/png,image/jpeg"
                            onChange={onChange}
                        />
                        <Button type="button" variant="outline" size="sm" className="pointer-events-none">Pilih File</Button>
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-2">Maks 2MB (PDF/JPG)</span>
                </>
            )}
        </div>
    )
}
