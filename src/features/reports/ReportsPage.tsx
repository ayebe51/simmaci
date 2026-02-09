import { useState } from "react"
import { useQuery } from "convex/react"
import { api } from "../../../convex/_generated/api"
import SoftPageHeader from "@/components/ui/SoftPageHeader"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileDown, Calendar, Users, FileText, Filter, AlertCircle, CheckCircle2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

export default function ReportsPage() {
    const currentYear = new Date().getFullYear()
    const [selectedMonth, setSelectedMonth] = useState<string>(
        `${String(new Date().getMonth() + 1).padStart(2, '0')}-${currentYear}`
    )
    
    // Parse selected month for display
    const [monthStr, yearStr] = selectedMonth.split("-")
    const displayDate = new Date(parseInt(yearStr), parseInt(monthStr) - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })

    const reportData = useQuery(api.reports.getMonthlyReport, { 
        month: selectedMonth 
    })

    const generateMonths = () => {
        const months = []
        // Generate last 12 months
        for (let i = 0; i < 12; i++) {
            const d = new Date()
            d.setMonth(d.getMonth() - i)
            const m = String(d.getMonth() + 1).padStart(2, '0')
            const y = d.getFullYear()
            months.push({ 
                value: `${m}-${y}`, 
                label: d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) 
            })
        }
        return months
    }

    const handleDownloadPdf = () => {
        toast.info("Fitur Download PDF sedang diproses...", {
            description: "Modul PDF Generator akan segera hadir."
        })
        // In future: active client-side PDF generation here
    }

    return (
        <div className="space-y-6 pb-20">
             <SoftPageHeader 
                title="Laporan Bulanan" 
                subtitle="Rekapitulasi data guru dan penerbitan SK per periode"
                icon={FileText}
                action={
                    <Button onClick={handleDownloadPdf} className="bg-red-600 hover:bg-red-700 text-white gap-2 shadow-sm">
                        <FileDown className="h-4 w-4" />
                        Download PDF
                    </Button>
                }
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Filter Card */}
                <Card className="md:col-span-1 shadow-sm border-slate-200">
                    <CardHeader className="pb-3 bg-slate-50 border-b">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Filter className="h-4 w-4 text-slate-500" />
                            Filter Periode
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Pilih Bulan</label>
                                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {generateMonths().map((m) => (
                                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-800 flex items-start gap-2">
                                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                <p>Laporan ini mencakup data guru aktif dan SK yang diterbitkan pada periode <b>{displayDate}</b>.</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Main Stats Card */}
                <Card className="md:col-span-2 shadow-md border-t-4 border-t-emerald-500">
                    <CardHeader>
                        <div className="flex justify-between items-start">
                             <div>
                                <CardTitle>Ringkasan Laporan</CardTitle>
                                <CardDescription>Periode: {displayDate}</CardDescription>
                             </div>
                             <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 px-3 py-1">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Data Realtime
                             </Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {reportData ? (
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                               <div className="space-y-4">
                                   <div className="p-4 rounded-xl border bg-slate-50">
                                       <div className="text-sm text-slate-500 mb-1 flex items-center gap-2">
                                           <Users className="h-4 w-4" /> Total Guru Aktif
                                       </div>
                                       <div className="text-3xl font-bold text-slate-900">{reportData.totalTeachers}</div>
                                   </div>
                                   
                                   <div className="grid grid-cols-2 gap-2">
                                       <div className="p-3 rounded-lg border bg-white">
                                           <div className="text-xs text-slate-500">PNS / ASN</div>
                                           <div className="text-xl font-semibold text-blue-600">{reportData.statusBreakdown.pns}</div>
                                       </div>
                                       <div className="p-3 rounded-lg border bg-white">
                                           <div className="text-xs text-slate-500">GTY</div>
                                           <div className="text-xl font-semibold text-emerald-600">{reportData.statusBreakdown.gty}</div>
                                       </div>
                                       <div className="p-3 rounded-lg border bg-white">
                                           <div className="text-xs text-slate-500">GTT</div>
                                           <div className="text-xl font-semibold text-amber-600">{reportData.statusBreakdown.gtt}</div>
                                       </div>
                                       <div className="p-3 rounded-lg border bg-white">
                                           <div className="text-xs text-slate-500">Tendik</div>
                                           <div className="text-xl font-semibold text-purple-600">{reportData.statusBreakdown.tendik}</div>
                                       </div>
                                   </div>
                               </div>

                               <div className="space-y-4">
                                   <div className="p-4 rounded-xl border bg-amber-50 border-amber-100">
                                       <div className="text-sm text-amber-800 mb-1 flex items-center gap-2">
                                           <FileText className="h-4 w-4" /> SK Terbit Bulan Ini
                                       </div>
                                       <div className="text-3xl font-bold text-amber-900">{reportData.newSkIssued}</div>
                                       <div className="text-xs text-amber-700 mt-1">Dokumen Pengangkatan, Mutasi, dll.</div>
                                   </div>
                                   
                                   <div className="p-3 rounded-lg border border-dashed text-center h-32 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
                                       <div className="text-sm font-medium">Grafik Tren (Coming Soon)</div>
                                       <div className="text-xs">Visualisasi data bulanan akan tampil di sini.</div>
                                   </div>
                               </div>
                           </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 space-y-4 text-center animate-pulse">
                                <div className="h-10 w-10 bg-slate-200 rounded-full"></div>
                                <div className="space-y-2">
                                    <div className="h-4 w-40 bg-slate-200 rounded mx-auto"></div>
                                    <div className="h-3 w-20 bg-slate-200 rounded mx-auto"></div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
