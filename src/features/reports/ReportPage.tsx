import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Printer, Search, Loader2, FileText, BarChart3, Users, Award, Building2, Download, X } from "lucide-react"
import { useState, useMemo, useCallback } from "react"
import { reportApi } from "@/lib/api"
import { useQuery } from "@tanstack/react-query"
import { cn } from "@/lib/utils"
import * as XLSX from "xlsx"

// ── Status badge colors ──
const STATUS_COLORS: Record<string, string> = {
  GTY:    "bg-emerald-100 text-emerald-700 border-emerald-200",
  GTT:    "bg-amber-100 text-amber-700 border-amber-200",
  PNS:    "bg-blue-100 text-blue-700 border-blue-200",
  PPPK:   "bg-purple-100 text-purple-700 border-purple-200",
  Tendik: "bg-slate-100 text-slate-700 border-slate-200",
}

function statusColor(status: string) {
  return STATUS_COLORS[status] ?? "bg-slate-100 text-slate-600 border-slate-200"
}

// ── Types ──
interface TeacherRow {
  id: number
  nama: string
  nuptk?: string
  nip?: string
  nomor_induk_maarif?: string
  status?: string
  mapel?: string
  unit_kerja?: string
  kecamatan?: string
  pendidikan_terakhir?: string
  is_certified?: boolean
  is_active?: boolean
  jenis_kelamin?: string
  school?: { id: number; nama: string; kecamatan?: string }
}

interface ReportData {
  total: number
  filtered_total: number
  by_status: Record<string, number>
  by_certification: { certified: number; uncertified: number }
  by_school: Record<string, number>
  kecamatan_list: string[]
  data: TeacherRow[]
}

export default function ReportPage() {
  const [search, setSearch]             = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterKec, setFilterKec]       = useState("all")
  const [filterCert, setFilterCert]     = useState("all")

  // Debounced search for API
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const debounceTimer = useState<ReturnType<typeof setTimeout> | null>(null)

  const handleSearchChange = useCallback((val: string) => {
    setSearch(val)
    if (debounceTimer[0]) clearTimeout(debounceTimer[0])
    debounceTimer[0] = setTimeout(() => setDebouncedSearch(val), 400)
  }, [debounceTimer])

  const queryParams = useMemo(() => {
    const p: Record<string, string> = {}
    if (debouncedSearch) p.search = debouncedSearch
    if (filterStatus !== "all") p.status = filterStatus
    if (filterKec !== "all") p.kecamatan = filterKec
    if (filterCert !== "all") p.is_certified = filterCert
    return p
  }, [debouncedSearch, filterStatus, filterKec, filterCert])

  const { data: reportRes, isLoading, isFetching } = useQuery<ReportData>({
    queryKey: ["laporan-guru", queryParams],
    queryFn: () => reportApi.teacherReport(queryParams),
    staleTime: 60_000,
  })

  const teachers: TeacherRow[] = reportRes?.data ?? []
  const summary = reportRes
  const kecamatanList: string[] = reportRes?.kecamatan_list ?? []

  const hasFilters = filterStatus !== "all" || filterKec !== "all" || filterCert !== "all" || search !== ""

  const clearFilters = () => {
    setSearch("")
    setDebouncedSearch("")
    setFilterStatus("all")
    setFilterKec("all")
    setFilterCert("all")
  }

  // ── Excel Export ──
  const handleExport = () => {
    const rows = teachers.map((t, i) => ({
      "No":                i + 1,
      "Nama":              t.nama,
      "NUPTK":             t.nuptk ?? "-",
      "NIP":               t.nip ?? "-",
      "NIM Maarif":        t.nomor_induk_maarif ?? "-",
      "Status":            t.status ?? "-",
      "Mata Pelajaran":    t.mapel ?? "-",
      "Unit Kerja":        t.school?.nama ?? t.unit_kerja ?? "-",
      "Kecamatan":         t.kecamatan ?? t.school?.kecamatan ?? "-",
      "Pendidikan":        t.pendidikan_terakhir ?? "-",
      "Sertifikasi":       t.is_certified ? "Sudah" : "Belum",
      "Jenis Kelamin":     t.jenis_kelamin ?? "-",
    }))

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Laporan Guru")

    // Auto column widths
    const colWidths = Object.keys(rows[0] ?? {}).map((k) => ({
      wch: Math.max(k.length, ...rows.map((r) => String((r as any)[k] ?? "").length)) + 2,
    }))
    ws["!cols"] = colWidths

    XLSX.writeFile(wb, `Laporan_Guru_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const handlePrint = () => window.print()

  return (
    <div className="space-y-8 pb-20">
      {/* ── Header ── */}
      <div className="flex items-start justify-between print:hidden">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase italic">Laporan Guru</h1>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2">
            <BarChart3 className="w-3 h-3 text-blue-500" /> Rekapitulasi Data Pendidik & Tenaga Kependidikan
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={isLoading || teachers.length === 0}
            className="h-11 rounded-xl px-6 font-bold text-xs uppercase tracking-widest border-emerald-200 text-emerald-700 hover:bg-emerald-50"
          >
            <Download className="mr-2 h-4 w-4" /> Export Excel
          </Button>
          <Button
            onClick={handlePrint}
            disabled={isLoading}
            className="h-11 rounded-xl px-6 bg-slate-900 hover:bg-black text-white font-bold text-xs uppercase tracking-widest"
          >
            <Printer className="mr-2 h-4 w-4" /> Cetak PDF
          </Button>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:hidden">
          <Card className="border-0 shadow-sm rounded-2xl bg-gradient-to-br from-blue-50 to-white">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total Guru Aktif</p>
                  <p className="text-2xl font-black text-slate-900">{summary.total.toLocaleString("id-ID")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm rounded-2xl bg-gradient-to-br from-emerald-50 to-white">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <Award className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Sudah Sertifikasi</p>
                  <p className="text-2xl font-black text-slate-900">{summary.by_certification.certified.toLocaleString("id-ID")}</p>
                  <p className="text-[10px] text-slate-400 font-bold">
                    {summary.total > 0 ? Math.round((summary.by_certification.certified / summary.total) * 100) : 0}% dari total
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm rounded-2xl bg-gradient-to-br from-amber-50 to-white">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Belum Sertifikasi</p>
                  <p className="text-2xl font-black text-slate-900">{summary.by_certification.uncertified.toLocaleString("id-ID")}</p>
                  <p className="text-[10px] text-slate-400 font-bold">
                    {summary.total > 0 ? Math.round((summary.by_certification.uncertified / summary.total) * 100) : 0}% dari total
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm rounded-2xl bg-gradient-to-br from-purple-50 to-white">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Rekap Status</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {Object.entries(summary.by_status).slice(0, 3).map(([s, c]) => (
                      <span key={s} className={cn("text-[9px] font-black px-1.5 py-0.5 rounded-md border", statusColor(s))}>
                        {s}: {c}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Filters ── */}
      <Card className="border-0 shadow-sm bg-white rounded-2xl overflow-hidden print:hidden">
        <CardHeader className="px-6 py-4 border-b bg-slate-50/50">
          <CardTitle className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
            <Search className="w-4 h-4 text-blue-500" /> Filter Data
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="ml-auto flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-red-500 transition-colors"
              >
                <X className="w-3 h-3" /> Reset Filter
              </button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-slate-400">Cari Nama / NUPTK / NIP</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              <Input
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Ketik nama atau NUPTK..."
                className="pl-9 h-11 rounded-xl border-slate-200 font-medium text-sm"
              />
            </div>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-slate-400">Status Kepegawaian</label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-11 rounded-xl border-slate-200 font-medium text-sm">
                <SelectValue placeholder="Semua Status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="GTY">GTY</SelectItem>
                <SelectItem value="GTT">GTT</SelectItem>
                <SelectItem value="PNS">PNS</SelectItem>
                <SelectItem value="PPPK">PPPK</SelectItem>
                <SelectItem value="Tendik">Tendik</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Kecamatan */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-slate-400">Kecamatan</label>
            <Select value={filterKec} onValueChange={setFilterKec}>
              <SelectTrigger className="h-11 rounded-xl border-slate-200 font-medium text-sm">
                <SelectValue placeholder="Semua Kecamatan" />
              </SelectTrigger>
              <SelectContent className="rounded-xl max-h-60">
                <SelectItem value="all">Semua Kecamatan</SelectItem>
                {kecamatanList.map((k) => (
                  <SelectItem key={k} value={k}>{k}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sertifikasi */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-slate-400">Sertifikasi</label>
            <Select value={filterCert} onValueChange={setFilterCert}>
              <SelectTrigger className="h-11 rounded-xl border-slate-200 font-medium text-sm">
                <SelectValue placeholder="Semua" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">Semua</SelectItem>
                <SelectItem value="1">Sudah Sertifikasi</SelectItem>
                <SelectItem value="0">Belum Sertifikasi</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ── Print Header ── */}
      <div className="hidden print:block mb-10 border-b-2 border-slate-900 pb-6 text-center">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-xl italic">M</div>
          <div className="text-left">
            <h2 className="text-xl font-black uppercase italic tracking-tight text-slate-900">LP Ma'arif NU Cilacap</h2>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Sistem Informasi Manajemen Madrasah Terpadu</p>
          </div>
        </div>
        <h3 className="text-lg font-black mt-4 uppercase tracking-tight text-slate-800 italic underline decoration-blue-500 decoration-4 underline-offset-6">
          Rekapitulasi Data Guru & Tenaga Kependidikan
        </h3>
        <div className="mt-4 flex justify-center gap-8 text-xs">
          <div className="text-center">
            <p className="text-[9px] font-black text-slate-400 uppercase">Dicetak</p>
            <p className="font-bold text-slate-700">{new Date().toLocaleString("id-ID")}</p>
          </div>
          <div className="text-center">
            <p className="text-[9px] font-black text-slate-400 uppercase">Total Data</p>
            <p className="font-bold text-slate-700">{teachers.length} Guru</p>
          </div>
          {filterStatus !== "all" && (
            <div className="text-center">
              <p className="text-[9px] font-black text-slate-400 uppercase">Filter Status</p>
              <p className="font-bold text-slate-700">{filterStatus}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Result count ── */}
      <div className="flex items-center justify-between print:hidden">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          {isFetching && !isLoading
            ? <span className="flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Memuat...</span>
            : <span>Menampilkan <span className="text-slate-700">{teachers.length}</span> dari <span className="text-slate-700">{summary?.total ?? 0}</span> guru</span>
          }
        </p>
      </div>

      {/* ── Table ── */}
      <div className="rounded-2xl overflow-hidden border border-slate-100 shadow-sm bg-white">
        <Table className="print:text-xs">
          <TableHeader className="bg-slate-50">
            <TableRow className="border-b border-slate-100">
              <TableHead className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest w-12">No</TableHead>
              <TableHead className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Nama Pendidik</TableHead>
              <TableHead className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">NIP / NUPTK</TableHead>
              <TableHead className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Status</TableHead>
              <TableHead className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Unit Kerja</TableHead>
              <TableHead className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Mapel</TableHead>
              <TableHead className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Sertifikasi</TableHead>
              <TableHead className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Pendidikan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-24">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                    <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Memuat data guru...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : teachers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-24">
                  <div className="flex flex-col items-center gap-3">
                    <Users className="w-10 h-10 text-slate-200" />
                    <p className="text-sm font-bold text-slate-300">Tidak ada data guru ditemukan</p>
                    {hasFilters && (
                      <button onClick={clearFilters} className="text-xs font-bold text-blue-500 hover:underline">
                        Reset filter
                      </button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              teachers.map((t, i) => (
                <TableRow key={t.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-50 print:break-inside-avoid">
                  <TableCell className="px-6 py-4 font-black text-slate-300 text-xs">{i + 1}</TableCell>
                  <TableCell className="px-6 py-4">
                    <div className="font-bold text-slate-800 text-sm">{t.nama}</div>
                    {t.kecamatan && (
                      <div className="text-[10px] font-medium text-slate-400 mt-0.5">{t.kecamatan}</div>
                    )}
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <div className="font-mono text-xs text-slate-600">{t.nuptk || t.nip || "-"}</div>
                    {t.nomor_induk_maarif && (
                      <div className="text-[10px] text-slate-400 font-medium mt-0.5">NIM: {t.nomor_induk_maarif}</div>
                    )}
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    {t.status ? (
                      <Badge variant="outline" className={cn("text-[10px] font-black uppercase px-2 py-0.5 rounded-lg border", statusColor(t.status))}>
                        {t.status}
                      </Badge>
                    ) : (
                      <span className="text-slate-300 text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-xs font-medium text-slate-600 max-w-[180px] truncate">
                    {t.school?.nama ?? t.unit_kerja ?? "-"}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-xs font-medium text-blue-600 uppercase">
                    {t.mapel ?? "-"}
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    {t.is_certified ? (
                      <Badge variant="outline" className="text-[10px] font-black bg-emerald-50 text-emerald-700 border-emerald-200 rounded-lg px-2 py-0.5">
                        ✓ Sertifikasi
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] font-black bg-slate-50 text-slate-400 border-slate-200 rounded-lg px-2 py-0.5">
                        Belum
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-xs font-medium text-slate-500">
                    {t.pendidikan_terakhir ?? "-"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Print Footer ── */}
      <div className="hidden print:grid grid-cols-2 mt-16 w-full break-inside-avoid">
        <div />
        <div className="text-center">
          <p className="text-[10px] font-black uppercase text-slate-400 mb-1">
            Ditetapkan di Cilacap, {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
          </p>
          <p className="text-xs font-black uppercase text-slate-800 italic">Ketua Pengurus Cabang</p>
          <div className="h-24" />
          <div className="inline-block border-b-2 border-slate-900 px-8">
            <p className="font-black text-sm uppercase text-slate-900 tracking-tight">H. MUNIB, S.Ag., M.Pd.</p>
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">NIY. 19741231 200001 1001</p>
        </div>
      </div>
    </div>
  )
}
