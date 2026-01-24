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
import { Plus, Search, Trash2, Edit, ArrowUpDown, ArrowUp, ArrowDown, Download, FileSpreadsheet } from "lucide-react"
import { useState, useEffect, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api } from "@/lib/api"
import SoftPageHeader from "@/components/ui/SoftPageHeader"
import ExcelImportModal from "./components/ExcelImportModal"
// 🔥 CONVEX REAL-TIME
import { useQuery, useMutation } from "convex/react"
import { api as convexApi } from "../../../convex/_generated/api"

interface Student {
  id: string
  nisn: string
  nama: string
  kelas: string
  sekolah: string
  jk: "L" | "P"
}

export default function StudentListPage() {
  const [searchTerm, setSearchTerm] = useState("")
  
  // Manual Add Logic
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [formData, setFormData] = useState<Partial<Student>>({
      nisn: "", nama: "", kelas: "", sekolah: "", jk: "L"
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

  // 🔥 REAL-TIME CONVEX QUERY
  const convexStudents = useQuery(convexApi.students.list, {
    namaSekolah: userUnit || undefined,
  })

  // Map Convex data to Student interface
  const students = (convexStudents || []).map((s: any) => ({
    id: s._id,
    nisn: s.nisn || "",
    nama: s.nama || "",
    kelas: s.kelas || "",
    sekolah: s.namaSekolah || "",
    jk: s.jenisKelamin === "Perempuan" ? "P" : "L",
  }))

  // Convex mutations
  const deleteStudentMutation = useMutation(convexApi.students.remove)

  // Delete confirmation modal state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [studentToDelete, setStudentToDelete] = useState<{id: string, name: string} | null>(null)

  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: keyof Student; direction: 'asc' | 'desc' } | null>(null);

  const loadStudents = async () => {
    // No longer needed - Convex auto-updates!
    // Kept for compatibility
  }


  const filtered = students.filter(s => {
    // 1. Role Filter
    if (userUnit && s.sekolah !== userUnit) return false

    return s.nama.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.nisn.includes(searchTerm) ||
    s.sekolah.toLowerCase().includes(searchTerm.toLowerCase())
  })

  const sortedStudents = useMemo(() => {
    const sortableItems = [...filtered];
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
  }, [filtered, sortConfig]);

  // Pagination Logic
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const totalPages = Math.ceil(sortedStudents.length / itemsPerPage)

  const paginatedStudents = sortedStudents.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
  )

  useEffect(() => {
      setCurrentPage(1)
  }, [searchTerm, sortConfig])

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

  const handleAdd = async () => {
      if (!formData.nama || !formData.nisn) {
          alert("Nama dan NISN wajib diisi")
          return
      }
      
      try {
          // TODO: Implement createStudent API
          alert("Fitur tambah siswa belum diimplementasikan di backend")
          // await api.createStudent(formData)
          // loadStudents()
          setIsAddOpen(false)
          setFormData({ nisn: "", nama: "", kelas: "", sekolah: "", jk: "L" })
      } catch (e) {
          alert("Gagal menambah siswa")
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
          alert(`✅ Siswa "${studentToDelete.name}" berhasil dihapus!`)
          setDeleteConfirmOpen(false)
          setStudentToDelete(null)
      } catch (e: any) {
          console.error('Delete error:', e)
          alert("❌ Gagal menghapus siswa: " + e.message)
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
          alert("Gagal mengexport data.")
      }
  }

  const downloadTemplate = async () => {
      try {
          const blob = await api.downloadStudentTemplate();
          const url = window.URL.createObjectURL(new Blob([blob]));
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', 'TEMPLATE_IMPORT_DATA_SISWA.xlsx');
          document.body.appendChild(link);
          link.click();
          link.parentNode?.removeChild(link);
          window.URL.revokeObjectURL(url);
      } catch (error) {
          console.error('Failed to download template:', error);
          alert('Gagal mendownload template. Silakan coba lagi.');
      }
  }

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
            label: 'Download Template',
            onClick: downloadTemplate,
            variant: 'purple',
            icon: <FileSpreadsheet className="h-5 w-5 text-gray-700" />
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
            <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead onClick={() => requestSort('nisn')} className="cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex items-center">NISN {getSortIcon('nisn')}</div>
                      </TableHead>
                      <TableHead onClick={() => requestSort('nama')} className="cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex items-center">Nama Lengkap {getSortIcon('nama')}</div>
                      </TableHead>
                      <TableHead onClick={() => requestSort('jk')} className="cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex items-center">L/P {getSortIcon('jk')}</div>
                      </TableHead>
                      <TableHead onClick={() => requestSort('kelas')} className="cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex items-center">Kelas {getSortIcon('kelas')}</div>
                      </TableHead>
                      <TableHead onClick={() => requestSort('sekolah')} className="cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex items-center">Asal Sekolah {getSortIcon('sekolah')}</div>
                      </TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedStudents.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center">
                                Tidak ada data siswa ditemukan.
                            </TableCell>
                        </TableRow>
                    ) : (
                        paginatedStudents.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.nisn}</TableCell>
                            <TableCell>{item.nama}</TableCell>
                            <TableCell>{item.jk}</TableCell>
                            <TableCell>{item.kelas}</TableCell>
                            <TableCell>{item.sekolah}</TableCell>
                            <TableCell className="text-right space-x-2">
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
            <div className="flex items-center justify-end space-x-2 py-4">
                <div className="flex-1 text-sm text-muted-foreground">
                    Halaman {currentPage} dari {totalPages} ({filtered.length} data)
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
        </CardContent>
    </Card>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Tambah Data Siswa</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="nisn" className="text-right">NISN</Label>
                    <Input id="nisn" className="col-span-3" value={formData.nisn} onChange={e => setFormData({...formData, nisn: e.target.value})} />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="nama" className="text-right">Nama</Label>
                    <Input id="nama" className="col-span-3" value={formData.nama} onChange={e => setFormData({...formData, nama: e.target.value})} />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="jk" className="text-right">Jenis Kelamin</Label>
                    <Select value={formData.jk} onValueChange={(val: "L" | "P") => setFormData({...formData, jk: val})}>
                        <SelectTrigger id="jk" className="col-span-3">
                            <SelectValue placeholder="Pilih L/P" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="L">Laki-laki</SelectItem>
                            <SelectItem value="P">Perempuan</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="kelas" className="text-right">Kelas</Label>
                    <Input id="kelas" className="col-span-3" value={formData.kelas} onChange={e => setFormData({...formData, kelas: e.target.value})} />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="sekolah" className="text-right">Asal Sekolah</Label>
                    <Input id="sekolah" className="col-span-3" value={formData.sekolah} onChange={e => setFormData({...formData, sekolah: e.target.value})} />
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
        description="Upload file Excel (.xlsx) untuk import data siswa"
        onFileImport={async (file) => {
          await api.importStudents(file)
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
