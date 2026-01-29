import { useState, useRef, useMemo } from 'react'
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
import { Badge } from '@/components/ui/badge'
import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export default function SkReportPageSimple() {
  // 1. User Context & Role Safety
  let user = null
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
  const convexSchools = useQuery(api.schools.list) || []

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
  const filteredSchools = useMemo(() => {
     if (!searchQuery) return schools
     return schools.filter(school => 
       school.nama.toLowerCase().includes(searchQuery.toLowerCase())
     )
  }, [schools, searchQuery])

  const queryArgs = {
    startDate: startDate ? new Date(startDate).getTime() : undefined,
    endDate: endDate ? new Date(endDate + 'T23:59:59').getTime() : undefined,
    schoolId: effectiveSchoolId as any, 
    status: (selectedStatus && selectedStatus !== 'all') ? selectedStatus : undefined,
  }

  const reportData = useQuery(api.reports.generateSkReport, queryArgs)

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
    <div className="min-h-screen bg-slate-50/50 pb-20">
      
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
        <Card className="no-print">
          <CardHeader className="pb-3 border-b bg-slate-50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Filter className="w-4 h-4" /> Filter Data
              </CardTitle>
              {(startDate || endDate || selectedStatus !== 'all' || (selectedSchool !== 'all' && !isOperator)) && (
                <Button variant="ghost" size="sm" onClick={resetFilters} className="text-red-500 h-8">
                  <X className="w-3 h-3 mr-1" /> Reset
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Tanggal Awal</Label>
                <input 
                  type="date" 
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tanggal Akhir</Label>
                <input 
                  type="date" 
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
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
            {/* STATS CARDS (Screen Only) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 no-print">
               <Card>
                 <CardContent className="p-4 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-slate-700">{reportData.summary.total}</span>
                    <span className="text-xs text-slate-500 uppercase font-medium">Total Dokumen</span>
                 </CardContent>
               </Card>
               <Card className="bg-green-50 border-green-100">
                 <CardContent className="p-4 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-green-700">{reportData.summary.approved}</span>
                    <span className="text-xs text-green-600 uppercase font-medium">Disetujui</span>
                 </CardContent>
               </Card>
               <Card className="bg-amber-50 border-amber-100">
                 <CardContent className="p-4 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-amber-700">{reportData.summary.pending}</span>
                    <span className="text-xs text-amber-600 uppercase font-medium">Menunggu</span>
                 </CardContent>
               </Card>
               <Card>
                 <CardContent className="p-4 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-slate-700">{reportData.summary.draft}</span>
                    <span className="text-xs text-slate-500 uppercase font-medium">Draft</span>
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
            <Card className="card-print overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b">
                    <tr>
                      <th className="p-3 w-12 text-center">No</th>
                      <th className="p-3">Nomor SK</th>
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
