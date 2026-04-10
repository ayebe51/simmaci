import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, FileSpreadsheet, CheckCircle, Upload } from "lucide-react"
import { useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import * as XLSX from "xlsx"
import { saveAs } from "file-saver"
import { skApi, teacherApi, mediaApi, authApi } from "@/lib/api"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useNavigate } from "react-router-dom"
import { useMutation } from "@tanstack/react-query"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"

export function BulkSkSubmission() {
  const navigate = useNavigate()
  const user = authApi.getStoredUser()
  
  const [candidates, setCandidates] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isFullSync, setIsFullSync] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  
  const [suratPermohonanFile, setSuratPermohonanFile] = useState<File | null>(null)
  const [nomorPermohonanUi, setNomorPermohonanUi] = useState("")
  const [tanggalPermohonanUi, setTanggalPermohonanUi] = useState("")

  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [successCount, setSuccessCount] = useState(0)

  // Mapping Configuration
  const HEADER_MAP: Record<string, string[]> = {
    "nama": ["nama", "nama lengkap", "nama guru"],
    "tempat_lahir": ["tempat lahir", "tmp lahir"],
    "tanggal_lahir": ["tanggal lahir", "tgl lahir", "tgl. lahir"],
    "nip": ["nip", "niy", "nomor induk", "n.i.y", "pegid"],
    "nuptk": ["nuptk"],
    "pendidikan_terakhir": ["pendidikan terakhir", "pendidikan", "ijazah terakhir"],
    "unit_kerja": ["unit kerja", "satminkal", "tempat tugas", "lembaga", "nama madrasah", "sekolah"],
    "tmt": ["tanggal mulai tugas", "tmt", "mulai tugas", "tgl masuk", "tmt guru"],
    "status": ["status", "status kepegawaian", "status guru"],
    "pdpkpnu": ["pdpkpnu", "pkpnu", "diklat"],
    "kecamatan": ["kecamatan", "kec"],
  }

  const handleDownloadTemplate = () => {
    const headers = ["Nama", "Tempat Lahir", "Tanggal Lahir", "NUPTK", "NIP/NIY", "Pendidikan Terakhir", "Unit Kerja", "TMT", "Status", "PDPKPNU", "Kecamatan"];
    const ws = XLSX.utils.aoa_to_sheet([headers, ["Ahmad Contoh", "Cilacap", "1990-05-12", "1234567890123456", "123456789", "S1 PAI", "MI Ma'arif 01", "2015-07-01", "GTY", "Lulus", "Cilacap Selatan"]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buf], { type: "application/octet-stream" }), "Template_Bulk_SK.xlsx");
  }

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return;

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "binary" })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][]
        
        if (rows.length < 2) throw new Error("File tidak memiliki baris data")

        const headers = rows[0].map(h => String(h).toLowerCase().trim())
        const colMap: Record<string, number> = {}

        Object.entries(HEADER_MAP).forEach(([key, aliases]) => {
          const idx = headers.findIndex(h => aliases.some(a => h.includes(a)))
          if (idx !== -1) colMap[key] = idx
        })

        const data = rows.slice(1).map(row => {
          const obj: any = {}
          Object.entries(colMap).forEach(([key, idx]) => {
            let val = row[idx]
            if (key.includes('tanggal') || key === 'tmt') {
               // Basic date handling
               if (typeof val === 'number') {
                  const d = new Date((val - 25569) * 86400 * 1000)
                  val = d.toISOString().split('T')[0]
               }
            }
            obj[key] = val
          })
          return obj
        }).filter(o => o.nama)

        setCandidates(data)
        setUploadError(null)
      } catch (err: any) {
        setUploadError(err.message)
      }
    }
    reader.readAsBinaryString(file)
  }

  const importMutation = useMutation({
    mutationFn: (data: { documents: any[], surat_permohonan_url: string }) => skApi.bulkRequest(data),
    onSuccess: (res) => {
      setSuccessCount(res.count || res.created || 0)
      setShowSuccessModal(true)
    },
    onError: (err: any) => {
      toast.error("Gagal mengirim pengajuan: " + (err.response?.data?.message || err.message))
      setIsProcessing(false)
    }
  })

  const handleSubmit = async () => {
    if (candidates.length === 0) {
      toast.error("Belum ada data guru yang diupload.")
      return
    }
    if (!suratPermohonanFile) {
      toast.error("Wajib mengunggah Surat Permohonan resmi (PDF).")
      return
    }

    setIsProcessing(true)
    try {
      toast.loading("Mengunggah surat permohonan...", { id: 'bulk-upload' })
      const uploadRes = await mediaApi.upload(suratPermohonanFile, 'permohonan-kolektif')
      const permohonanUrl = uploadRes.url

      toast.loading(`Memproses ${candidates.length} data...`, { id: 'bulk-upload' })
      const documents = candidates.map(c => ({
        ...c,
        status_kepegawaian: c.status || 'GTY',
        nomor_permohonan:   nomorPermohonanUi || undefined,
        tanggal_permohonan: tanggalPermohonanUi || undefined
      }))

      await importMutation.mutateAsync({ documents, surat_permohonan_url: permohonanUrl })
      toast.dismiss('bulk-upload')
    } catch (e: any) {
      toast.dismiss('bulk-upload')
      toast.error("Gagal memproses: " + (e.response?.data?.message || e.message))
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Card className="border-0 shadow-sm bg-white rounded-[2.5rem] overflow-hidden">
      <CardHeader className="p-10 border-b bg-slate-50/50">
        <CardTitle className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
            <span className="p-2 bg-blue-100 rounded-lg text-blue-600"><Upload className="h-5 w-5" /></span>
            Pengajuan Kolektif (Excel)
        </CardTitle>
        <CardDescription className="font-medium text-slate-400">
          Upload daftar guru untuk pengajuan SK massal. Data akan masuk sebagai antrian verifikasi.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-10 space-y-10">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-6">
                <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Langkah 1: Download Template</Label>
                    <Button variant="outline" onClick={handleDownloadTemplate} className="w-full h-14 rounded-2xl border-dashed border-2 border-emerald-200 hover:bg-emerald-50 text-emerald-700 font-bold uppercase text-xs tracking-widest">
                        <FileSpreadsheet className="mr-2 h-5 w-5" /> Download format .xlsx
                    </Button>
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-100">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Langkah 2: Upload Data Guru</Label>
                    <div className="flex flex-col gap-2">
                        <Input type="file" accept=".xlsx, .xls" onChange={handleExcelUpload} className="h-14 rounded-2xl border-slate-200 file:bg-slate-100 file:border-0 file:rounded-xl file:text-[10px] file:font-black file:uppercase file:mr-4 file:h-8 hover:file:bg-slate-200" />
                        {uploadError && <p className="text-[10px] font-bold text-red-500 uppercase">{uploadError}</p>}
                    </div>
                </div>
            </div>

             <div className="space-y-6 bg-slate-50/50 p-6 rounded-[2rem] border-2 border-dashed border-blue-200">
                  <Label className="text-[10px] font-black uppercase text-blue-600 tracking-widest flex items-center gap-2">
                    Langkah 3: Berkas Permohonan Resmi <span className="text-red-500">*</span>
                  </Label>
                 <div className="space-y-4">
                    <Input type="file" accept=".pdf" onChange={(e) => setSuratPermohonanFile(e.target.files?.[0] || null)} className="h-12 rounded-xl bg-white border-slate-200" />
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase text-slate-400">No. Surat</Label>
                            <Input placeholder="Nomor..." value={nomorPermohonanUi} onChange={e => setNomorPermohonanUi(e.target.value)} className="h-10 rounded-xl bg-white" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase text-slate-400">Tgl. Surat</Label>
                            <Input type="date" value={tanggalPermohonanUi} onChange={e => setTanggalPermohonanUi(e.target.value)} className="h-10 rounded-xl bg-white" />
                        </div>
                    </div>
                 </div>
            </div>
        </div>

        {candidates.length > 0 && (
            <div className="space-y-6 pt-6 border-t border-slate-100">
                <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black uppercase text-blue-600 tracking-widest flex items-center gap-2">
                        <CheckCircle className="h-3 w-3" /> Terdeteksi {candidates.length} data valid
                    </h4>
                </div>
                <div className="rounded-2xl border border-slate-100 overflow-hidden">
                    <Table>
                        <TableHeader className="bg-slate-50">
                            <TableRow>
                                <TableHead className="text-[9px] font-black uppercase py-4 pl-6">Nama</TableHead>
                                <TableHead className="text-[9px] font-black uppercase py-4">Unit Kerja</TableHead>
                                <TableHead className="text-[9px] font-black uppercase py-4">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {candidates.slice(0, 5).map((row, i) => (
                                <TableRow key={i}>
                                    <TableCell className="pl-6 font-bold text-xs">{row.nama}</TableCell>
                                    <TableCell className="text-xs text-slate-500">{row.unit_kerja}</TableCell>
                                    <TableCell className="text-[10px] font-black text-blue-500 uppercase">{row.status || 'GTY'}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        )}

        <div className="pt-10 flex items-center justify-between border-t border-slate-100">
            <div className="flex items-center space-x-3">
                <Checkbox id="fullSync" checked={isFullSync} onCheckedChange={(c) => setIsFullSync(!!c)} />
                <Label htmlFor="fullSync" className="text-[10px] font-black uppercase text-slate-400 tracking-widest cursor-pointer hover:text-slate-600 transition-colors">Sinkronisasi Penuh</Label>
            </div>
            <Button onClick={handleSubmit} disabled={isProcessing || candidates.length === 0} className="h-14 px-12 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-100">
                {isProcessing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
                Proses {candidates.length} Data
            </Button>
        </div>

      </CardContent>

      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="rounded-[2.5rem] p-10">
          <DialogHeader className="text-center space-y-4">
            <div className="mx-auto bg-emerald-100 w-16 h-16 rounded-full flex items-center justify-center mb-2">
                <CheckCircle className="h-8 w-8 text-emerald-600" />
            </div>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight">Impor Berhasil!</DialogTitle>
            <DialogDescription className="font-medium text-slate-500">
              Berhasil mengirim pengajuan SK untuk {successCount} orang. Mohon tunggu verifikasi dari Admin LP Ma'arif.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6">
            <Button onClick={() => navigate("/dashboard/sk")} className="w-full h-12 rounded-xl bg-slate-900 text-white font-bold uppercase text-xs tracking-widest">
              Kembali ke Dashboard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function Save(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  )
}
