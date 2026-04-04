import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { School, Users, FileText, CheckCircle, Clock, AlertOctagon, Loader2 } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { dashboardApi } from "@/lib/api"
import { useNavigate } from "react-router-dom"
import { useState } from "react"
import { DashboardCharts } from "./DashboardCharts"
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'

export default function DashboardOperator() {
  const navigate = useNavigate()
  const [user] = useState<any>(() => {
    const u = localStorage.getItem("user_data")
    try {
      return u ? JSON.parse(u) : null
    } catch {
      return null
    }
  })

  // 🔥 REST API QUERIES
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['school-stats', user?.id],
    queryFn: () => dashboardApi.getSchoolStats()
  })
  
  const { data: skTrend, isLoading: isLoadingTrend } = useQuery({
    queryKey: ['sk-trend', user?.unit],
    queryFn: () => dashboardApi.getSkTrend(6, user?.unit)
  })

  if (isLoadingStats && !stats) {
      return (
          <div className="flex h-[400px] w-full items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          </div>
      )
  }

  // Teacher Growth Mock (Laravel doesn't provide this yet)
  const teacherGrowth = 0
  const teacherGrowthLabel = "Stabil"

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard Sekolah</h1>
        <p className="text-muted-foreground">
           Selamat datang, Operator <span className="font-semibold text-foreground">{user?.unit || "Sekolah"}</span>.
        </p>
      </div>

      {stats?.error ? (
         <div className="p-4 bg-yellow-50 text-yellow-800 rounded-lg">Data statistik tidak tersedia untuk unit ini.</div>
      ) : (
        <>
        {/* OVERVIEW CARDS */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          
          {/* 1. TOTAL GURU */}
          <Card className="border-0 shadow-xl bg-gradient-to-br from-emerald-600 to-teal-800 text-white overflow-hidden relative rounded-2xl">
            <CardContent className="p-6 relative z-10 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between space-x-4">
                  <div className="flex flex-col space-y-1">
                      <span className="text-emerald-50/80 font-medium text-sm tracking-wide">Total Guru</span>
                      <span className="text-4xl font-extrabold tracking-tight drop-shadow-md">{stats?.teachers || 0}</span>
                  </div>
                  <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl">
                      <Users className="h-7 w-7 text-white" />
                  </div>
              </div>
              <div className="mt-6 flex items-end justify-between">
                  <span className="bg-emerald-900/40 text-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-400/30 text-xs font-semibold">Data Aktif</span>
              </div>
            </CardContent>
          </Card>
          
          {/* 2. TOTAL SISWA */}
          <Card className="border-0 shadow-sm bg-white relative overflow-hidden rounded-2xl">
            <CardContent className="p-6 flex flex-col justify-between h-full">
               <div className="flex items-center justify-between space-x-4 relative z-10">
                  <div className="flex flex-col space-y-1">
                      <span className="text-sm font-semibold text-slate-500 tracking-wide">Total Siswa</span>
                      <span className="text-4xl font-extrabold text-blue-900 tracking-tight">{stats?.students || 0}</span>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100 shadow-sm">
                      <School className="h-7 w-7 text-blue-600" />
                  </div>
              </div>
            </CardContent>
          </Card>

          {/* 3. SK TERBIT */}
          <Card className="border-0 shadow-sm bg-white overflow-hidden relative rounded-2xl">
            <CardContent className="p-6 flex flex-col justify-between h-full">
               <div className="flex items-center justify-between space-x-4 relative z-10">
                  <div className="flex flex-col space-y-1">
                      <span className="text-sm font-semibold text-slate-500 tracking-wide">SK Terbit</span>
                      <span className="text-4xl font-extrabold text-purple-900 tracking-tight">{stats?.skApproved || 0}</span>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-2xl">
                      <CheckCircle className="h-7 w-7 text-purple-600" />
                  </div>
               </div>
            </CardContent>
          </Card>

          {/* 4. DRAFT SK */}
          <Card className="border-0 shadow-sm bg-white relative overflow-hidden rounded-2xl">
            <CardContent className="p-6 flex flex-col justify-between h-full">
               <div className="flex items-center justify-between space-x-4 relative z-10">
                  <div className="flex flex-col space-y-1">
                      <span className="text-sm font-semibold text-slate-500 tracking-wide">Draft SK</span>
                      <span className="text-4xl font-extrabold text-amber-900 tracking-tight">{stats?.skDrafts || 0}</span>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-2xl">
                      <Clock className="h-7 w-7 text-amber-600" />
                  </div>
               </div>
            </CardContent>
          </Card>
        </div>

        {/* CHARTS SECTION */}
        <DashboardCharts data={{
            status: stats?.status || [],
            certification: stats?.certification || [],
            units: [], 
            kecamatan: [] 
        }} />

        {/* SK TREND CHART */}
        {skTrend && skTrend.length > 0 && (
             <Card className="mt-6">
                <CardHeader><CardTitle>Trend Pengajuan SK (6 Bulan)</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-[250px] w-full">
                     <ResponsiveContainer width="100%" height="100%">
                         <AreaChart data={skTrend} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                             <defs>
                                 <linearGradient id="colorCountOp" x1="0" y1="0" x2="0" y2="1">
                                     <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                                     <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                 </linearGradient>
                             </defs>
                             <CartesianGrid strokeDasharray="3 3" vertical={false} />
                             <XAxis dataKey="month" axisLine={false} tickLine={false} />
                             <YAxis axisLine={false} tickLine={false} />
                             <Tooltip contentStyle={{borderRadius: '8px'}} />
                             <Area type="monotone" dataKey="count" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCountOp)" />
                         </AreaChart>
                     </ResponsiveContainer>
                  </div>
                </CardContent>
             </Card>
        )}
        </>
      )}

      {/* QUICK ACTIONS */}
      <div className="mt-8 mb-6">
        <h3 className="text-xl font-bold tracking-tight text-slate-800 mb-4 flex items-center gap-2">
            <div className="w-2 h-6 bg-purple-500 rounded-full"></div>
            Akses Cepat
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
                { label: "Data Guru", description: "Kelola data pengajar", icon: Users, path: "/dashboard/master/teachers", color: "text-blue-600 bg-blue-50" },
                { label: "Data Siswa", description: "Database siswa aktif", icon: School, path: "/dashboard/master/students", color: "text-orange-600 bg-orange-50" },
                { label: "Ajukan SK Kolektif", description: "Buat pengajuan baru", icon: FileText, path: "/dashboard/sk/new", color: "text-emerald-600 bg-emerald-50" },
                { label: "Profil Sekolah", description: "Update info lembaga", icon: School, path: "/dashboard/school/profile", color: "text-purple-600 bg-purple-50" },
            ].map((action, i) => (
                <Card 
                    key={i} 
                    className="cursor-pointer hover:shadow-md transition-all border-none shadow-sm rounded-xl overflow-hidden" 
                    onClick={() => navigate(action.path)}
                >
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${action.color}`}>
                            <action.icon className="h-6 w-6" />
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-800 text-sm">{action.label}</h4>
                            <p className="text-xs text-slate-500">{action.description}</p>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
      </div>
    </div>
  )
}
