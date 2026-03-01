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
import { useQuery, usePaginatedQuery } from "convex/react"
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
  // 🟢 CONSOLIDATED FIX: Logs are now part of getStats for maximum stability
  const logs = convexStats?.recentLogs || []
  const logsStatus = convexStats ? "Exhausted" : "LoadingFirstPage"
  const loadMoreLogs = () => {}

  const [logFilter, setLogFilter] = useState<"all" | "sk">("all")
  
  // Filter logs for SK submissions
  const filteredLogs = logs?.filter(log => {
    if (logFilter === "all") return true;
    return ["Submit SK", "Request SK Revision", "Approve SK Revision", "Reject SK Revision"].includes(log.action);
  });
  
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
           {convexStats && (
             <div className="flex items-center gap-2 px-5 py-2.5 bg-white/70 backdrop-blur-xl border border-emerald-100/80 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
               <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></span>
                </span>
               <span className="text-xs font-bold tracking-widest text-emerald-700">SYSTEM LIVE</span>
             </div>
           )}
         </div>
      </div>

      {/* OVERVIEW STATS (GRID 4) */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 relative z-10">
        
        {/* 1. TOTAL SEKOLAH */}
        <Card className="border-0 shadow-xl hover:-translate-y-1 transition-all duration-300 bg-gradient-to-br from-emerald-600 to-teal-800 text-white overflow-hidden relative rounded-2xl md:col-span-1 lg:col-span-1">
          <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[120%] bg-white/20 blur-3xl rounded-full pointer-events-none mix-blend-overlay" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[60%] bg-emerald-400/30 blur-2xl rounded-full pointer-events-none mix-blend-overlay" />
          <CardContent className="p-6 relative z-10">
            <div className="flex items-center justify-between space-x-4">
                <div className="flex flex-col space-y-1 block">
                    <span className="text-emerald-50/80 font-medium text-sm tracking-wide">Total Sekolah</span>
                    <span className="text-4xl font-extrabold tracking-tight drop-shadow-md">{totalSchools}</span>
                </div>
                <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl border border-white/20 shadow-inner">
                    <School className="h-7 w-7 text-white drop-shadow-sm" />
                </div>
            </div>
            <div className="mt-6 flex items-center text-xs justify-between">
                <span className="bg-emerald-900/40 text-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-400/30 backdrop-blur-sm shadow-sm font-semibold tracking-wide">
                    Terverifikasi
                </span>
                <span className="text-emerald-50/70 font-medium">Semester Genap</span>
            </div>
          </CardContent>
        </Card>

        {/* 2. TOTAL GURU (With Sparkline) */}
        <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 transition-all duration-300 bg-white/70 backdrop-blur-xl overflow-hidden relative rounded-2xl">
          <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-gradient-to-br from-emerald-100/50 to-transparent blur-2xl pointer-events-none" />
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
            
            <div className="mt-6 flex items-end justify-between relative z-10">
                <div className="flex items-center space-x-2 text-xs">
                   {teacherGrowth > 0 ? (
                       <span className="flex items-center text-emerald-700 bg-emerald-100/80 px-3 py-1.5 rounded-lg font-bold border border-emerald-200/80 shadow-sm">
                           <Users className="h-3 w-3 mr-1.5" /> {teacherGrowthLabel}
                       </span>
                   ) : (
                       <span className="text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 shadow-sm">Data Stabil</span>
                   )}
                </div>
                <div className="absolute right-[-10%] bottom-[-10%] opacity-40 transform translate-y-2 scale-110 pointer-events-none">
                   <Sparkline data={analyticsStats?.teacherTrend || []} color="#059669" />
                </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. TOTAL SISWA */}
        <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 transition-all duration-300 bg-white/70 backdrop-blur-xl relative overflow-hidden rounded-2xl">
          <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-gradient-to-br from-amber-100/50 to-transparent blur-2xl pointer-events-none" />
          <CardContent className="p-6">
             <div className="flex items-center justify-between space-x-4 relative z-10">
                <div className="flex flex-col space-y-1">
                    <span className="text-sm font-semibold text-slate-500 tracking-wide">Total Siswa</span>
                    {stats.studentCount > 0 ? (
                        <span className="text-4xl font-extrabold text-amber-900 tracking-tight">{stats.studentCount}</span>
                    ) : (
                        <span className="text-3xl font-extrabold text-slate-300">--</span>
                    )}
                </div>
                <div className="p-3 bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-2xl border border-amber-200/50 shadow-sm">
                    <Users className="h-7 w-7 text-amber-500" />
                </div>
            </div>
            <div className="mt-6 relative z-10">
                 {stats.studentCount === 0 ? (
                     <button 
                         onClick={() => navigate("/dashboard/master/students?action=import")}
                         className="text-xs bg-gradient-to-r from-amber-400 to-amber-500 text-white font-bold px-4 py-2.5 rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 hover:from-amber-500 hover:to-orange-500 transition-all w-full border border-amber-300 flex items-center justify-center gap-2"
                     >
                         <span>+ Import Data Siswa</span>
                     </button>
                 ) : (
                     <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200/80 shadow-sm px-3 py-1.5 rounded-lg inline-flex">Data SIBOS Pintar</span>
                 )}
            </div>
          </CardContent>
        </Card>

        {/* 4. TOTAL SK (With Sparkline) */}
        <Card className="border-0 shadow-xl hover:-translate-y-1 transition-all duration-300 bg-gradient-to-br from-slate-800 to-slate-950 text-white overflow-hidden relative rounded-2xl">
          <CardContent className="p-6 h-full flex flex-col justify-between">
            <div className="absolute bottom-[-30%] left-[-20%] w-[90%] h-[150%] bg-emerald-500/20 blur-[50px] rounded-full pointer-events-none mix-blend-overlay" />
            <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[60%] bg-blue-500/20 blur-2xl rounded-full pointer-events-none mix-blend-overlay" />
            <div className="flex items-center justify-between space-x-4 relative z-10">
                <div className="flex flex-col space-y-1">
                    <span className="text-sm font-medium text-slate-300 tracking-wide">Total SK Terbit</span>
                    <span className="text-4xl font-extrabold tracking-tight drop-shadow-md">{skStats?.total || 0}</span>
                </div>
                <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 shadow-inner">
                    <FileText className="h-7 w-7 text-emerald-400 drop-shadow-sm" />
                </div>
            </div>
            <div className="mt-6 flex justify-between items-end relative z-10">
                <span className="text-xs text-emerald-100 bg-emerald-500/30 border border-emerald-400/30 px-3 py-1.5 rounded-lg font-semibold tracking-wide backdrop-blur-sm shadow-sm inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> {skStats?.approved || 0} Selesai
                </span>
                <div className="opacity-50 -mr-4 absolute right-[-5%] bottom-[-20%] scale-125 pointer-events-none">
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
         <div className="mt-8 space-y-6">
           <div className="flex items-center justify-between">
             <h2 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
                 <div className="w-2 h-6 bg-emerald-500 rounded-full"></div>
                 Monitoring Status SK
             </h2>
             <button className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 hover:underline transition-colors flex items-center gap-1">
                 Lihat Semua Pengajuan <span className="font-sans">&rarr;</span>
             </button>
           </div>

           <div className="grid gap-5 md:grid-cols-4">
             {/* Total Applied */}
             <Card className="border-0 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-blue-50/50 to-white backdrop-blur-sm relative overflow-hidden rounded-2xl">
               <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
               <CardContent className="p-5 flex items-center justify-between">
                 <div>
                    <p className="text-sm text-slate-500 font-medium tracking-wide">Total Pengajuan</p>
                    <p className="text-3xl font-extrabold text-slate-800 mt-1">{skStats.total}</p>
                 </div>
                 <div className="bg-blue-100/80 p-3 rounded-2xl shadow-inner border border-blue-200/50">
                    <FileText className="h-6 w-6 text-blue-600 drop-shadow-sm" />
                 </div>
               </CardContent>
             </Card>

             {/* Pending */}
             <Card className="border-0 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-amber-50/50 to-white backdrop-blur-sm relative overflow-hidden rounded-2xl">
               <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
               <CardContent className="p-5 flex items-center justify-between">
                 <div>
                    <p className="text-sm text-amber-700/70 font-medium tracking-wide">Menunggu Review</p>
                    <p className="text-3xl font-extrabold text-amber-600 mt-1">{skStats.pending}</p>
                 </div>
                 <div className="bg-amber-100/80 p-3 rounded-2xl shadow-inner border border-amber-200/50">
                    <Clock className="h-6 w-6 text-amber-600 drop-shadow-sm" />
                 </div>
               </CardContent>
             </Card>

             {/* Approved */}
             <Card className="border-0 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-emerald-50/50 to-white backdrop-blur-sm relative overflow-hidden rounded-2xl">
               <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
               <CardContent className="p-5 flex items-center justify-between">
                 <div>
                    <p className="text-sm text-emerald-700/70 font-medium tracking-wide">Disetujui</p>
                    <p className="text-3xl font-extrabold text-emerald-600 mt-1">{skStats.approved}</p>
                 </div>
                 <div className="bg-emerald-100/80 p-3 rounded-2xl shadow-inner border border-emerald-200/50">
                    <CheckCircle className="h-6 w-6 text-emerald-600 drop-shadow-sm" />
                 </div>
               </CardContent>
             </Card>

             {/* Rejected */}
             <Card className="border-0 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-red-50/50 to-white backdrop-blur-sm relative overflow-hidden rounded-2xl">
               <div className="absolute top-0 left-0 w-1 h-full bg-rose-500"></div>
               <CardContent className="p-5 flex items-center justify-between">
                 <div>
                    <p className="text-sm text-rose-700/70 font-medium tracking-wide">Perlu Perbaikan</p>
                    <p className="text-3xl font-extrabold text-rose-600 mt-1">{skStats.rejected}</p>
                 </div>
                 <div className="bg-rose-100/80 p-3 rounded-2xl shadow-inner border border-rose-200/50">
                    <AlertOctagon className="h-6 w-6 text-rose-600 drop-shadow-sm" />
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
       <div className="grid gap-6 md:grid-cols-2 mt-8">
          <Card className="col-span-1 shadow-sm border-slate-200/60 bg-white/60 backdrop-blur-xl rounded-2xl">
             <CardHeader className="border-b border-slate-100/60 pb-3">
                  <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-bold tracking-tight text-slate-800 flex items-center gap-2">
                          <div className="w-1.5 h-5 bg-blue-500 rounded-full"></div>
                          Riwayat Aktivitas
                      </CardTitle>
                      <div className="flex bg-slate-100 p-1 rounded-lg">
                          <button 
                              onClick={() => setLogFilter("all")}
                              className={`text-[10px] font-bold px-3 py-1 rounded-md transition-all ${logFilter === "all" ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}
                          >
                              SEMUA
                          </button>
                          <button 
                              onClick={() => setLogFilter("sk")}
                              className={`text-[10px] font-bold px-3 py-1 rounded-md transition-all ${logFilter === "sk" ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500'}`}
                          >
                              PENGAJUAN SK
                          </button>
                      </div>
                  </div>
             </CardHeader>
             <CardContent className="pt-4">
                  <div className="space-y-4">
                      {filteredLogs ? (
                          filteredLogs.length > 0 ? (
                             filteredLogs.map((log, i) => (
                                <div key={i} className="flex items-start gap-4 border-b border-slate-100/60 pb-3 last:border-0 last:pb-0 hover:bg-slate-50/50 p-2 rounded-lg transition-colors">
                                   <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 mt-1.5 shadow-[0_0_8px_rgba(16,185,129,0.5)]"/>
                                   <div className="flex-1 space-y-1">
                                       <p className="text-sm font-semibold text-slate-800 leading-tight">
                                           {logFilter === "sk" ? (log.details?.split(" - ")[0] || "Aktivitas") : (log.action || "Aktivitas")}
                                       </p>
                                       <p className="text-xs text-slate-500 leading-relaxed">
                                           {logFilter === "sk" ? (log.details?.split(" - ")[1] || log.details || "-") : (log.details || "-")}
                                       </p>
                                   </div>
                                   <div className="text-[9px] font-bold text-slate-500 bg-slate-100/80 px-2 py-1 rounded-md text-center leading-tight">
                                     <div>{new Date(log.timestamp || (log as any)._creationTime).toLocaleDateString('id-ID', {day: '2-digit', month: 'short'})}</div>
                                     <div>{new Date(log.timestamp || (log as any)._creationTime).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}</div>
                                   </div>
                                </div>
                            ))
                          ) : (
                              <p className="text-sm text-muted-foreground text-center py-6">Belum ada aktivitas hari ini.</p>
                          )
                      ) : (
                          <div className="flex justify-center items-center py-6 gap-2">
                               <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                               <p className="text-sm text-slate-400">Memuat riwayat...</p>
                          </div>
                      )}
                  </div>

                  {/* Pagination Control */}
                  {logs && logs.length > 0 && logsStatus !== "Exhausted" && (
                      <div className="pt-4 border-t border-slate-100 flex justify-center">
                          <button 
                              onClick={() => loadMoreLogs(10)}
                              disabled={logsStatus === "LoadingMore"}
                              className="text-[11px] font-bold text-slate-400 hover:text-emerald-600 transition-colors uppercase tracking-widest flex items-center gap-2 py-2"
                          >
                              {logsStatus === "LoadingMore" ? (
                                  <>
                                      <Loader2 className="h-3 w-3 animate-spin"/>
                                      Loading...
                                  </>
                              ) : (
                                  <>Muat Lebih Banyak +</>
                              )}
                          </button>
                      </div>
                  )}
             </CardContent>
          </Card>

           <Card className="col-span-1 shadow-sm border-slate-200/60 bg-white/60 backdrop-blur-xl rounded-2xl">
             <CardHeader className="border-b border-slate-100/60 pb-4">
                 <CardTitle className="text-lg font-bold tracking-tight text-slate-800 flex items-center gap-2">
                     <div className="w-1.5 h-5 bg-amber-500 rounded-full"></div>
                     Status Import Data
                 </CardTitle>
             </CardHeader>
             <CardContent className="pt-4">
                 {convexStats?.lastEmisSync ? (() => {
                     try {
                         const syncData = JSON.parse(convexStats.lastEmisSync);
                         const date = new Date(syncData.timestamp).toLocaleString('id-ID', {
                             day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                         });
                         return (
                             <>
                                 <div className="flex items-center gap-3 mb-6 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                                     <div className="bg-emerald-100 p-1.5 rounded-full">
                                         <CheckCircle className="h-5 w-5 text-emerald-600"/>
                                     </div>
                                     <div className="flex flex-col">
                                         <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wide">Sinkronisasi Berhasil</span>
                                         <span className="text-xs text-emerald-600 font-medium">{date}</span>
                                     </div>
                                 </div>
                                 <div className="grid grid-cols-2 gap-4">
                                     <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 text-center">
                                         <p className="text-2xl font-extrabold text-slate-700">{syncData.schoolCount}</p>
                                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Sekolah Dimuat</p>
                                     </div>
                                     <div className="rounded-xl bg-rose-50 border border-rose-100 p-4 text-center">
                                         <p className="text-2xl font-extrabold text-rose-600">{syncData.failureCount}</p>
                                         <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mt-1">Gagal Impor</p>
                                     </div>
                                 </div>
                             </>
                         );
                     } catch (e) {
                         return <p className="text-sm text-slate-500 italic">Data rekam jejak sinkronisasi tidak valid.</p>;
                     }
                 })() : (
                     <div className="text-center py-10">
                         <div className="inline-flex items-center justify-center p-4 bg-slate-100 rounded-full mb-3">
                            <Archive className="h-6 w-6 text-slate-400" />
                         </div>
                         <p className="text-sm font-medium text-slate-500">Belum ada riwayat sinkronisasi EMIS.</p>
                     </div>
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
