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
import { FilePlus, Search, Trash2, FileText, CheckSquare, XSquare, AlertTriangle, CheckCircle, XCircle, Loader2, ChevronLeft, ChevronRight, FileDown } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { useNavigate } from "react-router-dom"
import { useState, useMemo } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { skApi, teacherApi, authApi } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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

export default function SkDashboardPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [statusFilter, setStatusFilter] = useState("draft") // draft (candidates), approved, rejected, all
  const [page, setPage] = useState(1)
  
  const user = authApi.getStoredUser()

  // 🔥 REST API QUERIES
  
  // 1. SK Documents (Approved/Rejected/Issued)
  const { data: skDocsData, isLoading: isSkLoading } = useQuery({
    queryKey: ['sk-documents', statusFilter, filterType, searchTerm, page],
    queryFn: () => skApi.list({
      status: statusFilter === 'all' ? undefined : statusFilter,
      jenis_sk: filterType === 'all' ? undefined : filterType,
      search: searchTerm,
      page: page,
      per_page: 10
    }),
    enabled: statusFilter !== 'draft'
  })

  // 2. Pending SK Requests (Draft status in UI) — formal SK submissions awaiting review
  const { data: candidatesData, isLoading: isCandidatesLoading } = useQuery({
    queryKey: ['sk-pending', searchTerm, page],
    queryFn: () => skApi.list({
      status: 'pending',
      search: searchTerm,
      page: page,
      per_page: 10
    }),
    enabled: statusFilter === 'draft'
  })

  // Mutations
  const batchUpdateStatus = useMutation({
    mutationFn: ({ ids, status, reason }: { ids: number[], status: string, reason?: string }) => 
      skApi.batchUpdateStatus(ids, status, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sk-documents'] })
      queryClient.invalidateQueries({ queryKey: ['sk-pending'] })
      toast.success("Status berhasil diperbarui")
      setSelectedIds(new Set())
    },
    onError: (err: any) => toast.error("Gagal memperbarui status: " + (err.response?.data?.message || err.message))
  })

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [isApproveOpen, setIsApproveOpen] = useState(false)
  const [isRejectOpen, setIsRejectOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")

  const itemsRaw = statusFilter === 'draft' ? candidatesData : skDocsData
  
  // Robust array handling to prevent "h.map is not a function"
  const items = useMemo(() => {
    if (!itemsRaw) return [];
    if (Array.isArray(itemsRaw)) return itemsRaw;
    if (itemsRaw.data && Array.isArray(itemsRaw.data)) return itemsRaw.data;
    return [];
  }, [itemsRaw]);
  const totalItems = statusFilter === 'draft' ? (candidatesData?.total || (Array.isArray(candidatesData) ? candidatesData.length : 0)) : (skDocsData?.total || (Array.isArray(skDocsData) ? skDocsData.length : 0))
  const isLoading = statusFilter === 'draft' ? isCandidatesLoading : isSkLoading

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(items.map((i: any) => i.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectRow = (id: number, checked: boolean) => {
    const next = new Set(selectedIds)
    if (checked) next.add(id)
    else next.delete(id)
    setSelectedIds(next)
  }

  const executeBatch = (status: 'approved' | 'rejected') => {
    batchUpdateStatus.mutate({
      ids: Array.from(selectedIds),
      status,
      reason: status === 'rejected' ? rejectionReason : undefined
    })
    setIsApproveOpen(false)
    setIsRejectOpen(false)
    setRejectionReason("")
  }

  const renderStatusBadge = (status: string) => {
    const s = status.toLowerCase()
    if (s === 'approved' || s === 'active') return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200">Disetujui</Badge>
    if (s === 'rejected') return <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-red-200">Ditolak</Badge>
    if (s === 'draft' || s === 'pending') return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200">Menunggu</Badge>
    return <Badge variant="outline">{status}</Badge>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-blue-900 uppercase">Manajemen SK Digital</h1>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">
            Pusat Penerbitan & Verifikasi Surat Keputusan PC LP Ma'arif NU Cilacap
          </p>
        </div>
        <div className="flex gap-3">
            <Button 
                onClick={() => navigate("/dashboard/sk/new")}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl px-6 h-12 shadow-lg shadow-blue-50 transition-all font-bold"
            >
                <FilePlus className="mr-2 h-4 w-4" />
                Ajukan SK Baru
            </Button>
        </div>
      </div>

      <Card className="border-0 shadow-sm bg-white rounded-[2.5rem] overflow-hidden">
        <CardHeader className="pb-4 border-b bg-slate-50/50 px-8 pt-8">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <Tabs value={statusFilter} onValueChange={(v) => {
                    setStatusFilter(v);
                    setPage(1);
                    setSelectedIds(new Set());
                }} className="w-full lg:w-auto">
                    <TabsList className="bg-slate-100 p-1 rounded-2xl h-auto flex flex-wrap lg:flex-nowrap">
                        <TabsTrigger value="draft" className="rounded-xl px-6 py-2.5 text-xs font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">
                            Antrean Draft {statusFilter === 'draft' && candidatesData?.total ? `(${candidatesData.total})` : ""}
                        </TabsTrigger>
                        <TabsTrigger value="approved" className="rounded-xl px-6 py-2.5 text-xs font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm">
                            Disetujui
                        </TabsTrigger>
                        <TabsTrigger value="rejected" className="rounded-xl px-6 py-2.5 text-xs font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-red-600 data-[state=active]:shadow-sm">
                            Ditolak
                        </TabsTrigger>
                        <TabsTrigger value="all" className="rounded-xl px-6 py-2.5 text-xs font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-slate-600 data-[state=active]:shadow-sm">
                            Semua Data
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                        <Input
                            placeholder="Cari nama / instansi..."
                            className="pl-10 h-11 bg-white border-slate-200 focus:ring-blue-500 rounded-xl text-sm"
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setPage(1);
                            }}
                        />
                    </div>
                    <Select value={filterType} onValueChange={(v) => {
                        setFilterType(v);
                        setPage(1);
                    }}>
                        <SelectTrigger className="w-full sm:w-48 h-11 bg-white border-slate-200 rounded-xl text-sm">
                            <SelectValue placeholder="Jenis SK" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl text-sm">
                            <SelectItem value="all">Semua Jenis</SelectItem>
                            <SelectItem value="SK Kepala Madrasah">SK Kamad</SelectItem>
                            <SelectItem value="SK Guru Tetap Yayasan">SK GTY</SelectItem>
                            <SelectItem value="SK Guru Tidak Tetap">SK GTT</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 border-b border-slate-100 hover:bg-slate-50/50">
                  <TableHead className="w-12 pl-8">
                    <Checkbox
                        checked={items.length > 0 && selectedIds.size === items.length}
                        onCheckedChange={handleSelectAll}
                        className="rounded-md border-slate-300"
                    />
                  </TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-widest py-5">Tanggal</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-widest py-5">Unit Kerja / Madrasah</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-widest py-5">Jenis SK</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-widest py-5">Nama Pemilik</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-widest py-5">Nomor Surat</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-widest py-5">Status</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-widest py-5 text-center">Surat Permohonan</TableHead>
                  <TableHead className="text-right pr-8 text-[10px] font-black uppercase text-slate-400 tracking-widest py-5">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                    <TableRow>
                        <TableCell colSpan={9} className="h-40 text-center">
                            <div className="flex flex-col items-center justify-center space-y-3">
                                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Memuat data SK...</span>
                            </div>
                        </TableCell>
                    </TableRow>
                ) : items.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={9} className="h-60 text-center">
                            <div className="flex flex-col items-center justify-center space-y-3 opacity-30">
                                <FileText className="h-16 w-16 text-slate-300" />
                                <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Tidak ada data ditemukan</span>
                            </div>
                        </TableCell>
                    </TableRow>
                ) : (
                    items.map((item: any) => {
                      const roleRaw = user?.role || "";
                      const role = String(roleRaw).toLowerCase().trim();
                      const status = String(item.status || "").toLowerCase().trim();
                      
                      // Pengecekan role: Tampilkan Revisi jika BUKAN admin/super_admin, atau jika mengandung kata 'operator'
                      const isAdminRole = ['super_admin', 'admin_yayasan', 'admin'].includes(role);
                      const isOperatorLike = role.includes('operator') || (!isAdminRole && role !== "");
                      
                      const isApproved = ['approved', 'active', 'disetujui', 'issued'].includes(status);
                      const canRevise = isOperatorLike && isApproved;

                      return (
                        <TableRow 
                          key={item.id} 
                          className="hover:bg-slate-50/50 border-b border-slate-50 transition-colors group"
                        >
                          <TableCell className="pl-8">
                              <Checkbox
                                  checked={selectedIds.has(item.id)}
                                  onCheckedChange={(checked) => handleSelectRow(item.id, !!checked)}
                                  className="rounded-md border-slate-300"
                              />
                          </TableCell>
                          <TableCell className="text-xs font-bold text-slate-500 py-4">
                              {new Date(item.created_at || item.updated_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </TableCell>
                          <TableCell className="text-xs font-bold text-slate-600">
                              {item.school?.nama || item.unit_kerja || "-"}
                          </TableCell>
                          <TableCell className="text-xs font-bold text-slate-800">
                              {item.jenis_sk || (item.nuptk ? "Verifikasi Baru" : "-")}
                          </TableCell>
                          <TableCell>
                              <div className="font-black text-slate-800 text-sm tracking-tight">{item.nama}</div>
                              {item.nuptk && <div className="text-[10px] font-bold text-blue-500 uppercase">NUPTK: {item.nuptk}</div>}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-slate-500">{item.nomor_sk || "-"}</TableCell>
                          <TableCell>
                              {renderStatusBadge(item.status || 'draft')}
                          </TableCell>
                          <TableCell className="text-center">
                              {item.surat_permohonan_url ? (
                                  <a
                                      href={item.surat_permohonan_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title="Download Surat Permohonan"
                                      className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                                  >
                                      <FileDown className="w-4 h-4" />
                                  </a>
                              ) : (
                                  <span className="text-[10px] text-slate-300 font-bold">-</span>
                              )}
                          </TableCell>
                          <TableCell className="text-right pr-8">
                              <div className="flex justify-end gap-1">
                                  {item.file_url && (
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50" onClick={() => window.open(item.file_url, '_blank')}>
                                          <FileText className="w-4 h-4" />
                                      </Button>
                                  )}
                                  {canRevise ? (
                                      <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          className="h-8 text-[10px] font-black uppercase text-amber-600 hover:bg-amber-50 px-3 rounded-lg flex items-center gap-2 border border-amber-100/50"
                                          onClick={() => navigate(`/dashboard/sk/${item.id}/revision`)}
                                      >
                                          <AlertTriangle className="w-3.5 h-3.5" />
                                          Revisi
                                      </Button>
                                  ) : (
                                      <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          className="h-8 text-[10px] font-black uppercase text-slate-400 hover:text-blue-600 hover:bg-blue-50 px-3 rounded-lg"
                                          onClick={() => navigate(`/dashboard/sk/${item.id}`)}
                                      >
                                          {statusFilter === 'draft' ? "Proses" : "Detail"}
                                      </Button>
                                  )}
                              </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {!isLoading && totalItems > 0 && (
            <div className="p-8 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Menampilkan <span className="text-slate-800">{(page - 1) * 10 + 1}-{Math.min(page * 10, totalItems)}</span> dari <span className="text-slate-800">{totalItems}</span> Total Data
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-xl border-slate-200 bg-white"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="h-10 px-4 flex items-center justify-center bg-white border border-slate-200 rounded-xl font-bold text-xs">
                    {page} / {Math.ceil(totalItems / 10)}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-xl border-slate-200 bg-white"
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= Math.ceil(totalItems / 10)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Floating Batch Actions */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white rounded-[2rem] px-8 py-5 flex items-center gap-6 z-50 shadow-2xl animate-in slide-in-from-bottom-10">
          <div className="flex items-center gap-3 border-r border-slate-700 pr-6 mr-2">
            <div className="bg-blue-600 h-8 w-8 rounded-full flex items-center justify-center text-xs font-black">{selectedIds.size}</div>
            <span className="text-sm font-black uppercase tracking-widest text-slate-300">Item Terpilih</span>
          </div>
          <div className="flex gap-2">
              <Button onClick={() => setIsApproveOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 h-11 px-6 rounded-2xl text-xs font-black uppercase tracking-widest">
                <CheckSquare className="mr-2 h-4 w-4" />
                Approve
              </Button>
              <Button onClick={() => setIsRejectOpen(true)} variant="destructive" className="bg-red-600 hover:bg-red-700 h-11 px-6 rounded-2xl text-xs font-black uppercase tracking-widest">
                <XSquare className="mr-2 h-4 w-4" />
                Reject
              </Button>
              <Button onClick={() => setSelectedIds(new Set())} variant="ghost" className="h-11 px-6 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white">
                Batal
              </Button>
          </div>
        </div>
      )}

      {/* MODALS */}
      <Dialog open={isApproveOpen} onOpenChange={setIsApproveOpen}>
          <DialogContent className="rounded-[2.5rem] p-10 sm:max-w-md border-0 ring-1 ring-slate-100">
              <DialogHeader className="items-center text-center">
                  <div className="bg-emerald-50 h-16 w-16 rounded-3xl flex items-center justify-center mb-4">
                      <CheckCircle className="h-8 w-8 text-emerald-600" />
                  </div>
                  <DialogTitle className="text-2xl font-black text-slate-800 uppercase tracking-tight">Approve Pengajuan</DialogTitle>
                  <CardDescription className="text-sm font-medium pt-2">
                    Anda akan menyetujui {selectedIds.size} data pengajuan. Data ini akan diproses ke tahap penerbitan dokumen resmi.
                  </CardDescription>
              </DialogHeader>
              <DialogFooter className="mt-8 flex gap-3 sm:justify-center">
                  <Button variant="ghost" onClick={() => setIsApproveOpen(false)} className="rounded-2xl h-12 px-8 font-black uppercase tracking-widest text-xs">Batal</Button>
                  <Button onClick={() => executeBatch('approved')} disabled={batchUpdateStatus.isPending} className="bg-emerald-600 hover:bg-emerald-700 rounded-2xl h-12 px-8 font-black uppercase tracking-widest text-xs">Ya, Setujui Sekarang</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
          <DialogContent className="rounded-[2.5rem] p-10 sm:max-w-md border-0 ring-1 ring-slate-100">
              <DialogHeader className="items-center text-center">
                  <div className="bg-red-50 h-16 w-16 rounded-3xl flex items-center justify-center mb-4">
                      <XCircle className="h-8 w-8 text-red-600" />
                  </div>
                  <DialogTitle className="text-2xl font-black text-slate-800 uppercase tracking-tight">Tolak Pengajuan</DialogTitle>
                  <CardDescription className="text-sm font-medium pt-2">
                    Silakan berikan alasan penolakan untuk {selectedIds.size} data yang dipilih.
                  </CardDescription>
              </DialogHeader>
              <div className="py-6 space-y-2">
                  <Label htmlFor="reject-reason" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Alasan Penolakan</Label>
                  <Input 
                    id="reject-reason" 
                    placeholder="Contoh: Dokumen lampiran tidak jelas / NIK tidak valid..." 
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="h-12 rounded-xl bg-slate-50 border-0 focus:ring-red-500"
                  />
              </div>
              <DialogFooter className="flex gap-3 sm:justify-center">
                  <Button variant="ghost" onClick={() => setIsRejectOpen(false)} className="rounded-2xl h-12 px-8 font-black uppercase tracking-widest text-xs">Batal</Button>
                  <Button 
                    variant="destructive" 
                    onClick={() => executeBatch('rejected')} 
                    disabled={batchUpdateStatus.isPending || !rejectionReason.trim()} 
                    className="bg-red-600 hover:bg-red-700 rounded-2xl h-12 px-8 font-black uppercase tracking-widest text-xs"
                  >
                        Ya, Tolak Data
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  )
}
