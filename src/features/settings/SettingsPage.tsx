"use client"

import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Save, RefreshCw, Building, FileSignature, FileText, CheckCircle, Download, Lock, Eye, EyeOff } from "lucide-react"
import { useState, useEffect } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "../../../convex/_generated/api"

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("template")
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState<string | null>(null)

  // API Safety Check
  const isApiReady = !!api.settings

  // Switch to NEW Module: settings_cloud
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        alert("Pengaturan berhasil disimpan!")
    }, 800)
  }

  const handleDownloadBackup = () => {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    if (confirm("PERINGATAN: Hapus SEMUA data?")) {
        localStorage.clear()
        window.location.reload()
    }
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
        {/* ...TabsList... */}
        {/* ... */}
        
        {/* Profil Tab */}
        <TabsContent value="profil">
            <Card>
                <CardHeader>
                    {/* ... */}
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
    </div>
  )
}
