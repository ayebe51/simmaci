import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox" // Need to import Checkbox or use Select for boolean
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { ArrowLeft, Save, FileText } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { useState, useRef } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BulkSkSubmission } from "./components/BulkSkSubmission"
// 🔥 CONVEX for SK creation
import { useMutation } from "convex/react"
import { api as convexApi } from "../../../convex/_generated/api"
// Keep old API for file upload only
import { api } from "@/lib/api"

const skSchema = z.object({
  jenisSk: z.string().min(1, "Jenis SK wajib dipilih"),
  jenisPengajuan: z.enum(["new", "renew"]),
  nama: z.string().min(3, "Nama wajib diisi minimal 3 karakter"),
  niy: z.string().optional(), // Maps to NIP / Nomor Induk Ma'arif
  jabatan: z.string().min(1, "Jabatan wajib diisi"),
  unitKerja: z.string().min(1, "Unit Kerja wajib diisi"),
  keterangan: z.string().optional(),
  
  // NEW FIELDS
  tempatLahir: z.string().min(1, "Tempat Lahir wajib diisi"),
  tanggalLahir: z.string().min(1, "Tanggal Lahir wajib diisi"),
  pendidikanTerakhir: z.string().min(1, "Pendidikan Terakhir wajib diisi"),
  tmt: z.string().min(1, "Tanggal Mulai Tugas wajib diisi"),
  statusKepegawaian: z.string().optional(), // Explicit Status if needed, or derived
  isCertified: z.boolean().default(false),
  pdpkpnu: z.string().optional(),
})

type SkFormValues = z.infer<typeof skSchema>

export default function SkSubmissionPage() {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState("single")
  const fileInputRef = useRef<HTMLInputElement>(null)
   
  // Role Check
  const [userRole, setUserRole] = useState<{ role: string, unit?: string } | null>(() => {
    try {
        const str = localStorage.getItem("user");
        if (!str) return null;
        const u = JSON.parse(str);
        return { role: u.role, unit: u.unitKerja };
    } catch { return null }
  });

  const isOperator = userRole?.role === "operator";
  const isSuperAdmin = userRole?.role === "super_admin";

  const form = useForm<SkFormValues>({
    resolver: zodResolver(skSchema),
    defaultValues: {
      jenisPengajuan: "new",
      isCertified: false,
    }
  })
  
  // Pre-fill unit for operator
  if (isOperator && userRole?.unit && form.getValues("unitKerja") !== userRole.unit) {
      form.setValue("unitKerja", userRole.unit);
  }

  // 🔥 CONVEX MUTATIONS
  const createTeacherMutation = useMutation(convexApi.teachers.create)

  const onSubmit = async (data: SkFormValues) => {
    setIsSubmitting(true)
    try {
        // Helper variables for file upload
        const file = fileInputRef.current?.files?.[0]
        if (file) {
            toast.info("Mengupload dokumen...")
            await api.uploadFile(file)
        }

        // 🔥 STEP 1: Create Teacher Record First
        toast.info("Membuat data guru...")
        
        // Generate NUPTK if NIY provided, otherwise use timestamp-based ID
        const nuptk = data.niy || `TEMP-${Date.now()}`
        
        const token = localStorage.getItem("token") || undefined;
        
        // Map Status: Prefer explicit status if we add it, else derive from Jenis SK
        const statusMap: Record<string, string> = {
            "SK Guru Tetap Yayasan": "GTY",
            "SK Guru Tidak Tetap": "GTT",
            "SK Tenaga Kependidikan": "Tendik",
            "SK Kepala Madrasah": "Kepala"
        };
        const derivedStatus = statusMap[data.jenisSk] || "GTY";
        // User requested "Status" column - likely Kepegawaian. 
        // We act as if 'statusKepegawaian' input overrides derived if present, 
        // but for now let's just use the logic or pass it.
        const finalStatus = data.statusKepegawaian || derivedStatus;

        await createTeacherMutation({
            nuptk: nuptk,
            nama: data.nama,
            nip: data.niy, // Maps to 'Nomor Induk Ma'arif'
            unitKerja: data.unitKerja,
            status: finalStatus,
            isActive: true,
            
            // NEW FIELDS MAPPING
            tempatLahir: data.tempatLahir,
            tanggalLahir: data.tanggalLahir,
            pendidikanTerakhir: data.pendidikanTerakhir,
            tmt: data.tmt,
            isCertified: data.isCertified,
            pdpkpnu: data.pdpkpnu,
            
            token: token,
        })


        // 🔥 STEP 2: Finish (No Draft SK Created - Waiting for Admin)
        toast.success("✅ Pengajuan berhasil dikirim! Data masuk antrean verifikasi.")
        navigate("/dashboard/teachers") // Redirect to Teacher List instead of SK Archive
    } catch (err) {
         
        const errorMessage = (err as any).message || "Gagal mengajukan SK"
        toast.error(errorMessage)
    } finally {
        setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/dashboard/sk")} className="pl-0">
            <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
          </Button>
          <div className="text-right">
              <h1 className="text-2xl font-bold">Penerbitan SK</h1>
             <div className="text-[10px] text-muted-foreground">
                Role Detected: {isSuperAdmin ? <span className="text-green-600 font-bold">SUPER_ADMIN</span> : <span className="text-red-500 font-bold">USER_BIASA</span>}
             </div>
          </div>
      </div>

      <Tabs defaultValue="single" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="single">Input Satuan</TabsTrigger>
          <TabsTrigger value="collective">Pengajuan Kolektif (Excel)</TabsTrigger>
        </TabsList>
        
        <TabsContent value="single">
          <Card>
            <CardHeader>
              <CardTitle>Ajuan SK Baru</CardTitle>
              <CardDescription>
                 Isi formulir di bawah ini untuk mengajukan penerbitan Surat Keputusan baru.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                
                {/* SECTION 1: SK DETAILS */}
                <div className="space-y-4 border-b pb-4">
                  <h3 className="font-semibold text-lg">Jenis SK</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                      <div className="grid gap-2">
                        <Label htmlFor="jenisSk">Jenis SK</Label>
                        <Select onValueChange={(val) => form.setValue("jenisSk", val)} defaultValue={form.getValues("jenisSk")}>
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih Jenis SK" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SK Kepala Madrasah">SK Kepala Madrasah/Sekolah</SelectItem>
                            <SelectItem value="SK Guru Tetap Yayasan">SK Guru Tetap Yayasan (GTY)</SelectItem>
                            <SelectItem value="SK Guru Tidak Tetap">SK Guru Tidak Tetap (GTT)</SelectItem>
                            <SelectItem value="SK Tenaga Kependidikan">SK Tenaga Kependidikan</SelectItem>
                          </SelectContent>
                        </Select>
                        {form.formState.errors.jenisSk && (
                          <p className="text-sm text-red-500">{form.formState.errors.jenisSk.message}</p>
                        )}
                      </div>
        
                       <div className="grid gap-2">
                        <Label>Jenis Pengajuan</Label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 rounded-md border p-3 hover:bg-slate-50 cursor-pointer">
                                <input type="radio" value="new" {...form.register("jenisPengajuan")} className="accent-primary" />
                                <span className="text-sm font-medium">Baru</span>
                            </label>
                            <label className="flex items-center gap-2 rounded-md border p-3 hover:bg-slate-50 cursor-pointer">
                                <input type="radio" value="renew" {...form.register("jenisPengajuan")} className="accent-primary" />
                                <span className="text-sm font-medium">Perpanjangan</span>
                            </label>
                        </div>
                      </div>
                  </div>
                </div>

                {/* SECTION 2: PERSONAL DATA */}
                <div className="space-y-4 border-b pb-4">
                     <h3 className="font-semibold text-lg">Data Diri</h3>
                     <div className="grid gap-4 md:grid-cols-2">
                         <div className="grid gap-2">
                            <Label htmlFor="nama">Nama Lengkap</Label>
                            <Input id="nama" placeholder="Nama sesuai KTP" {...form.register("nama")} />
                            {form.formState.errors.nama && (
                               <p className="text-sm text-red-500">{form.formState.errors.nama.message}</p>
                             )}
                         </div>
                          <div className="grid gap-2">
                            <Label htmlFor="niy">Nomor Induk Ma'arif (NIP/NIY)</Label>
                            <Input id="niy" placeholder="Cth: 198001..." {...form.register("niy")} />
                         </div>
                    </div>
                    
                    <div className="grid gap-4 md:grid-cols-2">
                         <div className="grid gap-2">
                            <Label htmlFor="tempatLahir">Tempat Lahir</Label>
                            <Input id="tempatLahir" placeholder="Kota Kelahiran" {...form.register("tempatLahir")} />
                             {form.formState.errors.tempatLahir && (
                               <p className="text-sm text-red-500">{form.formState.errors.tempatLahir.message}</p>
                             )}
                         </div>
                          <div className="grid gap-2">
                            <Label htmlFor="tanggalLahir">Tanggal Lahir</Label>
                            <Input id="tanggalLahir" type="date" {...form.register("tanggalLahir")} />
                             {form.formState.errors.tanggalLahir && (
                               <p className="text-sm text-red-500">{form.formState.errors.tanggalLahir.message}</p>
                             )}
                         </div>
                    </div>
                    
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="pendidikanTerakhir">Pendidikan Terakhir</Label>
                            <Select onValueChange={(val) => form.setValue("pendidikanTerakhir", val)}>
                              <SelectTrigger>
                                <SelectValue placeholder="Pilih Pendidikan" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="SMA/MA">SMA/MA</SelectItem>
                                <SelectItem value="D3">D3</SelectItem>
                                <SelectItem value="S1">S1</SelectItem>
                                <SelectItem value="S2">S2</SelectItem>
                                <SelectItem value="S3">S3</SelectItem>
                              </SelectContent>
                            </Select>
                            {form.formState.errors.pendidikanTerakhir && (
                               <p className="text-sm text-red-500">{form.formState.errors.pendidikanTerakhir.message}</p>
                             )}
                         </div>
                    </div>
                </div>

                {/* SECTION 3: EMPLOYMENT DATA */}
                <div className="space-y-4 border-b pb-4">
                    <h3 className="font-semibold text-lg">Data Kepegawaian</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                         <div className="grid gap-2">
                            <Label htmlFor="jabatan">Jabatan</Label>
                            <Input id="jabatan" placeholder="Cth: Kepala Sekolah, Guru Mapel..." {...form.register("jabatan")} />
                            {form.formState.errors.jabatan && (
                               <p className="text-sm text-red-500">{form.formState.errors.jabatan.message}</p>
                             )}
                         </div>
                          <div className="grid gap-2">
                            <Label htmlFor="unitKerja">Unit Kerja / Madrasah</Label>
                            <Input 
                                id="unitKerja" 
                                placeholder="Nama Lembaga" 
                                {...form.register("unitKerja")} 
                                readOnly={isOperator}
                                className={isOperator ? "bg-slate-100 text-muted-foreground" : ""}
                            />
                            {form.formState.errors.unitKerja && (
                               <p className="text-sm text-red-500">{form.formState.errors.unitKerja.message}</p>
                             )}
                         </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                         <div className="grid gap-2">
                            <Label htmlFor="tmt">Tanggal Mulai Tugas (TMT)</Label>
                            <Input id="tmt" type="date" {...form.register("tmt")} />
                             {form.formState.errors.tmt && (
                               <p className="text-sm text-red-500">{form.formState.errors.tmt.message}</p>
                             )}
                         </div>
                         <div className="grid gap-2">
                            <Label htmlFor="statusKepegawaian">Status Kepegawaian</Label>
                             <Select onValueChange={(val) => form.setValue("statusKepegawaian", val)}>
                              <SelectTrigger>
                                <SelectValue placeholder="Pilih Status (Opsional)" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="GTY">Guru Tetap Yayasan (GTY)</SelectItem>
                                <SelectItem value="GTT">Guru Tidak Tetap (GTT)</SelectItem>
                                <SelectItem value="Tendik">Tenaga Kependidikan</SelectItem>
                              </SelectContent>
                            </Select>
                         </div>
                    </div>

                     <div className="grid gap-4 md:grid-cols-2">
                         <div className="grid gap-2">
                            <Label>Sertifikasi</Label>
                            <div className="flex items-center space-x-2 border p-3 rounded-md">
                                <input 
                                    type="checkbox" 
                                    id="isCertified" 
                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                    {...form.register("isCertified")}
                                />
                                <Label htmlFor="isCertified" className="cursor-pointer">Sudah Sertifikasi?</Label>
                            </div>
                         </div>
                         <div className="grid gap-2">
                            <Label htmlFor="pdpkpnu">PDPKPNU (Jika Ada)</Label>
                            <Input id="pdpkpnu" placeholder="Angkatan / Tahun" {...form.register("pdpkpnu")} />
                         </div>
                    </div>
                </div>
    
                 <div className="grid gap-2">
                    <Label htmlFor="dokumen">Upload Dokumen Pendukung (PDF)</Label>
                    <div className="rounded-md border border-dashed p-6 text-center hover:bg-slate-50 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                        <FileText className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">Klik untuk upload surat permohonan / rekomendasi</p>
                        <Input type="file" className="hidden" id="dokumen" accept=".pdf" ref={fileInputRef} onChange={(e) => {
                             if(e.target.files?.[0]) toast.success(`File terpilih: ${e.target.files[0].name}`)
                        }}/>
                    </div>
                 </div>
    
                <div className="grid gap-2">
                    <Label htmlFor="keterangan">Keterangan Tambahan</Label>
                    <Textarea id="keterangan" placeholder="Catatan khusus untuk admin..." {...form.register("keterangan")} />
                </div>

                {/* FEATURE: Headmaster Requirement */}
                {(form.watch("jenisSk") || "").includes("Kepala") && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-4 space-y-2">
                        <Label className="text-amber-800">Surat Rekomendasi Fit & Proper Test</Label>
                        <Input type="file" accept=".pdf" className="bg-white" />
                        <p className="text-xs text-amber-700">Wajib untuk pengajuan SK Kepala Madrasah hasil seleksi.</p>
                    </div>
                )}

                <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => navigate("/dashboard/sk")}>Batal</Button>
                    <Button type="submit" disabled={isSubmitting}>
                       {isSubmitting ? "Menyimpan..." : <><Save className="mr-2 h-4 w-4" /> Simpan Pengajuan</>}
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
