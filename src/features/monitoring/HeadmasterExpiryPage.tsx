import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FileDown, AlertTriangle, CheckCircle, Loader2, Calendar, UserCheck } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { headmasterApi } from "@/lib/api"
import * as XLSX from "xlsx"

export default function HeadmasterExpiryPage() {
    // 🔥 REST API QUERY
    const { data: headmasters = [], isLoading } = useQuery({
        queryKey: ['headmasters-expiring'],
        queryFn: () => headmasterApi.expiring()
    })

    const handleDownloadExcel = () => {
        const data = headmasters.map((h: any, i: number) => ({
            "No": i + 1,
            "Nama Kepala": h.nama,
            "Unit Kerja": h.unit_kerja,
            "TMT Awal": new Date(h.start_date).toLocaleDateString("id-ID"),
            "Tanggal Habis Masa Jabatan": new Date(h.end_date).toLocaleDateString("id-ID"),
            "Sisa Waktu (Hari)": h.days_remaining < 0 ? `Lewat ${Math.abs(h.days_remaining)} hari` : `${h.days_remaining} hari`,
            "Status": h.status === "expired" ? "Sudah Habis" : "Akan Habis"
        }))

        const ws = XLSX.utils.json_to_sheet(data)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Kepala Expired")
        XLSX.writeFile(wb, `Monitoring_Kamad_Expired_${new Date().toISOString().split('T')[0]}.xlsx`)
    }

    if (isLoading) return (
        <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 text-slate-300">
            <Loader2 className="h-10 w-10 animate-spin" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Menghitung Masa Jabatan...</span>
        </div>
    )

    return (
        <div className="space-y-10 pb-20">
            <div className="flex items-center justify-between">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">Monitoring Masa Jabatan</h1>
                    <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                        Peringatan Dini Kepala Madrasah dengan masa bhakti <span className="text-blue-600">≤ 6 Bulan (180 Hari)</span>
                    </p>
                </div>
                <Button onClick={handleDownloadExcel} disabled={!headmasters.length} className="h-14 px-10 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-xs tracking-widest shadow-xl shadow-emerald-100">
                    <FileDown className="mr-2 h-5 w-5" /> Download Excel
                </Button>
            </div>

            <Card className="border-0 shadow-sm bg-white rounded-[2.5rem] overflow-hidden">
                <CardHeader className="p-10 border-b bg-slate-50/50">
                    <CardTitle className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-amber-100 rounded-lg text-amber-600"><Calendar className="h-5 w-5" /></div>
                        Daftar Peringatan Dini
                    </CardTitle>
                    <CardDescription className="text-xs font-medium text-slate-400">
                        Sistem mendeteksi {headmasters.length} jabatan yang mendekati atau telah melewati batas maksimal.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-50 border-b border-slate-100">
                                <TableRow>
                                    <TableHead className="w-[80px] text-center text-[10px] font-black uppercase text-slate-400 py-6">No</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-6">Informasi Kepala</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-6">Unit Kerja</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-6 text-center">Periode</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-6">Masa Jabatan</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-6 text-center">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {headmasters.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center h-48">
                                            <div className="flex flex-col items-center justify-center gap-4">
                                                <div className="bg-emerald-100 p-4 rounded-full"><CheckCircle className="h-8 w-8 text-emerald-600" /></div>
                                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Seluruh jabatan madrasah dalam kondisi aman</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    headmasters.map((h: any, i: number) => (
                                        <TableRow key={h.id} className={`hover:bg-slate-50/50 transition-colors ${h.status === 'expired' || h.status === 'limit_exceeded' ? 'bg-rose-50/30' : ''}`}>
                                            <TableCell className="text-center font-bold text-slate-400 text-sm py-6 pl-10">{i + 1}</TableCell>
                                            <TableCell className="py-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-slate-100 p-2 rounded-lg"><UserCheck className="h-4 w-4 text-slate-500" /></div>
                                                    <div>
                                                        <div className="font-black text-slate-800 text-sm tracking-tight">{h.nama}</div>
                                                        {h.status === 'limit_exceeded' && <span className="text-[9px] font-black text-rose-600 bg-rose-100 px-2 py-0.5 rounded-md uppercase mt-1 inline-block">Maksimal 3 Periode!</span>}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-6 text-xs font-bold text-slate-500">{h.unit_kerja}</TableCell>
                                            <TableCell className="py-6 text-center font-black text-xs">
                                                <span className="px-3 py-1 bg-slate-100 rounded-lg">{h.period_number} / 3</span>
                                            </TableCell>
                                            <TableCell className="py-6">
                                                <div className="text-[10px] font-black text-slate-400 uppercase">Hingga</div>
                                                <div className="text-xs font-bold text-slate-700">{new Date(h.end_date).toLocaleDateString("id-ID", {day:'numeric', month:'long', year:'numeric'})}</div>
                                                <div className={`text-[10px] font-black uppercase mt-1 ${h.days_remaining < 0 ? "text-rose-600" : "text-amber-600"}`}>
                                                    {h.days_remaining < 0 ? `Lewat ${Math.abs(h.days_remaining)} Hari` : `${h.days_remaining} Hari Tersisa`}
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-6 text-center">
                                                <span className={`inline-flex px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-tight ${
                                                    h.status === 'expired' || h.status === 'limit_exceeded' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                                                }`}>
                                                    <AlertTriangle className="w-3 h-3 mr-1.5" />
                                                    {h.status === 'limit_exceeded' ? 'MAX LIMIT' : h.status.toUpperCase()}
                                                </span>
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
