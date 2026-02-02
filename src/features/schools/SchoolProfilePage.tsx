import { useState, useEffect } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { toast } from "sonner"
import { Save, Building2, User } from "lucide-react"

export default function SchoolProfilePage() {
  const [formData, setFormData] = useState({
    alamat: "",
    telepon: "",
    email: "",
    kepalaMadrasah: "",
    akreditasi: "",
    npsn: "",
    statusJamiyyah: ""
  })

  // Fetch school data directly using the secure backend query
  const school = useQuery(api.schools.getMyself)
  // Fallback for loading state display

  const updateProfile = useMutation(api.schools.updateSelf)

  useEffect(() => {
    if (school) {
      // eslint-disable-next-line
      setFormData({
        alamat: school.alamat || "",
        telepon: school.telepon || "",
        email: school.email || "",
        kepalaMadrasah: school.kepalaMadrasah || "",
        akreditasi: school.akreditasi || "",
        npsn: school.npsn || "",
        statusJamiyyah: school.statusJamiyyah || ""
      })
    }
  }, [school])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await updateProfile(formData)
      toast.success("Profil sekolah berhasil diperbarui!")
    } catch (error) {
      toast.error("Gagal update: " + (error as Error).message)
    }
  }


  if (!school && school !== undefined) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-center max-w-md">
           <h3 className="text-lg font-bold text-red-700 mb-2">Data Sekolah Tidak Ditemukan</h3>
           <p className="text-sm text-red-600 mb-4">
             Sistem tidak dapat menemukan data sekolah untuk akun ini.
           </p>
           <div className="bg-white p-3 rounded border text-left text-xs text-gray-700 font-mono">
             <strong>Debug Info:</strong><br/>
             User Unit: "{user?.unit}"<br/>
             Status: Not Found (Null)
           </div>
        </div>
      </div>
    )
  }
  
  if (!school) return <div className="p-10 text-center animate-pulse">Sedang memuat data sekolah...</div>

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Profil Sekolah</h1>
        <p className="text-muted-foreground">
          Kelola informasi sekolah untuk keperluan administrasi dan kop surat.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-6">
        {/* Identitas Utama (Read Only) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Identitas Utama
            </CardTitle>
            <CardDescription>Data ini hanya bisa diubah oleh Admin Kabupaten.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Nama Sekolah</Label>
              <Input value={school.nama} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>NSM</Label>
              <Input value={school.nsm} disabled className="bg-muted" />
            </div>
          </CardContent>
        </Card>

        {/* Data Administrasi */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Data Administrasi
            </CardTitle>
            <CardDescription>Informasi ini akan muncul di dokumen SK.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
             <div className="space-y-2">
              <Label>Kepala Madrasah (Lengkap dan Gelar)</Label>
              <Input 
                name="kepalaMadrasah" 
                value={formData.kepalaMadrasah} 
                onChange={handleChange} 
                placeholder="Contoh: H. Ahmad, S.Pd.I"
              />
            </div>
            <div className="space-y-2">
              <Label>NPSN</Label>
              <Input 
                name="npsn" 
                value={formData.npsn} 
                onChange={handleChange} 
              />
            </div>
            <div className="space-y-2">
              <Label>Akreditasi</Label>
              <Input 
                name="akreditasi" 
                value={formData.akreditasi} 
                onChange={handleChange} 
                placeholder="A / B / C / Belum"
              />
            </div>
             <div className="space-y-2">
              <Label>Status Jam'iyyah</Label>
              <Input 
                name="statusJamiyyah" 
                value={formData.statusJamiyyah} 
                onChange={handleChange} 
                placeholder="Contoh: Ma'arif / RMI / Pondok Pesantren"
              />
            </div>
          </CardContent>
        </Card>

        {/* Kontak */}
        <Card>
          <CardHeader>
            <CardTitle>Kontak & Alamat</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="space-y-2">
              <Label>Alamat Lengkap</Label>
              <Input 
                name="alamat" 
                value={formData.alamat} 
                onChange={handleChange} 
                placeholder="Jl. Raya No. 1..."
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                <Label>Email</Label>
                <Input 
                    type="email"
                    name="email" 
                    value={formData.email} 
                    onChange={handleChange} 
                />
                </div>
                <div className="space-y-2">
                <Label>Telepon / WA</Label>
                <Input 
                    name="telepon" 
                    value={formData.telepon} 
                    onChange={handleChange} 
                />
                </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" size="lg">
            <Save className="mr-2 h-4 w-4" />
            Simpan Perubahan
          </Button>
        </div>
      </form>
    </div>
  )
}
