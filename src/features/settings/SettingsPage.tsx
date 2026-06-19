import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileText, CheckCircle, ShieldAlert, CloudUpload, Loader2, Download, Eye, EyeOff, ImageIcon, Trash2 } from "lucide-react"
import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { settingApi, authApi, mediaApi } from "@/lib/api"
import { cn } from "@/lib/utils"

export default function SettingsPage() {
  const user = authApi.getStoredUser()
  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin_yayasan'
  
  const [activeTab, setActiveTab] = useState(() => isAdmin ? "template" : "security")
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState<string | null>(null)

  // 🔥 REST API QUERY
  const { data: settingsMap, isLoading: isLoadingSettings, refetch } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingApi.list()
  })

  const [passForm, setPassForm] = useState({ old_password: "", new_password: "", confirm_password: "" })
  const [showPass, setShowPass] = useState(false)

  const handleUpdatePassword = async (e: React.FormEvent) => {
      e.preventDefault()
      if (passForm.new_password.length < 6) return toast.error("Password minimal 6 karakter")
      if (passForm.new_password !== passForm.confirm_password) return toast.error("Konfirmasi password tidak cocok")
      
      setIsSaving(true)
      try {
          await authApi.changePassword(passForm.old_password, passForm.new_password)
          toast.success("Password berhasil diperbarui")
          setPassForm({ old_password: "", new_password: "", confirm_password: "" })
      } catch (err: any) {
          toast.error(err.response?.data?.message || "Gagal perbarui password")
      } finally {
          setIsSaving(false)
      }
  }

  const handleUploadTemplate = async (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset input value so same file can be selected again
    e.target.value = ""

    setIsUploading(key)
    try {
      // Strategy 1: Upload file to server, store URL in settings
      let valueToStore: string
      try {
        const uploaded = await mediaApi.upload(file, 'sk-templates')
        valueToStore = uploaded.url ?? uploaded.path ?? uploaded.file_url
        if (!valueToStore) throw new Error('No URL returned')
      } catch {
        // Strategy 2: Fallback to Base64 if file upload fails
        valueToStore = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.readAsDataURL(file)
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
        })
      }

      await settingApi.update({ key, value: valueToStore })
      toast.success(`Template berhasil disimpan`)
      refetch()
    } catch (err: any) {
      console.error('Upload template error:', err)
      toast.error('Gagal upload template: ' + (err?.response?.data?.message || err?.message || 'Unknown error'))
    } finally {
      setIsUploading(null)
    }
  }

  const handleSaveGeneral = async (data: any) => {
      setIsSaving(true)
      try {
          // Bulk update settings
          for (const key in data) {
              await settingApi.update({ key, value: data[key] })
          }
          toast.success("Pengaturan umum disimpan")
          refetch()
      } catch (err) {
          toast.error("Gagal simpan")
      } finally {
          setIsSaving(false)
      }
  }

  if (isLoadingSettings) return <div className="p-24 text-center animate-pulse font-black text-slate-300 uppercase italic tracking-widest">Hydrating System Configuration...</div>

  return (
    <div className="space-y-10 pb-20">
      <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase italic">Konfigurasi Engine</h1>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2">
             <ShieldAlert className="w-3 h-3 text-emerald-500" /> Pengaturan Global & Keamanan Infrastruktur Digital
          </p>
      </div>

      <Tabs defaultValue={isAdmin ? "template" : "security"} value={activeTab} onValueChange={setActiveTab} className="space-y-10">
        <TabsList className="flex h-auto w-full justify-start gap-4 bg-transparent p-0">
           {isAdmin && (
             <TabsTrigger value="template" className="h-12 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 bg-slate-100 text-slate-400">Template SK</TabsTrigger>
           )}
           {user?.role === 'super_admin' && (
             <TabsTrigger value="scanner" className="h-12 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 bg-slate-100 text-slate-400">PIN Scanner</TabsTrigger>
           )}
           <TabsTrigger value="security" className="h-12 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 bg-slate-100 text-slate-400">Keamanan</TabsTrigger>
        </TabsList>

        <TabsContent value="template" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <TemplateCard title="Guru Tetap Yayasan (GTY)" settingKey="sk_template_gty" onUpload={handleUploadTemplate} data={settingsMap} uploading={isUploading} />
                <TemplateCard title="Guru Tidak Tetap (GTT)" settingKey="sk_template_gtt" onUpload={handleUploadTemplate} data={settingsMap} uploading={isUploading} />
                <TemplateCard title="Tenaga Kependidikan" settingKey="sk_template_tendik" onUpload={handleUploadTemplate} data={settingsMap} uploading={isUploading} />
                <TemplateCard title="Kepala Madrasah" settingKey="sk_template_kamad" onUpload={handleUploadTemplate} data={settingsMap} uploading={isUploading} />
            </div>

            {/* Kop Surat Laporan Rapat */}
            <KopSuratCard settingsMap={settingsMap} refetch={refetch} />

            <Card className="border-0 shadow-sm bg-blue-50/50 rounded-3xl p-8">
                <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600"><FileText className="w-5 h-5" /></div>
                    <div>
                        <h4 className="font-black text-blue-900 text-sm uppercase italic">Placeholder Guide</h4>
                        <p className="text-[10px] text-blue-600 font-bold uppercase mt-1 leading-relaxed max-w-2xl">
                            Syntax Word: {'{{NAMA}}, {{NIP}}, {{UNIT_KERJA}}, {{JABATAN}}, {{MASA_BHAKTI}}, {{TANGGAL_PENETAPAN}}, {{qrcode}}'}
                        </p>
                    </div>
                </div>
            </Card>
        </TabsContent>

        <TabsContent value="scanner">
            <ScannerPinCard settingsMap={settingsMap} refetch={refetch} />
        </TabsContent>

        <TabsContent value="security">
            <Card className="border-0 shadow-sm bg-white rounded-[2.5rem] p-10 max-w-2xl">
                <form onSubmit={handleUpdatePassword} className="space-y-8">
                    <div className="space-y-2">
                        <h2 className="text-xl font-black uppercase italic tracking-tight">Otentikasi Akun</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Perbarui kredensial akses Anda</p>
                    </div>
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400">Password Saat Ini</Label>
                            <Input type="password" value={passForm.old_password} onChange={e => setPassForm({...passForm, old_password: e.target.value})} className="h-14 rounded-2xl border-slate-200 font-bold" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400">Password Baru</Label>
                                <Input type="password" value={passForm.new_password} onChange={e => setPassForm({...passForm, new_password: e.target.value})} className="h-14 rounded-2xl border-slate-200 font-bold" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400">Konfirmasi</Label>
                                <Input type="password" value={passForm.confirm_password} onChange={e => setPassForm({...passForm, confirm_password: e.target.value})} className="h-14 rounded-2xl border-slate-200 font-bold" />
                            </div>
                        </div>
                    </div>
                    <Button type="submit" disabled={isSaving} className="h-14 px-10 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-100">
                        {isSaving ? <Loader2 className="animate-spin h-5 w-5" /> : 'Perbarui Kredensial'}
                    </Button>
                </form>
            </Card>
            
            <div className="mt-8">
                <StaffSecurityCard settingsMap={settingsMap} refetch={refetch} />
            </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function TemplateCard({ title, settingKey, onUpload, onDelete, data, uploading }: any) {
    const hasData = !!data?.[settingKey]?.value

    const handleDownload = () => {
        const raw = data?.[settingKey]?.value as string | undefined
        if (!raw) return
        // Strip DataURL prefix if present
        const base64 = raw.includes(';base64,') ? raw.split(';base64,')[1] : raw
        const binary = atob(base64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        const blob = new Blob([bytes], {
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${settingKey}.docx`
        a.click()
        URL.revokeObjectURL(url)
    }

    return (
        <Card className="border-0 shadow-sm bg-white rounded-3xl p-8 group hover:border-blue-200 transition-all border border-transparent">
            <div className="flex items-start justify-between">
                <div>
                    <h3 className="font-black text-slate-800 text-sm uppercase italic tracking-tight">{title}</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">E-Document Skeleton (.docx)</p>
                </div>
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-colors", hasData ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400")}>
                    {hasData ? <CheckCircle className="w-4 h-4" /> : <CloudUpload className="w-4 h-4" />}
                </div>
            </div>

            <div className="mt-8 flex items-center justify-between gap-3">
                <span className="text-[10px] font-black uppercase text-slate-300 italic">{hasData ? 'Synced ✓' : 'Not Configured'}</span>
                <div className="flex items-center gap-2">
                    {hasData && (
                        <Button size="sm" variant="outline" onClick={handleDownload}
                            className="h-10 rounded-xl px-3 font-black uppercase text-[10px] tracking-widest border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                            <Download className="h-3.5 w-3.5 mr-1" /> Unduh
                        </Button>
                    )}
                    <div className="relative">
                        <Input type="file" accept=".docx" onChange={e => onUpload(e, settingKey)} className="hidden" id={`u-${settingKey}`} />
                        <Button asChild size="sm" variant="outline"
                            className="h-10 rounded-xl px-4 font-black uppercase text-[10px] tracking-widest border-slate-200 hover:bg-slate-50">
                            <label htmlFor={`u-${settingKey}`} className="cursor-pointer">
                                {uploading === settingKey ? <Loader2 className="animate-spin h-4 w-4" /> : (hasData ? 'Ganti' : 'Upload Template')}
                            </label>
                        </Button>
                    </div>
                </div>
            </div>
        </Card>
    )
}

// ── Scanner PIN Card ───────────────────────────────────────────────────────

function ScannerPinCard({ settingsMap, refetch }: { settingsMap: any; refetch: () => void }) {
  const [meetingPin, setMeetingPin] = useState(settingsMap?.meeting_scanner_pin?.value ?? "")

  // Sync state when settingsMap loads or changes (e.g. after app update / refetch)
  useEffect(() => {
    const pinFromServer = settingsMap?.meeting_scanner_pin?.value ?? ""
    setMeetingPin(pinFromServer)
  }, [settingsMap])
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!meetingPin || meetingPin.length < 4) {
      toast.error("PIN minimal 4 karakter")
      return
    }
    setSaving(true)
    try {
      await settingApi.update("meeting_scanner_pin", meetingPin)
      toast.success("PIN Scanner Rapat berhasil disimpan")
      refetch()
    } catch {
      toast.error("Gagal menyimpan PIN")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-0 shadow-sm bg-white rounded-[2.5rem] p-10 max-w-2xl">
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-black uppercase italic tracking-tight">PIN Scanner Rapat</h2>
          <p className="text-slate-400 text-sm mt-1">
            PIN ini digunakan oleh panitia rapat untuk login ke halaman{" "}
            <code className="bg-slate-100 px-1 rounded text-xs">/scan</code> dan scan QR peserta rapat.
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            PIN Panitia Rapat
          </Label>
          <Input
            type="text"
            value={meetingPin}
            onChange={(e) => setMeetingPin(e.target.value)}
            placeholder="Contoh: 1234"
            maxLength={8}
            className="h-12 rounded-xl font-mono text-lg tracking-widest max-w-xs"
          />
          <p className="text-xs text-slate-400">4–8 karakter. Bagikan ke panitia rapat saja.</p>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="h-12 px-8 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black uppercase text-xs tracking-widest"
        >
          {saving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
          Simpan PIN
        </Button>
      </div>
    </Card>
  )
}


// ── Kop Surat Laporan Rapat Card ──────────────────────────────────────────

function KopSuratCard({ settingsMap, refetch }: { settingsMap: any; refetch: () => void }) {
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)

  const currentValue = settingsMap?.kop_surat_meeting?.value ?? ""
  const hasKop = !!currentValue

  // Build preview URL
  const getPreviewUrl = () => {
    if (!currentValue) return ""
    if (currentValue.startsWith("http")) return currentValue
    if (currentValue.startsWith("data:")) return currentValue
    // It's a storage path — construct MinIO proxy URL
    const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:8000/api"
    return `${baseUrl}/minio/${currentValue}`
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("File harus berupa gambar (PNG, JPG, atau WEBP)")
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran file maksimal 5 MB")
      return
    }

    setUploading(true)
    try {
      // Upload to storage
      const uploaded = await mediaApi.upload(file, "logo")
      const storagePath = uploaded.path ?? uploaded.url ?? uploaded.file_url
      if (!storagePath) throw new Error("No path returned from upload")

      // Save the storage path in settings
      await settingApi.update({ key: "kop_surat_meeting", value: storagePath })
      toast.success("Kop surat berhasil diupload")
      refetch()
    } catch (err: any) {
      console.error("Upload kop surat error:", err)
      toast.error("Gagal upload kop surat: " + (err?.response?.data?.message || err?.message || "Unknown error"))
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = async () => {
    setRemoving(true)
    try {
      await settingApi.update({ key: "kop_surat_meeting", value: "" })
      toast.success("Kop surat berhasil dihapus")
      refetch()
    } catch {
      toast.error("Gagal menghapus kop surat")
    } finally {
      setRemoving(false)
    }
  }

  return (
    <Card className="border-0 shadow-sm bg-white rounded-3xl p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="font-black text-slate-800 text-sm uppercase italic tracking-tight">Kop Surat Laporan Rapat</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">
            Gambar header yang tampil di PDF laporan kehadiran rapat (PNG/JPG, maks 5MB)
          </p>
        </div>
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
          hasKop ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"
        )}>
          {hasKop ? <CheckCircle className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
        </div>
      </div>

      {/* Preview */}
      {hasKop && (
        <div className="mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
          <p className="text-[9px] font-bold text-slate-400 uppercase mb-2">Preview Kop Surat</p>
          <img
            src={getPreviewUrl()}
            alt="Kop Surat"
            className="max-h-24 w-auto object-contain"
            onError={(e) => {
              e.currentTarget.style.display = "none"
            }}
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <Input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleUpload}
            className="hidden"
            id="upload-kop-surat"
          />
          <Button asChild size="sm" variant="outline"
            className="h-10 rounded-xl px-4 font-black uppercase text-[10px] tracking-widest border-slate-200 hover:bg-slate-50">
            <label htmlFor="upload-kop-surat" className="cursor-pointer flex items-center gap-2">
              {uploading ? <Loader2 className="animate-spin h-4 w-4" /> : <CloudUpload className="h-3.5 w-3.5" />}
              {hasKop ? "Ganti Kop Surat" : "Upload Kop Surat"}
            </label>
          </Button>
        </div>

        {hasKop && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleRemove}
            disabled={removing}
            className="h-10 rounded-xl px-4 font-black uppercase text-[10px] tracking-widest border-red-200 text-red-600 hover:bg-red-50"
          >
            {removing ? <Loader2 className="animate-spin h-4 w-4" /> : <Trash2 className="h-3.5 w-3.5 mr-1" />}
            Hapus
          </Button>
        )}
      </div>
    </Card>
  )
}

// ── Staff Security Card ──────────────────────────────────────────

function StaffSecurityCard({ settingsMap, refetch }: { settingsMap: any; refetch: () => void }) {
  const [faceEnabled, setFaceEnabled] = useState(settingsMap?.staff_face_recognition_enabled?.value === 'true')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setFaceEnabled(settingsMap?.staff_face_recognition_enabled?.value === 'true')
  }, [settingsMap])

  const handleSave = async () => {
    setSaving(true)
    try {
      await settingApi.update({ key: "staff_face_recognition_enabled", value: faceEnabled ? "true" : "false" })
      toast.success("Pengaturan Face Recognition berhasil disimpan")
      refetch()
    } catch {
      toast.error("Gagal menyimpan pengaturan")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-0 shadow-sm bg-white rounded-[2.5rem] p-10 max-w-2xl">
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-black uppercase italic tracking-tight">Keamanan Absensi Staff</h2>
          <p className="text-slate-400 text-sm mt-1">
            Atur fitur pengenalan wajah biometrik (Facial Recognition AI) untuk memperketat absensi Staff PCNU.
          </p>
        </div>

        <div className="flex items-center justify-between border rounded-2xl p-4 bg-slate-50">
          <div className="flex-1 space-y-1">
            <h3 className="font-bold text-slate-800 text-sm">Aktifkan Face Recognition AI</h3>
            <p className="text-xs text-slate-500">
              Mewajibkan staff melakukan pemindaian wajah saat absen dengan QR Code ID Card.
            </p>
          </div>
          <div className="flex items-center">
            <input 
              type="checkbox" 
              checked={faceEnabled} 
              onChange={(e) => setFaceEnabled(e.target.checked)} 
              className="w-5 h-5 accent-emerald-600"
            />
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="h-12 px-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-100"
        >
          {saving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
          Simpan Pengaturan
        </Button>
      </div>
    </Card>
  )
}

