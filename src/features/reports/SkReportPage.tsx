import { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Label } from '../../components/ui/label'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'

export default function SkReportPage() {
  // Get user - with error handling
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let user: any = null
  let isOperator = false
  
  try {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      user = JSON.parse(userStr)
      isOperator = user.role === 'operator'
    }
  } catch (error) {
    console.error('Error parsing user:', error)
  }

  // State
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedSchool, setSelectedSchool] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')

  // Fetch schools - with error handling
  const schools = useQuery(api.schools.list, {})
  
  // Find operator's school ID by name
  const operatorSchoolId = isOperator && user?.unitKerja 
    ? schools?.find(s => s.nama === user.unitKerja)?._id
    : undefined
  
  // Build query args - with null checks
  const queryArgs = {
    startDate: startDate ? new Date(startDate).getTime() : undefined,
    endDate: endDate ? new Date(endDate + 'T23:59:59').getTime() : undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schoolId: (selectedSchool && selectedSchool !== 'all') ? selectedSchool as any : operatorSchoolId as any,
    status: (selectedStatus && selectedStatus !== 'all') ? selectedStatus : undefined,
  }
  
  // Fetch report data - with error handling
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reportData = useQuery(api.reports.generateSkReport, queryArgs) as any
  
  // Debug logging
  console.log('🔍 SK Report Debug:', {
    user,
    isOperator,
    queryArgs,
    reportData,
    schools
  })

  // Reset filters
  const handleResetFilters = () => {
    setStartDate('')
    setEndDate('')
    setSelectedSchool('all')
    setSelectedStatus('all')
  }

  // Excel Export Handler
  const handleExportExcel = () => {
    if (!reportData || !reportData.data || reportData.data.length === 0) {
      toast.error('Tidak ada data untuk di-export')
      return
    }

    try {
      // Create workbook
      const wb = XLSX.utils.book_new()

      // Sheet 1: Ringkasan
      const summaryData = [
        ['LAPORAN SURAT KEPUTUSAN'],
        ['Tanggal Export:', new Date().toLocaleString('id-ID')],
        [],
        ['RINGKASAN DATA'],
        ['Total SK', reportData.summary.total],
        ['Draft', reportData.summary.draft],
        ['Pending Review', reportData.summary.pending],
        ['Disetujui', reportData.summary.approved],
        ['Ditolak', reportData.summary.rejected],
        [],
        ['BREAKDOWN JENIS SK'],
        ['Pengangkatan', reportData.byType.pengangkatan],
        ['Mutasi', reportData.byType.mutasi],
        ['Promosi', reportData.byType.promosi],
        ['Pemberhentian', reportData.byType.pemberhentian],
      ]
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData)
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan')

      // Sheet 2: Data SK
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const skData = reportData.data.map((sk: any, index: number) => ({
        'No': index + 1,
        'Nomor SK': sk.nomorSk,
        'Jenis SK': sk.jenisSk,
        'Nama': sk.nama,
        'Jabatan': sk.jabatan || '-',
        'Sekolah': sk.schoolName || 'N/A',
        'Status': sk.status,
        'Tanggal Penetapan': sk.tanggalPenetapan || '-',
        'Tanggal Dibuat': new Date(sk.createdAt).toLocaleDateString('id-ID'),
      }))
      const wsData = XLSX.utils.json_to_sheet(skData)
      
      // Set column widths
      wsData['!cols'] = [
        { wch: 5 },  // No
        { wch: 20 }, // Nomor SK
        { wch: 15 }, // Jenis SK
        { wch: 25 }, // Nama
        { wch: 20 }, // Jabatan
        { wch: 30 }, // Sekolah
        { wch: 12 }, // Status
        { wch: 18 }, // Tanggal Penetapan
        { wch: 15 }, // Tanggal Dibuat
      ]
      
      XLSX.utils.book_append_sheet(wb, wsData, 'Data SK')

      // Generate filename
      const filename = `Laporan_SK_${new Date().toISOString().split('T')[0]}.xlsx`
      
      // Export
      XLSX.writeFile(wb, filename)
      
      toast.success(`Berhasil export ${reportData.data.length} data SK ke Excel`)
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Gagal export data')
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Laporan Surat Keputusan</h1>
        <p className="text-muted-foreground mt-1">
          Generate dan export laporan SK dengan berbagai filter
        </p>
      </div>

      {/* Filters Card */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Laporan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {/* Date Range */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startDate">Tanggal Mulai</Label>
                <input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full mt-1 p-2 border rounded"
                  aria-label="Tanggal Mulai"
                />
              </div>
              <div>
                <Label htmlFor="endDate">Tanggal Akhir</Label>
                <input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full mt-1 p-2 border rounded"
                  aria-label="Tanggal Akhir"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {/* School Filter (Super Admin only) */}
              {!isOperator && (
                <div>
                  <Label>Sekolah</Label>
                  <Select value={selectedSchool} onValueChange={setSelectedSchool}>
                    <SelectTrigger>
                      <SelectValue placeholder="Semua Sekolah" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Sekolah</SelectItem>
                      {schools?.map(school => (
                        <SelectItem key={school._id} value={school._id}>
                          {school.nama}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {/* Status Filter */}
              <div>
                <Label>Status</Label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Semua Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Status</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="pending">Pending Review</SelectItem>
                    <SelectItem value="approved">Disetujui</SelectItem>
                    <SelectItem value="rejected">Ditolak</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleResetFilters}>
                Reset Filter
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats - Now with real data! */}
      {reportData ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{reportData.summary.total}</div>
              <div className="text-xs text-muted-foreground">Total SK</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-gray-600">
                {reportData.summary.draft}
              </div>
              <div className="text-xs text-muted-foreground">Draft</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-yellow-600">
                {reportData.summary.pending}
              </div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">
                {reportData.summary.approved}
              </div>
              <div className="text-xs text-muted-foreground">Disetujui</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-red-600">
                {reportData.summary.rejected}
              </div>
              <div className="text-xs text-muted-foreground">Ditolak</div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {['Total SK', 'Draft', 'Pending', 'Disetujui', 'Ditolak'].map((label) => (
            <Card key={label}>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-gray-300 animate-pulse">--</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Preview Table - Simple version */}
      <Card>
        <CardHeader>
          <CardTitle>
            Preview Data ({reportData?.data?.length || 0} records)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reportData && reportData.data && reportData.data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">No</th>
                    <th className="text-left p-2">Nomor SK</th>
                    <th className="text-left p-2">Nama</th>
                    <th className="text-left p-2">Sekolah</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Tanggal</th>
                  </tr>
                </thead>
                <tbody>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {reportData.data.slice(0, 10).map((sk: any, index: number) => (
                    <tr key={sk._id} className="border-b hover:bg-gray-50">
                      <td className="p-2">{index + 1}</td>
                      <td className="p-2">{sk.nomorSk}</td>
                      <td className="p-2">{sk.nama}</td>
                      <td className="p-2">{sk.schoolName || 'N/A'}</td>
                      <td className="p-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          sk.status === 'approved' ? 'bg-green-100 text-green-800' :
                          sk.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          sk.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {sk.status}
                        </span>
                      </td>
                      <td className="p-2">
                        {new Date(sk.createdAt).toLocaleDateString('id-ID')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {reportData.data.length > 10 && (
                <p className="text-sm text-muted-foreground mt-2 text-center">
                  Menampilkan 10 dari {reportData.data.length} records
                </p>
              )}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              {reportData === undefined ? 'Loading...' : 'No data to display'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Export Button - Now functional! */}
      <div>
        <Button 
          onClick={handleExportExcel}
          disabled={!reportData || reportData.data.length === 0}
        >
          <Download className="w-4 h-4 mr-2" />
          Export to Excel ({reportData?.data?.length || 0} records)
        </Button>
      </div>
    </div>
  )
}
