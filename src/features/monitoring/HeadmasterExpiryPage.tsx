import React, { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileDown, AlertTriangle, CheckCircle, Loader2, Calendar, UserCheck, Search, ShieldAlert, Sparkles } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { headmasterApi } from "@/lib/api"
import { useDebounce } from "@/hooks/useDebounce"
import * as XLSX from "xlsx"

export default function HeadmasterExpiryPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const debouncedSearchTerm = useDebounce(searchTerm, 400)
  const [statusFilter, setStatusFilter] = useState<"all" | "expiring" | "expired" | "limit_exceeded">("all")

  // 🔥 REST API QUERY
  const { data: rawHeadmasters = [], isLoading } = useQuery({
    queryKey: ['headmasters-expiring'],
    queryFn: () => headmasterApi.expiring()
  })

  // Safe normalized array parsing
  const headmasters = useMemo(() => {
    const list = Array.isArray(rawHeadmasters) ? rawHeadmasters : (rawHeadmasters as any)?.data || []
    return list.map((h: any) => {
      const teacherName = h.teacher?.nama || h.teacher_name || h.nama || "Tanpa Nama"
      const schoolName = h.school?.nama || h.school_name || h.unit_kerja || "Tanpa Unit Kerja"
      const periodNumber = h.period_number || h.periode_ke || 1

      // Calculate days remaining safely if backend didn't compute it
      let daysRemaining = typeof h.days_remaining === "number" ? h.days_remaining : null
      if (daysRemaining === null && h.end_date) {
        const endTs = new Date(h.end_date).getTime()
        const nowTs = new Date().getTime()
        if (!isNaN(endTs)) {
          daysRemaining = Math.ceil((endTs - nowTs) / (1000 * 60 * 60 * 24))
        }
      }
      if (daysRemaining === null) daysRemaining = 0

      // Normalize status
      let calculatedStatus = h.status || "expiring"
      if (daysRemaining < 0) {
        calculatedStatus = "expired"
      } else if (periodNumber >= 3) {
        calculatedStatus = "limit_exceeded"
      }

      return {
        ...h,
        displayName: teacherName,
        displaySchool: schoolName,
        displayPeriod: periodNumber,
        daysRemaining,
        calculatedStatus
      }
    })
  }, [rawHeadmasters])

  // Filtered data based on search and tab status
  const filteredHeadmasters = useMemo(() => {
    return headmasters.filter((h: any) => {
      // Search filter
      const matchesSearch =
        debouncedSearchTerm === "" ||
        h.displayName.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        h.displaySchool.toLowerCase().includes(debouncedSearchTerm.toLowerCase())

      // Status filter
      let matchesStatus = true
      if (statusFilter === "expired") {
        matchesStatus = h.daysRemaining < 0
      } else if (statusFilter === "expiring") {
        matchesStatus = h.daysRemaining >= 0 && h.calculatedStatus !== "limit_exceeded"
      } else if (statusFilter === "limit_exceeded") {
        matchesStatus = h.calculatedStatus === "limit_exceeded" || h.displayPeriod >= 3
      }

      return matchesSearch && matchesStatus
    })
  }, [headmasters, debouncedSearchTerm, statusFilter])

  const handleDownloadExcel = () => {
    const exportData = filteredHeadmasters.map((h: any, i: number) => ({
      "No": i + 1,
      "Nama Kepala": h.displayName,
      "Unit Kerja / Madrasah": h.displaySchool,
      "Periode Ke": `${h.displayPeriod} / 3`,
      "Tanggal TMT Mulai": h.start_date ? new Date(h.start_date).toLocaleDateString("id-ID") : "-",
      "Tanggal Selesai": h.end_date ? new Date(h.end_date).toLocaleDateString("id-ID") : "-",
      "Sisa Waktu": h.daysRemaining < 0 ? `Telah lewat ${Math.abs(h.daysRemaining)} hari` : `${h.daysRemaining} hari tersisa`,
      "Status Masa Jabatan": h.daysRemaining < 0 ? "Masa Jabatan Habis" : h.displayPeriod >= 3 ? "Batas Maksimal 3 Periode" : "Akan Habis"
    }))

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Monitoring Masa Jabatan")
    XLSX.writeFile(wb, `Monitoring_Masa_Jabatan_Kamad_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  if (isLoading) return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 text-slate-300">
      <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
      <span className="text-xs font-black uppercase tracking-widest text-slate-400">Menghitung Masa Jabatan Kepala...</span>
    </div>
  )

  return (
    <div className="space-y-6 pb-20">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 p-8 text-white shadow-xl">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-[10px] font-black uppercase tracking-widest">
              <ShieldAlert className="w-3 h-3 text-amber-400" /> Early Warning System
            </div>
            <h1 className="text-2xl md:text-3xl font-black italic tracking-tight text-white uppercase">
              Monitoring Masa Jabatan
            </h1>
            <p className="text-xs text-amber-200/80 max-w-xl font-medium">
              Peringatan dini deteksi masa bakti Kepala Satuan Pendidikan dengan sisa waktu <span className="text-white font-bold">≤ 180 hari (6 bulan)</span> atau batas maksimal 3 periode.
            </p>
          </div>

          <Button
            variant="outline"
            onClick={handleDownloadExcel}
            disabled={!filteredHeadmasters.length}
            className="bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-2xl h-11 px-5 font-bold text-xs shrink-0 transition-all"
          >
            <FileDown className="mr-2 h-4 w-4 text-amber-300" /> Export Excel
          </Button>
        </div>
      </div>

      {/* Main Card */}
      <Card className="border border-slate-200 shadow-sm bg-white rounded-2xl overflow-hidden">
        <CardHeader className="p-8 border-b bg-slate-50/50">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                <Calendar className="h-5 w-5 text-amber-600" />
                <span>Daftar Peringatan Dini Masa Jabatan</span>
              </CardTitle>
              <CardDescription className="text-xs font-medium text-slate-400">
                Menampilkan {filteredHeadmasters.length} data kepala madrasah yang membutuhkan perhatian atau tindakan perpanjangan/SK baru.
              </CardDescription>
            </div>

            {/* Controls: Search & Tabs */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative min-w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Cari kepala / madrasah..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-10 rounded-xl bg-white border-slate-200 text-xs font-bold"
                />
              </div>

              <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)} className="w-auto">
                <TabsList className="bg-slate-200/70 p-1 rounded-xl h-10">
                  <TabsTrigger value="all" className="rounded-lg text-[10px] font-black uppercase px-3 py-1.5 data-[state=active]:bg-white data-[state=active]:text-slate-900">
                    Semua ({headmasters.length})
                  </TabsTrigger>
                  <TabsTrigger value="expiring" className="rounded-lg text-[10px] font-black uppercase px-3 py-1.5 data-[state=active]:bg-white data-[state=active]:text-amber-700">
                    Hampir Habis
                  </TabsTrigger>
                  <TabsTrigger value="expired" className="rounded-lg text-[10px] font-black uppercase px-3 py-1.5 data-[state=active]:bg-white data-[state=active]:text-rose-700">
                    Masa Habis
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50 border-b border-slate-100">
                <TableRow>
                  <TableHead className="w-[60px] text-center text-[10px] font-black uppercase text-slate-400 py-4">No</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-slate-400 py-4">Informasi Kepala</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-slate-400 py-4">Unit Kerja / Madrasah</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-slate-400 py-4 text-center">Periode</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-slate-400 py-4">Masa Jabatan & Sisa Waktu</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-slate-400 py-4 text-center">Status Masa Jabatan</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredHeadmasters.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-48">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="bg-emerald-100 p-4 rounded-full">
                          <CheckCircle className="h-8 w-8 text-emerald-600" />
                        </div>
                        <p className="text-xs font-black uppercase text-slate-500 tracking-wider">
                          Seluruh masa jabatan kepala madrasah dalam kondisi aman
                        </p>
                        <p className="text-[11px] text-slate-400 font-medium">
                          Tidak ditemukan data yang sesuai dengan kriteria pencarian / filter Anda.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredHeadmasters.map((h: any, i: number) => {
                    const isExpired = h.daysRemaining < 0
                    const isMaxLimit = h.displayPeriod >= 3

                    return (
                      <TableRow
                        key={h.id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isExpired ? 'bg-rose-50/40' : isMaxLimit ? 'bg-amber-50/30' : ''
                        }`}
                      >
                        <TableCell className="text-center font-bold text-slate-400 text-xs py-4">
                          {i + 1}
                        </TableCell>

                        {/* Informasi Kepala */}
                        <TableCell className="py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                              <UserCheck className="h-4 w-4 text-slate-600" />
                            </div>
                            <div>
                              <div className="font-extrabold text-slate-900 text-sm tracking-tight">
                                {h.displayName}
                              </div>
                              {isMaxLimit && (
                                <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-[9px] font-black uppercase mt-0.5 px-2 py-0">
                                  Batas Maksimal 3 Periode
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* Unit Kerja */}
                        <TableCell className="py-4 text-xs font-bold text-slate-700">
                          {h.displaySchool}
                        </TableCell>

                        {/* Periode */}
                        <TableCell className="py-4 text-center font-black text-xs">
                          <span className="px-3 py-1 bg-slate-100 rounded-lg text-slate-700">
                            Periode {h.displayPeriod} / 3
                          </span>
                        </TableCell>

                        {/* Masa Jabatan */}
                        <TableCell className="py-4">
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            Hingga {h.end_date ? new Date(h.end_date).toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' }) : "-"}
                          </div>
                          <div className={`text-xs font-black uppercase mt-1 ${isExpired ? "text-rose-600" : "text-amber-600"}`}>
                            {isExpired
                              ? `Telah Lewat ${Math.abs(h.daysRemaining)} Hari`
                              : `${h.daysRemaining} Hari Tersisa`
                            }
                          </div>
                        </TableCell>

                        {/* Status */}
                        <TableCell className="py-4 text-center">
                          <Badge
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tight inline-flex items-center gap-1.5 border-0 ${
                              isExpired
                                ? 'bg-rose-600 text-white shadow-sm shadow-rose-200'
                                : isMaxLimit
                                  ? 'bg-amber-500 text-white shadow-sm shadow-amber-200'
                                  : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>
                              {isExpired ? 'Masa Jabatan Habis' : isMaxLimit ? 'Batas 3 Periode' : 'Akan Habis'}
                            </span>
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
