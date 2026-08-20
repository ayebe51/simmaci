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
import { ArrowLeft, Save, FileText, Upload, Loader2, Download, AlertTriangle, CheckCircle, Crown, Award } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { useState, useRef, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BulkSkSubmission } from "./components/BulkSkSubmission"
import { SchoolAutocomplete } from "./components/SchoolAutocomplete"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { skApi, mediaApi, authApi, schoolApi, skTemplateApi } from "@/lib/api"
import { DASHBOARD_QUERY_KEYS } from "@/features/dashboard/utils/queryKeys"

type SkFormValues = {
  jenisSk: string
  jenisPengajuan: "new" | "renew"
  nama: string
  nuptk?: string
  nip?: string
  nomor_induk_maarif?: string
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
  // SK Pemberhentian
  alasan_pemberhentian?: string
  keterangan_pemberhentian?: string
  tanggal_efektif_pemberhentian?: string
}

const ALASAN_PEMBERHENTIAN_OPTIONS = [
  { value: 'pengunduran_diri',    label: 'Pengunduran Diri' },
  { value: 'pensiun',             label: 'Pensiun' },
  { value: 'meninggal_dunia',     label: 'Meninggal Dunia' },
  { value: 'pelanggaran_disiplin', label: 'Pelanggaran Disiplin' },
  { value: 'habis_kontrak',       label: 'Habis Kontrak' },
  { value: 'lainnya',             label: 'Lainnya' },
] as const

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

  // Template surat permohonan untuk didownload
  const { data: suratPermohonanTemplate, isLoading: isLoadingTemplate, error: templateError } = useQuery({
    queryKey: ['sk-template-surat-permohonan'],
    queryFn: () => skTemplateApi.getActiveSuratPermohonan(),
    retry: false,
  })

  const handleDownloadTemplate = async () => {
    if (!suratPermohonanTemplate?.id) {
      toast.error("Template surat permohonan belum tersedia. Hubungi administrator untuk mengaktifkan template.")
      return
    }
    
    try {
      // Use apiClient with responseType: 'blob' for proper file download
      const response = await skTemplateApi.downloadUrl(suratPermohonanTemplate.id)
      
      // Get filename from response headers or use default
      let filename = `template-surat-permohonan.docx`
      const contentDisposition = response.headers?.['content-disposition']
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/)
        if (match) filename = match[1]
      }
      
      // Create blob and trigger download
      const blob = response.data instanceof Blob ? response.data : new Blob([response.data])
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
      
      toast.success("Template berhasil diunduh")
    } catch (error) {
      console.error('Download template error:', error)
      toast.error(error instanceof Error ? error.message : 'Gagal mengunduh template')
    }
  }

  // Create schema with dynamic validation based on user role
  const skSchema = z.object({
    jenisSk: z.string().min(1, "Jenis SK wajib dipilih"),
    jenisPengajuan: z.enum(["new", "renew"]),
    nama: z.string().min(3, "Nama wajib diisi minimal 3 karakter"),
    nuptk: z.string().optional(),
    nip: z.string().optional(),
    nomor_induk_maarif: z.string().max(20, "NIM maksimal 20 karakter").regex(/^\d*$/, "NIM hanya boleh berisi angka").optional(),
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
    // SK Pemberhentian fields
    alasan_pemberhentian: z.string().optional(),
    keterangan_pemberhentian: z.string().max(1000).optional(),
    tanggal_efektif_pemberhentian: z.string().optional(),
  }).refine(
    (data) => data.jenisSk !== 'SK Pemberhentian' || !!data.alasan_pemberhentian,
    { message: 'Alasan pemberhentian wajib diisi', path: ['alasan_pemberhentian'] }
  ).refine(
    (data) => data.jenisSk !== 'SK Pemberhentian' || !!data.tanggal_efektif_pemberhentian,
    { message: 'Tanggal efektif pemberhentian wajib diisi', path: ['tanggal_efektif_pemberhentian'] }
  ).refine(
    (data) => data.alasan_pemberhentian !== 'lainnya' || !!data.keterangan_pemberhentian,
    { message: 'Keterangan wajib diisi jika alasan adalah "Lainnya"', path: ['keterangan_pemberhentian'] }
  )

  const form = useForm<SkFormValues>({
    resolver: zodResolver(skSchema),
    defaultValues: {
      jenisPengajuan: "new",
      unit_kerja: isOperator ? (user?.unit || "") : ""
    },
    mode: "onChange" // Enable validation on change to show errors immediately
  })

  const watchedJenisSk = form.watch("jenisSk")
  const watchedAlasan = form.watch("alasan_pemberhentian")
  const isPemberhentian = watchedJenisSk === 'SK Pemberhentian'

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

  // Tentukan apakah pengajuan SK dikunci untuk operator ini
  // Logic:
  // - super_admin/admin_yayasan: selalu bisa
  // - operator RA/TK: selalu bisa
  // - operator MI ke atas:
  //     sk_submission_unlocked === true  → admin sudah buka khusus → bisa
  //     sk_submission_unlocked === null  → ikuti default → dikunci (per 1 Juli 2026)
  //     sk_submission_unlocked === false → dikunci paksa
  const isSkLocked = (() => {
    if (!isOperator) return false // admin selalu bisa
    if (!schoolProfile) return false // belum load, jangan blokir dulu
    const jenjang = (schoolProfile.jenjang || "").toUpperCase()
    const isRaTk = jenjang === "RA" || jenjang === "TK" || jenjang.includes("RA") || jenjang.includes("TK")
    if (isRaTk) return false // RA/TK selalu bisa
    // MI ke atas: cek flag khusus
    if (schoolProfile.sk_submission_unlocked === true) return false // sudah dibuka admin
    return true // default: dikunci
  })()

  // Mutations
  const createRequestMutation = useMutation({
    mutationFn: (data: any) => skApi.submitRequest(data),
    onSuccess: () => {
      toast.success("✅ Pengajuan SK berhasil dikirim! Menunggu verifikasi admin.")
      queryClient.invalidateQueries({ queryKey: ['sk-documents'] })
      queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEYS.stats })
      queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEYS.schoolStats })
      queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEYS.charts })
      navigate("/dashboard/sk")
    },
    onError: (err: any) => toast.error("Gagal mengirim pengajuan: " + (err.response?.data?.message || err.message))
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        e.target.value = "";
        return toast.error("Format tidak didukung. Surat permohonan harus berupa file PDF.");
      }
      if (file.size > 5 * 1024 * 1024) {
        e.target.value = "";
        return toast.error("Ukuran file maksimal 5MB.");
      }
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
        nomor_induk_maarif: data.nomor_induk_maarif || undefined,
        jenis_sk: data.jenisSk,
        jenis_pengajuan: data.jenisPengajuan,
        unit_kerja: unitKerja,
        jabatan: data.jabatan,
        tmt: data.tmt || undefined,
        tempat_lahir: data.tempat_lahir || undefined,
        tanggal_lahir: data.tanggal_lahir || undefined,
        pendidikan_terakhir: data.pendidikan_terakhir || undefined,
        surat_permohonan_url: fileUrl,
        nomor_surat_permohonan: data.nomor_surat_permohonan || undefined,
        tanggal_surat_permohonan: data.tanggal_surat_permohonan || undefined,
        status_kepegawaian: data.status_kepegawaian || (data.jenisSk?.includes("GTY") ? "GTY" : "GTT"),
        // SK Pemberhentian fields
        ...(data.jenisSk === 'SK Pemberhentian' && {
          alasan_pemberhentian: data.alasan_pemberhentian,
          keterangan_pemberhentian: data.keterangan_pemberhentian || undefined,
          tanggal_efektif_pemberhentian: data.tanggal_efektif_pemberhentian,
        }),
      })
    } catch (err: any) {
      toast.error("Gagal menyimpan pengajuan: " + (err.response?.data?.message || err.message || "Terjadi kesalahan"))
    } finally {
      setIsSubmitting(false)
      setIsUploading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 relative pb-20">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate("/dashboard/sk-center")}
            className="rounded-2xl border-slate-200 hover:bg-slate-100 text-slate-600 shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
              <span>Pusat Layanan SK</span>
              <span>/</span>
              <span className="text-blue-600">Pengajuan Baru</span>
            </div>
            <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase mt-0.5">
              Pengajuan SK Guru & Tendik
            </h1>
          </div>
        </div>

        {/* Template download button */}
        {suratPermohonanTemplate?.file_url && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadTemplate}
            disabled={isLoadingTemplate}
            className="rounded-xl border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 font-bold text-xs h-10 px-4 shrink-0 shadow-sm"
          >
            <Download className="mr-2 h-4 w-4 text-amber-600" />
            Unduh Template Surat Resmi
          </Button>
        )}
      </div>

      {/* Banner informasi pengajuan SK berdasarkan jenjang */}
      {isOperator && schoolProfile && (() => {
        const jenjang = (schoolProfile.jenjang || "").toUpperCase()
        const isRaTk = jenjang === "RA" || jenjang === "TK" || jenjang.includes("RA") || jenjang.includes("TK")

        if (isRaTk) {
          return (
            <div className="flex items-start gap-4 bg-emerald-50 border border-emerald-200 rounded-2xl px-6 py-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center mt-0.5">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-black text-emerald-900 uppercase tracking-wide">Pengajuan SK Dibuka</p>
                <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
                  Pengajuan SK untuk jenjang <strong>RA/TK</strong> saat ini <strong>dibuka</strong>. Silakan ajukan melalui formulir di bawah.
                </p>
              </div>
            </div>
          )
        }

        if (schoolProfile.sk_submission_unlocked === true) {
          // Admin sudah membuka khusus untuk madrasah ini
          return (
            <div className="flex items-start gap-4 bg-blue-50 border border-blue-200 rounded-2xl px-6 py-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center mt-0.5">
                <CheckCircle className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-black text-blue-900 uppercase tracking-wide">Pengajuan Diizinkan oleh LP Ma'arif NU Cilacap</p>
                <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                  Madrasah ini telah mendapatkan izin khusus dari pengurus LP Ma'arif NU Cilacap untuk mengajukan SK. Silakan lanjutkan pengajuan.
                </p>
              </div>
            </div>
          )
        }

        // MI ke atas, dikunci
        return (
          <div className="flex items-start gap-4 bg-red-50 border border-red-200 rounded-2xl px-6 py-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center mt-0.5">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-black text-red-900 uppercase tracking-wide">
                Pengajuan SK Ditutup — Per 1 Juli 2026
              </p>
              <p className="text-xs text-red-700 mt-1 leading-relaxed">
                Pengajuan SK untuk jenjang <strong>{schoolProfile.jenjang || "MI ke atas"}</strong> telah ditutup per <strong>1 Juli 2026</strong>.
                Apabila memiliki keperluan mendesak, silakan hubungi pengurus <strong>LP Ma'arif NU Cilacap</strong> untuk mendapatkan izin pengajuan.
              </p>
            </div>
          </div>
        )
      })()}

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
                                <SelectItem value="SK Pemberhentian">SK Pemberhentian</SelectItem>
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
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">NIM (Nomor Induk Maarif)</Label>
                        <Input placeholder="Cth: 113400139" {...form.register("nomor_induk_maarif")} className="h-12 rounded-xl bg-slate-50 border-0 focus:ring-blue-500 font-mono" maxLength={20} />
                        {form.formState.errors.nomor_induk_maarif && (
                          <p className="text-xs text-red-500 font-medium">{form.formState.errors.nomor_induk_maarif.message}</p>
                        )}
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
                                {["S3", "S2", "S1", "D4", "D3", "D2", "D1", "SMA/MA", "SMP"].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
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
                            <Input type="file" accept=".pdf" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
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

                    {/* ── SK Pemberhentian Fields ── */}
                    {isPemberhentian && (
                      <div className="md:col-span-2 space-y-6 border-l-2 border-red-200 pl-6 py-2">
                        <p className="text-xs font-black uppercase text-red-500 tracking-widest">Detail Pemberhentian</p>

                        {/* Alasan Pemberhentian */}
                        <div className="space-y-3">
                          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                            Alasan Pemberhentian <span className="text-red-500">*</span>
                          </Label>
                          <Select onValueChange={(val) => form.setValue("alasan_pemberhentian", val, { shouldValidate: true })}>
                            <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-0 focus:ring-red-500 font-bold text-slate-700">
                              <SelectValue placeholder="Pilih alasan pemberhentian..." />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              {ALASAN_PEMBERHENTIAN_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {form.formState.errors.alasan_pemberhentian && (
                            <p className="text-xs text-red-500 font-medium">{form.formState.errors.alasan_pemberhentian.message as string}</p>
                          )}
                        </div>

                        {/* Keterangan (hanya jika alasan = lainnya) */}
                        {watchedAlasan === 'lainnya' && (
                          <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                              Keterangan <span className="text-red-500">*</span>
                            </Label>
                            <Textarea
                              {...form.register("keterangan_pemberhentian")}
                              placeholder="Jelaskan alasan pemberhentian secara lengkap..."
                              maxLength={1000}
                              className="rounded-xl bg-slate-50 border-0 focus:ring-red-500 min-h-[100px]"
                            />
                            {form.formState.errors.keterangan_pemberhentian && (
                              <p className="text-xs text-red-500 font-medium">{form.formState.errors.keterangan_pemberhentian.message as string}</p>
                            )}
                          </div>
                        )}

                        {/* Tanggal Efektif */}
                        <div className="space-y-3">
                          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                            Tanggal Efektif Pemberhentian <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            type="date"
                            {...form.register("tanggal_efektif_pemberhentian")}
                            min={new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                            className="h-12 rounded-xl bg-slate-50 border-0 focus:ring-red-500"
                          />
                          {form.formState.errors.tanggal_efektif_pemberhentian && (
                            <p className="text-xs text-red-500 font-medium">{form.formState.errors.tanggal_efektif_pemberhentian.message as string}</p>
                          )}
                        </div>
                      </div>
                    )}
                </div>

                <div className="flex justify-end gap-3 pt-10 border-t border-slate-50">
                    <Button type="button" variant="ghost" className="rounded-2xl h-12 px-8 font-black uppercase tracking-widest text-xs" onClick={() => navigate("/dashboard/sk")}>Batal</Button>
                    <Button
                      type="submit"
                      disabled={isSubmitting || isUploading || isSkLocked}
                      onClick={isSkLocked ? (e) => { e.preventDefault(); toast.error("Pengajuan SK ditutup. Hubungi LP Ma'arif NU Cilacap untuk izin.") } : undefined}
                      className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl h-12 px-10 font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        {isSkLocked ? "Pengajuan Ditutup" : "Simpan & Ajukan"}
                    </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="collective">
          {isSkLocked ? (
            <Card className="border-0 shadow-sm bg-white rounded-[2.5rem] overflow-hidden">
              <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center">
                  <AlertTriangle className="h-8 w-8 text-red-500" />
                </div>
                <div className="text-center">
                  <p className="font-black text-slate-800 uppercase tracking-tight">Pengajuan Ditutup</p>
                  <p className="text-xs text-slate-500 mt-2 max-w-xs leading-relaxed">
                    Import kolektif tidak tersedia karena pengajuan SK untuk madrasah ini telah ditutup per 1 Juli 2026.
                    Hubungi LP Ma'arif NU Cilacap untuk mendapatkan izin pengajuan.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <BulkSkSubmission />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
