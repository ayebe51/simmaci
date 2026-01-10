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

import { api } from "@/lib/api"
import { toast } from "sonner"

export default function LoginPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    // Get values
    const emailInput = (document.getElementById("email") as HTMLInputElement)?.value || ""
    const passwordInput = (document.getElementById("password") as HTMLInputElement)?.value || ""

    try {
        const data = await api.login(emailInput, passwordInput)
        
        // Save token
        api.setToken(data.access_token)
        
        // Save real user data from backend
        localStorage.setItem("user", JSON.stringify(data.user))

        toast.success("Login Berhasil!")
        navigate("/dashboard")
    } catch (err: any) {
        console.error(err);
        toast.error(err.message || "Login Gagal! Username atau Password salah.")
    } finally {
        setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50/50 p-4">
      <Card className="w-full max-w-sm shadow-xl">
        <CardHeader className="space-y-1 text-center">
          <div className="mb-2 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              {/* Logo placeholder */}
              <img src="/logo-icon.png" alt="Logo" className="h-10 w-10 object-contain" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            SIMMACI
          </CardTitle>
          <CardDescription>
            Sistem Informasi Manajemen Maarif NU Cilacap 
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Username / Email</Label>
              <Input
                id="email"
                type="text"
                placeholder="admin"
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
              </div>
              <Input id="password" type="password" required placeholder="***" />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? "Masuk..." : "Masuk"}
            </Button>
            <div className="text-center text-sm">
                Belum punya akun? <Link to="/register" className="text-primary hover:underline">Daftar disini</Link>
            </div>
          </CardFooter>
        </form>
        <div className="px-8 pb-8 text-center text-xs text-muted-foreground">
          <p>Lembaga Pendidikan Ma'arif NU Cilacap</p>
        </div>
      </Card>
    </div>
  )
}
