import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { toast } from "sonner"

import { api } from "@/lib/api"

export default function RegisterPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  
  const [formData, setFormData] = useState({
      name: "",
      unitKerja: "",
      email: "",
      password: "",
      confirmPassword: ""
  })

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (formData.password !== formData.confirmPassword) {
        toast.error("Konfirmasi password tidak sesuai.")
        return
    }

    setLoading(true)

    try {
        await api.register({
            username: formData.email,
            password: formData.password,
            name: formData.name,
            unitKerja: formData.unitKerja
        })
        toast.success("Pendaftaran berhasil! Silakan login.")
        navigate("/login")
    } catch (err: any) {
        toast.error(err.message || "Pendaftaran gagal. Coba username lain.")
    } finally {
        setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50/50 p-4">
      <Card className="w-full max-w-sm shadow-xl">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold tracking-tight">
            Pendaftaran Operator
          </CardTitle>
          <CardDescription>
            Buat akun untuk mengelola dokumen sekolah Anda
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleRegister}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nama Lengkap (Operator)</Label>
              <Input
                id="name"
                required
                placeholder="Misal: Budi Santoso"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">Nama Sekolah / Lembaga</Label>
              <Input
                id="unit"
                required
                placeholder="Misal: MI Ma'arif 01..."
                value={formData.unitKerja}
                onChange={e => setFormData({...formData, unitKerja: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Username / Email Login</Label>
              <Input
                id="email"
                required
                placeholder="username123"
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                required 
                value={formData.password}
                onChange={e => setFormData({...formData, password: e.target.value})}
              />
            </div>
             <div className="space-y-2">
              <Label htmlFor="confirmPassword">Konfirmasi Password</Label>
              <Input 
                id="confirmPassword" 
                type="password" 
                required 
                value={formData.confirmPassword}
                onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? "Mendaftar..." : "Daftar Sekarang"}
            </Button>
            <div className="text-center text-sm">
                Sudah punya akun? <Link to="/login" className="text-primary hover:underline">Masuk disini</Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
