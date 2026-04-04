import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportApi, schoolApi, authApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Download, Loader2, RefreshCw, FileText } from 'lucide-react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'

export default function SkReportPage() {
  const user = authApi.getStoredUser()
  const isOperator = user?.role === 'operator'

  // State
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedSchool, setSelectedSchool] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')

  // 🔥 REST API QUERIES
  const { data: schoolsData } = useQuery({
    queryKey: ['schools-list-all'],
    queryFn: () => schoolApi.list({ per_page: 100 }),
    enabled: !isOperator
  })
  
  const { data: reportData, isLoading, refetch } = useQuery({
    queryKey: ['sk-report', startDate, endDate, selectedSchool, selectedStatus],
    queryFn: () => reportApi.skReport({
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      school_id: selectedSchool !== 'all' ? selectedSchool : undefined,
      status: selectedStatus !== 'all' ? selectedStatus : undefined
    })
  })

  // Excel Export Handler
  const handleExportExcel = () => {
    if (!reportData || !reportData.data || reportData.data.length === 0) {
      toast.error('Tidak ada data untuk di-export')
      return
    }

    try {
      const wb = XLSX.utils.book_new()

      // Header Laporan
      const summaryData = [
        ['LAPORAN SURAT KEPUTUSAN DIGITAL'],
        ['LP MAARIF NU CILACAP'],
        ['Tanggal Cetak:', new Date().toLocaleString('id-ID')],
        [],
        ['RINGKASAN STATUS'],
        ['Total Dokumen', reportData.summary.total],
        ['Draft / Pending', reportData.summary.draft + reportData.summary.pending],
        ['Disetujui', reportData.summary.approved],
        ['Ditolak', reportData.summary.rejected],
        [],
      ]
      
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData)
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan')

      // Data Sheet
      const sheetData = reportData.data.map((sk: any, index: number) => ({
        'No': index + 1,
        'Nomor SK': sk.nomor_sk,
        'Jenis SK': sk.jenis_sk,
        'Nama Lengkap': sk.nama,
        'Unit Kerja': sk.unit_kerja,
        'Status Approval': sk.status.toUpperCase(),
        'Tanggal Penetapan': sk.tanggal_penetapan || '-',
        'Tanggal Dibuat': new Date(sk.created_at).toLocaleDateString('id-ID'),
      }))
      
      const wsData = XLSX.utils.json_to_sheet(sheetData)
      wsData['!cols'] = [{ wch: 5 }, { wch: 25 }, { wch: 20 }, { wch: 30 }, { wch: 30 }, { wch: 15 }, { wch: 20 }, { wch: 20 }]
      XLSX.utils.book_append_sheet(wb, wsData, 'Daftar SK')

      XLSX.writeFile(wb, `Laporan_SK_Maarif_${new Date().toISOString().split('T')[0]}.xlsx`)
      toast.success('Laporan berhasil diunduh')
    } catch (error) {
      toast.error('Gagal export data')
    }
  }

  return (
    <div className="space-y-10 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">Laporan Produk Hukum</h1>
        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">
           Monitoring & Export Dokumen SK Digital Seluruh Cabang
        </p>
      </div>

      <div className="grid gap-10 md:grid-cols-3">
          {/* Filters */}
          <Card className="md:col-span-1 border-0 shadow-sm bg-white rounded-[2.5rem] overflow-hidden self-start">
             <CardHeader className="p-8 border-b bg-slate-50/50">
                <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-widest">Filter Laporan</CardTitle>
             </CardHeader>
             <CardContent className="p-8 space-y-6">
                <div className="space-y-4">
                    <Label className="text-[9px] font-black uppercase text-slate-400">Rentang Waktu</Label>
                    <div className="grid gap-3">
                        <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-11 rounded-xl border-slate-200 text-xs font-bold" />
                        <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-11 rounded-xl border-slate-200 text-xs font-bold" />
                    </div>
                </div>

                {!isOperator && (
                    <div className="space-y-4">
                        <Label className="text-[9px] font-black uppercase text-slate-400">Madrasah</Label>
                        <Select value={selectedSchool} onValueChange={setSelectedSchool}>
                            <SelectTrigger className="h-11 rounded-xl border-slate-200 font-bold text-xs">
                                <SelectValue placeholder="Semua Sekolah" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Seluruh Madrasah</SelectItem>
                                {schoolsData?.data?.map((s: any) => (
                                    <SelectItem key={s.id} value={s.id.toString()}>{s.nama}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                <div className="space-y-4">
                        <Label className="text-[9px] font-black uppercase text-slate-400">Status Dokumen</Label>
                        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                            <SelectTrigger className="h-11 rounded-xl border-slate-200 font-bold text-xs">
                                <SelectValue placeholder="Semua Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Status</SelectItem>
                                <SelectItem value="pending">Pending Review</SelectItem>
                                <SelectItem value="approved">Diterbitkan</SelectItem>
                                <SelectItem value="rejected">Ditolak</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                <div className="pt-4 border-t flex flex-col gap-2">
                    <Button variant="ghost" onClick={() => { setStartDate(''); setEndDate(''); setSelectedSchool('all'); setSelectedStatus('all')}} className="text-[10px] font-black uppercase text-slate-400 hover:text-blue-600 tracking-widest">Reset Filter</Button>
                    <Button onClick={() => refetch()} className="h-12 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 border-0 font-black uppercase text-[10px] tracking-widest">
                        <RefreshCw className="mr-2 h-4 w-4" /> Perbarui Data
                    </Button>
                </div>
             </CardContent>
          </Card>

          {/* Results & Charts */}
          <div className="md:col-span-2 space-y-8">
                {/* Stats Grid */}
                {reportData ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50">
                            <div className="text-3xl font-black text-slate-900">{reportData.summary.total}</div>
                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Total SK</div>
                        </div>
                        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50">
                            <div className="text-3xl font-black text-amber-500">{reportData.summary.pending}</div>
                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Antrian</div>
                        </div>
                        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50">
                            <div className="text-3xl font-black text-emerald-500">{reportData.summary.approved}</div>
                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Terbit</div>
                        </div>
                         <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50">
                            <div className="text-3xl font-black text-rose-500">{reportData.summary.rejected}</div>
                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Ditolak</div>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-4 gap-4 animate-pulse">
                         {[1,2,3,4].map(i => <div key={i} className="h-28 bg-slate-100 rounded-[2rem]" />)}
                    </div>
                )}

                {/* Preview Table */}
                <Card className="border-0 shadow-sm bg-white rounded-[2.5rem] overflow-hidden">
                    <CardHeader className="p-8 border-b bg-slate-50/50 flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-widest">Preview 10 Dokumen Terbaru</CardTitle>
                        </div>
                        <Button onClick={handleExportExcel} disabled={isLoading || !reportData?.data?.length} className="h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[10px] tracking-widest px-6 shadow-lg shadow-blue-100">
                             <Download className="mr-2 h-4 w-4" /> Export Excel
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        {isLoading ? (
                            <div className="p-20 flex flex-col items-center justify-center gap-4 text-slate-300">
                                <Loader2 className="h-8 w-8 animate-spin" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Mengkalkulasi Data...</span>
                            </div>
                        ) : reportData?.data?.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 border-b border-slate-100">
                                        <tr>
                                            <th className="px-8 py-5 text-[9px] font-black uppercase text-slate-400 tracking-widest">No</th>
                                            <th className="px-6 py-5 text-[9px] font-black uppercase text-slate-400 tracking-widest">Nomor SK</th>
                                            <th className="px-6 py-5 text-[9px] font-black uppercase text-slate-400 tracking-widest">PTK</th>
                                            <th className="px-6 py-5 text-[9px] font-black uppercase text-slate-400 tracking-widest">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {reportData.data.slice(0, 10).map((sk: any, idx: number) => (
                                            <tr key={sk.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-8 py-5 text-xs font-bold text-slate-400">{idx + 1}</td>
                                                <td className="px-6 py-5">
                                                    <div className="flex items-center gap-2">
                                                        <FileText className="h-4 w-4 text-blue-500" />
                                                        <span className="font-mono text-xs font-bold text-slate-700">{sk.nomor_sk}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="font-bold text-slate-800 text-sm">{sk.nama}</div>
                                                    <div className="text-[9px] font-bold text-slate-400 uppercase mt-1">{sk.unit_kerja}</div>
                                                </td>
                                                <td className="px-6 py-5">
                                                     <div className={`inline-flex px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-tight ${
                                                         sk.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                                         sk.status === 'rejected' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                                                     }`}>
                                                         {sk.status}
                                                     </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-20 text-center text-[10px] font-black uppercase text-slate-300 tracking-widest">
                                Tidak ada data yang sesuai filter
                            </div>
                        )}
                    </CardContent>
                </Card>
          </div>
      </div>
    </div>
  )
}
