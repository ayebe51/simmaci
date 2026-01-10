"use client"

import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Save, RefreshCw, AlertTriangle, Building, FileSignature, FileText, CheckCircle, Download } from "lucide-react"
import { useState, useEffect } from "react"

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("template")
  const [isSaving, setIsSaving] = useState(false)
  const [hasTemplate, setHasTemplate] = useState(false)
  
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

  // Load from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem("app_settings")
    if (saved) {
        try {
            setSettings(prev => ({ ...prev, ...JSON.parse(saved) }))
        } catch (e) { console.error("Failed to parse settings", e) }
    }
    
    // Check if template exists
    if (localStorage.getItem("sk_template_blob")) {
        setHasTemplate(true)
    }
  }, [])

  const handleChange = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

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
        const backupData: Record<string, any> = {}
        // Collect all keys related to the app
        const keysToBackup = [
            "app_schools", 
            "app_teachers", 
            "app_students", 
            "app_settings", 
            "sk_submissions",
            "sk_template_name",
            "sk_template_blob"
        ]

        keysToBackup.forEach(key => {
            const val = localStorage.getItem(key)
            if (val) backupData[key] = val
        })

        const payload = {
            version: "1.0",
            timestamp: new Date().toISOString(),
            data: backupData
        }

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
        saveAs(blob, `sim_maarif_backup_${new Date().toISOString().slice(0,10)}.json`)
        toast.success("Backup berhasil didownload.")
    } catch (error) {
        console.error("Backup failed", error)
        toast.error("Gagal membuat backup.")
    }
  }

  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (event) => {
          try {
              const json = JSON.parse(event.target?.result as string)
              if (!json.data || !json.version) {
                  throw new Error("Format file backup tidak valid.")
              }

              // Restore keys
              Object.keys(json.data).forEach(key => {
                  localStorage.setItem(key, json.data[key])
              })
              
              toast.success("Data berhasil dipulihkan! Halaman akan dimuat ulang...")
              setTimeout(() => window.location.reload(), 1500)

          } catch (err) {
              console.error("Restore failed", err)
              toast.error("Gagal memulihkan data. Pastikan file benar.")
          }
      }
      reader.readAsText(file)
  }

  const handleTemplateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
        const reader = new FileReader()
        reader.onload = (evt) => {
            const base64 = evt.target?.result as string
            localStorage.setItem("sk_template_blob", base64)
            localStorage.setItem("sk_template_name", file.name)
            setHasTemplate(true)
            alert("Template berhasil disimpan!")
        }
        reader.readAsDataURL(file)
    }
  }

  const handleResetData = () => {
    if (confirm("PERINGATAN: Tindakan ini akan menghapus SEMUA data Guru, Siswa, dan SK yang tersimpan di browser ini. Lanjutkan?")) {
        localStorage.clear()
        alert("System Reset Complete. Refreshing...")
        window.location.reload()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-2xl font-bold tracking-tight">Pengaturan Sistem</h1>
            <p className="text-muted-foreground">Konfigurasi profil lembaga, template SK, dan pejabat penandatangan.</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Menyimpan..." : <><Save className="mr-2 h-4 w-4" /> Simpan Perubahan</>}
        </Button>
      </div>

      <Tabs defaultValue="template" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
           <TabsTrigger value="template">Template SK</TabsTrigger>
           <TabsTrigger value="signer">Penandatangan</TabsTrigger>
           <TabsTrigger value="profil">Profil Lembaga</TabsTrigger>
           <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        {/* Template Tab */}
        <TabsContent value="template">
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
                            const hasFile = !!localStorage.getItem(template.id + "_blob")
                            const fileName = localStorage.getItem(template.id + "_name") || "template.docx"

                            return (
                                <div key={template.id} className="border p-4 rounded-lg bg-slate-50 relative group">
                                    <div className="mb-3">
                                        <h3 className="font-semibold text-sm text-slate-800">{template.label}</h3>
                                        <p className="text-xs text-muted-foreground">{template.desc}</p>
                                    </div>
                                    
                                    {hasFile ? (
                                        <div className="flex items-center gap-3 p-3 bg-white border rounded">
                                            <div className="bg-green-100 p-2 rounded-full text-green-600">
                                                <CheckCircle className="h-4 w-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-medium truncate">{fileName}</p>
                                                <p className="text-[10px] text-green-600">Siap digunakan</p>
                                            </div>
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                                onClick={() => {
                                                    if(confirm("Hapus template ini?")) {
                                                        localStorage.removeItem(template.id + "_blob")
                                                        localStorage.removeItem(template.id + "_name")
                                                        window.location.reload() // Quick refresh to update UI state
                                                    }
                                                }}
                                            >
                                                x
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center p-4 border-2 border-dashed rounded bg-white hover:bg-slate-50 transition-colors cursor-pointer relative">
                                            <div className="text-center space-y-1">
                                                <Download className="mx-auto h-4 w-4 text-muted-foreground" />
                                                <span className="text-xs text-slate-500 block">Upload .docx</span>
                                            </div>
                                            <input 
                                                type="file" 
                                                accept=".docx"
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0]
                                                    if (file) {
                                                        const reader = new FileReader()
                                                        reader.onload = (evt) => {
                                                            const base64 = evt.target?.result as string
                                                            localStorage.setItem(template.id + "_blob", base64)
                                                            localStorage.setItem(template.id + "_name", file.name)
                                                            alert(`Template ${template.label} berhasil disimpan!`)
                                                            window.location.reload()
                                                        }
                                                        reader.readAsDataURL(file)
                                                    }
                                                }}
                                            />
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
        </TabsContent>

        {/* Signer Tab */}
        <TabsContent value="signer">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><FileSignature className="h-5 w-5"/> Pejabat Penandatangan</CardTitle>
                    <CardDescription>Konfigurasi nama Ketua dan Sekretaris yang akan muncul di SK.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    
                    {/* KETUA */}
                    <div className="space-y-3 p-4 border rounded-md bg-slate-50">
                        <h4 className="font-semibold text-sm uppercase tracking-wide text-slate-500">Pihak 1: Ketua</h4>
                        <div className="grid gap-2">
                            <Label>Nama Lengkap</Label>
                            <Input 
                                value={settings.signerKetuaName} 
                                onChange={(e) => handleChange("signerKetuaName", e.target.value)} 
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>NIY / NIP (Opsional)</Label>
                            <Input 
                                value={settings.signerKetuaNip} 
                                onChange={(e) => handleChange("signerKetuaNip", e.target.value)} 
                            />
                        </div>
                    </div>

                    {/* SEKRETARIS */}
                    <div className="space-y-3 p-4 border rounded-md bg-slate-50">
                        <h4 className="font-semibold text-sm uppercase tracking-wide text-slate-500">Pihak 2: Sekretaris</h4>
                        <div className="grid gap-2">
                            <Label>Nama Lengkap</Label>
                            <Input 
                                value={settings.signerSekretarisName} 
                                onChange={(e) => handleChange("signerSekretarisName", e.target.value)} 
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>NIY / NIP (Opsional)</Label>
                            <Input 
                                value={settings.signerSekretarisNip} 
                                onChange={(e) => handleChange("signerSekretarisNip", e.target.value)} 
                            />
                        </div>
                    </div>

                    <div className="grid gap-2 pt-4 border-t">
                         <Label>Prefix Nomor SK</Label>
                         <Input 
                            value={settings.skPrefix} 
                            onChange={(e) => handleChange("skPrefix", e.target.value)} 
                        />
                         <p className="text-[10px] text-muted-foreground">Format nomor: [Auto]/[Prefix]/[Bulan]/[Tahun]</p>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>

        {/* Profil Tab */}
        <TabsContent value="profil">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Building className="h-5 w-5"/> Profil Yayasan / Cabang</CardTitle>
                    <CardDescription>Informasi ini digunakan jika template membutuhkan data lembaga dinamis.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-2">
                        <Label>Nama Yayasan / Cabang</Label>
                        <Input 
                            value={settings.namaYayasan} 
                            onChange={(e) => handleChange("namaYayasan", e.target.value)} 
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>Alamat Lengkap</Label>
                        <Input 
                            value={settings.alamatYayasan} 
                            onChange={(e) => handleChange("alamatYayasan", e.target.value)} 
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>Telepon / Kontak</Label>
                        <Input 
                            value={settings.teleponYayasan} 
                            onChange={(e) => handleChange("teleponYayasan", e.target.value)} 
                        />
                    </div>
                </CardContent>
            </Card>
        </TabsContent>

        {/* System Tab */}
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
        
      </Tabs>
    </div>
  )
}
