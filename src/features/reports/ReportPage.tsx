import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Printer, Search, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
// import { api } from "@/lib/api"
import { useQuery } from "convex/react"
import { api as convexApi } from "../../../convex/_generated/api"
import { toast } from "sonner"

export default function ReportPage() {
  const [reportType, setReportType] = useState("teachers_by_unit")
  const [selectedUnit, setSelectedUnit] = useState("all")
  const [units, setUnits] = useState<string[]>([])
  const [previewData, setPreviewData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [allData, setAllData] = useState<any[]>([])
  
  // 🔥 CONVEX REAL-TIME DATA
  const convexTeachers = useQuery(convexApi.teachers.list) || []
  
  // Transform Convex Data to Report Format
  useEffect(() => {
      if (!convexTeachers) return
      
      const mapped = convexTeachers.map((t: any) => ({
          ...t,
          unitKerja: t.unitKerja || t.satminkal || "Tanpa Unit",
          nip: t.nuptk || t.nip || "-",
          // Ensure status is normalized if needed
          status: t.status || "-"
      }))
      
      setAllData(mapped)
      setIsLoading(false)

      // Extract unique Units
      const uniqueUnits = Array.from(new Set(mapped.map((t: any) => t.unitKerja))).sort() as string[]
      setUnits(uniqueUnits)
      
      generatePreview(mapped, reportType, selectedUnit)

  }, [convexTeachers, reportType, selectedUnit])

  const generatePreview = (teachers: any[], type: string, unit: string) => {
      if (type === "teachers_by_unit") {
          let filtered = teachers
          if (unit !== "all") {
              filtered = teachers.filter(t => t.unitKerja === unit)
          }
          setPreviewData(filtered)
      } else if (type === "stats") {
          // Generate Stats (PNS, GTY, GTT)
          const stats: Record<string, any> = {}
          teachers.forEach(t => {
              const u = t.unitKerja || "Tanpa Unit"
              if (!stats[u]) stats[u] = { name: u, pns: 0, gty: 0, gtt: 0, total: 0 }
              
              const s = (t.status || "").toUpperCase()
              if (s.includes("PNS") || s.includes("ASN") || s.includes("PPPK")) stats[u].pns++
              else if (s.includes("GTY")) stats[u].gty++
              else stats[u].gtt++
              
              stats[u].total++
          })
          setPreviewData(Object.values(stats))
      }
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Laporan & Rekapitulasi</h1>
          <p className="text-muted-foreground">
            Cetak laporan data guru dan statistik kepegawaian (Realtime Data).
          </p>
        </div>
        <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
          <Printer className="mr-2 h-4 w-4" /> Cetak Laporan (PDF)
        </Button>
      </div>

      {/* FILTERS - HIDDEN ON PRINT */}
      <Card className="print:hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5"/> Filter Laporan
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-4">
            <div className="w-full md:w-1/3 space-y-2">
                <label className="text-sm font-medium">Jenis Laporan</label>
                <Select value={reportType} onValueChange={setReportType}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="teachers_by_unit">Daftar Guru per Unit Kerja</SelectItem>
                        <SelectItem value="stats">Statistik Kepegawaian (Rekap)</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            {reportType === "teachers_by_unit" && (
                <div className="w-full md:w-1/3 space-y-2">
                    <label className="text-sm font-medium">Pilih Unit Kerja</label>
                    <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                        <SelectTrigger>
                            <SelectValue placeholder="Semua Unit" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">-- Semua Unit --</SelectItem>
                            {units.map(u => (
                                <SelectItem key={u} value={u}>{u}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}
        </CardContent>
      </Card>

      {/* REPORT PREVIEW - VISIBLE ON PRINT */}
      <div className="print:block bg-white p-8 sm:p-0 min-h-[500px]">
          {/* HEADER CETAK */}
          <div className="hidden print:block mb-8 border-b-2 border-black pb-4 text-center">
              <h2 className="text-2xl font-bold uppercase">Lembaga Pendidikan Ma'arif NU Cilacap</h2>
              <p className="text-sm">Jl. Masjid No. 09, Cilacap Tengah, Kabupaten Cilacap</p>
              <h3 className="text-xl font-bold mt-4 uppercase">
                  {reportType === 'stats' ? 'Laporan Statistik Kepegawaian' : `Data Guru - ${selectedUnit === 'all' ? 'Semua Unit' : selectedUnit}`}
              </h3>
              <p className="text-sm text-gray-500">Tanggal Cetak: {new Date().toLocaleDateString("id-ID")}</p>
          </div>

          <div className="rounded-md border print:border-none">
            <Table className="print:text-sm">
                {reportType === "teachers_by_unit" ? (
                    <>
                        <TableHeader>
                            <TableRow className="bg-slate-100 print:bg-gray-200">
                                <TableHead className="w-[50px] font-bold text-black border print:border-black">No</TableHead>
                                <TableHead className="font-bold text-black border print:border-black">NIP / NUPTK</TableHead>
                                <TableHead className="font-bold text-black border print:border-black">Nama Lengkap</TableHead>
                                <TableHead className="font-bold text-black border print:border-black">Status</TableHead>
                                <TableHead className="font-bold text-black border print:border-black">Unit Kerja</TableHead>
                                <TableHead className="font-bold text-black border print:border-black">Mapel</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={6} className="text-center h-24"><Loader2 className="animate-spin inline mr-2"/> Memuat Data...</TableCell></TableRow>
                            ) : previewData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center h-24">Tidak ada data.</TableCell>
                                </TableRow>
                            ) : (
                                previewData.map((rox, i) => (
                                    <TableRow key={i} className="print:break-inside-avoid">
                                        <TableCell className="border print:border-black">{i + 1}</TableCell>
                                        <TableCell className="border print:border-black">{rox.nip}</TableCell>
                                        <TableCell className="font-medium border print:border-black">{rox.nama}</TableCell>
                                        <TableCell className="border print:border-black">{rox.status}</TableCell>
                                        <TableCell className="border print:border-black">{rox.unitKerja}</TableCell>
                                        <TableCell className="border print:border-black">{rox.mapel || '-'}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </>
                ) : (
                    <>
                        <TableHeader>
                            <TableRow className="bg-slate-100 print:bg-gray-200">
                                <TableHead className="w-[50px] font-bold text-black border print:border-black">No</TableHead>
                                <TableHead className="font-bold text-black border print:border-black">Unit Kerja</TableHead>
                                <TableHead className="font-bold text-black border print:border-black text-center">PNS/ASN</TableHead>
                                <TableHead className="font-bold text-black border print:border-black text-center">GTY</TableHead>
                                <TableHead className="font-bold text-black border print:border-black text-center">GTT/Guru Lain</TableHead>
                                <TableHead className="font-bold text-black border print:border-black text-center">Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                             {isLoading ? (
                                <TableRow><TableCell colSpan={6} className="text-center h-24"><Loader2 className="animate-spin inline mr-2"/> Memuat Statistik...</TableCell></TableRow>
                             ) : previewData.map((rox, i) => (
                                <TableRow key={i} className="print:break-inside-avoid">
                                    <TableCell className="border print:border-black">{i + 1}</TableCell>
                                    <TableCell className="font-medium border print:border-black">{rox.name}</TableCell>
                                    <TableCell className="text-center border print:border-black">{rox.pns}</TableCell>
                                    <TableCell className="text-center border print:border-black">{rox.gty}</TableCell>
                                    <TableCell className="text-center border print:border-black">{rox.gtt}</TableCell>
                                    <TableCell className="text-center font-bold border print:border-black">{rox.total}</TableCell>
                                </TableRow>
                             ))}
                        </TableBody>
                    </>
                )}
            </Table>
          </div>

          <div className="hidden print:flex justify-end mt-12 w-full break-inside-avoid">
              <div className="text-center mr-8">
                  <p>Cilacap, {new Date().toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  <p className="mt-2">Ketua Pengurus Cabang</p>
                  <div className="h-24"></div>
                  <p className="font-bold border-b border-black inline-block min-w-[200px]"></p>
              </div>
          </div>
      </div>
    </div>
  )
}
