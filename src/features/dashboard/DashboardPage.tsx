import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { School, Users, FileText, CheckCircle, Bell, AlertOctagon } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { DashboardCharts } from "./components/DashboardCharts"

import { api } from "@/lib/api"
// ...

export default function DashboardPage() {
  const [user, setUser] = useState<{name: string, role: string} | null>(null)
  const [alerts, setAlerts] = useState<any[]>([])
  const [statsData, setStatsData] = useState({
      schoolCount: 0,
      teacherCount: 0,
      studentCount: 0,
      skCount: 0
  })

  useEffect(() => {
    // Load User
    const u = localStorage.getItem("user")
    if (u) setUser(JSON.parse(u))

    // Fetch Stats
    const loadStats = async () => {
        try {
            const data = await api.getDashboardStats()
            setStatsData(data)
        } catch (err) {
            console.error(err)
        }
    }
    loadStats()

    // Check Headmaster Tenure Expiry (Keep existing logic or verify if needed backend)
    // ... (Existing alert logic kept as is for now as it relies on local storage of 'app_teachers' which we might want to migrate later, but let's keep it for now if it works on frontend mock data or just leave it empty if 'app_teachers' is empty)
  }, [])

  const stats = [
    { title: "Total Sekolah", value: statsData.schoolCount, icon: School, color: "text-blue-500" },
    { title: "Total Guru/PTK", value: statsData.teacherCount, icon: Users, color: "text-green-500" },
    { title: "Total Siswa", value: statsData.studentCount, icon: Users, color: "text-orange-500" },
    { title: "Pengajuan SK", value: statsData.skCount, icon: FileText, color: "text-purple-500", desc: "Menunggu persetujuan / Total" },
  ]
//... (Rest of render)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
         <h1 className="text-3xl font-bold tracking-tight">Dashboard Overview</h1>
         <p className="text-muted-foreground">
            Selamat datang, <span className="font-semibold text-foreground">{user?.name || "Admin"}</span> ({user?.role === 'super_admin' ? 'Super Admin' : 'Operator'}).
         </p>
      </div>

      {/* ALERTS SECTION */}
      {alerts.length > 0 && (
          <div className="space-y-4">
              {alerts.map((alert, idx) => (
                  <div key={idx} className="flex items-start gap-4 p-4 border-l-4 border-red-500 bg-red-50 rounded-r-md">
                      <AlertOctagon className="h-6 w-6 text-red-600 mt-1" />
                      <div>
                          <h4 className="font-bold text-red-900">{alert.title}</h4>
                          <p className="text-sm text-red-700 mt-1">{alert.message}</p>
                          <div className="mt-2">
                              <Button variant="outline" size="sm" className="bg-white border-red-200 text-red-700 hover:bg-red-50" onClick={() => window.alert("Silakan hubungi operator cabang untuk penjadwalan Fit & Proper Test.")}>
                                  {alert.action}
                              </Button>
                          </div>
                      </div>
                  </div>
              ))}
          </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              {stat.desc && (
                  <p className="text-xs text-muted-foreground">{stat.desc}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* CHARTS SECTION */}
      <DashboardCharts />

      <div className="grid gap-4 md:grid-cols-2">
          <Card className="col-span-1">
             <CardHeader>
                 <CardTitle>Aktivitas Terkini</CardTitle>
             </CardHeader>
             <CardContent>
                 <div className="space-y-4">
                     {[1,2,3].map(i => (
                         <div key={i} className="flex items-center gap-4 border-b pb-2 last:border-0">
                            <div className="h-2 w-2 rounded-full bg-blue-500"/>
                            <div className="flex-1 space-y-1">
                                <p className="text-sm font-medium leading-none">Pengajuan SK Mutasi Guru</p>
                                <p className="text-xs text-muted-foreground">oleh Admin MI Ma'arif 0{i}</p>
                            </div>
                            <div className="text-xs text-muted-foreground">2 jam lalu</div>
                         </div>
                     ))}
                 </div>
             </CardContent>
          </Card>

           <Card className="col-span-1">
             <CardHeader>
                 <CardTitle>Status Import Data EMIS</CardTitle>
             </CardHeader>
             <CardContent>
                 <div className="flex items-center gap-2 mb-4">
                    <CheckCircle className="h-5 w-5 text-green-500"/>
                    <span className="text-sm font-medium">Terakhir sinkronisasi: 24 Des 2025, 08:00</span>
                 </div>
                 <div className="rounded-md bg-muted p-4">
                     <p className="text-xs text-muted-foreground">Data sinkronisasi mencakup 140 Sekolah. 2 Sekolah gagal impor data.</p>
                 </div>
             </CardContent>
          </Card>
      </div>
    </div>
  )
}
