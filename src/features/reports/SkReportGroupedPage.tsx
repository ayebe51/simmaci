import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportApi, schoolApi, authApi } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Download, Printer, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'

export default function SkReportGroupedPage() {
  const user = authApi.getStoredUser()
  const isOperator = user?.role === 'operator'

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('all')

  // Helper function to extract kecamatan from school name
  const extractKecamatanFromName = (unitKerja: string): string => {
    if (!unitKerja) return 'Tidak Diketahui'
    
    // Common patterns in school names
    const patterns = [
      /Majenang/i,
      /Panisian/i,
      /Cilacap/i,
      /Gandrungmanis/i,
      /Kroya/i,
      /Kawunganten/i,
      /Kesugihan/i,
      /Adipala/i,
      /Binangun/i,
      /Nusawungu/i,
      /Jeruklegi/i,
      /Bantarsari/i,
      /Dayeuhluhur/i,
      /Wanareja/i,
      /Sidareja/i,
      /Karangpucung/i,
      /Cimanggu/i,
      /Cipari/i,
      /Patikraja/i,
      /Kedungreja/i,
      /Sampang/i,
      /Kampung Laut/i
    ]
    
    for (const pattern of patterns) {
      const match = unitKerja.match(pattern)
      if (match) return match[0]
    }
    
    return 'Tidak Diketahui'
  }

  // 🔥 REST API QUERIES
  const { data: reportData, isLoading } = useQuery({
    queryKey: ['sk-report-simple', startDate, endDate, selectedStatus],
    queryFn: () => reportApi.skReport({
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      status: selectedStatus !== 'all' ? selectedStatus : undefined
    })
  })

  // Group data by school and kecamatan
  const groupedData = useMemo(() => {
    if (!reportData?.data) return []
    
    const grouped = reportData.data.reduce((acc: any, item: any) => {
      // Get kecamatan from school relation or unit_kerja
      const kecamatan = item.school?.kecamatan || item.kecamatan || extractKecamatanFromName(item.unit_kerja)
      const key = `${item.unit_kerja}|${kecamatan}`
      
      if (!acc[key]) {
        acc[key] = {
          unit_kerja: item.unit_kerja,
          kecamatan: kecamatan,
          total: 0,
          gty: 0,
          gtt: 0,
          kamad: 0,
          tendik: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
          tanggal_awal: item.created_at,
          tanggal_akhir: item.created_at
        }
      }
      
      acc[key].total++
      
      // Count by jenis SK
      const jenis = (item.jenis_sk || '').toLowerCase()
      if (jenis.includes('gty') || jenis.includes('tetap yayasan')) acc[key].gty++
      else if (jenis.includes('gtt') || jenis.includes('tidak tetap')) acc[key].gtt++
      else if (jenis.includes('kepala') || jenis.includes('kamad')) acc[key].kamad++
      else if (jenis.includes('tendik') || jenis.includes('kependidikan')) acc[key].tendik++
      
      // Count by status
      const status = (item.status || '').toLowerCase()
      if (status === 'approved') acc[key].approved++
      else if (status === 'pending') acc[key].pending++
      else if (status === 'rejected') acc[key].rejected++
      
      // Track date range
      if (new Date(item.created_at) < new Date(acc[key].tanggal_awal)) {
        acc[key].tanggal_awal = item.created_at
      }
      if (new Date(item.created_at) > new Date(acc[key].tanggal_akhir)) {
        acc[key].tanggal_akhir = item.created_at
      }
      
      return acc
    }, {})
    
    // Convert to array and sort by kecamatan then unit_kerja
    return Object.values(grouped).sort((a: any, b: any) => {
      if (a.kecamatan !== b.kecamatan) {
        return a.kecamatan.localeCompare(b.kecamatan)
      }
      return a.unit_kerja.localeCompare(b.unit_kerja)
    })
  }, [reportData])

  const handlePrint = () => window.print()

  const handleExportExcel = () => {
    if (!groupedData.length) return toast.error('Tidak ada data')
    try {
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(groupedData.map((item: any, i: number) => ({
        'No': i + 1,
        'Tanggal': new Date(item.tanggal_awal).toLocaleDateString('id-ID'),
        'Kecamatan': item.kecamatan,
        'Unit Kerja': item.unit_kerja,
        'Jumlah Pengajuan': item.total,
        'GTY': item.gty,
        'GTT': item.gtt,
        'Kamad': item.kamad,
        'Tendik': item.tendik,
        'Disetujui': item.approved,
        'Pending': item.pending,
        'Ditolak': item.rejected
      })))
      XLSX.utils.book_append_sheet(wb, ws, 'Rekap Per Sekolah')
      XLSX.writeFile(wb, `Rekap_SK_Per_Sekolah_${new Date().toISOString().split('T')[0]}.xlsx`)
      toast.success('Excel berhasil didownload')
    } catch (e) { 
      toast.error('Gagal export') 
    }
  }

  return (
    <div className="min-h-screen bg-slate-50/30 pb-20 relative font-sans">
      <style>{`
        @media print { 
          .no-print { display: none !important; } 
          .print-only { display: block !important; } 
          table { width: 100%; border-collapse: collapse; font-size: 11px; } 
          th, td { border: 1px solid #ddd; padding: 6px; } 
          th { background-color: #f8fafc; }
        } 
        .print-only { display: none; }
      `}</style>
      
      <div className="no-print bg-white border-b px-10 py-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Laporan Pengajuan SK Per Sekolah</h1>
          <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-1">Rekapitulasi Dikelompokkan Per Unit Kerja</p>
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
          <CardContent className="p-10 grid grid-cols-1 md:grid-cols-3 gap-8">
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
          </CardContent>
        </Card>

        {isLoading ? (
            <div className="flex flex-col items-center justify-center p-20 gap-4 text-slate-300">
                <Loader2 className="h-10 w-10 animate-spin" />
                <span className="text-[10px] font-black uppercase tracking-widest italic">Memproses Data...</span>
            </div>
        ) : (
          <>
            <div className="print-only text-center py-10">
                <h2 className="text-xl font-black uppercase">Rekapitulasi Pengajuan SK Per Sekolah</h2>
                <h3 className="text-sm font-bold text-slate-500 uppercase">LP Ma'arif NU Cilacap</h3>
                <p className="text-xs font-medium mt-2 italic">Periode: {startDate || 'Awal'} s/d {endDate || 'Sekarang'}</p>
                <div className="border-b-2 border-slate-200 mt-6" />
            </div>

            <div className="no-print grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
               {[
                 { label: 'Total Sekolah', val: groupedData.length, color: 'text-slate-900', bg: 'bg-white' },
                 { label: 'Total Pengajuan', val: groupedData.reduce((sum: number, item: any) => sum + item.total, 0), color: 'text-blue-600', bg: 'bg-blue-50/50' },
                 { label: 'Disetujui', val: groupedData.reduce((sum: number, item: any) => sum + item.approved, 0), color: 'text-emerald-600', bg: 'bg-emerald-50/50' },
                 { label: 'Pending', val: groupedData.reduce((sum: number, item: any) => sum + item.pending, 0), color: 'text-amber-600', bg: 'bg-amber-50/50' }
               ].map((s, i) => (
                 <div key={i} className={`${s.bg} p-8 rounded-[2rem] border border-white flex flex-col items-center justify-center hover:-translate-y-1 transition-transform`}>
                    <span className={`text-4xl font-black ${s.color} tracking-tighter`}>{s.val}</span>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2">{s.label}</span>
                 </div>
               ))}
            </div>

            <Card className="border-0 shadow-sm bg-white rounded-[2.5rem] overflow-hidden">
               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                   <thead className="bg-slate-50 border-b border-slate-100">
                     <tr>
                       <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">No</th>
                       <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Tanggal</th>
                       <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Kecamatan</th>
                       <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Unit Kerja</th>
                       <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Jumlah Guru</th>
                       <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center no-print">Detail</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50">
                     {groupedData.map((row: any, i: number) => (
                        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-6 text-center font-bold text-slate-400 text-xs">{i+1}</td>
                          <td className="p-6 text-xs font-bold text-slate-500">
                            {new Date(row.tanggal_awal).toLocaleDateString('id-ID', {day:'2-digit', month:'short', year:'numeric'})}
                          </td>
                          <td className="p-6 text-xs font-bold text-slate-600">{row.kecamatan}</td>
                          <td className="p-6">
                             <div className="font-black text-slate-800 text-sm tracking-tight">{row.unit_kerja}</div>
                          </td>
                          <td className="p-6 text-center">
                             <span className="inline-flex px-4 py-2 rounded-xl text-2xl font-black text-blue-600 bg-blue-50">
                               {row.total}
                             </span>
                          </td>
                          <td className="p-6 text-center no-print">
                             <div className="flex gap-2 justify-center text-[10px] font-bold">
                               {row.gty > 0 && <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded">GTY: {row.gty}</span>}
                               {row.gtt > 0 && <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">GTT: {row.gtt}</span>}
                               {row.kamad > 0 && <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded">Kamad: {row.kamad}</span>}
                               {row.tendik > 0 && <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded">Tendik: {row.tendik}</span>}
                             </div>
                             <div className="flex gap-2 justify-center text-[9px] font-bold mt-2">
                               {row.approved > 0 && <span className="text-emerald-600">✓ {row.approved}</span>}
                               {row.pending > 0 && <span className="text-amber-600">⏳ {row.pending}</span>}
                               {row.rejected > 0 && <span className="text-rose-600">✗ {row.rejected}</span>}
                             </div>
                          </td>
                        </tr>
                     ))}
                     <tr className="bg-slate-100 font-black">
                       <td colSpan={4} className="p-6 text-right text-sm uppercase">Total Keseluruhan:</td>
                       <td className="p-6 text-center text-2xl text-blue-600">
                         {groupedData.reduce((sum: number, item: any) => sum + item.total, 0)}
                       </td>
                       <td className="p-6 no-print"></td>
                     </tr>
                   </tbody>
                 </table>
               </div>
            </Card>

            <div className="print-only mt-10 flex justify-between px-10">
                <div className="text-left">
                    <p className="text-xs font-bold">Mengetahui,</p>
                    <p className="text-[10px] uppercase font-black mt-1">Ketua PC LP Ma'arif NU</p>
                    <div className="h-20" />
                    <p className="text-xs font-black underline uppercase">ALI SODIQIN, S.Ag., M.Pd.I</p>
                </div>
                <div className="text-center">
                    <p className="text-xs font-bold">Cilacap, {new Date().toLocaleDateString('id-ID', {day:'numeric',month:'long',year:'numeric'})}</p>
                    <p className="text-[10px] uppercase font-black mt-1">Sekretaris</p>
                    <div className="h-20" />
                    <p className="text-xs font-black underline uppercase">NGADINO, S.Pd.I</p>
                </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
