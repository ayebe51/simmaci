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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
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
  const [searchQuery, setSearchQuery] = useState("")

  // Filter schools manually for robust search
  const filteredSchools = schools.filter(school => 
    school.nama.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // ... (existing code)

  // 5. Render
  return (
    // ...
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
                    <PopoverContent className="w-[300px] p-0">
                      <div className="flex flex-col">
                        <div className="p-2 border-b">
                           <Input 
                              placeholder="Cari nama sekolah..." 
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="h-8"
                           />
                        </div>
                        <div className="max-h-[300px] overflow-y-auto p-1">
                            {/* Option: Semua Sekolah */}
                            <div
                                className={cn(
                                  "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-slate-100 hover:text-slate-900 cursor-pointer",
                                  selectedSchool === 'all' && "bg-slate-100"
                                )}
                                onClick={() => {
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
                            
                            {/* Filtered Options */}
                            {filteredSchools.length === 0 ? (
                               <div className="py-6 text-center text-sm text-muted-foreground">Sekolah tidak ditemukan.</div>
                            ) : (
                                filteredSchools.map((school) => (
                                  <div
                                    key={school._id}
                                    className={cn(
                                      "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-slate-100 hover:text-slate-900 cursor-pointer",
                                      selectedSchool === school._id && "bg-slate-100"
                                    )}
                                    onClick={() => {
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
                                ))
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
