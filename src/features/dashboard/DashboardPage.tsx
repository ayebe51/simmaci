import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  FileText, 
  Users, 
  School, 
  Clock, 
  CheckCircle, 
  AlertOctagon 
} from "lucide-react"
import { useState } from "react"
import { useQuery } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { DashboardCharts } from "./components/DashboardCharts"
import DashboardOperator from "./components/DashboardOperator"

export default function DashboardPage() {
  // Load user directly
  const [user] = useState<any>(() => {
    const u = localStorage.getItem("user")
    return u ? JSON.parse(u) : null
  })

  // 🔥 REAL-TIME CONVEX QUERY - Auto-updates!
  const convexStats = useQuery(api.dashboard.getStats)
  const analyticsStats = useQuery(api.analytics.getDashboardStats) // New Peta Mutu Data
  const logs = useQuery(api.logs.getRecentLogs, {}) // New Activity Logs
  
  // 📊 SK MONITORING QUERIES
  const operatorSchool = user?.role === "operator" ? user?.unitKerja : undefined
  
  const skStats = useQuery(api.dashboard.getSkStatistics, { 
    unitKerja: operatorSchool 
  })
  const skTrend = useQuery(api.dashboard.getSkTrendByMonth, { 
    months: 6,
    unitKerja: operatorSchool 
  })

  // ✅ REDIRECT OPERATOR (After all hooks are called)
  if (user && user.role === 'operator') {
      return <DashboardOperator />
  }

  // Use Convex real-time data directly
  const stats = convexStats ? {
    schoolCount: convexStats.totalSchools,
    teacherCount: convexStats.totalTeachers,
    studentCount: convexStats.totalStudents,
    skCount: convexStats.totalSk,
  } : {
    schoolCount: 0,
    teacherCount: 0,
    studentCount: 0,
    skCount: 0,
  }

  const totalTeachers = analyticsStats?.totalTeachers || stats.teacherCount
  const totalSchools = analyticsStats?.totalSchools || stats.schoolCount
  const totalSk = stats.skCount

  const Sparkline = ({ data, color }: { data: any[], color: string }) => {
    if (!data || data.length === 0) return null
    return (
      <div className="h-[40px] w-[80px]">
          <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                  <Line 
                      type="monotone" 
                      dataKey="count" 
                      stroke={color} 
                      strokeWidth={2} 
                      dot={false} 
                      isAnimationActive={false}
                  />
              </LineChart>
          </ResponsiveContainer>
      </div>
    )
  }

  // Helper logic for trends
  const currentMonthTeacherCount = analyticsStats?.teacherTrend?.[5]?.count || 0
  const previousMonthTeacherCount = analyticsStats?.teacherTrend?.[4]?.count || 0
  const teacherGrowth = currentMonthTeacherCount - previousMonthTeacherCount
  const teacherGrowthLabel = teacherGrowth > 0 ? `+${teacherGrowth} bulan ini` : "Stabil"

  return (
    <div className="space-y-8">
      {/* HEADER SECTION */}
      <div className="flex flex-col gap-2">
         <div className="flex items-center justify-between">
           <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard Overview</h1>
              <p className="text-slate-500 mt-1">
                  Selamat datang, <span className="font-semibold text-slate-900">{user?.name || "Admin"}</span>.
                  <span className="ml-2 text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border">
                    {user?.role === 'super_admin' ? 'Super Admin' : 'Operator'}
                  </span>
              </p>
           </div>
           {convexStats && (
             <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full shadow-sm">
               <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
               <span className="text-xs font-bold text-emerald-700">SYSTEM LIVE</span>
             </div>
           )}
         </div>
      </div>

      {/* OVERVIEW STATS (GRID 4) */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        
        {/* 1. TOTAL SEKOLAH */}
        <Card className="border-slate-200 shadow-sm hover:shadow-md transition-all duration-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-x-4">
                <div className="flex flex-col space-y-1">
                    <span className="text-sm font-medium text-slate-500">Total Sekolah</span>
                    <span className="text-3xl font-extrabold text-slate-900">{totalSchools}</span>
                </div>
                <div className="p-3 bg-blue-50 rounded-full">
                    <School className="h-6 w-6 text-blue-600" />
                </div>
            </div>
            <div className="mt-4 flex items-center text-xs">
                <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md font-medium">Terverifikasi</span>
                <span className="text-slate-400 ml-auto">Semester Genap</span>
            </div>
          </CardContent>
        </Card>

        {/* 2. TOTAL GURU (With Sparkline) */}
        <Card className="border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 relative overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-x-4">
                <div className="flex flex-col space-y-1 z-10">
                    <span className="text-sm font-medium text-slate-500">Total Guru/PTK</span>
                    <span className="text-3xl font-extrabold text-slate-900">{totalTeachers}</span>
                </div>
                <div className="p-3 bg-emerald-50 rounded-full z-10">
                    <Users className="h-6 w-6 text-emerald-600" />
                </div>
            </div>
            
            <div className="mt-4 flex items-end justify-between">
                <div className="flex items-center space-x-2 text-xs">
                   {teacherGrowth > 0 ? (
                       <span className="flex items-center text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md font-medium">
                           <Users className="h-3 w-3 mr-1" /> {teacherGrowthLabel}
                       </span>
                   ) : (
                       <span className="text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md text-xs">Data Stabil</span>
                   )}
                </div>
                {/* Sparkline placed absolutely or normally */}
                <div className="absolute right-0 bottom-0 opacity-20 transform translate-y-2 scale-110">
                   <Sparkline data={analyticsStats?.teacherTrend || []} color="#059669" />
                </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. TOTAL SISWA (Empty State Handling) */}
        <Card className="border-slate-200 shadow-sm hover:shadow-md transition-all duration-200">
          <CardContent className="p-6">
             <div className="flex items-center justify-between space-x-4">
                <div className="flex flex-col space-y-1">
                    <span className="text-sm font-medium text-slate-500">Total Siswa</span>
                    {stats.studentCount > 0 ? (
                        <span className="text-3xl font-extrabold text-slate-900">{stats.studentCount}</span>
                    ) : (
                        <span className="text-xl font-bold text-slate-400">--</span>
                    )}
                </div>
                <div className="p-3 bg-orange-50 rounded-full">
                    <Users className="h-6 w-6 text-orange-600" />
                </div>
            </div>
            <div className="mt-4">
                 {stats.studentCount === 0 ? (
                     <button className="text-xs bg-orange-100 text-orange-700 font-semibold px-3 py-1.5 rounded-md hover:bg-orange-200 transition-colors w-full border border-orange-200">
                         + Import Data Siswa
                     </button>
                 ) : (
                     <span className="text-xs text-slate-400">Data SIBOS Pintar</span>
                 )}
            </div>
          </CardContent>
        </Card>

        {/* 4. TOTAL SK (With Sparkline) */}
        <Card className="border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden relative">
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-x-4">
                <div className="flex flex-col space-y-1 z-10">
                    <span className="text-sm font-medium text-slate-500">Total SK Terbit</span>
                    <span className="text-3xl font-extrabold text-slate-900">{skStats?.total || 0}</span>
                </div>
                <div className="p-3 bg-purple-50 rounded-full z-10">
                    <FileText className="h-6 w-6 text-purple-600" />
                </div>
            </div>
            <div className="mt-4 flex justify-between items-end">
                <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md font-medium">
                    {skStats?.approved || 0} Selesai
                </span>
                <div className="opacity-80 -mr-2">
                     <Sparkline data={skTrend || []} color="#9333ea" />
                </div>
            </div>
          </CardContent>
        </Card>
      </div>

       {/* 📊 CHART SECTION */}
       <DashboardCharts data={analyticsStats} />

       {/* 📊 SK MONITORING SECTION (Semantic Borders) */}
       {skStats && (
         <div className="mt-2 space-y-4">
           <div className="flex items-center justify-between">
             <h2 className="text-xl font-bold tracking-tight text-slate-800">Monitoring Status SK</h2>
             <button className="text-sm text-blue-600 hover:underline">Lihat Semua Pengajuan &rarr;</button>
           </div>

           <div className="grid gap-4 md:grid-cols-4">
             {/* Total Applied */}
             <Card className="border-l-4 border-l-blue-500 shadow-sm">
               <CardContent className="p-4 flex items-center justify-between">
                 <div>
                    <p className="text-sm text-slate-500 font-medium">Total Pengajuan</p>
                    <p className="text-2xl font-bold text-slate-900">{skStats.total}</p>
                 </div>
                 <div className="bg-blue-50 p-2 rounded-full">
                    <FileText className="h-5 w-5 text-blue-600" />
                 </div>
               </CardContent>
             </Card>

             {/* Pending */}
             <Card className="border-l-4 border-l-yellow-500 shadow-sm bg-yellow-50/10">
               <CardContent className="p-4 flex items-center justify-between">
                 <div>
                    <p className="text-sm text-slate-500 font-medium">Menunggu Review</p>
                    <p className="text-2xl font-bold text-yellow-600">{skStats.pending}</p>
                 </div>
                 <div className="bg-yellow-100 p-2 rounded-full">
                    <Clock className="h-5 w-5 text-yellow-600" />
                 </div>
               </CardContent>
             </Card>

             {/* Approved */}
             <Card className="border-l-4 border-l-green-500 shadow-sm bg-green-50/10">
               <CardContent className="p-4 flex items-center justify-between">
                 <div>
                    <p className="text-sm text-slate-500 font-medium">Disetujui</p>
                    <p className="text-2xl font-bold text-green-600">{skStats.approved}</p>
                 </div>
                 <div className="bg-green-100 p-2 rounded-full">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                 </div>
               </CardContent>
             </Card>

             {/* Rejected */}
             <Card className="border-l-4 border-l-red-500 shadow-sm bg-red-50/10">
               <CardContent className="p-4 flex items-center justify-between">
                 <div>
                    <p className="text-sm text-slate-500 font-medium">Perlu Perbaikan</p>
                    <p className="text-2xl font-bold text-red-600">{skStats.rejected}</p>
                 </div>
                 <div className="bg-red-100 p-2 rounded-full">
                    <AlertOctagon className="h-5 w-5 text-red-600" />
                 </div>
               </CardContent>
             </Card>
           </div>
         </div>
       )}

           {/* SK Trend Chart */}
           {skTrend && skTrend.length > 0 && (
             <Card className="mt-4">
               <CardHeader>
                 <CardTitle>Trend Pengajuan SK (6 Bulan Terakhir)</CardTitle>
               </CardHeader>
               <CardContent>
                 <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                            data={skTrend}
                            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                        >
                            <defs>
                                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis 
                                dataKey="month" 
                                axisLine={false}
                                tickLine={false}
                                tick={{fontSize: 12, fill: '#6b7280'}}
                                dy={10}
                            />
                            <YAxis 
                                axisLine={false}
                                tickLine={false}
                                tick={{fontSize: 12, fill: '#6b7280'}}
                            />
                            <Tooltip 
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                cursor={{ stroke: '#3b82f6', strokeWidth: 1 }}
                            />
                            <Area 
                                type="monotone" 
                                dataKey="count" 
                                stroke="#3b82f6" 
                                strokeWidth={3}
                                fillOpacity={1} 
                                fill="url(#colorCount)" 
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                 </div>
               </CardContent>
             </Card>
           )}
         </>
       )}

       {/* 📋 ACTIVITY & STATUS SECTION - Moved to bottom */}
       <div className="grid gap-4 md:grid-cols-2 mt-6">
          <Card className="col-span-1">
             <CardHeader>
                 <CardTitle>Aktivitas Terkini</CardTitle>
             </CardHeader>
             <CardContent>
                 <div className="space-y-4">
                     {logs ? (
                         logs.length > 0 ? (
                            logs.map((log, i) => (
                                <div key={i} className="flex items-center gap-4 border-b pb-2 last:border-0">
                                   <div className="h-2 w-2 rounded-full bg-blue-500"/>
                                   <div className="flex-1 space-y-1">
                                       <p className="text-sm font-medium leading-none">{log.action}</p>
                                       <p className="text-xs text-muted-foreground">{log.details}</p>
                                   </div>
                                   <div className="text-xs text-muted-foreground">
                                     {new Date(log.timestamp).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}
                                   </div>
                                </div>
                            ))
                         ) : (
                             <p className="text-sm text-muted-foreground">Belum ada aktivitas.</p>
                         )
                     ) : (
                         <p className="text-sm text-muted-foreground">Memuat aktivitas...</p>
                     )}
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
