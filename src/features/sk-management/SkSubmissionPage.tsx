import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { ArrowLeft, Save, FileText, Upload, Loader2 } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { useState, useRef, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BulkSkSubmission } from "./components/BulkSkSubmission"
import { SchoolAutocomplete } from "./components/SchoolAutocomplete"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { skApi, mediaApi, authApi, schoolApi } from "@/lib/api"

type SkFormValues = {
  jenisSk: string
  jenisPengajuan: "new" | "renew"
  nama: string
  nuptk?: string
  nip?: string
  jabatan: string
  unit_kerja: string
  keterangan?: string
  tempat_lahir: string
  tanggal_lahir: string
  pendidikan_terakhir: string
  tmt: string
  status_kepegawaian?: string
  nomor_surat_permohonan?: string
  tanggal_surat_permohonan?: string
}

export default function SkSubmissionPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [activeTab, setActiveTab] = useState("single")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
   
  const user = authApi.getStoredUser()
  const isOperator = user?.role === "operator"
  const isSuperAdmin = ["super_admin", "admin_yayasan"].includes(user?.role)

  // Create schema with dynamic validation based on user role
  const skSchema = z.object({
    jenisSk: z.string().min(1, "Jenis SK wajib dipilih"),
    jenisPengajuan: z.enum(["new", "renew"]),
    nama: z.string().min(3, "Nama wajib diisi minimal 3 karakter"),
    nuptk: z.string().optional(),
    nip: z.string().optional(),
    jabatan: z.string().min(1, "Jabatan wajib diisi"),
    unit_kerja: isSuperAdmin 
      ? z.string().min(1, "Unit Kerja wajib diisi")
      : z.string().min(1, "Madrasah tidak valid. Pilih dari daftar yang tersedia."),
    keterangan: z.string().optional(),
    tempat_lahir: z.string().min(1, "Tempat Lahir wajib diisi"),
    tanggal_lahir: z.string().min(1, "Tanggal Lahir wajib diisi"),
    pendidikan_terakhir: z.string().min(1, "Pendidikan Terakhir wajib diisi"),
    tmt: z.string().min(1, "Tanggal Mulai Tugas wajib diisi"),
    status_kepegawaian: z.string().optional(),
    nomor_surat_permohonan: z.string().optional(),
    tanggal_surat_permohonan: z.string().optional(),
  })

  const form = useForm<SkFormValues>({
    resolver: zodResolver(skSchema),
    defaultValues: {
      jenisPengajuan: "new",
      unit_kerja: isOperator ? (user?.unit || "") : ""
    },
    mode: "onChange" // Enable validation on change to show errors immediately
  })

  // Auto-fill unit_kerja for operator from school profile
  const { data: schoolProfile } = useQuery({
    queryKey: ['school-profile-me'],
    queryFn: () => schoolApi.profile(),
    enabled: isOperator,
  })

  useEffect(() => {
    if (schoolProfile?.nama && !form.getValues('unit_kerja')) {
      form.setValue('unit_kerja', schoolProfile.nama)
    }
  }, [schoolProfile])

  // Mutations
  const createRequestMutation = useMutation({
    mutationFn: (data: any) => skApi.submitRequest(data),
    onSuccess: () => {
      toast.success("✅ Pengajuan SK berhasil dikirim! Menunggu verifikasi admin.")
      queryClient.invalidateQueries({ queryKey: ['sk-documents'] })
      navigate("/dashboard/sk")
    },
    onError: (err: any) => toast.error("Gagal mengirim pengajuan: " + (err.response?.data?.message || err.message))
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 2 * 1024 * 1024) return toast.error("Ukuran file maksimal 2MB")
      setSelectedFile(file)
      toast.success(`File terpilih: ${file.name}`)
    }
  }

  const onSubmit = async (data: SkFormValues) => {
    // For operators, use the school profile name if available
    const unitKerja = data.unit_kerja || schoolProfile?.nama || user?.unit || ""

    if (!selectedFile) {
      toast.error("Wajib mengunggah Surat Permohonan resmi.")
      return
    }
    setIsSubmitting(true)
    try {
      // Upload file
      setIsUploading(true)
      let fileUrl: string
      try {
        const uploadRes = await mediaApi.upload(selectedFile, 'sk-requests')
        fileUrl = uploadRes.url
        if (!fileUrl) throw new Error('URL file tidak diterima dari server')
      } catch (uploadErr: any) {
        toast.error("Gagal upload dokumen: " + (uploadErr.response?.data?.message || uploadErr.message))
        return
      } finally {
        setIsUploading(false)
      }

      await createRequestMutation.mutateAsync({
        nama: data.nama,
        nuptk: data.nuptk || undefined,
        nip: data.nip || undefined,
        jenis_sk: data.jenisSk,
        unit_kerja: unitKerja,
        jabatan: data.jabatan,
        tmt: data.tmt || undefined,
        tempat_lahir: data.tempat_lahir || undefined,
        tanggal_lahir: data.tanggal_lahir || undefined,
        pendidikan_terakhir: data.pendidikan_terakhir || undefined,
        surat_permohonan_url: fileUrl,
        nomor_surat_permohonan: data.nomor_surat_permohonan || undefined,
        tanggal_surat_permohonan: data.tanggal_surat_permohonan || undefined,
        status_kepegawaian: data.status_kepegawaian || (data.jenisSk?.includes("GTY") ? "GTY" : "GTT")
      })
    } catch (err: any) {
      toast.error("Gagal menyimpan pengajuan: " + (err.response?.data?.message || err.message || "Terjadi kesalahan"))
    } finally {
      setIsSubmitting(false)
      setIsUploading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 relative pb-20">
      <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/dashboard/sk")} className="text-slate-400 hover:text-blue-600 font-black uppercase tracking-widest text-xs h-10 px-0">
            <ArrowLeft className="mr-2 h-4 w-4" /> Kembali ke Dashboard
          </Button>
          <div className="text-right">
              <h1 className="text-3xl font-black tracking-tight text-blue-900 uppercase">Pengajuan SK Baru</h1>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Pusat Layanan Digital LP Ma'arif NU Cilacap</p>
          </div>
      </div>

      <Tabs defaultValue="single" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-slate-100 p-1 rounded-2xl h-auto mb-8">
          <TabsTrigger value="single" className="rounded-xl px-10 py-3 text-xs font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">Input Satuan</TabsTrigger>
          <TabsTrigger value="collective" className="rounded-xl px-10 py-3 text-xs font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">Import Kolektif (Excel)</TabsTrigger>
        </TabsList>
        
        <TabsContent value="single">
          <Card className="border-0 shadow-sm bg-white rounded-[2.5rem] overflow-hidden">
            <CardHeader className="px-10 pt-10 pb-2">
                <CardTitle className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
                    Formulir Elektronik
                </CardTitle>
                <CardDescription className="text-sm font-medium text-slate-400 pt-1">Mohon isi data calon penerima SK dengan lengkap sesuai berkas fisik.</CardDescription>
            </CardHeader>
            <CardContent className="p-10">
              <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
                const firstError = Object.values(errors)[0]
                if (firstError?.message) toast.error(firstError.message as string)
              })} className="space-y-10">
                <div className="grid gap-8 md:grid-cols-2">
                    <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Jenis SK yang Diajukan</Label>
                        <Select onValueChange={(val) => form.setValue("jenisSk", val)}>
                            <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-0 focus:ring-blue-500 font-bold text-slate-700">
                                <SelectValue placeholder="Pilih Jenis SK" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="SK Guru Tetap Yayasan">SK Guru Tetap Yayasan (GTY)</SelectItem>
                                <SelectItem value="SK Guru Tidak Tetap">SK Guru Tidak Tetap (GTT)</SelectItem>
                                <SelectItem value="SK Tenaga Kependidikan">SK Tenaga Kependidikan</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-[9px] text-slate-400 font-medium italic">
                            Untuk SK Kepala Madrasah, gunakan menu "Pengajuan Kepala" di Manajemen SDM
                        </p>
                    </div>
                    <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Jenis Pengajuan</Label>
                        <div className="flex gap-4">
                            {["new", "renew"].map((v) => (
                                <label key={v} className="flex-1 flex items-center justify-center h-12 rounded-xl border-2 border-slate-100 bg-white cursor-pointer transition-all has-[:checked]:bg-blue-50 has-[:checked]:border-blue-600">
                                    <input type="radio" value={v} {...form.register("jenisPengajuan")} className="hidden" />
                                    <span className="text-xs font-black uppercase tracking-widest text-slate-500 group-checked:text-blue-600">{v === 'new' ? 'Baru' : 'Perpanjangan'}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-3 md:col-span-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Nama Lengkap & Gelar</Label>
                        <Input placeholder="Cth: Ahmad Subagyo, S.Pd" {...form.register("nama")} className="h-12 rounded-xl bg-slate-50 border-0 focus:ring-blue-500 font-bold" />
                    </div>

                    <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">NIY/NUPTK (Jika ada)</Label>
                        <Input placeholder="Cth: 198001.." {...form.register("nuptk")} className="h-12 rounded-xl bg-slate-50 border-0 focus:ring-blue-500 font-mono" />
                    </div>
                    <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Jabatan</Label>
                        <Input placeholder="Cth: Guru Mapel, Kamad..." {...form.register("jabatan")} className="h-12 rounded-xl bg-slate-50 border-0 focus:ring-blue-500 font-bold" />
                    </div>

                    <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Tempat Lahir</Label>
                        <Input placeholder="Kota Kelahiran" {...form.register("tempat_lahir")} className="h-12 rounded-xl bg-slate-50 border-0 focus:ring-blue-500" />
                    </div>
                    <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Tanggal Lahir</Label>
                        <Input type="date" {...form.register("tanggal_lahir")} className="h-12 rounded-xl bg-slate-50 border-0 focus:ring-blue-500" />
                    </div>

                    <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Unit Kerja / Madrasah</Label>
                        {isSuperAdmin ? (
                          // Super admin can type freely to create new schools
                          <div className="space-y-2">
                            <Input
                              {...form.register("unit_kerja")}
                              placeholder="Nama Madrasah"
                              className={cn(
                                "h-12 rounded-xl bg-slate-50 border-0 focus:ring-blue-500 font-bold",
                                form.formState.errors.unit_kerja && "border-red-500 border-2"
                              )}
                            />
                            {form.formState.errors.unit_kerja && (
                              <p className="text-xs text-red-500 font-medium">
                                {form.formState.errors.unit_kerja.message}
                              </p>
                            )}
                          </div>
                        ) : (
                          // Operator uses autocomplete, pre-populated and disabled if they have an assigned school
                          <SchoolAutocomplete
                            value={form.watch("unit_kerja") || ""}
                            onChange={(value) => form.setValue("unit_kerja", value, { shouldValidate: true })}
                            disabled={isOperator && !!schoolProfile?.nama}
                            placeholder={isOperator ? (schoolProfile?.nama || "Memuat...") : "Pilih Madrasah"}
                            error={form.formState.errors.unit_kerja?.message}
                          />
                        )}
                    </div>
                    <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Pendidikan Terakhir</Label>
                        <Select onValueChange={(val) => form.setValue("pendidikan_terakhir", val)}>
                            <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-0 focus:ring-blue-500 font-bold">
                                <SelectValue placeholder="Pilih Pendidikan" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                {["SMA/MA", "D3", "S1", "S2", "S3"].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">TMT (Tanggal Mulai Tugas)</Label>
                        <Input type="date" {...form.register("tmt")} className="h-12 rounded-xl bg-slate-50 border-0 focus:ring-blue-500" />
                    </div>

                    <div className="space-y-3 flex flex-col">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Dokumen Permohonan (PDF/JPG)</Label>
                        <div onClick={() => fileInputRef.current?.click()} className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50 hover:bg-slate-100 cursor-pointer transition-all p-6">
                            {isUploading ? <Loader2 className="h-6 w-6 animate-spin text-blue-600" /> : selectedFile ? (
                                <div className="text-center font-bold text-blue-600">
                                    <FileText className="h-8 w-8 mx-auto mb-2" />
                                    <span className="text-[10px] uppercase truncate block max-w-[150px]">{selectedFile.name}</span>
                                </div>
                            ) : (
                                <div className="text-center text-slate-400">
                                    <Upload className="h-8 w-8 mx-auto mb-2 opacity-20" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Upload Berkas</span>
                                </div>
                            )}
                            <Input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Nomor Surat Permohonan</Label>
                        <Input placeholder="Cth: 001/MTs.NU/VII/2025" {...form.register("nomor_surat_permohonan")} className="h-12 rounded-xl bg-slate-50 border-0 focus:ring-blue-500 font-bold" />
                    </div>

                    <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Tanggal Surat Permohonan</Label>
                        <Input type="date" {...form.register("tanggal_surat_permohonan")} className="h-12 rounded-xl bg-slate-50 border-0 focus:ring-blue-500" />
                    </div>

                    <div className="md:col-span-2 space-y-3">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Keterangan / Catatan</Label>
                        <Textarea placeholder="Berikan catatan tambahan jika diperlukan..." {...form.register("keterangan")} className="rounded-xl bg-slate-50 border-0 focus:ring-blue-500 min-h-[120px]" />
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-10 border-t border-slate-50">
                    <Button type="button" variant="ghost" className="rounded-2xl h-12 px-8 font-black uppercase tracking-widest text-xs" onClick={() => navigate("/dashboard/sk")}>Batal</Button>
                    <Button type="submit" disabled={isSubmitting || isUploading} className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl h-12 px-10 font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-100">
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Simpan & Ajukan
                    </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="collective">
            <BulkSkSubmission />
        </TabsContent>
      </Tabs>
    </div>
  )
}
