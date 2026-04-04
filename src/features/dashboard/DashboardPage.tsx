import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  FileText, 
  Users, 
  School, 
  Clock, 
  CheckCircle, 
  AlertOctagon,
  LayoutDashboard,
  Loader2,
  Archive
} from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { dashboardApi } from "@/lib/api"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { DashboardCharts } from "./components/DashboardCharts"
import DashboardOperator from "./components/DashboardOperator"

export default function DashboardPage() {
  const navigate = useNavigate()
  // Load user safe from storage
  const [user] = useState<any>(() => {
    const u = localStorage.getItem("user_data")
    if (!u) return null
    try {
      return JSON.parse(u)
    } catch (e) {
      console.error("Dashboard: Error parsing user data", e)
      return null
    }
  })

  const operatorSchool = user?.role === "operator" ? user?.unit : undefined

  // 🔥 REST API QUERIES
  const { data: statsData, isLoading: isLoadingStats } = useQuery({
    queryKey: ['dashboard-stats', operatorSchool],
    queryFn: () => user?.role === 'operator' ? dashboardApi.getSchoolStats() : dashboardApi.getStats()
  })

  const { data: skStats, isLoading: isLoadingSkStats } = useQuery({
    queryKey: ['sk-stats', operatorSchool],
    queryFn: () => dashboardApi.getSkStatistics(operatorSchool)
  })

  const { data: skTrend, isLoading: isLoadingSkTrend } = useQuery({
    queryKey: ['sk-trend', operatorSchool],
    queryFn: () => dashboardApi.getSkTrend(6, operatorSchool) 
  })

  // Mapping logic for stability
  const stats = statsData ? {
    schoolCount: statsData.totalSchools || (statsData.schoolName ? 1 : 0),
    teacherCount: statsData.totalTeachers || statsData.teachers || 0,
    studentCount: statsData.totalStudents || statsData.students || 0,
    skCount: statsData.totalSk || 0,
  } : {
    schoolCount: 0,
    teacherCount: 0,
    studentCount: 0,
    skCount: 0,
  }

  const logs = statsData?.recentLogs || []
  const [logFilter, setLogFilter] = useState<"all" | "sk" | "emis" | "school">("all")
  
  // Filter logs based on selection
  const filteredLogs = logs?.filter((log: any) => {
    if (logFilter === "all") return true;
    if (logFilter === "sk") return ["Submit SK", "Request SK Revision", "Approve SK Revision", "Reject SK Revision"].includes(log.action);
    if (logFilter === "emis") return ["Import EMIS", "Sync EMIS", "sync_emis"].includes(log.action);
    if (logFilter === "school") return ["Create School", "Update School", "Add Unit", "Update Unit Kerja"].includes(log.action);
    return true;
  });

  // ✅ REDIRECT OPERATOR
  if (user && user.role === 'operator') {
      return <DashboardOperator />
  }

  const totalTeachers = stats.teacherCount
  const totalSchools = stats.schoolCount

  if ((isLoadingStats || isLoadingSkStats) && !statsData) {
      return (
          <div className="flex h-[400px] w-full items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          </div>
      )
  }

  return (
    <div className="space-y-8">
      {/* HEADER SECTION */}
      <div className="flex flex-col gap-2 relative z-10 mb-8">
         <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
           <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-800 flex items-center gap-3">
                  <div className="p-2 bg-emerald-100/50 rounded-xl shadow-inner border border-emerald-200/50">
                      <LayoutDashboard className="w-7 h-7 text-emerald-600" />
                  </div>
                  Dashboard Overview
              </h1>
              <p className="text-slate-500 mt-2 flex items-center gap-2">
                  Selamat datang kembali, <span className="font-bold text-emerald-800">{user?.name || "Admin"}</span>
                  <span className="text-[10px] font-bold tracking-wider bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full border border-emerald-200 shadow-sm uppercase">
                    {user?.role === 'super_admin' ? 'Super Admin' : 'Operator'}
                  </span>
              </p>
           </div>
           {statsData && (
             <div className="flex items-center gap-2 px-5 py-2.5 bg-white/70 backdrop-blur-xl border border-emerald-100/80 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
               <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></span>
                </span>
               <span className="text-xs font-bold tracking-widest text-emerald-700">REST API CONNECTED</span>
             </div>
           )}
         </div>
      </div>

      {/* OVERVIEW STATS */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 relative z-10">
        
        <Card className="border-0 shadow-xl hover:-translate-y-1 transition-all duration-300 bg-gradient-to-br from-emerald-600 to-teal-800 text-white overflow-hidden relative rounded-2xl md:col-span-1 lg:col-span-1">
          <CardContent className="p-6 relative z-10">
            <div className="flex items-center justify-between space-x-4">
                <div className="flex flex-col space-y-1">
                    <span className="text-emerald-50/80 font-medium text-sm tracking-wide">Total Sekolah</span>
                    <span className="text-4xl font-extrabold tracking-tight drop-shadow-md">{totalSchools}</span>
                </div>
                <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl border border-white/20 shadow-inner">
                    <School className="h-7 w-7 text-white drop-shadow-sm" />
                </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 transition-all duration-300 bg-white/70 backdrop-blur-xl overflow-hidden relative rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-x-4 relative z-10">
                <div className="flex flex-col space-y-1">
                    <span className="text-sm font-semibold text-slate-500 tracking-wide">Total Guru/PTK</span>
                    <span className="text-4xl font-extrabold text-emerald-900 tracking-tight">{totalTeachers}</span>
                </div>
                <div className="p-3 bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-2xl border border-emerald-200/50 shadow-sm">
                    <Users className="h-7 w-7 text-emerald-600" />
                </div>
            </div>
            <div className="mt-6">
                <Sparkline data={statsData?.teacherTrend || []} color="#059669" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 transition-all duration-300 bg-white/70 backdrop-blur-xl relative overflow-hidden rounded-2xl">
          <CardContent className="p-6">
             <div className="flex items-center justify-between space-x-4 relative z-10">
                <div className="flex flex-col space-y-1">
                    <span className="text-sm font-semibold text-slate-500 tracking-wide">Total Siswa</span>
                    <span className="text-4xl font-extrabold text-amber-900 tracking-tight">{stats.studentCount}</span>
                </div>
                <div className="p-3 bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-2xl border border-amber-200/50 shadow-sm">
                    <Users className="h-7 w-7 text-amber-500" />
                </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-xl hover:-translate-y-1 transition-all duration-300 bg-gradient-to-br from-slate-800 to-slate-950 text-white overflow-hidden relative rounded-2xl">
          <CardContent className="p-6 h-full flex flex-col justify-between">
            <div className="flex items-center justify-between space-x-4 relative z-10">
                <div className="flex flex-col space-y-1">
                    <span className="text-sm font-medium text-slate-300 tracking-wide">Total SK Terbit</span>
                    <span className="text-4xl font-extrabold tracking-tight drop-shadow-md">{skStats?.total || 0}</span>
                </div>
                <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 shadow-inner">
                    <FileText className="h-7 w-7 text-emerald-400 drop-shadow-sm" />
                </div>
            </div>
          </CardContent>
        </Card>
      </div>

       <DashboardCharts data={statsData} />

       {skStats && (
         <div className="mt-8 space-y-6">
           <div className="flex items-center justify-between">
             <h2 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
                 <div className="w-2 h-6 bg-emerald-500 rounded-full"></div>
                 Monitoring Status SK
             </h2>
           </div>

           <div className="grid gap-5 md:grid-cols-4">
             <Card>
               <CardContent className="p-5 flex items-center justify-between">
                 <div>
                    <p className="text-sm text-slate-500 font-semibold">Total Pengajuan</p>
                    <p className="text-3xl font-black text-slate-800">{skStats.total}</p>
                 </div>
               </CardContent>
             </Card>
             <Card>
               <CardContent className="p-5 flex items-center justify-between">
                 <div>
                    <p className="text-sm text-slate-500 font-semibold">Menunggu</p>
                    <p className="text-3xl font-black text-amber-600">{skStats.pending}</p>
                 </div>
               </CardContent>
             </Card>
             <Card>
               <CardContent className="p-5 flex items-center justify-between">
                 <div>
                    <p className="text-sm text-slate-500 font-semibold">Disetujui</p>
                    <p className="text-3xl font-black text-emerald-600">{skStats.approved}</p>
                 </div>
               </CardContent>
             </Card>
             <Card>
               <CardContent className="p-5 flex items-center justify-between">
                 <div>
                    <p className="text-sm text-slate-500 font-semibold">Perbaikan</p>
                    <p className="text-3xl font-black text-rose-600">{skStats.rejected}</p>
                 </div>
               </CardContent>
             </Card>
           </div>
         </div>
       )}

       {skTrend && (
         <Card className="mt-8">
           <CardHeader><CardTitle>Trend Pengajuan SK</CardTitle></CardHeader>
           <CardContent>
             <div className="h-[300px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={skTrend}>
                   <XAxis dataKey="month" />
                   <YAxis />
                   <Tooltip />
                   <Area type="monotone" dataKey="count" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                 </AreaChart>
               </ResponsiveContainer>
             </div>
           </CardContent>
         </Card>
       )}

       <div className="grid gap-6 md:grid-cols-2 mt-8">
          <Card>
             <CardHeader className="border-b"><CardTitle>Riwayat Aktivitas</CardTitle></CardHeader>
             <CardContent className="pt-4">
                  <div className="space-y-4">
                       {filteredLogs?.length > 0 ? (
                            filteredLogs.map((log: any, i: number) => (
                                <div key={i} className="flex flex-col border-b pb-2 last:border-0">
                                   <p className="text-sm font-semibold">{log.action}</p>
                                   <p className="text-xs text-slate-500">{log.details}</p>
                                </div>
                            ))
                       ) : <p className="text-center py-4 text-slate-400">Belum ada aktivitas.</p>}
                  </div>
             </CardContent>
          </Card>
       </div>
    </div>
  )
}

const Sparkline = ({ data, color }: { data: any[], color: string }) => {
  if (!data || data.length === 0) return null
  return (
    <div className="h-[40px] w-full">
        <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
                <Line type="monotone" dataKey="count" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
        </ResponsiveContainer>
    </div>
  )
}
