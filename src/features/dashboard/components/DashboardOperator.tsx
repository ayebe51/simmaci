import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  School, 
  Users, 
  FileText, 
  CheckCircle, 
  Clock, 
  Loader2, 
  Award, 
  FileEdit, 
  ArrowRight, 
  Sparkles, 
  AlertCircle, 
  Archive, 
  GraduationCap, 
  ChevronRight,
  ShieldCheck,
  Building2,
  Calendar
} from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { dashboardApi, skApi, authApi } from "@/lib/api"
import { useNavigate } from "react-router-dom"
import { useState, useMemo } from "react"
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'

const PASTEL_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#6366f1']
const CERT_COLORS = { yes: '#10b981', no: '#f43f5e' }

export default function DashboardOperator() {
  const navigate = useNavigate()
  const user = authApi.getStoredUser()
  const [chartView, setChartView] = useState<"status" | "certification">("status")

  // 1. School Statistics
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['school-stats', user?.id],
    queryFn: () => dashboardApi.getSchoolStats(),
    staleTime: 60 * 1000,
    refetchInterval: 180 * 1000,
    refetchIntervalInBackground: false,
  })

  // 2. Recent SK submissions & approved documents for this school
  const { data: recentSksData, isLoading: isLoadingRecentSks } = useQuery({
    queryKey: ['operator-recent-sks', user?.unit],
    queryFn: () => skApi.list({
      per_page: 5,
      sort_by: 'created_at',
      sort_dir: 'desc'
    }),
    staleTime: 60 * 1000,
    refetchInterval: 180 * 1000,
    refetchIntervalInBackground: false,
  })

  const recentSks = useMemo(() => {
    if (Array.isArray(recentSksData?.data)) return recentSksData.data
    if (Array.isArray(recentSksData)) return recentSksData
    return []
  }, [recentSksData])

  if (isLoadingStats && !stats) {
    return (
      <div className="flex h-[400px] w-full items-center justify-center flex-col gap-3">
        <Loader2 className="h-9 w-9 animate-spin text-emerald-600" />
        <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Memuat Dashboard Sekolah...</span>
      </div>
    )
  }

  const schoolName = user?.unit || user?.school?.name || user?.name || "Satuan Pendidikan"
  
  // Status breakdown for charts
  const statusData = (Array.isArray(stats?.status) ? stats.status : [])
    .filter((d: any) => d && typeof d.value === 'number' && d.value > 0)
    .sort((a: any, b: any) => (b.value || 0) - (a.value || 0))

  const certData = (Array.isArray(stats?.certification) ? stats.certification : [])
    .filter((d: any) => d && typeof d.value === 'number' && d.value > 0)

  const totalStatus = statusData.reduce((a: number, b: any) => a + (b.value || 0), 0)
  const totalCert = certData.reduce((a: number, b: any) => a + (b.value || 0), 0)

  const activeChartData = chartView === "status" ? statusData : certData
  const activeTotal = chartView === "status" ? totalStatus : totalCert

  return (
    <div className="space-y-7 pb-12">
      {/* 1. HERO BANNER: School Identity & Quick Welcome */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 p-7 sm:p-9 text-white shadow-lg border border-emerald-800/40">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-10 h-48 w-48 rounded-full bg-teal-400/10 blur-2xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] font-extrabold uppercase tracking-wider py-0.5 px-2.5">
                Portal Operator Satpen
              </Badge>
              <Badge className="bg-white/10 text-slate-200 border-white/10 text-[10px] font-medium">
                T.A. 2026/2027
              </Badge>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              {schoolName}
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/70 font-medium max-w-xl leading-relaxed">
              Kelola pendataan GTK, administrasi SK cabang, absensi terpadu, dan pelaporan satuan pendidikan LP Ma'arif NU Cilacap.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
            <Button
              onClick={() => navigate("/dashboard/sk-center/submission")}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold text-xs h-11 px-5 rounded-2xl shadow-lg shadow-emerald-950/40 flex items-center gap-2 transition-all hover:scale-105"
            >
              <Sparkles className="w-4 h-4 text-slate-950" />
              <span>Ajukan SK Baru</span>
            </Button>
            <Button
              onClick={() => navigate("/dashboard/master/teachers")}
              variant="outline"
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 font-bold text-xs h-11 px-4 rounded-2xl backdrop-blur-sm transition-all"
            >
              <Users className="w-4 h-4 mr-1.5" />
              <span>Kelola Guru</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 2. OVERVIEW KPI CARDS: 4 Symmetrical Balanced Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Total Guru */}
        <Card 
          onClick={() => navigate("/dashboard/master/teachers")}
          className="relative overflow-hidden border border-slate-200/80 shadow-sm hover:shadow-md transition-all rounded-3xl bg-white cursor-pointer group"
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-50 rounded-bl-full -z-0 group-hover:scale-110 transition-transform" />
          <CardContent className="p-6 relative z-10 flex flex-col justify-between h-full space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Guru & Tendik</span>
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-black text-slate-900 tracking-tight">{stats?.teachers || 0}</div>
              <div className="flex items-center gap-1.5 mt-1.5 text-xs text-emerald-700 font-semibold">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                <span>SDM Terdaftar Aktif</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Total Siswa */}
        <Card 
          onClick={() => navigate("/dashboard/master/students")}
          className="relative overflow-hidden border border-slate-200/80 shadow-sm hover:shadow-md transition-all rounded-3xl bg-white cursor-pointer group"
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-blue-50 rounded-bl-full -z-0 group-hover:scale-110 transition-transform" />
          <CardContent className="p-6 relative z-10 flex flex-col justify-between h-full space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Siswa</span>
              <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <GraduationCap className="h-5 w-5" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-black text-slate-900 tracking-tight">{stats?.students || 0}</div>
              <div className="flex items-center gap-1.5 mt-1.5 text-xs text-blue-700 font-semibold">
                <span>{stats?.students > 0 ? "Database Siswa Aktif" : "+ Input Data Siswa"}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: SK Terbit */}
        <Card 
          onClick={() => navigate("/dashboard/sk-arsip")}
          className="relative overflow-hidden border border-slate-200/80 shadow-sm hover:shadow-md transition-all rounded-3xl bg-white cursor-pointer group"
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-purple-50 rounded-bl-full -z-0 group-hover:scale-110 transition-transform" />
          <CardContent className="p-6 relative z-10 flex flex-col justify-between h-full space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">SK Terbit Sah</span>
              <div className="w-11 h-11 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shadow-sm group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <Award className="h-5 w-5" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-black text-slate-900 tracking-tight">{stats?.skApproved || 0}</div>
              <div className="flex items-center gap-1.5 mt-1.5 text-xs text-purple-700 font-semibold">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Dokumen Resmi Sah</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Draft & Menunggu */}
        <Card 
          onClick={() => navigate("/dashboard/sk-center")}
          className="relative overflow-hidden border border-slate-200/80 shadow-sm hover:shadow-md transition-all rounded-3xl bg-white cursor-pointer group"
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-amber-50 rounded-bl-full -z-0 group-hover:scale-110 transition-transform" />
          <CardContent className="p-6 relative z-10 flex flex-col justify-between h-full space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Draft & Menunggu</span>
              <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shadow-sm group-hover:bg-amber-600 group-hover:text-white transition-colors">
                <Clock className="h-5 w-5" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-black text-slate-900 tracking-tight">
                {(stats?.skDrafts || 0) + (stats?.skPending || 0)}
              </div>
              <div className="flex items-center gap-1.5 mt-1.5 text-xs text-amber-700 font-semibold">
                <span>{(stats?.skPending || 0)} menunggu • {stats?.skDrafts || 0} draf</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. ACTION ALERT (Notice for Operator) */}
      {(stats?.skDrafts > 0 || (stats?.skPending || 0) > 0) && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-200/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-extrabold text-amber-950">
                Pemberitahuan Berkas Pengajuan SK
              </h4>
              <p className="text-[11px] sm:text-xs text-amber-800/80 font-medium">
                Terdapat {stats?.skDrafts || 0} draf SK dan {stats?.skPending || 0} pengajuan yang sedang diproses oleh Pengurus Cabang.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => navigate("/dashboard/sk-center")}
            className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold self-end sm:self-center shadow-sm"
          >
            <span>Buka Layanan SK</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        </div>
      )}

      {/* 4. MAIN WORKSPACE: 2-Column (Left: SDM Distribution, Right: Recent Activity Timeline) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Interactive SDM Demographics Donut (5 Cols) */}
        <Card className="lg:col-span-5 border border-slate-200/80 shadow-sm bg-white rounded-3xl overflow-hidden flex flex-col justify-between">
          <CardHeader className="p-6 border-b bg-slate-50/50">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-black text-slate-800 tracking-tight">
                  Distribusi SDM Lembaga
                </CardTitle>
                <CardDescription className="text-xs text-slate-400 mt-0.5">
                  Komposisi status & kualifikasi guru
                </CardDescription>
              </div>
              
              {/* Toggle Switch */}
              <div className="flex items-center bg-slate-200/70 p-0.5 rounded-xl text-[11px] font-bold">
                <button
                  onClick={() => setChartView("status")}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    chartView === "status" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Status
                </button>
                <button
                  onClick={() => setChartView("certification")}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    chartView === "certification" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Sertifikasi
                </button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6 flex-1 flex flex-col justify-center">
            {activeChartData.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs font-medium">
                Belum ada data distribusi SDM
              </div>
            ) : (
              <div className="space-y-5">
                <div className="h-[200px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={activeChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={4}
                        cornerRadius={6}
                        dataKey="value"
                        stroke="none"
                      >
                        {activeChartData.map((entry: any, index: number) => {
                          const fill = chartView === "status"
                            ? PASTEL_COLORS[index % PASTEL_COLORS.length]
                            : entry.name.includes("Belum") ? CERT_COLORS.no : CERT_COLORS.yes
                          return <Cell key={`cell-${index}`} fill={fill} />
                        })}
                      </Pie>
                      <Tooltip 
                        content={({ active, payload }: any) => {
                          if (active && payload && payload.length) {
                            const data = payload[0]
                            return (
                              <div className="bg-slate-900 text-white px-3 py-1.5 rounded-xl text-xs shadow-lg">
                                <p className="font-bold">{data.name}: <span className="text-emerald-400">{data.value} orang</span></p>
                              </div>
                            )
                          }
                          return null
                        }} 
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  
                  {/* Donut Center Counter */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                    <p className="text-2xl font-black text-slate-800">{activeTotal}</p>
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                      {chartView === "status" ? "SDM" : "GURU"}
                    </p>
                  </div>
                </div>

                {/* Legend List */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                  {activeChartData.map((entry: any, index: number) => {
                    const color = chartView === "status"
                      ? PASTEL_COLORS[index % PASTEL_COLORS.length]
                      : entry.name.includes("Belum") ? CERT_COLORS.no : CERT_COLORS.yes
                    const percent = activeTotal > 0 ? ((entry.value / activeTotal) * 100).toFixed(0) : 0
                    return (
                      <div key={entry.name} className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <div className="truncate text-xs">
                          <span className="font-bold text-slate-700">{entry.name}</span>
                          <span className="text-[11px] text-slate-400 ml-1">({entry.value} - {percent}%)</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column: Recent SK Submissions & Timeline (7 Cols) */}
        <Card className="lg:col-span-7 border border-slate-200/80 shadow-sm bg-white rounded-3xl overflow-hidden flex flex-col justify-between">
          <CardHeader className="p-6 border-b bg-slate-50/50 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-black text-slate-800 tracking-tight">
                Aktivitas & Riwayat SK Terkini
              </CardTitle>
              <CardDescription className="text-xs text-slate-400 mt-0.5">
                Status pengajuan dan penerbitan SK madrasah Anda
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard/sk-arsip")}
              className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 text-xs font-bold rounded-xl"
            >
              <span>Lihat Arsip</span>
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </CardHeader>

          <CardContent className="p-6 flex-1 flex flex-col justify-between">
            {isLoadingRecentSks ? (
              <div className="py-12 text-center space-y-2">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-600" />
                <p className="text-xs text-slate-400">Mengambil data SK terkini...</p>
              </div>
            ) : recentSks.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-700">Belum ada pengajuan SK</p>
                  <p className="text-xs text-slate-400 mt-0.5">Mulai buat pengajuan SK Guru/Tendik untuk madrasah Anda.</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => navigate("/dashboard/sk-center/submission")}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold"
                >
                  Ajukan SK Baru
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentSks.slice(0, 4).map((sk: any) => {
                  const isApproved = sk.status === 'approved'
                  const isPending = sk.status === 'pending' || sk.status === 'revision_pending'
                  const isDraft = sk.status === 'draft'

                  return (
                    <div 
                      key={sk.id}
                      onClick={() => navigate(`/dashboard/sk/${sk.id}`)}
                      className="p-3.5 rounded-2xl border border-slate-100 hover:border-slate-300 hover:bg-slate-50/70 transition-all flex items-center justify-between gap-3 cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          isApproved ? 'bg-emerald-100 text-emerald-700' :
                          isPending ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {isApproved ? <Award className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-extrabold text-xs sm:text-sm text-slate-800 group-hover:text-emerald-700 transition-colors truncate">
                            {sk.nama}
                          </p>
                          <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">
                            {sk.nomor_sk || "Draft Pengajuan"} • {sk.status_kepegawaian || "Guru"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge className={`text-[10px] font-bold uppercase tracking-wider py-0.5 px-2 rounded-md ${
                          isApproved ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          isPending ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {isApproved ? 'Sah' : isPending ? 'Menunggu' : 'Draft'}
                        </Badge>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 transition-colors hidden sm:block" />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-400">
              <span>Total {stats?.skApproved || 0} SK Resmi Terbit</span>
              <span 
                onClick={() => navigate("/dashboard/sk-center")}
                className="text-emerald-700 hover:underline cursor-pointer"
              >
                Buka Pusat Layanan SK →
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 5. QUICK ACTIONS HUB (Akses Cepat Pintasan) */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <span className="w-2 h-4 bg-emerald-600 rounded-full" />
            <span>Pintasan Akses Cepat</span>
          </h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {[
            { label: "Data Guru", desc: "Kelola PTK", icon: Users, path: "/dashboard/master/teachers", color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
            { label: "Pusat SK", desc: "Layanan SK", icon: FileText, path: "/dashboard/sk-center", color: "text-blue-600 bg-blue-50 border-blue-100" },
            { label: "Arsip SK", desc: "Dokumen Sah", icon: Archive, path: "/dashboard/sk-arsip", color: "text-indigo-600 bg-indigo-50 border-indigo-100" },
            { label: "Revisi Data", desc: "Koreksi SK", icon: FileEdit, path: "/dashboard/sk-center/revisi", color: "text-purple-600 bg-purple-50 border-purple-100" },
            { label: "Data Siswa", desc: "Database Siswa", icon: GraduationCap, path: "/dashboard/master/students", color: "text-amber-600 bg-amber-50 border-amber-100" },
            { label: "Profil Satpen", desc: "Info Lembaga", icon: School, path: "/dashboard/school/profile", color: "text-teal-600 bg-teal-50 border-teal-100" },
          ].map((item, i) => (
            <Card
              key={i}
              onClick={() => navigate(item.path)}
              className="cursor-pointer border border-slate-200/80 hover:border-emerald-300 hover:shadow-md transition-all rounded-2xl bg-white group p-4 flex flex-col justify-between space-y-3"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.color} border shadow-sm group-hover:scale-110 transition-transform`}>
                <item.icon className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-xs text-slate-800 group-hover:text-emerald-700 transition-colors">
                  {item.label}
                </h4>
                <p className="text-[10px] text-slate-400 font-medium">{item.desc}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

