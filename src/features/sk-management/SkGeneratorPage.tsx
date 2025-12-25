import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { FileDown, Loader2, Search, Archive, BadgeCheck, Settings, CheckCircle } from "lucide-react"
import { useState, useEffect } from "react"
import { saveAs } from "file-saver"
import JSZip from "jszip"
import { Link } from "react-router-dom"

// Mock Zip Generator (Inlined)
export const generateBulkSkZip = async (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _templateFile: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _candidates: any[],
  filename = "SK_Masal_Maarif.zip"
) => {
    // Basic mock implementation to allow build
    const zip = new JSZip()
    // In real app, we would use docxtemplater with _templateFile here
    zip.file("README.txt", "Tanda tangan digital dalam proses.")
    const content = await zip.generateAsync({ type: "blob" })
    saveAs(content, filename)
}

export default function SkGeneratorPage() {
  const [teachers, setTeachers] = useState<any[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState("")
  // const [templateFile, setTemplateFile] = useState<File | null>(null) // Deprecated: Local state
  const [isGenerating, setIsGenerating] = useState(false)
  const [hasStoredTemplate, setHasStoredTemplate] = useState(false)

  // Load teachers from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("app_teachers")
    if (stored) {
      setTeachers(JSON.parse(stored))
    }
    
    // Check for stored template
    if (localStorage.getItem("sk_template_blob")) {
        setHasStoredTemplate(true)
    }
  }, [])

  // Filter logic
  const filteredTeachers = teachers.filter(t => 
    // Only show active teachers
    (t.isActive !== false) &&
    ((t.nama?.toLowerCase() || "").includes(searchTerm.toLowerCase()) || 
    (t.unitKerja?.toLowerCase() || "").includes(searchTerm.toLowerCase()))
  )

  // Selection Logic
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(filteredTeachers.map(t => t.id))
      setSelectedIds(allIds)
    } else {
      setSelectedIds(new Set())
    }
  }

  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  useEffect(() => {
        const u = localStorage.getItem("user")
        if (u) {
            const user = JSON.parse(u)
            setIsSuperAdmin(user.role === "super_admin")
        }
  }, [])
  
  const handleBulkSign = () => {
      // Stub for future bulk sign action
      alert(`Menandatangani ${selectedIds.size} SK secara digital (Simulasi)...`)
  }

  const handleSelectOne = (id: string, checked: boolean) => {
    const next = new Set(selectedIds)
    if (checked) {
      next.add(id)
    } else {
      next.delete(id)
    }
    setSelectedIds(next)
  }

  const handleGenerate = async () => {
    if (!hasStoredTemplate) return alert("Mohon upload template SK (Word) terlebih dahulu di menu Pengaturan.")
    if (selectedIds.size === 0) return alert("Pilih minimal satu data guru.")

    setIsGenerating(true)
    try {
      // Get selected teacher objects
      const selectedData = teachers.filter(t => selectedIds.has(t.id))
      
      // Get Settings for Signers
      const settingsStr = localStorage.getItem("app_settings")
      const settings = settingsStr ? JSON.parse(settingsStr) : {}

      // Map teacher data to template keys clearly
      const mappedData = selectedData.map(t => ({
          ...t,
          NAMA: t.nama,
          NIP: t.nip,
          JABATAN: t.mapel,
          UNIT_KERJA: t.unitKerja,
          STATUS: t.status,
          
          // Inject Global Signers
          KETUA_NAMA: settings.signerKetuaName || "H. Munib",
          KETUA_NIP: settings.signerKetuaNip || "-",
          SEKRETARIS_NAMA: settings.signerSekretarisName || "-",
          SEKRETARIS_NIP: settings.signerSekretarisNip || "-"
      }))
      
      // Retrieve stored blob for generation (mock logic here still just passes "true" essentially)
      // In real implementation: const blob = dataURLtoBlob(localStorage.getItem("sk_template_blob"))
      const templateBlob = "mock_blob" 

      await generateBulkSkZip(templateBlob, mappedData)
      alert("SK berhasil digenerate dan didownload!")
    } catch (error) {
      console.error(error)
      alert("Gagal generate SK: " + error)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-2xl font-bold tracking-tight">Generator SK Masal</h1>
            <p className="text-muted-foreground">Pilih data guru dan terbitkan SK secara otomatis.</p>
        </div>
         <Button variant="outline" asChild>
            <Link to="/dashboard/settings">
                <Settings className="mr-2 h-4 w-4" /> Atur Template & Tanda Tangan
            </Link>
        </Button>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">SK Aktif (Tahun Ini)</TabsTrigger>
          <TabsTrigger value="archive">Arsip SK (Tahun Lalu)</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
            {/* Template Status Indicator */}
            {hasStoredTemplate ? (
                 <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 border border-green-200 rounded-md text-sm">
                    <CheckCircle className="h-4 w-4" />
                    <span className="font-medium">Template SK Siap Digunakan</span>
                    <span className="text-green-600/80">({localStorage.getItem("sk_template_name")})</span>
                 </div>
            ) : (
                <div className="flex items-center gap-2 p-3 bg-amber-50 text-amber-700 border border-amber-200 rounded-md text-sm">
                    <Archive className="h-4 w-4" />
                    <span className="font-medium">Template belum ada.</span>
                    <Link to="/dashboard/settings" className="underline hover:text-amber-800">Upload di Pengaturan</Link>
                </div>
            )}

            {/* Step 2: Select Data (Now Main Step) */}
            <Card>
                <CardHeader className="pb-3 card-header-compact">
                     <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <CardTitle className="text-base">Pilih Data Penerima SK ({selectedIds.size} dipilih)</CardTitle>
                         <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Cari nama..."
                                className="pl-9 w-[250px]"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border max-h-[500px] overflow-auto">
                        <Table>
                            <TableHeader className="bg-slate-50 sticky top-0 z-10">
                                <TableRow>
                                    <TableHead className="w-[50px]">
                                        <Checkbox 
                                            checked={selectedIds.size === filteredTeachers.length && filteredTeachers.length > 0}
                                            onCheckedChange={(c) => handleSelectAll(!!c)}
                                        />
                                    </TableHead>
                                    <TableHead>Nama Lengkap</TableHead>
                                    <TableHead>NIP/NIY</TableHead>
                                    <TableHead>Jabatan</TableHead>
                                    <TableHead>Unit Kerja</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredTeachers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">Data kosong. Lakukan input SK atau upload kolektif dulu.</TableCell>
                                    </TableRow>
                                ) : (
                                    filteredTeachers.map((t) => (
                                        <TableRow key={t.id} data-state={selectedIds.has(t.id) ? "selected" : ""}>
                                            <TableCell>
                                                <Checkbox 
                                                    checked={selectedIds.has(t.id)}
                                                    onCheckedChange={(c) => handleSelectOne(t.id, !!c)}
                                                />
                                            </TableCell>
                                            <TableCell className="font-medium">{t.nama}</TableCell>
                                            <TableCell>{t.nip}</TableCell>
                                            <TableCell>{t.mapel}</TableCell>
                                            <TableCell>{t.unitKerja}</TableCell>
                                            <TableCell>{t.status}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Floating Action Bar for Generation */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white border shadow-lg rounded-full px-6 py-3 flex items-center gap-4 z-50 animate-in slide-in-from-bottom-5">
                    <span className="font-medium">{selectedIds.size} Data Dipilih</span>
                    <Button onClick={handleGenerate} disabled={isGenerating || !hasStoredTemplate}>
                        {isGenerating ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
                        ) : (
                            <><FileDown className="mr-2 h-4 w-4" /> Generate SK Masal</>
                        )}
                    </Button>
                    
                    {isSuperAdmin && (
                        <Button 
                            variant="secondary"
                            className="bg-purple-100 text-purple-700 hover:bg-purple-200"
                            disabled={selectedIds.size === 0 || isGenerating}
                            onClick={handleBulkSign}
                        >
                            <BadgeCheck className="mr-2 h-4 w-4" /> Sign Digital
                        </Button>
                    )}
                </div>
            )}
        </TabsContent>

        <TabsContent value="archive">
            <Card>
                <CardHeader>
                    <CardTitle>Arsip SK Tahun Sebelumnya</CardTitle>
                    <CardDescription>Download arsip surat keputusan dari tahun ajaran yang telah lewat dalam format PDF/ZIP.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {["2023/2024", "2022/2023", "2021/2022"].map(year => (
                        <div key={year} className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition">
                            <div className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded bg-amber-100 flex items-center justify-center">
                                    <Archive className="h-5 w-5 text-amber-600" />
                                </div>
                                <div>
                                    <h4 className="font-semibold">Arsip SK Tahun {year}</h4>
                                    <p className="text-sm text-muted-foreground">Semester Ganjil & Genap • {Math.floor(Math.random() * 50) + 10} MB</p>
                                </div>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => alert(`Mendownload arsip ${year}...`)}>
                                <FileDown className="mr-2 h-4 w-4" /> Download ZIP
                            </Button>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
