import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Plus, Search, Edit, BadgeCheck, Archive, FileSpreadsheet, Download, Trash2, UserCheck, UserMinus, Loader2, Wand2, Check, X, ImagePlus, KeyRound, AlertTriangle, Fingerprint, RefreshCw } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { useState, useMemo, useEffect } from "react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import SoftPageHeader from "@/components/ui/SoftPageHeader"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import { Label } from "@/components/ui/label"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { teacherApi, schoolApi } from "@/lib/api"
import ExcelImportModal from "./components/ExcelImportModal"
import TeacherPhotoUpload from "./components/TeacherPhotoUpload"
import KtaCard from "./components/KtaCard"
import ImportPreviewModal from "./components/ImportPreviewModal"
import * as XLSX from "xlsx"

interface Teacher {
  id: number
  nuptk?: string
  nip?: string
  nomor_induk_maarif?: string
  nama: string
  status?: string
  mapel?: string
  unit_kerja?: string
  phone_number?: string
  is_certified?: boolean
  is_active: boolean
  pdpkpnu?: string
  provinsi?: string
  kabupaten?: string
  kecamatan?: string
  kelurahan?: string
  tempat_lahir?: string
  tanggal_lahir?: string
  tmt?: string
  pendidikan_terakhir?: string
  photoId?: string
  school_id?: number
  jenis_kelamin?: string
  email?: string
}

export default function TeacherListPage() {
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState("")
  const [filterKecamatan, setFilterKecamatan] = useState("all")
  const [filterSchool, setFilterSchool] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")

  // List of kecamatan in Cilacap
  const uniqueKecamatan = [
    "Adipala", "Dayeuhluhur", "Kedungreja", "Nusawungu",
    "Bantarsari", "Gandrungmangu", "Kesugihan", "Patimuan",
    "Binangun", "Jeruklegi", "Kroya", "Pelumutan",
    "Cilacap Selatan", "Kampung Laut", "Majenang", "Sampang",
    "Cilacap Tengah", "Karangpucung", "Maos", "Sidareja",
    "Cilacap Utara", "Kawunganten", "Wanareja"
  ]

  const [activeFilter, setActiveFilter] = useState("active") // active, inactive, all
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  const [user] = useState<any>(() => {
    const u = localStorage.getItem("user_data")
    try {
      return u ? JSON.parse(u) : null
    } catch (e) {
      return null
    }
  })
  const isOperator = user?.role === "operator"
  const isSuperAdmin = user?.role === "super_admin" || user?.role === "admin_yayasan"
  const canEdit = user?.role !== "admin_yayasan"

  // Fetch schools for filter
  const { data: schoolsData } = useQuery({
    queryKey: ['schools-autocomplete'],
    queryFn: () => schoolApi.autocomplete(),
    enabled: isSuperAdmin // Only super admin needs to filter by school
  })

  // 🔥 REST API QUERY
  const { data: teachersData, isLoading } = useQuery({
    queryKey: ['teachers', currentPage, searchTerm, filterKecamatan, filterSchool, filterStatus, activeFilter],
    queryFn: () => teacherApi.list({
      page: currentPage,
      per_page: itemsPerPage,
      search: searchTerm || undefined,
      kecamatan: filterKecamatan === "all" ? undefined : filterKecamatan,
      school_id: filterSchool === "all" ? undefined : filterSchool,
      status: filterStatus === "all" ? undefined : filterStatus,
      is_active: activeFilter === "all" ? undefined : (activeFilter === "active" ? 1 : 0)
    })
  })

  const teachers = teachersData?.data || []
  const totalPages = teachersData?.last_page || 1

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: (id: number) => teacherApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] })
      toast.success("Guru berhasil dihapus")
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number, data: any }) => teacherApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] })
      toast.success("Data guru berhasil diperbarui")
    }
  })

  // Selection
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<Set<number>>(new Set())
  const toggleSelection = (id: number) => {
      const newSet = new Set(selectedTeacherIds)
      if (newSet.has(id)) newSet.delete(id)
      else newSet.add(id)
      setSelectedTeacherIds(newSet)
  }

  // Modal States
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [formData, setFormData] = useState<Partial<Teacher>>({})
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isDeduplicateOpen, setIsDeduplicateOpen] = useState(false)
  const [dryRunResult, setDryRunResult] = useState<any>(null)
  const [manualSelections, setManualSelections] = useState<any[]>([])
  const [confirmDelete, setConfirmDelete] = useState<Teacher | null>(null)
  
  // Import Preview States
  const [previews, setPreviews] = useState<any[]>([])
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false)
  const [isCommitting, setIsCommitting] = useState(false)

  // Account Generation States
  const [isGenerateOpen, setIsGenerateOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateResult, setGenerateResult] = useState<any[]>([])

  // NIM Generation States
  const [isGenerateNimOpen, setIsGenerateNimOpen] = useState(false)
  const [isGeneratingNim, setIsGeneratingNim] = useState(false)
  const [generateNimResult, setGenerateNimResult] = useState<any[]>([])

  const handleGenerateAccounts = async () => {
    setIsGenerating(true)
    try {
        const teacherIds = selectedTeacherIds.size > 0 ? Array.from(selectedTeacherIds) : undefined
        const res = await teacherApi.generateAccounts(teacherIds)
        setGenerateResult(res.accounts || [])
        toast.success(`Berhasil generate ${res.accounts?.length || 0} akun guru.`)
        queryClient.invalidateQueries({ queryKey: ["teachers"] })
    } catch (err: any) {
        toast.error("Gagal generate akun: " + (err.response?.data?.message || err.message))
    } finally {
        setIsGenerating(false)
    }
  }

  const handleGenerateNim = async () => {
    setIsGeneratingNim(true)
    try {
        const teacherIds = selectedTeacherIds.size > 0 ? Array.from(selectedTeacherIds) : undefined
        const res = await teacherApi.bulkGenerateNim(teacherIds)
        if (res.success === false) {
          toast.error(res.message)
          setIsGenerateNimOpen(false)
          return
        }
        setGenerateNimResult(res.results || [])
        toast.success(res.message || `Berhasil generate ${res.results?.length || 0} NIM baru.`)
        queryClient.invalidateQueries({ queryKey: ["teachers"] })
    } catch (err: any) {
        toast.error("Gagal generate NIM: " + (err.response?.data?.message || err.message))
    } finally {
        setIsGeneratingNim(false)
    }
  }

  const openAdd = () => {
    setIsEditMode(false)
    setFormData({ is_active: true, status: 'GTY' })
    setIsAddOpen(true)
  }

  const openEdit = (teacher: Teacher) => {
    setIsEditMode(true)
    setFormData(teacher)
    setIsAddOpen(true)
  }

  const handleSave = async () => {
    if (!formData.nama) { toast.error("Nama wajib diisi!"); return }
    try {
      // Only send fields that the backend validates, and convert empty strings to null
      const payload: Record<string, any> = {
        nama: formData.nama || null,
        nuptk: formData.nuptk || null,
        nip: formData.nip || null,
        nomor_induk_maarif: formData.nomor_induk_maarif || null,
        jenis_kelamin: formData.jenis_kelamin || null,
        tempat_lahir: formData.tempat_lahir || null,
        tanggal_lahir: formData.tanggal_lahir || null,
        pendidikan_terakhir: formData.pendidikan_terakhir || null,
        mapel: formData.mapel || null,
        unit_kerja: formData.unit_kerja || null,
        status: formData.status || null,
        phone_number: formData.phone_number || null,
        email: formData.email || null,
        tmt: formData.tmt || null,
        is_certified: formData.is_certified ?? false,
        is_active: formData.is_active ?? true,
        pdpkpnu: formData.pdpkpnu || null,
        kecamatan: formData.kecamatan || null,
        kelurahan: formData.kelurahan || null,
        photo_id: formData.photoId || null,
      }

      if (isEditMode && formData.id) {
        await updateMutation.mutateAsync({ id: formData.id, data: payload })
      } else {
        await teacherApi.create(payload)
        queryClient.invalidateQueries({ queryKey: ['teachers'] })
        toast.success("Berhasil menambah guru")
      }
      setIsAddOpen(false)
    } catch (e: any) {
      let errorMsg = e.message;
      if (e.response?.data) {
        if (e.response.data.errors) {
          const firstError = Object.values(e.response.data.errors)[0] as string[];
          errorMsg = firstError[0];
        } else if (e.response.data.message) {
          errorMsg = e.response.data.message;
        } else if (e.response.data.error) {
          errorMsg = e.response.data.error;
        }
      }
      toast.error("Gagal menyimpan: " + errorMsg)
    }
  }

  // ── Export Excel (client-side) ──
  const handleExportExcel = async () => {
    setIsExporting(true)
    try {
      // Fetch ALL data (no pagination)
      const res = await teacherApi.list({ per_page: 9999, is_active: activeFilter === 'all' ? undefined : (activeFilter === 'active' ? 1 : 0) })
      const rows = (res.data || []).map((t: any, i: number) => ({
        No: i + 1,
        NUPTK: t.nuptk || '',
        NIP: t.nip || '',
        Nama: t.nama,
        Status: t.status || '',
        Mapel: t.mapel || '',
        'Unit Kerja': t.unit_kerja || '',
        Kecamatan: t.kecamatan || '',
        Pendidikan: t.pendidikan_terakhir || '',
        Sertifikasi: t.is_certified ? 'Ya' : 'Tidak',
        PDPKPNU: t.pdpkpnu || '',
        'No HP': t.phone_number || '',
        Email: t.email || '',
        'TMT': t.tmt || '',
        'Tempat Lahir': t.tempat_lahir || '',
        'Tanggal Lahir': t.tanggal_lahir || '',
        'Status Aktif': t.is_active ? 'Aktif' : 'Non-Aktif',
      }))
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Data Guru')
      XLSX.writeFile(wb, `Data_Guru_Tendik_${new Date().toISOString().slice(0,10)}.xlsx`)
      toast.success(`Berhasil export ${rows.length} data guru!`)
    } catch (e: any) {
      toast.error('Gagal export: ' + e.message)
    } finally {
      setIsExporting(false)
    }
  }

  // ── Delete All ──
  const deleteAllMutation = useMutation({
    mutationFn: () => teacherApi.deleteAll(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] })
      toast.success('Semua data guru berhasil dihapus')
      setIsDeleteAllOpen(false)
    },
    onError: (e: any) => toast.error('Gagal hapus: ' + (e.response?.data?.message || e.message))
  })

  // ── Deduplicate ──
  const deduplicateDryRunMutation = useMutation({
    mutationFn: () => teacherApi.deduplicate(true),
    onSuccess: (res: any) => {
      setDryRunResult(res.data)
      setIsDeduplicateOpen(true)
      // Initialize manual selections based on dry run result
      if (res.data?.samples) {
        const initialSelections = res.data.samples
          .filter((s: any) => s.type === 'name_match')
          .map((s: any) => ({
            keep_id: s.keep_id,
            drop_id: s.drop_id
          }))
        setManualSelections(initialSelections)
      } else {
        setManualSelections([])
      }
    },
    onError: (e: any) => toast.error('Gagal mengecek data ganda: ' + (e.response?.data?.message || e.message))
  })

  const deduplicateMutation = useMutation({
    mutationFn: () => teacherApi.deduplicate(false, manualSelections),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] })
      toast.success(`Selesai! Berhasil menggabungkan ${res?.data?.merged_count || 0} data guru ganda.`)
      setIsDeduplicateOpen(false)
    },
    onError: (e: any) => toast.error('Gagal menggabungkan: ' + (e.response?.data?.message || e.message))
  })

  // ── Recalculate Status ──
  const [isRecalcOpen, setIsRecalcOpen] = useState(false)
  const [recalcResult, setRecalcResult] = useState<any>(null)

  const recalcDryRunMutation = useMutation({
    mutationFn: () => teacherApi.recalculateStatus({ dry_run: true }),
    onSuccess: (res: any) => {
      setRecalcResult(res.data ?? res)
      setIsRecalcOpen(true)
    },
    onError: (e: any) => toast.error('Gagal memeriksa status: ' + (e.response?.data?.message || e.message))
  })

  const recalcMutation = useMutation({
    mutationFn: () => teacherApi.recalculateStatus({ dry_run: false }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] })
      const updated = res.data?.updated ?? res.updated ?? 0
      toast.success(`Selesai! ${updated} status guru berhasil dikoreksi.`)
      setIsRecalcOpen(false)
      setRecalcResult(null)
    },
    onError: (e: any) => toast.error('Gagal koreksi status: ' + (e.response?.data?.message || e.message))
  })



  return (
    <div className="space-y-6">
      <SoftPageHeader
        title="Data Guru & Tenaga Kependidikan"
        description="Manajemen data guru dan tenaga kependidikan LP Ma'arif NU Cilacap"
        actions={[
          { label: isExporting ? 'Mengekspor...' : 'Export Excel', onClick: handleExportExcel, variant: 'mint', icon: isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" /> },

          ...(isSuperAdmin && canEdit ? [
              { label: 'Generate NIM', onClick: () => { setGenerateNimResult([]); setIsGenerateNimOpen(true) }, variant: 'purple', icon: <Fingerprint className="h-4 w-4" /> },
              { label: 'Koreksi Status', onClick: () => recalcDryRunMutation.mutate(), variant: 'teal', icon: recalcDryRunMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />, disabled: recalcDryRunMutation.isPending },
              { label: 'Delete All', onClick: () => setIsDeleteAllOpen(true), variant: 'red', icon: <Trash2 className="h-4 w-4" /> },
          ] : []),
          ...(canEdit ? [
              { label: 'Bersihkan Data Ganda', onClick: () => deduplicateDryRunMutation.mutate(), variant: 'amber', icon: <Wand2 className="h-4 w-4" />, disabled: deduplicateDryRunMutation.isPending },
              { label: 'Tambah Manual', onClick: () => {
                  setFormData({ is_active: true })
                  setIsEditMode(false)
                  setIsAddOpen(true)
              }, variant: 'orange', icon: <Plus className="h-4 w-4" /> },
              { label: 'Import Excel', onClick: () => setIsImportModalOpen(true), variant: 'blue', icon: <FileSpreadsheet className="h-4 w-4" /> },
          ] : [])
        ]}
      />

      <Card className="border-0 shadow-sm rounded-2xl overflow-hidden bg-white/80 backdrop-blur-md">
        <CardHeader className="pb-5 border-b border-slate-100">
           <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex-1 w-full relative max-w-md">
                    <Search className="absolute left-4 top-3 h-4 w-4 text-emerald-500" />
                    <Input
                        placeholder="Cari NUPTK, Nama, atau Mapel."
                        className="pl-11 h-10 rounded-2xl bg-white border-slate-200 focus-visible:ring-emerald-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                
                <div className="flex flex-wrap gap-3 items-center">
                   <Select value={filterKecamatan} onValueChange={setFilterKecamatan}>
                        <SelectTrigger className="w-[160px] h-10 rounded-2xl bg-white border-slate-200">
                            <SelectValue placeholder="Semua Kec" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-slate-100">
                            <SelectItem value="all">Semua Kec</SelectItem>
                            {uniqueKecamatan.map(k => (
                                <SelectItem key={k} value={k}>{k}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {isSuperAdmin && (
                        <Select value={filterSchool} onValueChange={setFilterSchool}>
                            <SelectTrigger className="w-[200px] h-10 rounded-2xl bg-white border-slate-200">
                                <SelectValue placeholder="Semua Sekolah" />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-slate-100 max-h-[300px]">
                                <SelectItem value="all">Semua Sekolah</SelectItem>
                                {(Array.isArray(schoolsData) ? schoolsData : schoolsData?.data || [])?.map((s: any) => (
                                    <SelectItem key={s.id} value={s.id.toString()}>{s.nama}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="w-[160px] h-10 rounded-2xl bg-white border-slate-200">
                            <SelectValue placeholder="Semua Status" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-slate-100">
                            <SelectItem value="all">Semua Status</SelectItem>
                            <SelectItem value="GTY">GTY</SelectItem>
                            <SelectItem value="GTT">GTT</SelectItem>
                            <SelectItem value="PNS">PNS</SelectItem>
                            <SelectItem value="PPPK">PPPK</SelectItem>
                            <SelectItem value="Tendik">Tendik</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex bg-emerald-50/50 p-1 rounded-2xl border border-emerald-100/50">
                    <Button variant={activeFilter === 'active' ? 'default' : 'ghost'} size="sm" onClick={() => setActiveFilter('active')} className={`rounded-xl px-4 ${activeFilter === 'active' ? 'bg-emerald-500 text-white shadow-sm hover:bg-emerald-600' : 'text-emerald-700 hover:bg-emerald-100/50'}`}>Aktif</Button>
                    <Button variant={activeFilter === 'inactive' ? 'default' : 'ghost'} size="sm" onClick={() => setActiveFilter('inactive')} className={`rounded-xl px-4 ${activeFilter === 'inactive' ? 'bg-emerald-500 text-white shadow-sm hover:bg-emerald-600' : 'text-emerald-700 hover:bg-emerald-100/50'}`}>Non-Aktif</Button>
                    <Button variant={activeFilter === 'all' ? 'default' : 'ghost'} size="sm" onClick={() => setActiveFilter('all')} className={`rounded-xl px-4 ${activeFilter === 'all' ? 'bg-emerald-500 text-white shadow-sm hover:bg-emerald-600' : 'text-emerald-700 hover:bg-emerald-100/50'}`}>Semua</Button>
                </div>
           </div>
        </CardHeader>
        <CardContent className="p-0 border-x-0">
            <Table>
                <TableHeader className="bg-emerald-50/50">
                    <TableRow className="border-b-0 hover:bg-transparent">
                        <TableHead className="w-[36px] pl-4 rounded-tl-xl text-emerald-800"><Checkbox className="border-emerald-300 data-[state=checked]:bg-emerald-500 data-[state=checked]:text-white" /></TableHead>
                        <TableHead className="py-3 px-3 font-bold text-emerald-800">Nomor Induk</TableHead>
                        <TableHead className="py-3 px-3 font-bold text-emerald-800">Nama</TableHead>
                        <TableHead className="py-3 px-3 font-bold text-emerald-800 text-center">Status</TableHead>
                        <TableHead className="py-3 px-3 font-bold text-emerald-800 text-center">Sertifikasi</TableHead>
                        <TableHead className="py-3 px-3 font-bold text-emerald-800 text-center">PDPKPNU</TableHead>
                        <TableHead className="py-3 px-3 font-bold text-emerald-800">Satminkal</TableHead>
                        {canEdit && <TableHead className="py-3 px-3 font-bold text-emerald-800 text-right rounded-tr-xl">Aksi</TableHead>}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        <TableRow><TableCell colSpan={8} className="h-32 text-center"><Loader2 className="animate-spin h-6 w-6 mx-auto text-emerald-500" /></TableCell></TableRow>
                    ) : teachers.length === 0 ? (
                        <TableRow><TableCell colSpan={8} className="h-32 text-center text-slate-400 font-medium">Tidak ada data guru.</TableCell></TableRow>
                    ) : (
                        teachers.map((item: Teacher) => (
                            <TableRow key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors group">
                                <TableCell className="pl-4">
                                    <Checkbox 
                                        className="border-slate-300 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-none"
                                        checked={selectedTeacherIds.has(item.id)}
                                        onCheckedChange={() => toggleSelection(item.id)}
                                    />
                                </TableCell>
                                <TableCell className="px-3 py-2.5">
                                    {item.nomor_induk_maarif ? (
                                        <div className="font-bold text-emerald-600 text-xs uppercase mb-0.5">NIM: {item.nomor_induk_maarif}</div>
                                    ) : null}
                                    <div className="font-bold text-slate-800 text-sm">{item.nuptk ? `NUPTK: ${item.nuptk}` : "NUPTK: -"}</div>
                                    <div className="text-xs font-semibold text-slate-400 mt-0.5">{item.nip ? `NIP: ${item.nip}` : "NIP: -"}</div>
                                </TableCell>
                                <TableCell className="px-3 py-2.5">
                                    <div className="font-semibold text-slate-800 text-sm">{item.nama}</div>
                                    <div className="text-xs text-slate-500 mt-0.5 max-w-[180px] truncate">{item.mapel || ""}</div>
                                </TableCell>
                                <TableCell className="px-3 py-2.5 text-center">
                                    <Badge variant="outline" className={`rounded-xl px-2 py-0.5 text-xs font-bold tracking-wide border-0 ${item.status === 'GTY' ? 'bg-emerald-500 text-white shadow-sm' : item.status === 'PNS' ? 'bg-blue-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600'}`}>
                                        {item.status || "GTY"}
                                    </Badge>
                                </TableCell>
                                <TableCell className="px-3 py-2.5 text-center">
                                    {item.is_certified ? (
                                        <div className="inline-flex items-center justify-center gap-1 text-xs font-medium text-emerald-600">
                                            <Check className="h-3 w-3 border border-emerald-600 rounded-full p-[1px]" /> Sertifikasi
                                        </div>
                                    ) : (
                                        <Badge variant="outline" className="rounded-xl px-2 py-0.5 text-xs font-bold tracking-wide border-0 bg-slate-100 text-slate-500">Belum</Badge>
                                    )}
                                </TableCell>
                                <TableCell className="px-3 py-2.5 text-center">
                                    {item.pdpkpnu ? (
                                        <Check className="h-4 w-4 text-emerald-500 mx-auto" strokeWidth={3} />
                                    ) : (
                                        <X className="h-4 w-4 text-rose-300 mx-auto" strokeWidth={3} />
                                    )}
                                </TableCell>
                                <TableCell className="px-3 py-2.5 text-sm font-medium text-slate-700 max-w-[130px] truncate">
                                    {item.unit_kerja || <span className="text-slate-300 italic text-xs">—</span>}
                                </TableCell>
                                {canEdit && (
                                    <TableCell className="px-3 py-2.5 text-right">
                                        <div className="flex gap-1 items-center justify-end">
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-500 hover:text-blue-700 hover:bg-blue-50" onClick={() => openEdit(item)}><Edit className="h-3.5 w-3.5" /></Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500 hover:text-rose-700 hover:bg-rose-50" onClick={() => setConfirmDelete(item)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                        </div>
                                    </TableCell>
                                )}
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
            
            {/* Pagination */}
            <div className="flex items-center justify-between p-6 border-t border-slate-100">
                <div className="text-sm font-medium text-slate-500">Halaman {currentPage} dari {totalPages}</div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="rounded-xl border-slate-200" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Sebelumnya</Button>
                    <Button variant="outline" size="sm" className="rounded-xl border-slate-200" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Selanjutnya</Button>
                </div>
            </div>
        </CardContent>
      </Card>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle className="text-xl font-bold text-slate-800">{isEditMode ? 'Edit' : 'Tambah'} Guru Manual</DialogTitle></DialogHeader>
            <div className="py-6 overflow-y-auto max-h-[75vh] px-2 -mx-2 space-y-6">
                
                {/* Upload Foto */}
                <div className="flex justify-center mb-8">
                    <TeacherPhotoUpload
                        photoId={formData.photoId}
                        onPhotoUploaded={(url) => setFormData({...formData, photoId: url})}
                        onRemovePhoto={() => setFormData({...formData, photoId: undefined})}
                    />
                </div>

                <div className="space-y-4">
                    <div className="grid grid-cols-[130px_1fr] items-center gap-4">
                        <Label className="text-right text-slate-600 font-bold text-sm">Nama</Label>
                        <Input value={formData.nama || ""} onChange={e => setFormData({...formData, nama: e.target.value})} className="h-10 rounded-xl" />
                    </div>
                    
                    <div className="grid grid-cols-[130px_1fr] items-center gap-4">
                        <Label className="text-right text-slate-600 font-bold text-sm">NUPTK</Label>
                        <Input value={formData.nuptk || ""} onChange={e => setFormData({...formData, nuptk: e.target.value})} className="h-10 rounded-xl" />
                    </div>

                    <div className="grid grid-cols-[130px_1fr] items-center gap-4">
                        <Label className="text-right text-slate-600 font-bold text-sm">NIP</Label>
                        <Input value={formData.nip || ""} onChange={e => setFormData({...formData, nip: e.target.value})} className="h-10 rounded-xl" />
                    </div>

                    <div className="grid grid-cols-[130px_1fr] items-center gap-4">
                        <Label className="text-right text-emerald-600 font-bold text-sm">NIM</Label>
                        <Input placeholder="Wajib 1134..." value={formData.nomor_induk_maarif || ""} onChange={e => setFormData({...formData, nomor_induk_maarif: e.target.value})} className="h-10 rounded-xl border-emerald-200 focus:border-emerald-500 focus:ring-emerald-500" />
                    </div>

                    <div className="grid grid-cols-[130px_1fr] items-center gap-4">
                        <Label className="text-right text-slate-600 font-bold text-sm">Jenis Kelamin</Label>
                        <Select value={formData.jenis_kelamin || ""} onValueChange={v => setFormData({...formData, jenis_kelamin: v})}>
                            <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Pilih Jenis Kelamin" /></SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="L">Laki-laki (L)</SelectItem>
                                <SelectItem value="P">Perempuan (P)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-[130px_1fr] items-center gap-4">
                        <Label className="text-right text-slate-600 font-bold text-sm">Pendidikan</Label>
                        <Select value={formData.pendidikan_terakhir} onValueChange={v => setFormData({...formData, pendidikan_terakhir: v})}>
                            <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Pilih Pendidikan" /></SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="S3">S3</SelectItem>
                                <SelectItem value="S2">S2</SelectItem>
                                <SelectItem value="S1/D4">S1/D4</SelectItem>
                                <SelectItem value="S1">S1</SelectItem>
                                <SelectItem value="D4">D4</SelectItem>
                                <SelectItem value="D3">D3</SelectItem>
                                <SelectItem value="D2">D2</SelectItem>
                                <SelectItem value="D1">D1</SelectItem>
                                <SelectItem value="SMA/Sederajat">SMA/Sederajat</SelectItem>
                                <SelectItem value="SMA">SMA</SelectItem>
                                <SelectItem value="SMK">SMK</SelectItem>
                                <SelectItem value="MA">MA</SelectItem>
                                <SelectItem value="SMP">SMP</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-[130px_1fr] items-center gap-4">
                        <Label className="text-right text-slate-600 font-bold text-sm">Provinsi</Label>
                        <Input disabled placeholder="Otomatis" className="h-10 rounded-xl bg-slate-50 text-slate-400 border-slate-200" />
                    </div>
                    <div className="grid grid-cols-[130px_1fr] items-center gap-4">
                        <Label className="text-right text-slate-600 font-bold text-sm">Kab/Kota</Label>
                        <Input disabled placeholder="Otomatis" className="h-10 rounded-xl bg-slate-50 text-slate-400 border-slate-200" />
                    </div>

                    <div className="grid grid-cols-[130px_1fr] items-center gap-4">
                        <Label className="text-right text-slate-600 font-bold text-sm">Kecamatan</Label>
                        <Select value={formData.kecamatan} onValueChange={v => setFormData({...formData, kecamatan: v})}>
                            <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Pilih Kecamatan" /></SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="Adipala">Adipala</SelectItem>
                                <SelectItem value="Bantarsari">Bantarsari</SelectItem>
                                <SelectItem value="Binangun">Binangun</SelectItem>
                                <SelectItem value="Cilacap Selatan">Cilacap Selatan</SelectItem>
                                <SelectItem value="Cilacap Tengah">Cilacap Tengah</SelectItem>
                                <SelectItem value="Cilacap Utara">Cilacap Utara</SelectItem>
                                <SelectItem value="Cimanggu">Cimanggu</SelectItem>
                                <SelectItem value="Cipari">Cipari</SelectItem>
                                <SelectItem value="Dayeuhluhur">Dayeuhluhur</SelectItem>
                                <SelectItem value="Gandrungmangu">Gandrungmangu</SelectItem>
                                <SelectItem value="Jeruklegi">Jeruklegi</SelectItem>
                                <SelectItem value="Kampung Laut">Kampung Laut</SelectItem>
                                <SelectItem value="Karangpucung">Karangpucung</SelectItem>
                                <SelectItem value="Kawunganten">Kawunganten</SelectItem>
                                <SelectItem value="Kedungreja">Kedungreja</SelectItem>
                                <SelectItem value="Kesugihan">Kesugihan</SelectItem>
                                <SelectItem value="Kroya">Kroya</SelectItem>
                                <SelectItem value="Majenang">Majenang</SelectItem>
                                <SelectItem value="Maos">Maos</SelectItem>
                                <SelectItem value="Nusawungu">Nusawungu</SelectItem>
                                <SelectItem value="Patimuan">Patimuan</SelectItem>
                                <SelectItem value="Sampang">Sampang</SelectItem>
                                <SelectItem value="Sidareja">Sidareja</SelectItem>
                                <SelectItem value="Wanareja">Wanareja</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-[130px_1fr] items-center gap-4">
                        <Label className="text-right text-slate-600 font-bold text-sm">Kelurahan/Desa</Label>
                        <Input value={formData.kelurahan || ""} onChange={e => setFormData({...formData, kelurahan: e.target.value})} className="h-10 rounded-xl" />
                    </div>

                    <div className="grid grid-cols-[130px_1fr] items-center gap-4">
                        <Label className="text-right text-slate-600 font-bold text-sm">Status</Label>
                        <Select value={formData.status} onValueChange={v => setFormData({...formData, status: v})}>
                            <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Pilih Status" /></SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="GTY">GTY (Guru Tetap Yayasan)</SelectItem>
                                <SelectItem value="GTT">GTT (Guru Tidak Tetap)</SelectItem>
                                <SelectItem value="PNS">PNS</SelectItem>
                                <SelectItem value="PPPK">PPPK</SelectItem>
                                <SelectItem value="Tendik">Tendik (Tenaga Kependidikan)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-[130px_1fr] items-center gap-4">
                        <Label className="text-right text-slate-600 font-bold text-sm">Satminkal</Label>
                        <Input value={formData.unit_kerja || ""} onChange={e => setFormData({...formData, unit_kerja: e.target.value})} className="h-10 rounded-xl" />
                    </div>

                    <div className="grid grid-cols-[130px_1fr] items-center gap-4">
                        <Label className="text-right text-slate-600 font-bold text-sm">No HP</Label>
                        <Input value={formData.phone_number || ""} onChange={e => setFormData({...formData, phone_number: e.target.value})} className="h-10 rounded-xl" />
                    </div>

                    <div className="grid grid-cols-[130px_1fr] items-center gap-4">
                        <Label className="text-right text-slate-600 font-bold text-sm">Sertifikasi</Label>
                        <Select value={formData.is_certified ? "Sudah" : "Belum"} onValueChange={v => setFormData({...formData, is_certified: v === "Sudah"})}>
                            <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Status Sertifikasi" /></SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="Sudah">Sudah</SelectItem>
                                <SelectItem value="Belum">Belum</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-[130px_1fr] items-center gap-4">
                        <Label className="text-right text-slate-600 font-bold text-sm">PDPKPNU</Label>
                        <Select value={formData.pdpkpnu === "Sudah" ? "Sudah" : "Belum"} onValueChange={v => setFormData({...formData, pdpkpnu: v})}>
                            <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Sudah/Belum" /></SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="Sudah">Sudah</SelectItem>
                                <SelectItem value="Belum">Belum</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-[130px_1fr] items-center gap-4">
                        <Label className="text-right text-slate-600 font-bold text-sm">Tempat Lahir</Label>
                        <Input value={formData.tempat_lahir || ""} onChange={e => setFormData({...formData, tempat_lahir: e.target.value})} className="h-10 rounded-xl" />
                    </div>

                    <div className="grid grid-cols-[130px_1fr] items-center gap-4">
                        <Label className="text-right text-slate-600 font-bold text-sm">Tgl Lahir</Label>
                        <Input type="date" value={formData.tanggal_lahir || ""} onChange={e => setFormData({...formData, tanggal_lahir: e.target.value})} className="h-10 rounded-xl" />
                    </div>

                    <div className="grid grid-cols-[130px_1fr] items-center gap-4">
                        <Label className="text-right text-slate-600 font-bold text-sm">TMT</Label>
                        <Input type="date" value={formData.tmt || ""} onChange={e => setFormData({...formData, tmt: e.target.value})} className="h-10 rounded-xl" />
                    </div>

                </div>
            </div>
            <DialogFooter className="border-t pt-4">
                <Button variant="outline" className="rounded-xl bg-white font-bold" onClick={() => setIsAddOpen(false)}>Batal</Button>
                <Button onClick={handleSave} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold" disabled={updateMutation.isPending}>{updateMutation.isPending ? "Menyimpan..." : "Simpan"}</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <ExcelImportModal
        title="Import Data Guru"
        description="Gunakan format excel Emis atau format standar (nuptk, nama, mapel, unit_kerja)."
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        templateUrl="/TEMPLATE_IMPORT_DATA_GURU_V4.xlsx"
        onImport={async (data) => {
            try {
                // Fetch previews
                const CHUNK_SIZE = 50
                const allPreviews: any[] = []
                for (let i = 0; i < data.length; i += CHUNK_SIZE) {
                    const chunk = data.slice(i, i + CHUNK_SIZE)
                    if (chunk.length === 0) continue
                    const res = await teacherApi.importPreview(chunk as any[])
                    if (res.previews) allPreviews.push(...res.previews)
                }
                
                // Cek NIM ganda di dalam file Excel itu sendiri
                const nimSet = new Set<string>();
                allPreviews.forEach((p, idx) => {
                    p.id = idx;
                    if (p.nim) {
                        if (nimSet.has(p.nim)) {
                            p.status = 'KONFLIK_INTERNAL';
                            p.message = 'NIM ganda terdeteksi di dalam file Excel yang sama. Data ini akan diabaikan.';
                            p.action = 'SKIP';
                        } else {
                            nimSet.add(p.nim);
                        }
                    }
                });
                
                setPreviews(allPreviews)
                setIsImportModalOpen(false)
                setIsPreviewModalOpen(true)
            } catch (e: any) {
                const detail = e.response?.data?.message || e.message
                toast.error("Gagal memproses preview import: " + detail)
            }
        }}
      />

      <ImportPreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        previews={previews}
        isCommitting={isCommitting}
        onCommit={async (selectedRows) => {
            setIsCommitting(true)
            try {
                const CHUNK_SIZE = 50
                let lastSummary = ""
                for (let i = 0; i < selectedRows.length; i += CHUNK_SIZE) {
                    const chunk = selectedRows.slice(i, i + CHUNK_SIZE)
                    if (chunk.length === 0) continue
                    const res = await teacherApi.importCommit(chunk)
                    if (res.summary) lastSummary = res.summary
                }
                queryClient.invalidateQueries({ queryKey: ['teachers'] })
                toast.success(lastSummary || "Berhasil menyimpan data!")
                setIsPreviewModalOpen(false)
            } catch (e: any) {
                const detail = e.response?.data?.message || e.message
                toast.error("Gagal menyimpan import: " + detail)
            } finally {
                setIsCommitting(false)
            }
        }}
      />

      {/* ── Delete All Confirmation Dialog ── */}
      <Dialog open={isDeleteAllOpen} onOpenChange={setIsDeleteAllOpen}>
        <DialogContent className="rounded-[2rem] p-8 sm:max-w-md border-0 ring-1 ring-slate-100">
          <DialogHeader className="items-center text-center">
            <div className="bg-red-50 h-16 w-16 rounded-3xl flex items-center justify-center mb-4">
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
            <DialogTitle className="text-xl font-black text-slate-800 uppercase tracking-tight">Hapus Semua Data Guru?</DialogTitle>
            <DialogDescription className="text-sm font-medium text-slate-500 pt-2">
              Tindakan ini akan menghapus <strong>seluruh data guru dan tenaga kependidikan</strong> secara permanen dan tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 flex gap-3 sm:justify-center">
            <button
              onClick={() => setIsDeleteAllOpen(false)}
              className="flex-1 h-12 rounded-2xl border border-slate-200 font-black uppercase tracking-widest text-xs text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Batal
            </button>
            <button
              onClick={() => deleteAllMutation.mutate()}
              disabled={deleteAllMutation.isPending}
              className="flex-1 h-12 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest text-xs disabled:opacity-50 transition-colors"
            >
              {deleteAllMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Ya, Hapus Semua'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Generate Akun Dialog ── */}
      <Dialog open={isGenerateOpen} onOpenChange={(v) => { if (!isGenerating) setIsGenerateOpen(v) }}>
        <DialogContent className="rounded-[2rem] p-8 sm:max-w-2xl border-0 ring-1 ring-slate-100 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="items-center text-center">
            <div className="bg-purple-50 h-16 w-16 rounded-3xl flex items-center justify-center mb-4">
              <KeyRound className="h-8 w-8 text-purple-500" />
            </div>
            <DialogTitle className="text-xl font-black text-slate-800 uppercase tracking-tight">Generate Akun Guru</DialogTitle>
            <DialogDescription className="text-sm font-medium text-slate-500 pt-2">
              {selectedTeacherIds.size > 0
                ? `Akan mengenerate akun untuk ${selectedTeacherIds.size} guru yang dipilih.`
                : 'Akan mengenerate akun untuk semua guru yang belum memiliki akun.'}
              {' '}Username dari email / NUPTK, password dari tanggal lahir (ddmmyyyy).
            </DialogDescription>
          </DialogHeader>

          {generateResult.length > 0 ? (
            <div className="mt-4 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-emerald-600 text-center">{generateResult.length} Akun Berhasil Dibuat</p>
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-4 py-2 font-black text-slate-500">Nama</th>
                      <th className="text-left px-4 py-2 font-black text-slate-500">Email / Username</th>
                      <th className="text-left px-4 py-2 font-black text-slate-500">Password</th>
                    </tr>
                  </thead>
                  <tbody>
                    {generateResult.map((a: any, i: number) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-4 py-2 font-medium">{a.nama}</td>
                        <td className="px-4 py-2 font-mono text-slate-600">{a.email}</td>
                        <td className="px-4 py-2 font-mono text-purple-600 font-bold">{a.password_plain}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                onClick={() => {
                  const ws = XLSX.utils.json_to_sheet(generateResult.map((a: any) => ({
                    Nama: a.nama, Email: a.email, Password: a.password_plain
                  })))
                  const wb = XLSX.utils.book_new()
                  XLSX.utils.book_append_sheet(wb, ws, 'Akun Guru')
                  XLSX.writeFile(wb, `Akun_Guru_${new Date().toISOString().slice(0,10)}.xlsx`)
                }}
                className="w-full h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-xs tracking-widest transition-colors"
              >
                <Download className="h-3 w-3 inline mr-2" /> Download Daftar Akun (Excel)
              </button>
            </div>
          ) : (
            <DialogFooter className="mt-6 flex gap-3 sm:justify-center">
              <button
                onClick={() => setIsGenerateOpen(false)}
                className="flex-1 h-12 rounded-2xl border border-slate-200 font-black uppercase tracking-widest text-xs text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleGenerateAccounts}
                disabled={isGenerating}
                className="flex-1 h-12 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-black uppercase tracking-widest text-xs disabled:opacity-50 transition-colors"
              >
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Generate Sekarang'}
              </button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
      
      {/* ── Generate NIM Dialog ── */}
      <Dialog open={isGenerateNimOpen} onOpenChange={(v) => { if (!isGeneratingNim) setIsGenerateNimOpen(v) }}>
        <DialogContent className="rounded-[2rem] p-8 sm:max-w-2xl border-0 ring-1 ring-slate-100 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="items-center text-center">
            <div className="bg-emerald-50 h-16 w-16 rounded-3xl flex items-center justify-center mb-4">
              <Fingerprint className="h-8 w-8 text-emerald-500" />
            </div>
            <DialogTitle className="text-xl font-black text-slate-800 uppercase tracking-tight">Generate NIM Massal</DialogTitle>
            <DialogDescription className="text-sm font-medium text-slate-500 pt-2">
              {selectedTeacherIds.size > 0
                ? `Akan meng-generate NIM (Nomor Induk Ma'arif) untuk ${selectedTeacherIds.size} guru yang dipilih (jika belum punya).`
                : "Akan meng-generate NIM untuk semua guru di database yang belum memilikinya."}
            </DialogDescription>
          </DialogHeader>

          {generateNimResult.length > 0 ? (
            <div className="mt-4 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-emerald-600 text-center">{generateNimResult.length} NIM Berhasil Dibuat</p>
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-4 py-2 font-black text-slate-500">Nama Guru</th>
                      <th className="text-left px-4 py-2 font-black text-slate-500">NIM Baru</th>
                    </tr>
                  </thead>
                  <tbody>
                    {generateNimResult.map((a: any, i: number) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-4 py-2 font-medium">{a.nama}</td>
                        <td className="px-4 py-2 font-mono text-emerald-600 font-bold">{a.nim}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                onClick={() => {
                  const ws = XLSX.utils.json_to_sheet(generateNimResult.map((a: any) => ({
                    Nama: a.nama, NIM: a.nim
                  })))
                  const wb = XLSX.utils.book_new()
                  XLSX.utils.book_append_sheet(wb, ws, 'NIM Guru')
                  XLSX.writeFile(wb, `Generate_NIM_${new Date().toISOString().slice(0,10)}.xlsx`)
                }}
                className="w-full h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-xs tracking-widest transition-colors"
              >
                <Download className="h-3 w-3 inline mr-2" /> Download Hasil (Excel)
              </button>
            </div>
          ) : (
            <DialogFooter className="mt-6 flex gap-3 sm:justify-center">
              <button
                onClick={() => setIsGenerateNimOpen(false)}
                className="flex-1 h-12 rounded-2xl border border-slate-200 font-black uppercase tracking-widest text-xs text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleGenerateNim}
                disabled={isGeneratingNim}
                className="flex-1 h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-xs disabled:opacity-50 transition-colors"
              >
                {isGeneratingNim ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Generate Sekarang'}
              </button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
      
      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null) }}
        title="Hapus Guru"
        description={`Yakin ingin menghapus ${confirmDelete?.nama}? Data yang dihapus tidak dapat dikembalikan.`}
        confirmText="Hapus"
        variant="destructive"
        onConfirm={() => {
          if (confirmDelete) deleteMutation.mutate(confirmDelete.id)
          setConfirmDelete(null)
        }}
      />

      {/* ── Confirm Deduplicate ── */}
      <ConfirmDialog
        open={isDeduplicateOpen}
        onOpenChange={setIsDeduplicateOpen}
        title="Konfirmasi Penggabungan Data"
        description={
          <div className="space-y-3">
            <p>Fitur ini akan otomatis mencari dan menggabungkan data guru yang ganda (duplikat) berdasarkan kesamaan NIM/NIP. Nama lama akan otomatis diperbaiki dengan nama dari file Excel, dan riwayat SK tidak akan hilang.</p>
            {dryRunResult?.merged_count > 0 ? (
              <div className="bg-amber-50 text-amber-900 p-3 rounded text-sm">
                <strong>Ditemukan {dryRunResult.merged_count} data ganda yang siap digabung!</strong><br/>
                <span className="block mt-1 mb-1 opacity-80">Daftar data yang akan digabung:</span>
                <ul className="list-disc pl-5 max-h-[400px] overflow-y-auto pr-2">
                  {dryRunResult.samples?.map((s: any, i: number) => {
                    if (s.type === 'nim_nyasar') {
                      return (
                        <li key={i} className="mb-1 text-xs">{s.old_name} <span className="text-amber-500 mx-1">→</span> <strong>{s.new_name}</strong> (NIM: {s.nim})</li>
                      )
                    }

                    // Tipe 2: name_match
                    const sel = manualSelections.find((m) => (m.keep_id === s.keep_id && m.drop_id === s.drop_id) || (m.keep_id === s.drop_id && m.drop_id === s.keep_id))
                    const currentKeepId = sel ? sel.keep_id : s.keep_id

                    return (
                      <li key={i} className="mb-3 text-xs bg-white p-2 rounded border border-amber-200 list-none -ml-5 shadow-sm">
                        <div className="font-semibold text-slate-700 mb-1">Pilih Data Utama (akan dipertahankan):</div>
                        <label className="flex items-center space-x-2 cursor-pointer mb-1 p-1 hover:bg-slate-50 rounded">
                          <input 
                            type="radio" 
                            name={`dedup_${i}`} 
                            checked={currentKeepId === s.keep_id}
                            onChange={() => {
                              setManualSelections(prev => {
                                const newSels = [...prev]
                                const idx = newSels.findIndex(m => (m.keep_id === s.keep_id && m.drop_id === s.drop_id) || (m.keep_id === s.drop_id && m.drop_id === s.keep_id))
                                if (idx !== -1) {
                                  newSels[idx] = { keep_id: s.keep_id, drop_id: s.drop_id }
                                } else {
                                  newSels.push({ keep_id: s.keep_id, drop_id: s.drop_id })
                                }
                                return newSels
                              })
                            }}
                            className="text-amber-600 focus:ring-amber-500 mt-0.5"
                          />
                          <span>{s.keep_name} {s.keep_nim && <span className="text-slate-400">({s.keep_nim})</span>} <span className="text-emerald-600 font-medium ml-1 bg-emerald-50 px-1 py-0.5 rounded text-[10px]">(Rekomendasi)</span></span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer p-1 hover:bg-slate-50 rounded">
                          <input 
                            type="radio" 
                            name={`dedup_${i}`} 
                            checked={currentKeepId === s.drop_id}
                            onChange={() => {
                              setManualSelections(prev => {
                                const newSels = [...prev]
                                const idx = newSels.findIndex(m => (m.keep_id === s.keep_id && m.drop_id === s.drop_id) || (m.keep_id === s.drop_id && m.drop_id === s.keep_id))
                                if (idx !== -1) {
                                  newSels[idx] = { keep_id: s.drop_id, drop_id: s.keep_id }
                                } else {
                                  newSels.push({ keep_id: s.drop_id, drop_id: s.keep_id })
                                }
                                return newSels
                              })
                            }}
                            className="text-amber-600 focus:ring-amber-500 mt-0.5"
                          />
                          <span className="opacity-70">{s.drop_name} {s.drop_nim && <span className="text-slate-400">({s.drop_nim})</span>}</span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : (
              <p className="bg-slate-100 p-2 rounded text-slate-700 text-sm">Tidak ditemukan data ganda pada simulasi pencarian.</p>
            )}
            <p className="font-semibold text-rose-600">Lanjutkan penggabungan permanen?</p>
          </div>
        }
        confirmText={deduplicateMutation.isPending ? "Sedang Menggabungkan..." : "Ya, Gabungkan Sekarang!"}
        variant="default"
        onConfirm={() => deduplicateMutation.mutate()}
      />

      {/* ── Koreksi Status Dialog ── */}
      <Dialog open={isRecalcOpen} onOpenChange={(v) => { if (!recalcMutation.isPending) setIsRecalcOpen(v) }}>
        <DialogContent className="rounded-[2rem] p-8 sm:max-w-2xl border-0 ring-1 ring-slate-100 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="items-center text-center">
            <div className="w-14 h-14 rounded-full bg-teal-50 flex items-center justify-center mx-auto mb-3">
              <RefreshCw className="h-6 w-6 text-teal-600" />
            </div>
            <DialogTitle className="text-xl font-black text-slate-800">Koreksi Status Kepegawaian</DialogTitle>
            <DialogDescription className="text-slate-500 text-sm mt-1">
              Preview perubahan status sebelum diterapkan.
            </DialogDescription>
          </DialogHeader>

          {recalcResult && (
            <div className="mt-4 space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-2xl p-4 text-center">
                  <div className="text-2xl font-black text-slate-700">{recalcResult.total ?? 0}</div>
                  <div className="text-xs font-semibold text-slate-500 mt-1 uppercase tracking-wide">Total Diperiksa</div>
                </div>
                <div className={`rounded-2xl p-4 text-center ${(recalcResult.updated ?? 0) > 0 ? 'bg-teal-50' : 'bg-emerald-50'}`}>
                  <div className={`text-2xl font-black ${(recalcResult.updated ?? 0) > 0 ? 'text-teal-600' : 'text-emerald-600'}`}>
                    {recalcResult.updated ?? 0}
                  </div>
                  <div className="text-xs font-semibold text-slate-500 mt-1 uppercase tracking-wide">Akan Dikoreksi</div>
                </div>
              </div>

              {/* Changes list */}
              {(recalcResult.changes?.length ?? 0) > 0 ? (
                <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4">
                  <p className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-3">
                    Daftar Perubahan ({recalcResult.changes.length} ditampilkan)
                  </p>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {recalcResult.changes.map((c: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 text-xs bg-white rounded-xl px-3 py-2 shadow-sm">
                        <div className="flex-1 font-semibold text-slate-700 truncate">{c.nama}</div>
                        <div className="shrink-0 text-slate-400 text-[11px]">{c.tmt || '–'}</div>
                        <div className="shrink-0 flex items-center gap-1.5">
                          <Badge className={`text-[10px] px-1.5 py-0 rounded-lg font-bold border-0 ${c.dari === 'GTY' ? 'bg-emerald-100 text-emerald-700' : c.dari === 'PNS' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                            {c.dari}
                          </Badge>
                          <span className="text-slate-400">→</span>
                          <Badge className={`text-[10px] px-1.5 py-0 rounded-lg font-bold border-0 ${c.menjadi === 'GTY' ? 'bg-emerald-500 text-white' : c.menjadi === 'Tendik' ? 'bg-purple-100 text-purple-700' : 'bg-slate-200 text-slate-700'}`}>
                            {c.menjadi}
                          </Badge>
                          {c.pendidikan_baru && (
                            <Badge className="text-[10px] px-1.5 py-0 rounded-lg font-bold border-0 bg-sky-100 text-sky-700">
                              +{c.pendidikan_baru}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-5 text-center">
                  <Check className="h-8 w-8 text-emerald-500 mx-auto mb-2" strokeWidth={2.5} />
                  <p className="text-sm font-semibold text-emerald-700">Semua status sudah tepat, tidak ada yang perlu dikoreksi.</p>
                </div>
              )}

              <p className="text-xs text-slate-400 text-center">
                Aturan: GTT → GTY jika TMT ≥ 2 tahun · GTY → GTT jika TMT &lt; 2 tahun · Tanpa gelar → Tendik · Badge biru = pendidikan terisi otomatis dari gelar
              </p>
            </div>
          )}

          <DialogFooter className="mt-6 flex gap-3 sm:justify-center">
            <button
              onClick={() => { setIsRecalcOpen(false); setRecalcResult(null) }}
              disabled={recalcMutation.isPending}
              className="flex-1 h-12 rounded-2xl border border-slate-200 font-black uppercase tracking-widest text-xs text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Batal
            </button>
            {(recalcResult?.updated ?? 0) > 0 && (
              <button
                onClick={() => recalcMutation.mutate()}
                disabled={recalcMutation.isPending}
                className="flex-1 h-12 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-black uppercase tracking-widest text-xs disabled:opacity-50 transition-colors"
              >
                {recalcMutation.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                  : `Terapkan ${recalcResult.updated} Koreksi`}
              </button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

