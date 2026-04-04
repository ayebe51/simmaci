import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportApi, schoolApi, authApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Download, Printer, Filter, X, Check, ChevronsUpDown, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

const COLORS = {
  approved: '#10b981', 
  pending: '#f59e0b',
  rejected: '#ef4444',
  draft: '#94a3b8',
}

const TYPE_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4']

export default function SkReportPageSimple() {
  const user = authApi.getStoredUser()
  const isOperator = user?.role === 'operator'

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedSchool, setSelectedSchool] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [openSchool, setOpenSchool] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  // 🔥 REST API QUERIES
  const { data: schoolsData } = useQuery({
    queryKey: ['schools-list-all'],
    queryFn: () => schoolApi.list({ per_page: 200 }),
    enabled: !isOperator
  })

  const { data: reportData, isLoading } = useQuery({
    queryKey: ['sk-report-simple', startDate, endDate, selectedSchool, selectedStatus],
    queryFn: () => reportApi.skReport({
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      school_id: selectedSchool !== 'all' ? selectedSchool : undefined,
      status: selectedStatus !== 'all' ? selectedStatus : undefined
    })
  })

  const schools = useMemo(() => schoolsData?.data || [], [schoolsData])

  const handlePrint = () => window.print()

  const handleExportExcel = () => {
    if (!reportData || !reportData.data.length) return toast.error('Tidak ada data')
    try {
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(reportData.data.map((item: any, i: number) => ({
        'No': i + 1,
        'Nomor SK': item.nomor_sk,
        'Jenis SK': item.jenis_sk,
        'Nama': item.nama,
        'Unit Kerja': item.unit_kerja,
        'Status': item.status.toUpperCase(),
        'Tanggal': new Date(item.created_at).toLocaleDateString('id-ID')
      })))
      XLSX.utils.book_append_sheet(wb, ws, 'Data SK')
      XLSX.writeFile(wb, `Rekap_SK_${new Date().toISOString().split('T')[0]}.xlsx`)
    } catch (e) { toast.error('Gagal export') }
  }

  return (
    <div className="min-h-screen bg-slate-50/30 pb-20 relative font-sans">
      <style>{`@media print { .no-print { display: none !important; } .print-only { display: block !important; } table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #ddd; padding: 8px; } } .print-only { display: none; }`}</style>
      
      <div className="no-print bg-white border-b px-10 py-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Pusat Data & Laporan SK</h1>
          <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-1">Analytics & Reporting Engine v2.0</p>
        </div>
        <div className="flex gap-3">
           <Button variant="outline" onClick={handlePrint} className="rounded-xl font-bold uppercase text-[10px] tracking-widest border-slate-200">
             <Printer className="w-4 h-4 mr-2" /> PDF / Print
           </Button>
           <Button onClick={handleExportExcel} className="rounded-xl font-bold uppercase text-[10px] tracking-widest bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-100">
             <Download className="w-4 h-4 mr-2" /> Export Excel
           </Button>
        </div>
      </div>

      <div className="container mx-auto p-10 space-y-10">
        <Card className="no-print border-0 shadow-sm bg-white rounded-[2.5rem] overflow-visible">
          <CardContent className="p-10 grid grid-cols-1 md:grid-cols-4 gap-8">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Dimulai Dari</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-12 rounded-xl border-slate-200 font-bold" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Sampai Dengan</Label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-12 rounded-xl border-slate-200 font-bold" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Status Produk</Label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="h-12 rounded-xl border-slate-200 font-bold italic">
                    <SelectValue placeholder="Semua Status" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all">Seluruh Status</SelectItem>
                    <SelectItem value="approved">Diterbitkan (Valid)</SelectItem>
                    <SelectItem value="pending">Menunggu Review</SelectItem>
                    <SelectItem value="rejected">Ditolak / Revisi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {!isOperator && (
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Filter Madrasah</Label>
                  <Popover open={openSchool} onOpenChange={setOpenSchool}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="h-12 w-full justify-between rounded-xl border-slate-200 font-bold text-xs">
                        {selectedSchool !== "all" ? schools.find(s => s.id.toString() === selectedSchool)?.nama : "Seluruh Madrasah"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0 rounded-2xl shadow-2xl border-0 overflow-hidden" align="start">
                        <div className="bg-white">
                            <Input placeholder="Cari madrasah..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="border-0 rounded-none h-14 px-6 focus-visible:ring-0 font-bold bg-slate-50" />
                            <div className="max-h-[300px] overflow-y-auto p-2 space-y-1">
                                <div onClick={() => { setSelectedSchool("all"); setOpenSchool(false) }} className={`flex items-center px-4 py-3 rounded-xl text-xs font-bold cursor-pointer hover:bg-slate-100 ${selectedSchool === 'all' ? 'bg-blue-50 text-blue-600' : ''}`}>
                                    <Check className={`mr-2 h-4 w-4 ${selectedSchool === 'all' ? 'opacity-100' : 'opacity-0'}`} /> Semua Sekolah
                                </div>
                                {schools.filter(s => s.nama.toLowerCase().includes(searchQuery.toLowerCase())).map(s => (
                                    <div key={s.id} onClick={() => { setSelectedSchool(s.id.toString()); setOpenSchool(false) }} className={`flex items-center px-4 py-3 rounded-xl text-xs font-bold cursor-pointer hover:bg-slate-100 ${selectedSchool === s.id.toString() ? 'bg-blue-50 text-blue-600' : ''}`}>
                                        <Check className={`mr-2 h-4 w-4 ${selectedSchool === s.id.toString() ? 'opacity-100' : 'opacity-0'}`} /> {s.nama}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
          </CardContent>
        </Card>

        {isLoading ? (
            <div className="flex flex-col items-center justify-center p-20 gap-4 text-slate-300">
                <Loader2 className="h-10 w-10 animate-spin" />
                <span className="text-[10px] font-black uppercase tracking-widest italic">Syncing Data Intelligence...</span>
            </div>
        ) : reportData && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 no-print">
               <Card className="border-0 shadow-sm bg-white rounded-[2.5rem] p-10 h-[350px]">
                    <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-6">Distribusi Status Dokumen</div>
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={[
                                    { name: 'Terbit', value: reportData.summary.approved, fill: COLORS.approved },
                                    { name: 'Pending', value: reportData.summary.pending, fill: COLORS.pending },
                                    { name: 'Ditolak', value: reportData.summary.rejected, fill: COLORS.rejected },
                                ].filter(x => x.value > 0)}
                                cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={8} dataKey="value"
                                label={({name, percent}: any) => `${name} (${(percent * 100).toFixed(0)}%)`}
                            >
                                <Cell fill={COLORS.approved} /><Cell fill={COLORS.pending} /><Cell fill={COLORS.rejected} />
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
               </Card>
               <Card className="border-0 shadow-sm bg-white rounded-[2.5rem] p-10 h-[350px]">
                    <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-6">Breakdown Kategori SK</div>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart layout="vertical" data={[
                                { name: 'GTY', val: reportData.byType?.gty || 0 },
                                { name: 'GTT', val: reportData.byType?.gtt || 0 },
                                { name: 'Kamad', val: reportData.byType?.kamad || 0 },
                                { name: 'Tendik', val: reportData.byType?.tendik || 0 },
                            ]} margin={{ left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                            <XAxis type="number" hide /><YAxis dataKey="name" type="category" width={80} axisLine={false} tickLine={false} className="text-[10px] font-bold" />
                            <Tooltip cursor={{fill: '#f8fafc'}} />
                            <Bar dataKey="val" radius={[0, 8, 8, 0]}>
                                { [0,1,2,3].map((_, i) => <Cell key={i} fill={TYPE_COLORS[i % 4]} />) }
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
               </Card>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 no-print">
               {[
                 { label: 'Total Rekap', val: reportData.summary.total, color: 'text-slate-900', bg: 'bg-white' },
                 { label: 'Tervalidasi', val: reportData.summary.approved, color: 'text-emerald-600', bg: 'bg-emerald-50/50' },
                 { label: 'Antrian', val: reportData.summary.pending, color: 'text-amber-600', bg: 'bg-amber-50/50' },
                 { label: 'Ditolak', val: reportData.summary.rejected, color: 'text-rose-600', bg: 'bg-rose-50/50' }
               ].map((s, i) => (
                 <div key={i} className={`${s.bg} p-8 rounded-[2rem] border border-white flex flex-col items-center justify-center hover:-translate-y-1 transition-transform`}>
                    <span className={`text-4xl font-black ${s.color} tracking-tighter`}>{s.val}</span>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2">{s.label}</span>
                 </div>
               ))}
            </div>

            <div className="print-only text-center py-10">
                <h2 className="text-xl font-black uppercase">Rekapitulasi Produk Hukum SK Digital</h2>
                <h3 className="text-sm font-bold text-slate-500 uppercase">LP Ma'arif NU Cilacap</h3>
                <p className="text-xs font-medium mt-2 italic">Periode: {startDate || 'Awal'} s/d {endDate || 'Sekarang'}</p>
                <div className="border-b-2 border-slate-200 mt-6" />
            </div>

            <Card className="border-0 shadow-sm bg-white rounded-[2.5rem] overflow-hidden">
               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                   <thead className="bg-slate-50 border-b border-slate-100">
                     <tr>
                       <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">No</th>
                       <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Nomor Seri SK</th>
                       <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Penerima SK</th>
                       <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Unit Kerja</th>
                       <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Status</th>
                       <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Tgl Terbit</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50">
                     {reportData.data.map((row: any, i: number) => (
                        <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-6 text-center font-bold text-slate-400 text-xs">{i+1}</td>
                          <td className="p-6 font-mono text-xs font-bold text-slate-600">{row.nomor_sk || '--/--/--'}</td>
                          <td className="p-6">
                             <div className="font-black text-slate-800 text-sm tracking-tight">{row.nama}</div>
                             <div className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{row.jenis_sk}</div>
                          </td>
                          <td className="p-6 text-xs font-bold text-slate-500">{row.unit_kerja}</td>
                          <td className="p-6 text-center">
                             <span className={`inline-flex px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-tight ${
                               row.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                               row.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                             }`}> {row.status} </span>
                          </td>
                          <td className="p-6 text-center text-xs font-bold text-slate-400">
                             {new Date(row.created_at).toLocaleDateString('id-ID')}
                          </td>
                        </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </Card>

            <div className="print-only mt-10 flex justify-end">
                <div className="text-center w-64 border-t pt-2 border-slate-200">
                    <p className="text-xs font-bold">Cilacap, {new Date().toLocaleDateString('id-ID', {day:'numeric',month:'long',year:'numeric'})}</p>
                    <p className="text-[10px] uppercase font-black mt-1">PC LP Ma'arif NU Cilacap</p>
                    <div className="h-20" />
                    <p className="text-xs font-black underline uppercase">H. Munawar, S.Ag, M.Pd</p>
                </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
