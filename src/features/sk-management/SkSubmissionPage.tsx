import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { ArrowLeft, Save, FileText, BadgeCheck } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { api } from "@/lib/api"
import { toast } from "sonner"
import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BulkSkSubmission } from "./components/BulkSkSubmission"

// Helper for numbering (Inlined to fix build issues)
// Helper for numbering (Inlined to fix build issues)
function getRomanMonth(monthIndex: number): string {
    const romans = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
    return romans[monthIndex] || "I";
}

export function getNextSkNumber(): string {
    const stored = localStorage.getItem("sk_counter");
    let current = stored ? parseInt(stored) : 0;
    
    // Generate Number Logic Inlined
    const paddedNum = String(current + 1).padStart(3, "0");
    const monthRoman = getRomanMonth(new Date().getMonth());
    const year = new Date().getFullYear();
    return `${paddedNum}/SK/YP-MACI/${monthRoman}/${year}`;
}

export function incrementSkCounter() {
    const stored = localStorage.getItem("sk_counter");
    let current = stored ? parseInt(stored) : 0;
    localStorage.setItem("sk_counter", String(current + 1));
}

const skSchema = z.object({
  jenisSk: z.string().min(1, "Jenis SK wajib dipilih"),
  jenisPengajuan: z.enum(["new", "renew"]),
  nama: z.string().min(3, "Nama wajib diisi minimal 3 karakter"),
  niy: z.string().optional(),
  jabatan: z.string().min(1, "Jabatan wajib diisi"),
  unitKerja: z.string().min(1, "Unit Kerja wajib diisi"),
  keterangan: z.string().optional(),
})

type SkFormValues = z.infer<typeof skSchema>

export default function SkSubmissionPage() {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState("single")
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const [isSuperAdmin] = useState(() => {
    try {
        const str = localStorage.getItem("user");
        return str ? JSON.parse(str).role === "super_admin" : false;
    } catch { return false }
  })
  
  // Removed useEffect for role checking to avoid lint warning
  
  const form = useForm<SkFormValues>({
    resolver: zodResolver(skSchema),
    defaultValues: {
      jenisPengajuan: "new",
    }
  })

  const onSubmit = async (data: SkFormValues) => {
    setIsSubmitting(true)
    try {
        await api.createSk(data)
        toast.success("SK Berhasil diajukan!")
        navigate("/dashboard/sk")
    } catch (err: any) {
        toast.error(err.message || "Gagal mengajukan SK")
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
                
                <div className="space-y-4">
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
                            <span className="text-sm font-medium">Perpanjangan / Pembaruan</span>
                        </label>
                    </div>
                     {form.formState.errors.jenisPengajuan && (
                      <p className="text-sm text-red-500">{form.formState.errors.jenisPengajuan.message}</p>
                    )}
                  </div>
                </div>
    
                <div className="grid gap-4 md:grid-cols-2">
                     <div className="grid gap-2">
                        <Label htmlFor="nama">Nama Lengkap</Label>
                        <Input id="nama" placeholder="Nama sesuai KTP" {...form.register("nama")} />
                        {form.formState.errors.nama && (
                           <p className="text-sm text-red-500">{form.formState.errors.nama.message}</p>
                         )}
                     </div>
                      <div className="grid gap-2">
                        <Label htmlFor="niy">NIY (Nomor Induk Yayasan) - Optional</Label>
                        <Input id="niy" placeholder="Cth: 198001..." {...form.register("niy")} />
                     </div>
                </div>
    
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
                        <Input id="unitKerja" placeholder="Nama Lembaga" {...form.register("unitKerja")} />
                        {form.formState.errors.unitKerja && (
                           <p className="text-sm text-red-500">{form.formState.errors.unitKerja.message}</p>
                         )}
                     </div>
                </div>
    
                 <div className="grid gap-2">
                    <Label htmlFor="dokumen">Upload Dokumen Pendukung (PDF)</Label>
                    <div className="rounded-md border border-dashed p-6 text-center hover:bg-slate-50">
                        <FileText className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">Klik untuk upload surat permohonan / rekomendasi</p>
                        <Input type="file" className="hidden" id="dokumen" accept=".pdf" />
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

                {/* FEATURE: Upload Signed SK - Only for Super Admin */}
                {isSuperAdmin && (
                    <div className="rounded-md border p-4 bg-green-50 space-y-4 border-green-200">
                        <h3 className="font-medium text-sm flex items-center text-green-800">
                            <BadgeCheck className="w-4 h-4 mr-2 text-green-600"/> 
                            Admin Area: Upload SK yang Sudah Ditandatangani
                        </h3>
                        <p className="text-xs text-green-700">
                            Upload file final yang sudah ditandatangani di sini. File ini akan tersedia untuk didownload oleh operator yang mengajukan.
                        </p>

                        <div className="grid w-full max-w-sm items-center gap-1.5">
                            <Label htmlFor="signedSk" className="text-green-800">File SK Final (PDF)</Label>
                            <Input 
                                id="signedSk" 
                                type="file" 
                                accept=".pdf" 
                                onChange={(e) => {
                                    if(e.target.files?.[0]) {
                                        alert("File SK Final disiapkan untuk upload. (Simulasi)")
                                    }
                                }}
                            />
                        </div>
                        <div className="grid w-full max-w-sm items-center gap-1.5">
                            <Label htmlFor="sigImage">Upload Scan Tanda Tangan (Opsional)</Label>
                            <Input id="sigImage" type="file" accept="image/png, image/jpeg" />
                            <p className="text-[10px] text-muted-foreground">Format PNG transparan disarankan. Maks 2MB.</p>
                        </div>
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
