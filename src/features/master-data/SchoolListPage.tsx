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
import { Plus, Search, Trash2, Edit, FileSpreadsheet, ArrowUpDown, ArrowUp, ArrowDown, Download, Eye } from "lucide-react"
import { useState, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import ExcelImportModal from "./components/ExcelImportModal"
import { api } from "@/lib/api"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PhoneInput } from "@/components/common/PhoneInput"
import SoftPageHeader from "@/components/ui/SoftPageHeader"
// 🔥 CONVEX REAL-TIME
import { useQuery, useMutation } from "convex/react"
import { api as convexApi } from "../../../convex/_generated/api"

interface School {
  id: string
  nsm: string
  npsn: string
  nama: string
  alamat: string
  kecamatan: string
  kepala: string
  noHpKepala?: string
  statusJamiyyah?: string // Afiliasi
  akreditasi?: string
}

export default function SchoolListPage() {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState("")
  const [filterKecamatan, setFilterKecamatan] = useState("")
  const [filterJamiyyah, setFilterJamiyyah] = useState("")
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)

  // 🔥 REAL-TIME CONVEX QUERY
  const convexSchools = useQuery(convexApi.schools.list, {
    kecamatan: filterKecamatan || undefined,
  })

  // Mutations
  const createSchoolMutation = useMutation(convexApi.schools.create)
  const updateSchoolMutation = useMutation(convexApi.schools.update)
  const deleteSchoolMutation = useMutation(convexApi.schools.remove)
  const bulkDeleteSchoolMutation = useMutation(convexApi.schools.bulkDelete)
  const bulkCreateSchoolMutation = useMutation(convexApi.schools.bulkCreate)

  // Map Convex data to School interface
  const schools = (convexSchools || []).map((s: any) => ({
    id: s._id,
    nsm: s.nsm || "",
    npsn: s.npsn || "",
    nama: s.nama || "",
    alamat: s.alamat || "",
    kecamatan: s.kecamatan || "",
    kepala: s.kepalaMadrasah || "",
    noHpKepala: s.telepon || "",
    statusJamiyyah: s.statusJamiyyah || "",
    akreditasi: s.akreditasi || "",
  }))

  const loadSchools = async () => {
    // No longer needed - Convex auto-updates!
  }


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

  // Manual Add/Edit State
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [formData, setFormData] = useState<Partial<School>>({
      nsm: "", npsn: "", nama: "", alamat: "", kecamatan: "", kepala: "", noHpKepala: "", statusJamiyyah: ""
  })

  const filtered = (schools || []).filter(s => {
    // 1. Role Filter
    if (userUnit && s.nama !== userUnit) return false

    // 2. Kecamatan Filter
    if (filterKecamatan && s.kecamatan !== filterKecamatan) return false

    // 3. Jamiyyah Filter
    if (filterJamiyyah && s.statusJamiyyah !== filterJamiyyah) return false

    // 4. Search Filter
    const term = searchTerm.toLowerCase()
    return (s.nama || "").toLowerCase().includes(term) || 
    (s.nsm || "").includes(searchTerm) ||
    (s.kecamatan || "").toLowerCase().includes(term)
  })

  // Get unique values for filters
  const uniqueKecamatan = useMemo(() => {
    const kecs = schools.map(s => s.kecamatan).filter(Boolean);
    return Array.from(new Set(kecs)).sort();
  }, [schools]);

  const uniqueJamiyyah = useMemo(() => {
    const jams = schools.map(s => s.statusJamiyyah).filter(Boolean);
    return Array.from(new Set(jams)).sort();
  }, [schools]);

  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: keyof School; direction: 'asc' | 'desc' } | null>(null);

  const sortedSchools = useMemo(() => {
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
  const totalPages = Math.ceil(sortedSchools.length / itemsPerPage)

  const paginatedSchools = sortedSchools.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
  )

  useEffect(() => {
      setCurrentPage(1)
  }, [searchTerm, sortConfig])

  // Sort Handler
  const requestSort = (key: keyof School) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };
  
  const getSortIcon = (name: keyof School) => {
      if (!sortConfig || sortConfig.key !== name) {
          return <ArrowUpDown className="ml-2 h-4 w-4" />
      }
      return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
  }

  const handleSave = async () => {
      if(!formData.nsm || !formData.nama) {
          alert("NSM dan Nama sekolah wajib diisi!")
          return
      }
      try {
        if(isEditMode && formData.id) {
           // Update via Convex
           await updateSchoolMutation({ 
             id: formData.id as any,
             nama: formData.nama,
             nsm: formData.nsm,
             npsn: formData.npsn,
             alamat: formData.alamat,
             kecamatan: formData.kecamatan,
             kepalaMadrasah: formData.kepala,
             telepon: formData.noHpKepala,
             statusJamiyyah: formData.statusJamiyyah,
           })
           alert("Berhasil update sekolah") 
        } else {
           // Create via Convex
           await createSchoolMutation({
             nsm: formData.nsm || "",
             nama: formData.nama || "",
             npsn: formData.npsn,
             alamat: formData.alamat,
             kecamatan: formData.kecamatan,
             kepalaMadrasah: formData.kepala,
             akreditasi: formData.akreditasi,
             statusJamiyyah: formData.statusJamiyyah,
             telepon: formData.noHpKepala,
           })
           alert("Berhasil menambah sekolah")
        }
        closeDialog()
      } catch (e: any) {
          alert("Gagal menyimpan: " + e.message)
      }
  }

  const handleDelete = async (id: string, name: string) => {
      console.log('[DELETE] Button clicked for:', name, id)
      if (confirm(`Yakin ingin menghapus sekolah "${name}"?`)) {
          try {
              console.log('[DELETE] Calling mutation...')
              await deleteSchoolMutation({ id: id as any })
              alert("Sekolah berhasil dihapus!")
          } catch (e: any) {
              console.error('[DELETE] Error:', e)
              alert("Gagal menghapus: " + e.message)
          }
      } else {
          console.log('[DELETE] User cancelled')
      }
  }

  const handleDeleteAll = async () => {
      if (confirm(`PERHATIAN: Ini akan menghapus SEMUA ${schools.length} data sekolah!\n\nApakah Anda yakin?`)) {
          if (confirm("Konfirmasi sekali lagi - hapus semua data sekolah?")) {
              try {
                  const result = await bulkDeleteSchoolMutation({})
                  alert(`Berhasil menghapus ${result.count} sekolah!`)
              } catch (e: any) {
                  alert("Gagal menghapus: " + e.message)
              }
          }
      }
  }

  const openAdd = () => {
      setIsEditMode(false)
      setFormData({ nsm: "", npsn: "", nama: "", alamat: "", kecamatan: "", kepala: "", noHpKepala: "", statusJamiyyah: "" })
      setIsAddOpen(true)
  }

  const openEdit = (item: School) => {
      setIsEditMode(true)
      setFormData(item)
      setIsAddOpen(true)
  }

  const closeDialog = () => {
      setIsAddOpen(false)
      setIsEditMode(false)
  }

  const handleExport = async () => {
    try {
      // DEPRECATED: This feature requires NestJS backend endpoint
      // TODO: Implement school export in Convex or remove this feature
      toast.error("Fitur export belum tersedia - sedang dalam pengembangan");
      return;
      
      /* Original code - commented out due to hardcoded localhost
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/master-data/schools/export', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sekolah-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      */
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Gagal export data sekolah');
    }
  }

  return (
    <div className="space-y-6">
      <SoftPageHeader
        title="Data Lembaga (Sekolah)"
        description="Manajemen data satuan pendidikan di lingkungan LP Ma'arif NU Cilacap"
        actions={[
          {
            label: 'Export Excel',
            onClick: handleExport,
            variant: 'mint' as const,
            icon: <Download className="h-5 w-5 text-gray-700" />
          },
          {
            label: 'Delete All',
            onClick: handleDeleteAll,
            variant: 'purple' as const,
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
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari nama sekolah, NSM, atau kecamatan..."
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

              <Select value={filterJamiyyah} onValueChange={setFilterJamiyyah}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Semua Status" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueJamiyyah.filter((j): j is string => Boolean(j)).map(j => (
                    <SelectItem key={j} value={j}>{j}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
        </CardHeader>
        <CardContent>
            <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead onClick={() => requestSort('nsm')} className="cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex items-center">NSM {getSortIcon('nsm')}</div>
                      </TableHead>
                      <TableHead onClick={() => requestSort('nama')} className="cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex items-center">Nama Sekolah {getSortIcon('nama')}</div>
                      </TableHead>
                      <TableHead onClick={() => requestSort('kecamatan')} className="cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex items-center">Kecamatan {getSortIcon('kecamatan')}</div>
                      </TableHead>
                      <TableHead onClick={() => requestSort('kepala')} className="cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex items-center">Kepala Sekolah {getSortIcon('kepala')}</div>
                      </TableHead>
                      <TableHead>No. HP Kepala</TableHead>
                      <TableHead onClick={() => requestSort('statusJamiyyah')} className="cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex items-center">Status {getSortIcon('statusJamiyyah')}</div>
                      </TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedSchools.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center">
                                Tidak ada data sekolah ditemukan.
                            </TableCell>
                        </TableRow>
                    ) : (
                        paginatedSchools.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.nsm}</TableCell>
                            <TableCell>
                                <div className="flex flex-col">
                                    <span className="font-medium">{item.nama}</span>
                                    <span className="text-xs text-muted-foreground">{item.alamat}</span>
                                </div>
                            </TableCell>
                            <TableCell>{item.kecamatan}</TableCell>
                            <TableCell>{item.kepala}</TableCell>
                            <TableCell>
                                <span className="text-sm">{item.noHpKepala || '-'}</span>
                            </TableCell>
                            <TableCell>{item.statusJamiyyah}</TableCell>
                            <TableCell className="text-right space-x-2">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/dashboard/master/schools/${item.id}`)}><Eye className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}><Edit className="h-4 w-4" /></Button>
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
                <DialogTitle>{isEditMode ? 'Edit' : 'Tambah'} Sekolah Manual</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="nsm" className="text-right">NSM/NSS</Label>
                    <Input id="nsm" className="col-span-3" value={formData.nsm} onChange={e => setFormData({...formData, nsm: e.target.value})} />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="npsn" className="text-right">NPSN</Label>
                    <Input id="npsn" className="col-span-3" value={formData.npsn} onChange={e => setFormData({...formData, npsn: e.target.value})} />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="nama" className="text-right">Nama Sekolah</Label>
                    <Input id="nama" className="col-span-3" value={formData.nama} onChange={e => setFormData({...formData, nama: e.target.value})} />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="alamat" className="text-right">Alamat</Label>
                    <Input id="alamat" className="col-span-3" value={formData.alamat} onChange={e => setFormData({...formData, alamat: e.target.value})} />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="kecamatan" className="text-right">Kecamatan</Label>
                    <Input id="kecamatan" className="col-span-3" value={formData.kecamatan} onChange={e => setFormData({...formData, kecamatan: e.target.value})} />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="kepala" className="text-right">Kepala Sekolah</Label>
                    <Input id="kepala" className="col-span-3" value={formData.kepala} onChange={e => setFormData({...formData, kepala: e.target.value})} />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="noHpKepala" className="text-right">No. HP Kepala</Label>
                    <div className="col-span-3">
                        <PhoneInput
                            value={formData.noHpKepala || ""}
                            onChange={(value) => setFormData({...formData, noHpKepala: value})}
                        />
                    </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="statusJamiyyah" className="text-right">Afiliasi</Label>
                    <Input id="statusJamiyyah" className="col-span-3" value={formData.statusJamiyyah} onChange={e => setFormData({...formData, statusJamiyyah: e.target.value})} placeholder="Jam'iyyah / Jama'ah" />
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
        onImportSuccess={loadSchools}
        title="Import Data Sekolah"
        description="Upload file Excel (.xlsx) untuk import data sekolah"
        onImport={async (data) => {
          try {
            // Helper: Extract kecamatan from alamat
            const extractKecamatan = (alamat: string): string | undefined => {
              if (!alamat) return undefined;
              
              // Common patterns: "Kec. Nama", "Kecamatan Nama", "Kec Nama"
              const patterns = [
                /(?:Kec\.?|Kecamatan)\s+([A-Za-z\s]+?)(?:,|$|\.|Kab)/i,
                /,\s*([A-Za-z\s]+?)\s*,/,  // Pattern: "..., Kecamatan, ..."
              ];
              
              for (const pattern of patterns) {
                const match = alamat.match(pattern);
                if (match && match[1]) {
                  return match[1].trim();
                }
              }
              return undefined;
            };

            // Parse Excel data to school format with flexible column mapping
            const schools = data.map((row: any) => {
              // Get all possible column values (case insensitive)
              const getColumn = (...names: string[]) => {
                for (const name of names) {
                  const value = row[name] || row[name.toLowerCase()] || row[name.toUpperCase()];
                  if (value) return String(value).trim();
                }
                return undefined;
              };

              const nsm = getColumn('NSM', 'Nsm', 'nsm', 'No NSM', 'NO. NSM');
              const nama = getColumn('Nama Madrasah', 'Nama', 'NAMA MADRASAH', 'Nama Sekolah', 'NAMA SEKOLAH', 'nama');
              const npsn = getColumn('NPSN', 'Npsn', 'npsn', 'No NPSN', 'NO. NPSN');
              const alamat = getColumn('Alamat', 'ALAMAT', 'alamat', 'Alamat Lengkap', 'Alamat Madrasah', 'Alamat lengkap madrasah');
              let kecamatan = getColumn('Kecamatan', 'KECAMATAN', 'kecamatan', 'Kec', 'KEC', 'Kec.');
              
              // If kecamatan is empty, try to extract from alamat
              if (!kecamatan && alamat) {
                kecamatan = extractKecamatan(alamat);
              }

              const telepon = getColumn(
                'No. HP Kepala', 'No HP Kepala', 'No. Hp Kepala Madrasah', 'Nomor HP Kepala',
                'Telepon', 'TELEPON', 'HP', 'No HP', 'NO. HP', 'Nomor HP'
              );
              const kepalaMadrasah = getColumn(
                'Kepala Madrasah', 'KEPALA MADRASAH', 'Kepala Sekolah', 'Kepala', 
                'Nama Kepala', 'Nama Kepala Madrasah', 'Nama Kepsek'
              );
              const statusJamiyyah = getColumn(
                'Status', 'STATUS', 'status', 'Afiliasi', 'AFILIASI', 'Status Jamiyyah'
              );
              const akreditasi = getColumn(
                'Akreditasi', 'AKREDITASI', 'akreditasi', 'Status Akreditasi'
              );

              return {
                nsm: nsm || '',
                nama: nama || '',
                npsn,
                alamat,
                kecamatan,
                telepon,
                kepalaMadrasah,
                statusJamiyyah,
                akreditasi,
              };
            }).filter((s: any) => s.nsm && s.nama); // Only include valid entries

            // Use Convex bulk create
            const result = await bulkCreateSchoolMutation({ schools });
            alert(`Berhasil mengimpor ${result.count} dari ${schools.length} sekolah`)
          } catch (e: any) {
            alert("Gagal import: " + e.message)
          }
        }}
      />
    </div>
  )
}
