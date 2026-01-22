import { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Download, FileText, Filter } from 'lucide-react'
import * as XLSX from 'xlsx'
import { format } from 'date-fns'

export default function SkReportPage() {
  // Filters
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [selectedSchool, setSelectedSchool] = useState<string>('')
  const [selectedStatus, setSelectedStatus] = useState<string>('')
  
  // User context
  const userStr = localStorage.getItem('user')
  const user = userStr ? JSON.parse(userStr) : null
  const isOperator = user?.role === 'operator'
  
  // Fetch schools
  const schools = useQuery(api.schools.list)
  
  // Build query args
  const queryArgs = {
    startDate: startDate ? new Date(startDate).getTime() : undefined,
    endDate: endDate ? new Date(endDate + 'T23:59:59').getTime() : undefined,
    schoolId: selectedSchool || (isOperator ? user?.unitKerja : undefined),
    status: selectedStatus || undefined,
  }
  
  // Fetch report data
  const reportData = useQuery(api.reports.generateSkReport, queryArgs)
  
  // Debug logging
  console.log('🔍 SK Report Debug:', {
    userStr,
    user,
    isOperator,
    queryArgs,
    reportData,
    schools
  })
  
  // Export to Excel
  const handleExportExcel = () => {
    if (!reportData?.data) return
    
    // Prepare data for export
    const excelData = reportData.data.map((sk: any) => ({
      'Nomor SK': sk.nomorSK || '-',
      'Jenis SK': sk.jenisSK || '-',
      'Nama Guru': sk.teacherName,
      'NIP': sk.teacherNIP,
      'Sekolah': sk.schoolName,
      'Status': sk.status,
      'Tanggal Dibuat': sk.createdAt ? format(new Date(sk.createdAt), 'dd/MM/yyyy') : '-',
      'Keterangan': sk.keterangan || '-',
    }))
    
    // Create workbook
    const wb = XLSX.utils.book_new()
    
    // Summary sheet
    const summaryData = [
      ['LAPORAN SURAT KEPUTUSAN'],
      ['Yayasan Maarif NU Cilacap'],
      [''],
      ['Filter yang Diterapkan:'],
      ['Tanggal Mulai:', startDate || 'Semua'],
      ['Tanggal Akhir:', endDate || 'Semua'], 
      ['Sekolah:', selectedSchool ? schools?.find(s => s._id === selectedSchool)?.namaSekolah : 'Semua'],
      ['Status:', selectedStatus || 'Semua'],
      [''],
      ['RINGKASAN STATISTIK:'],
      ['Total SK:', reportData.summary.total],
      ['Draft:', reportData.summary.draft],
      ['Pending Review:', reportData.summary.pending],
      ['Disetujui:', reportData.summary.approved],
      ['Ditolak:', reportData.summary.rejected],
      [''],
      ['BERDASARKAN JENIS:'],
      ['Pengangkatan:', reportData.byType.pengangkatan],
      ['Mutasi:', reportData.byType.mutasi],
      ['Promosi:', reportData.byType.promosi],
      ['Pemberhentian:', reportData.byType.pemberhentian],
      [''],
      ['Dicetak pada:', format(new Date(), 'dd/MM/yyyy HH:mm:ss')],
    ]
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Ringkasan')
    
    // Data sheet
    const dataSheet = XLSX.utils.json_to_sheet(excelData)
    
    // Auto-width columns
    const maxWidth = 30
    const cols = Object.keys(excelData[0] || {}).map(key => ({
      wch: Math.min(key.length + 2, maxWidth)
    }))
    dataSheet['!cols'] = cols
    
    XLSX.utils.book_append_sheet(wb, dataSheet, 'Data SK')
    
    // Download
    const timestamp = format(new Date(), 'yyyyMMdd_HHmmss')
    XLSX.writeFile(wb, `Laporan_SK_${timestamp}.xlsx`)
  }
  
  // Reset filters
  const handleResetFilters = () => {
    setStartDate('')
    setEndDate('')
    setSelectedSchool('')
    setSelectedStatus('')
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
      
      {/* Filter Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filter Laporan
            </CardTitle>
            <Button variant="outline" size="sm" onClick={handleResetFilters}>
              Reset Filter
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Date Range */}
            <div>
              <Label htmlFor="startDate">Tanggal Mulai</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="endDate">Tanggal Akhir</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            {/* School Filter (Super Admin only) */}
            {!isOperator && (
              <div>
                <Label htmlFor="school">Sekolah</Label>
                <Select value={selectedSchool} onValueChange={setSelectedSchool}>
                  <SelectTrigger>
                    <SelectValue placeholder="Semua Sekolah" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Semua Sekolah</SelectItem>
                    {schools?.map(school => (
                      <SelectItem key={school._id} value={school._id}>
                        {school.namaSekolah}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {/* Status Filter */}
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Semua Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Semua Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending">Pending Review</SelectItem>
                  <SelectItem value="approved">Disetujui</SelectItem>
                  <SelectItem value="rejected">Ditolak</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Summary Stats */}
      {reportData && (
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
      )}
      
      {/* Export Actions */}
      <div className="flex gap-2">
        <Button 
          onClick={handleExportExcel} 
          disabled={!reportData?.data?.length}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Export to Excel
        </Button>
        <span className="text-sm text-muted-foreground self-center ml-2">
          {reportData?.data?.length || 0} records
        </span>
      </div>
      
      {/* Preview Table */}
      <Card>
        <CardHeader>
          <CardTitle>Preview Data</CardTitle>
        </CardHeader>
        <CardContent>
          {reportData?.data && reportData.data.length > 0 ? (
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No</TableHead>
                    <TableHead>Nomor SK</TableHead>
                    <TableHead>Jenis</TableHead>
                    <TableHead>Nama Guru</TableHead>
                    <TableHead>Sekolah</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tanggal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.data.map((sk: any, idx: number) => (
                    <TableRow key={sk._id}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell className="font-medium">{sk.nomorSK || '-'}</TableCell>
                      <TableCell>{sk.jenisSK || '-'}</TableCell>
                      <TableCell>{sk.teacherName}</TableCell>
                      <TableCell>{sk.schoolName}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          sk.status === 'approved' ? 'bg-green-100 text-green-700' :
                          sk.status === 'rejected' ? 'bg-red-100 text-red-700' :
                          sk.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {sk.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        {sk.createdAt ? format(new Date(sk.createdAt), 'dd/MM/yyyy') : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">Tidak ada data</p>
              <p className="text-sm mt-1">
                Tidak ada SK yang sesuai dengan filter yang dipilih
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
