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
import { Plus, Search, Trash2, Edit, Download, FileSpreadsheet, Loader2, GraduationCap, ArrowUpDown } from "lucide-react"
import { useState, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import SoftPageHeader from "@/components/ui/SoftPageHeader"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { studentApi, schoolApi } from "@/lib/api"
import ExcelImportModal from "./components/ExcelImportModal"
import StudentPhotoUpload from "./components/StudentPhotoUpload"

interface Student {
  id: number
  nisn?: string
  nik?: string
  nama: string
  kelas?: string
  status?: string
  school_id?: number
  school?: { nama: string }
  jenis_kelamin?: string
  tempat_lahir?: string
  tanggal_lahir?: string
  nama_ayah?: string
  nama_ibu?: string
  alamat?: string
  provinsi?: string
  kabupaten?: string
  kecamatan?: string
  kelurahan?: string
  npsn?: string
  nomor_telepon?: string
  nama_wali?: string
  photo_id?: string
}

export default function StudentListPage() {
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
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
  const isSuperAdmin = user?.role === "super_admin"

  // 🔥 REST API QUERY
  const { data: studentsData, isLoading } = useQuery({
    queryKey: ['students', currentPage, searchTerm, statusFilter],
    queryFn: () => studentApi.list({
      page: currentPage,
      per_page: itemsPerPage,
      search: searchTerm || undefined,
      status: statusFilter === "all" ? undefined : statusFilter
    })
  })

  const students = studentsData?.data || []
  const totalPages = studentsData?.last_page || 1

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: (id: number) => studentApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      toast.success("Siswa berhasil dihapus")
    }
  })

  const batchTransitionMutation = useMutation({
    mutationFn: (action: 'promote' | 'graduate') => studentApi.batchTransition({
        school_id: user?.school_id,
        action
    }),
    onSuccess: (res) => {
        queryClient.invalidateQueries({ queryKey: ['students'] })
        toast.success(`Berhasil memproses ${res.count} siswa`)
    }
  })

  // Modal States
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [formData, setFormData] = useState<Partial<Student>>({})
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [isTransitionModalOpen, setIsTransitionModalOpen] = useState(false)

  const handleSave = async () => {
    if (!formData.nama) { toast.error("Nama wajib diisi!"); return }
    try {
      if (formData.id) {
        await studentApi.update(formData.id, formData)
        toast.success("Berhasil memperbarui siswa")
      } else {
        await studentApi.create(formData)
        toast.success("Berhasil menambah siswa")
      }
      queryClient.invalidateQueries({ queryKey: ['students'] })
      setIsAddOpen(false)
    } catch (e: any) {
      toast.error("Gagal menyimpan: " + e.message)
    }
  }

  return (
    <div className="space-y-6">
      <SoftPageHeader
        title="Data Siswa"
        description="Data peserta didik di lingkungan LP Ma'arif NU Cilacap"
        actions={[
          { label: 'Naik Kelas', onClick: () => setIsTransitionModalOpen(true), variant: 'blue', icon: <ArrowUpDown className="h-5 w-5" /> },
          { label: 'Import Excel', onClick: () => setIsImportModalOpen(true), variant: 'cream', icon: <FileSpreadsheet className="h-5 w-5" /> },
          { label: 'Tambah Manual', onClick: () => { setFormData({}); setIsAddOpen(true); }, variant: 'mint', icon: <Plus className="h-5 w-5" /> }
        ]}
      />

      <Card className="border-0 shadow-sm rounded-2xl overflow-hidden bg-white/80 backdrop-blur-md">
        <CardHeader className="pb-4 border-b">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative flex-1 w-full max-w-md">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Cari siswa..."
                        className="pl-10 rounded-xl"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[160px] rounded-xl">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Status</SelectItem>
                        <SelectItem value="Aktif">Aktif</SelectItem>
                        <SelectItem value="Lulus">Lulus</SelectItem>
                        <SelectItem value="Keluar">Keluar</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </CardHeader>
        <CardContent className="p-0">
            <Table>
                <TableHeader className="bg-emerald-50/40">
                    <TableRow>
                        <TableHead className="w-12 text-center">
                            <div className="w-4 h-4 rounded-full border border-emerald-500 mx-auto" />
                        </TableHead>
                        <TableHead className="text-emerald-800 font-semibold cursor-pointer whitespace-nowrap">
                            <div className="flex items-center gap-1">NISN <ArrowUpDown className="h-3 w-3 text-slate-400" /></div>
                        </TableHead>
                        <TableHead className="text-emerald-800 font-semibold cursor-pointer min-w-[140px]">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1">Nama Lengkap <ArrowUpDown className="h-3 w-3 text-slate-400" /></div>
                        </TableHead>
                        <TableHead className="text-emerald-800 font-semibold cursor-pointer whitespace-nowrap">
                            <div className="flex items-center gap-1">NIK <ArrowUpDown className="h-3 w-3 text-slate-400" /></div>
                        </TableHead>
                        <TableHead className="text-emerald-800 font-semibold min-w-[120px]">
                            Tempat/Tgl<br/>Lahir
                        </TableHead>
                        <TableHead className="text-emerald-800 font-semibold cursor-pointer">
                            <div className="flex items-center gap-1">Kelas <ArrowUpDown className="h-3 w-3 text-slate-400" /></div>
                        </TableHead>
                        <TableHead className="text-emerald-800 font-semibold cursor-pointer group">
                            <div className="flex items-center gap-1">L/P <ArrowUpDown className="h-3 w-3 text-slate-400" /></div>
                        </TableHead>
                        <TableHead className="text-emerald-800 font-semibold">
                            Nama<br/>Ayah
                        </TableHead>
                        <TableHead className="text-emerald-800 font-semibold">
                            Nama<br/>Ibu
                        </TableHead>
                        <TableHead className="text-emerald-800 font-semibold cursor-pointer min-w-[160px]">
                            <div className="flex items-center gap-1">Asal Sekolah <ArrowUpDown className="h-3 w-3 text-slate-400" /></div>
                        </TableHead>
                        <TableHead className="text-emerald-800 font-semibold cursor-pointer whitespace-nowrap">
                            <div className="flex items-center gap-1">NPSN <ArrowUpDown className="h-3 w-3 text-slate-400" /></div>
                        </TableHead>
                        <TableHead className="text-emerald-800 font-semibold">Status</TableHead>
                        <TableHead className="text-emerald-800 font-semibold text-center border-l bg-white/40 backdrop-blur-sm shadow-sm sticky right-0">Aksi</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        <TableRow><TableCell colSpan={13} className="h-32 text-center"><Loader2 className="animate-spin h-6 w-6 mx-auto text-emerald-500" /></TableCell></TableRow>
                    ) : students.length === 0 ? (
                        <TableRow><TableCell colSpan={13} className="h-32 text-center text-slate-400">Tidak ada data.</TableCell></TableRow>
                    ) : (
                        students.map((item: Student) => (
                            <TableRow key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                                <TableCell className="text-center align-top pt-4">
                                    <div className="w-4 h-4 rounded-full border border-emerald-500 mx-auto" />
                                </TableCell>
                                <TableCell className="font-semibold text-slate-800 text-sm align-top pt-4">{item.nisn || "-"}</TableCell>
                                <TableCell className="text-sm text-slate-700 align-top pt-4">{item.nama || "-"}</TableCell>
                                <TableCell className="text-sm text-slate-600 align-top pt-4">{item.nik || "-"}</TableCell>
                                <TableCell className="align-top pt-4">
                                    <div className="text-xs text-slate-700">{item.tempat_lahir || "Cilacap"}</div>
                                    <div className="text-[11px] text-slate-400">{item.tanggal_lahir || "-"}</div>
                                </TableCell>
                                <TableCell className="text-sm text-slate-700 align-top pt-4">{item.kelas || "-"}</TableCell>
                                <TableCell className="text-sm text-slate-700 align-top pt-4">{item.jenis_kelamin || "-"}</TableCell>
                                <TableCell className="text-sm text-slate-700 align-top pt-4">{item.nama_ayah || "-"}</TableCell>
                                <TableCell className="text-sm text-slate-700 align-top pt-4">{item.nama_ibu || "-"}</TableCell>
                                <TableCell className="text-sm text-slate-600 align-top pt-4 max-w-[150px] truncate" title={item.school?.nama || ""}>{item.school?.nama || "-"}</TableCell>
                                <TableCell className="text-sm text-slate-600 align-top pt-4">{item.npsn || "-"}</TableCell>
                                <TableCell className="align-top pt-4">
                                    <span className={`px-2 py-0.5 rounded text-[10px] capitalize font-semibold ${
                                        item.status === 'Aktif' ? 'bg-green-100 text-green-700' : 
                                        item.status === 'Lulus' ? 'bg-blue-100 text-blue-700' :
                                        'bg-slate-100 text-slate-600'
                                    }`}>{item.status || "Lulus"}</span>
                                </TableCell>
                                <TableCell className="text-center border-l bg-white/40 group-hover:bg-slate-50/50 transition-colors sticky right-0 align-top pt-2">
                                    <div className="flex flex-col items-center gap-3">
                                        <button className="text-slate-600 hover:text-blue-600 transition-colors" onClick={() => { setFormData(item); setIsAddOpen(true) }}>
                                            <Edit className="h-4 w-4" />
                                        </button>
                                        <button className="text-slate-600 hover:text-red-500 transition-colors" onClick={() => {
                                            if(confirm("Hapus siswa ini?")) deleteMutation.mutate(item.id)
                                        }}>
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
            
            <div className="flex items-center justify-between p-4 border-t">
                <div className="text-sm text-slate-500">Halaman {currentPage} dari {totalPages}</div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Sebelumnya</Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Selanjutnya</Button>
                </div>
            </div>
        </CardContent>
      </Card>

      {/* Transition Modal */}
      <ExcelImportModal
        title="Import Data Siswa"
        description="Gunakan format excel hasil ekspor Emis untuk mempercepat proses."
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        templateUrl="/TEMPLATE_IMPORT_DATA_SISWA_V3.xlsx"
        onImport={async (data) => {
            try {
                // Chunk import to avoid timeout on large datasets
                const CHUNK_SIZE = 25
                let totalCreated = 0
                const allErrors: any[] = []

                for (let i = 0; i < data.length; i += CHUNK_SIZE) {
                    const chunk = data.slice(i, i + CHUNK_SIZE)
                    const res = await studentApi.import(chunk as any[])
                    totalCreated += res.created || 0
                    if (res.errors) allErrors.push(...res.errors)
                }

                queryClient.invalidateQueries({ queryKey: ['students'] })
                if (allErrors.length > 0) {
                    const firstError = allErrors[0]?.error || "Unknown error"
                    toast.warning(`Berhasil: ${totalCreated}, Gagal: ${allErrors.length}. Error pertama: ${firstError}`, { duration: 6000 })
                } else {
                    toast.success(`Berhasil mengimpor ${totalCreated} data siswa!`)
                }
                setIsImportModalOpen(false)
            } catch (e: any) {
                toast.error("Gagal import: " + (e.response?.data?.message || e.message))
            }
        }}
      />

      <Dialog open={isTransitionModalOpen} onOpenChange={setIsTransitionModalOpen}>
        <DialogContent>
            <DialogHeader><DialogTitle>Naik Kelas / Lulus Massal</DialogTitle></DialogHeader>
            <div className="py-6 text-center space-y-4">
                <p className="text-sm text-slate-600">Pilih aksi yang ingin dilakukan untuk seluruh siswa aktif di sekolah ini.</p>
                <div className="grid grid-cols-2 gap-4">
                    <Button variant="outline" className="h-20 flex-col gap-2" onClick={() => {
                        if(confirm("Proses naik kelas seluruh siswa?")) batchTransitionMutation.mutate('promote')
                    }} disabled={batchTransitionMutation.isPending}>
                        <ArrowUpDown className="h-6 w-6 text-blue-500" />
                        <span>Naik Kelas</span>
                    </Button>
                    <Button variant="outline" className="h-20 flex-col gap-2" onClick={() => {
                        if(confirm("Luluskan seluruh siswa aktif?")) batchTransitionMutation.mutate('graduate')
                    }} disabled={batchTransitionMutation.isPending}>
                        <GraduationCap className="h-6 w-6 text-orange-500" />
                        <span>Luluskan</span>
                    </Button>
                </div>
            </div>
        </DialogContent>
      </Dialog>

      {/* Manual Add Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="border-b pb-4 mb-4">
                <DialogTitle className="text-xl font-bold text-emerald-900">
                    {formData.id ? "Edit Data Siswa" : "Tambah Data Siswa"}
                </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6">
                {/* Foto Profil */}
                <div className="flex flex-col items-center justify-center pt-2">
                    <StudentPhotoUpload
                        photoId={formData.photo_id}
                        onPhotoUploaded={(url) => setFormData({ ...formData, photo_id: url })}
                        onRemovePhoto={() => setFormData({ ...formData, photo_id: undefined })}
                    />
                </div>

                {/* Form Grid Area */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Baris 1 */}
                    <div className="space-y-2">
                        <Label className="text-slate-700 font-semibold">NISN <span className="text-red-500">*</span></Label>
                        <Input placeholder="NISN" className="bg-white border-slate-200 rounded-lg text-sm" value={formData.nisn || ""} onChange={e => setFormData({...formData, nisn: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-slate-700 font-semibold">Nama Lengkap <span className="text-red-500">*</span></Label>
                        <Input placeholder="Nama Siswa" className="bg-white border-slate-200 rounded-lg text-sm" value={formData.nama || ""} onChange={e => setFormData({...formData, nama: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-slate-700 font-semibold">NIK</Label>
                        <Input placeholder="NIK Siswa" className="bg-white border-slate-200 rounded-lg text-sm" value={formData.nik || ""} onChange={e => setFormData({...formData, nik: e.target.value})} />
                    </div>

                    {/* Baris 2 */}
                    <div className="space-y-2">
                        <Label className="text-slate-700 font-semibold">Tempat Lahir</Label>
                        <Input placeholder="Tempat Lahir" className="bg-white border-slate-200 rounded-lg text-sm" value={formData.tempat_lahir || ""} onChange={e => setFormData({...formData, tempat_lahir: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-slate-700 font-semibold">Tanggal Lahir</Label>
                        <Input type="date" className="bg-white border-slate-200 rounded-lg text-sm" value={formData.tanggal_lahir || ""} onChange={e => setFormData({...formData, tanggal_lahir: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-slate-700 font-semibold">Kelas</Label>
                        <Input placeholder="Contoh: 7A" className="bg-white border-slate-200 rounded-lg text-sm" value={formData.kelas || ""} onChange={e => setFormData({...formData, kelas: e.target.value})} />
                    </div>

                    {/* Baris 3 */}
                    <div className="space-y-2">
                        <Label className="text-slate-700 font-semibold">Jenis Kelamin</Label>
                        <Select value={formData.jenis_kelamin || ""} onValueChange={v => setFormData({...formData, jenis_kelamin: v})}>
                            <SelectTrigger className="bg-white border-slate-200 rounded-lg text-sm"><SelectValue placeholder="Pilih Jenis Kelamin" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="L">Laki-laki</SelectItem>
                                <SelectItem value="P">Perempuan</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-slate-700 font-semibold">Status Siswa</Label>
                        <Select value={formData.status || ""} onValueChange={v => setFormData({...formData, status: v})}>
                            <SelectTrigger className="bg-white border-slate-200 rounded-lg text-sm"><SelectValue placeholder="Pilih Status" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Aktif">Aktif</SelectItem>
                                <SelectItem value="Lulus">Lulus</SelectItem>
                                <SelectItem value="Keluar">Keluar</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-slate-700 font-semibold">Nama Ayah</Label>
                        <Input placeholder="Nama Ayah" className="bg-white border-slate-200 rounded-lg text-sm" value={formData.nama_ayah || ""} onChange={e => setFormData({...formData, nama_ayah: e.target.value})} />
                    </div>

                    {/* Baris 4 */}
                    <div className="space-y-2">
                        <Label className="text-slate-700 font-semibold">Nama Ibu</Label>
                        <Input placeholder="Nama Ibu" className="bg-white border-slate-200 rounded-lg text-sm" value={formData.nama_ibu || ""} onChange={e => setFormData({...formData, nama_ibu: e.target.value})} />
                    </div>
                    <div className="md:col-span-2"></div>

                    {/* Baris 5 */}
                    <div className="space-y-2 md:col-span-2">
                        <Label className="text-slate-700 font-semibold">Asal Sekolah</Label>
                        <Input placeholder="Nama Sekolah" className="bg-white border-slate-200 rounded-lg text-sm" value={formData.school?.nama || formData.school_id?.toString() || ""} readOnly disabled />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-slate-700 font-semibold">NPSN</Label>
                        <Input placeholder="NPSN Sekolah" className="bg-white border-slate-200 rounded-lg text-sm" value={formData.npsn || ""} onChange={e => setFormData({...formData, npsn: e.target.value})} />
                    </div>

                    {/* Baris 6 */}
                    <div className="space-y-2 md:col-span-1 border-t pt-4 mt-2 border-slate-100">
                        <Label className="text-slate-700 font-semibold">Provinsi</Label>
                        <Input placeholder="Otomatis" className="bg-slate-50 border-slate-200 rounded-lg text-sm text-slate-500" value={formData.provinsi || ""} disabled />
                    </div>
                    <div className="space-y-2 md:col-span-2 border-t pt-4 mt-2 border-slate-100">
                        <Label className="text-slate-700 font-semibold">Kabupaten/Kota</Label>
                        <Input placeholder="Otomatis" className="bg-slate-50 border-slate-200 rounded-lg text-sm text-slate-500" value={formData.kabupaten || ""} disabled />
                    </div>

                    {/* Baris 7 */}
                    <div className="space-y-2 md:col-span-1">
                        <Label className="text-slate-700 font-semibold">Kecamatan</Label>
                        <Input placeholder="Pilih Kecamatan" className="bg-white border-slate-200 rounded-lg text-sm" value={formData.kecamatan || ""} onChange={e => setFormData({...formData, kecamatan: e.target.value})} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                        <Label className="text-slate-700 font-semibold">Kelurahan/Desa</Label>
                        <Input placeholder="Pilih Kelurahan/Desa" className="bg-white border-slate-200 rounded-lg text-sm" value={formData.kelurahan || ""} onChange={e => setFormData({...formData, kelurahan: e.target.value})} />
                    </div>

                    {/* Baris 8 */}
                    <div className="space-y-2 md:col-span-3">
                        <Label className="text-slate-700 font-semibold">Alamat Lengkap (Jalan/RT/RW)</Label>
                        <Input placeholder="Jl. Contoh No. 123 RT 01 RW 02" className="bg-white border-slate-200 rounded-lg text-sm" value={formData.alamat || ""} onChange={e => setFormData({...formData, alamat: e.target.value})} />
                    </div>

                    {/* Baris 9 */}
                    <div className="space-y-2 md:col-span-1">
                        <Label className="text-slate-700 font-semibold">No. Telepon</Label>
                        <Input placeholder="Contoh: 08123456789" className="bg-white border-slate-200 rounded-lg text-sm" value={formData.nomor_telepon || ""} onChange={e => setFormData({...formData, nomor_telepon: e.target.value})} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                        <Label className="text-slate-700 font-semibold">Nama Wali</Label>
                        <Input placeholder="Nama Wali" className="bg-white border-slate-200 rounded-lg text-sm" value={formData.nama_wali || ""} onChange={e => setFormData({...formData, nama_wali: e.target.value})} />
                    </div>
                </div>
            </div>

            <DialogFooter className="mt-8 border-t pt-4">
                <Button variant="outline" className="rounded-xl px-6" onClick={() => setIsAddOpen(false)}>Batal</Button>
                <Button className="rounded-xl px-8 bg-emerald-600 hover:bg-emerald-700" onClick={handleSave}>Simpan</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
