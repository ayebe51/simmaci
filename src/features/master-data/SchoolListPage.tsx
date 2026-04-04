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
import { Search, Plus, Trash2, Edit, FileSpreadsheet, Download, Eye, KeyRound, Loader2, MapPin } from "lucide-react"
import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import SoftPageHeader from "@/components/ui/SoftPageHeader"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { schoolApi } from "@/lib/api"
import { toast } from "sonner"
import ExcelImportModal from "./components/ExcelImportModal"

interface School {
  id: number
  nsm: string
  nama: string
  alamat?: string
  kecamatan?: string
  kepala_madrasah?: string
  status_jamiyyah?: string
  akreditasi?: string
  npsn?: string
  npsm_nu?: string
  email?: string
  telepon?: string
  provinsi?: string
  kabupaten?: string
  kelurahan?: string
}

export default function SchoolListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState("")
  const [filterKecamatan, setFilterKecamatan] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 15

  // 🔥 REST API QUERY
  const { data: schoolsData, isLoading } = useQuery({
    queryKey: ['schools', currentPage, searchTerm, filterKecamatan],
    queryFn: () => schoolApi.list({
      page: currentPage,
      per_page: itemsPerPage,
      search: searchTerm || undefined,
      kecamatan: filterKecamatan === "all" ? undefined : filterKecamatan
    })
  })

  const schools = schoolsData?.data || []
  const totalPages = schoolsData?.last_page || 1

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: (id: number) => schoolApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools'] })
      toast.success("Sekolah berhasil dihapus")
    }
  })

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [formData, setFormData] = useState<Partial<School>>({})
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)

  const openAdd = () => {
    setIsEditMode(false)
    setFormData({ status_jamiyyah: 'Jamiyyah' })
    setIsAddOpen(true)
  }

  const openEdit = (school: School) => {
    setIsEditMode(true)
    setFormData(school)
    setIsAddOpen(true)
  }

  const handleSave = async () => {
    if (!formData.nama || !formData.nsm) { toast.error("NSM dan Nama wajib diisi!"); return }
    try {
      if (isEditMode && formData.id) {
        await schoolApi.update(formData.id, formData)
        toast.success("Berhasil memperbarui sekolah")
      } else {
        await schoolApi.create(formData)
        toast.success("Berhasil menambah sekolah")
      }
      queryClient.invalidateQueries({ queryKey: ['schools'] })
      setIsAddOpen(false)
    } catch (e: any) {
      toast.error("Gagal menyimpan: " + e.message)
    }
  }

  const uniqueKecamatan = [
    "Cilacap Selatan", "Cilacap Tengah", "Cilacap Utara", "Kesugihan", "Adipala", "Maos", "Kroya", "Binangun", "Nusawungu", "Sampang", "Karangpucung", "Cimanggu", "Majenang", "Wanareja", "Dayeuhluhur", "Gandrungmangu", "Sidareja", "Kedungreja", "Patimuan", "Bantarsari", "Kawunganten", "Jeruklegi", "Kampung Laut", "Cipari"
  ].sort()

  return (
    <div className="space-y-6 pb-10">
      <SoftPageHeader
        title="Profil Lembaga"
        description="Manajemen profil satuan pendidikan di lingkungan LP Ma'arif NU Cilacap"
        actions={[
          { label: 'Export Excel', onClick: () => toast.info('Fitur Export Excel belum tersedia'), variant: 'mint', icon: <Download className="h-4 w-4" /> },
          { label: 'Delete All', onClick: () => toast.error('Fitur Delete All belum tersedia'), variant: 'purple', icon: <Trash2 className="h-4 w-4" /> },
          { label: 'Tambah Manual', onClick: openAdd, variant: 'orange', icon: <Plus className="h-4 w-4" /> },
          { label: 'Generate Akun', onClick: () => toast.info('Fitur Generate Akun belum tersedia'), variant: 'purple', icon: <KeyRound className="h-4 w-4" /> },
          { label: 'Import Excel', onClick: () => setIsImportModalOpen(true), variant: 'blue', icon: <FileSpreadsheet className="h-4 w-4" /> },
        ]}
      />

      <Card className="border-0 shadow-sm rounded-3xl overflow-hidden bg-white/80 backdrop-blur-md">
        <CardHeader className="p-6 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative flex-1 w-full max-w-md">
                    <Search className="absolute left-4 top-3 h-4 w-4 text-emerald-500" />
                    <Input
                        placeholder="Cari nama sekolah..."
                        className="pl-11 h-10 rounded-2xl bg-white border-slate-200 focus-visible:ring-emerald-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                
                <Select value={filterKecamatan} onValueChange={setFilterKecamatan}>
                    <SelectTrigger className="w-full sm:w-[220px] h-10 rounded-2xl bg-white border-slate-200">
                        <SelectValue placeholder="Semua Kecamatan" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-slate-100">
                        <SelectItem value="all">Semua Kecamatan</SelectItem>
                        {uniqueKecamatan.map(k => (
                          <SelectItem key={k} value={k}>{k}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </CardHeader>
        <CardContent className="p-0">
            <Table>
                <TableHeader className="bg-emerald-50/50">
                    <TableRow className="border-b-0 hover:bg-transparent">
                        <TableHead className="py-4 px-6 font-bold text-emerald-800 rounded-tl-xl">NSM</TableHead>
                        <TableHead className="py-4 px-6 font-bold text-emerald-800">Nama Sekolah</TableHead>
                        <TableHead className="py-4 px-6 font-bold text-emerald-800">Kecamatan</TableHead>
                        <TableHead className="py-4 px-6 font-bold text-emerald-800">Kepala Sekolah</TableHead>
                        <TableHead className="py-4 px-6 font-bold text-emerald-800">No. HP</TableHead>
                        <TableHead className="py-4 px-6 font-bold text-emerald-800">Status</TableHead>
                        <TableHead className="py-4 px-6 font-bold text-emerald-800 text-right pr-8 rounded-tr-xl">Aksi</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        <TableRow><TableCell colSpan={7} className="h-32 text-center"><Loader2 className="animate-spin h-6 w-6 mx-auto text-emerald-500" /></TableCell></TableRow>
                    ) : schools.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="h-32 text-center text-slate-400 font-medium">Tidak ada data lembaga.</TableCell></TableRow>
                    ) : (
                        schools.map((item: School) => (
                            <TableRow key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                                <TableCell className="px-6 py-4 font-semibold text-slate-700">{item.nsm}</TableCell>
                                <TableCell className="px-6 py-4">
                                    <div className="font-bold text-slate-900">{item.nama}</div>
                                    <div className="text-xs text-slate-400 mt-1 flex items-start gap-1 max-w-[250px]">
                                        <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                                        <span className="truncate">{item.alamat || '-'}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="px-6 py-4 text-slate-600">{item.kecamatan}</TableCell>
                                <TableCell className="px-6 py-4 text-sm text-slate-600">{item.kepala_madrasah}</TableCell>
                                <TableCell className="px-6 py-4 text-sm text-slate-600 font-medium">{item.telepon || '-'}</TableCell>
                                <TableCell className="px-6 py-4">
                                    <Badge variant="outline" className="rounded-lg bg-slate-50 text-slate-600 border-slate-200 font-medium px-2 py-1">
                                        {item.status_jamiyyah}
                                    </Badge>
                                </TableCell>
                                <TableCell className="px-6 py-4 text-right pr-8">
                                    <div className="flex flex-col gap-2 items-end justify-center">
                                        <Link to={`/dashboard/master/schools/${item.id}`}>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50"><Eye className="h-4 w-4" /></Button>
                                        </Link>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-500 hover:text-blue-700 hover:bg-blue-50" onClick={() => toast.info('Reset password belum tersedia')}><KeyRound className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-600 hover:text-slate-900 hover:bg-slate-100" onClick={() => openEdit(item)}><Edit className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500 hover:text-rose-700 hover:bg-rose-50" onClick={() => {
                                            if(confirm(`Yakin ingin menghapus ${item.nama}?`)) deleteMutation.mutate(item.id)
                                        }}><Trash2 className="h-4 w-4" /></Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
            
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
        <DialogContent className="max-w-4xl">
            <DialogHeader><DialogTitle>{isEditMode ? 'Edit' : 'Tambah'} Sekolah</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4 overflow-y-auto max-h-[70vh]">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Nama Sekolah</Label>
                        <Input value={formData.nama || ""} onChange={e => setFormData({...formData, nama: e.target.value})} placeholder="Masukkan nama sekolah" />
                    </div>
                    <div className="space-y-2">
                        <Label>Kecamatan</Label>
                        <Select value={formData.kecamatan} onValueChange={v => setFormData({...formData, kecamatan: v})}>
                            <SelectTrigger><SelectValue placeholder="Pilih Kecamatan" /></SelectTrigger>
                            <SelectContent>
                                {uniqueKecamatan.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>NSM</Label>
                        <Input value={formData.nsm || ""} onChange={e => setFormData({...formData, nsm: e.target.value})} placeholder="Nomor Statistik Madrasah" />
                    </div>
                    <div className="space-y-2">
                        <Label>NPSN</Label>
                        <Input value={formData.npsn || ""} onChange={e => setFormData({...formData, npsn: e.target.value})} placeholder="Nomor Pokok Sekolah Nasional" />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Kepala Madrasah</Label>
                        <Input value={formData.kepala_madrasah || ""} onChange={e => setFormData({...formData, kepala_madrasah: e.target.value})} placeholder="Nama Kepala Madrasah" />
                    </div>
                    <div className="space-y-2">
                        <Label>Akreditasi</Label>
                        <Select value={formData.akreditasi} onValueChange={v => setFormData({...formData, akreditasi: v})}>
                            <SelectTrigger><SelectValue placeholder="Pilih Akreditasi" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="A">Terakreditasi A</SelectItem>
                                <SelectItem value="B">Terakreditasi B</SelectItem>
                                <SelectItem value="C">Terakreditasi C</SelectItem>
                                <SelectItem value="Belum">Belum Terakreditasi</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>NPSMNU</Label>
                        <Input value={formData.npsm_nu || ""} onChange={e => setFormData({...formData, npsm_nu: e.target.value})} placeholder="Nomor Pokok Statistik Ma'arif NU" />
                    </div>
                    <div className="space-y-2">
                        <Label>Status</Label>
                        <Select value={formData.status_jamiyyah} onValueChange={v => setFormData({...formData, status_jamiyyah: v})}>
                            <SelectTrigger><SelectValue placeholder="Pilih Status" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Jam'iyyah">Jam'iyyah</SelectItem>
                                <SelectItem value="Jama'ah (Afiliasi)">Jama'ah (Afiliasi)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                        <Label>Alamat Lengkap</Label>
                        <Input value={formData.alamat || ""} onChange={e => setFormData({...formData, alamat: e.target.value})} placeholder="Jl. Raya No..." />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Email</Label>
                        <Input type="email" value={formData.email || ""} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="sekolah@maarif.nu" />
                    </div>
                    <div className="space-y-2">
                        <Label>No. Telepon</Label>
                        <Input value={formData.telepon || ""} onChange={e => setFormData({...formData, telepon: e.target.value})} placeholder="08..." />
                    </div>
                </div>
            </div>
            <DialogFooter className="border-t pt-4">
                <Button variant="outline" onClick={() => setIsAddOpen(false)}>Batal</Button>
                <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700">Simpan Data</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <ExcelImportModal
        title="Import Data Sekolah"
        description="Pastikan file excel Anda memiliki kolom: nsm, nama, kecamatan, alamat, kepala_madrasah."
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={async (data) => {
          try {
            const res = await schoolApi.import(data)
            queryClient.invalidateQueries({ queryKey: ['schools'] })
            if (res.errors && res.errors.length > 0) {
                const firstError = res.errors[0]?.error || "Unknown error"
                toast.warning(`Berhasil: ${res.created}, Gagal: ${res.errors.length}. Detail error pertama: ${firstError}`, {
                    duration: 6000
                })
            } else {
                toast.success(`Berhasil mengimpor ${res.created} data sekolah!`)
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
