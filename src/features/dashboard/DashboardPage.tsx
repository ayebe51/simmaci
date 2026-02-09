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
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import DashboardCharts from "./components/DashboardCharts"
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

  const masterDataStats = [
    { title: "Total Sekolah", value: stats.schoolCount, icon: School, color: "text-blue-500" },
    { title: "Total Guru/PTK", value: stats.teacherCount, icon: Users, color: "text-green-500" },
    { title: "Total Siswa", value: stats.studentCount, icon: Users, color: "text-orange-500" },
  ]

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



      <div className="grid gap-4 md:grid-cols-3">
        {masterDataStats.map((stat, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>

            </CardContent>
          </Card>
        ))}
      </div>

       {/* 📊 PETA MUTU / ANALYTICS CHARTS */}
       <DashboardCharts data={analyticsStats} />

       {/* 📊 SK MONITORING SECTION */}
       {skStats && (
         <>
           <div className="mt-8">
             <h2 className="text-2xl font-bold tracking-tight mb-4">Monitoring Surat Keputusan</h2>
           </div>

           {/* SK Statistics Cards */}
           <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
             <Card>
               <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                 <CardTitle className="text-sm font-medium">Total SK</CardTitle>
                 <FileText className="h-4 w-4 text-blue-500" />
               </CardHeader>
               <CardContent>
                 <div className="text-2xl font-bold">{skStats.total}</div>
                 <p className="text-xs text-muted-foreground">
                   Semua pengajuan SK
                 </p>
               </CardContent>
             </Card>

             <Card>
               <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                 <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
                 <Clock className="h-4 w-4 text-yellow-500" />
               </CardHeader>
               <CardContent>
                 <div className="text-2xl font-bold text-yellow-600">{skStats.pending}</div>
                 <p className="text-xs text-muted-foreground">
                   Menunggu persetujuan
                 </p>
               </CardContent>
             </Card>

             <Card>
               <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                 <CardTitle className="text-sm font-medium">Disetujui</CardTitle>
                 <CheckCircle className="h-4 w-4 text-green-500" />
               </CardHeader>
               <CardContent>
                 <div className="text-2xl font-bold text-green-600">{skStats.approved}</div>
                 <p className="text-xs text-muted-foreground">
                   SK telah disetujui
                 </p>
               </CardContent>
             </Card>

             <Card>
               <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                 <CardTitle className="text-sm font-medium">Ditolak</CardTitle>
                 <AlertOctagon className="h-4 w-4 text-red-500" />
               </CardHeader>
               <CardContent>
                 <div className="text-2xl font-bold text-red-600">{skStats.rejected}</div>
                 <p className="text-xs text-muted-foreground">
                   Perlu perbaikan
                 </p>
               </CardContent>
             </Card>
           </div>

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
