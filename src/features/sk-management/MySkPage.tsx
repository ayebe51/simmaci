import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Download, FileText, Search, Loader2 } from "lucide-react"
import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { useQuery } from "@tanstack/react-query"
import { skApi, headmasterApi, authApi, settingApi } from "@/lib/api"
import { getSkVerificationUrl } from "@/utils/verification"

// DOCX Generation Imports
import Docxtemplater from "docxtemplater"
import PizZip from "pizzip"
import ImageModule from "docxtemplater-image-module-free"
import { saveAs } from "file-saver"
import QRCode from "qrcode"

// Helper to base64 to array buffer
function base64DataURLToArrayBuffer(dataURL: string) {
  const base64Regex = /^data:image\/(png|jpg|svg|svg\+xml);base64,/;
  if (!base64Regex.test(dataURL)) return false;
  const stringBase64 = dataURL.replace(base64Regex, "");
  let binaryString;
  if (typeof window !== "undefined") {
    binaryString = window.atob(stringBase64);
  } else {
    binaryString = Buffer.from(stringBase64, "base64").toString("binary");
  }
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export default function MySkPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [skPage, setSkPage] = useState(1)
  const [hmPage, setHmPage] = useState(1)
  
  const user = authApi.getStoredUser()

  // 🔥 REST API QUERIES
  const { data: skData, isLoading: isSkLoading } = useQuery({
    queryKey: ['my-sk-list', searchTerm, skPage],
    queryFn: () => skApi.list({
      status: 'approved',
      search: searchTerm,
      page: skPage,
      per_page: 10
    })
  })

  const { data: hmData, isLoading: isHmLoading } = useQuery({
    queryKey: ['my-hm-list', hmPage],
    queryFn: () => headmasterApi.list({
      page: hmPage,
      per_page: 10
    })
  })

  const handleDownload = async (sk: any) => {
    toast.info("Sedang menyiapkan file DOCX...")
    try {
      const teacherData = sk.teacher || {}
      const jenis = (sk.jenis_sk || "").toLowerCase()
      let templateId = "sk_template_tendik"
      if (jenis.includes("gty") || jenis.includes("tetap yayasan")) templateId = "sk_template_gty";
      else if (jenis.includes("gtt") || jenis.includes("tidak tetap")) templateId = "sk_template_gtt";
      else if (jenis.includes("kepala") || jenis.includes("kamad")) templateId = "sk_template_kamad_nonpns";

      const res = await settingApi.get(templateId)
      if (!res?.value) throw new Error("Template tidak ditemukan")

      const base64 = res.value.split(";base64,")[1] || res.value
      const content = atob(base64)

      const verificationUrl = getSkVerificationUrl(sk.nomor_sk)
      const qrDataUrl = await QRCode.toDataURL(verificationUrl, { width: 400, margin: 1 })

      const renderData = {
        ...teacherData,
        ...sk,
        NAMA: sk.nama?.toUpperCase(),
        NOMOR_SURAT: sk.nomor_sk,
        qrcode: qrDataUrl
      }

      const pzip = new PizZip(content)
      const doc = new Docxtemplater(pzip, {
        paragraphLoop: true,
        linebreaks: true,
        modules: [new ImageModule({
           getImage: (tag: string) => base64DataURLToArrayBuffer(tag),
           getSize: () => [100, 100]
        })],
        nullGetter: () => ""
      })

      doc.render(renderData)
      const out = doc.getZip().generate({ type: "blob" })
      saveAs(out, `SK_${sk.nama.replace(/\s+/g, "_")}.docx`)
      toast.success("Dokumen berhasil diunduh")
    } catch (e: any) {
      toast.error("Gagal mengunduh SK: " + e.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight text-blue-900 uppercase">Arsip SK Unit Kerja</h1>
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">
           Daftar SK Digital Madrasah: <span className="text-blue-600">{user?.unitKerja || "Seluruh Unit"}</span>
        </p>
      </div>

      <Card className="border-0 shadow-sm bg-white rounded-[2.5rem] overflow-hidden">
        <CardHeader className="p-10 border-b bg-slate-50/50">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                <div>
                    <CardTitle className="text-xl font-black text-slate-800 uppercase tracking-tight">Daftar Dokumen Terbit</CardTitle>
                    <CardDescription className="text-sm font-medium text-slate-400">Arsip SK yang sudah disetujui dan ditandatangani.</CardDescription>
                </div>
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                    <Input 
                        placeholder="Nama atau nomor SK..." 
                        className="pl-10 h-11 border-slate-200 bg-white rounded-xl text-xs font-bold"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
        </CardHeader>
        <CardContent className="p-0">
            <Table>
                <TableHeader className="bg-slate-50/50">
                    <TableRow className="border-slate-100">
                        <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-widest py-5 pl-10">Nomor SK</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-widest py-5">Nama Guru / PTK</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-widest py-5">Jabatan</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-widest py-5">Status</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-widest py-5 text-right pr-10">Unduh</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isSkLoading ? (
                        <TableRow><TableCell colSpan={5} className="h-40 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500"/></TableCell></TableRow>
                    ) : skData?.data?.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="h-40 text-center opacity-30 text-xs font-bold uppercase tracking-widest">Belum ada SK terbit</TableCell></TableRow>
                    ) : (
                        skData.data.map((sk: any) => (
                            <TableRow key={sk.id} className="hover:bg-slate-50/50 border-slate-50">
                                <TableCell className="pl-10 py-5">
                                    <div className="flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-blue-500" />
                                        <span className="font-mono text-xs font-bold">{sk.nomor_sk}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="font-bold text-slate-800 text-sm">{sk.nama}</TableCell>
                                <TableCell className="text-xs text-slate-500 font-medium">{sk.jabatan}</TableCell>
                                <TableCell>
                                    <Badge className="bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase tracking-tight py-1 px-3 rounded-lg hover:bg-emerald-100">Approved</Badge>
                                </TableCell>
                                <TableCell className="text-right pr-10">
                                    <Button size="icon" variant="ghost" onClick={() => handleDownload(sk)} className="h-9 w-9 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50">
                                        <Download className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>

            {!isSkLoading && skData?.total > 10 && (
                <div className="p-8 bg-slate-50/50 flex items-center justify-between border-t border-slate-100">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Halaman {skPage} dari {Math.ceil(skData.total / 10)}</span>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setSkPage(p => Math.max(1, p - 1))} disabled={skPage === 1} className="rounded-xl h-9 px-4">Sebelumnya</Button>
                        <Button variant="outline" size="sm" onClick={() => setSkPage(p => p + 1)} disabled={skPage >= Math.ceil(skData.total / 10)} className="rounded-xl h-9 px-4">Berikutnya</Button>
                    </div>
                </div>
            )}
        </CardContent>
      </Card>

      {/* --- SECTION FOR HEADMASTER SK --- */}
      <Card className="border-0 shadow-sm bg-white rounded-[2.5rem] overflow-hidden mt-12">
        <CardHeader className="p-10 border-b bg-slate-50/50">
             <CardTitle className="text-xl font-black text-slate-800 uppercase tracking-tight">Riwayat Pengangkatan Kepala Madrasah</CardTitle>
             <CardDescription className="text-sm font-medium text-slate-400">Status pengajuan dan jabatan struktural Kamad.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
             <Table>
                <TableHeader className="bg-slate-50/50">
                    <TableRow className="border-slate-100">
                        <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-widest py-5 pl-10">Nama Kepala</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-widest py-5">Periode</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-widest py-5">Status</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-widest py-5 text-right pr-10">Berkas</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isHmLoading ? (
                        <TableRow><TableCell colSpan={4} className="h-32 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-500"/></TableCell></TableRow>
                    ) : hmData?.data?.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="h-40 text-center opacity-30 text-xs font-bold uppercase tracking-widest">Tidak ada record Kamad</TableCell></TableRow>
                    ) : (
                        hmData.data.map((item: any) => (
                            <TableRow key={item.id} className="hover:bg-slate-50/50 border-slate-50">
                                <TableCell className="pl-10 py-5">
                                    <div className="font-bold text-slate-800 text-sm">{item.teacher?.nama}</div>
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{item.school?.nama}</div>
                                </TableCell>
                                <TableCell className="text-xs font-bold text-slate-600">Periode Ke-{item.periode}</TableCell>
                                <TableCell>
                                     <Badge className={`rounded-lg py-1 px-3 text-[9px] font-black uppercase tracking-tight ${
                                        item.status === 'active' ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" :
                                        "bg-amber-100 text-amber-700 hover:bg-amber-100"
                                     }`}>
                                        {item.status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right pr-10">
                                    {item.sk_url ? (
                                        <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl text-blue-600 bg-blue-50" onClick={() => window.open(item.sk_url, '_blank')}>
                                            <Download className="w-4 h-4" />
                                        </Button>
                                    ) : <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Belum Ada</span>}
                                </TableCell>
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
