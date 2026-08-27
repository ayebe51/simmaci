import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { 
  FileText, 
  Users, 
  School, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  LayoutDashboard,
  Loader2,
  Award,
  FileEdit,
  ArrowRight,
  ShieldCheck,
  Building2,
  MapPin,
  Sparkles,
  Activity,
  ChevronRight,
  GraduationCap
} from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { dashboardApi, headmasterApi } from "@/lib/api"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { DashboardCharts } from "./components/DashboardCharts"
import DashboardOperator from "./components/DashboardOperator"
import { SchoolStatisticsCards } from "./components/SchoolStatisticsCards"

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

  const [activeTab, setActiveTab] = useState<string>("sk-governance")
  const operatorSchool = user?.role === "operator" ? user?.unit : undefined

  // 🔥 REST API QUERIES
  const { data: statsData, isLoading: isLoadingStats } = useQuery({
    queryKey: ['dashboard-stats', operatorSchool],
    queryFn: () => user?.role === 'operator' ? dashboardApi.getSchoolStats() : dashboardApi.getStats(),
    refetchInterval: 60 * 1000,
    refetchIntervalInBackground: false,
  })

  const { data: skStats, isLoading: isLoadingSkStats } = useQuery({
    queryKey: ['sk-stats', operatorSchool],
    queryFn: () => dashboardApi.getSkStatistics(operatorSchool),
    refetchInterval: 60 * 1000,
    refetchIntervalInBackground: false,
  })

  const { data: skTrend, isLoading: isLoadingSkTrend } = useQuery({
    queryKey: ['sk-trend', operatorSchool],
    queryFn: () => dashboardApi.getSkTrend(6, operatorSchool),
    refetchInterval: 60 * 1000,
    refetchIntervalInBackground: false,
  })

  const { data: chartsData, isLoading: isLoadingCharts } = useQuery({
    queryKey: ['dashboard-charts'],
    queryFn: () => dashboardApi.getCharts(),
    enabled: !user || user.role !== 'operator',
    refetchInterval: 60 * 1000,
    refetchIntervalInBackground: false,
  })

  // Pending headmaster SK submissions
  const { data: headmastersData } = useQuery({
    queryKey: ['headmasters-all', 'pending'],
    queryFn: () => headmasterApi.list({ per_page: 50 }),
    enabled: user && user.role !== 'operator',
    refetchInterval: 60 * 1000,
  })

  const pendingHeadmasters = Array.isArray(headmastersData) 
    ? headmastersData.filter((h: any) => h.status === 'pending')
    : (Array.isArray(headmastersData?.data) ? headmastersData.data.filter((h: any) => h.status === 'pending') : [])

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

  const logs = Array.isArray(statsData?.recentLogs) ? statsData.recentLogs : []
  const [logFilter, setLogFilter] = useState<"all" | "sk" | "guru" | "sekolah">("all")
  
  // Filter logs based on selection
  const filteredLogs = logs?.filter((log: any) => {
    if (logFilter === "all") return true;
    if (logFilter === "sk") return log.action?.toLowerCase().includes('sk');
    if (logFilter === "guru") return log.action?.toLowerCase().includes('guru') || log.action?.toLowerCase().includes('teacher');
    if (logFilter === "sekolah") return log.action?.toLowerCase().includes('sekolah') || log.action?.toLowerCase().includes('school');
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
      <div className="flex h-[400px] w-full items-center justify-center flex-col gap-3">
        <Loader2 className="h-9 w-9 animate-spin text-emerald-600" />
        <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Memuat Dashboard Eksekutif...</span>
      </div>
    )
  }

  const pendingSkCount = skStats?.pending || 0
  const rejectedSkCount = skStats?.rejected || 0
  const pendingKamadCount = pendingHeadmasters.length

  return (
    <div className="space-y-7 pb-12">
      {/* 1. EXECUTIVE HEADER BANNER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 p-7 sm:p-9 text-white shadow-xl border border-emerald-800/40">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-10 h-56 w-56 rounded-full bg-teal-400/10 blur-2xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] font-extrabold uppercase tracking-wider py-0.5 px-2.5">
                Executive Command Center
              </Badge>
              <Badge className="bg-white/10 text-slate-200 border-white/10 text-[10px] font-medium">
                PC LP Ma'arif NU Cilacap
              </Badge>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              Dashboard Overview
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/70 font-medium max-w-xl leading-relaxed">
              Selamat datang, <span className="text-white font-bold">{user?.name || "Super Admin"}</span>. Pantau dan kelola 270+ satuan pendidikan, data ribuan PTK, dan tata kelola SK secara terpadu.
            </p>
          </div>

          {/* Quick Action Buttons for Admin */}
          <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
            <Button
              onClick={() => navigate("/dashboard/sk")}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold text-xs h-11 px-5 rounded-2xl shadow-lg shadow-emerald-950/40 flex items-center gap-2 transition-all hover:scale-105"
            >
              <ShieldCheck className="w-4 h-4 text-slate-950" />
              <span>Meja Approval SK</span>
            </Button>
            <Button
              onClick={() => navigate("/dashboard/sk-center/revisi")}
              variant="outline"
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 font-bold text-xs h-11 px-4 rounded-2xl backdrop-blur-sm transition-all"
            >
              <FileEdit className="w-4 h-4 mr-1.5" />
              <span>Layanan Revisi</span>
            </Button>
            <Button
              onClick={() => navigate("/dashboard/approval/yayasan")}
              variant="outline"
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 font-bold text-xs h-11 px-4 rounded-2xl backdrop-blur-sm transition-all"
            >
              <Award className="w-4 h-4 mr-1.5" />
              <span>SK Kepala</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 2. OVERVIEW KPI STAT CARDS (4 Balanced Unified Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Total Sekolah */}
        <Card 
          onClick={() => navigate("/dashboard/master/schools")}
          className="relative overflow-hidden border border-slate-200/80 shadow-sm hover:shadow-md transition-all rounded-3xl bg-white cursor-pointer group"
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-50 rounded-bl-full -z-0 group-hover:scale-110 transition-transform" />
          <CardContent className="p-6 relative z-10 flex flex-col justify-between h-full space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Satuan Pendidikan</span>
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <School className="h-5 w-5" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-black text-slate-900 tracking-tight">{totalSchools}</div>
              <div className="flex items-center gap-1.5 mt-1.5 text-xs text-emerald-700 font-semibold">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                <span>Madrasah & Sekolah LP Ma'arif</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Total Guru & PTK */}
        <Card 
          onClick={() => navigate("/dashboard/master/teachers")}
          className="relative overflow-hidden border border-slate-200/80 shadow-sm hover:shadow-md transition-all rounded-3xl bg-white cursor-pointer group"
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-teal-50 rounded-bl-full -z-0 group-hover:scale-110 transition-transform" />
          <CardContent className="p-6 relative z-10 flex flex-col justify-between h-full space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Guru & Tendik</span>
              <div className="w-11 h-11 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 shadow-sm group-hover:bg-teal-600 group-hover:text-white transition-colors">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-black text-slate-900 tracking-tight">{totalTeachers}</div>
              <div className="flex items-center gap-1.5 mt-1.5 text-xs text-teal-700 font-semibold">
                <span>Pendidik & Tenaga Kependidikan</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Total Siswa */}
        <Card 
          onClick={() => navigate("/dashboard/master/students")}
          className="relative overflow-hidden border border-slate-200/80 shadow-sm hover:shadow-md transition-all rounded-3xl bg-white cursor-pointer group"
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-blue-50 rounded-bl-full -z-0 group-hover:scale-110 transition-transform" />
          <CardContent className="p-6 relative z-10 flex flex-col justify-between h-full space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Siswa Aktif</span>
              <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <GraduationCap className="h-5 w-5" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-black text-slate-900 tracking-tight">{stats.studentCount}</div>
              <div className="flex items-center gap-1.5 mt-1.5 text-xs text-blue-700 font-semibold">
                <span>Peserta Didik Terdata</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: SK Sah Berlaku */}
        <Card 
          onClick={() => navigate("/dashboard/sk")}
          className="relative overflow-hidden border border-slate-200/80 shadow-sm hover:shadow-md transition-all rounded-3xl bg-white cursor-pointer group"
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-purple-50 rounded-bl-full -z-0 group-hover:scale-110 transition-transform" />
          <CardContent className="p-6 relative z-10 flex flex-col justify-between h-full space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">SK Sah Berlaku</span>
              <div className="w-11 h-11 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shadow-sm group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <Award className="h-5 w-5" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-black text-slate-900 tracking-tight">{skStats?.active || skStats?.approved || 0}</div>
              <div className="flex items-center gap-1.5 mt-1.5 text-xs text-purple-700 font-semibold">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Dokumen Resmi Cabang</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. ACTION QUEUE ALERT BANNER (Antrean Tugas Cabang) */}
      {(pendingSkCount > 0 || rejectedSkCount > 0 || pendingKamadCount > 0) && (
        <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border border-amber-300/80 rounded-3xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-amber-500/20">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm sm:text-base font-extrabold text-amber-950 flex items-center gap-2">
                <span>Antrean Tindak Lanjut Verifikasi Cabang</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 text-[10px] font-black">
                  {pendingSkCount + rejectedSkCount + pendingKamadCount} Berkas
                </span>
              </h4>
              <p className="text-xs text-amber-900/80 font-medium">
                {pendingSkCount > 0 && <span className="mr-2">⚡ <b>{pendingSkCount}</b> SK Guru/Tendik Menunggu</span>}
                {rejectedSkCount > 0 && <span className="mr-2">📝 <b>{rejectedSkCount}</b> Usulan Revisi/Perbaikan</span>}
                {pendingKamadCount > 0 && <span>👑 <b>{pendingKamadCount}</b> Usulan SK Kepala Satpen</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap self-end lg:self-center">
            {pendingSkCount > 0 && (
              <Button
                size="sm"
                onClick={() => navigate("/dashboard/sk")}
                className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm"
              >
                <span>Verifikasi SK</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            )}
            {rejectedSkCount > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate("/dashboard/sk-center/revisi")}
                className="border-amber-300 text-amber-900 bg-white/80 hover:bg-white rounded-xl text-xs font-bold"
              >
                <span>Tinjau Revisi</span>
              </Button>
            )}
            {pendingKamadCount > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate("/dashboard/approval/yayasan")}
                className="border-amber-300 text-amber-900 bg-white/80 hover:bg-white rounded-xl text-xs font-bold"
              >
                <span>SK Kepala ({pendingKamadCount})</span>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* 4. EXECUTIVE TABS SYSTEM */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/60 inline-flex flex-wrap gap-1 h-auto">
          <TabsTrigger 
            value="sk-governance"
            className="rounded-xl px-4 py-2.5 text-xs font-extrabold data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm transition-all"
          >
            <ShieldCheck className="w-4 h-4 mr-2 text-emerald-600" />
            Tata Kelola SK & SDM
          </TabsTrigger>
          <TabsTrigger 
            value="institutions"
            className="rounded-xl px-4 py-2.5 text-xs font-extrabold data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm transition-all"
          >
            <Building2 className="w-4 h-4 mr-2 text-blue-600" />
            Lembaga & Wilayah
          </TabsTrigger>
          <TabsTrigger 
            value="audit-logs"
            className="rounded-xl px-4 py-2.5 text-xs font-extrabold data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm transition-all"
          >
            <Activity className="w-4 h-4 mr-2 text-purple-600" />
            Audit & Log Aktivitas
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: TATA KELOLA SK & SDM */}
        <TabsContent value="sk-governance" className="space-y-6 mt-0">
          {/* SK Status Pipeline 5 Mini Cards */}
          {skStats && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <Card className="border border-slate-200/80 shadow-sm rounded-2xl bg-white p-4">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Dokumen</p>
                <p className="text-2xl font-black text-slate-800 mt-1">{skStats.total || 0}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Semua permohonan</p>
              </Card>
              <Card className="border border-emerald-100 shadow-sm rounded-2xl bg-emerald-50/40 p-4">
                <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Sah Berlaku</p>
                <p className="text-2xl font-black text-emerald-700 mt-1">{skStats.active || skStats.approved || 0}</p>
                <p className="text-[10px] text-emerald-600/80 mt-0.5">SK Aktif ber-barcode</p>
              </Card>
              <Card className="border border-amber-100 shadow-sm rounded-2xl bg-amber-50/40 p-4">
                <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Menunggu</p>
                <p className="text-2xl font-black text-amber-700 mt-1">{skStats.pending || 0}</p>
                <p className="text-[10px] text-amber-600/80 mt-0.5">Antrean verifikasi</p>
              </Card>
              <Card className="border border-purple-100 shadow-sm rounded-2xl bg-purple-50/40 p-4">
                <p className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">Perbaikan / Revisi</p>
                <p className="text-2xl font-black text-purple-700 mt-1">{skStats.rejected || 0}</p>
                <p className="text-[10px] text-purple-600/80 mt-0.5">Usulan koreksi data</p>
              </Card>
              <Card className="border border-rose-100 shadow-sm rounded-2xl bg-rose-50/40 p-4">
                <p className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">Ditolak</p>
                <p className="text-2xl font-black text-rose-700 mt-1">{skStats.rejected_permanently || 0}</p>
                <p className="text-[10px] text-rose-600/80 mt-0.5">Berkas tidak memenuhi</p>
              </Card>
            </div>
          )}

          {/* SK Trend Monthly AreaChart */}
          {Array.isArray(skTrend) && skTrend.length > 0 && (
            <Card className="border border-slate-200/80 shadow-sm rounded-3xl overflow-hidden bg-white">
              <CardHeader className="p-6 border-b bg-slate-50/50 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-black text-slate-800 tracking-tight">
                    Trend Penerbitan SK (6 Bulan Terakhir)
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400 mt-0.5">
                    Volume pengesahan dan distribusi dokumen SK di seluruh cabang
                  </CardDescription>
                </div>
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs font-bold">
                  Akumulasi Cabang
                </Badge>
              </CardHeader>
              <CardContent className="p-6">
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={skTrend} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorTrendExecutive" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#0f172a', 
                          color: '#fff', 
                          borderRadius: '12px', 
                          border: 'none', 
                          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="count" 
                        stroke="#10b981" 
                        strokeWidth={3}
                        fill="url(#colorTrendExecutive)" 
                        fillOpacity={1} 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* SDM Demographics Donut Charts */}
          <DashboardCharts data={chartsData} loading={isLoadingCharts} />
        </TabsContent>

        {/* TAB 2: LEMBAGA & WILAYAH */}
        <TabsContent value="institutions" className="space-y-6 mt-0">
          <SchoolStatisticsCards />
        </TabsContent>

        {/* TAB 3: AUDIT & LOG AKTIVITAS */}
        <TabsContent value="audit-logs" className="space-y-6 mt-0">
          <Card className="border border-slate-200/80 shadow-sm rounded-3xl overflow-hidden bg-white">
            <CardHeader className="p-6 border-b bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-black text-slate-800 tracking-tight">
                  Audit Trail & Log Aktivitas Sistem
                </CardTitle>
                <CardDescription className="text-xs text-slate-400 mt-0.5">
                  Rekam jejak tindakan operator, admin cabang, dan sistem realtime
                </CardDescription>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center bg-slate-200/70 p-1 rounded-xl gap-1">
                {(["all", "sk", "guru", "sekolah"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setLogFilter(f)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      logFilter === f
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {f === 'all' ? 'Semua' : f === 'sk' ? 'SK' : f === 'guru' ? 'Guru' : 'Sekolah'}
                  </button>
                ))}
              </div>
            </CardHeader>

            <CardContent className="p-6">
              <div className="max-h-[480px] overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                {Array.isArray(filteredLogs) && filteredLogs.length > 0 ? (
                  filteredLogs.map((log: any, i: number) => {
                    const isSk = log.action?.toLowerCase().includes('sk')
                    const isGuru = log.action?.toLowerCase().includes('guru') || log.action?.toLowerCase().includes('teacher')
                    const isSekolah = log.action?.toLowerCase().includes('sekolah') || log.action?.toLowerCase().includes('school')

                    return (
                      <div 
                        key={i} 
                        className="p-3.5 rounded-2xl border border-slate-100 hover:border-slate-300 hover:bg-slate-50/60 transition-all flex items-start gap-3.5"
                      >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                          isSk ? 'bg-purple-100 text-purple-700' :
                          isGuru ? 'bg-emerald-100 text-emerald-700' :
                          isSekolah ? 'bg-blue-100 text-blue-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          <span className="text-xs font-black">
                            {log.user?.charAt(0)?.toUpperCase() || 'S'}
                          </span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                              isSk ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                              isGuru ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                              isSekolah ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                              'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}>
                              {log.action}
                            </span>
                            <span className="text-[10px] text-slate-400 font-semibold shrink-0">
                              {new Date(log.timestamp).toLocaleString('id-ID', { 
                                day: '2-digit', 
                                month: 'short', 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </span>
                          </div>

                          <p className="text-xs text-slate-700 font-medium mt-1.5 leading-relaxed">
                            {log.details}
                          </p>

                          <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-400">
                            <span className="font-bold text-slate-600">{log.user}</span>
                            {log.school && <span>•</span>}
                            {log.school && <span className="truncate">{log.school}</span>}
                          </div>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="py-12 text-center text-slate-400 italic text-xs font-medium">
                    Belum ada log aktivitas untuk filter ini.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

