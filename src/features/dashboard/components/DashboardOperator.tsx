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
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          
          {/* 1. TOTAL GURU (With Sparkline) */}
          <Card className="border-0 shadow-xl hover:-translate-y-1 transition-all duration-300 bg-gradient-to-br from-emerald-600 to-teal-800 text-white overflow-hidden relative rounded-2xl md:col-span-1 lg:col-span-1">
            <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[120%] bg-white/20 blur-3xl rounded-full pointer-events-none mix-blend-overlay" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[60%] bg-emerald-400/30 blur-2xl rounded-full pointer-events-none mix-blend-overlay" />
            <CardContent className="p-6 relative z-10 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between space-x-4">
                  <div className="flex flex-col space-y-1">
                      <span className="text-emerald-50/80 font-medium text-sm tracking-wide">Total Guru</span>
                      <span className="text-4xl font-extrabold tracking-tight drop-shadow-md">{stats.teachers}</span>
                  </div>
                  <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl border border-white/20 shadow-inner">
                      <Users className="h-7 w-7 text-white drop-shadow-sm" />
                  </div>
              </div>
              <div className="mt-6 flex items-end justify-between">
                  <div className="flex items-center space-x-2 text-xs">
                     {teacherGrowth > 0 ? (
                         <span className="bg-emerald-900/40 text-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-400/30 backdrop-blur-sm shadow-sm font-semibold tracking-wide">
                             {teacherGrowthLabel}
                         </span>
                     ) : (
                         <span className="bg-emerald-900/40 text-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-400/30 backdrop-blur-sm shadow-sm font-semibold tracking-wide text-xs">Stabil</span>
                     )}
                  </div>
                  <div className="absolute right-[-5%] bottom-[5%] opacity-40 transform translate-y-2 scale-110 pointer-events-none w-20">
                     <Sparkline data={stats?.teacherTrend || []} color="#a7f3d0" />
                  </div>
              </div>
            </CardContent>
          </Card>
          
          {/* 2. TOTAL SISWA */}
          <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 transition-all duration-300 bg-white/70 backdrop-blur-xl relative overflow-hidden rounded-2xl">
            <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-gradient-to-br from-blue-100/50 to-transparent blur-2xl pointer-events-none" />
            <CardContent className="p-6 flex flex-col justify-between h-full">
               <div className="flex items-center justify-between space-x-4 relative z-10">
                  <div className="flex flex-col space-y-1">
                      <span className="text-sm font-semibold text-slate-500 tracking-wide">Total Siswa</span>
                      <span className="text-4xl font-extrabold text-blue-900 tracking-tight">{stats.students}</span>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-2xl border border-blue-200/50 shadow-sm">
                      <School className="h-7 w-7 text-blue-600" />
                  </div>
              </div>
              <div className="mt-6 flex items-center text-xs relative z-10">
                  <span className="text-blue-700 bg-blue-50 border border-blue-200/80 shadow-sm px-3 py-1.5 rounded-lg font-semibold inline-flex">Terdaftar Aktif</span>
              </div>
            </CardContent>
          </Card>

          {/* 3. SK TERBIT (With Sparkline) */}
          <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 transition-all duration-300 bg-white/70 backdrop-blur-xl overflow-hidden relative rounded-2xl">
            <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-gradient-to-br from-purple-100/50 to-transparent blur-2xl pointer-events-none" />
            <CardContent className="p-6 flex flex-col justify-between h-full">
               <div className="flex items-center justify-between space-x-4 relative z-10">
                  <div className="flex flex-col space-y-1">
                      <span className="text-sm font-semibold text-slate-500 tracking-wide">SK Terbit</span>
                      <span className="text-4xl font-extrabold text-purple-900 tracking-tight">{stats.skApproved}</span>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-2xl border border-purple-200/50 shadow-sm">
                      <CheckCircle className="h-7 w-7 text-purple-600" />
                  </div>
               </div>
               <div className="mt-6 flex justify-between items-end relative z-10">
                  <span className="flex items-center text-purple-700 bg-purple-100/80 px-3 py-1.5 rounded-lg font-bold border border-purple-200/80 shadow-sm text-xs">
                      Selesai Diproses
                  </span>
                  <div className="absolute right-[-10%] bottom-[-10%] opacity-40 transform translate-y-2 scale-110 pointer-events-none w-20">
                       <Sparkline data={skTrend || []} color="#9333ea" />
                  </div>
               </div>
            </CardContent>
          </Card>

          {/* 4. DRAFT SK */}
          <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 transition-all duration-300 bg-white/70 backdrop-blur-xl relative overflow-hidden rounded-2xl">
            <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-gradient-to-br from-amber-100/50 to-transparent blur-2xl pointer-events-none" />
            <CardContent className="p-6 flex flex-col justify-between h-full">
               <div className="flex items-center justify-between space-x-4 relative z-10">
                  <div className="flex flex-col space-y-1">
                      <span className="text-sm font-semibold text-slate-500 tracking-wide">Draft SK</span>
                      <span className="text-4xl font-extrabold text-amber-900 tracking-tight">{stats.skDrafts}</span>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-2xl border border-amber-200/50 shadow-sm">
                      <Clock className="h-7 w-7 text-amber-600" />
                  </div>
               </div>
               <div className="mt-6 flex items-center text-xs relative z-10">
                   <span className="text-amber-700 bg-amber-100/80 border border-amber-200/80 shadow-sm px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" /> Menunggu Pengajuan
                   </span>
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
      <div className="mt-8 mb-6">
        <h3 className="text-xl font-bold tracking-tight text-slate-800 mb-4 flex items-center gap-2">
            <div className="w-2 h-6 bg-purple-500 rounded-full"></div>
            Akses Cepat
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
                { label: "Data Guru", description: "Kelola data pengajar", icon: Users, path: "/dashboard/master/teachers", color: "bg-blue-100/80 text-blue-600 border-blue-200/50", gradient: "from-blue-50/50 to-white" },
                { label: "Data Siswa", description: "Database siswa aktif", icon: School, path: "/dashboard/master/students", color: "bg-orange-100/80 text-orange-600 border-orange-200/50", gradient: "from-orange-50/50 to-white" },
                { label: "Ajukan SK Kolektif", description: "Buat pengajuan baru", icon: FileText, path: "/dashboard/sk/new", color: "bg-emerald-100/80 text-emerald-600 border-emerald-200/50", gradient: "from-emerald-50/50 to-white" },
                { label: "Profil Sekolah", description: "Update informasi lembaga", icon: School, path: "/dashboard/school/profile", color: "bg-purple-100/80 text-purple-600 border-purple-200/50", gradient: "from-purple-50/50 to-white" },
            ].map((action, i) => (
                <Card 
                    key={i} 
                    className={`cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border-0 shadow-sm bg-gradient-to-br ${action.gradient} backdrop-blur-xl rounded-2xl overflow-hidden group`} 
                    onClick={() => navigate(action.path)}
                >
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className={`p-3.5 rounded-2xl shadow-inner border transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 ${action.color}`}>
                            <action.icon className="h-6 w-6 drop-shadow-sm" />
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-800 text-sm tracking-wide">{action.label}</h4>
                            <p className="text-xs font-medium text-slate-500 mt-1">{action.description}</p>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
      </div>
    </div>
  )
}
