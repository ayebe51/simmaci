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
import { Plus, Search, Trash2, Edit, FileSpreadsheet } from "lucide-react"
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import ExcelImportModal from "./components/ExcelImportModal"
import { api } from "@/lib/api"

interface School {
  id: string
  nsm: string
  npsn: string
  nama: string
  alamat: string
  kecamatan: string
  kepala: string
}

export default function SchoolListPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [schools, setSchools] = useState<School[]>([])

  const loadSchools = async () => {
    try {
      const data = await api.getSchools()
      setSchools(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Failed to load schools", error)
    }
  }

  useEffect(() => {
    loadSchools()
  }, [])

  const handleImport = (newData: Record<string, unknown>[]) => {
    // Map imported data
    const mapped: School[] = newData.map((row, index) => ({
      id: `imported-${Date.now()}-${index}`,
      nsm: String(row["NSM"] || "-"),
      npsn: String(row["NPSN"] || "-"),
      nama: String(row["Nama Lembaga"] || row["Nama"] || "Unknown"),
      alamat: String(row["Alamat"] || "-"),
      kecamatan: String(row["Kecamatan"] || "-"),
      kepala: String(row["Kepala Madrasah"] || "-")
    }))
    setSchools(prev => [...prev, ...mapped])
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

  // Manual Add State
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [formData, setFormData] = useState<Partial<School>>({
      nsm: "", npsn: "", nama: "", alamat: "", kecamatan: "", kepala: ""
  })

  const filtered = (schools || []).filter(s => {
    // 1. Role Filter
    if (userUnit && s.nama !== userUnit) return false

    // 2. Search Filter
    const term = searchTerm.toLowerCase()
    return (s.nama || "").toLowerCase().includes(term) || 
    (s.nsm || "").includes(searchTerm) ||
    (s.kecamatan || "").toLowerCase().includes(term)
  })

  const handleAdd = async () => {
      if(!formData.nama) {
          alert("Nama Lembaga wajib diisi!")
          return
      }
      
      try {
        await api.createSchool({
            nsm: formData.nsm || "-",
            npsn: formData.npsn || "-",
            nama: formData.nama,
            kecamatan: formData.kecamatan || "-",
            kepala: formData.kepala || "-",
            alamat: formData.alamat || "-"
        })

        loadSchools() // Reload data
        setIsAddOpen(false)
        setFormData({ nsm: "", npsn: "", nama: "", alamat: "", kecamatan: "", kepala: "" })
        alert("Berhasil menambah data lembaga")
      } catch (e) {
        alert("Gagal menyimpan data")
      }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Data Lembaga / Madrasah</h1>
          <p className="text-muted-foreground">
            Daftar satuan pendidikan di bawah naungan LP Ma'arif NU Cilacap.
          </p>
        </div>
        <div className="flex gap-2">
            <Button onClick={() => setIsAddOpen(true)}>
             <Plus className="mr-2 h-4 w-4" /> Tambah Lembaga
            </Button>
            <Button variant="outline">
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Import Excel
            </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
             <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama, NSM, atau kecamatan..."
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
                      <TableHead>NSM</TableHead>
                      <TableHead>NPSN</TableHead>
                      <TableHead>Nama Lembaga</TableHead>
                      <TableHead>Kecamatan</TableHead>
                      <TableHead>Kepala Madrasah</TableHead>
                      <TableHead>Alamat</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center">
                                Tidak ada data Madrasah.
                            </TableCell>
                        </TableRow>
                    ) : (
                        filtered.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.nsm}</TableCell>
                            <TableCell>{item.npsn}</TableCell>
                            <TableCell>{item.nama}</TableCell>
                            <TableCell>{item.kecamatan}</TableCell>
                            <TableCell>{item.kepala}</TableCell>
                            <TableCell>{item.alamat}</TableCell>
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
                <DialogTitle>Tambah Data Madrasah</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">NSM</Label>
                    <Input className="col-span-3" value={formData.nsm} onChange={e => setFormData({...formData, nsm: e.target.value})} />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">NPSN</Label>
                    <Input className="col-span-3" value={formData.npsn} onChange={e => setFormData({...formData, npsn: e.target.value})} />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Nama Lembaga</Label>
                    <Input className="col-span-3" value={formData.nama} onChange={e => setFormData({...formData, nama: e.target.value})} />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Kecamatan</Label>
                    <Input className="col-span-3" value={formData.kecamatan} onChange={e => setFormData({...formData, kecamatan: e.target.value})} />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Kepala Madrasah</Label>
                    <Input className="col-span-3" value={formData.kepala} onChange={e => setFormData({...formData, kepala: e.target.value})} />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Alamat</Label>
                    <Input className="col-span-3" value={formData.alamat} onChange={e => setFormData({...formData, alamat: e.target.value})} />
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
