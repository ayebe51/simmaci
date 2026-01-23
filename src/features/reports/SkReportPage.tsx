import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'

export default function SkReportPage() {
  // Get user - with error handling
  let user = null
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Laporan Surat Keputusan</h1>
        <p className="text-muted-foreground mt-1">
          Generate dan export laporan SK dengan berbagai filter
        </p>
      </div>

      {/* User Info Card - Debug */}
      <Card>
        <CardHeader>
          <CardTitle>User Info (Debug)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p><strong>Name:</strong> {user?.name || 'N/A'}</p>
            <p><strong>Role:</strong> {user?.role || 'N/A'}</p>
            <p><strong>Unit Kerja:</strong> {user?.unitKerja || 'N/A'}</p>
            <p><strong>Is Operator:</strong> {isOperator ? 'Yes' : 'No'}</p>
          </div>
        </CardContent>
      </Card>

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
                <label className="text-sm font-medium">Tanggal Mulai</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full mt-1 p-2 border rounded"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Tanggal Akhir</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full mt-1 p-2 border rounded"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button onClick={() => alert('Apply filters!')}>
                Terapkan Filter
              </Button>
              <Button variant="outline" onClick={() => {
                setStartDate('')
                setEndDate('')
              }}>
                Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats - Static for now */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {['Total SK', 'Draft', 'Pending', 'Disetujui', 'Ditolak'].map((label) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-gray-400">--</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Preview Table Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Preview Data (0 records)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            No data to display. Try adjusting filters or adding SK documents.
          </p>
        </CardContent>
      </Card>

      {/* Export Button */}
      <div>
        <Button disabled>
          Export to Excel
        </Button>
      </div>
    </div>
  )
}
