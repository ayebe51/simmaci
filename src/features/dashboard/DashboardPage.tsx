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
import { useNavigate } from "react-router-dom"
import { useQuery } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { DashboardCharts } from "./components/DashboardCharts"
import DashboardOperator from "./components/DashboardOperator"

export default function DashboardPage() {
  const navigate = useNavigate()
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

  // Helper logic for trends

  // Helper logic for trends
  const currentMonthTeacherCount = analyticsStats?.teacherTrend?.[5]?.count || 0
  const previousMonthTeacherCount = analyticsStats?.teacherTrend?.[4]?.count || 0
  const teacherGrowth = currentMonthTeacherCount - previousMonthTeacherCount
  const teacherGrowthLabel = teacherGrowth > 0 ? `+${teacherGrowth} bulan ini` : "Stabil"

  return (
    <div className="space-y-8">
      {/* HEADER SECTION */}
      <div className="flex flex-col gap-2 relative z-10">
         <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
           <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-800">Dashboard Overview</h1>
              <p className="text-slate-500 mt-1.5 flex items-center gap-2">
                  Selamat datang, <span className="font-bold text-slate-700">{user?.name || "Admin"}</span>
                  <span className="text-[10px] font-bold tracking-wider bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full border border-emerald-200 uppercase">
                    {user?.role === 'super_admin' ? 'Super Admin' : 'Operator'}
                  </span>
              </p>
           </div>
           {convexStats && (
             <div className="flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-md border border-emerald-100 rounded-2xl shadow-sm">
               <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
               <span className="text-xs font-bold tracking-widest text-emerald-700">SYSTEM LIVE</span>
             </div>
           )}
         </div>
      </div>

      {/* OVERVIEW STATS (GRID 4) */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        
        {/* 1. TOTAL SEKOLAH */}
        <Card className="border-0 shadow-lg hover-lift bg-gradient-to-br from-emerald-600 to-teal-800 text-white overflow-hidden relative">
          <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[120%] bg-white/10 blur-2xl rounded-full pointer-events-none mix-blend-overlay" />
          <CardContent className="p-6 relative z-10">
            <div className="flex items-center justify-between space-x-4">
                <div className="flex flex-col space-y-1">
                    <span className="text-emerald-100 font-medium text-sm">Total Sekolah</span>
                    <span className="text-4xl font-extrabold tracking-tight">{totalSchools}</span>
                </div>
                <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl border border-white/20">
                    <School className="h-7 w-7 text-white" />
                </div>
            </div>
            <div className="mt-5 flex items-center text-xs">
                <span className="bg-emerald-800/50 text-emerald-50 px-2.5 py-1 rounded-md font-semibold border border-emerald-500/30">Terverifikasi</span>
                <span className="text-emerald-200/80 ml-auto font-medium">Semester Genap</span>
            </div>
          </CardContent>
        </Card>

        {/* 2. TOTAL GURU (With Sparkline) */}
        <Card className="border-slate-100/50 shadow-md hover-lift glass overflow-hidden relative">
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-x-4 relative z-10">
                <div className="flex flex-col space-y-1">
                    <span className="text-sm font-semibold text-slate-500">Total Guru/PTK</span>
                    <span className="text-4xl font-extrabold text-slate-800 tracking-tight">{totalTeachers}</span>
                </div>
                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100/50 shadow-sm">
                    <Users className="h-7 w-7 text-emerald-600" />
                </div>
            </div>
            
            <div className="mt-5 flex items-end justify-between relative z-10">
                <div className="flex items-center space-x-2 text-xs">
                   {teacherGrowth > 0 ? (
                       <span className="flex items-center text-emerald-700 bg-emerald-100/80 px-2.5 py-1 rounded-md font-bold border border-emerald-200">
                           <Users className="h-3 w-3 mr-1.5" /> {teacherGrowthLabel}
                       </span>
                   ) : (
                       <span className="text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md text-xs font-semibold border border-slate-200">Data Stabil</span>
                   )}
                </div>
                {/* Sparkline placed absolutely or normally */}
                <div className="absolute right-[-10%] bottom-[-10%] opacity-30 transform translate-y-2 scale-110 pointer-events-none">
                   <Sparkline data={analyticsStats?.teacherTrend || []} color="#059669" />
                </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. TOTAL SISWA (Empty State Handling) */}
        <Card className="border-slate-100/50 shadow-md hover-lift glass relative overflow-hidden">
          <CardContent className="p-6">
             <div className="flex items-center justify-between space-x-4 relative z-10">
                <div className="flex flex-col space-y-1">
                    <span className="text-sm font-semibold text-slate-500">Total Siswa</span>
                    {stats.studentCount > 0 ? (
                        <span className="text-4xl font-extrabold text-slate-800 tracking-tight">{stats.studentCount}</span>
                    ) : (
                        <span className="text-3xl font-extrabold text-slate-300">--</span>
                    )}
                </div>
                <div className="p-3 bg-amber-50 rounded-2xl border border-amber-100/50 shadow-sm">
                    <Users className="h-7 w-7 text-amber-500" />
                </div>
            </div>
            <div className="mt-5 relative z-10">
                 {stats.studentCount === 0 ? (
                     <button 
                         onClick={() => navigate("/dashboard/master/students?action=import")}
                         className="text-xs bg-gradient-to-r from-amber-400 to-amber-500 text-white font-bold px-4 py-2 rounded-lg shadow-sm hover:shadow-md hover:from-amber-500 hover:to-orange-500 transition-all w-full border border-amber-300"
                     >
                         + Import Data Siswa
                     </button>
                 ) : (
                     <span className="text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-md">Data SIBOS Pintar</span>
                 )}
            </div>
          </CardContent>
        </Card>

        {/* 4. TOTAL SK (With Sparkline) */}
        <Card className="border-0 shadow-lg hover-lift bg-gradient-to-br from-slate-800 to-slate-950 text-white overflow-hidden relative">
          <CardContent className="p-6">
            <div className="absolute bottom-[-30%] left-[-20%] w-[80%] h-[150%] bg-emerald-500/20 blur-3xl rounded-full pointer-events-none mix-blend-overlay" />
            <div className="flex items-center justify-between space-x-4 relative z-10">
                <div className="flex flex-col space-y-1">
                    <span className="text-sm font-medium text-slate-300">Total SK Terbit</span>
                    <span className="text-4xl font-extrabold tracking-tight">{skStats?.total || 0}</span>
                </div>
                <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 shadow-sm">
                    <FileText className="h-7 w-7 text-emerald-400" />
                </div>
            </div>
            <div className="mt-5 flex justify-between items-end relative z-10">
                <span className="text-xs text-emerald-100 bg-emerald-500/30 border border-emerald-400/30 px-2.5 py-1 rounded-md font-semibold tracking-wide">
                    {skStats?.approved || 0} Selesai
                </span>
                <div className="opacity-40 -mr-4 absolute right-[-10%] bottom-[-30%] scale-125 pointer-events-none">
                     <Sparkline data={skTrend || []} color="#34d399" />
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
                 <CardTitle>Status Import Data</CardTitle>
             </CardHeader>
             <CardContent>
                 {convexStats?.lastEmisSync ? (() => {
                     try {
                         const syncData = JSON.parse(convexStats.lastEmisSync);
                         const date = new Date(syncData.timestamp).toLocaleString('id-ID', {
                             day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                         });
                         return (
                             <>
                                 <div className="flex items-center gap-2 mb-4">
                                     <CheckCircle className="h-5 w-5 text-green-500"/>
                                     <span className="text-sm font-medium">Terakhir sinkronisasi: {date}</span>
                                 </div>
                                 <div className="rounded-md bg-muted p-4">
                                     <p className="text-xs text-muted-foreground">
                                         Data sinkronisasi mencakup {syncData.schoolCount} Sekolah. {syncData.failureCount} baris gagal impor data.
                                     </p>
                                 </div>
                             </>
                         );
                     } catch (e) {
                         return <p className="text-sm text-muted-foreground">Data sinkronisasi tidak valid.</p>;
                     }
                 })() : (
                     <p className="text-sm text-muted-foreground">Belum ada data sinkronisasi EMIS.</p>
                 )}
             </CardContent>
          </Card>
      </div>
    </div>
  )
}

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
