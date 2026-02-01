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

  // Get current user to get school name
  const userStr = localStorage.getItem("user")
  const user = userStr ? JSON.parse(userStr) : null
  const schoolName = user?.unit

  // Fetch school data by name (using search or filter logic if available, 
  // currently we don't have getByName, so we rely on finding it via list or specific query if we had one.
  // Actually, we can use the 'users' list technique or add 'getByName' helper.
  // For now, let's use the 'schools' list and find client side (temporary) or add a query.
  // Better: Add 'getSelf' query in backend, but for speed, let's search.
  // Wait, we have 'paginatedList' with search.
  
  // Or better, since we are operators, we can use `api.schools.list` and find our school.
  const schools = useQuery(api.schools.list, {})
  const school = schools?.find(s => s.nama === schoolName)

  const updateProfile = useMutation(api.schools.updateSelf)

  useEffect(() => {
    if (school) {
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
    } catch (error: any) {
      toast.error("Gagal update: " + error.message)
    }
  }

  if (!schools) return <div>Loading...</div>
  if (!school) return <div>Data sekolah tidak ditemukan for unit: {schoolName}</div>

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
