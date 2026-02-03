import { useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { ArrowRightLeft, Search, History, Building2 } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function MutationPage() {
  const [isOpen, setIsOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  
  // Selection State
  const [selectedTeacher, setSelectedTeacher] = useState<string>("")
  const [selectedSchool, setSelectedSchool] = useState<string>("")
  
  // Form State
  const [formData, setFormData] = useState({
    skNumber: "",
    reason: "",
    effectiveDate: new Date().toISOString().split('T')[0]
  })

  // Auth
  const token = localStorage.getItem("token")
  
  // Data Fetching
  const mutations = useQuery(api.mutations.list, { token: token || undefined }) || []
  const schools = useQuery(api.schools.list, { token: token || undefined }) || [] 
  // Note: schools list might be filtered for operator. If Admin, returns all?
  // We need ALL schools for destination.
  // If current user is Operator, they can only move teacher FROM their school TO another?
  // My backend logic restricted moveTeacher to Admin Only.
  // So this page is primarily for Admins.

  // We need a way to search teachers.
  // Ideally a search API. For MVP, we might load all and filter in frontend (if not too many).
  // Or use `api.teachers.list`.
  const teachers = useQuery(api.teachers.list, { token: token || undefined }) || []

  // Mutations
  const moveTeacher = useMutation(api.mutations.moveTeacher)

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault()
      if (!selectedTeacher || !selectedSchool || !formData.skNumber) {
          toast.error("Lengkapi data formulir")
          return
      }
      
      setIsProcessing(true)
      try {
           const targetSchool = schools.find(s => s._id === selectedSchool)?.nama || selectedSchool;

           await moveTeacher({
               token: token!,
               teacherId: selectedTeacher as any,
               toUnit: targetSchool, 
               skNumber: formData.skNumber,
               reason: formData.reason,
               effectiveDate: formData.effectiveDate
           })
           
           toast.success("Mutasi berhasil diproses")
           setIsOpen(false)
           setFormData({
               skNumber: "",
               reason: "",
               effectiveDate: new Date().toISOString().split('T')[0]
           })
           setSelectedTeacher("")
           setSelectedSchool("")

      } catch (err: any) {
          console.error(err)
          toast.error(err.message || "Gagal memproses mutasi")
      } finally {
          setIsProcessing(false)
      }
  }

  // Filter teachers for Combobox (using simple Select for now)
  // If list is long, we should use Command/Popover Combobox. 
  // Let's stick to Select for simplicity unless user complains.

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-2xl font-bold tracking-tight">Mutasi Guru</h1>
            <p className="text-muted-foreground">Proses pemindahan tugas guru antar unit sekolah.</p>
        </div>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button><ArrowRightLeft className="mr-2 h-4 w-4" /> Proses Mutasi Baru</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Formulir Mutasi Guru</DialogTitle>
                    <DialogDescription>Pastikan data SK Mutasi sudah valid sebelum memproses.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    
                    <div className="grid grid-cols-2 gap-4">
                         <div className="grid gap-2">
                            <Label>Pilih Guru</Label>
                            {/* Simple Select - Improvement: Searchable */}
                            <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Cari Nama Guru..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {teachers.slice(0, 100).map(t => (
                                        <SelectItem key={t._id} value={t._id}>
                                            {t.nama} ({t.unitKerja})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-[10px] text-muted-foreground">*Hanya menampilkan 100 guru pertama (Gunakan filter pencarian jika perlu dikembangkan)</p>
                         </div>
                         
                         <div className="grid gap-2">
                            <Label>Unit Tujuan Baru</Label>
                            <Select value={selectedSchool} onValueChange={setSelectedSchool}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih Sekolah Tujuan..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {schools.map(s => (
                                        <SelectItem key={s._id} value={s._id}>
                                            {s.nama} ({s.kecamatan})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                         </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Nomor SK Mutasi</Label>
                            <Input 
                                value={formData.skNumber} 
                                onChange={e => setFormData(p => ({...p, skNumber: e.target.value}))}
                                required 
                                placeholder="Nomor SK..."
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Tanggal Berlaku (TMT)</Label>
                            <Input 
                                type="date"
                                value={formData.effectiveDate} 
                                onChange={e => setFormData(p => ({...p, effectiveDate: e.target.value}))}
                                required 
                            />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label>Alasan Mutasi</Label>
                        <Input 
                            value={formData.reason} 
                            onChange={e => setFormData(p => ({...p, reason: e.target.value}))}
                            placeholder="Contoh: Permintaan sendiri / Kebutuhan Lembaga"
                        />
                    </div>

                    <DialogFooter>
                        <Button type="submit" disabled={isProcessing}>
                            {isProcessing ? "Memproses..." : "Konfirmasi Mutasi"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
      </div>

      <Card>
          <CardHeader>
              <CardTitle className="flex items-center gap-2"><History className="h-5 w-5"/> Riwayat Mutasi</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
             <Table>
                 <TableHeader>
                     <TableRow>
                         <TableHead>Nama Guru</TableHead>
                         <TableHead>Dari Sekolah</TableHead>
                         <TableHead>Ke Sekolah</TableHead>
                         <TableHead>No. SK</TableHead>
                         <TableHead>TMT</TableHead>
                         <TableHead>Diproses Oleh</TableHead>
                     </TableRow>
                 </TableHeader>
                 <TableBody>
                     {mutations.length === 0 ? (
                         <TableRow>
                             <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                 Belum ada data mutasi.
                             </TableCell>
                         </TableRow>
                     ) : (
                         mutations.map((m: any) => (
                             <TableRow key={m._id}>
                                 <TableCell className="font-medium">{m.teacherName}</TableCell>
                                 <TableCell className="text-red-500">{m.fromUnit}</TableCell>
                                 <TableCell className="text-green-600 font-medium">➡️ {m.toUnit}</TableCell>
                                 <TableCell>{m.skNumber}</TableCell>
                                 <TableCell>{m.effectiveDate}</TableCell>
                                 <TableCell className="text-xs text-muted-foreground">{m.adminName}</TableCell>
                             </TableRow>
                         ))
                     )}
                 </TableBody>
             </Table>
          </CardContent>
      </Card>
    </div>
  )
}
