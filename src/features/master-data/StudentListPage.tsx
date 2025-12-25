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
import { Plus, Search, Trash2, Edit } from "lucide-react"
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api } from "@/lib/api"

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
  const [students, setStudents] = useState<Student[]>([])
  
  // Manual Add Logic
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [formData, setFormData] = useState<Partial<Student>>({
      nisn: "", nama: "", kelas: "", sekolah: "", jk: "L"
  })

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

  const loadStudents = async () => {
    try {
      // Pass schoolId if userUnit is set (for operators)
      const data = await api.getStudents(userUnit || undefined) 
      setStudents(data)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadStudents()
  }, [userUnit])

  const filtered = students.filter(s => {
    // 1. Role Filter
    if (userUnit && s.sekolah !== userUnit) return false

    return s.nama.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.nisn.includes(searchTerm) ||
    s.sekolah.toLowerCase().includes(searchTerm.toLowerCase())
  })

  const handleAdd = async () => {
      if (!formData.nama || !formData.nisn) {
          alert("Nama dan NISN wajib diisi!")
          return
      }
      
      try {
        await api.createStudent({
            nisn: formData.nisn,
            nama: formData.nama,
            jk: formData.jk || "L",
            kelas: formData.kelas || "-",
            sekolah: formData.sekolah || "-" // Should ideally be a Schools lookup or userUnit
        })

        loadStudents()
        setIsAddOpen(false)
        setFormData({ nisn: "", nama: "", kelas: "", sekolah: "", jk: "L" })
        alert("Berhasil menambah siswa")
      } catch (e) {
        alert("Gagal menyimpan data siswa")
      }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Data Siswa</h1>
          <p className="text-muted-foreground">
            Data peserta didik di lingkungan LP Ma'arif NU Cilacap.
          </p>
        </div>
        <div className="flex gap-2">
            <Button onClick={() => setIsAddOpen(true)}>
             <Plus className="mr-2 h-4 w-4" /> Tambah Siswa
            </Button>
        </div>
      </div>

      <Card>
        {/* ... existing card content ... */}
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
                <TableHead>NISN</TableHead>
                <TableHead>Nama Lengkap</TableHead>
                <TableHead>L/P</TableHead>
                <TableHead>Kelas</TableHead>
                <TableHead>Asal Sekolah</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                  <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">
                          Tidak ada data siswa ditemukan.
                      </TableCell>
                  </TableRow>
              ) : (
                  filtered.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.nisn}</TableCell>
                      <TableCell>{item.nama}</TableCell>
                      <TableCell>{item.jk}</TableCell>
                      <TableCell>{item.kelas}</TableCell>
                      <TableCell>{item.sekolah}</TableCell>
                      <TableCell className="text-right space-x-2">
                          <Button variant="ghost" size="icon" className="h-8 w-8"><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></Button>
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
    </div>
  )
}
