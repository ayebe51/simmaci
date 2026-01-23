import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'

export default function SkReportPageSimple() {
  console.log('🔍 SK Report Simple - Component Rendering')
  
  // Get user
  const userStr = localStorage.getItem('user')
  const user = userStr ? JSON.parse(userStr) : null
  
  console.log('🔍 User:', user)
  
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-4">Laporan SK (Test)</h1>
      <div className="bg-white p-6 rounded-lg shadow">
        <p className="text-lg">User: {user?.name || 'Unknown'}</p>
        <p className="text-sm text-gray-600">Role: {user?.role || 'N/A'}</p>
        <p className="text-sm text-gray-600">Unit: {user?.unitKerja || 'N/A'}</p>
        <div className="mt-4">
          <p className="font-bold">Status: Page Loaded Successfully! ✅</p>
        </div>
      </div>
    </div>
  )
}
