import { useMemo, useState } from "react"
import { toast } from "sonner"
import { CheckCircle, AlertCircle, Save, ArrowLeft, Loader2, Database, ShieldCheck, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { studentApi } from "@/lib/api"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

interface PreviewStepProps {
    data: any[]
    mapping: Record<string, string>
    onBack: () => void
    onFinish: () => void
}

export function PreviewStep({ data, mapping, onBack, onFinish }: PreviewStepProps) {
    const [isSaving, setIsSaving] = useState(false)
    const queryClient = useQueryClient()

  // Transform Data with Snake Case Mapping for Laravel
  const transformedData = useMemo(() => {
      return data.map((row, idx) => {
          const newRow: Record<string, any> & { _id: number, _errors: string[] } = { _id: idx, _errors: [] }
          Object.entries(mapping).forEach(([targetKey, sourceHeader]) => {
              newRow[targetKey] = row[sourceHeader]
          })

          // Validation Logic
          if (!newRow.nisn) newRow._errors.push("NISN wajib diisi")
          else if (!/^\d{10}$/.test(String(newRow.nisn))) newRow._errors.push("Format NISN salah (10 digit)")

          if (!newRow.nik) newRow._errors.push("NIK wajib diisi")
          else if (!/^\d{16}$/.test(String(newRow.nik))) newRow._errors.push("Format NIK salah (16 digit)")

          if (!newRow.nama) newRow._errors.push("Nama wajib diisi")
          if (!newRow.jenis_kelamin) newRow._errors.push("JK wajib diisi")
          if (!newRow.kelas) newRow._errors.push("Kelas wajib diisi")
          
          if (!newRow.tanggal_lahir) newRow._errors.push("Tgl Lahir wajib diisi")
          if (!newRow.tempat_lahir) newRow._errors.push("Tempat Lahir wajib diisi")

          return newRow
      })
  }, [data, mapping])

  const invalidRows = transformedData.filter(r => r._errors.length > 0)
  const validCount = transformedData.length - invalidRows.length

  const handleSave = async () => {
      setIsSaving(true)
      try {
          const validData = transformedData
            .filter(r => r._errors.length === 0)
            .map((row) => ({
              nisn: String(row.nisn),
              nik: String(row.nik),
              nama: String(row.nama || ''),
              nomor_induk_maarif: row.nomor_induk_maarif ? String(row.nomor_induk_maarif) : undefined,
              jenis_kelamin: row.jenis_kelamin ? String(row.jenis_kelamin) : undefined,
              tempat_lahir: row.tempat_lahir ? String(row.tempat_lahir) : undefined,
              tanggal_lahir: row.tanggal_lahir ? String(row.tanggal_lahir) : undefined,
              alamat: row.alamat ? String(row.alamat) : undefined,
              kecamatan: row.kecamatan ? String(row.kecamatan) : undefined,
              nama_sekolah: row.nama_sekolah ? String(row.nama_sekolah) : undefined,
              kelas: row.kelas ? String(row.kelas) : undefined,
              nomor_telepon: row.nomor_telepon ? String(row.nomor_telepon) : undefined,
              nama_wali: row.nama_wali ? String(row.nama_wali) : undefined,
              status: 'Aktif'
            }))
          
          if (validData.length === 0) {
              toast.error("Tidak ada data valid untuk didispatch")
              return
          }

          // 🔥 REST API Call for bulk import
          const result = await studentApi.import(validData)
          
          queryClient.invalidateQueries({ queryKey: ['students'] })
          queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })

          toast.success(`Sinkronisasi berhasil: ${result.created} entitas terdaftar.`)
          onFinish()
      } catch (err: any) {
          toast.error(err.response?.data?.message || "Internal Engine Error: Gagal sinkronisasi data")
      } finally {
          setIsSaving(false)
      }
  }

  return (
    <div className="space-y-10 py-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
         <div className="flex flex-col gap-2">
            <h3 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900 flex items-center gap-3">
                <Database className="w-6 h-6 text-blue-500" /> Tahap Validasi & Preview
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Verifikasi integritas data sebelum injeksi ke sistem utama</p>
         </div>
         <div className="flex gap-4">
             <div className="h-12 px-6 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center gap-2">
                 <CheckCircle className="h-4 w-4 text-emerald-500"/> 
                 <span className="text-[10px] font-black uppercase text-emerald-700">{validCount} Baris Valid</span>
             </div>
             <div className="h-12 px-6 rounded-2xl bg-rose-50 border border-rose-100 flex items-center gap-2">
                 <AlertCircle className="h-4 w-4 text-rose-500"/> 
                 <span className="text-[10px] font-black uppercase text-rose-700">{invalidRows.length} Baris Anomali</span>
             </div>
         </div>
      </div>

      <Card className="border-0 shadow-sm bg-white rounded-[2.5rem] overflow-hidden">
        <div className="max-h-[500px] overflow-auto custom-scrollbar">
            <Table>
                <TableHeader className="bg-slate-50 sticky top-0 z-10">
                    <TableRow className="border-b border-slate-100">
                        <TableHead className="p-6 text-[10px] font-black uppercase text-slate-400">Idx</TableHead>
                        <TableHead className="p-6 text-[10px] font-black uppercase text-slate-400">NISN / Identitas</TableHead>
                        <TableHead className="p-6 text-[10px] font-black uppercase text-slate-400">Deskripsi Pendidik</TableHead>
                        <TableHead className="p-6 text-[10px] font-black uppercase text-slate-400">Atribut</TableHead>
                        <TableHead className="p-6 text-[10px] font-black uppercase text-slate-400">Status Validitas</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {transformedData.slice(0, 50).map((row, i) => (
                        <TableRow key={row._id} className={cn("hover:bg-slate-50/50 transition-colors", row._errors.length > 0 ? "bg-rose-50/30" : "")}>
                            <TableCell className="p-6 font-black text-slate-300 text-[10px]">{i + 1}</TableCell>
                            <TableCell className="p-6 font-mono font-bold text-xs text-slate-700 italic tracking-tighter">{String(row.nisn || '---')}</TableCell>
                            <TableCell className="p-6 font-black uppercase text-xs text-slate-800">{String(row.nama || '-')}</TableCell>
                            <TableCell className="p-6">
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[9px] font-black text-slate-400 uppercase">JK: {String(row.jenis_kelamin || '-')}</span>
                                    <span className="text-[9px] font-black text-blue-500 uppercase italic">KLS: {String(row.kelas || '-')}</span>
                                </div>
                            </TableCell>
                            <TableCell className="p-6">
                                {row._errors.length > 0 ? (
                                    <div className="flex flex-col gap-1">
                                        {row._errors.map((err, idx) => (
                                            <span key={idx} className="text-[9px] font-black text-rose-500 uppercase flex items-center gap-1 leading-none italic">
                                                <Zap className="w-2.5 h-2.5" /> {err}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[9px] font-black uppercase px-3 italic">Verified OK</Badge>
                                )}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
        <div className="p-6 bg-slate-50/50 border-t flex items-center gap-3">
            <ShieldCheck className="w-4 h-4 text-blue-500" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">Menampilkan 50 entitas pertama dalam buffer memori.</span>
        </div>
      </Card>

      <div className="flex justify-between items-center bg-white p-10 rounded-[2.5rem] shadow-sm">
          <Button variant="ghost" onClick={onBack} disabled={isSaving} className="h-14 px-10 rounded-2xl font-black uppercase text-xs tracking-widest text-slate-400">
              <ArrowLeft className="mr-3 h-5 w-5"/> Abort Operation
          </Button>
          <Button onClick={handleSave} disabled={isSaving || (invalidRows.length > 0 && validCount === 0)} className="h-14 px-12 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-100">
              {isSaving ? <Loader2 className="animate-spin h-5 w-5 mr-3" /> : <Save className="mr-3 h-5 w-5"/>}
              {isSaving ? "Synchronizing..." : `Commit ${validCount} Entities`}
          </Button>
      </div>
    </div>
  )
}
