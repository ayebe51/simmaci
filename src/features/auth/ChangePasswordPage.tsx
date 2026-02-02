import { useState } from "react"
import { useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { Lock, Save, Eye, EyeOff } from "lucide-react"
import { useNavigate } from "react-router-dom"

export default function ChangePasswordPage() {
  const navigate = useNavigate()
  const changePassword = useMutation(api.auth.changePassword)
  
  const [formData, setFormData] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: ""
  })
  
  const [showOldPass, setShowOldPass] = useState(false)
  const [showNewPass, setShowNewPass] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (formData.newPassword.length < 6) {
        toast.error("Password baru minimal 6 karakter")
        return
    }

    if (formData.newPassword !== formData.confirmPassword) {
        toast.error("Konfirmasi password tidak cocok")
        return
    }

    try {
      const userStr = localStorage.getItem("user")
      const user = userStr ? JSON.parse(userStr) : null
      
      if (!user || !user._id) {
        toast.error("Sesi tidak valid. Silakan login ulang.")
        return
      }

      await changePassword({
        userId: user._id, // Pass userId
        oldPassword: formData.oldPassword,
        newPassword: formData.newPassword
      })
      
      toast.success("Password berhasil diubah! Silakan login ulang.")
      
      // Optional: Logout user
      localStorage.removeItem("user")
      navigate("/login")
      
    } catch (error) {
      toast.error("Gagal ganti password: " + (error as Error).message)
    }
  }

  return (
    <div className="space-y-6 max-w-md mx-auto mt-10">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Ganti Password</h1>
        <p className="text-muted-foreground">
          Amankan akun Anda dengan mengganti password secara berkala.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Form Ganti Password
          </CardTitle>
        </CardHeader>
        <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                    <Label>Password Lama</Label>
                    <div className="relative">
                        <Input 
                            type={showOldPass ? "text" : "password"}
                            name="oldPassword" 
                            value={formData.oldPassword} 
                            onChange={handleChange} 
                            required
                            placeholder="Masukkan password saat ini"
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowOldPass(!showOldPass)}
                        >
                            {showOldPass ? (
                                <EyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                                <Eye className="h-4 w-4 text-muted-foreground" />
                            )}
                        </Button>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>Password Baru</Label>
                    <div className="relative">
                        <Input 
                            type={showNewPass ? "text" : "password"}
                            name="newPassword" 
                            value={formData.newPassword} 
                            onChange={handleChange} 
                            required
                            placeholder="Minimal 6 karakter"
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowNewPass(!showNewPass)}
                        >
                            {showNewPass ? (
                                <EyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                                <Eye className="h-4 w-4 text-muted-foreground" />
                            )}
                        </Button>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>Konfirmasi Password Baru</Label>
                    <Input 
                        type={showNewPass ? "text" : "password"}
                        name="confirmPassword" 
                        value={formData.confirmPassword} 
                        onChange={handleChange} 
                        required
                        placeholder="Ulangi password baru"
                    />
                </div>

                <Button type="submit" className="w-full">
                    <Save className="mr-2 h-4 w-4" />
                    Simpan Password Baru
                </Button>
            </form>
        </CardContent>
      </Card>
    </div>
  )
}
