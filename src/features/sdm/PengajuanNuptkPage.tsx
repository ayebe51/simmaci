import { useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

    const teachers = useQuery(api.teachers.listAll, isOperator ? { schoolId: user.schoolId } : {}) || []
    const submissions = useQuery(api.nuptk.listRequests, isOperator ? { schoolId: user.schoolId } : {}) || []
    
    // Filter teachers who don't have NUPTK OR their NUPTK is just a temporary ID
    const eligibleTeachers = teachers.filter(t => !t.nuptk || String(t.nuptk).startsWith("TMP-"))
    
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

    const generateUploadUrl = useMutation(api.nuptk.generateUploadUrl)
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
            const uploadUrl = await generateUploadUrl()
            const result = await fetch(uploadUrl, {
                method: "POST",
                headers: { "Content-Type": file.type },
                body: file,
            })
            const { storageId } = await result.json()
            setFiles(prev => ({ ...prev, [type]: storageId }))
            toast.success(`Berhasil mengunggah ${type}`, { id: loadingId })
        } catch (error) {
            console.error(error)
            toast.error(`Gagal mengunggah ${type}`, { id: loadingId })
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
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Daftar Guru Tanpa NUPTK</CardTitle>
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
                                <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                    <TableRow>
                                        <TableHead>Nama Guru</TableHead>
                                        <TableHead className="text-right">Aksi</TableHead>
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
                                                        <Button size="sm" onClick={() => {
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

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Riwayat Pengajuan</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border h-[460px] overflow-auto">
                            <Table>
                                <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                    <TableRow>
                                        <TableHead>Nama Guru</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Aksi</TableHead>
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
                        <Button onClick={handleSubmit} disabled={isSubmitting || Object.keys(files).length < 4} className="bg-[#008f39]">
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
        <div className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center transition-colors ${hasFile ? 'border-green-500 bg-green-50' : 'border-slate-300 hover:border-slate-400 bg-slate-50'}`}>
            {hasFile ? (
                <>
                    <CheckCircle className="h-8 w-8 text-green-500 mb-2" />
                    <span className="font-medium text-green-700 text-sm">Berhasil Diunggah</span>
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
