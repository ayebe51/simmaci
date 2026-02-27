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
// 🔥 CONVEX AUTH
import { useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"

export default function LoginPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  
  // Convex login mutation
  const loginMutation = useMutation(api.auth.login)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    // Get values
    const emailInput = (document.getElementById("email") as HTMLInputElement)?.value || ""
    const passwordInput = (document.getElementById("password") as HTMLInputElement)?.value || ""

    try {
        // 🔥 Call Convex login
        const data = await loginMutation({
          email: emailInput,
          password: passwordInput,
        })
        
        // Save token (user ID)
        localStorage.setItem("token", data.token)
        
        // Save user data
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-950 p-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-300/10 rounded-full blur-[100px] pointer-events-none" />

      <Card className="w-full max-w-sm border-0 shadow-2xl bg-white/10 backdrop-blur-xl text-white relative z-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
        <CardHeader className="space-y-1 text-center relative z-10 pt-8">
          <div className="mb-4 flex justify-center drop-shadow-lg">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 shadow-inner">
              {/* Logo placeholder */}
              <img src="/logo-icon.png" alt="Logo" className="h-10 w-10 object-contain drop-shadow-md brightness-0 invert" />
            </div>
          </div>
          <CardTitle className="text-3xl font-extrabold tracking-tight text-white drop-shadow-sm">
            SIMMACI
          </CardTitle>
          <CardDescription className="text-emerald-100/80 font-medium">
            Sistem Informasi Manajemen
            <br/>Ma'arif NU Cilacap 
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin} className="relative z-10">
          <CardContent className="space-y-5 px-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-emerald-100">Username / Email</Label>
              <Input
                id="email"
                type="text"
                placeholder="admin"
                required
                className="bg-white/10 border-white/20 text-white placeholder:text-emerald-100/50 focus-visible:ring-emerald-500/50 focus-visible:border-emerald-400"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-emerald-100">Password</Label>
                <a 
                  href="https://wa.me/6282227438003?text=Assalamu%27alaikum%20Admin%2C%20saya%20lupa%20password%20akun%20SIMMACI.%20Mohon%20bantu%20reset."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-emerald-200 hover:text-white transition-colors hover:underline"
                >
                  Lupa Password?
                </a>
              </div>
              <Input 
                id="password" 
                type="password" 
                required 
                placeholder="***" 
                className="bg-white/10 border-white/20 text-white placeholder:text-emerald-100/50 focus-visible:ring-emerald-500/50 focus-visible:border-emerald-400"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 pb-8 px-6">
            <Button className="w-full bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold shadow-lg hover:shadow-emerald-500/30 transition-all duration-300" type="submit" disabled={loading}>
              {loading ? "Menghubungkan..." : "Masuk ke Sistem"}
            </Button>
            <div className="w-full text-center text-xs text-emerald-200/60 font-medium">
              <p>v1.0 &bull; Lembaga Pendidikan Ma'arif NU Cilacap</p>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
