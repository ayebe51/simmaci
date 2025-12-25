import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { FilePlus, Search } from "lucide-react"
import { useNavigate } from "react-router-dom"
import StatusBadge from "@/components/shared/StatusBadge"
import type { StatusType } from "@/components/shared/StatusBadge"
import { useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Type definitions (to be moved to types/sk.ts later)
interface SkSubmission {
  id: string
  nomorSurat: string
  jenisSk: string
  nama: string
  tanggalPengajuan: string
  status: StatusType
}

// Dummy Data
const dummyData: SkSubmission[] = [
  { id: "1", nomorSurat: "SK/2024/001", jenisSk: "SK Kepala Madrasah", nama: "Ahmad Dahlan", tanggalPengajuan: "2024-05-20", status: "issued" },
  { id: "2", nomorSurat: "-", jenisSk: "SK Guru Tetap Yayasan", nama: "Siti Aminah", tanggalPengajuan: "2024-06-01", status: "submitted" },
  { id: "3", nomorSurat: "-", jenisSk: "SK Tenaga Kependidikan", nama: "Budi Santoso", tanggalPengajuan: "2024-06-02", status: "draft" },
  { id: "4", nomorSurat: "SK/2024/002", jenisSk: "SK Guru Tidak Tetap", nama: "Dewi Sartika", tanggalPengajuan: "2024-05-15", status: "revision" },
]

export default function SkDashboardPage() {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState("all")

  // Filter Logic
  const filteredData = dummyData.filter(item => {
    const matchesSearch = item.nama.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.jenisSk.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = filterType === "all" || item.jenisSk === filterType
    return matchesSearch && matchesType
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manajemen SK</h1>
          <p className="text-muted-foreground">
            Kelola pengajuan dan penerbitan Surat Keputusan.
          </p>
        </div>
        <Button onClick={() => navigate("/dashboard/sk/new")}>
          <FilePlus className="mr-2 h-4 w-4" />
          Ajuan Baru
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Pengajuan SK</CardTitle>
          <CardDescription>
            Lihat status pengajuan SK Anda di sini.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama atau jenis SK..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-[200px]">
                <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger>
                        <SelectValue placeholder="Filter Jenis SK" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Jenis</SelectItem>
                        <SelectItem value="SK Kepala Madrasah">SK Kepala Madrasah</SelectItem>
                        <SelectItem value="SK Guru Tetap Yayasan">SK GTY</SelectItem>
                        <SelectItem value="SK Guru Tidak Tetap">SK GTT</SelectItem>
                        <SelectItem value="SK Tenaga Kependidikan">SK Tendik</SelectItem>
                    </SelectContent>
                </Select>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Jenis SK</TableHead>
                  <TableHead>Nama Pemohon</TableHead>
                  <TableHead>Nomor Surat</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center">
                            Tidak ada data ditemukan.
                        </TableCell>
                    </TableRow>
                ) : (
                    filteredData.map((item) => (
                      <TableRow 
                        key={item.id} 
                        className="cursor-pointer hover:bg-slate-50"
                        onClick={() => navigate(`/dashboard/sk/${item.id}`)}
                      >
                        <TableCell>{item.tanggalPengajuan}</TableCell>
                        <TableCell className="font-medium">{item.jenisSk}</TableCell>
                        <TableCell>{item.nama}</TableCell>
                        <TableCell>{item.nomorSurat}</TableCell>
                        <TableCell>
                          <StatusBadge status={item.status} />
                        </TableCell>
                        <TableCell className="text-right">
                            <Button variant="ghost" size="sm">Detail</Button>
                        </TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
