```
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { School, Users, FileText, CheckCircle, AlertOctagon, Clock } from "lucide-react"
import { useEffect, useState } from "react"
import React from "react"
import { Button } from "@/components/ui/button"

// Convex real-time query
import { useQuery } from "convex/react"
import { api as convexApi } from "../../../convex/_generated/api"

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [alerts] = useState<any[]>([])
  
  // 🔥 REAL-TIME CONVEX QUERY - Auto-updates!
  const convexStats = useQuery(convexApi.dashboard.getStats)
  
  // 📊 SK MONITORING QUERIES
  const userStr = localStorage.getItem("user")
  const currentUser = userStr ? JSON.parse(userStr) : null
  const operatorSchool = currentUser?.role === "operator" ? currentUser?.unitKerja : undefined
  
  const skStats = useQuery(convexApi.dashboard.getSkStatistics, { 
    unitKerja: operatorSchool 
  })
  const skTrend = useQuery(convexApi.dashboard.getSkTrendByMonth, { 
    months: 6,
    unitKerja: operatorSchool 
  })

  useEffect(() => {
    // Load User from localStorage
    const u = localStorage.getItem("user")
    if (u) setUser(JSON.parse(u))
  }, [])


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
              {stat.desc && (
                  <p className="text-xs text-muted-foreground">{stat.desc}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

       {/* 📊 SK MONITORING SECTION */}
       {skStats && (
         <React.Fragment>
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
                   <div className="flex items-end justify-around h-full gap-2 pb-8">
                     {skTrend.map((data, idx) => {
                       const maxCount = Math.max(...skTrend.map(d => d.count))
                       const height = maxCount > 0 ? (data.count / maxCount) * 100 : 0
                       
                       return (
                         <div key={idx} className="flex flex-col items-center flex-1">
                           <div className="text-xs font-semibold mb-1">{data.count}</div>
                           <div 
                             className="w-full bg-blue-500 hover:bg-blue-600 transition-all rounded-t-md" 
                             style={{ height: `${height}%`, minHeight: data.count > 0 ? '20px' : '0px' }}
                           />
                           <div className="text-xs text-muted-foreground mt-2 whitespace-nowrap">
                             {data.month}
                           </div>
                         </div>
                       )
                     })}
                   </div>
                 </div>
               </CardContent>
             </Card>
           )}
         </React.Fragment>
       )}

       {/* 📋 ACTIVITY & STATUS SECTION - Moved to bottom */}
       <div className="grid gap-4 md:grid-cols-2 mt-6">
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
