/* eslint-disable @typescript-eslint/no-explicit-any */
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
import { FilePlus, Search, Trash2, FileText, CheckSquare, XSquare } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { useNavigate } from "react-router-dom"
import StatusBadge from "@/components/shared/StatusBadge"
import type { StatusType } from "@/components/shared/StatusBadge"
import { useState, useEffect, useMemo } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
// 🔥 CONVEX REAL-TIME
import { useQuery, useMutation } from "convex/react"
import { api as convexApi } from "../../../convex/_generated/api"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Type definitions (to be moved to types/sk.ts later)
interface SkSubmission {
  id: string
  nomorSurat: string
  jenisSk: string
  nama: string
  tanggalPengajuan: string
  status: StatusType
  suratPermohonanUrl?: string
  isTeacher?: boolean
}

export default function SkDashboardPage() {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [statusFilter, setStatusFilter] = useState<StatusType | "all">("draft") // Default view: Drafts only
  
  // 🔥 REAL-TIME CONVEX QUERY
  // 1. Get SK Documents (Approved/Rejected/Issued)
  const skDocuments = useQuery(convexApi.sk.list, {
    jenisSk: filterType === "all" ? undefined : filterType,
    status: statusFilter === "all" || statusFilter === "draft" ? undefined : statusFilter, 
    // If "Draft", we don't look at SKs (unless legacy). We look at Teachers Queue.
  })

  // 2. Get Teachers Queue (Candidates for SK) - Only for "Draft" tab
  // DEBUG: Removing filter to see ALL teachers
  const teacherQueue = useQuery(convexApi.sk.getTeachersWithSk, { isVerified: false })

  // Mutations
  const archiveAllSk = useMutation(convexApi.sk.archiveAll)
  const batchUpdateStatusMutation = useMutation(convexApi.sk.batchUpdateStatus)
  const verifyTeacherMutation = useMutation(convexApi.sk.verifyTeacher)
  const rejectTeacherMutation = useMutation(convexApi.sk.rejectTeacher)
  // We need to use valid mutations. create for SK is `create` not `approve`
  // We need to use valid mutations. create for SK is `create` not `approve`
  const createSkMutation = useMutation(convexApi.sk.create)
  // FIXED: Add CleanSK hook
  const cleanSk = useMutation(convexApi.cleanup.cleanSk)
  
  // Selection state for batch operations
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  
  // Combine Data based on Active Tab
  const skData: SkSubmission[] = useMemo(() => {
    // A. If Tab is "Draft" (Perlu Diproses), show Teacher Queue
    if (statusFilter === "draft") {
        if (!teacherQueue) return []
        return teacherQueue.map(t => ({
            id: t._id,
            nomorSurat: "-", // No SK Number yet
            jenisSk: t.status === "GTY" ? "SK Guru Tetap Yayasan" : t.status === "GTT" ? "SK Guru Tidak Tetap" : "SK Tenaga Kependidikan",
            nama: t.nama,
            tanggalPengajuan: new Date(t.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
            status: "draft", // Visual status
            suratPermohonanUrl: undefined, // Or check if we can add this to teacher schema later
            isTeacher: true // Flag to identify this is a Teacher record, not SK
        }))
    }

    // B. If Tab is "Approved", "Rejected", "All" -> Show SK Documents
    if (!skDocuments) return []
    
    return skDocuments.map((item) => ({
      id: item._id,
      nomorSurat: item.nomorSk || "-",
      jenisSk: item.jenisSk,
      nama: item.nama,
      tanggalPengajuan: new Date(item.createdAt).toLocaleDateString('id-ID', {
        day: 'numeric', month: 'short', year: 'numeric'
      }),
      status: item.status as StatusType,
      suratPermohonanUrl: item.fileUrl,
      isTeacher: false
    }))
  }, [skDocuments, teacherQueue, statusFilter])

  const isLoading = statusFilter === "draft" ? teacherQueue === undefined : skDocuments === undefined;

  // Batch selection handlers
  // Filter Logic (moved up)
  const filteredData = useMemo(() => skData.filter(item => {
    const matchesSearch = item.nama.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.jenisSk.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  }), [skData, searchTerm])

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(filteredData.map(sk => sk.id))
      setSelectedIds(allIds)
    } else {
      setSelectedIds(new Set())
    }
  }
  
  const handleSelectRow = (id: string, checked: boolean) => {
    const newSelection = new Set(selectedIds)
    if (checked) {
      newSelection.add(id)
    } else {
      newSelection.delete(id)
    }
    setSelectedIds(newSelection)
  }

  // Batch actions
  const handleBatchApprove = async () => {
    if (selectedIds.size === 0) {
      alert("Pilih minimal satu data untuk di-approve")
      return
    }
    
    if (!confirm(`Approve ${selectedIds.size} data yang dipilih? Data akan masuk ke Generator SK.`)) return
    
    try {
        const ids = Array.from(selectedIds) as any[]
        
        if (statusFilter === "draft") {
            // Approve Teachers -> Verify them
             await Promise.all(ids.map(id => verifyTeacherMutation({ id })))
             // Ideally use bulkVerifyTeachers if available
        } else {
            // Approve SKs -> Update status
             await batchUpdateStatusMutation({ ids, status: "approved" })
        }

      setSelectedIds(new Set()) // Clear selection
      alert(`✅ Berhasil meng-approve ${selectedIds.size} data!`)
    } catch (error) {
      console.error("Batch approve failed:", error)
      alert("Gagal approve data. Silakan coba lagi.")
    }
  }
  
  const handleBatchReject = async () => {
    if (selectedIds.size === 0) {
      alert("Pilih minimal satu SK untuk di-reject")
      return
    }
    
    const reason = prompt("Alasan penolakan (Wajib diisi):")
    if (!reason) return 
    
    if (!confirm(`Tolak ${selectedIds.size} pengajuan ini?`)) return
    
    try {
      const ids = Array.from(selectedIds) as any[]
      
      if (statusFilter === "draft") {
          // Reject Teachers
          await Promise.all(ids.map(id => rejectTeacherMutation({ id, reason })))
      } else {
          // Reject SK Documents
          await batchUpdateStatusMutation({ 
            ids, 
            status: "rejected",
            rejectionReason: reason
          })
      }

      setSelectedIds(new Set()) 
      alert(`✅ Berhasil menolak ${selectedIds.size} data!`)
    } catch (error) {
      console.error("Batch reject failed:", error)
      alert("Gagal reject SK. Silakan coba lagi.")
    }
  }



  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

    const handleReset = async () => {
    if (!confirm("⚠️ RESET PENGAJUAN SK \n\nApakah anda yakin ingin menghapus SEMUA data di 'Perlu Diproses' (Draft)?\nData Guru Master & SK yang sudah terbit TIDAK akan dihapus.")) return
    
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result: any = await cleanSk()
        alert(`Berhasil membersihkan ${result.draftsDeleted} data sampah (Draft).`)
        // Refresh?
        window.location.reload() 
    } catch (e) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        alert("Gagal reset data: " + (e as any).message)
    }
  }



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
          <h1 className="text-2xl font-bold tracking-tight">Manajemen SK (v1.3)</h1>
          <p className="text-muted-foreground">
            Kelola pengajuan dan penerbitan Surat Keputusan.
          </p>
        </div>
        <div className="flex items-center">
            {["admin", "super_admin"].includes(JSON.parse(localStorage.getItem("user") || "{}")?.role) && (
                <Button variant="destructive" className="mr-2" onClick={handleReset}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Reset Data
                </Button>
            )}
            <Button onClick={() => navigate("/dashboard/sk/new")}>
            <FilePlus className="mr-2 h-4 w-4" />
            Ajukan SK Baru
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
          
          {/* Status Tabs (Inbox Workflow) */}
          <Tabs defaultValue="draft" value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)} className="w-full mb-6">
            <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
              <TabsTrigger value="draft">
                  Perlu Diproses {teacherQueue ? `(${teacherQueue.length})` : ""}
              </TabsTrigger>
              <TabsTrigger value="approved">Disetujui</TabsTrigger>
              <TabsTrigger value="rejected">Ditolak</TabsTrigger>
              <TabsTrigger value="all">Semua Data</TabsTrigger>
            </TabsList>
          </Tabs>

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
                  <TableHead className="w-[50px]">
                    {["admin", "super_admin"].includes(JSON.parse(localStorage.getItem("user") || "{}")?.role) && (
                        <Checkbox
                        checked={filteredData.length > 0 && selectedIds.size === filteredData.length}
                        onCheckedChange={handleSelectAll}
                        />
                    )}
                  </TableHead>
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
                        <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                            Memuat data...
                        </TableCell>
                    </TableRow>
                ) : filteredData.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center">
                            Tidak ada data ditemukan.
                        </TableCell>
                    </TableRow>
                ) : (
                    paginatedData.map((item) => (
                      <TableRow 
                        key={item.id} 
                        className="hover:bg-muted/50"
                        data-state={selectedIds.has(item.id) ? "selected" : ""}
                      >
                        <TableCell>
                          {["admin", "super_admin"].includes(JSON.parse(localStorage.getItem("user") || "{}")?.role) && (
                              <Checkbox
                                checked={selectedIds.has(item.id)}
                                onCheckedChange={(checked) => handleSelectRow(item.id, !!checked)}
                              />
                          )}
                        </TableCell>
                        <TableCell>{new Date(item.tanggalPengajuan).toLocaleDateString('id-ID')}</TableCell>
                        <TableCell>{item.jenisSk}</TableCell>
                        <TableCell className="font-medium">{item.nama}</TableCell>
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
                            <Button variant="ghost" size="sm" onClick={() => navigate(`/dashboard/sk/${item.id}`)}>
                                <FileText className="h-4 w-4 mr-2" />
                                Detail
                            </Button>
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

      {/* Floating Batch Action Bar - ADMIN ONLY */}
      {selectedIds.size > 0 && ["admin", "super_admin"].includes(JSON.parse(localStorage.getItem("user") || "{}")?.role) && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white border shadow-lg rounded-full px-6 py-3 flex items-center gap-4 z-50 animate-in slide-in-from-bottom-5">
          <span className="font-medium">{selectedIds.size} SK Dipilih</span>
          <Button onClick={handleBatchApprove} size="sm" className="bg-green-600 hover:bg-green-700">
            <CheckSquare className="mr-2 h-4 w-4" />
            Approve Selected
          </Button>
          <Button onClick={handleBatchReject} variant="destructive" size="sm">
            <XSquare className="mr-2 h-4 w-4" />
            Reject Selected
          </Button>
          <Button 
            onClick={() => setSelectedIds(new Set())} 
            variant="ghost" 
            size="sm"
          >
            Batal
          </Button>
        </div>
      )}
    </div>
  )
}
