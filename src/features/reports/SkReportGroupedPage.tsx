import { useState, useMemo, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { reportApi, authApi, type SkBelumMengajukanResponse, type SkBelumMengajukanParams } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Download, Printer, Loader2, Search, X, School, AlertCircle, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'

// ── Debounce Hook ──
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debouncedValue
}

const JENJANG_OPTIONS = ['RA', 'MI', 'MTs', 'MA'] as const

export default function SkReportGroupedPage() {
  const user = authApi.getStoredUser()
  const isOperator = user?.role === 'operator'

  // ── Tab State ──
  const [activeTab, setActiveTab] = useState<'per-sekolah' | 'belum-mengajukan'>('per-sekolah')

  // ── Per Sekolah State ──
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // ── Belum Mengajukan State ──
  const [missingJenjang, setMissingJenjang] = useState('')
  const [missingKecamatan, setMissingKecamatan] = useState('')
  const [missingStartDate, setMissingStartDate] = useState('')
  const [missingEndDate, setMissingEndDate] = useState('')
  const [missingSearchInput, setMissingSearchInput] = useState('')
  const [isExporting, setIsExporting] = useState(false)

  const debouncedMissingSearch = useDebounce(missingSearchInput, 400)

  const missingQueryParams: SkBelumMengajukanParams = {
    ...(missingJenjang && { jenjang: missingJenjang }),
    ...(missingKecamatan && { kecamatan: missingKecamatan }),
    ...(missingStartDate && { start_date: missingStartDate }),
    ...(missingEndDate && { end_date: missingEndDate }),
    ...(debouncedMissingSearch && { search: debouncedMissingSearch }),
  }

  // Fetch belum mengajukan data
  const {
    data: missingData,
    isLoading: missingLoading,
    isError: missingError,
    error: missingErrorObj,
    refetch: missingRefetch,
  } = useQuery<SkBelumMengajukanResponse>({
    queryKey: ['sk-belum-mengajukan', missingJenjang, missingKecamatan, missingStartDate, missingEndDate, debouncedMissingSearch],
    queryFn: () => reportApi.skBelumMengajukan(missingQueryParams),
    enabled: !isOperator,
  })

  // Fetch per sekolah data
  const { data: reportData, isLoading } = useQuery({
    queryKey: ['sk-report-per-sekolah', startDate, endDate],
    queryFn: () => reportApi.skPerSekolah({
      start_date: startDate || undefined,
      end_date: endDate || undefined,
    })
  })

  // Data sudah di-group per sekolah oleh backend
  const groupedData = useMemo(() => {
    if (!reportData?.data) return []
    return reportData.data
  }, [reportData])

  // ── Per Sekolah Handlers ──
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
      })))
      XLSX.utils.book_append_sheet(wb, ws, 'Rekap Per Sekolah')
      XLSX.writeFile(wb, `Rekap_SK_Per_Sekolah_${new Date().toISOString().split('T')[0]}.xlsx`)
      toast.success('Excel berhasil didownload')
    } catch (e) {
      toast.error('Gagal export')
    }
  }

  // ── Belum Mengajukan Handlers ──
  const hasActiveMissingFilters = missingJenjang || missingKecamatan || missingStartDate || missingEndDate || debouncedMissingSearch

  const handleResetMissingFilters = useCallback(() => {
    setMissingJenjang('')
    setMissingKecamatan('')
    setMissingStartDate('')
    setMissingEndDate('')
    setMissingSearchInput('')
  }, [])

  const handleExportMissingExcel = useCallback(async () => {
    setIsExporting(true)
    try {
      const blob = await reportApi.exportSkBelumMengajukan(missingQueryParams)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Laporan_Belum_Mengajukan_SK_${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      toast.success('File Excel berhasil diunduh')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Gagal mengunduh file Excel. Silakan coba lagi.')
    } finally {
      setIsExporting(false)
    }
  }, [missingQueryParams])

  const handlePrintMissing = () => window.print()

  return (
    <div className="min-h-screen bg-slate-50/30 pb-20 relative font-sans">
      <style>{`
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { margin: 0; padding: 0; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .print-page {
            width: 210mm;
            min-height: 297mm;
            margin: 0 auto;
            padding: 15mm 20mm;
            font-family: 'Times New Roman', Times, serif;
            font-size: 11pt;
            color: #000;
          }
          .print-page-landscape {
            width: 297mm;
            min-height: 210mm;
            margin: 0 auto;
            padding: 10mm 15mm;
            font-family: 'Times New Roman', Times, serif;
            font-size: 10pt;
            color: #000;
          }
          .print-header { text-align: center; margin-bottom: 6mm; }
          .print-header h1 { font-size: 14pt; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 2mm 0; }
          .print-header h2 { font-size: 12pt; font-weight: 700; text-transform: uppercase; margin: 0 0 2mm 0; }
          .print-header p { font-size: 10pt; font-style: italic; margin: 0; }
          .print-divider { border: none; border-top: 3px double #000; margin: 4mm 0; }
          .print-table { width: 100%; border-collapse: collapse; margin-top: 4mm; font-size: 10pt; }
          .print-table th {
            border: 1px solid #000;
            padding: 3mm 4mm;
            text-align: center;
            font-weight: 700;
            text-transform: uppercase;
            font-size: 9pt;
            background-color: #f0f0f0 !important;
          }
          .print-table td { border: 1px solid #000; padding: 2.5mm 4mm; vertical-align: middle; }
          .print-table td.center { text-align: center; }
          .print-table td.right { text-align: right; }
          .print-table tr.total-row td {
            font-weight: 900;
            font-size: 11pt;
            background-color: #f0f0f0 !important;
          }
          .print-table tr.total-row td.jumlah { font-size: 13pt; text-align: center; }
          .print-footer { margin-top: 12mm; display: flex !important; justify-content: space-between; align-items: flex-start; }
          .print-footer .signer { text-align: center; min-width: 60mm; }
          .print-footer .signer p { margin: 0; font-size: 10pt; }
          .print-footer .signer .title { font-weight: 700; text-transform: uppercase; font-size: 9pt; margin-top: 1mm; }
          .print-footer .signer .name { font-weight: 900; text-decoration: underline; text-transform: uppercase; margin-top: 18mm; font-size: 10pt; }
          @page { size: ${activeTab === 'belum-mengajukan' ? 'A4 landscape' : 'A4 portrait'}; margin: 0; }
        }
        .print-only { display: none; }
        .print-page { width: 100%; }
        .print-page-landscape { width: 100%; }
      `}</style>

      {/* ── HEADER ── */}
      <div className="no-print bg-white border-b px-10 py-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
            {activeTab === 'per-sekolah' ? 'Laporan Pengajuan SK Per Sekolah' : 'Laporan Sekolah Belum Mengajukan SK'}
          </h1>
          <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-1">
            {activeTab === 'per-sekolah' ? 'Rekapitulasi Dikelompokkan Per Unit Kerja' : 'Daftar Madrasah Yang Belum Mengajukan SK Pada Periode Ini'}
          </p>
        </div>
        <div className="flex gap-3">
          {activeTab === 'per-sekolah' ? (
            <>
              <Button variant="outline" onClick={handlePrint} className="rounded-xl font-bold uppercase text-[10px] tracking-widest border-slate-200">
                <Printer className="w-4 h-4 mr-2" /> PDF / Print
              </Button>
              <Button onClick={handleExportExcel} className="rounded-xl font-bold uppercase text-[10px] tracking-widest bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-100">
                <Download className="w-4 h-4 mr-2" /> Export Excel
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handlePrintMissing} className="rounded-xl font-bold uppercase text-[10px] tracking-widest border-slate-200">
                <Printer className="w-4 h-4 mr-2" /> PDF / Print
              </Button>
              <Button
                onClick={handleExportMissingExcel}
                disabled={isExporting}
                className="rounded-xl font-bold uppercase text-[10px] tracking-widest bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-100"
              >
                {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                Export Excel
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── NAVIGATION TABS ── */}
      <div className="no-print bg-white border-b px-10">
        <div className="flex gap-1">
          <Link
            to="/dashboard/reports/sk"
            className="px-4 py-3 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-t-lg transition-colors"
          >
            Detail SK
          </Link>
          <button
            onClick={() => setActiveTab('per-sekolah')}
            className={`px-4 py-3 text-xs font-bold rounded-t-lg transition-colors ${
              activeTab === 'per-sekolah'
                ? 'text-emerald-700 border-b-2 border-emerald-600 bg-emerald-50/50'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            Per Sekolah
          </button>
          {!isOperator && (
            <button
              onClick={() => setActiveTab('belum-mengajukan')}
              className={`px-4 py-3 text-xs font-bold rounded-t-lg transition-colors flex items-center gap-2 ${
                activeTab === 'belum-mengajukan'
                  ? 'text-emerald-700 border-b-2 border-emerald-600 bg-emerald-50/50'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              Belum Mengajukan
              {missingData?.total != null && missingData.total > 0 && (
                <span className="inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-bold bg-red-100 text-red-700 rounded-full min-w-[20px]">
                  {missingData.total}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="container mx-auto p-10 space-y-10">
        {/* ═══ TAB: PER SEKOLAH ═══ */}
        {activeTab === 'per-sekolah' && (
          <>
            <Card className="no-print border-0 shadow-sm bg-white rounded-[2.5rem] overflow-visible">
              <CardContent className="p-10 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Dimulai Dari</Label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-12 rounded-xl border-slate-200 font-bold" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Sampai Dengan</Label>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-12 rounded-xl border-slate-200 font-bold" />
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
                {/* ── PER SEKOLAH PRINT LAYOUT ── */}
                <div className="print-only print-page">
                  <div className="print-header">
                    <h1>Rekapitulasi Pengajuan SK Per Sekolah</h1>
                    <h2>LP Ma'arif NU Cilacap</h2>
                    {(startDate || endDate) && (
                      <p>Periode: {startDate ? new Date(startDate).toLocaleDateString('id-ID', {day:'numeric',month:'long',year:'numeric'}) : 'Awal'} s/d {endDate ? new Date(endDate).toLocaleDateString('id-ID', {day:'numeric',month:'long',year:'numeric'}) : 'Sekarang'}</p>
                    )}
                  </div>
                  <hr className="print-divider" />

                  <table className="print-table">
                    <thead>
                      <tr>
                        <th style={{width:'6%'}}>NO</th>
                        <th style={{width:'14%'}}>TANGGAL</th>
                        <th style={{width:'18%'}}>KECAMATAN</th>
                        <th style={{width:'42%'}}>UNIT KERJA</th>
                        <th style={{width:'20%'}}>JUMLAH GURU</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedData.map((row: any, i: number) => (
                        <tr key={i}>
                          <td className="center">{i + 1}</td>
                          <td className="center">
                            {new Date(row.tanggal_awal).toLocaleDateString('id-ID', {day:'2-digit', month:'short', year:'numeric'})}
                          </td>
                          <td>{row.kecamatan}</td>
                          <td style={{fontWeight: 700}}>{row.unit_kerja}</td>
                          <td className="center" style={{fontSize:'13pt', fontWeight:900}}>{row.total}</td>
                        </tr>
                      ))}
                      <tr className="total-row">
                        <td colSpan={4} className="right" style={{paddingRight:'6mm', fontWeight:900, textTransform:'uppercase', letterSpacing:'0.5px'}}>
                          Total Keseluruhan:
                        </td>
                        <td className="jumlah">{groupedData.reduce((sum: number, item: any) => sum + item.total, 0)}</td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="print-footer">
                    <div className="signer">
                      <p>Mengetahui,</p>
                      <p className="title">Ketua PC LP Ma'arif NU</p>
                      <p className="name">ALI SODIQIN, S.Ag., M.Pd.I</p>
                    </div>
                    <div className="signer">
                      <p>Cilacap, {new Date().toLocaleDateString('id-ID', {day:'numeric',month:'long',year:'numeric'})}</p>
                      <p className="title">Sekretaris</p>
                      <p className="name">NGADINO, S.Pd.I</p>
                    </div>
                  </div>
                </div>

                {/* ── PER SEKOLAH SCREEN LAYOUT ── */}
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

                <Card className="no-print border-0 shadow-sm bg-white rounded-[2.5rem] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                          <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">No</th>
                          <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Tanggal</th>
                          <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Kecamatan</th>
                          <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Unit Kerja</th>
                          <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Jumlah Guru</th>
                          <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Detail</th>
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
                            <td className="p-6 text-center">
                              <div className="flex gap-2 justify-center text-[10px] font-bold">
                                {row.gty > 0 && <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded">GTY: {row.gty}</span>}
                                {row.gtt > 0 && <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">GTT: {row.gtt}</span>}
                                {row.kamad > 0 && <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded">Kamad: {row.kamad}</span>}
                                {row.tendik > 0 && <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded">Tendik: {row.tendik}</span>}
                              </div>
                              <div className="flex gap-2 justify-center text-[9px] font-bold mt-2">
                                {row.approved > 0 && <span className="text-emerald-600">✓ {row.approved}</span>}
                                {row.pending > 0 && <span className="text-amber-600">⏳ {row.pending}</span>}
                              </div>
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-slate-100 font-black">
                          <td colSpan={4} className="p-6 text-right text-sm uppercase">Total Keseluruhan:</td>
                          <td className="p-6 text-center text-2xl text-blue-600">
                            {groupedData.reduce((sum: number, item: any) => sum + item.total, 0)}
                          </td>
                          <td className="p-6"></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
            )}
          </>
        )}

        {/* ═══ TAB: BELUM MENGAJUKAN ═══ */}
        {activeTab === 'belum-mengajukan' && !isOperator && (
          <>
            {/* Summary Card */}
            <div className="no-print">
              <div className="bg-white p-8 rounded-[2rem] border border-white flex flex-col items-center justify-center hover:-translate-y-1 transition-transform max-w-xs">
                <School className="w-8 h-8 text-red-400 mb-2" />
                <span className="text-4xl font-black text-red-600 tracking-tighter">
                  {missingLoading ? '...' : (missingData?.total ?? 0)}
                </span>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2">Sekolah Belum Mengajukan</span>
              </div>
            </div>

            {/* Filter Bar */}
            <Card className="no-print border-0 shadow-sm bg-white rounded-[2.5rem] overflow-visible">
              <CardContent className="p-10">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                  {/* Jenjang */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Jenjang</Label>
                    <Select value={missingJenjang || '__all__'} onValueChange={(v) => setMissingJenjang(v === '__all__' ? '' : v)}>
                      <SelectTrigger className="h-12 rounded-xl border-slate-200 font-bold">
                        <SelectValue placeholder="Semua Jenjang" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">Semua Jenjang</SelectItem>
                        {JENJANG_OPTIONS.map(j => (
                          <SelectItem key={j} value={j}>{j}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Kecamatan */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Kecamatan</Label>
                    <Select value={missingKecamatan || '__all__'} onValueChange={(v) => setMissingKecamatan(v === '__all__' ? '' : v)}>
                      <SelectTrigger className="h-12 rounded-xl border-slate-200 font-bold">
                        <SelectValue placeholder="Semua Kecamatan" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">Semua Kecamatan</SelectItem>
                        {(missingData?.kecamatan_list ?? []).map(k => (
                          <SelectItem key={k} value={k}>{k}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Period Start */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Periode Mulai</Label>
                    <Input
                      type="date"
                      value={missingStartDate}
                      onChange={e => setMissingStartDate(e.target.value)}
                      className="h-12 rounded-xl border-slate-200 font-bold"
                    />
                  </div>

                  {/* Period End */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Periode Akhir</Label>
                    <Input
                      type="date"
                      value={missingEndDate}
                      onChange={e => setMissingEndDate(e.target.value)}
                      className="h-12 rounded-xl border-slate-200 font-bold"
                    />
                  </div>

                  {/* Search */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Cari Sekolah</Label>
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        type="text"
                        placeholder="Nama / NPSN..."
                        value={missingSearchInput}
                        onChange={e => setMissingSearchInput(e.target.value)}
                        className="h-12 rounded-xl border-slate-200 font-bold pl-11 pr-10"
                      />
                      {missingSearchInput && (
                        <button
                          onClick={() => setMissingSearchInput('')}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Reset Filters */}
                {hasActiveMissingFilters && (
                  <div className="mt-6 flex justify-end">
                    <Button
                      variant="ghost"
                      onClick={handleResetMissingFilters}
                      className="text-xs font-bold text-slate-500 hover:text-slate-800"
                    >
                      <X className="w-3 h-3 mr-1" /> Reset Filter
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Data States */}
            {missingLoading && (
              <div className="flex flex-col items-center justify-center p-20 gap-4 text-slate-300">
                <Loader2 className="h-10 w-10 animate-spin" />
                <span className="text-[10px] font-black uppercase tracking-widest italic">Memuat Data...</span>
              </div>
            )}

            {missingError && (
              <Card className="no-print border-0 shadow-sm bg-white rounded-[2.5rem] overflow-hidden">
                <CardContent className="p-16 flex flex-col items-center justify-center gap-4">
                  <AlertCircle className="w-12 h-12 text-red-300" />
                  <p className="text-sm font-bold text-slate-600">Gagal memuat data</p>
                  <p className="text-xs text-slate-400">{(missingErrorObj as any)?.message || 'Terjadi kesalahan saat mengambil data.'}</p>
                  <Button
                    variant="outline"
                    onClick={() => missingRefetch()}
                    className="rounded-xl font-bold uppercase text-[10px] tracking-widest mt-2"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" /> Coba Lagi
                  </Button>
                </CardContent>
              </Card>
            )}

            {!missingLoading && !missingError && missingData && missingData.data.length === 0 && (
              <Card className="no-print border-0 shadow-sm bg-white rounded-[2.5rem] overflow-hidden">
                <CardContent className="p-16 flex flex-col items-center justify-center gap-4">
                  <School className="w-12 h-12 text-emerald-300" />
                  <p className="text-sm font-bold text-slate-600">Semua sekolah sudah mengajukan SK</p>
                  <p className="text-xs text-slate-400">Tidak ada madrasah yang belum mengajukan pada periode ini.</p>
                </CardContent>
              </Card>
            )}

            {/* Data Table */}
            {!missingLoading && !missingError && missingData && missingData.data.length > 0 && (
              <Card className="no-print border-0 shadow-sm bg-white rounded-[2.5rem] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">No</th>
                        <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Nama Madrasah</th>
                        <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">NPSN</th>
                        <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Jenjang</th>
                        <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Kecamatan</th>
                        <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Kepala Madrasah</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {missingData.data.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-6 text-center font-bold text-slate-400 text-xs">{idx + 1}</td>
                          <td className="p-6">
                            <div className="font-black text-slate-800 text-sm tracking-tight">{item.nama}</div>
                          </td>
                          <td className="p-6 text-center text-xs font-bold text-slate-600">{item.npsn || '-'}</td>
                          <td className="p-6 text-center">
                            <span className="inline-flex px-3 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700">
                              {item.jenjang || '-'}
                            </span>
                          </td>
                          <td className="p-6 text-xs font-bold text-slate-600">{item.kecamatan || '-'}</td>
                          <td className="p-6 text-xs font-bold text-slate-600">{item.kepala_madrasah || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* ── BELUM MENGAJUKAN PRINT LAYOUT ── */}
            {missingData && missingData.data.length > 0 && (
              <div className="print-only print-page-landscape">
                <div className="print-header">
                  <h1>Daftar Madrasah Belum Mengajukan SK</h1>
                  <h2>LP Ma'arif NU Cilacap</h2>
                  {(missingStartDate || missingEndDate) && (
                    <p>Periode: {missingStartDate ? new Date(missingStartDate).toLocaleDateString('id-ID', {day:'numeric',month:'long',year:'numeric'}) : 'Awal'} s/d {missingEndDate ? new Date(missingEndDate).toLocaleDateString('id-ID', {day:'numeric',month:'long',year:'numeric'}) : 'Sekarang'}</p>
                  )}
                  <p>Total: {missingData.total} Madrasah</p>
                </div>
                <hr className="print-divider" />

                <table className="print-table">
                  <thead>
                    <tr>
                      <th style={{width:'5%'}}>NO</th>
                      <th style={{width:'30%'}}>NAMA MADRASAH</th>
                      <th style={{width:'12%'}}>NPSN</th>
                      <th style={{width:'10%'}}>JENJANG</th>
                      <th style={{width:'20%'}}>KECAMATAN</th>
                      <th style={{width:'23%'}}>KEPALA MADRASAH</th>
                    </tr>
                  </thead>
                  <tbody>
                    {missingData.data.map((item, idx) => (
                      <tr key={item.id}>
                        <td className="center">{idx + 1}</td>
                        <td style={{fontWeight: 700}}>{item.nama}</td>
                        <td className="center">{item.npsn || '-'}</td>
                        <td className="center">{item.jenjang || '-'}</td>
                        <td>{item.kecamatan || '-'}</td>
                        <td>{item.kepala_madrasah || '-'}</td>
                      </tr>
                    ))}
                    <tr className="total-row">
                      <td colSpan={6} className="center" style={{fontWeight:900, textTransform:'uppercase', letterSpacing:'0.5px'}}>
                        Total: {missingData.total} Madrasah
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="print-footer">
                  <div className="signer">
                    <p>Mengetahui,</p>
                    <p className="title">Ketua PC LP Ma'arif NU</p>
                    <p className="name">ALI SODIQIN, S.Ag., M.Pd.I</p>
                  </div>
                  <div className="signer">
                    <p>Cilacap, {new Date().toLocaleDateString('id-ID', {day:'numeric',month:'long',year:'numeric'})}</p>
                    <p className="title">Sekretaris</p>
                    <p className="name">NGADINO, S.Pd.I</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
