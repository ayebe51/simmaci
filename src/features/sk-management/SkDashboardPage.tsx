import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { FilePlus, Search, Trash2, FileText } from "lucide-react"
import { useNavigate } from "react-router-dom"
import StatusBadge from "@/components/shared/StatusBadge"
import type { StatusType } from "@/components/shared/StatusBadge"
import { useState, useEffect, useMemo } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
// 🔥 CONVEX REAL-TIME
import { useQuery, useMutation } from "convex/react"
import { api as convexApi } from "../../../convex/_generated/api"

// Type definitions (to be moved to types/sk.ts later)
interface SkSubmission {
  id: string
  nomorSurat: string
  jenisSk: string
  nama: string
  tanggalPengajuan: string
  status: StatusType
  suratPermohonanUrl?: string
}

export default function SkDashboardPage() {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState("all")
  
  // 🔥 REAL-TIME CONVEX QUERY - Auto-updates!
  const convexSkData = useQuery(convexApi.sk.list, {
    jenisSk: filterType === "all" ? undefined : filterType,
  })
  
  // Mutations
  const archiveAllSk = useMutation(convexApi.sk.archiveAll) // assuming we'll create this

  // Map Convex data to frontend interface
  const skData: SkSubmission[] = useMemo(() => {
    if (!convexSkData) return []
    
    return convexSkData.map((item) => ({
      id: item._id,
      nomorSurat: item.nomorSk || "-",
      jenisSk: item.jenisSk,
      nama: item.nama,
      tanggalPengajuan: new Date(item.createdAt).toLocaleDateString('id-ID', {
        day: 'numeric', month: 'short', year: 'numeric'
      }),
      status: item.status as StatusType,
      suratPermohonanUrl: item.fileUrl
    }))
  }, [convexSkData])
  
  const isLoading = convexSkData === undefined

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const handleReset = async () => {
    if (!confirm("⚠️ PERINGATAN! \n\nApakah anda yakin ingin MENGHAPUS SEMUA riwayat SK?\nTindakan ini akan mengarsipkan semua SK.")) return
    
    try {
        const result = await archiveAllSk()
        alert(`Berhasil mengarsipkan ${result.count} dokumen SK.`)
    } catch (e: any) {
        alert("Gagal reset data: " + e.message)
    }
  }

  // Filter Logic (client-side for search term only, jenisSk filtered server-side)
  const filteredData = useMemo(() => skData.filter(item => {
    const matchesSearch = item.nama.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.jenisSk.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  }), [skData, searchTerm])

  // Pagination Logic
  const totalPages = Math.ceil(filteredData.length / itemsPerPage)
  const paginatedData = filteredData.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
  )

  // Reset to page 1 when filters change
  useEffect(() => {
      setCurrentPage(1)
  }, [searchTerm, filterType])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manajemen SK</h1>
          <p className="text-muted-foreground">
            Kelola pengajuan dan penerbitan Surat Keputusan.
          </p>
        </div>
        <div className="flex items-center">
            <Button variant="destructive" className="mr-2" onClick={handleReset}>
                <Trash2 className="mr-2 h-4 w-4" />
                Reset Data
            </Button>
            <Button onClick={() => navigate("/dashboard/sk/new")}>
            <FilePlus className="mr-2 h-4 w-4" />
            Ajuan Baru
            </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Pengajuan SK</CardTitle>
          <CardDescription>
            Lihat status pengajuan SK Anda di sini.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama atau jenis SK..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-[200px]">
                <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger>
                        <SelectValue placeholder="Filter Jenis SK" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Jenis</SelectItem>
                        <SelectItem value="SK Kepala Madrasah">SK Kepala Madrasah</SelectItem>
                        <SelectItem value="SK Guru Tetap Yayasan">SK GTY</SelectItem>
                        <SelectItem value="SK Guru Tidak Tetap">SK GTT</SelectItem>
                        <SelectItem value="SK Tenaga Kependidikan">SK Tendik</SelectItem>
                    </SelectContent>
                </Select>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Jenis SK</TableHead>
                  <TableHead>Nama Pemohon</TableHead>
                  <TableHead>Nomor Surat</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                     <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                            Memuat data...
                        </TableCell>
                    </TableRow>
                ) : filteredData.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center">
                            Tidak ada data ditemukan.
                        </TableCell>
                    </TableRow>
                ) : (
                    paginatedData.map((item) => (
                      <TableRow 
                        key={item.id} 
                        className="cursor-pointer hover:bg-slate-50"
                        onClick={() => navigate(`/dashboard/sk/${item.id}`)}
                      >
                        <TableCell>{item.tanggalPengajuan}</TableCell>
                        <TableCell className="font-medium">{item.jenisSk}</TableCell>
                        <TableCell>{item.nama}</TableCell>
                        <TableCell>{item.nomorSurat}</TableCell>
                        <TableCell>
                          <StatusBadge status={item.status} />
                        </TableCell>
                        <TableCell className="text-right">
                           {item.suratPermohonanUrl && (
                                <Button variant="ghost" size="sm" className="mr-1 text-blue-600" onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(item.suratPermohonanUrl, '_blank');
                                }}>
                                    <FileText className="w-4 h-4" />
                                </Button>
                            )}
                            <Button variant="ghost" size="sm">Detail</Button>
                        </TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          {!isLoading && filteredData.length > itemsPerPage && (
            <div className="flex items-center justify-end space-x-2 py-4 px-2">
              <div className="flex-1 text-sm text-muted-foreground">
                Halaman {currentPage} dari {totalPages} ({filteredData.length} data)
              </div>
              <div className="space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                >
                  First
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                >
                  Last
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
