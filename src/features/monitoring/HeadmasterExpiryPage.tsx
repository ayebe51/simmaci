import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FileDown, AlertTriangle, CheckCircle } from "lucide-react"
import { useQuery } from "convex/react"
import { api } from "../../../convex/_generated/api"
import * as XLSX from "xlsx"



  export default function HeadmasterExpiryPage() {
    // Fetch from Convex
    const headmasters = useQuery(api.headmasters.getExpiringHeadmasters, { thresholdDays: 365 }) || []

  const handleDownloadExcel = () => {
    const data = headmasters.map((h, i) => ({
      "No": i + 1,
      "Nama Kepala": h.nama,
      "Unit Kerja": h.unitKerja,
      "TMT Awal": new Date(h.tmt).toLocaleDateString("id-ID"),
      "Tanggal Habis Masa Jabatan": new Date(h.expiryDate).toLocaleDateString("id-ID"),
      "Sisa Waktu (Hari)": h.daysRemaining < 0 ? `Lewat ${Math.abs(h.daysRemaining)} hari` : `${h.daysRemaining} hari`,
      "Status": h.status === "expired" ? "Sudah Habis" : "Akan Habis (< 1 Tahun)"
    }))

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Kepala Expired")
    XLSX.writeFile(wb, "Monitoring_Kepala_Madrasah_Expired.xlsx")
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Monitoring Kepala Madrasah</h1>
          <p className="text-muted-foreground">
            Daftar Kepala Madrasah yang masa jabatannya akan habis dalam 1 tahun ke depan atau sudah lewat.
          </p>
        </div>
        <Button onClick={handleDownloadExcel} className="bg-green-600 hover:bg-green-700">
          <FileDown className="mr-2 h-4 w-4" /> Download Excel
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Peringatan Dini</CardTitle>
          <CardDescription>
            Menampilkan {headmasters.length} data kepala yang perlu perhatian khusus.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">No</TableHead>
                  <TableHead>Nama Kepala</TableHead>
                  <TableHead>Unit Kerja</TableHead>
                  <TableHead>Periode Ke</TableHead>
                  <TableHead>TMT Awal</TableHead>
                  <TableHead>Habis Masa Jabatan</TableHead>
                  <TableHead>Sisa Waktu</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {headmasters.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                      <CheckCircle className="mx-auto h-8 w-8 text-green-500 mb-2" />
                      Tidak ada kepala madrasah yang masa jabatannya habis dalam 1 tahun ke depan.
                    </TableCell>
                  </TableRow>
                ) : (
                  headmasters.map((h, i) => (
                    <TableRow key={h.id} className={h.status === 'expired' || h.status === 'limit_exceeded' ? 'bg-red-50' : ''}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell className="font-medium">
                          {h.nama}
                          {h.status === 'limit_exceeded' && <span className="block text-xs text-red-600 font-bold">Max 3 Periode!</span>}
                      </TableCell>
                      <TableCell>{h.unitKerja}</TableCell>
                      <TableCell className="text-center font-bold">
                          {h.periode} / {h.maxPeriode}
                      </TableCell>
                      <TableCell>{new Date(h.tmt).toLocaleDateString("id-ID")}</TableCell>
                      <TableCell>{new Date(h.expiryDate).toLocaleDateString("id-ID")}</TableCell>
                      <TableCell className={h.daysRemaining < 0 ? "text-red-600 font-bold" : "text-amber-600 font-bold"}>
                         {h.daysRemaining < 0 ? `Lewat ${Math.abs(h.daysRemaining)} hari` : `${h.daysRemaining} hari`}
                      </TableCell>
                      <TableCell>
                        {h.status === 'expired' ? (
                            <span className="flex items-center text-red-600 text-xs font-bold border border-red-200 bg-red-100 px-2 py-1 rounded-full w-fit">
                                <AlertTriangle className="w-3 h-3 mr-1" /> EXPIRED
                            </span>
                        ) : h.status === 'limit_exceeded' ? (
                            <span className="flex items-center text-red-600 text-xs font-bold border border-red-200 bg-red-100 px-2 py-1 rounded-full w-fit">
                                <AlertTriangle className="w-3 h-3 mr-1" /> MAX LIMIT
                            </span>
                        ) : (
                            <span className="text-amber-600 text-xs font-bold border border-amber-200 bg-amber-100 px-2 py-1 rounded-full">
                                WARNING
                            </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
