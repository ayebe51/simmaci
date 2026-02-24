
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
import { FilePlus, Search, Trash2, FileText, CheckSquare, XSquare, AlertTriangle, CheckCircle, XCircle } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { useNavigate } from "react-router-dom"
// import StatusBadge from "@/components/shared/StatusBadge" // Replaced with inline or improved badge
import type { StatusType } from "@/components/shared/StatusBadge"
import { useState, useEffect, useMemo } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
// 🔥 CONVEX REAL-TIME
import { useQuery, useMutation, usePaginatedQuery } from "convex/react"
import { Loader2 } from "lucide-react"
import { api as convexApi } from "../../../convex/_generated/api"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

// Type definitions (to be moved to types/sk.ts later)
interface SkSubmission {
  id: string
  nomorSurat: string
  jenisSk: string
  nama: string
  unitKerja?: string // NEW: Unit Kerja
  tanggalPengajuan: string
  status: StatusType
  suratPermohonanUrl?: string
  isTeacher?: boolean
  // Revision fields
  revisionStatus?: string
  revisionReason?: string
  revisionData?: string
}

export default function SkDashboardPage() {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [statusFilter, setStatusFilter] = useState<StatusType | "all">("draft") // Default view: Drafts only
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  
  // 1. Get SK Documents (Approved/Rejected/Issued)
  // Retrieve user context for security filtering
  const user = useMemo(() => {
      try {
          return JSON.parse(localStorage.getItem("user") || "{}");
      } catch { return {}; }
  }, []);

  const queryArgs = {
      jenisSk: filterType === "all" ? undefined : filterType,
      status: statusFilter === "all" || statusFilter === "draft" ? undefined : statusFilter, 
      search: searchTerm || undefined, // Pass search to backend
      userRole: user?.role || undefined, // Ensure null becomes undefined
      userUnit: user?.unitKerja || undefined, // Ensure null becomes undefined
  };
  console.log("DEBUG: sk:list args:", queryArgs);

  // @ts-ignore
  const listFunc = convexApi.sk.list;

  const {
      results: skDocuments,
      status: skQueryStatus,
      loadMore,
      isLoading: isSkLoading
  } = usePaginatedQuery(
      listFunc,
      queryArgs,
      { initialNumItems: 20 }
  );

  // 2. Get Teachers Queue (Candidates for SK) - Only for "Draft" tab
  // DEBUG: Removing filter to see ALL teachers
  const teacherQueue = useQuery(convexApi.sk.getTeachersWithSk, { 
    isVerified: false,
    userRole: user?.role,
    userUnit: user?.unitKerja,
  })

  // Mutations
  const archiveAllSk = useMutation(convexApi.sk.archiveAll)
  const batchUpdateStatusMutation = useMutation(convexApi.sk.batchUpdateStatus)
  const verifyTeacherMutation = useMutation(convexApi.sk.verifyTeacher)
  const rejectTeacherMutation = useMutation(convexApi.sk.rejectTeacher)
  const createSkMutation = useMutation(convexApi.sk.create)
  const cleanSk = useMutation(convexApi.cleanup.cleanSk)
  
  // Selection state for batch operations
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  
  // Modal States
  const [isApproveConfirmOpen, setIsApproveConfirmOpen] = useState(false)
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false)
  const [isActionLoading, setIsActionLoading] = useState(false)
  
  // Revision Modal States
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false)
  const [selectedSkForRevision, setSelectedSkForRevision] = useState<SkSubmission | null>(null)
  const [revisionProposedData, setRevisionProposedData] = useState({ 
      nama: "", 
      tempatLahir: "",
      tanggalLahir: "",
      nip: "",
      pendidikanTerakhir: "",
      unitKerja: "", 
      tmtPendidik: "", 
      reason: "" 
  })

  const requestRevisionMutation = useMutation(convexApi.sk.requestRevision)
  const approveRevisionMutation = useMutation(convexApi.sk.approveRevision)
  const rejectRevisionMutation = useMutation(convexApi.sk.rejectRevision)
  
  // Combine Data based on Active Tab
  const skData: SkSubmission[] = useMemo(() => {
    // A. If Tab is "Draft" (Perlu Diproses), show Teacher Queue
    if (statusFilter === "draft") {
        if (!teacherQueue) return []
        // Client-side search for Teacher Queue (since it's a regular query)
        let queue = teacherQueue;
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            queue = queue.filter(t => t.nama.toLowerCase().includes(lower) || (t.unitKerja || "").toLowerCase().includes(lower));
        }

        return queue.map(t => ({
            id: t._id,
            nomorSurat: "-", // No SK Number yet
            jenisSk: t.status === "GTY" ? "SK Guru Tetap Yayasan" : t.status === "GTT" ? "SK Guru Tidak Tetap" : "SK Tenaga Kependidikan",
            nama: t.nama,
            unitKerja: t.unitKerja, // Map Teacher Unit
            tanggalPengajuan: new Date(t.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
            status: "draft", // Visual status
            suratPermohonanUrl: (t as any).suratPermohonanUrl, // Mapped from the backend
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
      unitKerja: item.unitKerja || "-", // Map SK Unit
      tanggalPengajuan: new Date(item.createdAt).toLocaleDateString('id-ID', {
        day: 'numeric', month: 'short', year: 'numeric'
      }),
      status: item.status as StatusType,
      suratPermohonanUrl: item.fileUrl,
      isTeacher: false,
      revisionStatus: item.revisionStatus,
      revisionReason: item.revisionReason,
      revisionData: item.revisionData
    }))
  }, [skDocuments, teacherQueue, statusFilter, searchTerm])

  const isLoading = statusFilter === "draft" ? teacherQueue === undefined : isSkLoading;

  // Filters are now handled by Backend (for SK Filter/Status/Search) or Memo (skData construction)
  // so we can just use skData directly.
  
  // Pagination Logic
  const itemsPerPage = 10;
  const totalPages = Math.ceil(skData.length / itemsPerPage)
  
  // Computed Slice
  const paginatedData = useMemo(() => {
      const startIndex = (currentPage - 1) * itemsPerPage
      return skData.slice(startIndex, startIndex + itemsPerPage)
  }, [skData, currentPage])

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(skData.map(sk => sk.id))
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
  const handleBatchApprove = () => {
    if (selectedIds.size === 0) {
      toast.error("Pilih minimal satu data untuk di-approve")
      return
    }
    setIsApproveConfirmOpen(true)
  }

  const executeBatchApprove = async () => {
    try {
        setIsActionLoading(true)
        const ids = Array.from(selectedIds) as any[]
        
        if (statusFilter === "draft") {
             await Promise.all(ids.map(id => verifyTeacherMutation({ id })))
        } else {
             await batchUpdateStatusMutation({ ids, status: "approved" })
        }

      toast.success(`Berhasil meng-approve ${selectedIds.size} data!`, {
          icon: <CheckCircle className="h-4 w-4 text-green-600" />
      })
      setSelectedIds(new Set())
      setIsApproveConfirmOpen(false)
    } catch (error) {
      console.error("Batch approve failed:", error)
      toast.error("Gagal approve data. Silakan coba lagi.")
    } finally {
        setIsActionLoading(false)
    }
  }
  
  const handleBatchReject = () => {
    if (selectedIds.size === 0) {
      toast.error("Pilih minimal satu SK untuk di-reject")
      return
    }
    setRejectionReason("")
    setIsRejectDialogOpen(true)
  }

  const executeBatchReject = async () => {
    if (!rejectionReason.trim()) {
        toast.error("Alasan penolakan wajib diisi")
        return
    }
    
    try {
      setIsActionLoading(true)
      const ids = Array.from(selectedIds) as any[]
      
      if (statusFilter === "draft") {
          await Promise.all(ids.map(id => rejectTeacherMutation({ id, reason: rejectionReason })))
      } else {
          await batchUpdateStatusMutation({ 
            ids, 
            status: "rejected",
            rejectionReason: rejectionReason
          })
      }

      toast.success(`Berhasil menolak ${selectedIds.size} data!`, {
          icon: <XCircle className="h-4 w-4 text-red-600" />
      })
      setSelectedIds(new Set()) 
      setIsRejectDialogOpen(false)
    } catch (error) {
      console.error("Batch reject failed:", error)
      toast.error("Gagal reject SK. Silakan coba lagi.")
    } finally {
        setIsActionLoading(false)
    }
  }





  const handleRequestRevisionSubmit = async () => {
    if (!selectedSkForRevision || !revisionProposedData.reason.trim()) {
        toast.error("Alasan revisi wajib diisi");
        return;
    }
    try {
        setIsActionLoading(true);
        const proposedDataString = JSON.stringify({
            nama: revisionProposedData.nama || undefined,
            tempatLahir: revisionProposedData.tempatLahir || undefined,
            tanggalLahir: revisionProposedData.tanggalLahir || undefined,
            nip: revisionProposedData.nip || undefined,
            pendidikanTerakhir: revisionProposedData.pendidikanTerakhir || undefined,
            unitKerja: revisionProposedData.unitKerja || undefined,
            tmtPendidik: revisionProposedData.tmtPendidik || undefined,
        });

        await requestRevisionMutation({
            skId: selectedSkForRevision.id as any,
            reason: revisionProposedData.reason,
            proposedData: proposedDataString,
        });
        toast.success("Permintaan revisi berhasil diajukan");
        setIsRevisionModalOpen(false);
    } catch (e: any) {
        toast.error("Gagal mengajukan revisi: " + e.message);
    } finally {
        setIsActionLoading(false);
    }
  };

  const handleApproveRevisionSubmit = async (skId: string) => {
    try {
        setIsActionLoading(true);
        await approveRevisionMutation({ skId: skId as any });
        toast.success("Revisi disetujui dan data diperbarui");
    } catch (e: any) {
        toast.error("Gagal menyetujui revisi: " + e.message);
    } finally {
        setIsActionLoading(false);
    }
  };

  const handleRejectRevisionSubmit = async (skId: string) => {
    try {
        setIsActionLoading(true);
        await rejectRevisionMutation({ skId: skId as any, reason: "Ditolak Admin" });
        toast.success("Revisi ditolak");
    } catch (e: any) {
        toast.error("Gagal menolak revisi: " + e.message);
    } finally {
        setIsActionLoading(false);
    }
  };


  const handleReset = async () => {
    try {
        const result: any = await cleanSk({})
        toast.success(`Berhasil membersihkan ${result.draftsDeleted} data sampah (Draft).`)
        // window.location.reload() // Prefer letting Convex reactivity handle it
    } catch (e) {
        toast.error("Gagal reset data: " + (e as any).message)
    }
  }





  // Better Pattern: Reset page during render if filters change
  const [prevFilters, setPrevFilters] = useState({ searchTerm, filterType })
  if (prevFilters.searchTerm !== searchTerm || prevFilters.filterType !== filterType) {
      setPrevFilters({ searchTerm, filterType })
      setCurrentPage(1)
  }

  // --- UI COMPONENTS ---

  const renderStatusBadge = (status: string, revisionStatus?: string) => {
      if (revisionStatus === 'pending') {
          return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-200">Menunggu Revisi</Badge>;
      }
      switch(status) {
          case 'approved':
          case 'Active':
          case 'active':
          case 'Approved':
              return <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-green-200">Disetujui</Badge>;
          case 'rejected':
          case 'Rejected':
              return <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-red-200">Ditolak</Badge>;
          case 'draft':
              return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border-yellow-200">Menunggu</Badge>;
          default:
              return <Badge variant="outline">{status}</Badge>;
      }
  };

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
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="mr-2">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Reset Data
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center text-red-600">
                                <AlertTriangle className="mr-2 h-5 w-5" />
                                Konfirmasi Reset Data
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                Apakah Anda yakin ingin menghapus data <strong>"Perlu Diproses" (Draft)</strong>?<br/><br/>
                                Tindakan ini hanya akan menghapus antrean draft yang belum diproses. Data SK yang sudah terbit (Approved/Rejected) <strong>TIDAK</strong> akan dihapus.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction onClick={handleReset} className="bg-red-600 hover:bg-red-700">
                                Ya, Hapus Draft
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
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
              {/* Note: Revision requests are shown under Approved tab with orange badge for now, 
                  or we can add a specific filter later. Admin sees "Menunggu Revisi" */}
            </TabsList>
          </Tabs>

          {/* Filters */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama, unit kerja, atau jenis SK..." // UX Hint update
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
                        checked={skData.length > 0 && selectedIds.size === skData.length}
                        onCheckedChange={handleSelectAll}
                        />
                    )}
                  </TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Unit Kerja / Madrasah</TableHead> {/* NEW COLUMN */}
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
                        <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                            Memuat data...
                        </TableCell>
                    </TableRow>
                ) : skData.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={8} className="h-24 text-center">
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
                        <TableCell className="text-muted-foreground">{item.unitKerja}</TableCell> {/* NEW DATA */}
                        <TableCell>{item.jenisSk}</TableCell>
                        <TableCell className="font-medium">{item.nama}</TableCell>
                        <TableCell>{item.nomorSurat}</TableCell>
                        <TableCell>
                            {renderStatusBadge(item.status, item.revisionStatus)} {/* IMPROVED BADGE */}
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
                            
                            {/* REVISION BUTTONS */}
                            {["approved", "Approved", "active", "Active"].includes(item.status) && item.revisionStatus !== "pending" && JSON.parse(localStorage.getItem("user") || "{}")?.role === "operator" && (
                                <Button variant="outline" size="sm" className="mr-1 border-orange-200 text-orange-600 hover:bg-orange-50" onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedSkForRevision(item);
                                    setRevisionProposedData({ 
                                        nama: item.nama, 
                                        tempatLahir: "",
                                        tanggalLahir: "",
                                        nip: "",
                                        pendidikanTerakhir: "",
                                        unitKerja: item.unitKerja || "", 
                                        tmtPendidik: "", 
                                        reason: "" 
                                    });
                                    setIsRevisionModalOpen(true);
                                }}>
                                    Ajukan Revisi
                                </Button>
                            )}
                            {item.revisionStatus === "pending" && ["admin", "super_admin"].includes(JSON.parse(localStorage.getItem("user") || "{}")?.role) && (
                                <div className="inline-flex gap-1 mr-1">
                                    <Button variant="outline" size="sm" className="border-green-200 bg-green-50 text-green-700 hover:bg-green-100" onClick={(e) => { e.stopPropagation(); handleApproveRevisionSubmit(item.id); }} disabled={isActionLoading}>ACC Revisi</Button>
                                    <Button variant="outline" size="sm" className="border-red-200 bg-red-50 text-red-700 hover:bg-red-100" onClick={(e) => { e.stopPropagation(); handleRejectRevisionSubmit(item.id); }} disabled={isActionLoading}>Tolak</Button>
                                </div>
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
          {/* Note: skData is already "filtered" by backend for SKs, or client for Drafts.
              We still do client-side slicing for "Page 1, 2, 3" navigation feel.
          */}
          {!isLoading && skData.length > 0 && (
            <div className="flex items-center justify-between space-x-2 py-4 px-2">
              <div className="text-sm text-muted-foreground">
                Halaman {currentPage} (Menampilkan {paginatedData.length} dari {skData.length}{skQueryStatus === "CanLoadMore" && statusFilter !== "draft" ? "+" : ""} data)
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1 || skQueryStatus === "LoadingMore"}
                >
                  Sebelumnya
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                        // If we are on the last page of CURRENTLY LOADED data, and we can load more from server...
                        if (currentPage * itemsPerPage >= skData.length && skQueryStatus === "CanLoadMore" && statusFilter !== "draft") {
                            loadMore(20);
                        }
                        setCurrentPage(p => p + 1);
                  }}
                  disabled={
                      (statusFilter === "draft" && currentPage >= totalPages) || // Drafts are fully loaded
                      (statusFilter !== "draft" && skQueryStatus === "Exhausted" && currentPage * itemsPerPage >= skData.length) ||
                      skQueryStatus === "LoadingMore" ||
                      (statusFilter !== "draft" && skQueryStatus !== "CanLoadMore" && currentPage * itemsPerPage >= skData.length)
                  }
                >
                  {skQueryStatus === "LoadingMore" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Selanjutnya"}
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

      {/* --- AESTHETIC DIALOGS --- */}

      {/* 1. Approve Confirmation */}
      <Dialog open={isApproveConfirmOpen} onOpenChange={setIsApproveConfirmOpen}>
          <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                  <div className="flex items-center gap-3 text-green-600 mb-2">
                      <div className="p-2 bg-green-50 rounded-full">
                          <CheckCircle className="h-6 w-6" />
                      </div>
                      <DialogTitle className="text-xl font-bold">Approve Pengajuan</DialogTitle>
                  </div>
              </DialogHeader>
              <div className="py-4 text-center sm:text-left">
                  <p className="text-muted-foreground leading-relaxed">
                      Apakah Anda yakin ingin menyetujui <span className="font-bold text-foreground inline-flex items-center px-1.5 py-0.5 rounded bg-green-50 border border-green-100">{selectedIds.size} data</span> yang dipilih? 
                      Data ini akan dipindahkan ke antrean penerbitan SK.
                  </p>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                  <Button variant="ghost" onClick={() => setIsApproveConfirmOpen(false)} disabled={isActionLoading}>
                      Batal
                  </Button>
                  <Button onClick={executeBatchApprove} disabled={isActionLoading} className="bg-green-600 hover:bg-green-700 gap-2">
                      {isActionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckSquare className="h-4 w-4" />}
                      Ya, Approve
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      {/* 2. Reject Dialog with Reason */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                  <div className="flex items-center gap-3 text-red-600 mb-2">
                      <div className="p-2 bg-red-50 rounded-full">
                          <XCircle className="h-6 w-6" />
                      </div>
                      <DialogTitle className="text-xl font-bold">Tolak Pengajuan</DialogTitle>
                  </div>
              </DialogHeader>
              <div className="py-4 space-y-4">
                  <p className="text-sm text-muted-foreground leading-relaxed border-b pb-3">
                      Anda akan menolak <span className="font-bold text-foreground bg-red-50 px-1 rounded">{selectedIds.size} pengajuan</span>. Mohon beri alasan penolakan agar diketahui pengaju.
                  </p>
                  <div className="space-y-2">
                      <Label htmlFor="reject-reason" className="text-xs uppercase tracking-wider text-slate-500 font-bold">Alasan Penolakan</Label>
                      <Input 
                        id="reject-reason" 
                        placeholder="Contoh: Dokumen tidak lengkap, NIK salah..." 
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        className="border-slate-300 focus:ring-red-500"
                        autoFocus
                      />
                  </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0 border-t pt-4">
                  <Button variant="ghost" onClick={() => setIsRejectDialogOpen(false)} disabled={isActionLoading}>
                      Batal
                  </Button>
                  <Button variant="destructive" onClick={executeBatchReject} disabled={isActionLoading || !rejectionReason.trim()} className="gap-2">
                      {isActionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <XSquare className="h-4 w-4" />}
                      Ya, Tolak Sekarang
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      {/* 3. Request Revision Modal */}
      <Dialog open={isRevisionModalOpen} onOpenChange={setIsRevisionModalOpen}>
          <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                  <DialogTitle>Ajukan Revisi SK</DialogTitle>
                  <DialogDescription>
                      Isi bagian yang ingin diperbaiki untuk SK Nomor {selectedSkForRevision?.nomorSurat}
                  </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto px-1">
                  <div className="space-y-2">
                      <Label htmlFor="rev-nama">Perbaikan Nama</Label>
                      <Input 
                          id="rev-nama" 
                          value={revisionProposedData.nama} 
                          onChange={(e) => setRevisionProposedData({...revisionProposedData, nama: e.target.value})}
                      />
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="rev-tempat">Perbaikan Tempat Lahir</Label>
                      <Input 
                          id="rev-tempat" 
                          placeholder="Misal: Cilacap"
                          value={revisionProposedData.tempatLahir} 
                          onChange={(e) => setRevisionProposedData({...revisionProposedData, tempatLahir: e.target.value})}
                      />
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="rev-tgllahir">Perbaikan Tanggal Lahir</Label>
                      <Input 
                          id="rev-tgllahir" 
                          type="date"
                          value={revisionProposedData.tanggalLahir} 
                          onChange={(e) => setRevisionProposedData({...revisionProposedData, tanggalLahir: e.target.value})}
                      />
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="rev-nip">Perbaikan NIY / NIP</Label>
                      <Input 
                          id="rev-nip" 
                          placeholder="Masukkan NIY atau NIP"
                          value={revisionProposedData.nip} 
                          onChange={(e) => setRevisionProposedData({...revisionProposedData, nip: e.target.value})}
                      />
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="rev-pendidikan">Perbaikan Pendidikan Terakhir</Label>
                      <Input 
                          id="rev-pendidikan" 
                          placeholder="Misal: S1 Pendidikan Agama Islam"
                          value={revisionProposedData.pendidikanTerakhir} 
                          onChange={(e) => setRevisionProposedData({...revisionProposedData, pendidikanTerakhir: e.target.value})}
                      />
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="rev-unit">Perbaikan Unit Kerja</Label>
                      <Input 
                          id="rev-unit" 
                          value={revisionProposedData.unitKerja} 
                          onChange={(e) => setRevisionProposedData({...revisionProposedData, unitKerja: e.target.value})}
                      />
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="rev-tmt">Perbaikan TMT (Tanggal Mulai Tugas)</Label>
                      <Input 
                          id="rev-tmt" 
                          type="date"
                          value={revisionProposedData.tmtPendidik} 
                          onChange={(e) => setRevisionProposedData({...revisionProposedData, tmtPendidik: e.target.value})}
                      />
                      <p className="text-xs text-muted-foreground">Isi dengan format DD/MM/YYYY atau pilih dari kalender jika ada perubahan TMT.</p>
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="rev-reason" className="text-red-500">Alasan Revisi (Wajib)*</Label>
                      <Input 
                          id="rev-reason" 
                          placeholder="Misal: Gelar salah ketik, seharusnya S.Pd.I"
                          value={revisionProposedData.reason} 
                          onChange={(e) => setRevisionProposedData({...revisionProposedData, reason: e.target.value})}
                      />
                  </div>
              </div>
              <DialogFooter>
                  <Button variant="ghost" onClick={() => setIsRevisionModalOpen(false)}>Batal</Button>
                  <Button onClick={handleRequestRevisionSubmit} disabled={isActionLoading || !revisionProposedData.reason.trim()} className="bg-orange-600 hover:bg-orange-700 text-white">
                      {isActionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kirim Pengajuan Revisi"}
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

    </div>
  )
}
