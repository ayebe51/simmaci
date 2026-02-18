import { Button } from "@/components/ui/button"
import { toast } from "sonner"
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
import { Plus, Search, Trash2, Edit, ArrowUpDown, ArrowUp, ArrowDown, Download, FileSpreadsheet, Loader2 } from "lucide-react"
import { useState, useEffect, useMemo } from "react"
import { useSearchParams } from "react-router-dom"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api } from "@/lib/api"
import SoftPageHeader from "@/components/ui/SoftPageHeader"
import ExcelImportModal from "./components/ExcelImportModal"
// 🔥 CONVEX REAL-TIME
import { useQuery, useMutation, usePaginatedQuery } from "convex/react"
import { api as convexApi } from "../../../convex/_generated/api"
import { downloadStudentTemplate, processStudentImport } from "./student-import-utils"

interface Student {
  id: string
  nisn: string
  nama: string
  kelas: string
  sekolah: string
  jk: "L" | "P"
  // Optional fields for detailed view/edit
  nik?: string
  tempatLahir?: string
  tanggalLahir?: string
  namaAyah?: string
  namaIbu?: string
  alamat?: string
  kecamatan?: string
  nomorTelepon?: string
  npsn?: string
  namaWali?: string
  nomorIndukMaarif?: string
}

export default function StudentListPage() {
  const [searchTerm, setSearchTerm] = useState("")
  
  const createStudentMutation = useMutation(convexApi.students.create);

  // Manual Add Logic
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [formData, setFormData] = useState<Partial<Student>>({
      nisn: "", nama: "", kelas: "", sekolah: "", jk: "L",
      nomorIndukMaarif: "", nik: "", tempatLahir: "", tanggalLahir: "", alamat: "", kecamatan: "", nomorTelepon: "", namaAyah: "", namaIbu: "", namaWali: "", npsn: ""
  })

  
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)

  // PERMISSION: Filter by Unit Kerja for Operators
  const [userUnit] = useState<string | null>(() => {
    try {
        const u = localStorage.getItem("user")
        if (u) {
            const user = JSON.parse(u)
            if (user.role !== "super_admin" && user.unitKerja) {
                return user.unitKerja
            }
        }
    } catch(e) { return null }
    return null
  })

  // 🔥 REAL-TIME CONVEX PAGINATED QUERY
  const {
      results: rawStudents,
      status: queryStatus,
      loadMore,
      isLoading
  } = usePaginatedQuery(
      convexApi.students.listPaginated,
      {
          namaSekolah: userUnit || undefined,
          search: searchTerm || undefined,
      },
      { initialNumItems: 20 }
  );

  // Map Convex data to Student interface
  const students = (rawStudents || []).map((s: any) => ({
    id: s._id,
    nisn: s.nisn || "",
    nama: s.nama || "",
    kelas: s.kelas || "",
    sekolah: s.namaSekolah || "",
    jk: (s.jenisKelamin === "Perempuan" ? "P" : "L") as "L" | "P",
    // Map additional fields
    nik: s.nik,
    tempatLahir: s.tempatLahir,
    tanggalLahir: s.tanggalLahir,
    namaAyah: s.namaAyah,
    namaIbu: s.namaIbu,
    alamat: s.alamat,
    kecamatan: s.kecamatan,
    nomorTelepon: s.nomorTelepon,
    npsn: s.npsn,
    namaWali: s.namaWali,
  }))

  // Convex mutations
  const deleteStudentMutation = useMutation(convexApi.students.remove)
  const bulkCreateStudentMutation = useMutation(convexApi.students.bulkCreate)

  // Delete confirmation modal state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [studentToDelete, setStudentToDelete] = useState<{id: string, name: string} | null>(null)

  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: keyof Student; direction: 'asc' | 'desc' } | null>(null);

  const loadStudents = async () => {
    // No longer needed - Convex auto-updates!
    // Kept for compatibility
  }

  // Sort visible items
  const sortedStudents = useMemo(() => {
    const sortableItems = [...students];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        // Handle undefined values
        const aValue = a[sortConfig.key] || "";
        const bValue = b[sortConfig.key] || "";

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [students, sortConfig]);

  // 📄 CLIENT-SIDE PAGINATION STATE
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  // Better Pattern: Reset page during render if filters change
  const [prevFilters, setPrevFilters] = useState({ searchTerm, sortConfig })
  if (prevFilters.searchTerm !== searchTerm || prevFilters.sortConfig !== sortConfig) {
      setPrevFilters({ searchTerm, sortConfig })
      setCurrentPage(1)
  }

  // Computed Students for Current Page
  const paginatedStudents = useMemo(() => {
      const startIndex = (currentPage - 1) * itemsPerPage
      return sortedStudents.slice(startIndex, startIndex + itemsPerPage)
  }, [sortedStudents, currentPage])

  // Auto-open Import Modal if requested via URL
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
      if (searchParams.get("action") === "import") {
          // eslint-disable-next-line react-hooks/exhaustive-deps
          setIsImportModalOpen(true)
          // Clear param to prevent reopening on refresh
          setSearchParams(params => {
              params.delete("action")
              return params
          })
      }
  }, [searchParams, setSearchParams])

  // Sort Handler
  const requestSort = (key: keyof Student) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };
  
  const getSortIcon = (name: keyof Student) => {
      if (!sortConfig || sortConfig.key !== name) {
          return <ArrowUpDown className="ml-2 h-4 w-4" />
      }
      return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
  }
  
  // ... (existing code)

  const updateStudentMutation = useMutation(convexApi.students.update);

  const handleAdd = async () => {
      // Validate Required Fields
      if (!formData.nama || !formData.nisn) {
          toast.error("Nama dan NISN wajib diisi")
          return
      }

      // Helper to clean empty strings to undefined
      const clean = (val: string | undefined | null) => (val && val.trim().length > 0) ? val.trim() : undefined;
      
      const payload: any = {
        nisn: String(formData.nisn).trim(),
        nama: String(formData.nama).trim(),
        // Optional fields
        nik: clean(formData.nik),
        nomorIndukMaarif: clean(formData.nomorIndukMaarif),
        jenisKelamin: formData.jk, // Send "L" or "P" directly
        tempatLahir: clean(formData.tempatLahir),
        tanggalLahir: clean(formData.tanggalLahir),
        namaAyah: clean(formData.namaAyah),
        namaIbu: clean(formData.namaIbu),
        alamat: clean(formData.alamat),
        kecamatan: clean(formData.kecamatan),
        // Ensure namaSekolah is strictly string or undefined
        namaSekolah: clean(formData.sekolah) ?? (userUnit ? String(userUnit) : undefined),
        npsn: clean(formData.npsn),
        kelas: clean(formData.kelas),
        nomorTelepon: clean(formData.nomorTelepon),
        namaWali: clean(formData.namaWali),
      };

      // Strip undefined keys
      Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

      console.log("Submitting Student Payload (Cleaned JSON):", JSON.stringify(payload, null, 2));

      try {
          if (formData.id) {
            // Update existing student
            await updateStudentMutation({
                id: formData.id as any,
                ...payload
            })
            toast.success("Berhasil memperbarui data siswa")
          } else {
            // Create new student
            await createStudentMutation(payload)
            toast.success("Berhasil menambah siswa")
          }
          
          setIsAddOpen(false)
          setFormData({ 
              nisn: "", nama: "", kelas: "", sekolah: "", jk: "L",
              nomorIndukMaarif: "", tempatLahir: "", tanggalLahir: "", alamat: "", kecamatan: "", nomorTelepon: "", namaWali: "", nik: "", namaAyah: "", namaIbu: "", npsn: ""
          })
      } catch (e: any) {
          console.error("Mutation Error:", e)
          const errorMsg = e.message || "Unknown error";
          // Handle specific Convex errors readable
          if (errorMsg.includes("NISN sudah terdaftar")) {
             toast.error("Gagal: NISN sudah terdaftar di sistem");
          } else {
             toast.error(`Gagal ${formData.id ? 'mengedit' : 'menambah'} siswa: ` + errorMsg)
          }
      }
  }

  const handleDelete = async (id: string, name: string) => {
      setStudentToDelete({ id, name })
      setDeleteConfirmOpen(true)
  }

  const confirmDelete = async () => {
      if (!studentToDelete) return
      try {
          await deleteStudentMutation({ id: studentToDelete.id as any })
          toast.success(`Siswa "${studentToDelete.name}" berhasil dihapus!`)
          setDeleteConfirmOpen(false)
          setStudentToDelete(null)
      } catch (e: any) {
          console.error('Delete error:', e)
          toast.error("Gagal menghapus siswa: " + e.message)
      }
  }

  const cancelDelete = () => {
      setDeleteConfirmOpen(false)
      setStudentToDelete(null)
  }

  const handleExport = async () => {
      try {
          const blob = await api.exportStudents(userUnit || undefined)
          const url = window.URL.createObjectURL(new Blob([blob]));
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', `Data_Siswa_${new Date().toISOString().split('T')[0]}.xlsx`);
          document.body.appendChild(link);
          link.click();
          link.parentNode?.removeChild(link);
      } catch (e: any) {
          console.error(e)
          toast.error("Gagal mengexport data.")
      }
  }

  const handleDownloadTemplate = () => {
      try {
          downloadStudentTemplate();
          toast.success("Template berhasil didownload!");
      } catch (error) {
          console.error('Failed to download template:', error);
          toast.error('Gagal mendownload template.');
      }
  }

  // ... (existing code)

  return (
    <div className="space-y-6">
      <SoftPageHeader
        title="Data Siswa"
        description="Data peserta didik di lingkungan LP Ma'arif NU Cilacap"
        actions={[
          {
            label: 'Export Excel',
            onClick: handleExport,
            variant: 'mint',
            icon: <Download className="h-5 w-5 text-gray-700" />
          },

          {
            label: 'Tambah Manual',
            onClick: () => setIsAddOpen(true),
            variant: 'cream',
            icon: <Plus className="h-5 w-5 text-gray-700" />
          },
          {
            label: 'Import Excel',
            onClick: () => setIsImportModalOpen(true),
            variant: 'blue',
            icon: <FileSpreadsheet className="h-5 w-5 text-gray-700" />
          }
        ]}
      />

      <Card>
        <CardHeader className="pb-3">
             <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama, NISN, atau sekolah..."
                className="pl-9 max-w-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
        </CardHeader>
        <CardContent>
                <div className="overflow-x-auto">
                <Table className="min-w-[1200px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead onClick={() => requestSort('nisn')} className="cursor-pointer hover:bg-muted/50 transition-colors w-[120px]">
                          <div className="flex items-center">NISN {getSortIcon('nisn')}</div>
                      </TableHead>
                      <TableHead onClick={() => requestSort('nama')} className="cursor-pointer hover:bg-muted/50 transition-colors w-[200px]">
                          <div className="flex items-center">Nama Lengkap {getSortIcon('nama')}</div>
                      </TableHead>
                      <TableHead onClick={() => requestSort('nik')} className="cursor-pointer hover:bg-muted/50 transition-colors w-[140px]">
                          <div className="flex items-center">NIK {getSortIcon('nik')}</div>
                      </TableHead>
                      <TableHead className="w-[180px]">Tempat/Tgl Lahir</TableHead>
                      <TableHead onClick={() => requestSort('kelas')} className="cursor-pointer hover:bg-muted/50 transition-colors w-[80px]">
                          <div className="flex items-center">Kelas {getSortIcon('kelas')}</div>
                      </TableHead>
                      <TableHead onClick={() => requestSort('jk')} className="cursor-pointer hover:bg-muted/50 transition-colors w-[60px]">
                          <div className="flex items-center">L/P {getSortIcon('jk')}</div>
                      </TableHead>
                      <TableHead className="w-[150px]">Nama Ayah</TableHead>
                      <TableHead className="w-[150px]">Nama Ibu</TableHead>
                      <TableHead onClick={() => requestSort('sekolah')} className="cursor-pointer hover:bg-muted/50 transition-colors w-[200px]">
                          <div className="flex items-center">Asal Sekolah {getSortIcon('sekolah')}</div>
                      </TableHead>
                      <TableHead onClick={() => requestSort('npsn')} className="cursor-pointer hover:bg-muted/50 transition-colors w-[100px]">
                          <div className="flex items-center">NPSN {getSortIcon('npsn')}</div>
                      </TableHead>
                      <TableHead className="text-right w-[100px] sticky right-0 bg-background shadow-sm">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedStudents.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={11} className="h-24 text-center">
                                {isLoading || queryStatus === "LoadingMore" ? (
                                    <div className="flex items-center justify-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" /> Sedang memuat data...
                                    </div>
                                ) : "Tidak ada data siswa ditemukan pada halaman ini."}
                            </TableCell>
                        </TableRow>
                    ) : (
                        paginatedStudents.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.nisn}</TableCell>
                            <TableCell>{item.nama}</TableCell>
                            <TableCell>{item.nik || "-"}</TableCell>
                            <TableCell>
                                <div className="flex flex-col text-xs">
                                    <span>{item.tempatLahir || "-"}</span>
                                    <span className="text-muted-foreground">{item.tanggalLahir || "-"}</span>
                                </div>
                            </TableCell>
                            <TableCell>{item.kelas}</TableCell>
                            <TableCell>{item.jk}</TableCell>
                            <TableCell>{item.namaAyah || "-"}</TableCell>
                            <TableCell>{item.namaIbu || "-"}</TableCell>
                            <TableCell>{item.sekolah}</TableCell>
                            <TableCell>{item.npsn || "-"}</TableCell>
                            <TableCell className="text-right space-x-2 sticky right-0 bg-background shadow-sm">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                                    setFormData(item)
                                    setIsAddOpen(true)
                                }}><Edit className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => handleDelete(item.id, item.nama)}><Trash2 className="h-4 w-4" /></Button>
                            </TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
                </div>
            
            {/* Pagination Controls */}
            <div className="flex items-center justify-between py-4">
                <div className="text-sm text-muted-foreground">
                    Halaman {currentPage} (Menampilkan {paginatedStudents.length} dari {sortedStudents.length}{queryStatus === "CanLoadMore" ? "+" : ""} data)
                </div>
                <div className="flex items-center space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1 || queryStatus === "LoadingMore"}
                    >
                        Sebelumnya
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            if (currentPage * itemsPerPage >= sortedStudents.length && queryStatus === "CanLoadMore") {
                                loadMore(itemsPerPage);
                            }
                            setCurrentPage(p => p + 1);
                        }}
                        disabled={(queryStatus === "Exhausted" && currentPage * itemsPerPage >= sortedStudents.length) || queryStatus === "LoadingMore"}
                    >
                        {queryStatus === "LoadingMore" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Selanjutnya"}
                    </Button>
                </div>
            </div>
        </CardContent>
    </Card>

      <Dialog open={isAddOpen} onOpenChange={(open) => {
          setIsAddOpen(open)
          if (!open) {
              setFormData({ 
                  nisn: "", nama: "", kelas: "", sekolah: "", jk: "L",
                  nomorIndukMaarif: "", tempatLahir: "", tanggalLahir: "", alamat: "", kecamatan: "", nomorTelepon: "", namaWali: ""
              })
          }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle>{formData.id ? "Edit Data Siswa" : "Tambah Data Siswa"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                {/* Row 1: NISN, Nama, NIK */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="nisn">NISN <span className="text-red-500">*</span></Label>
                        <Input id="nisn" value={formData.nisn || ""} onChange={e => setFormData({...formData, nisn: e.target.value})} placeholder="NISN" />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="nama">Nama Lengkap <span className="text-red-500">*</span></Label>
                        <Input id="nama" value={formData.nama || ""} onChange={e => setFormData({...formData, nama: e.target.value})} placeholder="Nama Siswa" />
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="nik">NIK</Label>
                        <Input id="nik" value={formData.nik || ""} onChange={e => setFormData({...formData, nik: e.target.value})} placeholder="NIK Siswa" />
                    </div>
                </div>

                {/* Row 2: Tempat Lahir, Tanggal Lahir, Kelas */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="tempat_lahir">Tempat Lahir</Label>
                        <Input id="tempat_lahir" value={formData.tempatLahir || ""} onChange={e => setFormData({...formData, tempatLahir: e.target.value})} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="tanggal_lahir">Tanggal Lahir</Label>
                        <Input id="tanggal_lahir" type="date" value={formData.tanggalLahir || ""} onChange={e => setFormData({...formData, tanggalLahir: e.target.value})} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="kelas">Kelas</Label>
                        <Input id="kelas" value={formData.kelas || ""} onChange={e => setFormData({...formData, kelas: e.target.value})} placeholder="Contoh: 7A" />
                    </div>
                </div>

                {/* Row 3: Jenis Kelamin, Nama Ayah, Nama Ibu */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="jk">Jenis Kelamin</Label>
                        <Select value={formData.jk || "L"} onValueChange={(val: "L" | "P") => setFormData({...formData, jk: val})}>
                            <SelectTrigger id="jk">
                                <SelectValue placeholder="Pilih L/P" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="L">Laki-laki</SelectItem>
                                <SelectItem value="P">Perempuan</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="nama_ayah">Nama Ayah</Label>
                        <Input id="nama_ayah" value={formData.namaAyah || ""} onChange={e => setFormData({...formData, namaAyah: e.target.value})} />
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="nama_ibu">Nama Ibu</Label>
                        <Input id="nama_ibu" value={formData.namaIbu || ""} onChange={e => setFormData({...formData, namaIbu: e.target.value})} />
                    </div>
                </div>

                {/* Row 4: Asal Sekolah, NPSN */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="sekolah">Asal Sekolah</Label>
                         <Input 
                            id="sekolah" 
                            value={formData.sekolah || ""} 
                            onChange={e => setFormData({...formData, sekolah: e.target.value})} 
                            disabled={!!userUnit} 
                            placeholder={userUnit ? "Otomatis terisi" : "Nama Sekolah"} 
                        />
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="npsn">NPSN</Label>
                        <Input id="npsn" value={formData.npsn || ""} onChange={e => setFormData({...formData, npsn: e.target.value})} placeholder="NPSN Sekolah" />
                    </div>
                </div>

                {/* Additional Fields (Collapsed/Optional) */}
                 <div className="grid grid-cols-2 gap-4 border-t pt-4 mt-2">
                     <div className="grid gap-2">
                        <Label htmlFor="alamat">Alamat</Label>
                        <Input id="alamat" value={formData.alamat || ""} onChange={e => setFormData({...formData, alamat: e.target.value})} placeholder="Alamat Lengkap" />
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="nomor_telepon">No. Telepon</Label>
                        <Input id="nomor_telepon" value={formData.nomorTelepon || ""} onChange={e => setFormData({...formData, nomorTelepon: e.target.value})} />
                    </div>
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddOpen(false)}>Batal</Button>
                <Button onClick={handleAdd}>Simpan</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excel Import Modal */}
      <ExcelImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={loadStudents}
        title="Import Data Siswa"
        description="Upload file Excel (.xlsx) untuk import data siswa. Pastikan format sesuai template."
        onDownloadTemplate={handleDownloadTemplate}
        onFileImport={async (file) => {
          try {
             // 1. Parse Excel
             const data = await processStudentImport(file);
             if (data.length === 0) throw new Error("File kosong atau format salah.");
             
             // 2. Send to Backend
             const result = await bulkCreateStudentMutation({ students: data });
             
             // 3. Feedback
             toast.success(`Berhasil import ${result.count} data siswa!`);
          } catch (err: any) {
             console.error(err);
             throw new Error(err.message || "Gagal import data.");
          }
        }}
      />

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Konfirmasi Hapus
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-2">
              Yakin ingin menghapus siswa:
            </p>
            <p className="font-semibold text-lg mb-3">
              {studentToDelete?.name}
            </p>
            <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-2">
              <p className="text-sm text-red-800 font-medium flex items-center gap-2">
                ⚠️ Perhatian
              </p>
              <p className="text-xs text-red-700 mt-1">
                Data akan terhapus <strong>PERMANENT</strong> dari database dan tidak dapat dikembalikan!
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={cancelDelete}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Ya, Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
