import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Printer, Search, Loader2, FileText, BarChart3, Building2, UserCheck2, AlertCircle } from "lucide-react"
import { useEffect, useState, useMemo } from "react"
import { reportApi, schoolApi } from "@/lib/api"
import { toast } from "sonner"
import { useQuery } from "@tanstack/react-query"
import { cn } from "@/lib/utils"

export default function ReportPage() {
  const [reportType, setReportType] = useState("teachers_by_unit")
  const [selectedUnit, setSelectedUnit] = useState("all")

  // 🔥 REST API QUERIES
  const { data: reportRes, isLoading } = useQuery({
    queryKey: ['report-teachers-rekap'],
    queryFn: () => reportApi.teacherRekap.list({ per_page: 1000 })
  })

  const { data: schoolsRes } = useQuery({
    queryKey: ['schools-list-rekap'],
    queryFn: () => schoolApi.list({ per_page: 500 })
  })

  const rawData = reportRes?.data || []
  const schools = schoolsRes?.data || []

  const previewData = useMemo(() => {
    if (reportType === "teachers_by_unit") {
        if (selectedUnit === "all") return rawData
        return rawData.filter((t: any) => t.school?.nama === selectedUnit || t.school_id?.toString() === selectedUnit)
    }
    // Handle stats/rekap logic if needed, otherwise return raw
    return rawData
  }, [rawData, reportType, selectedUnit])

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-10 pb-20">
      <div className="flex items-center justify-between print:hidden">
        <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase italic">Analytical Reporting</h1>
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2">
               <BarChart3 className="w-3 h-3 text-blue-500" /> Executive Summaries & Granular Institutional Data Rekap
            </p>
        </div>
        <Button onClick={handlePrint} className="h-14 rounded-2xl px-10 bg-slate-900 hover:bg-black text-white font-black uppercase text-xs tracking-widest shadow-xl shadow-slate-100" disabled={isLoading}>
          <Printer className="mr-3 h-5 w-5" /> Cetak Dokumen (PDF)
        </Button>
      </div>

      <Card className="border-0 shadow-sm bg-white rounded-[2.5rem] overflow-hidden print:hidden">
        <CardHeader className="p-10 border-b bg-slate-50/50">
          <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-3">
            <Search className="w-5 h-5 text-blue-500" /> Filter Kriteria Laporan
          </CardTitle>
        </CardHeader>
        <CardContent className="p-10 grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-3">
                <label className="text-[10px] font-black uppercase text-slate-400">Dimensi Laporan</label>
                <Select value={reportType} onValueChange={setReportType}>
                    <SelectTrigger className="h-14 rounded-2xl border-slate-200 font-bold">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                        <SelectItem value="teachers_by_unit">Daftar Guru per Unit Kerja</SelectItem>
                        <SelectItem value="stats">Statistik & Rekapitulasi</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            {reportType === "teachers_by_unit" && (
                <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-slate-400">Filter Unit Kerja</label>
                    <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                        <SelectTrigger className="h-14 rounded-2xl border-slate-200 font-bold">
                            <SelectValue placeholder="Semua Unit" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl max-h-64">
                            <SelectItem value="all">-- Semua Unit Madrasah --</SelectItem>
                            {schools.map((s: any) => (
                                <SelectItem key={s.id} value={s.nama}>{s.nama}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}
        </CardContent>
      </Card>

      <div className="bg-white rounded-[3rem] p-4 sm:p-0">
          {/* HEADER CETAK RAFI */}
          <div className="hidden print:block mb-12 border-b-[3px] border-slate-900 pb-8 text-center bg-slate-50 p-10 rounded-[2rem]">
              <div className="flex items-center justify-center gap-4 mb-4">
                  <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl italic">M</div>
                  <div className="text-left">
                      <h2 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900">LP Ma'arif NU Cilacap</h2>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sistem Informasi Manajemen Madrasah Terpadu</p>
                  </div>
              </div>
              <h3 className="text-xl font-black mt-6 uppercase tracking-tight text-slate-800 italic underline decoration-blue-500 decoration-4 underline-offset-8">
                  {reportType === 'stats' ? 'Laporan Statistik Kepegawaian' : `Rekapitulasi Data Guru - ${selectedUnit === 'all' ? 'Seluruh Unit' : selectedUnit}`}
              </h3>
              <div className="mt-8 flex justify-center gap-10">
                  <div className="text-center">
                      <p className="text-[9px] font-black text-slate-300 uppercase">Timestamp</p>
                      <p className="text-xs font-bold text-slate-600">{new Date().toLocaleString("id-ID")}</p>
                  </div>
                  <div className="text-center">
                      <p className="text-[9px] font-black text-slate-300 uppercase">Total Data</p>
                      <p className="text-xs font-bold text-slate-600">{previewData.length} Records</p>
                  </div>
              </div>
          </div>

          <div className="rounded-[2.5rem] overflow-hidden border border-slate-100 print:border-slate-200 shadow-sm relative">
            <Table className="print:text-xs">
                <TableHeader className="bg-slate-50/50 print:bg-slate-100">
                    <TableRow className="border-b border-slate-100">
                        <TableHead className="p-8 text-[10px] font-black uppercase text-slate-400 tracking-widest w-[60px]">No</TableHead>
                        <TableHead className="p-8 text-[10px] font-black uppercase text-slate-400 tracking-widest">Identitas Pendidik</TableHead>
                        <TableHead className="p-8 text-[10px] font-black uppercase text-slate-400 tracking-widest">NIP / NUPTK</TableHead>
                        <TableHead className="p-8 text-[10px] font-black uppercase text-slate-400 tracking-widest">Status / Jabatan</TableHead>
                        <TableHead className="p-8 text-[10px] font-black uppercase text-slate-400 tracking-widest">Unit Kerja</TableHead>
                        <TableHead className="p-8 text-[10px] font-black uppercase text-slate-400 tracking-widest">Mapel Pengampu</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-32 animate-pulse uppercase font-black text-slate-200 text-xs italic tracking-widest">Constructing Report Data Structure...</TableCell></TableRow>
                    ) : previewData.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center py-32 font-bold text-slate-300 text-xs italic">Data query returned null set.</TableCell>
                        </TableRow>
                    ) : (
                        previewData.map((rox: any, i: number) => (
                            <TableRow key={i} className="hover:bg-slate-50/30 transition-colors border-b border-slate-50 print:break-inside-avoid">
                                <TableCell className="p-8 font-black text-slate-300 text-xs">{i + 1}</TableCell>
                                <TableCell className="p-8">
                                    <div className="font-black text-slate-800 text-xs tracking-tight uppercase">{rox.nama}</div>
                                    <div className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{rox.pendidikan_terakhir || '-'}</div>
                                </TableCell>
                                <TableCell className="p-8 font-bold text-slate-500 text-[10px]">{rox.nip || rox.nuptk || '-'}</TableCell>
                                <TableCell className="p-8">
                                    <Badge variant="outline" className="rounded-lg text-[9px] font-black uppercase px-2 py-0.5 border-slate-200 text-slate-600">{rox.status_kepegawaian}</Badge>
                                </TableCell>
                                <TableCell className="p-8 font-bold text-slate-500 text-[10px] italic">{rox.school?.nama || '-'}</TableCell>
                                <TableCell className="p-8 font-bold text-blue-500 text-[10px] uppercase">{rox.mata_pelajaran || '-'}</TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
          </div>

          <div className="hidden print:grid grid-cols-2 mt-20 w-full break-inside-avoid px-20">
              <div className="text-center opacity-0">DUMMY</div>
              <div className="text-center">
                  <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Ditetapkan di Cilacap, {new Date().toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  <p className="text-xs font-black uppercase text-slate-800 italic">Ketua Pengurus Cabang</p>
                  <div className="h-32"></div>
                  <div className="inline-block border-b-2 border-slate-900 px-10">
                      <p className="font-black text-sm uppercase text-slate-900 tracking-tighter">H. MUNIB, S.Ag., M.Pd.</p>
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">NIY. 19741231 200001 1001</p>
              </div>
          </div>
      </div>
    </div>
  )
}
