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
import { ArrowLeft, Save, FileText, Upload, Loader2 } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { useState, useRef } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BulkSkSubmission } from "./components/BulkSkSubmission"
// 🔥 CONVEX for SK creation
import { useMutation, useAction } from "convex/react"
import { api as convexApi } from "../../../convex/_generated/api"
// Keep old API for file upload only (deprecated for this flow)
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
  isCertified: z.boolean().optional(),
  pdpkpnu: z.string().optional(),
})

type SkFormValues = z.infer<typeof skSchema>

export default function SkSubmissionPage() {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [activeTab, setActiveTab] = useState("single")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
   
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

  // 🔥 CONVEX MUTATIONS & ACTIONS
  const createTeacherMutation = useMutation(convexApi.teachers.create)
  const uploadToDrive = useAction((convexApi as any).drive.uploadFile)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          if (file.size > 500 * 1024) { // 500KB limit
              toast.error("Ukuran file maksimal 500KB");
              return;
          }
          if (file.type !== "application/pdf" && !file.type.startsWith("image/")) {
              toast.error("Hanya file PDF atau Gambar yang diperbolehkan");
              return;
          }
          setSelectedFile(file);
          toast.success(`File terpilih: ${file.name}`);
      }
  }

  const onSubmit = async (data: SkFormValues) => {
    setIsSubmitting(true)
    try {
        let driveUrl = undefined;

        // 🔥 STEP 1: Upload to Google Drive (if file selected)
        if (selectedFile) {
            setIsUploading(true);
            try {
                toast.info("Mengupload dokumen ke Google Drive...");
                
                const base64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(selectedFile);
                    reader.onload = () => resolve((reader.result as string).split(',')[1]);
                    reader.onerror = reject;
                });

                const result = await uploadToDrive({
                    fileData: base64,
                    fileName: `SK_REQ_${data.niy || data.nama}_${Date.now()}.pdf`,
                    mimeType: selectedFile.type
                });

                if ((result as any).success === false) {
                     throw new Error((result as any).error);
                }

                driveUrl = result.url; // Web View Link
                toast.success("Dokumen berhasil diupload!");
            } catch (uErr: any) {
                console.error("Upload Failed:", uErr);
                const msg = uErr?.message || "Unknown Error";
                // Show a detailed error via toast/dialog for better UX
                toast.error(`Gagal Upload ke Google Drive: ${msg}`, {
                    description: "Mohon informasikan pesan ini kepada administrator sistem jika masalah berlanjut.",
                    duration: 5000
                });
                throw new Error(`Gagal mengupload dokumen ke Google Drive: ${msg}`);
            } finally {
                setIsUploading(false);
            }
        }

        // 🔥 STEP 2: Create Teacher Record with File URL
        toast.info("Menyimpan data pengajuan...")
        
        // Generate NUPTK if NIY provided, otherwise use timestamp-based ID
        const nuptk = data.niy || `TEMP-${Date.now()}`
        
        const token = localStorage.getItem("token") || undefined;
        
        // Map Status
        const statusMap: Record<string, string> = {
            "SK Guru Tetap Yayasan": "GTY",
            "SK Guru Tidak Tetap": "GTT",
            "SK Tenaga Kependidikan": "Tendik",
            "SK Kepala Madrasah": "Kepala"
        };
        const derivedStatus = statusMap[data.jenisSk] || "GTY";
        const finalStatus = data.statusKepegawaian || derivedStatus;

        await createTeacherMutation({
            nuptk: nuptk,
            nama: data.nama,
            nip: data.niy, // Maps to 'Nomor Induk Ma'arif'
            unitKerja: data.unitKerja,
            status: finalStatus,
            isActive: true, // Auto-active for new submission? Or pending? Teachers usually active if they exist.
            
            // NEW FIELDS MAPPING
            tempatLahir: data.tempatLahir,
            tanggalLahir: data.tanggalLahir,
            pendidikanTerakhir: data.pendidikanTerakhir,
            tmt: data.tmt,
            isCertified: data.isCertified,
            pdpkpnu: data.pdpkpnu,
            
            // 🔥 GOOGLE DRIVE URL
            suratPermohonanUrl: driveUrl,
            
            token: token,
        })


        // 🔥 STEP 3: Finish
        toast.success("✅ Pengajuan berhasil dikirim! Data masuk antrean verifikasi.")
        navigate("/dashboard/teachers") // Redirect to Teacher List
    } catch (err) {
        console.error("Submission Error:", err); 
        const errorMessage = (err as any).message || "Gagal mengajukan SK"
        toast.error(errorMessage)
    } finally {
        setIsSubmitting(false)
        setIsUploading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 relative">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-5%] left-[-5%] w-[30%] h-[30%] bg-emerald-100/40 rounded-full blur-[80px] pointer-events-none -z-10" />
      <div className="absolute right-[-10%] top-[20%] w-[40%] h-[40%] bg-blue-50/40 rounded-full blur-[100px] pointer-events-none -z-10" />

      <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/dashboard/sk")} className="pl-0 hover:bg-emerald-50 hover:text-emerald-700 transition-colors">
            <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
          </Button>
          <div className="text-right">
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-800">Penerbitan SK</h1>
             <div className="text-xs mt-1 text-slate-500 font-medium">
                Sistem Layanan Mandiri
             </div>
          </div>
      </div>

      <Tabs defaultValue="single" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-slate-100/60 p-1.5 rounded-2xl shadow-inner mb-6">
          <TabsTrigger value="single" className="data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:font-bold data-[state=active]:shadow-md rounded-xl py-2.5 transition-all duration-300">Input Satuan</TabsTrigger>
          <TabsTrigger value="collective" className="data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:font-bold data-[state=active]:shadow-md rounded-xl py-2.5 transition-all duration-300">Pengajuan Kolektif (Excel)</TabsTrigger>
        </TabsList>
        
        <TabsContent value="single" className="mt-0">
          <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white/70 backdrop-blur-xl overflow-hidden relative z-10 w-full mb-6 max-w-none rounded-2xl">
            {/* Subtle card glow */}
            <div className="absolute top-0 right-[-10%] w-[60%] h-[60%] bg-gradient-to-br from-emerald-100/50 to-emerald-50/10 blur-3xl pointer-events-none" />
            
            <CardHeader className="pb-6 border-b border-slate-100/60 bg-white/40 pt-8 px-8">
              <CardTitle className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-100 rounded-xl text-emerald-600 shadow-inner">
                      <FileText className="w-6 h-6"/>
                  </div>
                  Ajuan SK Baru
              </CardTitle>
              <CardDescription className="text-slate-500 font-medium text-sm mt-2 ml-14">
                 Mohon isi formulir di bawah ini dengan lengkap dan benar untuk memproses Surat Keputusan.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-8 pt-8 pb-10">
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10 relative z-10">
                
                {/* SECTION 1: SK DETAILS */}
                <div className="space-y-6">
                  <h3 className="font-bold text-lg text-emerald-800 flex items-center gap-2 border-b border-emerald-100 pb-2">Informasi Permohonan</h3>
                  <div className="grid gap-6 md:grid-cols-2">
                      <div className="grid gap-2">
                        <Label htmlFor="jenisSk" className="text-slate-700 font-semibold">Jenis SK</Label>
                        <Select onValueChange={(val) => form.setValue("jenisSk", val)} defaultValue={form.getValues("jenisSk")}>
                          <SelectTrigger className="bg-white/60 border-slate-200 focus:ring-emerald-500/30 focus:border-emerald-400 h-11 transition-all rounded-xl">
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
                        <Label className="text-slate-700 font-semibold mb-1">Jenis Pengajuan</Label>
                        <div className="flex gap-4">
                            <label className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/50 p-3 hover:bg-emerald-50 hover:border-emerald-200 cursor-pointer transition-all has-[:checked]:bg-emerald-50 has-[:checked]:border-emerald-500 has-[:checked]:ring-1 has-[:checked]:ring-emerald-500">
                                <input type="radio" value="new" {...form.register("jenisPengajuan")} className="accent-emerald-600 w-4 h-4" />
                                <span className="text-sm font-semibold text-slate-700">Baru</span>
                            </label>
                            <label className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/50 p-3 hover:bg-emerald-50 hover:border-emerald-200 cursor-pointer transition-all has-[:checked]:bg-emerald-50 has-[:checked]:border-emerald-500 has-[:checked]:ring-1 has-[:checked]:ring-emerald-500">
                                <input type="radio" value="renew" {...form.register("jenisPengajuan")} className="accent-emerald-600 w-4 h-4" />
                                <span className="text-sm font-semibold text-slate-700">Perpanjangan</span>
                            </label>
                        </div>
                      </div>
                  </div>
                </div>

                {/* SECTION 2: DATA DIRI */}
                <div className="space-y-6">
                  <h3 className="font-bold text-lg text-emerald-800 flex items-center gap-2 border-b border-emerald-100 pb-2">Informasi Pribadi</h3>
                  <div className="grid gap-6 md:grid-cols-2">
                       <div className="grid gap-2">
                          <Label htmlFor="nama" className="text-slate-700 font-semibold">Nama Lengkap & Gelar</Label>
                          <Input id="nama" placeholder="Cth: Ahmad Subagyo, S.Pd" {...form.register("nama")} className="bg-white/60 border-slate-200 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-400 h-11 transition-all rounded-xl" />
                          {form.formState.errors.nama && <p className="text-sm text-red-500">{form.formState.errors.nama.message}</p>}
                       </div>
                       <div className="grid gap-2">
                          <Label htmlFor="niy" className="text-slate-700 font-semibold">Nomor Induk Ma'arif (NIP/NIY)</Label>
                          <Input id="niy" placeholder="Cth: 198001.." {...form.register("niy")} className="bg-white/60 border-slate-200 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-400 h-11 transition-all rounded-xl" />
                          <p className="text-[10px] text-slate-500 ml-1">Kosongi jika belum punya / baru diajukan bersamaan</p>
                       </div>
                       <div className="grid gap-2">
                          <Label htmlFor="tempatLahir" className="text-slate-700 font-semibold">Tempat Lahir</Label>
                          <Input id="tempatLahir" placeholder="Kota Kelahiran" {...form.register("tempatLahir")} className="bg-white/60 border-slate-200 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-400 h-11 transition-all rounded-xl" />
                       </div>
                       <div className="grid gap-2">
                          <Label htmlFor="tanggalLahir" className="text-slate-700 font-semibold">Tanggal Lahir</Label>
                          <Input id="tanggalLahir" type="date" {...form.register("tanggalLahir")} className="bg-white/60 border-slate-200 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-400 h-11 transition-all rounded-xl" />
                       </div>
                       <div className="grid gap-2 md:col-span-2">
                          <Label htmlFor="pendidikanTerakhir" className="text-slate-700 font-semibold">Pendidikan Terakhir</Label>
                          <Select onValueChange={(val) => form.setValue("pendidikanTerakhir", val)} defaultValue={form.getValues("pendidikanTerakhir")}>
                              <SelectTrigger className="bg-white/60 border-slate-200 focus:ring-emerald-500/30 focus:border-emerald-400 h-11 transition-all rounded-xl">
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
                
                {/* SECTION 3: DATA KEPEGAWAIAN */}
                <div className="space-y-6">
                  <h3 className="font-bold text-lg text-emerald-800 flex items-center gap-2 border-b border-emerald-100 pb-2">Informasi Kepegawaian</h3>
                  <div className="grid gap-6 md:grid-cols-2">
                      <div className="grid gap-2">
                          <Label htmlFor="jabatan" className="text-slate-700 font-semibold">Jabatan</Label>
                          <Input id="jabatan" placeholder="Cth: Kepala Sekolah, Guru Mapel..." {...form.register("jabatan")} className="bg-white/60 border-slate-200 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-400 h-11 transition-all rounded-xl" />
                      </div>
                      <div className="grid gap-2">
                          <Label htmlFor="unitKerja" className="text-slate-700 font-semibold">Unit Kerja / Madrasah</Label>
                          <Input id="unitKerja" disabled={!isSuperAdmin} placeholder="Nama Lembaga" {...form.register("unitKerja")} className="bg-white/60 border-slate-200 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-400 h-11 transition-all rounded-xl disabled:bg-slate-100 disabled:opacity-80" />
                          {!isSuperAdmin && <p className="text-[10px] text-slate-500 ml-1">Terisi otomatis sesuai profil lembaga Anda.</p>}
                      </div>
                      <div className="grid gap-2">
                          <Label htmlFor="tmt" className="text-slate-700 font-semibold">Tanggal Mulai Tugas (TMT)</Label>
                          <Input id="tmt" type="date" {...form.register("tmt")} className="bg-white/60 border-slate-200 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-400 h-11 transition-all rounded-xl" />
                      </div>
                      <div className="grid gap-2">
                          <Label htmlFor="statusKepegawaian" className="text-slate-700 font-semibold">Status Kepegawaian (Opsional)</Label>
                          <Select onValueChange={(val) => form.setValue("statusKepegawaian", val)} defaultValue={form.getValues("statusKepegawaian")}>
                              <SelectTrigger className="bg-white/60 border-slate-200 focus:ring-emerald-500/30 focus:border-emerald-400 h-11 transition-all rounded-xl">
                                <SelectValue placeholder="Pilih Status (Opsional)" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="GTY">Guru Tetap Yayasan (GTY)</SelectItem>
                                <SelectItem value="GTT">Guru Tidak Tetap (GTT)</SelectItem>
                                <SelectItem value="Tendik">Tenaga Kependidikan</SelectItem>
                              </SelectContent>
                          </Select>
                          <p className="text-[10px] text-slate-500 ml-1">Jika dikosongkan, akan otomatis disesuaikan dengan Jenis SK.</p>
                      </div>
                  </div>
                </div>
                
                {/* SECTION 4: KELENGKAPAN TAMBAHAN */}
                <div className="space-y-6">
                   <h3 className="font-bold text-lg text-emerald-800 flex items-center gap-2 border-b border-emerald-100 pb-2">Kelengkapan Administrasi</h3>
                   <div className="grid gap-6 md:grid-cols-2">
                        <div className="grid gap-2">
                            <Label className="text-slate-700 font-semibold mb-1">Status Sertifikasi</Label>
                            <div className="flex gap-4">
                                <label className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/50 p-3 hover:bg-emerald-50 hover:border-emerald-200 cursor-pointer transition-all has-[:checked]:bg-emerald-50 has-[:checked]:border-emerald-500 has-[:checked]:ring-1 has-[:checked]:ring-emerald-500">
                                    <input type="radio" value="true" {...form.register("isCertified")} className="accent-emerald-600 w-4 h-4" />
                                    <span className="text-sm font-semibold text-slate-700">Sudah</span>
                                </label>
                                <label className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/50 p-3 hover:bg-emerald-50 hover:border-emerald-200 cursor-pointer transition-all has-[:checked]:bg-emerald-50 has-[:checked]:border-emerald-500 has-[:checked]:ring-1 has-[:checked]:ring-emerald-500">
                                    <input type="radio" value="false" {...form.register("isCertified")} className="accent-emerald-600 w-4 h-4" />
                                    <span className="text-sm font-semibold text-slate-700">Belum</span>
                                </label>
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="pdpkpnu" className="text-slate-700 font-semibold">Tahun Lulus PDPKPNU / PMKNU</Label>
                            <Input id="pdpkpnu" placeholder="Cth: 2023 (Isi 'Belum' jika tidak ada)" {...form.register("pdpkpnu")} className="bg-white/60 border-slate-200 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-400 h-11 transition-all rounded-xl" />
                        </div>
                   </div>
                </div>
                {/* SECTION 5: KELENGKAPAN TAMBAHAN LAINNYA */}
                 <div className="grid gap-6 md:grid-cols-2 pt-2">
                     <div className="space-y-4">
                        <Label htmlFor="dokumen" className="text-slate-700 font-semibold">Upload Dokumen Tambahan (Opsional)</Label>
                        <div 
                            className="rounded-xl border-2 border-dashed border-emerald-200 bg-emerald-50/30 p-6 text-center hover:bg-emerald-50/60 hover:border-emerald-400 transition-all cursor-pointer flex flex-col items-center justify-center gap-3 shadow-inner" 
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {isUploading ? (
                                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                            ) : selectedFile ? (
                                <div className="flex flex-col items-center gap-2 text-emerald-700 font-medium">
                                    <FileText className="h-8 w-8" />
                                    <span className="text-sm truncate max-w-[200px]">{selectedFile.name}</span>
                                </div>
                            ) : (
                                <>
                                    <div className="p-3 bg-emerald-100 rounded-full text-emerald-600">
                                        <Upload className="mx-auto h-6 w-6" />
                                    </div>
                                    <p className="text-sm font-medium text-emerald-900 mt-2">Klik untuk upload file pendukung</p>
                                    <p className="text-xs text-emerald-600/80">Maksimal 500KB (PDF/JPG/PNG)</p>
                                </>
                            )}
                            <Input 
                                type="file" 
                                className="hidden" 
                                id="dokumen" 
                                accept=".pdf, .jpg, .jpeg, .png" 
                                ref={fileInputRef} 
                                onChange={handleFileChange} 
                            />
                        </div>
                     </div>
        
                    <div className="space-y-4 flex flex-col">
                        <Label htmlFor="keterangan" className="text-slate-700 font-semibold">Keterangan Tambahan</Label>
                        <Textarea id="keterangan" placeholder="Catatan khusus untuk verifikator SK..." {...form.register("keterangan")} className="bg-white/60 border-slate-200 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-400 flex-1 transition-all rounded-xl resize-none min-h-[140px]" />
                    </div>
                 </div>

                <div className="flex justify-end gap-4 pt-8 border-t border-emerald-100/50 mt-8">
                    <Button type="button" variant="outline" className="border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl px-6 h-12 font-medium" onClick={() => navigate("/dashboard/sk")}>Batalkan</Button>
                    <Button type="submit" disabled={isSubmitting || isUploading} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg hover:shadow-emerald-600/20 hover-lift rounded-xl px-8 h-12 font-semibold transition-all">
                       {isSubmitting || isUploading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Menyimpan...</> : <><Save className="mr-2 h-5 w-5 -ml-1" /> Simpan Pengajuan</>}
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
