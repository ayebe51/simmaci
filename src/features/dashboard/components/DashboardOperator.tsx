import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { School, Users, FileText, CheckCircle, Clock } from "lucide-react"
import { useQuery } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { useNavigate } from "react-router-dom"

export default function DashboardOperator() {
  const navigate = useNavigate()
  const stats = useQuery(api.dashboard.getSchoolStats)
  const userStr = localStorage.getItem("user")
  const user = userStr ? JSON.parse(userStr) : null

  const quickActions = [
    { label: "Data Guru", icon: Users, path: "/dashboard/master/teachers", color: "bg-blue-100 text-blue-700" },
    { label: "Data Siswa", icon: School, path: "/dashboard/master/students", color: "bg-orange-100 text-orange-700" },
    { label: "Buat SK", icon: FileText, path: "/dashboard/sk/generator", color: "bg-green-100 text-green-700" },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard Sekolah</h1>
        <p className="text-muted-foreground">
           Selamat datang, Operator <span className="font-semibold text-foreground">{user?.unitKerja || "Sekolah"}</span>.
        </p>
      </div>

      {stats ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Guru</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.teachers}</div>
              <p className="text-xs text-muted-foreground">Guru Aktif</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Siswa</CardTitle>
              <School className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.students}</div>
              <p className="text-xs text-muted-foreground">Terdaftar</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">SK Terbit</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.skApproved}</div>
              <p className="text-xs text-muted-foreground">Sudah diverifikasi</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">SK Draft</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.skDrafts}</div>
              <p className="text-xs text-muted-foreground">Menunggu persetujuan</p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-4">
            {[1,2,3,4].map(i => (
                <div key={i} className="h-32 rounded-lg bg-gray-100 animate-pulse" />
            ))}
        </div>
      )}

      {/* QUICK ACTIONS */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Akses Cepat</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {quickActions.map((action, i) => (
                <Card 
                    key={i} 
                    className="cursor-pointer hover:shadow-md transition-all border-l-4 border-l-transparent hover:border-l-primary"
                    onClick={() => navigate(action.path)}
                >
                    <CardContent className="flex flex-col items-center justify-center p-6 gap-3 text-center">
                        <div className={`p-3 rounded-full ${action.color}`}>
                            <action.icon className="h-6 w-6" />
                        </div>
                        <span className="font-medium text-sm">{action.label}</span>
                    </CardContent>
                </Card>
            ))}
        </div>
      </div>
    </div>
  )
}
