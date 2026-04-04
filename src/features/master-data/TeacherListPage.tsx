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
import { Plus, Search, Edit, BadgeCheck, Archive, FileSpreadsheet, Download, Trash2, UserCheck, UserMinus, Loader2, Wand2, Check, X, ImagePlus, KeyRound } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { useState, useMemo, useEffect } from "react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import SoftPageHeader from "@/components/ui/SoftPageHeader"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { teacherApi, schoolApi } from "@/lib/api"
import ExcelImportModal from "./components/ExcelImportModal"
import TeacherPhotoUpload from "./components/TeacherPhotoUpload"
import KtaCard from "./components/KtaCard"

interface Teacher {
  id: number
  nuptk?: string
  nip?: string
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

  // 🔥 REST API QUERY
  const { data: teachersData, isLoading } = useQuery({
    queryKey: ['teachers', currentPage, searchTerm, filterKecamatan, activeFilter],
    queryFn: () => teacherApi.list({
      page: currentPage,
      per_page: itemsPerPage,
      search: searchTerm || undefined,
      kecamatan: filterKecamatan === "all" ? undefined : filterKecamatan,
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
      if (isEditMode && formData.id) {
        await updateMutation.mutateAsync({ id: formData.id, data: formData })
      } else {
        await teacherApi.create(formData)
        queryClient.invalidateQueries({ queryKey: ['teachers'] })
        toast.success("Berhasil menambah guru")
      }
      setIsAddOpen(false)
    } catch (e: any) {
      toast.error("Gagal menyimpan: " + e.message)
    }
  }

  return (
    <div className="space-y-6">
      <SoftPageHeader
        title="Data Guru & Tenaga Kependidikan"
        description="Manajemen data guru dan tenaga kependidikan LP Ma'arif NU Cilacap"
        actions={[
          { label: 'Export Excel', onClick: () => toast.info('Fitur Export Excel belum tersedia'), variant: 'mint', icon: <Download className="h-4 w-4" /> },
          { label: 'Delete All', onClick: () => toast.info('Fitur Delete All belum tersedia'), variant: 'purple', icon: <Trash2 className="h-4 w-4" /> },
          { label: 'Tambah Manual', onClick: () => {
              setFormData({ is_active: true })
              setIsEditMode(false)
              setIsAddOpen(true)
          }, variant: 'orange', icon: <Plus className="h-4 w-4" /> },
          { label: 'Import Excel', onClick: () => setIsImportModalOpen(true), variant: 'blue', icon: <FileSpreadsheet className="h-4 w-4" /> }
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
                            {/* Filter kecamatan logic here */}
                        </SelectContent>
                    </Select>
                    
                    <Select defaultValue="all">
                        <SelectTrigger className="w-[160px] h-10 rounded-2xl bg-white border-slate-200">
                            <SelectValue placeholder="Semua Status" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-slate-100">
                            <SelectItem value="all">Semua Status</SelectItem>
                            <SelectItem value="GTY">GTY</SelectItem>
                            <SelectItem value="GTT">GTT</SelectItem>
                            <SelectItem value="PNS">PNS</SelectItem>
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
                        <TableHead className="w-[40px] pl-6 rounded-tl-xl text-emerald-800"><Checkbox className="border-emerald-300 data-[state=checked]:bg-emerald-500 data-[state=checked]:text-white" /></TableHead>
                        <TableHead className="py-4 px-6 font-bold text-emerald-800">Nomor Induk</TableHead>
                        <TableHead className="py-4 px-6 font-bold text-emerald-800">Nama</TableHead>
                        <TableHead className="py-4 px-6 font-bold text-emerald-800 text-center">Status</TableHead>
                        <TableHead className="py-4 px-6 font-bold text-emerald-800 text-center">Sertifikasi</TableHead>
                        <TableHead className="py-4 px-6 font-bold text-emerald-800 text-center">PDPKPNU</TableHead>
                        <TableHead className="py-4 px-6 font-bold text-emerald-800">Satminkal</TableHead>
                        <TableHead className="py-4 px-6 font-bold text-emerald-800 text-right pr-6 rounded-tr-xl">Aksi</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        <TableRow><TableCell colSpan={8} className="h-32 text-center"><Loader2 className="animate-spin h-6 w-6 mx-auto text-emerald-500" /></TableCell></TableRow>
                    ) : teachers.length === 0 ? (
                        <TableRow><TableCell colSpan={8} className="h-32 text-center text-slate-400 font-medium">Tidak ada data guru.</TableCell></TableRow>
                    ) : (
                        teachers.map((item: Teacher) => (
                            <TableRow key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                                <TableCell className="pl-6">
                                    <Checkbox 
                                        className="border-slate-300 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-none"
                                        checked={selectedTeacherIds.has(item.id)}
                                        onCheckedChange={() => toggleSelection(item.id)}
                                    />
                                </TableCell>
                                <TableCell className="px-6 py-4">
                                    <div className="font-bold text-slate-800">{item.nuptk || "-"}</div>
                                    <div className="text-xs font-semibold text-slate-400 mt-0.5">{item.nip || "-"}</div>
                                </TableCell>
                                <TableCell className="px-6 py-4">
                                    <div className="font-semibold text-slate-800">{item.nama}</div>
                                    <div className="text-xs text-slate-500 mt-0.5 max-w-[200px] truncate">{item.mapel || ""}</div>
                                </TableCell>
                                <TableCell className="px-6 py-4 text-center">
                                    <Badge variant="outline" className={`rounded-xl px-3 py-1 font-bold tracking-wide border-0 ${item.status === 'GTY' ? 'bg-emerald-500 text-white shadow-sm' : item.status === 'PNS' ? 'bg-blue-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600'}`}>
                                        {item.status || "GTY"}
                                    </Badge>
                                </TableCell>
                                <TableCell className="px-6 py-4 text-center">
                                    {item.is_certified ? (
                                        <div className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-emerald-600">
                                            <Check className="h-3.5 w-3.5 border border-emerald-600 rounded-full p-[1px]" /> Sertifikasi
                                        </div>
                                    ) : (
                                        <Badge variant="outline" className="rounded-xl px-3 py-1 font-bold tracking-wide border-0 bg-slate-100 text-slate-600">Honorer</Badge>
                                    )}
                                </TableCell>
                                <TableCell className="px-6 py-4 text-center">
                                    {item.pdpkpnu ? (
                                        <Check className="h-4 w-4 text-emerald-500 mx-auto" strokeWidth={3} />
                                    ) : (
                                        <X className="h-4 w-4 text-rose-300 mx-auto" strokeWidth={3} />
                                    )}
                                </TableCell>
                                <TableCell className="px-6 py-4 text-sm font-medium text-slate-700 max-w-[150px] truncate">
                                    {item.unit_kerja || "Unknown"}
                                </TableCell>
                                <TableCell className="px-6 py-4 text-right pr-6">
                                    <div className="flex flex-col gap-2 items-end justify-center">
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-500 hover:text-blue-700 hover:bg-blue-50" onClick={() => openEdit(item)}><Edit className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-purple-500 hover:text-purple-700 hover:bg-purple-50" onClick={() => toast.info('Reset password belum tersedia')}><KeyRound className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500 hover:text-rose-700 hover:bg-rose-50" onClick={() => {
                                            if(confirm(`Hapus guru ${item.nama}?`)) deleteMutation.mutate(item.id)
                                        }}><Trash2 className="h-4 w-4" /></Button>
                                    </div>
                                </TableCell>
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
                
                {/* Upload Foto Placeholder */}
                <div className="flex justify-center mb-8">
                    <div className="w-32 h-40 bg-slate-100 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 relative group overflow-hidden transition-colors hover:border-emerald-300 hover:bg-emerald-50/50 cursor-pointer">
                        <ImagePlus className="h-8 w-8 mb-2 text-slate-300 group-hover:text-emerald-400" strokeWidth={1.5} />
                        <div className="text-[10px] font-medium tracking-wide">Upload Foto</div>
                        <div className="absolute -bottom-10 left-0 right-0 py-2 bg-white/90 backdrop-blur text-[8px] text-center text-slate-500 group-hover:bottom-0 transition-all">Format: JPG/PNG.<br/>Max 2MB (3:4)</div>
                    </div>
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
                        <Label className="text-right text-slate-600 font-bold text-sm">N.I.M</Label>
                        <Input value={formData.nip || ""} onChange={e => setFormData({...formData, nip: e.target.value})} className="h-10 rounded-xl" />
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
                                <SelectItem value="SMA/Sederajat">SMA/Sederajat</SelectItem>
                                <SelectItem value="SMA">SMA</SelectItem>
                                <SelectItem value="SMK">SMK</SelectItem>
                                <SelectItem value="MA">MA</SelectItem>
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
        onImport={async (data) => {
            try {
                const res = await teacherApi.import(data)
                queryClient.invalidateQueries({ queryKey: ['teachers'] })
                if (res.errors && res.errors.length > 0) {
                    const firstError = res.errors[0]?.error || "Unknown error"
                    toast.warning(`Berhasil: ${res.created}, Gagal: ${res.errors.length}. Detail error pertama: ${firstError}`, {
                        duration: 6000
                    })
                } else {
                    toast.success(`Berhasil mengimpor ${res.created} data guru!`)
                }
                setIsImportModalOpen(false)
            } catch (e: any) {
                toast.error("Gagal import: " + e.message)
            }
        }}
      />
    </div>
  )
}
