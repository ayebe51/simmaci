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
import { Plus, Search, Edit, BadgeCheck, UserMinus, UserCheck, Archive, FileSpreadsheet, ArrowUpDown, ArrowUp, ArrowDown, Check, X, Download, Trash2 } from "lucide-react"
import { useState, useEffect, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import ExcelImportModal from "./components/ExcelImportModal"
import { api } from "@/lib/api"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import SoftPageHeader from "@/components/ui/SoftPageHeader"
// 🔥 CONVEX REAL-TIME
import { useQuery, useMutation } from "convex/react"
import { api as convexApi } from "../../../convex/_generated/api"


interface Teacher {
  id: string
  nuptk: string
  nama: string
  status: string
  mapel: string
  satminkal: string
  phoneNumber?: string
  isCertified: boolean
  isActive: boolean
  pdpkpnu: string
  kecamatan?: string
  birthPlace?: string
  birthDate?: string
}

export default function TeacherListPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterKecamatan, setFilterKecamatan] = useState("")
  const [filterCertified, setFilterCertified] = useState("all") // all, true, false
  
  // 🔥 REAL-TIME CONVEX QUERY - Auto-updates!
  const convexTeachers = useQuery(convexApi.teachers.list, {
    unitKerja: filterKecamatan || undefined,
    kecamatan: filterKecamatan || undefined,
    isCertified: filterCertified,
  })

  // Mutations for real-time updates
  const updateTeacherMutation = useMutation(convexApi.teachers.update)
  const removeTeacherMutation = useMutation(convexApi.teachers.remove)
  const bulkDeleteTeacherMutation = useMutation(convexApi.teachers.bulkDelete)
  const createTeacherMutation = useMutation(convexApi.teachers.create)
  const bulkCreateMutation = useMutation(convexApi.teachers.bulkCreate)

  // Toggle status confirmation modal state
  const [toggleConfirmOpen, setToggleConfirmOpen] = useState(false)
  const [teacherToToggle, setTeacherToToggle] = useState<{id: string, name: string, currentStatus: boolean} | null>(null)

  // Map Convex data to existing Teacher interface
  const teachers = (convexTeachers || []).map((t: any) => ({
    id: t._id,
    nuptk: t.nuptk || "",
    nama: t.nama || "",
    status: t.status || "",
    mapel: t.mapel || "",
    satminkal: t.unitKerja || "",
    phoneNumber: t.phoneNumber,
    isCertified: t.isCertified || false,
    isActive: t.isActive !== false,
    pdpkpnu: t.pdpkpnu || "Belum",
    kecamatan: t.kecamatan,
    birthPlace: t.tempatLahir,
    birthDate: t.tanggalLahir,
  }))

  const [activeFilter, setActiveFilter] = useState("active") // active, inactive, all
  const [isImportModalOpen, setIsImportModalOpen] = useState(false) // Import modal state

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

  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: keyof Teacher; direction: 'asc' | 'desc' } | null>(null);

  // Note: loadTeachers now handled by Convex real-time query!
  const loadTeachers = async () => {
    // No longer needed - Convex auto-updates!
    // Kept for Excel import success callback compatibility
  }


  const toggleStatus = async (id: string, currentStatus: boolean, name: string) => {
    setTeacherToToggle({ id, name, currentStatus })
    setToggleConfirmOpen(true)
  }

  const confirmToggle = async () => {
    if (!teacherToToggle) return
    const newStatus = !teacherToToggle.currentStatus
    
    try {
      await updateTeacherMutation({ 
        id: teacherToToggle.id as any, 
        isActive: newStatus 
      })
      const action = newStatus ? "diaktifkan" : "dinonaktifkan"
      alert(`✅ Guru "${teacherToToggle.name}" berhasil ${action}!`)
      setToggleConfirmOpen(false)
      setTeacherToToggle(null)
    } catch (error: any) {
      alert("❌ Gagal mengubah status: " + error.message)
    }
  }

  const cancelToggle = () => {
    setToggleConfirmOpen(false)
    setTeacherToToggle(null)
  }

  const filtered = useMemo(() => teachers.filter(t => {
      // 1. Role Filter
      if (userUnit && t.satminkal?.toLowerCase() !== userUnit.toLowerCase()) return false

      // 2. Active Status Filter
      if (activeFilter === "active" && !t.isActive) return false
      if (activeFilter === "inactive" && t.isActive) return false

      // 3. Search Filter
      const term = searchTerm.toLowerCase()
      return (t.nama || "").toLowerCase().includes(term) || (t.nuptk || "").toLowerCase().includes(term)
  }), [teachers, userUnit, activeFilter, searchTerm])

  // Get unique kecamatan for filter dropdown
  const uniqueKecamatan = useMemo(() => {
    const kecs = teachers.map(t => t.kecamatan).filter(Boolean);
    return Array.from(new Set(kecs)).sort();
  }, [teachers]);

  const sortedTeachers = useMemo(() => {
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
          return sortConfig.direction === 'asc' ? 1 : 1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [filtered, sortConfig]);

  // Pagination Logic
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const totalPages = Math.ceil(sortedTeachers.length / itemsPerPage)

  const paginatedTeachers = sortedTeachers.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
  )

  useEffect(() => {
      setCurrentPage(1)
  }, [searchTerm, activeFilter, sortConfig])

  // Sort Handler
  const requestSort = (key: keyof Teacher) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };
  
  const getSortIcon = (name: keyof Teacher) => {
      if (!sortConfig || sortConfig.key !== name) {
          return <ArrowUpDown className="ml-2 h-4 w-4" />
      }
      return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
  }

  const getStatusColor = (status: string) => {
      switch(status) {
          case "PNS": return "bg-blue-100 text-blue-800 hover:bg-blue-100"
          case "GTY": return "bg-green-100 text-green-800 hover:bg-green-100"
          default: return "bg-slate-100 text-slate-800 hover:bg-slate-100"
      }
  }

  // Manual Add/Edit Logic
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [formData, setFormData] = useState<Partial<Teacher>>({
      nama: "", nuptk: "", status: "GTY", satminkal: "", mapel: "", phoneNumber: "", birthPlace: "", birthDate: ""
  })

  const handleSave = async () => {
      if(!formData.nama) {
          alert("Nama wajib diisi!")
          return
      }

      try {
        console.log("[DEBUG] formData before payload:", formData);
        const payload = {
            nuptk: String(formData.nuptk || `TMP-${Date.now()}`),
            nama: String(formData.nama || ""),
            status: formData.status || undefined,
            unitKerja: formData.satminkal || undefined,
            mapel: formData.mapel || undefined,
            phoneNumber: formData.phoneNumber || undefined,
            pdpkpnu: formData.pdpkpnu || undefined,
            tempatLahir: formData.birthPlace || undefined,
            tanggalLahir: formData.birthDate || undefined,
            isActive: true,
        }
        console.log("[DEBUG] Payload being sent:", payload);

        if (isEditMode && formData.id) {
            // 🔥 Update via Convex
            await updateTeacherMutation({ 
              id: formData.id as any,
              ...payload
            })
            alert("Berhasil memperbarui data guru")
        } else {
            // 🔥 Create via Convex
            await createTeacherMutation(payload)
            alert("Berhasil menambah guru")
        }
        
        // Convex auto-updates UI, but close dialog
        closeDialog()
      } catch (e) {
          console.error("Save error:", e)
          alert("Gagal menyimpan guru")
      }
  }

  const openAdd = () => {
      setIsEditMode(false)
      setFormData({ nuptk: "", nama: "", status: "", satminkal: "", mapel: "", phoneNumber: "", birthPlace: "", birthDate: "" })
      setIsAddOpen(true)
  }

  const openEdit = (teacher: Teacher) => {
      setIsEditMode(true)
      setFormData(teacher)
      setIsAddOpen(true)
  }

  const closeDialog = () => {
      setIsAddOpen(false)
      setIsEditMode(false)
      setFormData({ nuptk: "", nama: "", status: "", satminkal: "", mapel: "", phoneNumber: "", birthPlace: "", birthDate: "" })
  }

  const handleExport = async () => {
      try {
          const blob = await api.exportTeachers(
              userUnit || undefined, 
              filterKecamatan || undefined, 
              filterCertified
          )
          const url = window.URL.createObjectURL(new Blob([blob]));
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', `Data_Guru_${new Date().toISOString().split('T')[0]}.xlsx`);
          document.body.appendChild(link);
          link.click();
          link.parentNode?.removeChild(link);
      } catch (e: any) {
          console.error(e)
          alert("Gagal mengexport data.")
      }
  }

  const handleDeleteAll = async () => {
      if (confirm(`PERHATIAN: Ini akan menghapus SEMUA ${teachers.length} data guru!\n\nApakah Anda yakin?`)) {
          if (confirm("Konfirmasi sekali lagi - hapus semua data guru?")) {
              try {
                  const result = await bulkDeleteTeacherMutation({})
                  alert(`Berhasil menghapus ${result.count} guru!`)
              } catch (e: any) {
                  alert("Gagal menghapus: " + e.message)
              }
          }
      }
  }

  return (
    <div className="space-y-6">
      <SoftPageHeader
        title="Data Guru & Tenaga Kependidikan"
        description="Manajemen data guru dan tenaga kependidikan di lingkungan LP Ma'arif NU Cilacap"
        actions={[
          {
            label: 'Export Excel',
            onClick: handleExport,
            variant: 'mint',
            icon: <Download className="h-5 w-5 text-gray-700" />
          },
          {
            label: 'Delete All',
            onClick: handleDeleteAll,
            variant: 'purple',
            icon: <Trash2 className="h-5 w-5 text-gray-700" />
          },
          {
            label: 'Tambah Manual',
            onClick: openAdd,
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
            <div className="flex flex-col gap-4">
                {/* Search and Filters Row */}
                <div className="flex flex-col sm:flex-row gap-2">
                   <div className="relative flex-1 min-w-[200px]">
                       <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                       <Input
                           placeholder="Cari nama atau unit kerja..."
                           className="pl-9"
                           value={searchTerm}
                           onChange={(e) => setSearchTerm(e.target.value)}
                       />
                   </div>
                   
                   <Select value={filterKecamatan} onValueChange={setFilterKecamatan}>
                       <SelectTrigger className="w-full sm:w-[180px]">
                           <SelectValue placeholder="Semua Kecamatan" />
                       </SelectTrigger>
                       <SelectContent>
                           {uniqueKecamatan.filter((k): k is string => Boolean(k)).map(k => (
                               <SelectItem key={k} value={k}>{k}</SelectItem>
                           ))}
                       </SelectContent>
                   </Select>

                   <Select value={filterCertified} onValueChange={setFilterCertified}>
                       <SelectTrigger className="w-full sm:w-[150px]">
                           <SelectValue placeholder="Sertifikasi" />
                       </SelectTrigger>
                       <SelectContent>
                           <SelectItem value="all">Semua Status</SelectItem>
                           <SelectItem value="true">Sertifikasi</SelectItem>
                           <SelectItem value="false">Belum Sertifikasi</SelectItem>
                       </SelectContent>
                   </Select>
                </div>

                {/* Tabs Row - Separate for clarity */}
                <Tabs value={activeFilter} onValueChange={setActiveFilter}>
                   <TabsList className="grid w-full grid-cols-3 max-w-md">
                       <TabsTrigger value="active">Aktif</TabsTrigger>
                       <TabsTrigger value="inactive">Non-Aktif / Resign</TabsTrigger>
                       <TabsTrigger value="all">Semua</TabsTrigger>
                   </TabsList>
                </Tabs>
           </div>
        </CardHeader>
        <CardContent>
            <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead onClick={() => requestSort('nuptk')} className="cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex items-center">Nomor Induk {getSortIcon('nuptk')}</div>
                      </TableHead>
                      <TableHead onClick={() => requestSort('nama')} className="cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex items-center">Nama {getSortIcon('nama')}</div>
                      </TableHead>
                      <TableHead onClick={() => requestSort('status')} className="cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex items-center">Status {getSortIcon('status')}</div>
                      </TableHead>
                      <TableHead onClick={() => requestSort('isCertified')} className="cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex items-center">Sertifikasi {getSortIcon('isCertified')}</div>
                      </TableHead>
                      <TableHead onClick={() => requestSort('pdpkpnu')} className="cursor-pointer hover:bg-muted/50 transition-colors text-center">
                          <div className="flex items-center justify-center">PDPKPNU {getSortIcon('pdpkpnu')}</div>
                      </TableHead>
                      <TableHead onClick={() => requestSort('satminkal')} className="cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex items-center">Satminkal {getSortIcon('satminkal')}</div>
                      </TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedTeachers.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center">
                                Tidak ada data guru ditemukan.
                            </TableCell>
                        </TableRow>
                    ) : (
                        paginatedTeachers.map((item) => (
                          <TableRow key={item.id} className={!item.isActive ? "bg-slate-50 opacity-60" : ""}>
                            <TableCell className="font-medium">{item.nuptk}</TableCell>
                            <TableCell>
                                <div className="flex flex-col">
                                    <span className="font-medium">{item.nama}</span>
                                    {!item.isActive && <span className="text-xs text-red-500 font-bold flex items-center mt-1"><Archive className="h-3 w-3 mr-1"/> NON-AKTIF</span>}
                                </div>
                            </TableCell>
                            <TableCell>
                                <Badge className={getStatusColor(item.status)} variant="secondary">
                                    {item.status}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                {item.isCertified ? (
                                    <div className="flex items-center text-green-600 text-xs">
                                        <BadgeCheck className="mr-1 h-3 w-3" /> Sertifikasi
                                    </div>
                                ) : item.status === 'PNS' ? (
                                    <span className="text-xs text-muted-foreground">-</span>
                                ) : (
                                    <Badge variant="outline" className="text-xs">
                                        Honorer
                                    </Badge>
                                )}
                            </TableCell>
                            <TableCell className="text-center">
                                {item.pdpkpnu === 'Sudah' ? (
                                    <div className="flex justify-center text-green-600">
                                        <Check className="h-5 w-5" />
                                    </div>
                                ) : (
                                    <div className="flex justify-center text-red-500">
                                        <X className="h-5 w-5" />
                                    </div>
                                )}
                            </TableCell>
                            <TableCell>{item.satminkal}</TableCell>
                            <TableCell className="text-right space-x-2">
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-amber-600 hover:text-amber-800"
                                    onClick={() => toggleStatus(item.id, item.isActive, item.nama)}
                                    title={item.isActive ? "Non-Aktifkan" : "Aktifkan Kembali"}
                                >
                                    {item.isActive ? <UserMinus className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-800" onClick={() => openEdit(item)}><Edit className="h-4 w-4" /></Button>
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
                <DialogTitle>{isEditMode ? 'Edit' : 'Tambah'} Guru Manual</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="nama" className="text-right">Nama</Label>
                    <Input id="nama" className="col-span-3" value={formData.nama || ""} onChange={e => setFormData({...formData, nama: e.target.value})} />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="nuptk" className="text-right">Nomor Induk Ma'arif</Label>
                    <Input id="nuptk" className="col-span-3" value={formData.nuptk || ""} onChange={e => setFormData({...formData, nuptk: e.target.value})} placeholder="NUPTK 16 digit atau NIM Ma'arif" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="status" className="text-right">Status</Label>
                    <Input id="status" className="col-span-3" value={formData.status || ""} onChange={e => setFormData({...formData, status: e.target.value})} placeholder="PNS / GTY / GTT" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="satminkal" className="text-right">Satminkal</Label>
                    <Input id="satminkal" className="col-span-3" value={formData.satminkal || ""} onChange={e => setFormData({...formData, satminkal: e.target.value})} placeholder="Nama satuan pendidikan" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="phoneNumber" className="text-right">Nomor HP</Label>
                    <Input id="phoneNumber" className="col-span-3" value={formData.phoneNumber || ""} onChange={e => setFormData({...formData, phoneNumber: e.target.value})} placeholder="081234567890" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="pdpkpnu" className="text-right">PDPKPNU</Label>
                    <Input id="pdpkpnu" className="col-span-3" value={formData.pdpkpnu || ""} onChange={e => setFormData({...formData, pdpkpnu: e.target.value})} placeholder="Sudah / Belum" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="birthPlace" className="text-right">Tempat Lahir</Label>
                    <Input id="birthPlace" className="col-span-3" value={formData.birthPlace || ""} onChange={e => setFormData({...formData, birthPlace: e.target.value})} placeholder="Contoh: Cilacap" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="birthDate" className="text-right">Tanggal Lahir</Label>
                    <Input id="birthDate" type="date" className="col-span-3" value={formData.birthDate || ""} onChange={e => setFormData({...formData, birthDate: e.target.value})} />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={closeDialog}>Batal</Button>
                <Button onClick={handleSave}>Simpan</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excel Import Modal */}
      <ExcelImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={loadTeachers}
        title="Import Data Guru"
        description="Upload file Excel (.xlsx) untuk import data guru"
        onFileImport={async (file) => {
          // Parse Excel file client-side
          const XLSX = await import('xlsx')
          const data = await file.arrayBuffer()
          const workbook = XLSX.read(data)
          const worksheet = workbook.Sheets[workbook.SheetNames[0]]
          const jsonData = XLSX.utils.sheet_to_json(worksheet)
          
          // Map Excel columns to Convex schema with improved status/certification detection
          const teachers = jsonData.map((row: any) => {
            // Parse TMT (Tanggal Mulai Tugas) to calculate GTY status
            let detectedStatus = row.Status || row.status || row.STATUS || "GTY"
            const tmt = row.TMT || row.tmt || row['Tanggal Mulai Tugas']
            
            if (tmt && !row.Status) {
              try {
                const tmtDate = new Date(tmt)
                const yearsOfService = (Date.now() - tmtDate.getTime()) / (1000 * 60 * 60 * 24 * 365)
                if (yearsOfService >= 2) {
                  detectedStatus = "GTY" // Guru Tetap Yayasan
                }
              } catch (e) {
                console.warn('Failed to parse TMT:', tmt)
              }
            }
            
            // Parse certification - check multiple columns
            let isCertified = false
            const certColumn = row.Sertifikasi || row.sertifikasi || row.SERTIFIKASI || 
                              row['Status Sertifikasi'] || row.isCertified
            
            if (typeof certColumn === 'boolean') {
              isCertified = certColumn
            } else if (typeof certColumn === 'string') {
              const normalized = certColumn.toLowerCase().trim()
              isCertified = normalized === 'ya' || normalized === 'sudah' || 
                           normalized === 'true' || normalized === '1' ||
                           normalized === 'sertifikasi'
            } else if (typeof certColumn === 'number') {
              isCertified = certColumn === 1
            }
            
            return {
              nuptk: String(row.NUPTK || row.nuptk || row.NIM || `TMP-${Date.now()}-${Math.random()}`),
              nama: String(row.Nama || row.nama || row.NAMA || "Unnamed"),
              nip: row.NIP || row.nip || undefined,
              jenisKelamin: row['Jenis Kelamin'] || row.jenisKelamin || row.JK || undefined,
              tempatLahir: row['Tempat Lahir'] || row.tempatLahir || undefined,
              tanggalLahir: row['Tanggal Lahir'] || row.tanggalLahir || undefined,
              pendidikanTerakhir: row['Pendidikan Terakhir'] || row.pendidikan || row.Pendidikan || undefined,
              unitKerja: (row['Unit Kerja'] || row.unitKerja || row.UNIT_KERJA ||
                         row.satminkal || row.Satminkal || row.SATMINKAL ||
                         row['Satuan Pendidikan'] || row.sekolah || row.Sekolah) || undefined,
              status: detectedStatus,
              mapel: row.Mapel || row.mapel || row.MAPEL || undefined,
              kecamatan: row.Kecamatan || row.kecamatan || row.KECAMATAN || undefined,
              phoneNumber: row['No HP'] || row.phoneNumber || row['Nomor HP'] || undefined,
              email: row.Email || row.email || row.EMAIL || undefined,
              pdpkpnu: row.PDPKPNU || row.pdpkpnu || undefined,
              isCertified: isCertified,
            }
          })
          
          console.log('[IMPORT] Parsed teachers:', teachers.length)
          console.log('[IMPORT] Sample:', teachers[0])
          
          try {
            // Call Convex bulkCreate mutation
            const result = await bulkCreateMutation({ teachers })
            alert(`✅ Berhasil mengimport ${result.count} dari ${teachers.length} data guru!`)
          } catch (error: any) {
            console.error('[IMPORT ERROR]', error)
            alert(`❌ Gagal import: ${error.message || 'Unknown error'}`)
          }
        }}
      />

      {/* Toggle Status Confirmation Modal */}
      <Dialog open={toggleConfirmOpen} onOpenChange={setToggleConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              {teacherToToggle?.currentStatus ? <UserMinus className="h-5 w-5" /> : <UserCheck className="h-5 w-5" />}
              Konfirmasi {teacherToToggle?.currentStatus ? "Non-Aktifkan" : "Aktifkan"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-2">
              Yakin ingin {teacherToToggle?.currentStatus ? "menonaktifkan" : "mengaktifkan kembali"} guru:
            </p>
            <p className="font-semibold text-lg mb-3">
              {teacherToToggle?.name}
            </p>
            <div className={`${teacherToToggle?.currentStatus ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'} border rounded-md p-3 mb-2`}>
              <p className={`text-sm font-medium flex items-center gap-2 ${teacherToToggle?.currentStatus ? 'text-amber-800' : 'text-green-800'}`}>
                {teacherToToggle?.currentStatus ? '⚠️' : '✅'} {teacherToToggle?.currentStatus ? 'Perhatian' : 'Informasi'}
              </p>
              <p className={`text-xs mt-1 ${teacherToToggle?.currentStatus ? 'text-amber-700' : 'text-green-700'}`}>
                {teacherToToggle?.currentStatus 
                  ? 'Guru akan dinonaktifkan dan tidak akan muncul di laporan aktif.'
                  : 'Guru akan diaktifkan kembali dan muncul di laporan aktif.'}
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={cancelToggle}
            >
              Batal
            </Button>
            <Button
              variant={teacherToToggle?.currentStatus ? "destructive" : "default"}
              onClick={confirmToggle}
              className={teacherToToggle?.currentStatus ? "bg-amber-600 hover:bg-amber-700" : "bg-green-600 hover:bg-green-700"}
            >
              {teacherToToggle?.currentStatus ? <UserMinus className="h-4 w-4 mr-2" /> : <UserCheck className="h-4 w-4 mr-2" />}
              Ya, {teacherToToggle?.currentStatus ? "Non-Aktifkan" : "Aktifkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
