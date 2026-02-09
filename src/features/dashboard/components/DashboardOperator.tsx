import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { School, Users, FileText, CheckCircle, Clock, AlertOctagon } from "lucide-react"
import { useQuery } from "convex/react"
import { api } from "../../../../convex/_generated/api"
import { useNavigate } from "react-router-dom"
import { DashboardCharts } from "./DashboardCharts"
import { ResponsiveContainer, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'

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

  // Sparkline Component
  const Sparkline = ({ data, color }: { data: any[], color: string }) => {
    if (!data || data.length === 0) return null
    return (
      <div className="h-[40px] w-[80px]">
          <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                  <Line type="monotone" dataKey="count" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
          </ResponsiveContainer>
      </div>
    )
  }

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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Guru</CardTitle>
              <Users className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-end">
                <div>
                   <div className="text-2xl font-extrabold">{stats.teachers}</div>
                   <p className="text-xs text-muted-foreground mt-1">
                      {teacherGrowthLabel} <span className="text-green-500 font-medium">Active</span>
                   </p>
                </div>
                <div className="opacity-50 mb-1">
                   <Sparkline data={stats?.teacherTrend || []} color="#22c55e" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Siswa</CardTitle>
              <School className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold">{stats.students}</div>
              <p className="text-xs text-muted-foreground mt-1">Terdaftar di Simpatika</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">SK Terbit</CardTitle>
              <CheckCircle className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
               <div className="flex justify-between items-end">
                <div>
                  <div className="text-2xl font-extrabold">{stats.skApproved}</div>
                  <p className="text-xs text-muted-foreground mt-1">SK Telah Diproses</p>
                </div>
                <div className="opacity-50 mb-1">
                   <Sparkline data={skTrend || []} color="#a855f7" />
                </div>
               </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Draft SK</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold">{stats.skDrafts}</div>
              <p className="text-xs text-muted-foreground mt-1">Menunggu pengajuan</p>
            </CardContent>
          </Card>
        </div>

        {/* CHARTS SECTION */}
        <DashboardCharts data={{
            status: stats.status,
            certification: stats.certification,
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
                     <ResponsiveContainer width="100%" height="100%">
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
      <div>
        <h3 className="text-lg font-semibold mb-3">Akses Cepat</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
                { label: "Data Guru", icon: Users, path: "/dashboard/master/teachers", color: "bg-blue-100 text-blue-700" },
                { label: "Data Siswa", icon: School, path: "/dashboard/master/students", color: "bg-orange-100 text-orange-700" },
                { label: "Ajukan SK Kolektif", icon: FileText, path: "/dashboard/sk/submission", color: "bg-green-100 text-green-700" },
                { label: "Profil Sekolah", icon: School, path: "/dashboard/school/profile", color: "bg-purple-100 text-purple-700" },
            ].map((action, i) => (
                <Card key={i} className="cursor-pointer hover:shadow-md transition-all border-l-4 border-l-transparent hover:border-l-primary" onClick={() => navigate(action.path)}>
                    <CardContent className="flex flex-col items-center justify-center p-6 gap-3 text-center">
                        <div className={`p-3 rounded-full ${action.color}`}><action.icon className="h-6 w-6" /></div>
                        <span className="font-medium text-sm">{action.label}</span>
                    </CardContent>
                </Card>
            ))}
        </div>
      </div>
    </div>
  )
}
