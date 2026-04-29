import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { ArrowLeft, Save, Check, ChevronsUpDown, Loader2 } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { teacherApi, schoolApi, headmasterApi, mediaApi, authApi } from "@/lib/api"
import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

const headmasterSchema = z.object({
  teacher_id: z.string().min(1, "Calon Kepala wajib dipilih"),
  school_id: z.string().min(1, "Madrasah Tujuan wajib dipilih"),
  periode: z.string(),
  tmt: z.string().min(1, "TMT wajib diisi"),
  keterangan: z.string().optional(),
  surat_permohonan_number: z.string().optional(),
  surat_permohonan_date: z.string().optional(),
  nomor_surat_rekomendasi: z.string().optional(),
  tanggal_surat_rekomendasi: z.string().optional(),
})

type HeadmasterForm = z.infer<typeof headmasterSchema>

export default function HeadmasterSubmissionPage() {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [suratFile, setSuratFile] = useState<File | null>(null)
  const [openTeacher, setOpenTeacher] = useState(false)
  const [openSchool, setOpenSchool] = useState(false)
  const [schoolSearch, setSchoolSearch] = useState("") 
  const [teacherSearch, setTeacherSearch] = useState("")

  // Get current user
  const user = authApi.getStoredUser()
  const isOperator = user?.role === 'operator'
  const userSchoolId = user?.school_id

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          if (file.size > 1024 * 1024) { // 1MB for Laravel
              toast.error("Ukuran file maksimal 1MB");
              e.target.value = "";
              return;
          }
          setSuratFile(file)
      }
  }

  // 🔥 REST API QUERIES
  const { data: teachersData, isLoading: isLoadingTeachers } = useQuery({
    queryKey: ['teachers-all', teacherSearch],
    queryFn: () => {
      const params: any = { 
        is_certified: true,  // Only show certified teachers (sudah sertifikasi)
        per_page: 100 
      }
      // Only add search if not empty
      if (teacherSearch && teacherSearch.trim()) {
        params.search = teacherSearch
      }
      return teacherApi.list(params)
    }
  })

  const { data: schoolsData } = useQuery({
    queryKey: ['schools-all', schoolSearch],
    queryFn: () => schoolApi.list({ 
      search: schoolSearch || undefined, 
      per_page: 100 
    }),
    enabled: !isOperator // Only fetch schools for admin yayasan
  })

  // Get user's school data for operator
  const { data: userSchoolData } = useQuery({
    queryKey: ['user-school', userSchoolId],
    queryFn: () => schoolApi.get(userSchoolId!),
    enabled: isOperator && !!userSchoolId
  })
  
  const teachers = teachersData?.data || []
  const schools = schoolsData?.data || []

  const form = useForm<HeadmasterForm>({
    resolver: zodResolver(headmasterSchema),
    defaultValues: {
      periode: "1",
      school_id: isOperator && userSchoolId ? userSchoolId.toString() : undefined
    }
  })

  const createHeadmasterMutation = useMutation({
    mutationFn: (data: any) => headmasterApi.list().then(() => apiClient.post('/headmasters', data)), // Fallback post if headmasterApi.create missing
    onSuccess: () => {
      toast.success("Pengajuan Kepala Madrasah Berhasil!")
      navigate("/dashboard/sk")
    },
    onError: (err: any) => toast.error("Gagal mengajukan: " + (err.response?.data?.message || err.message))
  })

  // Re-define post manually since I might have missed create in api.ts
  const submitHeadmaster = async (data: any) => {
    // I already added headmasterApi to api.ts but let me double check if I added create
    // Looking back at step 801, I only added list, get, expiring.
    // I should have added create/store.
    // I'll use the apiClient directly if needed or just update api.ts again.
    // For now, I'll use a local function.
    const { apiClient } = await import("@/lib/api");
    return apiClient.post('/headmasters', data).then(r => r.data);
  }

  const onSubmit = async (data: HeadmasterForm) => {
    setIsSubmitting(true)
    try {
        let finalUrl = null;
        if (suratFile) {
            toast.info("Mengunggah berkas permohonan...")
            const formData = new FormData()
            formData.append('file', suratFile)
            formData.append('folder', 'permohonan-kamad')
            const uploadRes = await mediaApi.upload(formData)
            finalUrl = uploadRes.url
        }

        const selectedTeacher = teachers.find((t: any) => t.id.toString() === data.teacher_id)
        
        // For operator, use user's school; for admin, use selected school
        let selectedSchool
        if (isOperator && userSchoolData) {
            selectedSchool = userSchoolData
        } else {
            selectedSchool = schools.find((s: any) => s.id.toString() === data.school_id)
        }

        const startDate = new Date(data.tmt)
        const endDate = new Date(startDate)
        endDate.setFullYear(endDate.getFullYear() + 4)

        const payload = {
            teacher_id: data.teacher_id,
            teacher_name: selectedTeacher?.nama || "Unknown",
            school_id: data.school_id,
            school_name: selectedSchool?.nama || "Unknown",
            periode: data.periode,
            start_date: data.tmt,
            end_date: endDate.toISOString().split('T')[0],
            sk_url: finalUrl,
            keterangan: data.keterangan,
            surat_permohonan_number: data.surat_permohonan_number,
            surat_permohonan_date: data.surat_permohonan_date,
            nomor_surat_rekomendasi: data.nomor_surat_rekomendasi,
            tanggal_surat_rekomendasi: data.tanggal_surat_rekomendasi,
        };

        await submitHeadmaster(payload)
        toast.success("Pengajuan Kepala Madrasah Berhasil!")
        navigate("/dashboard/sk")
    } catch (err: any) {
        console.error(err)
        toast.error(err.response?.data?.message || err.message || "Terjadi kesalahan")
    } finally {
        setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/dashboard/sk")} className="pl-0 text-slate-400 font-black uppercase tracking-widest text-[10px] hover:text-blue-600">
            <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
          </Button>
      </div>

      <Card className="border-0 shadow-sm bg-white rounded-[2.5rem] overflow-hidden">
        <CardHeader className="p-10 border-b bg-emerald-50/50">
          <CardTitle className="text-2xl font-black text-emerald-900 uppercase tracking-tight">Pengajuan SK Kepala Madrasah</CardTitle>
          <CardDescription className="text-emerald-700/60 font-medium">
             Layanan pengangkatan struktural Kepala Madrasah per-periode (4 tahun).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-10">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            
             <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Pilih Calon Kepala (Guru Bersertifikat)</Label>
              <Popover open={openTeacher} onOpenChange={setOpenTeacher}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full h-12 justify-between rounded-xl border-slate-200 font-bold px-4",
                      !form.watch("teacher_id") && "text-slate-400"
                    )}
                  >
                    {form.watch("teacher_id")
                      ? teachers.find((t: any) => t.id.toString() === form.watch("teacher_id"))?.nama
                      : "Cari Guru..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[500px] p-0" align="start">
                  <div className="flex flex-col border rounded-xl bg-white shadow-xl overflow-hidden">
                    <div className="p-4 border-b">
                      <Input
                         placeholder="Ketik nama guru..."
                         className="h-10 rounded-lg bg-slate-50 border-0 focus:ring-emerald-500 font-bold"
                         value={teacherSearch}
                         onChange={(e) => setTeacherSearch(e.target.value)}
                      />
                    </div>
                    <div className="max-h-[300px] overflow-y-auto p-2 space-y-1">
                        {isLoadingTeachers ? (
                          <div className="p-8 text-center text-slate-400 text-xs">
                            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                            Memuat data guru...
                          </div>
                        ) : teachers.length === 0 ? (
                          <div className="p-8 text-center text-slate-400 text-xs">
                            {teacherSearch ? 'Tidak ada guru yang cocok' : 'Tidak ada guru bersertifikat'}
                          </div>
                        ) : (
                          teachers.map((teacher: any) => (
                            <div
                              key={teacher.id}
                              className={cn(
                                "relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-emerald-50 hover:text-emerald-800 transition-colors",
                                teacher.id.toString() === form.watch("teacher_id") && "bg-emerald-50 text-emerald-900"
                              )}
                              onClick={() => {
                                 form.setValue("teacher_id", teacher.id.toString())
                                 setOpenTeacher(false)
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", teacher.id.toString() === form.watch("teacher_id") ? "opacity-100" : "opacity-0")} />
                              {teacher.nama} <span className="ml-2 opacity-40 text-xs">— {teacher.unit_kerja}</span>
                            </div>
                          ))
                        )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
               {form.formState.errors.teacher_id && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{form.formState.errors.teacher_id.message}</p>}
            </div>

            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Madrasah Tujuan (Tempat Menjabat)</Label>
              {isOperator ? (
                // For operator: show read-only field with their school
                <div className="h-12 rounded-xl border-slate-200 border bg-slate-50 px-4 flex items-center font-bold text-slate-700">
                  {userSchoolData?.nama || "Loading..."}
                </div>
              ) : (
                // For admin yayasan: show dropdown
                <Popover open={openSchool} onOpenChange={setOpenSchool}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full h-12 justify-between rounded-xl border-slate-200 font-bold px-4",
                        !form.watch("school_id") && "text-slate-400"
                      )}
                    >
                      {form.watch("school_id")
                        ? schools.find((s: any) => s.id.toString() === form.watch("school_id"))?.nama
                        : "Pilih Madrasah..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[500px] p-0" align="start">
                    <div className="flex flex-col border rounded-xl bg-white shadow-xl overflow-hidden">
                      <div className="p-4 border-b">
                        <Input
                          placeholder="Cari madrasah..."
                          className="h-10 rounded-lg bg-slate-50 border-0 focus:ring-emerald-500 font-bold"
                          value={schoolSearch}
                          onChange={(e) => setSchoolSearch(e.target.value)}
                        />
                      </div>
                      <div className="max-h-[300px] overflow-y-auto p-2 space-y-1">
                          {schools.map((school: any) => (
                            <div
                              key={school.id}
                              className={cn(
                                "relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-emerald-50 hover:text-emerald-800 transition-colors",
                                school.id.toString() === form.watch("school_id") && "bg-emerald-50 text-emerald-900"
                              )}
                              onClick={() => {
                                form.setValue("school_id", school.id.toString());
                                setOpenSchool(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", school.id.toString() === form.watch("school_id") ? "opacity-100" : "opacity-0")} />
                              {school.nama}
                            </div>
                          ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
               {form.formState.errors.school_id && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{form.formState.errors.school_id.message}</p>}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                 <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Periode Menjabat</Label>
                    <Select onValueChange={(val) => form.setValue("periode", val)} defaultValue="1">
                      <SelectTrigger className="h-12 rounded-xl border-slate-200 font-bold">
                        <SelectValue placeholder="Pilih Periode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Periode Ke-1 (4 Tahun)</SelectItem>
                        <SelectItem value="2">Periode Ke-2 (4 Tahun)</SelectItem>
                        <SelectItem value="3">Periode Ke-3 (4 Tahun)</SelectItem>
                      </SelectContent>
                    </Select>
                 </div>
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">TMT Mulai Jabatan</Label>
                    <Input type="date" {...form.register("tmt")} className="h-12 rounded-xl border-slate-200 font-bold" />
                    {form.formState.errors.tmt && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{form.formState.errors.tmt.message}</p>}
                 </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                 <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Nomor Surat Permohonan</Label>
                    <Input placeholder="Cth: 045/LPM/..." {...form.register("surat_permohonan_number")} className="h-12 rounded-xl border-slate-200 font-bold" />
                 </div>
                 <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Tanggal Surat</Label>
                    <Input type="date" {...form.register("surat_permohonan_date")} className="h-12 rounded-xl border-slate-200 font-bold" />
                 </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                 <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Nomor Surat Rekomendasi</Label>
                    <Input placeholder="Cth: 012/PC.L/..." {...form.register("nomor_surat_rekomendasi")} className="h-12 rounded-xl border-slate-200 font-bold" />
                 </div>
                 <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Tanggal Surat Rekomendasi</Label>
                    <Input type="date" {...form.register("tanggal_surat_rekomendasi")} className="h-12 rounded-xl border-slate-200 font-bold" />
                 </div>
            </div>

            <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Upload Scan Permohonan (Format PDF)</Label>
                <Input type="file" onChange={handleFileChange} accept=".pdf,.jpg,.jpeg,.png" className="h-12 rounded-xl border-slate-200 file:bg-slate-100 file:border-0 file:rounded-lg file:text-[10px] file:font-black file:uppercase file:mr-4 file:h-8 hover:file:bg-slate-200" />
                <p className="text-[10px] text-slate-400 font-medium">Maksimal 1MB untuk berkas permohonan.</p>
            </div>

            <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Keterangan Opsional</Label>
                <Textarea placeholder="Isi catatan jika perpanjangan atau mutasi jabatan..." {...form.register("keterangan")} className="rounded-xl border-slate-200 font-medium text-sm h-32" />
            </div>

            <div className="pt-6 flex justify-end gap-4 border-t border-slate-100">
                <Button type="button" variant="ghost" onClick={() => navigate("/dashboard/sk")} className="h-12 px-8 rounded-xl font-black uppercase tracking-widest text-xs text-slate-400">Batal</Button>
                <Button type="submit" disabled={isSubmitting} className="h-12 px-10 rounded-xl font-black uppercase tracking-widest text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-100">
                   {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="mr-2 h-4 w-4" />} 
                   Simpan Pengajuan
                </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
