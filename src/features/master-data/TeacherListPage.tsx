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
import { Plus, Search, Edit, BadgeCheck, Archive, FileSpreadsheet, Download, Trash2, UserCheck, UserMinus, Loader2, Smartphone, X, Wand2, AlertTriangle, CheckCircle, XCircle } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { useState, useMemo, useEffect } from "react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import SoftPageHeader from "@/components/ui/SoftPageHeader"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
// 🔥 CONVEX REAL-TIME
import { useQuery, useMutation, usePaginatedQuery, useConvex } from "convex/react"
import { api as convexApi } from "../../../convex/_generated/api"
import ExcelImportModal from "./components/ExcelImportModal"
import { api } from "@/lib/api"
import { Id } from "../../../convex/_generated/dataModel"
import TeacherPhotoUpload from "./components/TeacherPhotoUpload"
import KtaCard from "./components/KtaCard"
import BroadcastModal from "./components/BroadcastModal"

interface Teacher {
  id: string
  nuptk?: string
  nomorIndukMaarif?: string
  nama: string
  status?: string
  mapel: string
  satminkal: string
  unitKerja?: string
  phoneNumber?: string
  isCertified: boolean
  isActive: boolean
  pdpkpnu: string
  provinsi?: string
  kabupaten?: string
  kecamatan?: string
  kelurahan?: string
  birthPlace?: string
  birthDate?: string
  tempatLahir?: string
  tanggalLahir?: string
  tmt?: string
  pendidikanTerakhir?: string
  photoId?: Id<"_storage"> | string
  schoolId?: Id<"schools"> | string
}

export default function TeacherListPage() {
  const convex = useConvex();
  const [searchTerm, setSearchTerm] = useState("")
  const [filterKecamatan, setFilterKecamatan] = useState("")
  const [filterCertified, setFilterCertified] = useState("all") // all, true, false
  const [activeFilter, setActiveFilter] = useState("active") // active, inactive, all
  
  // KTA Modal State
  const [isKtaModalOpen, setIsKtaModalOpen] = useState(false)
  const [selectedTeacherForKta, setSelectedTeacherForKta] = useState<Teacher | null>(null)
  
  // 🔐 AUTO-FILTER for operators
  const userStr = localStorage.getItem("user")
  const user = userStr ? JSON.parse(userStr) : null
  const isOperator = user?.role === "operator"
  const userSchoolId = user?.unitKerja
  
  // If operator, force filter to their school
  const effectiveUnitKerja = isOperator && userSchoolId ? userSchoolId : undefined
  
  // 🔥 PAGINATED QUERY
  const { 
      results: teacherResults, 
      status: queryStatus, 
      loadMore, 
      isLoading 
  } = usePaginatedQuery(
      convexApi.teachers.list, 
      {
        unitKerja: effectiveUnitKerja, 
        kecamatan: filterKecamatan === "all" ? undefined : (filterKecamatan || undefined),
        isCertified: filterCertified === "all" ? undefined : filterCertified,
        status: activeFilter,
        search: searchTerm || undefined,
        token: localStorage.getItem("token") || undefined, 
      }, 
      { initialNumItems: 20 }
  )

  // Map Convex data to Teacher interface
  const teachers: Teacher[] = useMemo(() => {
     return teacherResults.map((t: any) => ({
        id: t._id,
        nuptk: t.nuptk,
        nomorIndukMaarif: t.nomorIndukMaarif,
        nama: t.nama || "",
        status: t.status || "",
        mapel: t.mapel || "",
        satminkal: t.unitKerja || "",
        unitKerja: t.unitKerja,
        phoneNumber: t.phoneNumber,
        isCertified: t.isCertified || false,
        isActive: t.isActive !== false,
        pdpkpnu: t.pdpkpnu || "Belum",
        provinsi: t.provinsi,
        kabupaten: t.kabupaten,
        kecamatan: t.kecamatan,
        kelurahan: t.kelurahan,
        birthPlace: t.tempatLahir,
        birthDate: t.tanggalLahir,
        tempatLahir: t.tempatLahir,
        tanggalLahir: t.tanggalLahir,
        tmt: t.tmt,
        pendidikanTerakhir: t.pendidikanTerakhir,
        photoId: t.photoId,
     }))
  }, [teacherResults])

  // Mutations
  const updateTeacherMutation = useMutation(convexApi.teachers.update)
  const bulkDeleteTeacherMutation = useMutation(convexApi.teachers.bulkDelete)
  const createTeacherMutation = useMutation(convexApi.teachers.create)
  const bulkCreateMutation = useMutation(convexApi.importData.run)

  // Toggle status state
  const [toggleConfirmOpen, setToggleConfirmOpen] = useState(false)
  const [teacherToToggle, setTeacherToToggle] = useState<{id: string, name: string, currentStatus: boolean} | null>(null)
  const [deleteAllConfirmOpen, setDeleteAllConfirmOpen] = useState(false)
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false)

  // 🔥 AUTO-CALCULATE STATUS (Helper)
  const calculateTeacherStatus = (teacher: any): string => {
    const pendidikan = (teacher.pendidikanTerakhir || "").toLowerCase()
    const nama = (teacher.nama || "").toLowerCase()
    const tmt = teacher.tmt
    if (teacher.status && teacher.status !== "" && teacher.status !== "-") {
        const s = teacher.status.toLowerCase().trim();
        if (s !== "active" && s !== "aktif" && s !== "non-active" && s !== "non-aktif") {
             if (teacher.status === "GTY") return "GTY (Guru Tetap Yayasan)";
             if (teacher.status === "GTT") return "GTT (Guru Tidak Tetap)";
             return teacher.status;
        }
    }
    const educationKeywords = ["s1", "s.1", "sarjana", "s2", "s.2", "magister", "s3", "s.3", "doktor", "div", "d4"]
    const titleKeywords = ["s.pd", "s.ag", "s.e", "s.kom", "s.h", "s.sos", "s.hum", "s.ip", "m.pd", "m.ag", "m.e", "m.kom", "dra.", "drs.", "lc.", "b.a"]
    const hasEducation = educationKeywords.some(k => pendidikan.includes(k))
    const hasTitle = titleKeywords.some(k => nama.includes(k))
    if (!hasEducation && !hasTitle) return "Tendik"
    if (!tmt) return "GTT" 
    
    let tmtDate = new Date()
    if (tmt && typeof tmt === 'string' && tmt.includes("/")) {
      const parts = tmt.split("/")
      if (parts.length === 3) tmtDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`)
    } else if (tmt) {
      tmtDate = new Date(tmt)
    }
    const now = new Date()
    let yearsDiff = now.getFullYear() - tmtDate.getFullYear()
    if (now.getMonth() < tmtDate.getMonth() || (now.getMonth() === tmtDate.getMonth() && now.getDate() < tmtDate.getDate())) {
      yearsDiff--
    }
    return yearsDiff >= 2 ? "GTY (Guru Tetap Yayasan)" : "GTT (Guru Tidak Tetap)"
  }

  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  
  // Schools data for dropdown 
  const schools = useQuery(convexApi.schools.list, {}) || []
  const [schoolSearch, setSchoolSearch] = useState("")
  const [openSchoolDropdown, setOpenSchoolDropdown] = useState(false)

  // API Wilayah (Cilacap Only)
  const [regionData, setRegionData] = useState<any>(null)
  useEffect(() => {
    fetch('/data/cilacap.json')
      .then(res => res.json())
      .then(data => setRegionData(data))
      .catch(console.error)
  }, [])

  const [userUnit] = useState<string | null>(() => {
    try {
        const u = localStorage.getItem("user")
        if (u) {
            const user = JSON.parse(u)
            if (user.role !== "super_admin" && user.unitKerja) return user.unitKerja
        }
    } catch(_e) { return null }
    return null
  })

  // Manual Add/Edit Logic
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [formData, setFormData] = useState<Partial<Teacher>>({
      nama: "", nuptk: "", nomorIndukMaarif: "", status: "GTY", satminkal: "", mapel: "", phoneNumber: "", birthPlace: "", birthDate: "", provinsi: "", kabupaten: "", kecamatan: "", kelurahan: ""
  })

  // 📄 CLIENT-SIDE PAGINATION STATE
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  // Reset page when filters change
  useEffect(() => {
      setCurrentPage(1)
  }, [searchTerm, filterKecamatan, filterCertified, activeFilter])

  // Computed Teachers for Current Page
  const paginatedTeachers = useMemo(() => {
      const startIndex = (currentPage - 1) * itemsPerPage
      return teachers.slice(startIndex, startIndex + itemsPerPage)
  }, [teachers, currentPage])

  // Selection State
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<Set<string>>(new Set())

  const toggleSelection = (id: string) => {
      const newSet = new Set(selectedTeacherIds)
      if (newSet.has(id)) newSet.delete(id)
      else newSet.add(id)
      setSelectedTeacherIds(newSet)
  }

  // Toggle All on Current Page (User Expectation)
  const toggleAllPage = () => {
      const allOnPageSelected = paginatedTeachers.every(t => selectedTeacherIds.has(t.id))
      
      const newSet = new Set(selectedTeacherIds)
      if (allOnPageSelected) {
          paginatedTeachers.forEach(t => newSet.delete(t.id))
      } else {
          paginatedTeachers.forEach(t => newSet.add(t.id))
      }
      setSelectedTeacherIds(newSet)
  }
  
  const selectedTeachersForBroadcast = useMemo(() => {
    return teachers.filter(t => selectedTeacherIds.has(t.id))
  }, [teachers, selectedTeacherIds])

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
        isActive: newStatus,
        token: localStorage.getItem("token") || undefined
      })
      toast.success(`Status Guru berhasil diubah!`)
      setToggleConfirmOpen(false)
      setTeacherToToggle(null)
    } catch (error: any) {
      toast.error("Gagal: " + error.message)
    } finally {
        setTeacherToToggle(null) // Clear immediately
    }
  }
  
  const openKta = (teacher: Teacher) => {
      setSelectedTeacherForKta(teacher)
      setIsKtaModalOpen(true)
  }
  
  const openEdit = (teacher: Teacher) => {
    setIsEditMode(true) 
    setFormData(teacher)
    setIsAddOpen(true)
  }

  const openAdd = () => {
      setIsEditMode(false)
      const initialData: Partial<Teacher> = { 
          nuptk: "", nama: "", nomorIndukMaarif: "", status: "GTY", satminkal: "", mapel: "", phoneNumber: "", birthPlace: "", birthDate: "", pendidikanTerakhir: "", provinsi: "", kabupaten: "", kecamatan: "", kelurahan: ""
      }
      if (userUnit) {
          initialData.unitKerja = userUnit;
          const matchedSchool = schools.find(s => s.nama?.trim().toLowerCase() === userUnit.trim().toLowerCase());
          if (matchedSchool && matchedSchool.kecamatan) {
              initialData.kecamatan = matchedSchool.kecamatan;
              initialData.provinsi = matchedSchool.provinsi;
              initialData.kabupaten = matchedSchool.kabupaten;
              initialData.kelurahan = matchedSchool.kelurahan;
          }
      }
      setFormData(initialData)
      setIsAddOpen(true)
  }

  const closeDialog = () => {
      setIsAddOpen(false)
      setIsEditMode(false)
      setFormData({ nuptk: "", nama: "", nomorIndukMaarif: "", status: "", satminkal: "", mapel: "", phoneNumber: "", birthPlace: "", birthDate: "", pendidikanTerakhir: "" })
  }

  const handleSave = async () => {
      if(!formData.nama) { toast.error("Nama wajib diisi!"); return }
      try {
        const cleanPayload: any = {
            nuptk: String(formData.nuptk || ""),
            nomorIndukMaarif: String(formData.nomorIndukMaarif || ""),
            nama: String(formData.nama || "").trim(),
        };
        const addIfPresent = (key: string, val: any) => {
            if (val !== undefined && val !== null && val !== "") cleanPayload[key] = val;
        }
        addIfPresent("status", formData.status);
        addIfPresent("unitKerja", formData.unitKerja || formData.satminkal);
        addIfPresent("mapel", formData.mapel);
        addIfPresent("phoneNumber", formData.phoneNumber);
        addIfPresent("pdpkpnu", formData.pdpkpnu);
        
        if (!formData.kecamatan && (formData.unitKerja || formData.satminkal)) {
            const unit = formData.unitKerja || formData.satminkal;
            const matchedSchool = schools.find(s => s.nama?.trim().toLowerCase() === unit?.trim().toLowerCase());
            if (matchedSchool && matchedSchool.kecamatan) {
                cleanPayload.kecamatan = matchedSchool.kecamatan;
                if (matchedSchool.provinsi) cleanPayload.provinsi = matchedSchool.provinsi;
                if (matchedSchool.kabupaten) cleanPayload.kabupaten = matchedSchool.kabupaten;
                if (matchedSchool.kelurahan) cleanPayload.kelurahan = matchedSchool.kelurahan;
            }
        } else {
             addIfPresent("kecamatan", formData.kecamatan);
             addIfPresent("provinsi", formData.provinsi);
             addIfPresent("kabupaten", formData.kabupaten);
             addIfPresent("kelurahan", formData.kelurahan);
        }
        addIfPresent("tempatLahir", formData.tempatLahir || formData.birthPlace);
        addIfPresent("tanggalLahir", formData.tanggalLahir || formData.birthDate);
        addIfPresent("pendidikanTerakhir", formData.pendidikanTerakhir);
        addIfPresent("tmt", formData.tmt);
        if (formData.isCertified !== undefined) cleanPayload.isCertified = formData.isCertified;
        if (formData.photoId) cleanPayload.photoId = formData.photoId; 

        // 🔥 SANITIZE schoolId: Never send empty string to strict v.id()
        if (formData.schoolId && String(formData.schoolId).trim() !== "") {
            cleanPayload.schoolId = formData.schoolId;
        } else if ((formData as any).satminkal || formData.unitKerja) {
             // Try to find matching schoolId from schools list if not explicitly set
             const unitText = (formData as any).satminkal || formData.unitKerja;
             const matched = schools.find(s => s.nama?.trim().toLowerCase() === unitText.trim().toLowerCase());
             if (matched) cleanPayload.schoolId = matched._id;
        }
        
        if (isEditMode && formData.id) {
            await updateTeacherMutation({ 
                id: formData.id as any, 
                ...cleanPayload,
                token: localStorage.getItem("token") || undefined
            })
            toast.success("Berhasil memperbarui data")
        } else {
            await createTeacherMutation({
                ...cleanPayload,
                token: localStorage.getItem("token") || undefined
            })
            toast.success("Berhasil menambah guru")
        }
        closeDialog()
      } catch (e: any) {
          console.error("Save error:", e)
          toast.error("Gagal menyimpan: " + e.message)
      }
  }
  
  const handleExport = async () => {
       try {
           const blob = await api.exportTeachers(userUnit || undefined, filterKecamatan || undefined, filterCertified)
           const url = window.URL.createObjectURL(new Blob([blob]));
           const link = document.createElement('a');
           link.href = url;
           link.setAttribute('download', `Data_Guru_${new Date().toISOString().split('T')[0]}.xlsx`);
           document.body.appendChild(link);
           link.click();
           link.parentNode?.removeChild(link);
           toast.success("Download berhasil")
       } catch (e: any) { toast.error("Export gagal.") }
  }

  const handleDeleteAll = () => setDeleteAllConfirmOpen(true)
  const confirmDeleteAll = async () => {
       try {
           const result = await bulkDeleteTeacherMutation({})
           toast.success(`Menghapus ${result.count} data!`)
           setDeleteAllConfirmOpen(false)
       } catch (e: any) { toast.error("Gagal: " + e.message) }
  }

  const uniqueKecamatan = useMemo(() => {
    const kecs = schools.map(s => s.kecamatan).filter(Boolean);
    return Array.from(new Set(kecs)).sort();
  }, [schools]);


  return (
    <div className="space-y-6">
      <SoftPageHeader
        title="Data Guru & Tenaga Kependidikan"
        description="Manajemen data guru dan tenaga kependidikan di lingkungan LP Ma'arif NU Cilacap"
        actions={[
          { label: 'Export Excel', onClick: handleExport, variant: 'mint', icon: <Download className="h-5 w-5 text-gray-700" /> },
          ...(userStr && ["super_admin", "admin"].includes(JSON.parse(userStr).role) ? [{
            label: 'Delete All', onClick: handleDeleteAll, variant: 'purple' as const, icon: <Trash2 className="h-5 w-5 text-gray-700" />
          }] : []),
          { label: 'Tambah Manual', onClick: openAdd, variant: 'cream', icon: <Plus className="h-5 w-5 text-gray-700" /> },
          { label: 'Import Excel', onClick: () => setIsImportModalOpen(true), variant: 'blue', icon: <FileSpreadsheet className="h-5 w-5 text-gray-700" /> }
        ]}
      />

      <Card className="border-0 shadow-lg glass overflow-hidden relative z-10">
        <div className="absolute top-0 right-[-10%] w-[60%] h-[100%] bg-emerald-50/30 blur-3xl pointer-events-none" />
        <CardHeader className="pb-4 border-b border-slate-100/50 bg-white/40">
           <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div className="flex-1 w-full relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-emerald-600/60" />
                    <Input
                        placeholder="Cari NUPTK, Nama, atau Mapel..."
                        className="pl-10 w-full max-w-sm border-slate-200 bg-white/60 focus-visible:ring-emerald-500 shadow-sm rounded-xl transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                
                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                    {!effectiveUnitKerja && (
                        <Select value={filterKecamatan} onValueChange={setFilterKecamatan}>
                            <SelectTrigger className="w-full sm:w-[160px] bg-white/60 border-slate-200 shadow-sm rounded-xl focus:ring-emerald-500">
                                <SelectValue placeholder="Semua Kec" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-emerald-100 shadow-lg">
                                <SelectItem value="all">Semua Kec</SelectItem>
                                {uniqueKecamatan.map(k => (
                                    <SelectItem key={k} value={k} className="focus:bg-emerald-50 focus:text-emerald-700">{k}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    
                   <Select value={filterCertified} onValueChange={setFilterCertified}>
                       <SelectTrigger className="w-full sm:w-[150px] bg-white/60 border-slate-200 shadow-sm rounded-xl focus:ring-emerald-500">
                           <SelectValue placeholder="Sertifikasi" />
                       </SelectTrigger>
                       <SelectContent className="rounded-xl border-emerald-100 shadow-lg">
                           <SelectItem value="all">Semua Status</SelectItem>
                           <SelectItem value="true" className="focus:bg-emerald-50">Sertifikasi</SelectItem>
                           <SelectItem value="false" className="focus:bg-emerald-50">Belum Sertifikasi</SelectItem>
                       </SelectContent>
                   </Select>
                </div>
                <Tabs value={activeFilter} onValueChange={setActiveFilter}>
                   <TabsList className="grid w-full grid-cols-3 max-w-md bg-white/60 border border-slate-200 rounded-xl p-1 shadow-sm">
                       <TabsTrigger value="active" className="rounded-lg data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm">Aktif</TabsTrigger>
                       <TabsTrigger value="inactive" className="rounded-lg data-[state=active]:bg-amber-50 data-[state=active]:text-amber-700 data-[state=active]:shadow-sm">Non-Aktif</TabsTrigger>
                       <TabsTrigger value="all" className="rounded-lg data-[state=active]:bg-slate-100 data-[state=active]:text-slate-800 data-[state=active]:shadow-sm">Semua</TabsTrigger>
                   </TabsList>
                </Tabs>
           </div>
        </CardHeader>
        <CardContent className="p-0">
            <div className="border-0">
                <Table>
                  <TableHeader className="bg-emerald-600/5">
                    <TableRow className="border-emerald-100/50 hover:bg-transparent">
                      <TableHead className="w-[40px] pl-4">
                          <Checkbox 
                              checked={paginatedTeachers.length > 0 && paginatedTeachers.every(t => selectedTeacherIds.has(t.id))}
                              onCheckedChange={toggleAllPage}
                              aria-label="Select all on page"
                              className="border-emerald-300 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                          />
                      </TableHead>
                      <TableHead className="font-bold text-emerald-800 tracking-wide">Nomor Induk</TableHead>
                      <TableHead className="font-bold text-emerald-800 tracking-wide">Nama</TableHead>
                      <TableHead className="font-bold text-emerald-800 tracking-wide">Status</TableHead>
                      <TableHead className="font-bold text-emerald-800 tracking-wide">Sertifikasi</TableHead>
                      <TableHead className="text-center font-bold text-emerald-800 tracking-wide">PDPKPNU</TableHead>
                      <TableHead className="font-bold text-emerald-800 tracking-wide">Satminkal</TableHead>
                      <TableHead className="text-right font-bold text-emerald-800 tracking-wide pr-6">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedTeachers.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={8} className="h-24 text-center">
                                {isLoading || (queryStatus as string) === "LoadingMore" ? (
                                    <div className="flex items-center justify-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" /> Sedang memuat data...
                                    </div>
                                ) : "Tidak ada data guru ditemukan pada halaman ini."}
                            </TableCell>
                        </TableRow>
                    ) : (
                        paginatedTeachers.map((item) => (
                          <TableRow key={item.id} className={!item.isActive ? "bg-slate-50/50 opacity-60 hover:bg-slate-100/50" : "hover:bg-slate-50/50"}>
                            <TableCell className="pl-4">
                                <Checkbox 
                                    checked={selectedTeacherIds.has(item.id)}
                                    onCheckedChange={() => toggleSelection(item.id)}
                                    className="border-emerald-300 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                                />
                            </TableCell>
                            <TableCell>
                                <div className="font-medium">{item.nuptk || "-"}</div>
                                {item.nomorIndukMaarif && <div className="text-xs text-muted-foreground font-mono mt-1">{item.nomorIndukMaarif}</div>}
                            </TableCell>
                            <TableCell>
                                <div className="flex flex-col">
                                    <span className="font-medium">{item.nama}</span>
                                    {!item.isActive && <span className="text-xs text-red-500 font-bold flex items-center mt-1"><Archive className="h-3 w-3 mr-1"/> NON-AKTIF</span>}
                                </div>
                            </TableCell>
                            <TableCell>
                                {(() => {
                                    const status = calculateTeacherStatus(item)
                                    if (status.includes("Tendik")) return <Badge variant="secondary" className="bg-slate-500 text-white">Tendik</Badge>
                                    if (status.includes("GTT")) return <Badge variant="secondary" className="bg-amber-500 text-white">GTT</Badge>
                                    if (status.includes("GTY")) return <Badge variant="secondary" className="bg-emerald-500 text-white">GTY</Badge>
                                    return <Badge variant="outline">{status}</Badge>
                                })()}
                            </TableCell>
                            <TableCell>
                                {item.isCertified ? (
                                    <div className="flex items-center text-green-600 text-xs"><BadgeCheck className="mr-1 h-3 w-3" /> Sertifikasi</div>
                                ) : <span className="text-xs text-muted-foreground">Honorer</span>}
                            </TableCell>
                            <TableCell className="text-center">
                                {item.pdpkpnu === 'Sudah' ? <span className="text-green-600 font-bold">✓</span> : <span className="text-red-300">✗</span>}
                            </TableCell>
                            <TableCell>{item.unitKerja || item.satminkal}</TableCell>
                            <TableCell className="text-right space-x-2">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600" onClick={() => toggleStatus(item.id, item.isActive, item.nama)}>
                                    {item.isActive ? <UserMinus className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => openEdit(item)}><Edit className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-purple-600" onClick={() => openKta(item)}><BadgeCheck className="h-4 w-4" /></Button>
                            </TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
            </div>
            
            {/* Pagination Controls */}
            <div className="flex items-center justify-between p-4 border-t border-slate-100/50 bg-white/40">
                <div className="text-sm font-medium text-slate-500">
                    Halaman <span className="font-bold text-slate-700">{currentPage}</span> <span className="text-muted-foreground font-normal">(Menampilkan {paginatedTeachers.length} dari {teachers.length}{queryStatus === "CanLoadMore" ? "+" : ""} data)</span>
                </div>
                <div className="flex items-center space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg shadow-sm hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1 || queryStatus === "LoadingMore"}
                    >
                        Sebelumnya
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg shadow-sm hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200"
                        onClick={() => {
                            if (currentPage * itemsPerPage >= teachers.length && queryStatus === "CanLoadMore") {
                                loadMore(itemsPerPage);
                            }
                            setCurrentPage(p => p + 1);
                        }}
                        disabled={(queryStatus === "Exhausted" && currentPage * itemsPerPage >= teachers.length) || queryStatus === "LoadingMore"}
                    >
                        {queryStatus === "LoadingMore" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Selanjutnya"}
                    </Button>
                </div>
            </div>
        </CardContent>
      </Card>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-4xl w-full max-h-[85vh] overflow-y-auto sm:max-w-[800px]">
             <DialogHeader>
                 <DialogTitle>{isEditMode ? 'Edit' : 'Tambah'} Guru Manual</DialogTitle>
             </DialogHeader>
             <div className="grid gap-4 py-4">
                 <div className="flex justify-center mb-4">
                     <TeacherPhotoUpload 
                         photoId={formData.photoId}
                         onPhotoUploaded={(id) => setFormData(prev => ({ ...prev, photoId: id }))}
                         onRemovePhoto={() => setFormData(prev => ({ ...prev, photoId: undefined }))}
                         isEditing={isEditMode}
                     />
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                     <Label className="text-right">Nama</Label>
                     <Input className="col-span-3" value={formData.nama || ""} onChange={e => setFormData({...formData, nama: e.target.value})} />
                 </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                      <Label className="text-right">NUPTK</Label>
                      <Input 
                          className="col-span-3"
                          value={formData.nuptk || ""} 
                          onChange={e => setFormData({...formData, nuptk: e.target.value})} 
                          placeholder="Nomor NUPTK"
                      />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                      <Label className="text-right">N.I.M</Label>
                      <div className="col-span-3 flex gap-2">
                          <Input 
                              value={formData.nomorIndukMaarif || ""} 
                              onChange={e => setFormData({...formData, nomorIndukMaarif: e.target.value})} 
                              placeholder="Nomor Induk Ma'arif"
                              className="flex-1"
                          />
                           <Button
                              type="button" variant="outline" size="icon"
                              onClick={async () => {
                                  try {
                                      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                                      // @ts-ignore
                                      const nextNim = await convex.query(convexApi.teachers.generateNextNim);
                                      if (nextNim) setFormData({...formData, nomorIndukMaarif: nextNim});
                                  } catch (e) { toast.error("Gagal generate.") }
                              }}
                           >
                              <Wand2 className="h-4 w-4 text-purple-600" />
                           </Button>
                      </div>
                  </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                     <Label className="text-right">Pendidikan</Label>
                     <Select value={formData.pendidikanTerakhir} onValueChange={(val) => setFormData({...formData, pendidikanTerakhir: val})}>
                         <SelectTrigger className="col-span-3"><SelectValue placeholder="Pilih Pendidikan" /></SelectTrigger>
                         <SelectContent>
                             {["SD","SMP","SMA","D1","D2","D3","S1","S2","S3"].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                         </SelectContent>
                     </Select>
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                     <Label className="text-right">Provinsi</Label>
                     <Input className="col-span-3 bg-muted" value={formData.provinsi || ""} readOnly placeholder="Otomatis" />
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                     <Label className="text-right">Kab/Kota</Label>
                     <Input className="col-span-3 bg-muted" value={formData.kabupaten || ""} readOnly placeholder="Otomatis" />
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                     <Label className="text-right">Kecamatan</Label>
                     <Select 
                         value={formData.kecamatan} 
                         onValueChange={(val) => {
                             setFormData({...formData, kecamatan: val, kelurahan: "", provinsi: regionData?.provinsi || "Jawa Tengah", kabupaten: regionData?.kabupaten || "Cilacap"})
                         }}
                     >
                         <SelectTrigger className="col-span-3"><SelectValue placeholder="Pilih Kecamatan" /></SelectTrigger>
                         <SelectContent>
                             {regionData?.kecamatan?.map((k: any) => (
                                 <SelectItem key={k.nama} value={k.nama}>{k.nama}</SelectItem>
                             ))}
                         </SelectContent>
                     </Select>
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                     <Label className="text-right">Kelurahan/Desa</Label>
                     <Select 
                         disabled={!formData.kecamatan}
                         value={formData.kelurahan} 
                         onValueChange={(val) => setFormData({...formData, kelurahan: val})}
                     >
                         <SelectTrigger className="col-span-3"><SelectValue placeholder="Pilih Kelurahan/Desa" /></SelectTrigger>
                         <SelectContent>
                             {regionData?.kecamatan?.find((k: any) => k.nama === formData.kecamatan)?.desa?.map((d: any) => (
                                 <SelectItem key={d} value={d}>{d}</SelectItem>
                             ))}
                         </SelectContent>
                     </Select>
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                     <Label className="text-right">Status</Label>
                     <Select value={formData.status} onValueChange={(val) => setFormData({...formData, status: val})}>
                         <SelectTrigger className="col-span-3"><SelectValue placeholder="Pilih status" /></SelectTrigger>
                         <SelectContent>
                             <SelectItem value="PNS">PNS / ASN</SelectItem>
                             <SelectItem value="GTY">GTY (Guru Tetap Yayasan)</SelectItem>
                             <SelectItem value="GTT">GTT (Guru Tidak Tetap)</SelectItem>
                             <SelectItem value="Tendik">Tenaga Kependidikan</SelectItem>
                         </SelectContent>
                     </Select>
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                     <Label className="text-right">Satminkal</Label>
                     <div className="col-span-3 relative">
                          <div className="relative">
                             <Input
                                 placeholder="Cari unit kerja..."
                                 value={formData.unitKerja || formData.satminkal || schoolSearch}
                                 onChange={(e) => {
                                     setSchoolSearch(e.target.value)
                                     setOpenSchoolDropdown(true)
                                     setFormData({...formData, unitKerja: e.target.value, satminkal: e.target.value})
                                 }}
                                 onFocus={() => !isOperator && setOpenSchoolDropdown(true)}
                                 className="w-full"
                                 autoComplete="off"
                                 disabled={isOperator}
                             />
                             {openSchoolDropdown && (
                                 <div className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-md border bg-white p-1 shadow-lg text-sm">
                                     {schools
                                         .filter(s => s.nama.toLowerCase().includes((formData.unitKerja || schoolSearch).toLowerCase()))
                                         .slice(0, 100)
                                         .map((school) => (
                                           <div key={school._id} 
                                                className="cursor-pointer rounded-sm px-2 py-1.5 hover:bg-slate-100"
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    setFormData({...formData, unitKerja: school.nama, satminkal: school.nama})
                                                    setSchoolSearch("")
                                                    setOpenSchoolDropdown(false)
                                                }}
                                           >{school.nama}</div>
                                         ))
                                     }
                                 </div>
                             )}
                          </div>
                     </div>
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                     <Label className="text-right">No HP</Label>
                     <Input className="col-span-3" value={formData.phoneNumber || ""} onChange={e => setFormData({...formData, phoneNumber: e.target.value})} />
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Sertifikasi</Label>
                    <Select value={formData.isCertified ? "Sudah" : "Belum"} onValueChange={(val) => setFormData({...formData, isCertified: val === "Sudah"})}>
                        <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="Sudah">Sudah</SelectItem><SelectItem value="Belum">Belum</SelectItem></SelectContent>
                    </Select>
                 </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                     <Label className="text-right">PDPKPNU</Label>
                     <Input className="col-span-3" value={formData.pdpkpnu || ""} onChange={e => setFormData({...formData, pdpkpnu: e.target.value})} />
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                     <Label className="text-right">Tempat Lahir</Label>
                     <Input className="col-span-3" value={formData.tempatLahir || ""} onChange={e => setFormData({...formData, tempatLahir: e.target.value})} />
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                     <Label className="text-right">Tgl Lahir</Label>
                     <Input type="date" className="col-span-3" value={formData.tanggalLahir || ""} onChange={e => setFormData({...formData, tanggalLahir: e.target.value})} />
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                     <Label className="text-right">TMT</Label>
                     <Input type="date" className="col-span-3" value={formData.tmt || ""} onChange={e => setFormData({...formData, tmt: e.target.value})} />
                 </div>
             </div>
             <DialogFooter>
                 <Button variant="outline" onClick={closeDialog}>Batal</Button>
                 <Button onClick={handleSave}>Simpan</Button>
             </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* EXCEL IMPORT (Keeping logic intact) */}
      <ExcelImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={() => {}} 
        onDownloadTemplate={async () => {
             // ... Template logic ...
             const XLSX = await import('xlsx');
             // Simplified for brevity in rewrite, assume standard template
             const headers = [
               "NUPTK",
               "Nomor Induk Ma'arif",
               "Nama", 
               "NIP",
               "Jenis Kelamin",
               "Tempat Lahir",
               "Tanggal Lahir",
               "Pendidikan Terakhir", 
               "Unit Kerja", 
               "Kecamatan",
               "Status", 
               "TMT", 
               "No HP",
               "Email",
               "Sertifikasi", 
               "PDPKPNU"
             ];
             const sampleRow = [
               "1234567890123456",
               "123456789",
               "Ahmad Contoh, S.Pd",
               "-",
               "L",
               "Cilacap",
               "12 Februari 1990",
               "S1",
               "MI Ma'arif 01 Cilacap",
               "Cilacap Selatan",
               "GTY",
               "17 Juli 2015",
               "08123456789",
               "ahmad@contoh.com",
               "Ya",
               "Sudah"
             ];
             const wb = XLSX.utils.book_new();
             const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
             
             // Auto-width columns roughly
             ws["!cols"] = headers.map(() => ({ wch: 20 }));
             ws["!cols"][2] = { wch: 30 }; // Nama wider
             ws["!cols"][8] = { wch: 30 }; // Unit Kerja wider
             
             XLSX.utils.book_append_sheet(wb, ws, "Template Guru");
             XLSX.writeFile(wb, "Template_Import.xlsx");
        }}
        title="Import Data Guru"
        description="Upload file Excel"
        onFileImport={async (file) => {
            try {
                // Simplified Import Logic - relying on bulkCreateMutation
                const XLSX = await import('xlsx');
                const data = await file.arrayBuffer();
                const wb = XLSX.read(data);
                const ws = wb.Sheets[wb.SheetNames[0]];
                const json = XLSX.utils.sheet_to_json(ws) as any[];
                
                // MAPPING Logic
                const payload = json.map((r: any) => {
                    const tmtDateStr = r.TMT || r.tmt || "";
                    let parsedTmt = String(tmtDateStr);
                    if (typeof tmtDateStr === 'number') {
                        // Excel serial date to string
                        const date = new Date(Math.round((tmtDateStr - 25569) * 86400 * 1000));
                        parsedTmt = date.toISOString().split('T')[0];
                    }
                    
                    // Format TTL (Tempat, Tanggal Lahir)
                    const tempatLahir = r['Tempat Lahir'] || "";
                    let tanggalLahir = r['Tanggal Lahir'] || "";
                    if (typeof tanggalLahir === 'number') {
                         const date = new Date(Math.round((tanggalLahir - 25569) * 86400 * 1000));
                         tanggalLahir = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
                    }
                    const ttl = tempatLahir && tanggalLahir ? `${tempatLahir}, ${tanggalLahir}` : (tempatLahir || String(tanggalLahir));
                    
                    return {
                        nama: r.Nama || r.nama,
                        nuptk: r.NUPTK ? String(r.NUPTK) : undefined,
                        nomorIndukMaarif: r["Nomor Induk Ma'arif"] ? String(r["Nomor Induk Ma'arif"]) : undefined,
                        nip: r.NIP ? String(r.NIP) : undefined,
                        jenisKelamin: r['Jenis Kelamin'] === 'L' ? 'Laki-Laki' : (r['Jenis Kelamin'] === 'P' ? 'Perempuan' : undefined),
                        ttl: ttl,
                        pendidikanTerakhir: r['Pendidikan Terakhir'],
                        unitKerja: r['Unit Kerja'] || r.unitKerja,
                        kecamatan: r.Kecamatan,
                        status: r.Status || "GTT",
                        tmt: parsedTmt,
                        phoneNumber: r['No HP'] ? String(r['No HP']) : undefined,
                        // Email mapping is omitted as backend schema doesn't have it explicitly mapped yet
                        isCertified: r.Sertifikasi ? (String(r.Sertifikasi).toLowerCase().includes('ya') ? true : false) : undefined,
                        pdpkpnu: r.PDPKPNU || "Belum"
                    }
                }).filter(r => r.nama);

                if (payload.length === 0) { toast.error("Data kosong"); return; }
                
                const res = await bulkCreateMutation({ teachers: payload });
                toast.success(`Sukses: ${res.count} data.`);
                setIsImportModalOpen(false);
            } catch (e: any) {
                toast.error("Gagal: " + e.message);
            }
        }}
      />

      <Dialog open={toggleConfirmOpen} onOpenChange={setToggleConfirmOpen}>
        <DialogContent className="sm:max-w-[400px]">
           <DialogHeader>
               <div className={`flex items-center gap-3 mb-2 ${teacherToToggle?.currentStatus ? 'text-amber-600' : 'text-blue-600'}`}>
                   <div className={`p-2 rounded-full ${teacherToToggle?.currentStatus ? 'bg-amber-50' : 'bg-blue-50'}`}>
                       {teacherToToggle?.currentStatus ? <Archive className="h-6 w-6" /> : <UserCheck className="h-6 w-6" />}
                   </div>
                   <DialogTitle className="text-xl font-bold">
                       {teacherToToggle?.currentStatus ? 'Nonaktifkan Guru' : 'Aktifkan Guru'}
                   </DialogTitle>
               </div>
           </DialogHeader>
           <div className="py-2">
               <p className="text-muted-foreground leading-relaxed">
                   Apakah Anda yakin ingin {teacherToToggle?.currentStatus ? 'menonaktifkan' : 'mengaktifkan'} data guru:
               </p>
               <p className="font-bold text-lg mt-1 text-slate-800">{teacherToToggle?.name}</p>
               <p className="text-xs text-muted-foreground mt-3 p-3 bg-slate-50 border rounded italic">
                   {teacherToToggle?.currentStatus 
                    ? "Guru yang non-aktif tidak akan muncul di daftar utama dan tidak dapat mengajukan SK." 
                    : "Guru yang diaktifkan kembali akan dapat mengajukan SK dan muncul di laporan."}
               </p>
           </div>
           <DialogFooter className="gap-2 sm:gap-0 border-t pt-4">
               <Button variant="ghost" onClick={() => setToggleConfirmOpen(false)}>Batal</Button>
               <Button 
                variant={teacherToToggle?.currentStatus ? "destructive" : "default"} 
                onClick={confirmToggle}
                className={teacherToToggle?.currentStatus ? "" : "bg-blue-600 hover:bg-blue-700"}
               >
                   Ya, {teacherToToggle?.currentStatus ? 'Nonaktifkan' : 'Aktifkan'}
               </Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* FLOATING ACTION BAR FOR BROADCAST */}
      {selectedTeacherIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-4 bg-gray-900/90 text-white px-6 py-3 rounded-full shadow-2xl backdrop-blur-sm border border-gray-700 animate-in slide-in-from-bottom-5">
           <span className="font-medium text-sm border-r border-gray-600 pr-4">{selectedTeacherIds.size} Guru Dipilih</span>
           <button onClick={() => setIsBroadcastOpen(true)} className="flex items-center gap-2 text-green-400 hover:text-green-300 font-bold transition-colors">
              <Smartphone className="h-5 w-5" /> BROADCAST WA
           </button>
           <button onClick={() => setSelectedTeacherIds(new Set())} className="ml-2 text-gray-400 p-1" aria-label="Clear selection"><X className="h-4 w-4" /></button>
        </div>
      )}
      <BroadcastModal isOpen={isBroadcastOpen} onClose={() => setIsBroadcastOpen(false)} recipients={selectedTeachersForBroadcast} />

      <Dialog open={deleteAllConfirmOpen} onOpenChange={setDeleteAllConfirmOpen}>
        <DialogContent className="sm:max-w-[400px]">
           <DialogHeader>
                <div className="flex items-center gap-3 text-red-600 mb-2">
                    <div className="p-2 bg-red-50 rounded-full">
                        <AlertTriangle className="h-6 w-6" />
                    </div>
                    <DialogTitle className="text-xl font-bold">Hapus Seluruh Data?</DialogTitle>
                </div>
           </DialogHeader>
           <div className="py-2">
               <p className="text-muted-foreground text-sm leading-relaxed">
                   Tindakan ini akan menghapus <span className="font-bold text-red-600">SELURUH</span> data guru yang ada di sistem secara permanen.
               </p>
               <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-lg">
                   <p className="text-xs text-red-800 font-bold flex items-center gap-2">
                       <XCircle className="h-4 w-4" /> BAHAYA
                   </p>
                   <p className="text-[11px] text-red-700 mt-1">
                       Data yang sudah dihapus tidak dapat dikembalikan dengan cara apa pun. Pastikan Anda sudah melakukan backup (Export Excel) terlebih dahulu!
                   </p>
               </div>
           </div>
           <DialogFooter className="gap-2 sm:gap-0 border-t pt-4">
               <Button variant="ghost" onClick={() => setDeleteAllConfirmOpen(false)}>Batal</Button>
               <Button variant="destructive" onClick={confirmDeleteAll} className="bg-red-600 hover:bg-red-700 shadow-lg">
                    Hapus Selamanya
                </Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {selectedTeacherForKta && (
        <Dialog open={isKtaModalOpen} onOpenChange={setIsKtaModalOpen}>
             <DialogContent className="max-w-4xl h-[90vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>Preview KTA</DialogTitle></DialogHeader>
                  <KtaCard teacher={selectedTeacherForKta} />
             </DialogContent>
        </Dialog>
      )}

    </div>
  )
}
