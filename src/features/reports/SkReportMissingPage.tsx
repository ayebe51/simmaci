import { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { reportApi, type SkBelumMengajukanResponse, type SkBelumMengajukanParams } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RefreshCw, School, AlertCircle, Search, X, Download, Printer, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

// ── Debounce Hook ──
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}

const JENJANG_OPTIONS = ['TK/RA', 'RA', 'MI', 'MTs', 'MA', 'SMA', 'SMK'] as const

export default function SkReportMissingPage() {
  // ── Filter State ──
  const [jenjang, setJenjang] = useState<string>('')
  const [kecamatan, setKecamatan] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [searchInput, setSearchInput] = useState<string>('')

  const debouncedSearch = useDebounce(searchInput, 400)

  // ── Build query params ──
  const queryParams: SkBelumMengajukanParams = {
    ...(jenjang && { jenjang }),
    ...(kecamatan && { kecamatan }),
    ...(startDate && { start_date: startDate }),
    ...(endDate && { end_date: endDate }),
    ...(debouncedSearch && { search: debouncedSearch }),
  }

  const {
    data: reportData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<SkBelumMengajukanResponse>({
    queryKey: ['sk-belum-mengajukan', jenjang, kecamatan, startDate, endDate, debouncedSearch],
    queryFn: () => reportApi.skBelumMengajukan(queryParams),
  })

  // ── Reset all filters ──
  const handleResetFilters = useCallback(() => {
    setJenjang('')
    setKecamatan('')
    setStartDate('')
    setEndDate('')
    setSearchInput('')
  }, [])

  const hasActiveFilters = jenjang || kecamatan || startDate || endDate || debouncedSearch

  // ── Export State ──
  const [isExporting, setIsExporting] = useState(false)

  // ── Export Excel Handler ──
  const handleExportExcel = useCallback(async () => {
    setIsExporting(true)
    try {
      const blob = await reportApi.exportSkBelumMengajukan(queryParams)
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
  }, [queryParams])

  // ── Print / PDF Handler ──
  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  return (
    <div className="min-h-screen bg-slate-50/30 pb-20 relative font-sans">
      {/* Print Styles */}
      <style>{`
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { margin: 0; padding: 0; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .print-page {
            width: 297mm;
            min-height: 210mm;
            margin: 0 auto;
            padding: 12mm 15mm;
            font-family: 'Times New Roman', Times, serif;
            font-size: 10pt;
            color: #000;
          }
          .print-header { text-align: center; margin-bottom: 6mm; }
          .print-header h1 { font-size: 14pt; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 2mm 0; }
          .print-header h2 { font-size: 12pt; font-weight: 700; text-transform: uppercase; margin: 0 0 2mm 0; }
          .print-header p { font-size: 10pt; font-style: italic; margin: 0; }
          .print-divider { border: none; border-top: 3px double #000; margin: 4mm 0; }
          .print-table { width: 100%; border-collapse: collapse; margin-top: 4mm; font-size: 9pt; }
          .print-table th {
            border: 1px solid #000;
            padding: 2.5mm 3mm;
            text-align: center;
            font-weight: 700;
            text-transform: uppercase;
            font-size: 8pt;
            background-color: #f0f0f0 !important;
          }
          .print-table td { border: 1px solid #000; padding: 2mm 3mm; vertical-align: middle; }
          .print-table td.center { text-align: center; }
          .print-footer {
            margin-top: 8mm;
            display: flex !important;
            justify-content: space-between;
            align-items: flex-end;
            font-size: 9pt;
          }
          .print-footer .date-info { font-style: italic; }
          .print-footer .page-info { font-style: italic; }
          @page { size: landscape; margin: 10mm; }
        }
        .print-only { display: none; }
      `}</style>

      {/* Header */}
      <div className="no-print bg-white border-b px-10 py-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
            Laporan Madrasah Belum Mengajukan SK
          </h1>
          <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-1">
            Daftar Madrasah Jam'iyyah yang Belum Submit Pengajuan SK
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handlePrint}
            className="rounded-xl font-bold uppercase text-[10px] tracking-widest border-slate-200"
          >
            <Printer className="w-4 h-4 mr-2" />
            PDF / Print
          </Button>
          <Button
            onClick={handleExportExcel}
            disabled={isExporting}
            className="rounded-xl font-bold uppercase text-[10px] tracking-widest bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-100"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            {isExporting ? 'Mengunduh...' : 'Download Excel'}
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="no-print bg-white border-b px-10">
        <div className="flex gap-1">
          <Link
            to="/dashboard/reports/sk"
            className="px-4 py-3 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-t-lg transition-colors"
          >
            Detail SK
          </Link>
          <Link
            to="/dashboard/reports/sk-grouped"
            className="px-4 py-3 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-t-lg transition-colors"
          >
            Per Sekolah
          </Link>
          <div className="px-4 py-3 text-xs font-bold text-emerald-700 border-b-2 border-emerald-600 bg-emerald-50/50 rounded-t-lg flex items-center gap-2">
            Belum Mengajukan
            {reportData?.total != null && reportData.total > 0 && (
              <span className="inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-bold bg-red-100 text-red-700 rounded-full min-w-[20px]">
                {reportData.total}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="no-print container mx-auto p-10 space-y-10">
        {/* Loading State */}
        {isLoading && (
          <div className="space-y-6">
            {/* Summary card skeleton */}
            <Card className="border-0 shadow-sm bg-white rounded-[2.5rem]">
              <CardContent className="p-10 flex items-center gap-6">
                <Skeleton className="h-20 w-20 rounded-2xl" />
                <div className="space-y-3">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-8 w-24" />
                </div>
              </CardContent>
            </Card>

            {/* Filter skeleton */}
            <Card className="border-0 shadow-sm bg-white rounded-[2.5rem]">
              <CardContent className="p-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </CardContent>
            </Card>

            {/* Table skeleton */}
            <Card className="border-0 shadow-sm bg-white rounded-[2.5rem]">
              <CardContent className="p-10 space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Error State */}
        {isError && (
          <Card className="border-0 shadow-sm bg-white rounded-[2.5rem]">
            <CardContent className="p-10 flex flex-col items-center justify-center gap-4 text-center">
              <div className="h-16 w-16 rounded-full bg-rose-50 flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-rose-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">Gagal Memuat Data</h3>
                <p className="text-sm text-slate-500 mt-1">
                  {(error as any)?.message || 'Terjadi kesalahan saat memuat data laporan.'}
                </p>
              </div>
              <Button
                onClick={() => refetch()}
                variant="outline"
                className="rounded-xl font-bold uppercase text-[10px] tracking-widest mt-2"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Coba Lagi
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Data Loaded */}
        {!isLoading && !isError && reportData && (
          <>
            {/* Summary Card */}
            <Card className="border-0 shadow-sm bg-white rounded-[2.5rem]">
              <CardContent className="p-10 flex items-center gap-6">
                <div className="h-20 w-20 rounded-2xl bg-amber-50 flex items-center justify-center">
                  <School className="h-10 w-10 text-amber-600" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                    Total Madrasah Belum Mengajukan
                  </p>
                  <span className="text-4xl font-black text-slate-900 tracking-tighter">
                    {reportData.total}
                  </span>
                  <span className="text-sm font-bold text-slate-400 ml-2">madrasah</span>
                </div>
              </CardContent>
            </Card>

            {/* Filter Bar */}
            <Card className="border-0 shadow-sm bg-white rounded-[2.5rem] overflow-visible">
              <CardContent className="p-10 space-y-6">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                    Filter & Pencarian
                  </p>
                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleResetFilters}
                      className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-700"
                    >
                      <X className="w-3 h-3 mr-1" />
                      Reset Filter
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Jenjang Filter */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">
                      Jenjang
                    </Label>
                    <Select
                      value={jenjang}
                      onValueChange={(value) => setJenjang(value === '__all__' ? '' : value)}
                    >
                      <SelectTrigger className="h-12 rounded-xl border-slate-200 font-bold">
                        <SelectValue placeholder="Semua Jenjang" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">Semua Jenjang</SelectItem>
                        {JENJANG_OPTIONS.map((j) => (
                          <SelectItem key={j} value={j}>
                            {j}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Kecamatan Filter */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">
                      Kecamatan
                    </Label>
                    <Select
                      value={kecamatan}
                      onValueChange={(value) => setKecamatan(value === '__all__' ? '' : value)}
                    >
                      <SelectTrigger className="h-12 rounded-xl border-slate-200 font-bold">
                        <SelectValue placeholder="Semua Kecamatan" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">Semua Kecamatan</SelectItem>
                        {(reportData.kecamatan_list || []).map((kec) => (
                          <SelectItem key={kec} value={kec}>
                            {kec}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Period Start Date */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">
                      Periode Mulai
                    </Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="h-12 rounded-xl border-slate-200 font-bold"
                    />
                  </div>

                  {/* Period End Date */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">
                      Periode Akhir
                    </Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="h-12 rounded-xl border-slate-200 font-bold"
                    />
                  </div>
                </div>

                {/* Search Input */}
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">
                    Cari Nama / NPSN
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      type="text"
                      placeholder="Ketik nama madrasah atau NPSN..."
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      className="h-12 pl-11 rounded-xl border-slate-200 font-bold"
                    />
                    {searchInput && (
                      <button
                        onClick={() => setSearchInput('')}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Empty State */}
            {reportData.data.length === 0 ? (
              <Card className="border-0 shadow-sm bg-white rounded-[2.5rem]">
                <CardContent className="p-10 flex flex-col items-center justify-center gap-4 text-center">
                  <div className="h-16 w-16 rounded-full bg-emerald-50 flex items-center justify-center">
                    <School className="h-8 w-8 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">
                      {hasActiveFilters ? 'Tidak Ada Hasil' : 'Semua Sudah Mengajukan'}
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                      {hasActiveFilters
                        ? 'Tidak ada madrasah yang cocok dengan filter yang dipilih'
                        : 'Semua madrasah jam\'iyyah sudah mengajukan SK'}
                    </p>
                  </div>
                  {hasActiveFilters && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleResetFilters}
                      className="rounded-xl font-bold uppercase text-[10px] tracking-widest mt-2"
                    >
                      <X className="w-3 h-3 mr-1" />
                      Reset Filter
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              /* Data Table */
              <Card className="border-0 shadow-sm bg-white rounded-[2.5rem] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">No</th>
                        <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Nama Madrasah</th>
                        <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">NPSN</th>
                        <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Jenjang</th>
                        <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Kecamatan</th>
                        <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Kepala Madrasah</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {reportData.data.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-6 text-center font-bold text-slate-400 text-xs">{idx + 1}</td>
                          <td className="p-6 font-black text-slate-800 text-sm tracking-tight">{item.nama}</td>
                          <td className="p-6 text-xs font-bold text-slate-500">{item.npsn || '-'}</td>
                          <td className="p-6 text-xs font-bold text-slate-500">{item.jenjang || '-'}</td>
                          <td className="p-6 text-xs font-bold text-slate-600">{item.kecamatan || '-'}</td>
                          <td className="p-6 text-xs font-bold text-slate-600">{item.kepala_madrasah || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </>
        )}
      </div>

      {/* ── PRINT LAYOUT ── */}
      {reportData && reportData.data.length > 0 && (
        <div className="print-only print-page">
          <div className="print-header">
            <h1>Laporan Madrasah Belum Mengajukan SK</h1>
            <h2>LP Ma'arif NU Cilacap</h2>
            {(startDate || endDate) && (
              <p>
                Periode: {startDate ? new Date(startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Awal'}{' '}
                s/d {endDate ? new Date(endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Sekarang'}
              </p>
            )}
            {(jenjang || kecamatan) && (
              <p>
                {jenjang && `Jenjang: ${jenjang}`}
                {jenjang && kecamatan && ' | '}
                {kecamatan && `Kecamatan: ${kecamatan}`}
              </p>
            )}
          </div>
          <hr className="print-divider" />

          <table className="print-table">
            <thead>
              <tr>
                <th style={{ width: '5%' }}>No</th>
                <th style={{ width: '25%' }}>Nama Madrasah</th>
                <th style={{ width: '12%' }}>NPSN</th>
                <th style={{ width: '10%' }}>Jenjang</th>
                <th style={{ width: '18%' }}>Kecamatan</th>
                <th style={{ width: '20%' }}>Kepala Madrasah</th>
                <th style={{ width: '10%' }}>Telepon</th>
              </tr>
            </thead>
            <tbody>
              {reportData.data.map((item, idx) => (
                <tr key={item.id}>
                  <td className="center">{idx + 1}</td>
                  <td style={{ fontWeight: 700 }}>{item.nama}</td>
                  <td className="center">{item.npsn || '-'}</td>
                  <td className="center">{item.jenjang || '-'}</td>
                  <td>{item.kecamatan || '-'}</td>
                  <td>{item.kepala_madrasah || '-'}</td>
                  <td className="center">{item.telepon || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="print-footer">
            <div className="date-info">
              Dicetak pada: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
            <div className="page-info">
              Total: {reportData.total} madrasah
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
