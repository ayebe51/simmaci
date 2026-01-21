import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { School, Users, FileText, CheckCircle, AlertOctagon, UserCheck, BadgeCheck, TrendingUp, Calendar } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { DashboardCharts } from "./components/DashboardCharts"
import { SKStatusPieChart } from "./components/SKStatusPieChart"
import { MonthlySKTrendChart } from "./components/MonthlySKTrendChart"
import { KecamatanBarChart } from "./components/KecamatanBarChart"
import { PDPKPNUCard } from "./components/PDPKPNUCard"

import { api } from "@/lib/api"
// Convex real-time query
import { useQuery } from "convex/react"
import { api as convexApi } from "../../../convex/_generated/api"

export default function DashboardPage() {
  const [user, setUser] = useState<{name: string, role: string} | null>(null)
  const [alerts, setAlerts] = useState<any[]>([])
  const [statsData, setStatsData] = useState<any>({
      schoolCount: -1,
      teacherCount: -1,
      studentCount: -1,
      skCount: -1,
      teacherActivity: null,
      certificationStats: null,
      skStatusDistribution: [],
      monthlyGrowth: null,
      monthlyTrend: [],
      kecamatanDistribution: [],
      pdpkpnuProgress: null,
      charts: { status: [], units: [] },
      recentActivities: [] as any[]
  })

  // 🔥 REAL-TIME CONVEX QUERY - Auto-updates!
  const convexStats = useQuery(convexApi.dashboard.getStats)
  const chartsData = useQuery(convexApi.dashboard.getChartsData)

  useEffect(() => {
    // Load User
    const u = localStorage.getItem("user")
    if (u) setUser(JSON.parse(u))

    // Fetch detailed stats from NestJS (for complex aggregations)
    const loadStats = async () => {
        try {
            const data = await api.getDashboardStats()
            setStatsData(data)
        } catch (err) {
            console.error("Dashboard stats unavailable:", err)
            // Gracefully handle - don't crash, use Convex data instead
            setStatsData({
                schoolCount: 0,
                teacherCount: 0,
                studentCount: 0,
                skCount: 0,
            })
        }
    }
    
    // Only load if backend is available (check if token exists)
    if (localStorage.getItem("token")) {
        loadStats()
    }
  }, [])

  // Merge Convex real-time data with existing stats
  const mergedStats = convexStats ? {
    ...statsData,
    schoolCount: convexStats.totalSchools,
    teacherCount: convexStats.totalTeachers,
    studentCount: convexStats.totalStudents,
    skCount: convexStats.totalSk,
  } : statsData

  const stats = [
    { title: "Total Sekolah", value: mergedStats.schoolCount, icon: School, color: "text-blue-500" },
    { title: "Total Guru/PTK", value: mergedStats.teacherCount, icon: Users, color: "text-green-500" },
    { title: "Total Siswa", value: mergedStats.studentCount, icon: Users, color: "text-orange-500" },
    { title: "Pengajuan SK", value: mergedStats.skCount, icon: FileText, color: "text-purple-500", desc: "Menunggu persetujuan / Total" },
  ]

//... (Rest of render)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
         <div className="flex items-center gap-3">
           <h1 className="text-3xl font-bold tracking-tight">Dashboard Overview</h1>
           {convexStats && (
             <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-100 border border-green-300 rounded-full">
               <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
               <span className="text-xs font-semibold text-green-700">LIVE</span>
             </div>
           )}
         </div>
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

      {/* Enhanced Statistics Cards */}
      {statsData.teacherActivity && statsData.certificationStats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Active Teachers Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Guru Aktif</CardTitle>
              <UserCheck className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsData.teacherActivity.active} / {statsData.teacherActivity.total}
              </div>
              <p className="text-xs text-muted-foreground">
                {statsData.teacherActivity.activePercentage}% guru aktif
              </p>
              <div className="mt-2 h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${statsData.teacherActivity.activePercentage > 80 ? 'bg-green-500' : statsData.teacherActivity.activePercentage > 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${statsData.teacherActivity.activePercentage}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Certification Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sertifikasi</CardTitle>
              <BadgeCheck className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsData.certificationStats.certified}
              </div>
              <p className="text-xs text-muted-foreground">
                {statsData.certificationStats.certificationRate}% bersertifikasi
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {statsData.certificationStats.uncertified} belum sertifikasi
              </p>
            </CardContent>
          </Card>

          {/* SK Status Breakdown */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Status SK</CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {statsData.skStatusDistribution && statsData.skStatusDistribution.length > 0 ? (
                  statsData.skStatusDistribution.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{item.status}:</span>
                      <span className="font-semibold">{item.count}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">Belum ada data</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Monthly Growth */}
          {statsData.monthlyGrowth && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Bulan Ini</CardTitle>
                <Calendar className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground mb-2">
                  {statsData.monthlyGrowth.month}
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Guru baru:</span>
                    <span className="font-semibold">{statsData.monthlyGrowth.newTeachers}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">SK baru:</span>
                    <span className="font-semibold">{statsData.monthlyGrowth.newSKSubmissions}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Phase 2: Enhanced Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* PDPKPNU Progress Card */}
        {statsData.pdpkpnuProgress && (
          <PDPKPNUCard data={statsData.pdpkpnuProgress} />
        )}

        {/* SK Status Distribution Pie Chart */}
        {statsData.skStatusDistribution && statsData.skStatusDistribution.length > 0 && (
          <SKStatusPieChart data={statsData.skStatusDistribution} />
        )}
      </div>

      {/* Monthly Trend & Kecamatan Distribution */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Monthly SK Trend */}
        {statsData.monthlyTrend && statsData.monthlyTrend.length > 0 && (
          <MonthlySKTrendChart data={statsData.monthlyTrend} />
        )}

        {/* Kecamatan Distribution (Super Admin only) */}
        {user && user.role === 'super_admin' && statsData.kecamatanDistribution && statsData.kecamatanDistribution.length > 0 && (
          <KecamatanBarChart data={statsData.kecamatanDistribution} />
        )}
      </div>

      {/* CHARTS SECTION */}
      <DashboardCharts data={chartsData} />

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
