import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

  // Sparkline Component
  const Sparkline = ({ data, color }: { data: any[], color: string }) => {
    if (!data || data.length === 0) return null
    return (
      <div className="flex items-end h-8 gap-0.5">
          {data.map((d, i) => (
              <div key={i} className="w-1 bg-current opacity-20 rounded-t" 
                   style={{ height: `${Math.min((d.count / (Math.max(...data.map(i=>i.count)) || 1)) * 100, 100)}%`, color }} 
              />
          ))}
      </div>
    )
  }
import { School, Users, FileText, CheckCircle, Clock, AlertOctagon, BarChart3 } from "lucide-react"
import { useQuery } from "convex/react"
import { api } from "../../../../convex/_generated/api"
import { useNavigate } from "react-router-dom"
import { DashboardCharts } from "./DashboardCharts"
import { ResponsiveContainer, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Cell } from 'recharts'

export default function DashboardOperator() {
  const navigate = useNavigate()
  const userStr = localStorage.getItem("user")
  const user = userStr ? JSON.parse(userStr) : null

  // Fetch Stats (Now includes trends & breakdown)
  const stats = useQuery(api.dashboard.getSchoolStats, user?.email ? { email: user.email } : "skip")
  
  // Fetch SK Trend specifically (re-using the query from Admin Dash)
  const skTrend = useQuery(api.dashboard.getSkTrendByMonth, { 
    months: 6,
    unitKerja: user?.unitKerja || user?.unit 
  })



  // Teacher Growth Logic
  const currentMonthTeacherCount = stats?.teacherTrend?.[5]?.count || 0
  const previousMonthTeacherCount = stats?.teacherTrend?.[4]?.count || 0
  const teacherGrowth = currentMonthTeacherCount - previousMonthTeacherCount
  const teacherGrowthLabel = teacherGrowth > 0 ? `+${teacherGrowth} bln ini` : "Stabil"

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard Sekolah</h1>
        <p className="text-muted-foreground">
           Selamat datang, Operator <span className="font-semibold text-foreground">{user?.unitKerja || user?.unit || "Sekolah"}</span>.
        </p>
      </div>

      {stats === undefined ? (
        <div className="grid gap-4 md:grid-cols-4">
            {[1,2,3,4].map(i => <div key={i} className="h-32 rounded-lg bg-gray-100 animate-pulse" />)}
        </div>
      ) : (stats as any).error ? (
         <div className="p-4 bg-yellow-50 text-yellow-800 rounded-lg">Data statistik tidak tersedia.</div>
      ) : (
        <>
        {/* OVERVIEW CARDS */}
        {/* OVERVIEW CARDS */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          
          {/* 1. TOTAL GURU (With Sparkline) */}
          <Card className="border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 relative overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between space-x-4">
                  <div className="flex flex-col space-y-1 z-10">
                      <span className="text-sm font-medium text-slate-500">Total Guru</span>
                      <span className="text-3xl font-extrabold text-slate-900">{stats.teachers}</span>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-full z-10">
                      <Users className="h-6 w-6 text-emerald-600" />
                  </div>
              </div>
              <div className="mt-4 flex items-end justify-between">
                  <div className="flex items-center space-x-2 text-xs">
                     {teacherGrowth > 0 ? (
                         <span className="flex items-center text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md font-medium">
                             {teacherGrowthLabel}
                         </span>
                     ) : (
                         <span className="text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md text-xs">Stabil</span>
                     )}
                  </div>
                  <div className="absolute right-0 bottom-0 opacity-20 transform translate-y-2 scale-110">
                     <Sparkline data={stats?.teacherTrend || []} color="#059669" />
                  </div>
              </div>
            </CardContent>
          </Card>
          
          {/* 2. TOTAL SISWA */}
          <Card className="border-slate-200 shadow-sm hover:shadow-md transition-all duration-200">
            <CardContent className="p-6">
               <div className="flex items-center justify-between space-x-4">
                  <div className="flex flex-col space-y-1">
                      <span className="text-sm font-medium text-slate-500">Total Siswa</span>
                      <span className="text-3xl font-extrabold text-slate-900">{stats.students}</span>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-full">
                      <School className="h-6 w-6 text-blue-600" />
                  </div>
              </div>
              <div className="mt-4 flex items-center text-xs">
                  <span className="text-slate-400">Terdaftar di Simpatika</span>
              </div>
            </CardContent>
          </Card>

          {/* 3. SK TERBIT (With Sparkline) */}
          <Card className="border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden relative">
            <CardContent className="p-6">
               <div className="flex items-center justify-between space-x-4">
                  <div className="flex flex-col space-y-1 z-10">
                      <span className="text-sm font-medium text-slate-500">SK Terbit</span>
                      <span className="text-3xl font-extrabold text-slate-900">{stats.skApproved}</span>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-full z-10">
                      <CheckCircle className="h-6 w-6 text-purple-600" />
                  </div>
               </div>
               <div className="mt-4 flex justify-between items-end">
                  <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md font-medium">
                      Selesai Diproses
                  </span>
                  <div className="opacity-80 -mr-2">
                       <Sparkline data={skTrend || []} color="#9333ea" />
                  </div>
               </div>
            </CardContent>
          </Card>

          {/* 4. DRAFT SK */}
          <Card className="border-slate-200 shadow-sm hover:shadow-md transition-all duration-200">
            <CardContent className="p-6">
               <div className="flex items-center justify-between space-x-4">
                  <div className="flex flex-col space-y-1">
                      <span className="text-sm font-medium text-slate-500">Draft SK</span>
                      <span className="text-3xl font-extrabold text-slate-900">{stats.skDrafts}</span>
                  </div>
                  <div className="p-3 bg-yellow-50 rounded-full">
                      <Clock className="h-6 w-6 text-yellow-600" />
                  </div>
               </div>
               <div className="mt-4 flex items-center text-xs">
                   <span className="text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-md font-medium">Menunggu Pengajuan</span>
               </div>
            </CardContent>
          </Card>
        </div>

        {/* 📊 ATTENDANCE SECTION - NEW */}
        <div className="grid gap-6 md:grid-cols-3">
            {/* Today's Attendance % */}
            <Card className="md:col-span-1 border-none shadow-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white overflow-hidden relative rounded-2xl">
                <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[120%] bg-white/20 blur-3xl rounded-full pointer-events-none mix-blend-overlay" />
                <CardContent className="p-6 relative z-10 flex flex-col justify-between h-full min-h-[160px]">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-emerald-50/80 text-sm font-medium">Kehadiran Hari Ini</p>
                            <h3 className="text-5xl font-black mt-1 tracking-tighter">{(stats as any).attendance?.todayPercentage || 0}%</h3>
                        </div>
                        <div className="p-2.5 bg-white/20 backdrop-blur-md rounded-xl">
                            <CheckCircle className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                        <span className="text-xs bg-emerald-900/30 px-3 py-1.5 rounded-lg border border-white/20">
                            {(stats as any).attendance?.todayCount || 0} Siswa Hadir
                        </span>
                        <span className="text-[10px] font-bold opacity-60 uppercase tracking-widest">{new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                    </div>
                </CardContent>
            </Card>

            {/* Attendance Trend Chart */}
            <Card className="md:col-span-2 border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm md:text-base font-bold flex items-center gap-2">
                        <div className="w-1.5 h-4 bg-emerald-500 rounded-full"></div>
                        Trend Kehadiran (7 Hari Terakhir)
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0 h-[100px] w-full mt-2">
                    {(stats as any).attendance?.trend ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={(stats as any).attendance.trend} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorAttend" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <Tooltip 
                                    contentStyle={{ fontSize: '10px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    cursor={{ stroke: '#10b981', strokeWidth: 1 }}
                                />
                                <Area 
                                    type="monotone" 
                                    dataKey="count" 
                                    stroke="#10b981" 
                                    strokeWidth={3}
                                    fillOpacity={1} 
                                    fill="url(#colorAttend)" 
                                />
                                <XAxis dataKey="date" hide />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-full text-xs text-slate-300 italic">Memuat data trend...</div>
                    )}
                </CardContent>
            </Card>
        </div>

        {/* 📋 PROACTIVE ANALYTICS - NEW */}
        <div className="grid gap-6 md:grid-cols-2">
            {/* Top Absent Students */}
            <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3 border-b border-slate-50">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <AlertOctagon className="w-4 h-4 text-red-500" /> Top 5 Siswa Sering Tidak Hadir (Bulan Ini)
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                    <div className="space-y-3">
                        {(stats as any).attendance?.topAbsent?.length > 0 ? (
                            (stats as any).attendance.topAbsent.map((s: any, i: number) => (
                                <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center font-bold text-xs">
                                            {i + 1}
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-slate-800">{s.name}</p>
                                            <div className="flex gap-2 mt-0.5">
                                                {Object.entries(s.types).map(([type, count]) => (
                                                    <span key={type} className="text-[9px] uppercase font-bold text-slate-400">
                                                        {type}: {count as number}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <Badge variant="outline" className="text-red-600 border-red-100 bg-red-50">
                                            {s.count} Hari
                                        </Badge>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-slate-400 text-sm py-4 italic">Belum ada data ketidakhadiran bulan ini.</p>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Subject Performance */}
            <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3 border-b border-slate-50">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-emerald-500" /> Performa Kehadiran Mapel (Terendah)
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 h-[220px]">
                    {(stats as any).attendance?.subjectStats?.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={(stats as any).attendance.subjectStats} layout="vertical" margin={{ left: 10, right: 30, top: 0, bottom: 0 }}>
                                <XAxis type="number" hide domain={[0, 100]} />
                                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                <Tooltip 
                                    cursor={{ fill: 'transparent' }}
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="bg-white p-2 border border-slate-100 shadow-lg rounded-lg text-xs">
                                                    <p className="font-bold text-slate-800">{payload[0].payload.name}</p>
                                                    <p className="text-emerald-600">{payload[0].value}% Hadir</p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Bar dataKey="percentage" radius={[0, 4, 4, 0]} barSize={12}>
                                    {(stats as any).attendance.subjectStats.map((entry: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={entry.percentage < 70 ? '#ef4444' : '#10b981'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-center text-slate-400 text-sm py-4 italic">Memuat data performa mapel...</p>
                    )}
                </CardContent>
            </Card>
        </div>

        {/* CHARTS SECTION */}
        <DashboardCharts data={{
            status: stats.status || [],
            certification: stats.certification || [],
            units: [], // Not relevant for single school
            kecamatan: [] // Not relevant for single school
        }} />

        {/* SK MONITORING SECTION (Semantic Borders) */}
        <div className="mt-8 space-y-4">
             <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold tracking-tight text-slate-800">Monitoring Status SK</h2>
              <button onClick={() => navigate('/dashboard/sk/history')} className="text-sm text-blue-600 hover:underline">Lihat Riwayat &rarr;</button>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <Card className="border-l-4 border-l-blue-500 shadow-sm">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                     <p className="text-sm text-slate-500 font-medium">Total Diajukan</p>
                     <p className="text-2xl font-bold text-slate-900">{stats.totalSk}</p>
                  </div>
                  <div className="bg-blue-50 p-2 rounded-full"><FileText className="h-5 w-5 text-blue-600" /></div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-yellow-500 shadow-sm bg-yellow-50/10">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                     <p className="text-sm text-slate-500 font-medium">Pending</p>
                     <p className="text-2xl font-bold text-yellow-600">{stats.skDrafts}</p>
                  </div>
                  <div className="bg-yellow-100 p-2 rounded-full"><Clock className="h-5 w-5 text-yellow-600" /></div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-green-500 shadow-sm bg-green-50/10">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                     <p className="text-sm text-slate-500 font-medium">Disetujui</p>
                     <p className="text-2xl font-bold text-green-600">{stats.skApproved}</p>
                  </div>
                  <div className="bg-green-100 p-2 rounded-full"><CheckCircle className="h-5 w-5 text-green-600" /></div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-red-500 shadow-sm bg-red-50/10">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                     <p className="text-sm text-slate-500 font-medium">Ditolak</p>
                     <p className="text-2xl font-bold text-red-600">{stats.skRejected}</p>
                  </div>
                  <div className="bg-red-100 p-2 rounded-full"><AlertOctagon className="h-5 w-5 text-red-600" /></div>
                </CardContent>
              </Card>
            </div>
        </div>

        {/* SK TREND CHART */}
        {skTrend && skTrend.length > 0 && (
             <Card className="mt-6">
                <CardHeader><CardTitle>Trend Pengajuan SK (6 Bulan)</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-[250px] w-full">
                     <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                         <AreaChart data={skTrend} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                             <defs>
                                 <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                     <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                                     <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                 </linearGradient>
                             </defs>
                             <CartesianGrid strokeDasharray="3 3" vertical={false} />
                             <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 12}} dy={10} />
                             <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                             <Tooltip contentStyle={{borderRadius: '8px'}} />
                             <Area type="monotone" dataKey="count" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCount)" />
                         </AreaChart>
                     </ResponsiveContainer>
                  </div>
                </CardContent>
             </Card>
        )}
        </>
      )}

      {/* QUICK ACTIONS */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-3">Akses Cepat</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
                { label: "Data Guru", description: "Kelola data pengajar", icon: Users, path: "/dashboard/master/teachers", color: "bg-blue-100 text-blue-600", border: "hover:border-blue-200" },
                { label: "Data Siswa", description: "Database siswa aktif", icon: School, path: "/dashboard/master/students", color: "bg-orange-100 text-orange-600", border: "hover:border-orange-200" },
                { label: "Ajukan SK Kolektif", description: "Buat pengajuan baru", icon: FileText, path: "/dashboard/sk/submission", color: "bg-green-100 text-green-600", border: "hover:border-green-200" },
                { label: "Profil Sekolah", description: "Update informasi lembaga", icon: School, path: "/dashboard/school/profile", color: "bg-purple-100 text-purple-600", border: "hover:border-purple-200" },
            ].map((action, i) => (
                <Card 
                    key={i} 
                    className={`cursor-pointer transition-all duration-200 hover:shadow-md border border-slate-200 group ${action.border}`} 
                    onClick={() => navigate(action.path)}
                >
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${action.color} group-hover:scale-105 transition-transform`}>
                            <action.icon className="h-6 w-6" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-slate-800 text-sm">{action.label}</h4>
                            <p className="text-xs text-slate-500 mt-0.5">{action.description}</p>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
      </div>


        {/* 📋 ACTIVITY HISTORY SECTION (Added for consistency) */}
        <div className="grid gap-6 md:grid-cols-2 mt-8">
            <Card className="col-span-1 shadow-sm border-slate-200">
                <CardHeader className="border-b border-slate-100 pb-3">
                    <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <div className="w-1.5 h-5 bg-blue-500 rounded-full"></div>
                        Riwayat Aktivitas (Sekolah)
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                    <div className="space-y-4">
                        {stats?.recentLogs && stats.recentLogs.length > 0 ? (
                            stats.recentLogs.map((log: any, i: number) => (
                                <div key={i} className="flex items-start gap-4 border-b border-slate-100 pb-3 last:border-0 last:pb-0 hover:bg-slate-50 transition-colors p-1">
                                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 mt-1.5 shadow-sm"/>
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold text-slate-800">{log.action}</p>
                                        <p className="text-xs text-slate-500">{log.details}</p>
                                    </div>
                                    <div className="text-[9px] font-bold text-slate-400">
                                        {new Date(log.timestamp).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-slate-400 text-center py-6">Belum ada aktivitas baru.</p>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card className="col-span-1 shadow-sm border-slate-200">
                <CardHeader className="border-b border-slate-100 pb-3">
                    <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <div className="w-1.5 h-5 bg-amber-500 rounded-full"></div>
                        Status Import Data
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                    {stats?.lastEmisSync ? (() => {
                        try {
                            const syncData = JSON.parse(stats.lastEmisSync);
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
                        <p className="text-sm text-slate-400 text-center py-6">Belum ada data sinkronisasi EMIS.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    </div>
  )
}
