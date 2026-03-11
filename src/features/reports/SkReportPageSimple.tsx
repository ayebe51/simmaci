import { useState, useMemo } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Download, Printer, Filter, X, Check, ChevronsUpDown } from 'lucide-react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

// Chart Colors
const COLORS = {
  approved: '#22c55e', // green-500
  pending: '#f59e0b', // amber-500
  rejected: '#ef4444', // red-500
  draft: '#94a3b8',    // slate-400
}

const TYPE_COLORS = [
    '#3b82f6', // blue
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#06b6d4', // cyan
]

export default function SkReportPageSimple() {
  // 1. User Context & Role Safety
   
  let user: any = null
  let isOperator = false
  let userUnitKerja = ''
  
  try {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      user = JSON.parse(userStr)
      isOperator = user.role === 'operator'
      userUnitKerja = user.unitKerja || ''
    }
  } catch (error) {
    console.error('Error parsing user:', error)
  }

  // 2. State Management
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedSchool, setSelectedSchool] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [openSchool, setOpenSchool] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  // 3. Data Fetching
  const convexSchools = useQuery(api.schools.list, { token: localStorage.getItem("token") || undefined })

  // Transform schools data
  const schools = useMemo(() => (convexSchools || [])
    .filter(s => s && s.nama)
    .map(s => ({
      _id: s._id,
      nama: s.nama
    })), [convexSchools])
  
  // Logic: Operator can only see their school
  const operatorSchool = isOperator ? schools.find(s => s.nama === userUnitKerja) : null
  const effectiveSchoolId = isOperator ? (operatorSchool?._id) : (selectedSchool !== 'all' ? selectedSchool : undefined)

  // Filter schools for dropdown search


  const queryArgs = {
    startDate: startDate ? new Date(startDate).getTime() : undefined,
    endDate: endDate ? new Date(endDate + 'T23:59:59').getTime() : undefined,
     
    schoolId: effectiveSchoolId as any, 
    status: (selectedStatus && selectedStatus !== 'all') ? selectedStatus : undefined,
  }

   
  const reportData = useQuery(api.reports.generateSkReport, queryArgs) as any

  // 4. Handlers
  const handlePrint = () => {
    window.print()
  }

  const handleExportExcel = () => {
    if (!reportData || !reportData.data || reportData.data.length === 0) {
      toast.error('Tidak ada data untuk di-export')
      return
    }

    try {
      const wb = XLSX.utils.book_new()

      // Summary Sheet
      const summaryData = [
        ['LAPORAN DATA SK'],
        ['Periode:', startDate && endDate ? `${startDate} s/d ${endDate}` : 'Semua Waktu'],
        ['Dicetak Oleh:', user?.nama || 'System'],
        ['Waktu Cetak:', new Date().toLocaleString('id-ID')],
        [],
        ['RINGKASAN'],
        ['Total Dokumen', reportData.summary.total],
        ['Draft', reportData.summary.draft],
        ['Pending', reportData.summary.pending],
        ['Approved', reportData.summary.approved],
        ['Rejected', reportData.summary.rejected]
      ]
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData)
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan')

      // Details Sheet
       
      const detailsData = reportData.data.map((item: any, i: number) => ({
        'No': i + 1,
        'Nomor SK': item.nomorSk,
        'Jenis SK': item.jenisSk,
        'Nama Guru': item.nama,
        'Unit Kerja': item.schoolName || '-',
        'Status': item.status,
        'Tanggal Input': new Date(item.createdAt).toLocaleDateString('id-ID')
      }))
      const wsDetails = XLSX.utils.json_to_sheet(detailsData)
      
      // Auto-width columns
      const wscols = Object.keys(detailsData[0] || {}).map(() => ({ wch: 20 }))
      wsDetails['!cols'] = wscols
      
      XLSX.utils.book_append_sheet(wb, wsDetails, 'Data Detail')

      XLSX.writeFile(wb, `Laporan_SK_${new Date().toISOString().split('T')[0]}.xlsx`)
      toast.success('Excel berhasil didownload')
    } catch (e) {
      console.error(e)
      toast.error('Gagal export excel')
    }
  }

  const resetFilters = () => {
    setStartDate('')
    setEndDate('')
    setSelectedSchool('all')
    setSelectedStatus('all')
    setSearchQuery("")
  }

  // 5. Render
  return (
    <div className="min-h-screen bg-slate-50/30 pb-20 relative">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-400/5 blur-[120px] pointer-events-none rounded-full" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-400/5 blur-[120px] pointer-events-none rounded-full" />
      
      {/* --- PRINT STYLE STYLE BLOCK --- */}
      <style>{`
        @media print {
          @page { size: landscape; margin: 10mm; }
          body { background: white; font-family: 'Times New Roman', serif; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .card-print { border: none !important; box-shadow: none !important; }
          table { width: 100%; border-collapse: collapse; font-size: 11pt; }
          th, td { border: 1px solid black; padding: 4px 8px; }
          th { background: #f0f0f0 !important; color: black !important; }
        }
        .print-only { display: none; }
      `}</style>
      
      {/* HEADER (Screen Only) */}
      <div className="no-print bg-white border-b px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Laporan & Rekap SK</h1>
          <p className="text-slate-500 text-sm">Download laporan format Excel atau cetak PDF langsung.</p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" onClick={handlePrint}>
             <Printer className="w-4 h-4 mr-2" />
             Cetak / PDF
           </Button>
           <Button className="bg-green-600 hover:bg-green-700" onClick={handleExportExcel}>
             <Download className="w-4 h-4 mr-2" />
             Export Excel
           </Button>
        </div>
      </div>

      <div className="container mx-auto p-4 space-y-6">
        
        {/* FILTERS (Screen Only) */}
        <Card className="no-print border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white/60 backdrop-blur-xl rounded-2xl relative z-10 overflow-visible">
          <CardHeader className="pb-4 border-b border-white/60 bg-white/40 rounded-t-2xl px-6 pt-6 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Filter className="w-4 h-4 text-emerald-600" /> Filter Laporan
            </CardTitle>
            {(startDate || endDate || selectedStatus !== 'all' || (selectedSchool !== 'all' && !isOperator)) && (
              <Button variant="ghost" size="sm" onClick={resetFilters} className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 px-3 rounded-xl transition-colors">
                <X className="w-3 h-3 mr-1" /> Reset
              </Button>
            )}
          </CardHeader>
          <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label htmlFor="startDate" className="text-xs">Tanggal Awal</Label>
                <input 
                  id="startDate"
                  type="date" 
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  aria-label="Tanggal Awal"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="endDate" className="text-xs">Tanggal Akhir</Label>
                <input 
                  id="endDate"
                  type="date" 
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  aria-label="Tanggal Akhir"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status SK</Label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Semua Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Status</SelectItem>
                    <SelectItem value="approved">Disetujui (Approved)</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="pending">Menunggu Review</SelectItem>
                    <SelectItem value="rejected">Ditolak</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {!isOperator && (
                <div className="space-y-1 flex flex-col">
                  <Label className="text-xs mb-1">Unit Kerja (Sekolah)</Label>
                  <Popover open={openSchool} onOpenChange={setOpenSchool}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openSchool}
                        className="h-9 w-full justify-between"
                      >
                        {selectedSchool !== "all"
                          ? schools.find((school) => school._id === selectedSchool)?.nama
                          : "Semua Sekolah"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0" align="start">
                      <div className="flex flex-col border rounded-md bg-white">
                        {/* Manual Search Input */}
                        <div className="flex items-center border-b px-3">
                          <Input
                            placeholder="Ketik nama sekolah..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-50 border-none focus-visible:ring-0 px-0"
                            autoFocus
                          />
                        </div>
                        
                        {/* Manual List */}
                        <div className="max-h-[300px] overflow-y-auto overflow-x-hidden p-1">
                           {/* Debug info */}
                           <div className="px-2 py-1.5 text-xs text-slate-400 border-b mb-1">
                              Menampilkan {schools.filter(s => s.nama.toLowerCase().includes(searchQuery.toLowerCase())).length} dari {schools.length} sekolah
                           </div>

                          {/* Option: Semua Sekolah */}
                          <div
                            className={cn(
                              "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-slate-100 hover:text-slate-900 cursor-pointer",
                              selectedSchool === 'all' && "bg-slate-100"
                            )}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setSelectedSchool("all")
                              setOpenSchool(false)
                              setSearchQuery("")
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedSchool === "all" ? "opacity-100" : "opacity-0"
                              )}
                            />
                            Semua Sekolah
                          </div>

                          {/* Filtered Schools */}
                          {schools
                            .filter(s => s.nama.toLowerCase().includes(searchQuery.toLowerCase()))
                            .slice(0, 100) // Performance limit
                            .map((school) => (
                              <div
                                key={school._id}
                                className={cn(
                                  "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-slate-100 hover:text-slate-900 cursor-pointer",
                                  selectedSchool === school._id && "bg-slate-100"
                                )}
                                onMouseDown={(e) => {
                                  // Use onMouseDown to prevent blur interaction issues
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setSelectedSchool(school._id === selectedSchool ? "all" : school._id)
                                  setOpenSchool(false)
                                  setSearchQuery("")
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedSchool === school._id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {school.nama}
                              </div>
                          ))}
                          
                          {schools.filter(s => s.nama.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                             <div className="py-6 text-center text-sm text-muted-foreground">
                               Sekolah tidak ditemukan.
                             </div>
                          )}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
          </CardContent>
        </Card>

        {/* LOADING STATE */}
        {!reportData ? (
          <div className="p-8 text-center text-slate-400 no-print">
            Memuat data laporan...
          </div>
        ) : (
          <>
            {/* STATS CHARTS (Screen Only) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 no-print mb-6">
               <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white/60 backdrop-blur-xl rounded-2xl relative z-10 overflow-hidden">
                 <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">Status Dokumen</CardTitle>
                 </CardHeader>
                 <CardContent className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={[
                                    { name: 'Disetujui', value: reportData.summary.approved, fill: COLORS.approved },
                                    { name: 'Menunggu', value: reportData.summary.pending, fill: COLORS.pending },
                                    { name: 'Ditolak', value: reportData.summary.rejected, fill: COLORS.rejected },
                                    { name: 'Draft', value: reportData.summary.draft, fill: COLORS.draft },
                                ].filter(x => x.value > 0)}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                                 
                                label={({name, percent}: any) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                            >
                                <Cell fill={COLORS.approved} />
                                <Cell fill={COLORS.pending} />
                                <Cell fill={COLORS.rejected} />
                                <Cell fill={COLORS.draft} />
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                 </CardContent>
               </Card>

               <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white/60 backdrop-blur-xl rounded-2xl relative z-10 overflow-hidden">
                 <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">Jenis SK</CardTitle>
                 </CardHeader>
                 <CardContent className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            layout="vertical"
                            data={[
                                { name: 'GTY', value: reportData.byType?.gty || 0, fill: TYPE_COLORS[0] },
                                { name: 'GTT', value: reportData.byType?.gtt || 0, fill: TYPE_COLORS[1] },
                                { name: 'Kamad', value: reportData.byType?.kamad || 0, fill: TYPE_COLORS[2] },
                                { name: 'Tendik', value: reportData.byType?.tendik || 0, fill: TYPE_COLORS[3] },
                            ]}
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" width={80} />
                            <Tooltip cursor={{fill: 'transparent'}} />
                            <Bar dataKey="value" name="Jumlah" radius={[0, 4, 4, 0]}>
                                {
                                    [0,1,2,3].map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={TYPE_COLORS[index % TYPE_COLORS.length]} />
                                    ))
                                }
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                 </CardContent>
               </Card>
            </div>

            {/* KEY STATS ROW */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 no-print mb-6">
               <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white/60 backdrop-blur-xl rounded-2xl relative z-10 overflow-hidden hover:-translate-y-1 transition-transform">
                 <CardContent className="p-5 flex flex-col items-center justify-center">
                    <span className="text-4xl font-black text-slate-800 tracking-tighter">{reportData.summary.total}</span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-2">Total Dokumen</span>
                 </CardContent>
               </Card>
               <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-emerald-50/80 backdrop-blur-xl rounded-2xl relative z-10 overflow-hidden text-emerald-900 hover:-translate-y-1 transition-transform">
                 <CardContent className="p-5 flex flex-col items-center justify-center relative">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-400/20 rounded-full blur-2xl pointer-events-none" />
                    <span className="text-4xl font-black tracking-tighter relative z-10 text-emerald-700">{reportData.summary.approved}</span>
                    <span className="text-[10px] uppercase tracking-widest font-bold mt-2 relative z-10 text-emerald-600">Disetujui</span>
                 </CardContent>
               </Card>
               <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-amber-50/80 backdrop-blur-xl rounded-2xl relative z-10 overflow-hidden text-amber-900 hover:-translate-y-1 transition-transform">
                 <CardContent className="p-5 flex flex-col items-center justify-center relative">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-400/20 rounded-full blur-2xl pointer-events-none" />
                    <span className="text-4xl font-black tracking-tighter relative z-10 text-amber-600">{reportData.summary.pending}</span>
                    <span className="text-[10px] uppercase tracking-widest font-bold mt-2 relative z-10 text-amber-600">Pending</span>
                 </CardContent>
               </Card>
               <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-red-50/80 backdrop-blur-xl rounded-2xl relative z-10 overflow-hidden text-red-900 hover:-translate-y-1 transition-transform">
                 <CardContent className="p-5 flex flex-col items-center justify-center relative">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-red-400/20 rounded-full blur-2xl pointer-events-none" />
                    <span className="text-4xl font-black tracking-tighter relative z-10 text-red-600">{reportData.summary.rejected}</span>
                    <span className="text-[10px] uppercase tracking-widest font-bold mt-2 relative z-10 text-red-600">Ditolak</span>
                 </CardContent>
               </Card>
            </div>

            {/* PRINT HEADER (Visible only on Print) */}
            <div className="print-only text-center mb-6">
                <h2 className="text-xl font-bold uppercase">Laporan Rekapitulasi Surat Keputusan (SK)</h2>
                <h3 className="text-lg font-bold uppercase">LP Ma'arif NU Cilacap</h3>
                <p className="text-sm mt-2">
                    Periode: {startDate ? new Date(startDate).toLocaleDateString('id-ID') : 'Awal'} 
                    {' s/d '} 
                    {endDate ? new Date(endDate).toLocaleDateString('id-ID') : 'Sekarang'}
                </p>
                <div className="border-b-2 border-black mt-4 mb-6"></div>
            </div>

            {/* MAIN TABLE (Screen & Print) */}
            <Card className="card-print border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white/60 backdrop-blur-xl rounded-2xl relative z-10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-emerald-50/80 backdrop-blur-sm text-emerald-800 font-semibold border-b border-emerald-100/60">
                    <tr>
                      <th className="p-4 w-12 text-center tracking-wide">No</th>
                      <th className="p-4 tracking-wide">Nomor SK</th>
                      <th className="p-3">Nama Guru / Tendik</th>
                      <th className="p-3">Jenis SK</th>
                      <th className="p-3">Unit Kerja</th>
                      <th className="p-3 w-32 text-center">Status</th>
                      <th className="p-3 w-32 text-center">Tanggal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {reportData.data.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-500">
                           Tidak ada data yang sesuai filter.
                        </td>
                      </tr>
                    ) : (
                       
                      reportData.data.map((row: any, i: number) => (
                        <tr key={row._id} className="hover:bg-slate-50">
                          <td className="p-3 text-center">{i + 1}</td>
                          <td className="p-3 font-mono text-xs">{row.nomorSk || '-'}</td>
                          <td className="p-3 font-medium">{row.nama}</td>
                          <td className="p-3">{row.jenisSk}</td>
                          <td className="p-3">{row.schoolName || '-'}</td>
                          <td className="p-3 text-center">
                            <span className={`
                                px-2 py-0.5 rounded text-xs font-medium border
                                ${row.status === 'approved' ? 'bg-green-100 text-green-700 border-green-200' : ''}
                                ${row.status === 'pending' ? 'bg-amber-100 text-amber-700 border-amber-200' : ''}
                                ${row.status === 'rejected' ? 'bg-red-100 text-red-700 border-red-200' : ''}
                                ${row.status === 'draft' ? 'bg-slate-100 text-slate-700 border-slate-200' : ''}
                            `}>
                              {row.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="p-3 text-center text-slate-500">
                             {new Date(row.createdAt).toLocaleDateString('id-ID')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* PRINT FOOTER (Visible only on Print) */}
             <div className="print-only mt-8 flex justify-end">
                <div className="text-center w-64">
                    <p>Cilacap, {new Date().toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}</p>
                    <p className="mt-2">Mengetahui,</p>
                    <p>Ketua PC LP Ma'arif NU Cilacap</p>
                    <br/><br/><br/>
                    <p className="font-bold underline">H. Munawar, S.Ag, M.Pd</p>
                </div>
            </div>

          </>
        )}
      </div>
    </div>
  )
}
