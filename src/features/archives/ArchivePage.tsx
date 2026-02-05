import { useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { FileText, Upload, Trash2, Eye, AlertTriangle } from "lucide-react"

export default function ArchivePage() {
  const [isOpen, setIsOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  
  // Delete State
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  
  // Search State
  const [searchTerm, setSearchTerm] = useState("")

  // Form State
  const [formData, setFormData] = useState({
    nomorSk: "",
    title: "",
    year: new Date().getFullYear().toString(),
    category: "sk_kepala",
    file: null as File | null
  })

  // Auth
  const token = localStorage.getItem("token")
  const user = JSON.parse(localStorage.getItem("user") || "{}")
  // const isOperator = user.role === "operator" // Unused variable
  
  // Data Fetching
  const archives = useQuery(api.archives.list, { 
      token: token || undefined,
  }) || []

  // Mutations
  const generateUploadUrl = useMutation(api.archives.generateUploadUrl)
  const createArchive = useMutation(api.archives.create)
  const removeArchive = useMutation(api.archives.remove)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          setFormData(prev => ({ ...prev, file: e.target.files![0] }))
      }
  }

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault()
      if (!formData.file || !formData.title || !formData.nomorSk) return
      
      setIsUploading(true)
      try {
           // 1. Get URL
           const postUrl = await generateUploadUrl()
           
           // 2. Upload File
           const result = await fetch(postUrl, {
               method: "POST",
               headers: { "Content-Type": formData.file.type },
               body: formData.file,
           })
           const { storageId } = await result.json()
           
           // 3. Save Record
           await createArchive({
               token: token!,
               schoolId: user.unitKerja as any, 
               nomorSk: formData.nomorSk,
               title: formData.title,
               year: formData.year,
               category: formData.category,
               storageId: storageId,
               fileUrl: `${(import.meta as any).env.VITE_CONVEX_URL}/api/storage/${storageId}`,
           })
           
           toast.success("Arsip berhasil diunggah")
           setIsOpen(false)
           setFormData({
               nomorSk: "",
               title: "",
               year: new Date().getFullYear().toString(),
               category: "sk_kepala",
               file: null
           })

      } catch (err) {
          console.error(err)
          toast.error("Gagal mengunggah arsip")
      } finally {
          setIsUploading(false)
      }
  }

  const handleConfirmDelete = async () => {
      if (!deleteId) return
      
      setIsDeleting(true)
      try {
          await removeArchive({ token: token!, id: deleteId as any })
          toast.success("Arsip dihapus")
          setDeleteId(null)
      } catch (err) {
          console.error(err) // Kept for debugging
          toast.error("Gagal menghapus")
      } finally {
          setIsDeleting(false)
      }
  }

  // Filter
  const filteredArchives = archives.filter(a => 
      a.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      a.nomorSk.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getCategoryBadge = (cat: string) => {
      switch(cat) {
          case 'sk_kepala': return <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">SK Kepala</Badge>
          case 'sk_guru': return <Badge variant="default" className="bg-green-600 hover:bg-green-700">SK Guru</Badge>
          default: return <Badge variant="secondary">{cat.replace('_', ' ')}</Badge>
      }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-2xl font-bold tracking-tight">Arsip Digital SK</h1>
            <p className="text-muted-foreground">Penyimpanan terpusat dokumen SK lama.</p>
        </div>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button><Upload className="mr-2 h-4 w-4" /> Upload Arsip Baru</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Upload Dokumen SK</DialogTitle>
                    <DialogDescription>Pastikan file hasil scan jelas (PDF/JPG, Max 5MB).</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid gap-2">
                        <Label>Nomor SK</Label>
                        <Input 
                            value={formData.nomorSk} 
                            onChange={e => setFormData(p => ({...p, nomorSk: e.target.value}))}
                            placeholder="Contoh: 005/SK/..."
                            required 
                        />
                    </div>
                    <div className="grid gap-2">
                         <Label>Judul / Perihal</Label>
                         <Input 
                            value={formData.title} 
                            onChange={e => setFormData(p => ({...p, title: e.target.value}))}
                            placeholder="Contoh: SK Pengangkatan Kamad 2019"
                            required 
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Tahun SK</Label>
                            <Input 
                                type="number"
                                value={formData.year} 
                                onChange={e => setFormData(p => ({...p, year: e.target.value}))}
                                required 
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Kategori</Label>
                            <Select value={formData.category} onValueChange={v => setFormData(p => ({...p, category: v}))}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="sk_kepala">SK Kepala Madrasah</SelectItem>
                                    <SelectItem value="sk_guru">SK Guru Tetap</SelectItem>
                                    <SelectItem value="other">Lainnya</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <Label>File Scan</Label>
                        <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange} required />
                    </div>
                    
                    <DialogFooter>
                        <Button type="submit" disabled={isUploading}>
                            {isUploading ? "Mengunggah..." : "Simpan Arsip"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2">
          <Input 
             placeholder="Cari nomor SK atau judul..." 
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
             className="max-w-sm"
          />
      </div>

      <Card>
          <CardContent className="p-0">
             <Table>
                 <TableHeader>
                     <TableRow>
                         <TableHead className="w-[50px]"></TableHead>
                         <TableHead>Nomor SK</TableHead>
                         <TableHead>Judul</TableHead>
                         <TableHead>Tahun</TableHead>
                         <TableHead>Kategori</TableHead>
                         <TableHead className="text-right">Aksi</TableHead>
                     </TableRow>
                 </TableHeader>
                 <TableBody>
                     {filteredArchives.length === 0 ? (
                         <TableRow>
                             <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                 Belum ada arsip dokumen yang sesuai.
                             </TableCell>
                         </TableRow>
                     ) : (
                         filteredArchives.map((archive) => (
                             <TableRow key={archive._id}>
                                 <TableCell>
                                     <FileText className="h-5 w-5 text-muted-foreground" />
                                 </TableCell>
                                 <TableCell className="font-medium text-nowrap">{archive.nomorSk}</TableCell>
                                 <TableCell>{archive.title}</TableCell>
                                 <TableCell>{archive.year}</TableCell>
                                 <TableCell>
                                     {getCategoryBadge(archive.category)}
                                 </TableCell>
                                 <TableCell className="text-right">
                                     <div className="flex justify-end gap-2">
                                         <Button variant="ghost" size="icon" asChild title="Lihat">
                                             <a href={archive.fileUrl} target="_blank" rel="noreferrer">
                                                 <Eye className="h-4 w-4 text-blue-600" />
                                             </a>
                                         </Button>
                                         <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="text-red-500 hover:text-red-700 hover:bg-red-50" 
                                            onClick={() => setDeleteId(archive._id)}
                                            title="Hapus"
                                         >
                                             <Trash2 className="h-4 w-4" />
                                         </Button>
                                     </div>
                                 </TableCell>
                             </TableRow>
                         ))
                     )}
                 </TableBody>
             </Table>
          </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-600">
                    <AlertTriangle className="h-5 w-5" />
                    Konfirmasi Hapus
                </DialogTitle>
                <DialogDescription>
                    Apakah Anda yakin ingin menghapus arsip ini? Tindakan ini tidak dapat dibatalkan dan file akan hilang permanen.
                </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setDeleteId(null)}>Batal</Button>
                <Button variant="destructive" onClick={handleConfirmDelete} disabled={isDeleting}>
                    {isDeleting ? "Menghapus..." : "Ya, Hapus Permanen"}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
