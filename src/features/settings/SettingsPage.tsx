import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  ShieldAlert, CloudUpload, Loader2, Download, Eye, EyeOff, ImageIcon, Trash2,
  Lock, KeyRound, UserCheck, ShieldCheck, QrCode, Server, Settings, Copy, Check, Sparkles, ExternalLink
} from "lucide-react"
import { useState, useEffect, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { settingApi, authApi, mediaApi } from "@/lib/api"
import { cn } from "@/lib/utils"

export default function SettingsPage() {
  const user = authApi.getStoredUser()
  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin_yayasan'
  
  const [activeTab, setActiveTab] = useState("security")
  const [isSaving, setIsSaving] = useState(false)
  const [showOldPass, setShowOldPass] = useState(false)
  const [showNewPass, setShowNewPass] = useState(false)

  // 🔥 REST API QUERY
  const { data: settingsMap, isLoading: isLoadingSettings, refetch } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingApi.list()
  })

  const [passForm, setPassForm] = useState({ old_password: "", new_password: "", confirm_password: "" })

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

  if (isLoadingSettings) {
    return (
      <div className="p-24 text-center animate-pulse flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
        <div className="font-black text-slate-400 uppercase italic tracking-widest text-xs">
          Memuat Konfigurasi Sistem & Keamanan...
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-20 w-full">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 p-8 text-white shadow-xl">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-[10px] font-black uppercase tracking-widest">
            <ShieldAlert className="w-3 h-3 text-blue-400" /> Konfigurasi Platform & Akses
          </div>
          <h1 className="text-2xl md:text-3xl font-black italic tracking-tight text-white uppercase">Pengaturan Sistem & Keamanan</h1>
          <p className="text-xs text-blue-200/80 max-w-xl font-medium">
            Kelola otentikasi akun, ubah password, atur PIN scanner panitia, serta konfigurasi identitas kop surat resmi.
          </p>
        </div>
      </div>

      {/* Centered Segmented Tab Navigation Bar */}
      <Tabs defaultValue="security" value={activeTab} onValueChange={setActiveTab} className="space-y-8 w-full">
        <div className="flex justify-center w-full">
          <div className="bg-slate-100/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200/80 shadow-inner inline-flex items-center gap-1.5 max-w-full overflow-x-auto">
            <TabsList className="bg-transparent p-0 flex items-center gap-1.5 h-auto">
              <TabsTrigger
                value="security"
                className="h-11 px-5 rounded-xl font-extrabold text-xs tracking-wider transition-all duration-200 flex items-center gap-2 text-slate-600 hover:text-slate-900 hover:bg-white/60 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-md data-[state=active]:shadow-slate-200/80 border border-transparent data-[state=active]:border-slate-200/60"
              >
                <Lock className="w-4 h-4 text-blue-500" />
                <span>Akun & Keamanan</span>
              </TabsTrigger>

              {isAdmin && (
                <TabsTrigger
                  value="system"
                  className="h-11 px-5 rounded-xl font-extrabold text-xs tracking-wider transition-all duration-200 flex items-center gap-2 text-slate-600 hover:text-slate-900 hover:bg-white/60 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-md data-[state=active]:shadow-slate-200/80 border border-transparent data-[state=active]:border-slate-200/60"
                >
                  <Settings className="w-4 h-4 text-indigo-500" />
                  <span>Konfigurasi Sistem</span>
                </TabsTrigger>
              )}

              {(isAdmin || user?.role === 'super_admin') && (
                <TabsTrigger
                  value="scanner"
                  className="h-11 px-5 rounded-xl font-extrabold text-xs tracking-wider transition-all duration-200 flex items-center gap-2 text-slate-600 hover:text-slate-900 hover:bg-white/60 data-[state=active]:bg-white data-[state=active]:text-purple-600 data-[state=active]:shadow-md data-[state=active]:shadow-slate-200/80 border border-transparent data-[state=active]:border-slate-200/60"
                >
                  <QrCode className="w-4 h-4 text-purple-500" />
                  <span>Integrasi & Scanner</span>
                </TabsTrigger>
              )}
            </TabsList>
          </div>
        </div>

        {/* ── TAB 1: AKUN & KEAMANAN ── */}
        <TabsContent value="security" className="space-y-8 w-full mt-0 focus-visible:outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
            {/* Ubah Password Card */}
            <Card className="border-0 shadow-sm bg-white rounded-[2.5rem] p-8 md:p-10 w-full flex flex-col justify-between">
              <form onSubmit={handleUpdatePassword} className="space-y-6">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-2 text-blue-600 font-bold text-xs">
                    <KeyRound className="w-4 h-4" />
                    <span>Otentikasi Kredensial</span>
                  </div>
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-slate-900">Perbarui Password</h2>
                  <p className="text-xs text-slate-400 font-medium">Gunakan kombinasi password yang kuat untuk menjaga keamanan akun Anda.</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Password Saat Ini</Label>
                    <div className="relative">
                      <Input
                        type={showOldPass ? "text" : "password"}
                        value={passForm.old_password}
                        onChange={e => setPassForm({...passForm, old_password: e.target.value})}
                        className="h-12 pr-10 rounded-2xl border-slate-200 font-bold text-xs"
                        placeholder="Masukkan password lama"
                      />
                      <button
                        type="button"
                        onClick={() => setShowOldPass(!showOldPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showOldPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-slate-400">Password Baru</Label>
                      <div className="relative">
                        <Input
                          type={showNewPass ? "text" : "password"}
                          value={passForm.new_password}
                          onChange={e => setPassForm({...passForm, new_password: e.target.value})}
                          className="h-12 pr-10 rounded-2xl border-slate-200 font-bold text-xs"
                          placeholder="Min. 6 karakter"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPass(!showNewPass)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-slate-400">Konfirmasi Password Baru</Label>
                      <Input
                        type="password"
                        value={passForm.confirm_password}
                        onChange={e => setPassForm({...passForm, confirm_password: e.target.value})}
                        className="h-12 rounded-2xl border-slate-200 font-bold text-xs"
                        placeholder="Ulangi password baru"
                      />
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isSaving || !passForm.old_password || !passForm.new_password}
                  className="h-12 px-8 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-xs tracking-wider shadow-lg shadow-blue-100 w-full sm:w-auto"
                >
                  {isSaving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                  Simpan Perubahan Kredensial
                </Button>
              </form>
            </Card>

            {/* Informasi Pengguna & Status Sesi */}
            <Card className="border-0 shadow-sm bg-white rounded-[2.5rem] p-8 md:p-10 w-full flex flex-col justify-between">
              <div className="space-y-6">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-2 text-emerald-600 font-bold text-xs">
                    <UserCheck className="w-4 h-4" />
                    <span>Profil User Aktif</span>
                  </div>
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-slate-900">Informasi Pengguna</h2>
                  <p className="text-xs text-slate-400 font-medium">Detail identitas pengguna yang sedang terhubung ke platform.</p>
                </div>

                <div className="space-y-4 pt-2">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Nama Pengguna</span>
                      <div className="font-extrabold text-slate-800 text-base">{user?.name || "Administrator"}</div>
                    </div>
                    <Badge className="bg-blue-100 text-blue-700 font-bold text-xs uppercase px-3 py-1 rounded-xl hover:bg-blue-100">
                      {user?.role || "User"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Username / Email</span>
                      <div className="font-bold text-slate-700 text-xs truncate mt-0.5">{user?.username || user?.email || "-"}</div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Unit Kerja</span>
                      <div className="font-bold text-slate-700 text-xs truncate mt-0.5">{user?.unitKerja || "LP Ma'arif NU"}</div>
                    </div>
                  </div>

                  <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-100 flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-emerald-500 text-white">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-emerald-900">Sesi Terverifikasi Aman</div>
                      <div className="text-[11px] text-emerald-700 font-medium">Otentikasi token JWT aktif dengan akses terenkripsi.</div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Bottom Card for Super Admin */}
          {user?.role === 'super_admin' && (
            <div className="w-full">
              <StaffSecurityCard settingsMap={settingsMap} refetch={refetch} />
            </div>
          )}
        </TabsContent>

        {/* ── TAB 2: KONFIGURASI SISTEM ── */}
        <TabsContent value="system" className="space-y-8 w-full mt-0 focus-visible:outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
            {/* Kop Surat Laporan Rapat */}
            <KopSuratCard settingsMap={settingsMap} refetch={refetch} />

            {/* Information Platform Card */}
            <Card className="border-0 shadow-sm bg-white rounded-[2.5rem] p-8 md:p-10 w-full flex flex-col justify-between">
              <div className="space-y-6">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-2 text-indigo-600 font-bold text-xs">
                    <Server className="w-4 h-4" />
                    <span>Infrastruktur Platform</span>
                  </div>
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-slate-900">Identitas & Status Sistem</h2>
                  <p className="text-xs text-slate-400 font-medium">Informasi lingkungan server, storage, dan layanan latar belakang.</p>
                </div>

                <div className="space-y-4 pt-2">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Nama Platform</span>
                      <div className="font-extrabold text-slate-800 text-sm">SIMMACI LP Ma'arif NU</div>
                    </div>
                    <Badge className="bg-emerald-100 text-emerald-700 font-bold text-xs uppercase px-3 py-1 rounded-xl hover:bg-emerald-100">
                      Online ✓
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Storage Engine</span>
                      <div className="font-bold text-slate-700 text-xs mt-0.5">MinIO S3 Object Proxy</div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Document Generator</span>
                      <div className="font-bold text-slate-700 text-xs mt-0.5">Docxtemplater Engine</div>
                    </div>
                  </div>

                  <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-100 flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-indigo-600 text-white">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-indigo-900">Integrasi Otomatis SIMMACI</div>
                      <div className="text-[11px] text-indigo-700 font-medium">Template Kop Surat digunakan secara universal di PDF laporan rapat dan e-dokumen.</div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* ── TAB 3: INTEGRASI & SCANNER ── */}
        <TabsContent value="scanner" className="space-y-8 w-full mt-0 focus-visible:outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
            {/* Scanner PIN Card */}
            <ScannerPinCard settingsMap={settingsMap} refetch={refetch} />

            {/* Scanner Instruction & Link Card */}
            <Card className="border-0 shadow-sm bg-white rounded-[2.5rem] p-8 md:p-10 w-full flex flex-col justify-between">
              <div className="space-y-6">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-2 text-purple-600 font-bold text-xs">
                    <QrCode className="w-4 h-4" />
                    <span>Modul Scanner Panitia</span>
                  </div>
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-slate-900">Panduan Presensi QR Rapat</h2>
                  <p className="text-xs text-slate-400 font-medium">Informasi penggunaan aplikasi pemindai QR untuk panitia di lapangan.</p>
                </div>

                <div className="space-y-4 pt-2">
                  <div className="p-4 bg-purple-50/60 rounded-2xl border border-purple-100 space-y-2">
                    <div className="text-xs font-bold text-purple-900">Cara Penggunaan Pemindai QR:</div>
                    <ol className="text-[11px] text-purple-800 space-y-1.5 list-decimal pl-4 font-medium">
                      <li>Bagikan PIN Panitia Rapat kepada petugas absensi.</li>
                      <li>Buka halaman scanner publik di HP/Tablet via URL <code className="bg-purple-100 px-1 py-0.5 rounded text-purple-900 font-bold">/scan</code>.</li>
                      <li>Masukkan PIN Panitia dan pilih agenda rapat aktif.</li>
                      <li>Arahkan kamera HP ke QR Code pada ID Card peserta.</li>
                    </ol>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">URL Scanner Publik</span>
                      <div className="font-mono text-xs font-bold text-slate-800">{window.location.origin}/scan</div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        window.open('/scan', '_blank')
                      }}
                      className="h-10 rounded-xl px-4 font-extrabold text-xs text-purple-700 border-purple-200 hover:bg-purple-50"
                    >
                      <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Buka Scanner
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ── Scanner PIN Card Component ──────────────────────────────────────────────

function ScannerPinCard({ settingsMap, refetch }: { settingsMap: any; refetch: () => void }) {
  const pinValue = useMemo(() => {
    if (!settingsMap) return ""
    const item = settingsMap?.meeting_scanner_pin
    if (typeof item === 'object' && item !== null) return String(item.value ?? "")
    return String(item ?? "")
  }, [settingsMap])

  const [meetingPin, setMeetingPin] = useState(pinValue)
  const [showPin, setShowPin] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setMeetingPin(pinValue)
  }, [pinValue])

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
    <Card className="border-0 shadow-sm bg-white rounded-[2.5rem] p-8 md:p-10 w-full flex flex-col justify-between">
      <div className="space-y-6">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-purple-600 font-bold text-xs">
            <QrCode className="w-4 h-4" />
            <span>Autentikasi Panitia</span>
          </div>
          <h2 className="text-xl font-black uppercase italic tracking-tight text-slate-900">PIN Scanner Rapat</h2>
          <p className="text-xs text-slate-400 font-medium">
            PIN keamanan yang digunakan oleh panitia untuk login di halaman scanner publik (<code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">/scan</code>).
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
            PIN Khusus Panitia Rapat
          </Label>
          <div className="relative max-w-sm">
            <Input
              type={showPin ? "text" : "password"}
              value={meetingPin}
              onChange={(e) => setMeetingPin(e.target.value)}
              placeholder="Contoh: 1234"
              maxLength={8}
              className="h-12 pr-10 rounded-2xl font-mono text-base font-bold tracking-widest border-slate-200"
            />
            <button
              type="button"
              onClick={() => setShowPin(!showPin)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[11px] text-slate-400 font-medium">Panjang PIN 4–8 karakter. Jangan bagikan PIN ini ke peserta umum.</p>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving || !meetingPin}
          className="h-12 px-8 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-black uppercase text-xs tracking-wider shadow-lg shadow-purple-100 w-full sm:w-auto"
        >
          {saving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
          Simpan PIN Panitia
        </Button>
      </div>
    </Card>
  )
}

// ── Kop Surat Laporan Rapat Card Component ──────────────────────────────────

function KopSuratCard({ settingsMap, refetch }: { settingsMap: any; refetch: () => void }) {
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)

  const currentValue = useMemo(() => {
    if (!settingsMap) return ""
    const item = settingsMap?.kop_surat_meeting
    if (typeof item === 'object' && item !== null) return String(item.value ?? "")
    return String(item ?? "")
  }, [settingsMap])

  const hasKop = !!currentValue

  const getPreviewUrl = () => {
    if (!currentValue) return ""
    if (currentValue.startsWith("http")) return currentValue
    if (currentValue.startsWith("data:")) return currentValue
    const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:8000/api"
    return `${baseUrl}/minio/${currentValue}`
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""

    if (!file.type.startsWith("image/")) {
      toast.error("File harus berupa gambar (PNG, JPG, atau WEBP)")
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran file maksimal 5 MB")
      return
    }

    setUploading(true)
    try {
      const uploaded = await mediaApi.upload(file, "logo")
      const storagePath = uploaded.path ?? uploaded.url ?? uploaded.file_url
      if (!storagePath) throw new Error("No path returned from upload")

      await settingApi.update("kop_surat_meeting", storagePath)
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
      await settingApi.update("kop_surat_meeting", "")
      toast.success("Kop surat berhasil dihapus")
      refetch()
    } catch {
      toast.error("Gagal menghapus kop surat")
    } finally {
      setRemoving(false)
    }
  }

  return (
    <Card className="border-0 shadow-sm bg-white rounded-[2.5rem] p-8 md:p-10 w-full flex flex-col justify-between">
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-indigo-600 font-bold text-xs">
              <ImageIcon className="w-4 h-4" />
              <span>Header Laporan Resmi</span>
            </div>
            <h3 className="text-xl font-black text-slate-800 uppercase italic tracking-tight">Kop Surat Laporan Rapat</h3>
            <p className="text-xs text-slate-400 font-medium">
              Gambar header resmi yang dicetak pada PDF laporan kehadiran rapat (PNG/JPG, maks 5MB).
            </p>
          </div>
          <div className={cn(
            "w-9 h-9 rounded-2xl flex items-center justify-center transition-colors shrink-0",
            hasKop ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"
          )}>
            {hasKop ? <ShieldCheck className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
          </div>
        </div>

        {/* Live Preview */}
        {hasKop && (
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Preview Kop Surat Aktif</p>
            <div className="bg-white p-3 rounded-xl border border-slate-200/60 shadow-inner flex items-center justify-center">
              <img
                src={getPreviewUrl()}
                alt="Kop Surat"
                className="max-h-24 w-auto object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = "none"
                }}
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Input
              type="file"
              accept="image/*"
              onChange={handleUpload}
              className="hidden"
              id="kop-upload-input"
            />
            <Button
              asChild
              disabled={uploading}
              className="h-11 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs tracking-wider cursor-pointer"
            >
              <label htmlFor="kop-upload-input">
                {uploading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <CloudUpload className="h-4 w-4 mr-2" />}
                {hasKop ? "Ganti Kop Surat" : "Upload Kop Surat"}
              </label>
            </Button>
          </div>

          {hasKop && (
            <Button
              variant="outline"
              onClick={handleRemove}
              disabled={removing}
              className="h-11 px-4 rounded-2xl border-slate-200 hover:bg-rose-50 hover:text-rose-600 font-extrabold text-xs tracking-wider text-slate-600"
            >
              {removing ? <Loader2 className="animate-spin h-4 w-4 mr-1.5" /> : <Trash2 className="h-4 w-4 mr-1.5 text-rose-500" />}
              Hapus
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}

// ── Staff Security Card Component ──────────────────────────────────────────

function StaffSecurityCard({ settingsMap, refetch }: { settingsMap: any; refetch: () => void }) {
  const enabledValue = useMemo(() => {
    if (!settingsMap) return false
    const item = settingsMap?.staff_face_recognition_enabled
    if (typeof item === 'object' && item !== null) return String(item.value) === 'true'
    return String(item) === 'true'
  }, [settingsMap])

  const [faceEnabled, setFaceEnabled] = useState(enabledValue)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setFaceEnabled(enabledValue)
  }, [enabledValue])

  const handleSave = async () => {
    setSaving(true)
    try {
      await settingApi.update("staff_face_recognition_enabled", faceEnabled ? "true" : "false")
      toast.success("Pengaturan Face Recognition berhasil disimpan")
      refetch()
    } catch {
      toast.error("Gagal menyimpan pengaturan")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-0 shadow-sm bg-white rounded-[2.5rem] p-8 md:p-10 w-full">
      <div className="space-y-6">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-blue-600 font-bold text-xs">
            <ShieldAlert className="w-4 h-4" />
            <span>Biometrik & Keamanan Tingkat Tinggi</span>
          </div>
          <h2 className="text-xl font-black uppercase italic tracking-tight text-slate-900">Keamanan Absensi Staff PCNU</h2>
          <p className="text-xs text-slate-400 font-medium">
            Pengaturan pengenalan wajah biometrik (Face Recognition AI) untuk memperketat keabsahan absensi Staff PCNU.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between border rounded-2xl p-5 bg-slate-50/80 gap-4">
          <div className="flex-1 space-y-1">
            <h3 className="font-extrabold text-slate-800 text-sm">Aktifkan Verification Face Recognition AI</h3>
            <p className="text-xs text-slate-500 font-medium">
              Mewajibkan staff memindai wajah saat melakukan absensi via QR Code pada ID Card.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input 
              type="checkbox" 
              checked={faceEnabled} 
              onChange={(e) => setFaceEnabled(e.target.checked)} 
              className="w-5 h-5 accent-blue-600 cursor-pointer rounded"
            />
            <span className="font-bold text-xs uppercase text-slate-700">
              {faceEnabled ? "Aktif" : "Non-Aktif"}
            </span>
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="h-12 px-8 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-xs tracking-wider shadow-lg shadow-blue-100 w-full sm:w-auto"
        >
          {saving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
          Simpan Keamanan Biometrik
        </Button>
      </div>
    </Card>
  )
}
