import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Loader2, Save, User } from "lucide-react"
import { useNavigate, useParams } from "react-router-dom"
import { useState, useEffect, useMemo } from "react"
import { toast } from "sonner"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { skApi } from "@/lib/api"
import IjazahUploadField from "@/features/sk-management/components/IjazahUploadField"
import { detectGelarChange } from "@/features/sk-management/utils/detectGelarChange"

export default function SkRevisionPage() {
    const navigate = useNavigate()
    const { id } = useParams()
    const queryClient = useQueryClient()

    const { data: skDoc, isLoading } = useQuery({
        queryKey: ['sk-document', id],
        queryFn: () => skApi.get(Number(id)),
        enabled: !!id
    })

    const requestRevisionMutation = useMutation({
        mutationFn: (data: any) => skApi.update(Number(id), data),
        onSuccess: () => {
            toast.success("Pengajuan revisi profil berhasil dikirim ke Admin!")
            queryClient.invalidateQueries({ queryKey: ['sk-document', id] })
            navigate(`/dashboard/sk/${id}`)
        },
        onError: (err: any) => toast.error("Gagal mengajukan revisi: " + (err.response?.data?.message || err.message))
    })

    const [isSubmitting, setIsSubmitting] = useState(false)
    
    // Ijazah upload state
    const [ijazahUrl, setIjazahUrl] = useState<string | null>(null)

    // Form state
    const [formData, setFormData] = useState({
        nama: "",
        tempat_lahir: "",
        tanggal_lahir: "",
        nip: "",
        pendidikan_terakhir: "",
        unit_kerja: "",
        tmt: "",
        reason: ""
    })

    // Original values from database (for change detection)
    const [originalData, setOriginalData] = useState({
        nama: "",
        pendidikan_terakhir: "",
    })

    // Pre-fill data when skDoc loads
    useEffect(() => {
        if (skDoc) {
            const teacher: any = skDoc.teacher || {}
            const nama = skDoc.nama || ""
            const pendidikan = teacher.pendidikan_terakhir || ""

            setFormData({
                nama,
                tempat_lahir: teacher.tempat_lahir || "",
                tanggal_lahir: teacher.tanggal_lahir ? teacher.tanggal_lahir.split('T')[0] : "",
                nip: teacher.nip || "",
                pendidikan_terakhir: pendidikan,
                unit_kerja: skDoc.unit_kerja || "",
                tmt: teacher.tmt ? teacher.tmt.split('T')[0] : "",
                reason: ""
            })

            setOriginalData({
                nama,
                pendidikan_terakhir: pendidikan,
            })
        }
    }, [skDoc])

    // Reactively compute gelar/pendidikan change flags
    const { isGelarChange, isPendidikanChange } = useMemo(() => {
        return detectGelarChange(
            formData.nama,
            originalData.nama,
            formData.pendidikan_terakhir,
            originalData.pendidikan_terakhir
        )
    }, [formData.nama, formData.pendidikan_terakhir, originalData.nama, originalData.pendidikan_terakhir])

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { id, value } = e.target
        setFormData(prev => ({ ...prev, [id]: value }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        
        if (!formData.reason.trim()) {
            toast.error("Alasan revisi wajib diisi!")
            return
        }

        // Validate: ijazah is required when gelar changes
        if ((isGelarChange || isPendidikanChange) && !ijazahUrl) {
            toast.error("Scan ijazah wajib dilampirkan untuk perubahan gelar.")
            return
        }

        setIsSubmitting(true)
        try {
            const proposedData = {
                nama: formData.nama,
                tempat_lahir: formData.tempat_lahir,
                tanggal_lahir: formData.tanggal_lahir,
                nip: formData.nip,
                pendidikan_terakhir: formData.pendidikan_terakhir,
                unit_kerja: formData.unit_kerja,
                tmt: formData.tmt,
            }

            const payload: Record<string, any> = {
                revision_status: 'revision_pending',
                revision_reason: formData.reason,
                revision_data: proposedData
            }

            // Include ijazah_url in payload only if it was uploaded
            if (ijazahUrl) {
                payload.ijazah_url = ijazahUrl
            }

            await requestRevisionMutation.mutateAsync(payload)
        } catch (error) {
            console.error(error)
        } finally {
            setIsSubmitting(false)
        }
    }

    if (isLoading) {
        return <div className="p-10 text-center flex flex-col items-center justify-center min-h-[400px]">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-4" />
            <span className="text-xs font-black uppercase tracking-widest text-slate-400">Menarik Data Dokumen...</span>
        </div>
    }

    if (!skDoc) return null

    const schoolId = skDoc.school_id ?? skDoc.school?.id ?? null

    return (
        <div className="max-w-3xl mx-auto space-y-6 pb-20">
            <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={() => navigate(-1)} className="text-slate-400 hover:text-blue-600 font-black uppercase tracking-widest text-xs h-10 px-0">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Batal & Kembali
                </Button>
            </div>

            <Card className="border-0 shadow-sm bg-white rounded-[2.5rem] overflow-hidden">
                <CardHeader className="p-10 bg-amber-50/50 border-b border-amber-100">
                    <div className="flex items-center gap-4">
                        <div className="bg-amber-100 p-3 rounded-2xl text-amber-600">
                            <User className="h-7 w-7" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl font-black text-amber-900 uppercase tracking-tight">Perbaikan Profil SK</CardTitle>
                            <CardDescription className="text-amber-700/60 font-medium text-sm pt-1">
                                Layanan koreksi data guru pada SK No: <span className="font-black text-amber-800">{skDoc.nomor_sk || "DRAFT"}</span>
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                    <CardContent className="p-10 space-y-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Nama Lengkap & Gelar</Label>
                                <Input id="nama" value={formData.nama} onChange={handleInputChange} className="h-12 rounded-xl bg-slate-50 border-0 focus:ring-amber-500 font-bold" />
                            </div>

                            <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">NIP / NIY</Label>
                                <Input id="nip" value={formData.nip} onChange={handleInputChange} className="h-12 rounded-xl bg-slate-50 border-0 focus:ring-amber-500 font-mono" />
                            </div>

                            <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Tempat Lahir</Label>
                                <Input id="tempat_lahir" value={formData.tempat_lahir} onChange={handleInputChange} className="h-12 rounded-xl bg-slate-50 border-0 focus:ring-amber-500" />
                            </div>

                            <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Tanggal Lahir</Label>
                                <Input id="tanggal_lahir" type="date" value={formData.tanggal_lahir} onChange={handleInputChange} className="h-12 rounded-xl bg-slate-50 border-0 focus:ring-amber-500" />
                            </div>

                            <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Pendidikan</Label>
                                <Input id="pendidikan_terakhir" value={formData.pendidikan_terakhir} onChange={handleInputChange} className="h-12 rounded-xl bg-slate-50 border-0 focus:ring-amber-500 font-bold" />
                            </div>
                            
                            <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-blue-600">TMT (Tanggal Mulai Tugas)</Label>
                                <Input id="tmt" type="date" value={formData.tmt} onChange={handleInputChange} className="h-12 rounded-xl bg-blue-50 border-0 focus:ring-blue-500" />
                            </div>
                            
                            <div className="md:col-span-2 space-y-3">
                                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Unit Kerja / Madrasah</Label>
                                <Input id="unit_kerja" value={formData.unit_kerja} onChange={handleInputChange} className="h-12 rounded-xl bg-slate-50 border-0 focus:ring-amber-500 font-bold opacity-80" />
                            </div>

                            {/* Ijazah Upload Field — placed below pendidikan_terakhir */}
                            <div className="md:col-span-2">
                                <IjazahUploadField
                                    value={ijazahUrl}
                                    onChange={setIjazahUrl}
                                    isGelarChange={isGelarChange}
                                    isPendidikanChange={isPendidikanChange}
                                    schoolId={schoolId}
                                    disabled={isSubmitting}
                                />
                            </div>
                        </div>

                        <div className="p-6 bg-red-50 border border-red-100 rounded-2xl space-y-4">
                            <Label className="text-[10px] font-black uppercase text-red-600 tracking-widest flex items-center gap-2">
                                <span className="bg-red-600 text-white w-4 h-4 rounded-full flex items-center justify-center text-[8px]">!</span>
                                Alasan Permintaan Revisi *Wajib
                            </Label>
                            <Textarea 
                                id="reason" 
                                value={formData.reason} 
                                onChange={handleInputChange}
                                placeholder="Jelaskan bagian mana yang perlu diperbaiki (Cth: Typo nama, Tanggal lahir salah)..."
                                className="h-24 rounded-xl bg-white border-red-200 focus:ring-red-500 resize-none font-medium text-sm"
                            />
                        </div>

                    </CardContent>
                    
                    <CardFooter className="p-10 bg-slate-50/50 border-t border-slate-50 flex items-center justify-between">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Membutuhkan Verifikasi Admin</p>
                        <div className="flex gap-4">
                            <Button type="button" variant="ghost" onClick={() => navigate(-1)} className="rounded-xl h-12 px-8 text-xs font-black uppercase tracking-widest text-slate-400">Batal</Button>
                            <Button type="submit" disabled={isSubmitting || !formData.reason.trim()} className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl h-12 px-8 text-xs font-black uppercase tracking-widest shadow-xl shadow-amber-100">
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} 
                                Ajukan Perbaikan
                            </Button>
                        </div>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}
