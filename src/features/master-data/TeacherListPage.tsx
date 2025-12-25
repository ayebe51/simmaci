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
import { Plus, Search, Edit, BadgeCheck, UserMinus, UserCheck, Archive, FileSpreadsheet } from "lucide-react"
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import ExcelImportModal from "./components/ExcelImportModal"
import { api } from "@/lib/api"

interface Teacher {
  id: string
  nip: string
  nama: string
  status: string
  mapel: string
  unitKerja: string
  sertifikasi: boolean
  isActive: boolean
}

// Dummy Data
const dummyTeachers: Teacher[] = [
  { id: "1", nip: "198501012010011001", nama: "Drs. H. Ahmad Fauzi, M.Pd", status: "PNS", mapel: "PAI", unitKerja: "MTs Ma'arif NU Cilacap", sertifikasi: true, isActive: true },
  { id: "2", nip: "-", nama: "Siti Aminah, S.Pd", status: "GTY", mapel: "Matematika", unitKerja: "MI Ma'arif 01", sertifikasi: true, isActive: true },
  { id: "3", nip: "-", nama: "Rudi Hartono, S.Or", status: "GTT", mapel: "PJOK", unitKerja: "MTs Ma'arif NU Cilacap", sertifikasi: false, isActive: true },
]

export default function TeacherListPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [activeFilter, setActiveFilter] = useState("active") // active, inactive, all

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

  const loadTeachers = async () => {
      try {
          const data = await api.getTeachers(userUnit || undefined) // api is imported
          setTeachers(data)
      } catch (e) {
          console.error(e)
      }
  }

  useEffect(() => {
    loadTeachers()
  }, [userUnit])

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    // Optimistic Update
    const updated = teachers.map(t => 
        t.id === id ? { ...t, isActive: !currentStatus } : t
    )
    setTeachers(updated)

    // TODO: Connect to API for status update
    // await api.updateTeacherStatus(id, !currentStatus)
  }

  const filtered = teachers.filter(t => {
      // 1. Role Filter
      if (userUnit && t.unitKerja !== userUnit) return false

      const matchesSearch = t.nama.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            t.unitKerja.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesStatus = activeFilter === "all" ? true :
                            activeFilter === "active" ? t.isActive : 
                            !t.isActive

      return matchesSearch && matchesStatus
  })

  const getStatusColor = (status: string) => {
      switch(status) {
          case "PNS": return "bg-blue-100 text-blue-800 hover:bg-blue-100"
          case "GTY": return "bg-green-100 text-green-800 hover:bg-green-100"
          default: return "bg-slate-100 text-slate-800 hover:bg-slate-100"
      }
  }

  // Manual Add Logic
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [formData, setFormData] = useState<Partial<Teacher>>({
      nama: "", nip: "", status: "GTY", unitKerja: "", mapel: ""
  })

  const handleAdd = async () => {
      if(!formData.nama) {
          alert("Nama wajib diisi!")
          return
      }

      try {
        await api.createTeacher({
            nip: formData.nip || "-",
            nama: formData.nama,
            status: formData.status || "Lainnya",
            unitKerja: formData.unitKerja || "-",
            mapel: formData.mapel || "-"
        })
        
        loadTeachers()
        setIsAddOpen(false)
        setFormData({ nip: "", nama: "", status: "", unitKerja: "", mapel: "" })
        alert("Berhasil menambah guru")
      } catch (e) {
          alert("Gagal menyimpan guru")
      }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Data Guru & Tenaga Kependidikan</h1>
          <p className="text-muted-foreground">
            Manajemen data PTK di lingkungan LP Ma'arif NU Cilacap.
          </p>
        </div>
        <div className="flex gap-2">
            <Button onClick={() => setIsAddOpen(true)}>
             <Plus className="mr-2 h-4 w-4" /> Tambah Manual
            </Button>
            <Button variant="outline">
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Import Excel
            </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
             <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                 <div className="relative w-full sm:w-auto">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Cari nama, NIP, atau unit kerja..."
                        className="pl-9 w-full sm:w-[300px]"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Tabs value={activeFilter} onValueChange={setActiveFilter} className="w-full sm:w-auto">
                    <TabsList>
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
                      <TableHead>NIP/NIY</TableHead>
                      <TableHead>Nama</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sertifikasi</TableHead>
                      <TableHead>Mapel</TableHead>
                      <TableHead>Unit Kerja</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center">
                                Tidak ada data guru ditemukan.
                            </TableCell>
                        </TableRow>
                    ) : (
                        filtered.map((item) => (
                          <TableRow key={item.id} className={!item.isActive ? "bg-slate-50 opacity-60" : ""}>
                            <TableCell className="font-medium">{item.nip}</TableCell>
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
                                {item.sertifikasi ? (
                                    <div className="flex items-center text-green-600 text-xs">
                                        <BadgeCheck className="mr-1 h-3 w-3" /> Sertifikasi
                                    </div>
                                ) : (
                                    <span className="text-xs text-muted-foreground">-</span>
                                )}
                            </TableCell>
                            <TableCell>{item.mapel}</TableCell>
                            <TableCell>{item.unitKerja}</TableCell>
                            <TableCell className="text-right space-x-2">
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-amber-600 hover:text-amber-800"
                                    onClick={() => toggleStatus(item.id, item.isActive)}
                                    title={item.isActive ? "Non-Aktifkan" : "Aktifkan Kembali"}
                                >
                                    {item.isActive ? <UserMinus className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-800"><Edit className="h-4 w-4" /></Button>
                            </TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
            </div>
        </CardContent>
      </Card>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Tambah Guru Manual</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="nama" className="text-right">Nama</Label>
                    <Input id="nama" className="col-span-3" value={formData.nama} onChange={e => setFormData({...formData, nama: e.target.value})} />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="nip" className="text-right">NIP/NIY</Label>
                    <Input id="nip" className="col-span-3" value={formData.nip} onChange={e => setFormData({...formData, nip: e.target.value})} />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="status" className="text-right">Status</Label>
                    <Input id="status" className="col-span-3" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} placeholder="PNS / GTY / GTT" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="unitKerja" className="text-right">Unit Kerja</Label>
                    <Input id="unitKerja" className="col-span-3" value={formData.unitKerja} onChange={e => setFormData({...formData, unitKerja: e.target.value})} />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="mapel" className="text-right">Mapel</Label>
                    <Input id="mapel" className="col-span-3" value={formData.mapel} onChange={e => setFormData({...formData, mapel: e.target.value})} />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddOpen(false)}>Batal</Button>
                <Button onClick={handleAdd}>Simpan</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
