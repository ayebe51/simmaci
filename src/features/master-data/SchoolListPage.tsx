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
import { Search, Plus, Trash2, Edit, FileSpreadsheet, Download, Eye, KeyRound, Copy } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import ExcelImportModal from "./components/ExcelImportModal"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PhoneInput } from "@/components/common/PhoneInput"
import SoftPageHeader from "@/components/ui/SoftPageHeader"
// 🔥 CONVEX REAL-TIME
import { useMutation, usePaginatedQuery } from "convex/react"
import { api as convexApi } from "../../../convex/_generated/api"
import { Doc, Id } from "../../../convex/_generated/dataModel"
import { toast } from "sonner" 
import { saveAs } from "file-saver" 
import * as XLSX from "xlsx" 

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
  // const [filterJamiyyah, setFilterJamiyyah] = useState("") // TODO: Add backend support

  // Credentials Dialog State
  const [credDialog, setCredDialog] = useState<{open: boolean, email?: string, password?: string}>({open: false});

  // 🔥 SERVER-SIDE PAGINATION
  const { results, status, loadMore } = usePaginatedQuery(
    convexApi.schools.paginatedList,
    { 
      searchTerm: searchTerm || undefined,
      kecamatan: filterKecamatan || undefined
    },
    { initialNumItems: 10 }
  );

  // Mutations
  const createSchoolMutation = useMutation(convexApi.schools.create)
  const updateSchoolMutation = useMutation(convexApi.schools.update)
  const deleteSchoolMutation = useMutation(convexApi.schools.remove)
  const bulkDeleteSchoolMutation = useMutation(convexApi.schools.bulkDelete)
  const bulkCreateSchoolMutation = useMutation(convexApi.schools.bulkCreate)
  const createAccount = useMutation(convexApi.schools.createSchoolAccount) // New mutation

  // Map Convex data to School interface
  const schools = (results || []).map((s: Doc<"schools">) => ({
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
    } catch { return null }
    return null
  })

  const [userStr] = useState(() => localStorage.getItem("user"))

  // Manual Add/Edit State
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [formData, setFormData] = useState<Partial<School>>({
      nsm: "", nama: "", npsn: "", alamat: "", kecamatan: "",
      kepala: "", noHpKepala: "", statusJamiyyah: "", akreditasi: ""
  })

  // Delete confirmation modal state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [schoolToDelete, setSchoolToDelete] = useState<{id: string, name: string} | null>(null)

  // Get unique kecamatan 
  const uniqueKecamatan = [
    "Cilacap Selatan", "Cilacap Tengah", "Cilacap Utara", "Kesugihan", "Adipala", "Maos", "Kroya", "Binangun", "Nusawungu", "Sampang", "Karangpucung", "Cimanggu", "Majenang", "Wanareja", "Dayeuhluhur", "Gandrungmangu", "Sidareja", "Kedungreja", "Patimuan", "Bantarsari", "Kawunganten", "Jeruklegi", "Kampung Laut", "Cipari"
  ].sort()

  const closeDialog = () => {
      setIsAddOpen(false)
      setIsEditMode(false)
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
             id: formData.id as Id<"schools">,
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
      } catch (error) {
          alert("Gagal menyimpan: " + (error as Error).message)
      }
  }

  const handleDelete = async (id: string, name: string) => {
      console.log('[DELETE] Button clicked for:', name, id)
      setSchoolToDelete({ id, name })
      setDeleteConfirmOpen(true)
  }

  const confirmDelete = async () => {
      if (!schoolToDelete) return
      
      try {
          console.log('[DELETE] Calling mutation for:', schoolToDelete.name)
          await deleteSchoolMutation({ id: schoolToDelete.id as Id<"schools"> })
          console.log('[DELETE] Success!')
          alert(`✅ Sekolah "${schoolToDelete.name}" berhasil dihapus!`)
          setDeleteConfirmOpen(false)
          setSchoolToDelete(null)
      } catch (error) {
          console.error('[DELETE] Error:', error)
          alert("❌ Gagal menghapus: " + (error as Error).message)
      }
  }

  const cancelDelete = () => {
      console.log('[DELETE] User cancelled')
      setDeleteConfirmOpen(false)
      setSchoolToDelete(null)
  }

  const handleDeleteAll = async () => {
      if (confirm(`PERHATIAN: Ini akan menghapus SEMUA ${schools.length} data sekolah!\n\nApakah Anda yakin?`)) {
          if (confirm("Konfirmasi sekali lagi - hapus semua data sekolah?")) {
              try {
                  const result = await bulkDeleteSchoolMutation({})
                  alert(`Berhasil menghapus ${result.count} sekolah!`)
              } catch (error) {
                  alert("Gagal menghapus: " + (error as Error).message)
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

  /* import moved to top */

// ... inside component ...

  const bulkCreateAccounts = useMutation(convexApi.schools.bulkCreateSchoolAccounts);

import * as XLSX from "xlsx"; // Ensure xlsx is installed

// ...

  const handleBulkGenerate = async () => {
      if (!confirm("Fitur ini akan membuatkan akun untuk SEMUA sekolah yang belum punya akun.\n\nPassword default: 123456\n\nLanjutkan?")) return;

      try {
          const results = await bulkCreateAccounts();
          
          // Prepare Data for Excel
          const data = results.map((r, i) => ({
              "No": i + 1,
              "NSM (Username)": r.nsm,
              "Nama Sekolah": r.nama,
              "Email Login": r.email,
              "Password Default": r.password,
              "Status Akun": r.status === "Created" ? "Baru Dibuat" : "Sudah Ada (Diupdate)"
          }));

          // Create Worksheet
          const worksheet = XLSX.utils.json_to_sheet(data);
          
          // Auto-width columns
          const max_width = data.reduce((w, r) => Math.max(w, r["Nama Sekolah"].length), 10);
          worksheet["!cols"] = [
              { wch: 5 }, // No
              { wch: 15 }, // NSM
              { wch: max_width + 5 }, // Nama
              { wch: 30 }, // Email
              { wch: 15 }, // Pass
              { wch: 20 } // Status
          ];

          // Create Workbook
          const workbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(workbook, worksheet, "Akun Sekolah");

          // Generate Buffer
          const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
          const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
          
          saveAs(blob, `Akun_Sekolah_Maarif_${new Date().toISOString().split('T')[0]}.xlsx`);
          
          toast.success(`Berhasil memproses ${results.length} akun sekolah!`);
      } catch (e: any) {
          toast.error("Gagal generate akun: " + e.message);
      }
  }

  const handleExport = async () => {
      alert("Fitur export data sekolah belum tersedia (gunakan export akun untuk data login).");
  }

  const handleGenerateAccount = async (school: any) => {
      if (!window.confirm(`Buat akun untuk sekolah ${school.nama}?`)) return;
      
      try {
          const res = await createAccount({ schoolId: school.id as Id<"schools"> });
          setCredDialog({ 
              open: true, 
              email: res.email, 
              password: res.password 
          });
          toast.success(res.message);
      } catch (error: any) {
          toast.error("Gagal membuat akun: " + error.message);
      }
  };

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      toast.success("Dicopy!");
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
          ...(userStr && ["super_admin", "admin"].includes(JSON.parse(userStr).role) ? [{
            label: 'Delete All',
            onClick: handleDeleteAll,
            variant: 'purple' as const,
            icon: <Trash2 className="h-5 w-5 text-gray-700" />
          }] : []),
          {
            label: 'Tambah Manual',
            onClick: openAdd,
            variant: 'cream',
            icon: <Plus className="h-5 w-5 text-gray-700" />
          },
          {
            label: 'Generate Akun',
            onClick: handleBulkGenerate,
            variant: 'purple', // Reusing purple since 'Delete All' is conditional/hidden for many
            icon: <KeyRound className="h-5 w-5 text-gray-700" />
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
                  placeholder="Cari nama sekolah..."
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
                  <SelectItem value="all">Semua Kecamatan</SelectItem>
                  {uniqueKecamatan.map(k => (
                    <SelectItem key={k} value={k}>{k}</SelectItem>
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
                      <TableHead>NSM</TableHead>
                      <TableHead>Nama Sekolah</TableHead>
                      <TableHead>Kecamatan</TableHead>
                      <TableHead>Kepala Sekolah</TableHead>
                      <TableHead>No. HP Kepala</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schools.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center">
                                {status === "LoadingFirstPage" ? "Memuat data..." : "Tidak ada data sekolah ditemukan."}
                            </TableCell>
                        </TableRow>
                    ) : (
                        schools.map((item) => (
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
                                {/* Check if user can edit this school */}
                                {(() => {
                                  const user = userStr ? JSON.parse(userStr) : null;
                                  const isOperator = user?.role === "operator";
                                  const canEdit = !isOperator || item.nama === userUnit;
                                  
                                  return (
                                    <>
                                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/dashboard/master/schools/${item.id}`)}><Eye className="h-4 w-4" /></Button>
                                      <Button 
                                          variant="ghost" 
                                          size="icon"
                                          className="h-8 w-8"
                                          title="Buat Akun Sekolah"
                                          onClick={() => handleGenerateAccount(item)}
                                          disabled={!canEdit}
                                      >
                                          <KeyRound className={`h-4 w-4 text-blue-500 ${!canEdit ? 'opacity-30' : ''}`} />
                                      </Button>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-8 w-8" 
                                        onClick={() => openEdit(item)}
                                        disabled={!canEdit}
                                        title={!canEdit ? "Tidak ada akses edit sekolah lain" : "Edit"}
                                      >
                                        <Edit className={`h-4 w-4 ${!canEdit ? 'opacity-30' : ''}`} />
                                      </Button>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-8 w-8 text-red-500 hover:text-red-700" 
                                        onClick={() => handleDelete(item.id, item.nama)}
                                        disabled={!canEdit}
                                        title={!canEdit ? "Tidak ada akses hapus sekolah lain" : "Hapus"}
                                      >
                                        <Trash2 className={`h-4 w-4 ${!canEdit ? 'opacity-30' : ''}`} />
                                      </Button>
                                    </>
                                  );
                                })()}
                            </TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
            </div>
            
            {/* Pagination Controls */}
            <div className="flex items-center justify-center space-x-2 py-4">
                {status === "CanLoadMore" && (
                    <Button onClick={() => loadMore(10)}>
                        Load More
                    </Button>
                )}
                {status === "LoadingMore" && (
                     <Button disabled>
                        Loading...
                    </Button>
                )}
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
            }).filter((s) => s.nsm && s.nama); // Only include valid entries

            // Use Convex bulk create
            const result = await bulkCreateSchoolMutation({ schools });
            alert(`Berhasil mengimpor ${result.count} dari ${schools.length} sekolah`)
          } catch (error) {
            alert("Gagal import: " + (error as Error).message)
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
              Yakin ingin menghapus sekolah:
            </p>
            <p className="font-semibold text-lg mb-3">
              {schoolToDelete?.name}
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
      
      {/* Credentials Dialog */}
      <Dialog open={credDialog.open} onOpenChange={(open) => setCredDialog(p => ({...p, open}))}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Akun Sekolah Berhasil Dibuat ✅</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium">Email Login</label>
                    <div className="flex gap-2">
                        <Input readOnly value={credDialog.email} />
                        <Button size="icon" variant="outline" onClick={() => copyToClipboard(credDialog.email || "")}>
                            <Copy className="h-4 w-4"/>
                        </Button>
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">Password Default</label>
                    <div className="flex gap-2">
                        <Input readOnly value={credDialog.password} />
                         <Button size="icon" variant="outline" onClick={() => copyToClipboard(credDialog.password || "")}>
                            <Copy className="h-4 w-4"/>
                        </Button>
                    </div>
                </div>
                <div className="bg-yellow-50 p-3 rounded-md border border-yellow-200 text-xs text-yellow-800">
                    Mohon simpan informasi ini. Password hanya ditampilkan sekali.
                </div>
            </div>
            <DialogFooter>
                <Button onClick={() => setCredDialog({open: false})}>Tutup</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
