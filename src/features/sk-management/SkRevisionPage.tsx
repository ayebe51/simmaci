import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Loader2, Save, User } from "lucide-react"
import { useNavigate, useParams } from "react-router-dom"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

import { useQuery, useMutation } from "convex/react"
import { api as convexApi } from "../../../convex/_generated/api"
import { Id } from "../../../convex/_generated/dataModel"

export default function SkRevisionPage() {
    const navigate = useNavigate()
    const { id } = useParams()

    const skDoc = useQuery(convexApi.sk.get, id ? { id: id as Id<"skDocuments"> } : "skip")
    const requestRevisionMutation = useMutation(convexApi.sk.requestRevision)

    const [isSubmitting, setIsSubmitting] = useState(false)
    
    // Form state
    const [formData, setFormData] = useState({
        nama: "",
        tempatLahir: "",
        tanggalLahir: "",
        nip: "", // NIY / NIP
        pendidikanTerakhir: "",
        unitKerja: "",
        tmtPendidik: "",
        reason: ""
    })

    // Pre-fill data when skDoc loads
    useEffect(() => {
        if (skDoc) {
            const teacher: any = skDoc.teacher || {}
            setFormData({
                nama: skDoc.nama || "",
                tempatLahir: teacher.tempatLahir || "",
                // Parse date for HTML input type="date" which expects YYYY-MM-DD
                tanggalLahir: teacher.tanggalLahir ? new Date(teacher.tanggalLahir).toISOString().split('T')[0] : "",
                nip: teacher.nip || "",
                pendidikanTerakhir: teacher.pendidikanTerakhir || "",
                unitKerja: skDoc.unitKerja || "",
                tmtPendidik: teacher.tmtPendidik ? new Date(teacher.tmtPendidik).toISOString().split('T')[0] : "",
                reason: ""
            })
        }
    }, [skDoc])

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

        try {
            setIsSubmitting(true)
            
            // Compose the proposed data payload
            const proposedDataString = JSON.stringify({
                nama: formData.nama,
                tempatLahir: formData.tempatLahir,
                // Ensure we pass ISO strings for dates if they were changed
                tanggalLahir: formData.tanggalLahir ? new Date(formData.tanggalLahir).toISOString() : undefined,
                nip: formData.nip,
                pendidikanTerakhir: formData.pendidikanTerakhir,
                unitKerja: formData.unitKerja,
                tmtPendidik: formData.tmtPendidik ? new Date(formData.tmtPendidik).toISOString() : undefined,
            })

            await requestRevisionMutation({
                skId: id as Id<"skDocuments">,
                reason: formData.reason,
                proposedData: proposedDataString
            })

            toast.success("Pengajuan revisi profil berhasil dikirim ke Admin!")
            navigate(`/dashboard/sk/${id}`)
        } catch (error: any) {
            toast.error("Gagal mengajukan revisi: " + error.message)
        } finally {
            setIsSubmitting(false)
        }
    }

    if (!skDoc) {
        return <div className="p-8 text-center text-muted-foreground flex items-center justify-center">
            <Loader2 className="mr-2 h-6 w-6 animate-spin" /> Memuat data SK & Profil...
        </div>
    }

    if (skDoc.status !== "approved" && skDoc.status !== "active") {
        return <div className="p-8 text-center text-red-500">
            Hanya SK yang sudah disetujui/terbit yang dapat direvisi layanannya.
            <br/>
            <Button variant="outline" className="mt-4" onClick={() => navigate("/dashboard/sk")}>Kembali ke Dashboard</Button>
        </div>
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6 pb-20">
            <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={() => navigate(-1)} className="pl-0">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Batal
                </Button>
            </div>

            <Card className="border-orange-100 shadow-md">
                <CardHeader className="bg-orange-50/50 border-b border-orange-100 pb-8">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-orange-100 rounded-lg">
                            <User className="h-6 w-6 text-orange-600" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl text-orange-900">Perbaikan Data Profil SK</CardTitle>
                            <CardDescription className="text-orange-700/80 mt-1">
                                Ubah isian di bawah ini untuk memperbaiki data pribadi yang keliru pada lampiran SK nomor <strong>{skDoc.nomorSk || "Belum ada"}</strong>. Perubahan ini akan memicu *update* langsung pada data Induk Guru setelah di-ACC.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-6 pt-6">
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="nama" className="font-semibold">Nama Lengkap & Gelar</Label>
                                <Input 
                                    id="nama" 
                                    value={formData.nama} 
                                    onChange={handleInputChange}
                                    placeholder="Contoh: Ahmad Yani, S.Pd"
                                    className="border-slate-300 focus:border-orange-400 focus:ring-orange-400"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="nip" className="font-semibold">NIY / NIP</Label>
                                <Input 
                                    id="nip" 
                                    value={formData.nip} 
                                    onChange={handleInputChange}
                                    placeholder="Masukkan Nomor Induk"
                                    className="border-slate-300 focus:border-orange-400 focus:ring-orange-400"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="tempatLahir" className="font-semibold">Tempat Lahir</Label>
                                <Input 
                                    id="tempatLahir" 
                                    value={formData.tempatLahir} 
                                    onChange={handleInputChange}
                                    placeholder="Contoh: Cilacap"
                                    className="border-slate-300 focus:border-orange-400 focus:ring-orange-400"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="tanggalLahir" className="font-semibold">Tanggal Lahir</Label>
                                <Input 
                                    id="tanggalLahir" 
                                    type="date"
                                    value={formData.tanggalLahir} 
                                    onChange={handleInputChange}
                                    className="border-slate-300 focus:border-orange-400 focus:ring-orange-400"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="pendidikanTerakhir" className="font-semibold">Pendidikan Terakhir & Jurusan</Label>
                                <Input 
                                    id="pendidikanTerakhir" 
                                    value={formData.pendidikanTerakhir} 
                                    onChange={handleInputChange}
                                    placeholder="Contoh: S1 / Pendidikan Agama Islam"
                                    className="border-slate-300 focus:border-orange-400 focus:ring-orange-400"
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <Label htmlFor="tmtPendidik" className="font-semibold text-blue-700">TMT (Tanggal Mulai Tugas)</Label>
                                <Input 
                                    id="tmtPendidik" 
                                    type="date"
                                    value={formData.tmtPendidik} 
                                    onChange={handleInputChange}
                                    className="border-blue-200 bg-blue-50/50 focus:border-blue-400 focus:ring-blue-400"
                                />
                                <p className="text-xs text-muted-foreground mt-1">Sangat vital untuk dicetak ke dalam SK.</p>
                            </div>
                            
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="unitKerja" className="font-semibold">Unit Kerja / Sekolah</Label>
                                {/* We keep it as text input for now, ideally this would be a select from schools table */}
                                <Input 
                                    id="unitKerja" 
                                    value={formData.unitKerja} 
                                    onChange={handleInputChange}
                                    placeholder="Contoh: SMP NU Cilacap"
                                    className="border-slate-300 focus:border-orange-400 focus:ring-orange-400 bg-slate-50"
                                />
                            </div>
                        </div>

                        <hr className="my-6 border-slate-200" />

                        <div className="space-y-3 bg-red-50/50 p-4 border border-red-100 rounded-lg">
                            <Label htmlFor="reason" className="font-bold text-red-700 flex items-center gap-2">
                                Alasan Permintaan Revisi <span className="text-red-500">*wajib</span>
                            </Label>
                            <Textarea 
                                id="reason" 
                                value={formData.reason} 
                                onChange={handleInputChange}
                                placeholder="Jelaskan secara singkat apa yang salah. Contoh: 'Penulisan gelar pada nama kurang S.Pd.' atau 'Tahun TMT terbalik harusnya 2015 bukan 2025'."
                                className="min-h-[100px] border-red-200 focus:border-red-400 focus:ring-red-400 bg-white"
                            />
                        </div>

                    </CardContent>
                    
                    <CardFooter className="bg-slate-50 px-6 py-4 border-t flex items-center justify-between">
                        <p className="text-sm text-muted-foreground hidden sm:block">Perubahan ini membutuhkan ACC dari Admin Cabang.</p>
                        <div className="flex gap-3 w-full sm:w-auto">
                            <Button type="button" variant="outline" onClick={() => navigate(-1)} className="w-full sm:w-auto">Batal</Button>
                            <Button type="submit" disabled={isSubmitting || !formData.reason.trim()} className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700">
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} 
                                Ajukan Perbaikan Sekarang
                            </Button>
                        </div>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}
