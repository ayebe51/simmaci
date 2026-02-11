 
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { ArrowLeft, Save, Check, ChevronsUpDown } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { useState, useMemo } from "react"
// 🔥 CONVEX for data and mutations
import { useQuery, useMutation } from "convex/react"
import { api as convexApi } from "../../../convex/_generated/api"
import { Id } from "../../../convex/_generated/dataModel"
// Keep old API for file upload only
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import {
// Unused imports removed
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

const headmasterSchema = z.object({
  teacherId: z.string().min(1, "Calon Kepala wajib dipilih"),
  schoolId: z.string().min(1, "Madrasah Tujuan wajib dipilih"),
  periode: z.string(), // We'll parse to number
  tmt: z.string().min(1, "TMT wajib diisi"),
  keterangan: z.string().optional(),
  
  // --- NEW FIELDS ---
  suratPermohonanNumber: z.string().optional(),
  suratPermohonanDate: z.string().optional(),
  suratPermohonanUrl: z.string().optional(),
})

type HeadmasterForm = z.infer<typeof headmasterSchema>

export default function HeadmasterSubmissionPage() {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [suratFile, setSuratFile] = useState<File | null>(null)
  const [openTeacher, setOpenTeacher] = useState(false)
  const [openSchool, setOpenSchool] = useState(false)
  const [schoolSearch, setSchoolSearch] = useState("") 
  const [teacherSearch, setTeacherSearch] = useState("") // Manual teacher search state

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          setSuratFile(e.target.files[0])
      }
  }

  // 🔥 REAL-TIME CONVEX QUERIES
  const convexTeachers = useQuery(convexApi.teachers.list, { token: localStorage.getItem("token") || undefined })
  const convexSchools = useQuery(convexApi.schools.list, {})
  
  // Map to interface with id
  const teachers = useMemo(() => (convexTeachers || []).map(t => ({
    id: t._id,
    nama: t.nama,
    unitKerja: t.unitKerja
  })), [convexTeachers])
  
  const schools = useMemo(() => (convexSchools || []).map(s => ({
    id: s._id,
    nama: s.nama
  })), [convexSchools])

  const form = useForm<HeadmasterForm>({
    resolver: zodResolver(headmasterSchema),
    defaultValues: {
      periode: "1",
    }
  })
  
  // 🔥 CONVEX MUTATION
  const createHeadmasterMutation = useMutation(convexApi.headmasters.create)

  const onSubmit = async (data: HeadmasterForm) => {
    setIsSubmitting(true)
    try {
        let finalUrl = null;
        if (suratFile) {
            toast.info("Mengunggah surat permohonan...")
            const uploadRes = await api.uploadFile(suratFile)
            finalUrl = (uploadRes as any).url || (uploadRes as any).filename
        }

        // Find teacher and school names for denormalization
        const selectedTeacher = teachers.find(t => t.id === data.teacherId)
        const selectedSchool = schools.find(s => s.id === data.schoolId)

        // Calculate end date (4 years from TMT)
        const tmtDate = new Date(data.tmt)
        const endDate = new Date(tmtDate)
        endDate.setFullYear(endDate.getFullYear() + 4)

        const payload = {
            teacherId: data.teacherId as Id<"teachers">,
            teacherName: selectedTeacher?.nama || "Unknown",
            schoolId: data.schoolId as Id<"schools">,
            schoolName: selectedSchool?.nama || "Unknown",
            periode: parseInt(data.periode),
            startDate: data.tmt,
            endDate: endDate.toISOString().split('T')[0],
            status: "pending",
            skUrl: finalUrl || undefined,
            token: localStorage.getItem("token") || undefined, // Send Token!
        };
        console.log("Submitting Payload:", payload);

        await createHeadmasterMutation(payload)
        
        toast.success("Pengajuan Kepala Madrasah Berhasil!")
        navigate("/dashboard/sk")
    } catch (err: any) {
        console.error("Submission Error:", err);
        const errorMessage = err.data instanceof Object && 'message' in err.data 
            ? err.data.message // Specific ConvexError
            : err.message || "Gagal mengajukan"; // Standard Error or string
        
        // FORCE SHOW ERROR via Alert to ensure user sees it
        window.alert(`DEBUG ERROR: ${errorMessage}\n\nFull Details: ${JSON.stringify(err, null, 2)}`);
        
        toast.error(errorMessage);
    } finally {
        setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/dashboard/sk")} className="pl-0">
            <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
          </Button>
          <h1 className="text-2xl font-bold">Pengajuan SK Kepala Madrasah</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Formulir Masa Jabatan Kepala</CardTitle>
          <CardDescription>
             Mengajukan SK untuk Kepala Madrasah (Maksimal 3 Periode).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            {/* Teacher Selection (Searchable) */}
             <div className="flex flex-col space-y-2">
              <Label>Pilih Calon Kepala (Dari Data Guru)</Label>
              <Popover open={openTeacher} onOpenChange={setOpenTeacher}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openTeacher}
                    className={cn(
                      "w-full justify-between",
                      !form.watch("teacherId") && "text-muted-foreground"
                    )}
                  >
                    {form.watch("teacherId")
                      ? teachers.find((teacher) => teacher.id === form.watch("teacherId"))?.nama
                      : "Pilih Guru..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[500px] p-0" align="start">
                  <div className="flex flex-col border rounded-md bg-white">
                    <div className="flex items-center border-b px-3">
                      <Input
                         placeholder="Cari nama guru..."
                         className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-50 border-none focus-visible:ring-0 px-0"
                         value={teacherSearch}
                         onChange={(e) => setTeacherSearch(e.target.value)}
                         autoFocus
                      />
                    </div>
                    <div className="max-h-[300px] overflow-y-auto overflow-x-hidden p-1">
                        {teachers
                           .filter(t => t.nama.toLowerCase().includes(teacherSearch.toLowerCase()))
                           .slice(0, 100)
                           .map((teacher) => (
                          <div
                            key={teacher.id}
                            className={cn(
                              "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-slate-100 hover:text-slate-900 cursor-pointer",
                              teacher.id === form.watch("teacherId") && "bg-slate-100"
                            )}
                            onMouseDown={(e) => {
                               e.preventDefault();
                               e.stopPropagation();
                               form.setValue("teacherId", teacher.id)
                               setOpenTeacher(false)
                               setTeacherSearch("")
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                teacher.id === form.watch("teacherId")
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            {teacher.nama} - {teacher.unitKerja}
                          </div>
                        ))}
                        {teachers.filter(t => t.nama.toLowerCase().includes(teacherSearch.toLowerCase())).length === 0 && (
                            <div className="py-6 text-center text-sm text-muted-foreground">Guru tidak ditemukan.</div>
                        )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
               {form.formState.errors.teacherId && <p className="text-red-500 text-sm">{form.formState.errors.teacherId.message}</p>}
            </div>

            {/* School Selection (Searchable) */}
            <div className="flex flex-col space-y-2">
              <Label>Madrasah Tujuan (Tempat Menjabat)</Label>
              <Popover open={openSchool} onOpenChange={setOpenSchool}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openSchool}
                    className={cn(
                      "w-full justify-between",
                      !form.watch("schoolId") && "text-muted-foreground"
                    )}
                  >
                    {form.watch("schoolId")
                      ? schools.find((school) => school.id === form.watch("schoolId"))?.nama
                      : "Pilih Madrasah..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[500px] p-0" align="start">
                  <div className="flex flex-col border rounded-md bg-white">
                    <div className="flex items-center border-b px-3">
                      <Input
                         placeholder="Cari nama madrasah..."
                         className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-50 border-none focus-visible:ring-0 px-0"
                         value={schoolSearch}
                         onChange={(e) => setSchoolSearch(e.target.value)}
                         autoFocus
                      />
                    </div>
                    <div className="max-h-[300px] overflow-y-auto overflow-x-hidden p-1">
                        {schools
                            .filter(s => s.nama.toLowerCase().includes(schoolSearch.toLowerCase()))
                            .slice(0, 100)
                            .map((school) => (
                              <div
                                key={school.id}
                                className={cn(
                                  "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-slate-100 hover:text-slate-900 cursor-pointer",
                                  school.id === form.watch("schoolId") && "bg-slate-100"
                                )}
                                onMouseDown={(e) => {
                                   // Use onMouseDown to prevent blur from firing first
                                   e.preventDefault(); 
                                   e.stopPropagation();
                                   form.setValue("schoolId", school.id);
                                   setOpenSchool(false);
                                   setSchoolSearch(""); // Reset search
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    school.id === form.watch("schoolId")
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                {school.nama}
                              </div>
                            ))}
                        {schools.filter(s => s.nama.toLowerCase().includes(schoolSearch.toLowerCase())).length === 0 && (
                             <div className="py-6 text-center text-sm text-muted-foreground">
                               Madrasah tidak ditemukan.
                             </div>
                        )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
               {form.formState.errors.schoolId && <p className="text-red-500 text-sm">{form.formState.errors.schoolId.message}</p>}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                 <div className="grid gap-2">
                    <Label>Periode Menjabat</Label>
                    <Select onValueChange={(val) => form.setValue("periode", val)} defaultValue="1">
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih Periode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Periode Ke-1 (4 Tahun)</SelectItem>
                        <SelectItem value="2">Periode Ke-2 (4 Tahun)</SelectItem>
                        <SelectItem value="3">Periode Ke-3 (4 Tahun)</SelectItem>
                      </SelectContent>
                    </Select>
                 </div>
                  <div className="grid gap-2">
                    <Label>TMT (Tanggal Mulai Tugas)</Label>
                    <Input type="date" {...form.register("tmt")} />
                    {form.formState.errors.tmt && <p className="text-red-500 text-sm">{form.formState.errors.tmt.message}</p>}
                 </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                 <div className="grid gap-2">
                    <Label>Nomor Surat Permohonan</Label>
                    <Input placeholder="Contoh: 005/MWC/..." {...form.register("suratPermohonanNumber")} />
                 </div>
                 <div className="grid gap-2">
                    <Label>Tanggal Surat Permohonan</Label>
                    <Input type="date" {...form.register("suratPermohonanDate")} />
                 </div>
            </div>

            <div className="grid gap-2">
                <Label>Upload Scan Surat Permohonan (PDF/Gambar)</Label>
                <Input type="file" onChange={handleFileChange} accept=".pdf,.jpg,.jpeg,.png" />
                <p className="text-[10px] text-muted-foreground">Maksimal 2MB.</p>
            </div>

            <div className="grid gap-2">
                <Label>Keterangan / Catatan</Label>
                <Textarea placeholder="Catatan tambahan..." {...form.register("keterangan")} />
            </div>

            <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => navigate("/dashboard/sk")}>Batal</Button>
                <Button type="submit" disabled={isSubmitting}>
                   {isSubmitting ? "Menyimpan..." : <><Save className="mr-2 h-4 w-4" /> Simpan Pengajuan</>}
                </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
