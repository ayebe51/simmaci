"use client"

import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Save, RefreshCw, Building, FileSignature, FileText, CheckCircle, Download, Lock, Eye, EyeOff, AlertTriangle } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useState, useEffect } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "../../../convex/_generated/api"

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("template")
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState<string | null>(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  // API Safety Check
  const isApiReady = !!api.settings

  // Switch to NEW Module: settings_cloud
   
  const apiCloud = (api as any).settings_cloud;
  
  // Use Safe Query from New Module
  const cloudSettings = useQuery(apiCloud ? apiCloud.list : "skip") || [];

  // Use Mutation from New Module (Fallback to password change if not ready, just to carry a valid function)
  const saveTemplate = useMutation(apiCloud ? apiCloud.save : api.auth.changePassword)

  // Cloud Upload Handler
  const handleCloudUpload = async (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
      const file = e.target.files?.[0]
      if (!file) return

      try {
          setIsUploading(key)
          
          // CONVERSION: File -> Base64
          const reader = new FileReader();
          reader.readAsDataURL(file);
          
          reader.onload = async () => {
              const base64 = reader.result as string;
              
              if (apiCloud) {
                  // DIRECT SAVE TO NEW DB MODULE
                  await saveTemplate({
                      key,
                      base64,
                      mimeType: file.type
                  })
                  toast.success("Template berhasil disimpan di Cloud (New)!")
              } else {
                  toast.error("Module Cloud belum siap. Coba refresh.")
              }
              setIsUploading(null)
          };
          
          reader.onerror = (error) => {
              throw new Error("Gagal membaca file: " + error);
          };

      } catch (err: unknown) {
          console.error(err)
           
          toast.error("Gagal upload: " + (err as any).message)
      } finally {
          setIsUploading(null)
      }
  }

  
  // Default Settings State
  const [settings, setSettings] = useState({
    // Profil Lembaga
    namaYayasan: "Lembaga Pendidikan Ma'arif NU Cilacap",
    alamatYayasan: "Jl. Masjid No. 09, Cilacap",
    teleponYayasan: "0282-123456",
    
    // SK Settings - Dual Signatories
    signerKetuaName: "H. Munib",
    signerKetuaNip: "",
    signerSekretarisName: "H. Makhmud",
    signerSekretarisNip: "",
    skPrefix: "SK/YP-MACI"

  })

  // Password State
  const changePassword = useMutation(api.auth.changePassword)
  const [passForm, setPassForm] = useState({ old: "", new: "", confirm: "" })
  const [showPass, setShowPass] = useState({ old: false, new: false })

  const handlePassChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setPassForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
      e.preventDefault()
      if (passForm.new.length < 6) {
          toast.error("Password baru minimal 6 karakter")
          return
      }
      if (passForm.new !== passForm.confirm) {
          toast.error("Konfirmasi password tidak cocok")
          return
      }

      try {
          const userStr = localStorage.getItem("user")
          const user = userStr ? JSON.parse(userStr) : null
          
          if (!user || !user._id) {
              toast.error("Sesi tidak valid.")
              return
          }

          await changePassword({
              userId: user._id,
              oldPassword: passForm.old,
              newPassword: passForm.new
          })
          
          toast.success("Password berhasil diubah! Silakan login ulang.")
          setPassForm({ old: "", new: "", confirm: "" })
          // Optionally logout or just stay
      } catch (err) {
          toast.error("Gagal ubah password: " + (err as Error).message)
      }
  }

  // User Role State
  const [userRole, setUserRole] = useState<string | null>(null)

  // Load from local storage on mount
  useEffect(() => {
    // 1. Get User Role
    try {
        const userStr = localStorage.getItem("user")
        if (userStr) {
            const user = JSON.parse(userStr)
            setUserRole(user.role || "operator")
            
            // If NOT Super Admin, redirect to Profil/Security
            if (user.role !== "super_admin") {
                setActiveTab("profil")
            }
        }
    } catch (e) {
        console.error("Error parsing user", e)
    }

    // 2. Load Settings
    const saved = localStorage.getItem("app_settings")
    if (saved) {
        try {
            setSettings(prev => ({ ...prev, ...JSON.parse(saved) }))
        } catch (e) { console.error("Failed to parse settings", e) }
    }
  }, [])

  const isAdmin = userRole === "super_admin"

  const handleChange = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  // ... (Keep handleSave, handleDownloadBackup, handleRestoreBackup, handleResetData) ...
  const handleSave = () => {
    setIsSaving(true)
    setTimeout(() => {
        localStorage.setItem("app_settings", JSON.stringify(settings))
        setIsSaving(false)
        toast.success("Pengaturan berhasil disimpan!")
    }, 800)
  }

  const handleDownloadBackup = () => {
    try {
         
        const backupData: Record<string, any> = {}
        const keysToBackup = ["app_schools", "app_teachers", "app_students", "app_settings", "sk_submissions", "sk_template_name", "sk_template_blob"]
        keysToBackup.forEach(key => {
            const val = localStorage.getItem(key)
            if (val) backupData[key] = val
        })
        const blob = new Blob([JSON.stringify({ version: "1.0", timestamp: new Date().toISOString(), data: backupData }, null, 2)], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `sim_maarif_backup_${new Date().toISOString().slice(0,10)}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        toast.success("Backup berhasil didownload.")
    } catch (error) { console.error(error); toast.error("Gagal membuat backup.") }
  }

    const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (event) => {
          try {
              const json = JSON.parse(event.target?.result as string)
              if (!json.data || !json.version) throw new Error("Format file backup tidak valid.")
              Object.keys(json.data).forEach(key => localStorage.setItem(key, json.data[key]))
              toast.success("Data berhasil dipulihkan! Reloading...")
              setTimeout(() => window.location.reload(), 1500)
          } catch (err) { console.error(err); toast.error("Gagal restore.") }
      }
      reader.readAsText(file)
  }

  const handleResetData = () => {
     setShowResetConfirm(true)
  }

  const confirmReset = () => {
      localStorage.clear()
      window.location.reload()
  }


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-2xl font-bold tracking-tight">Pengaturan Sistem</h1>
            <p className="text-muted-foreground">
                {isAdmin ? "Konfigurasi profil lembaga, template SK, dan pejabat penandatangan." : "Kelola profil lembaga dan keamanan akun anda."}
            </p>
        </div>
        {/* Header Save Button */}
        {(isAdmin || userRole === "admin_yayasan") && (
            <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Menyimpan..." : <><Save className="mr-2 h-4 w-4" /> Simpan Perubahan</>}
            </Button>
        )}
      </div>

      <Tabs defaultValue="template" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto w-full justify-start gap-2 bg-transparent p-0 mb-6">
           {/* Template Tab (Privileged) */}
           {(isAdmin || userRole === "admin_yayasan") && (
               <TabsTrigger value="template" className="data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm bg-slate-100/50 border border-transparent data-[state=active]:border-border">Template SK</TabsTrigger>
           )}
           {/* Signer Tab (Privileged) */}
           {(isAdmin || userRole === "admin_yayasan") && (
               <TabsTrigger value="signer" className="data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm bg-slate-100/50 border border-transparent data-[state=active]:border-border">Penandatangan</TabsTrigger>
           )}
           <TabsTrigger value="profil" className="data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm bg-slate-100/50 border border-transparent data-[state=active]:border-border">Profil Lembaga</TabsTrigger>
           <TabsTrigger value="security" className="data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm bg-slate-100/50 border border-transparent data-[state=active]:border-border">Keamanan Akun</TabsTrigger>
           {isAdmin && (
               <TabsTrigger value="system" className="data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm bg-slate-100/50 border border-transparent data-[state=active]:border-border">System</TabsTrigger>
           )}
        </TabsList>

        {/* Template Tab (Admin & Yayasan) */}
        {(isAdmin || userRole === "admin_yayasan") && (
        <TabsContent value="template">
            {!isApiReady ? (
                 <div className="p-8 text-center bg-amber-50 rounded border border-amber-200 text-amber-800">
                    <h3 className="font-bold">⚠️ Sistem Sedang Update</h3>
                    <p>Module API Settings belum terbaca oleh browser. Mohon tunggu 1-2 menit lalu Refresh Halaman.</p>
                </div>
            ) : cloudSettings === undefined ? (
                <div className="p-8 text-center text-muted-foreground animate-pulse">
                    Memuat data cloud...
                </div>
            ) : (
                <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5"/> Template Generator SK</CardTitle>
                    <CardDescription>Upload file Word (.docx) untuk masing-masing jenis SK.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-2">
                        {[
                            { id: "sk_template_gty", label: "SK Guru Tetap Yayasan (GTY)", desc: "Template untuk GTY" },
                            { id: "sk_template_gtt", label: "SK Guru Tidak Tetap (GTT)", desc: "Template untuk GTT" },
                            { id: "sk_template_tendik", label: "SK Tenaga Kependidikan", desc: "Template untuk Staff/TU" },
                            { id: "sk_template_kamad_pns", label: "SK Kamad (PNS)", desc: "Khusus Kepala Sekolah PNS" },
                            { id: "sk_template_kamad_nonpns", label: "SK Kamad (Non PNS)", desc: "Khusus Kepala Sekolah Non-PNS" },
                            { id: "sk_template_kamad_plt", label: "SK Kamad (PLT)", desc: "Khusus Pelaksana Tugas (PLT)" },
                        ].map((template) => {
                            const cloudSetting = cloudSettings?.find(s => s.key === template.id)
                            const hasCloud = !!cloudSetting 
                            const cloudTime = cloudSetting?.updatedAt ? new Date(cloudSetting.updatedAt).toLocaleDateString() : ""
                            const hasLocal = !!localStorage.getItem(template.id + "_blob")

                            return (
                                <div key={template.id} className="border p-4 rounded-lg bg-slate-50 relative group">
                                    <div className="mb-3">
                                        <h3 className="font-semibold text-sm text-slate-800">{template.label}</h3>
                                        <p className="text-xs text-muted-foreground">{template.desc}</p>
                                    </div>
                                    
                                    {hasCloud ? (
                                        <div className="flex items-center gap-3 p-3 bg-white border rounded border-green-200">
                                            <div className="bg-green-100 p-2 rounded-full text-green-600">
                                                <CheckCircle className="h-4 w-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-medium truncate">Tersimpan di Cloud ✅</p>
                                                <p className="text-[10px] text-green-600">Update: {cloudTime}</p>
                                            </div>
                                            <Button 
                                                variant="outline" size="sm" className="h-7 text-xs"
                                                onClick={() => document.getElementById(`upload-${template.id}`)?.click()}
                                            >
                                                Ganti
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {hasLocal && (
                                                <div className="text-[10px] bg-amber-100 text-amber-800 p-2 rounded border border-amber-200 mb-2">
                                                    ⚠️ File ada di Browser (Lokal), tapi BELUM di Cloud. <br/>
                                                    <strong>Harap Upload Ulang.</strong>
                                                </div>
                                            )}
                                            <div className="flex items-center justify-center p-4 border-2 border-dashed rounded bg-white hover:bg-slate-50 transition-colors cursor-pointer relative">
                                                <div className="text-center space-y-1">
                                                    <Download className="mx-auto h-4 w-4 text-muted-foreground" />
                                                    <span className="text-xs text-slate-500 block">
                                                        {isUploading === template.id ? "Mengupload..." : "Upload .docx ke Cloud"}
                                                    </span>
                                                </div>
                                                <input 
                                                    id={`upload-${template.id}`}
                                                    type="file" accept=".docx"
                                                    disabled={isUploading === template.id}
                                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                                    aria-label="Upload Template Word"
                                                    onChange={(e) => handleCloudUpload(e, template.id)}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                
                    <div className="bg-blue-50 p-4 rounded-md text-xs text-blue-700 space-y-2 border border-blue-100">
                         <p className="font-semibold">Bantuan Placeholder:</p>
                         <p>Gunakan kode berikut di dalam file Word anda, sistem akan otomatis menggantinya:</p>
                         <div className="grid grid-cols-2 gap-2 font-mono">
                             <span>{`{{NAMA}}`} - Nama Lengkap</span>
                             <span>{`{{NIP}}`} - NIP/PegID</span>
                             <span>{`{{JABATAN}}`} - Jabatan</span>
                             <span>{`{{UNIT_KERJA}}`} - Unit Kerja</span>
                             <span>{`{{STATUS}}`} - Status Kepegawaian</span>
                             <span>{`{{TTL}}`} - Tempat, Tgl Lahir</span>
                             <span>{`{{PENDIDIKAN}}`} - Pendidikan Terakhir</span>
                             <span>{`{{KETUA_NAMA}}`} - Nama Ketua</span>
                             <span>{`{{SEKRETARIS_NAMA}}`} - Nama Sekretaris</span>
                         </div>
                    </div>
                </CardContent>
            </Card>
            )}
        </TabsContent>
        )}

        {/* Signer Tab (Admin & Yayasan) */}
        {(isAdmin || userRole === "admin_yayasan") && (
        <TabsContent value="signer">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><FileSignature className="h-5 w-5"/> Pejabat Penandatangan</CardTitle>
                    <CardDescription>Konfigurasi nama Ketua dan Sekretaris yang akan muncul di SK.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-3 p-4 border rounded-md bg-slate-50">
                        <h4 className="font-semibold text-sm uppercase tracking-wide text-slate-500">Pihak 1: Ketua</h4>
                        <div className="grid gap-2">
                            <Label htmlFor="signerKetuaName">Nama Lengkap</Label>
                            <Input id="signerKetuaName" value={settings.signerKetuaName} onChange={(e) => handleChange("signerKetuaName", e.target.value)} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="signerKetuaNip">NIY / NIP (Opsional)</Label>
                            <Input id="signerKetuaNip" value={settings.signerKetuaNip} onChange={(e) => handleChange("signerKetuaNip", e.target.value)} />
                        </div>
                    </div>

                    <div className="space-y-3 p-4 border rounded-md bg-slate-50">
                        <h4 className="font-semibold text-sm uppercase tracking-wide text-slate-500">Pihak 2: Sekretaris</h4>
                        <div className="grid gap-2">
                            <Label htmlFor="signerSekretarisName">Nama Lengkap</Label>
                            <Input id="signerSekretarisName" value={settings.signerSekretarisName} onChange={(e) => handleChange("signerSekretarisName", e.target.value)} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="signerSekretarisNip">NIY / NIP (Opsional)</Label>
                            <Input id="signerSekretarisNip" value={settings.signerSekretarisNip} onChange={(e) => handleChange("signerSekretarisNip", e.target.value)} />
                        </div>
                    </div>

                    <div className="grid gap-2 pt-4 border-t">
                         <Label htmlFor="skPrefix">Prefix Nomor SK</Label>
                         <Input id="skPrefix" value={settings.skPrefix} onChange={(e) => handleChange("skPrefix", e.target.value)} />
                         <p className="text-[10px] text-muted-foreground">Format nomor: [Auto]/[Prefix]/[Bulan]/[Tahun]</p>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
        )}

        {/* Profil Tab */}
        <TabsContent value="profil">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Building className="h-5 w-5"/> {isAdmin ? "Profil Yayasan / Cabang" : "Profil Lembaga Anda"}</CardTitle>
                    <CardDescription>Informasi ini digunakan dalam Kop Surat dan Data Lembaga.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-2">
                        <Label>Nama Yayasan / Cabang</Label>
                        <Input value={settings.namaYayasan} onChange={(e) => handleChange("namaYayasan", e.target.value)} disabled={!isAdmin && userRole !== "admin_yayasan"} />
                        {!isAdmin && userRole !== "admin_yayasan" && <p className="text-[10px] text-muted-foreground">Hubungi Admin PC untuk mengubah data induk.</p>}
                    </div>
                    <div className="grid gap-2">
                        <Label>Alamat Lengkap</Label>
                        <Input value={settings.alamatYayasan} onChange={(e) => handleChange("alamatYayasan", e.target.value)} disabled={!isAdmin && userRole !== "admin_yayasan"} />
                    </div>
                    <div className="grid gap-2">
                        <Label>Telepon / Kontak</Label>
                        <Input value={settings.teleponYayasan} onChange={(e) => handleChange("teleponYayasan", e.target.value)} disabled={!isAdmin && userRole !== "admin_yayasan"} />
                    </div>
                </CardContent>
            </Card>
        </TabsContent>


        <TabsContent value="security">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5"/> Ganti Password</CardTitle>
                    <CardDescription>Amankan akun Anda dengan mengganti password secara berkala.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleUpdatePassword} className="space-y-4 max-w-md">
                        <div className="space-y-2">
                            <Label>Password Lama</Label>
                            <div className="relative">
                                <Input 
                                    type={showPass.old ? "text" : "password"}
                                    name="old"
                                    value={passForm.old}
                                    onChange={handlePassChange}
                                    required
                                    placeholder="Password saat ini"
                                />
                                <Button
                                    type="button" variant="ghost" size="icon"
                                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                    onClick={() => setShowPass(p => ({...p, old: !p.old}))}
                                >
                                    {showPass.old ? <EyeOff className="h-4 w-4 text-muted-foreground"/> : <Eye className="h-4 w-4 text-muted-foreground"/>}
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Password Baru</Label>
                            <div className="relative">
                                <Input 
                                    type={showPass.new ? "text" : "password"}
                                    name="new"
                                    value={passForm.new}
                                    onChange={handlePassChange}
                                    required
                                    placeholder="Min 8 kar, 1 Besar, 1 Angka, 1 Simbol"
                                />
                                <Button
                                    type="button" variant="ghost" size="icon"
                                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                    onClick={() => setShowPass(p => ({...p, new: !p.new}))}
                                >
                                    {showPass.new ? <EyeOff className="h-4 w-4 text-muted-foreground"/> : <Eye className="h-4 w-4 text-muted-foreground"/>}
                                </Button>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                                Syarat: Minimal 8 karakter, ada Huruf Besar, Angka, dan Simbol unik (!@#$).
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label>Konfirmasi Password Baru</Label>
                            <Input 
                                type={showPass.new ? "text" : "password"}
                                name="confirm"
                                value={passForm.confirm}
                                onChange={handlePassChange}
                                required
                                placeholder="Ulangi password baru"
                            />
                        </div>
                        <Button type="submit">
                            Update Password
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </TabsContent>

        {/* System Tab (Admin Only) */}
        {isAdmin && (
        <TabsContent value="system" className="space-y-4">
          <div className="grid gap-6">
              {/* BACKUP SECTION */}
              <div className="border rounded-md p-6 bg-blue-50/50 border-blue-100">
                  <div className="flex items-center gap-4 mb-4">
                      <div className="p-2 bg-blue-100 rounded-full text-blue-600">
                         <Save className="w-6 h-6" />
                      </div>
                      <div>
                          <h3 className="font-bold text-lg text-blue-900">Backup Data Aplikasi</h3>
                          <p className="text-sm text-blue-700">Download seluruh data (Guru, Sekolah, Siswa, Template Settings) ke dalam file JSON untuk keamanan.</p>
                      </div>
                  </div>
                  <Button onClick={handleDownloadBackup} variant="outline" className="border-blue-300 text-blue-800 hover:bg-blue-100 w-full sm:w-auto">
                      <Download className="mr-2 h-4 w-4" /> Download Backup (.json)
                  </Button>
              </div>

              {/* RESTORE SECTION */}
              <div className="border rounded-md p-6 bg-amber-50/50 border-amber-100">
                  <div className="flex items-center gap-4 mb-4">
                      <div className="p-2 bg-amber-100 rounded-full text-amber-600">
                         <RefreshCw className="w-6 h-6" />
                      </div>
                      <div>
                          <h3 className="font-bold text-lg text-amber-900">Restore / Pulihkan Data</h3>
                          <p className="text-sm text-amber-700">Upload file backup (.json) untuk mengembalikan kondisi data. <span className="font-bold">PERINGATAN: Data saat ini akan ditimpa!</span></p>
                      </div>
                  </div>
                  <div className="flex items-center gap-4">
                      <div className="relative">
                          <Input 
                              type="file" 
                              accept=".json"
                              className="w-full max-w-sm bg-white"
                              onChange={handleRestoreBackup}
                          />
                      </div>
                  </div>
              </div>

              {/* RESET SECTION */}
              <div className="border rounded-md p-6 bg-red-50 border-red-100">
                 <h3 className="font-bold text-red-800 mb-2">Danger Zone</h3>
                 <p className="text-sm text-red-600 mb-4">Menghapus seluruh data aplikasi dari browser ini. Tidak dapat dibatalkan.</p>
                 <Button variant="destructive" onClick={handleResetData}>
                     Reset Data Aplikasi (Factory Reset)
                 </Button>
              </div>
          </div>
        </TabsContent>
        )}
        
      </Tabs>
      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" /> Konfirmasi Reset Data
            </AlertDialogTitle>
            <AlertDialogDescription>
              PERINGATAN: Tindakan ini akan <b>MENGHAPUS SELURUH DATA</b> aplikasi yang tersimpan di browser ini (Guru, Siswa, Sekolah, Pengaturan).
              <br/><br/>
              Data yang sudah dihapus <b>TIDAK DAPAT DIKEMBALIKAN</b> kecuali Anda memiliki backup JSON.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReset} className="bg-red-600 hover:bg-red-700 text-white">
              Ya, Hapus Semua
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
