import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, CheckCircle, FileText, AlertTriangle, XCircle, Printer } from "lucide-react"
import { useNavigate, useParams } from "react-router-dom"
import StatusBadge from "@/components/shared/StatusBadge"
import type { StatusType } from "@/components/shared/StatusBadge"
import { useState } from "react"
import { Separator } from "@/components/ui/separator"
// 🔥 CONVEX REAL-TIME
import { useQuery, useMutation, useConvex } from "convex/react"
import { api as convexApi, api } from "../../../convex/_generated/api"
import { Id } from "../../../convex/_generated/dataModel"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2, Download } from "lucide-react"

// DOCX Generation Imports
import Docxtemplater from "docxtemplater"
import PizZip from "pizzip"
import ImageModule from "docxtemplater-image-module-free"
import { saveAs } from "file-saver"
import QRCode from "qrcode"

// Helper to base64 to array buffer
function base64DataURLToArrayBuffer(dataURL: string) {
  const stringBase64 = dataURL.replace(/^data:image\/[a-z]+;base64,/, "");
  let binaryString;
  if (typeof window !== "undefined") {
    binaryString = window.atob(stringBase64);
  } else {
    binaryString = new Buffer(stringBase64, "base64").toString("binary");
  }
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Helper: Add 1 year to Indonesian Date String
const addOneYearIndonesian = (dateStr: string) => {
    if (!dateStr || dateStr === "-") return "-"
    try {
        const parts = dateStr.split(" ")
        if (parts.length < 3) return dateStr
        const year = parseInt(parts[parts.length - 1])
        if (isNaN(year)) return dateStr
        parts[parts.length - 1] = (year + 1).toString()
        return parts.join(" ")
    } catch {
        return dateStr
    }
}

interface SkDetail {
  id: string
  nomorSurat: string
  jenis: string
  nama: string
  niy: string
  unitKerja: string
  jenisPengajuan: string
  status: string // Raw backend status
  createdAt: string
  fileUrl?: string
  keterangan?: string
}

export default function SkDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  
  // 🔥 REAL-TIME CONVEX QUERY - Auto-updates!
  const skDoc = useQuery(convexApi.sk.get, 
    id ? { id: id as Id<"skDocuments"> } : "skip"
  )
  
  // Mutations & Client
  const updateSk = useMutation(convexApi.sk.update)
  const convex = useConvex()
  
  // ✅ CHECK ACTUAL USER ROLE from localStorage
  const [isAdmin] = useState(() => {
    try {
      const userStr = localStorage.getItem("user")
      if (!userStr) return false
      const user = JSON.parse(userStr)
      // super_admin AND admin_yayasan can approve/reject SK
      return ["super_admin", "admin_yayasan"].includes(user.role)
    } catch {
      return false
    }
  })

  // Confirmation Dialog State
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<"approve" | "reject" | "revise" | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  
  // Helper to map Convex status to frontend badge status
  const getBadgeStatus = (backendStatus: string): StatusType => {
      const lower = backendStatus?.toLowerCase() || "";
      if (lower === "pending" || lower === "draft") return "submitted";
      if (lower === "approved" || lower === "active") return "issued";
      if (lower === "rejected" || lower === "archived") return "rejected";
      return "draft";
  }

  // Map Convex document to SkDetail interface
  const sk: SkDetail | null = skDoc ? {
    id: skDoc._id,
    nomorSurat: skDoc.nomorSk,
    jenis: skDoc.jenisSk,
    nama: skDoc.nama,
    niy: "", // Not in Convex schema, infer from teacher if needed
    unitKerja: skDoc.unitKerja || "-",
    jenisPengajuan: skDoc.jenisSk, // Same as jenis
    status: skDoc.status,
    createdAt: new Date(skDoc.createdAt).toISOString(),
    fileUrl: skDoc.fileUrl,
    keterangan: "" // Not in schema yet
  } : null

  const isLoading = skDoc === undefined

  const handleAction = (action: "approve" | "reject" | "revise") => {
      setPendingAction(action)
      setIsConfirmOpen(true)
  }

  const executeAction = async () => {
      if (!pendingAction || !id) return
      
      const confirmMsg = pendingAction === 'approve' ? 'Menyetujui' : pendingAction === 'reject' ? 'Menolak' : 'Merevisi';
      
      try {
          setIsProcessing(true)
          let status = "";
          if (pendingAction === "approve") status = "active";
          else if (pendingAction === "reject") status = "archived";
          else if (pendingAction === "revise") status = "draft";

          await updateSk({ 
            id: id as Id<"skDocuments">, 
            status: status 
          });
          
          toast.success(`SK Berhasil di-${status}`);
          setIsConfirmOpen(false)
          setPendingAction(null)
      } catch (e: any) {
          console.error("[ERROR] executeAction failed:", e);
          toast.error(`Gagal memproses tindakan: ${e?.message || "Error tidak diketahui"}`);
      } finally {
          setIsProcessing(false)
      }
  }

  // --- DOCX GENERATION FUNCTION ---
  const handleDownloadDocx = async () => {
       if (!skDoc || !sk) return;
       setIsProcessing(true);
       toast.info("Sedang menyiapkan file DOCX...");

       try {
           const teacherData: any = skDoc.teacher || {};
           
           // Determine Template ID
           const jenis = (skDoc.jenisSk || skDoc.status || "").toLowerCase();
           const jabatan = (teacherData.jabatan || "").toLowerCase();
           const nip = (teacherData.nip || "").replace(/[^0-9]/g, "");
           let templateId = "sk_template_tendik";
           if (jenis.includes("tetap yayasan") || jenis.includes("gty")) templateId = "sk_template_gty";
           else if (jenis.includes("tidak tetap") || jenis.includes("gtt")) templateId = "sk_template_gtt";
           else if (jenis.includes("kepala") || jenis.includes("kamad")) {
                const isPns = nip.length > 10 || (teacherData.statusKepegawaian || "").includes("PNS") || (teacherData.statusKepegawaian || "").includes("ASN");
                if (jabatan.includes("plt") || jabatan.includes("pelaksana")) templateId = "sk_template_kamad_plt";
                else if (isPns) templateId = "sk_template_kamad_pns";
                else templateId = "sk_template_kamad_nonpns";
           }

           // Fetch Template (LocalStorage first, then Cloud)
           let base64Template = localStorage.getItem(templateId + "_blob");
           if (!base64Template) {
               const result = await convex.query(api.settings_cloud.getContent, { key: templateId });
               if (result && !result.startsWith("http")) {
                    base64Template = result.includes(";base64,") ? result : "data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64," + result;
               }
           }

           if (!base64Template) {
               toast.error(`Template tidak ditemukan (ID: ${templateId}). Harap atur di menu Pengaturan terlebih dahulu.`);
               setIsProcessing(false);
               return;
           }

           const block = base64Template.split(";base64,");
           const realData = block[1] ? block[1] : base64Template;
           const content = atob(realData);

           // Generate QR
           const verificationUrl = `${window.location.origin}/verify/${skDoc._id}`;
           const qrDataUrl = await QRCode.toDataURL(verificationUrl, { width: 400, margin: 1 });

           // Load Zip
           const pzip = new PizZip(content);
           const imageOpts = {
               getImage: (tagValue: string) => base64DataURLToArrayBuffer(tagValue),
               getSize: (img: unknown, tagValue: string, tagName: string) => [100, 100],
           };
           const imageModule = new ImageModule(imageOpts);

           const doc = new Docxtemplater(pzip, {
               paragraphLoop: true,
               linebreaks: true,
               modules: [imageModule],
               nullGetter: () => ""
           });

           // Format Dates Helper
           const formatIndoDate = (dateStr: string | undefined | null) => {
                if (!dateStr) return "-";
                try {
                    const d = new Date(dateStr);
                    if (!isNaN(d.getTime())) {
                        return d.toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' });
                    }
                } catch (e) {}
                return dateStr;
           };

           const addOneYearIndonesian = (dateStr: string) => {
               if (!dateStr || dateStr === "-") return "-";
               try {
                   const parts = dateStr.split(" ");
                   if (parts.length < 3) return dateStr;
                   const year = parseInt(parts[parts.length - 1]);
                   if (isNaN(year)) return dateStr;
                   parts[parts.length - 1] = (year + 1).toString();
                   return parts.join(" ");
               } catch {
                   return dateStr;
               }
           };

           const ttlDate = formatIndoDate(teacherData.tanggalLahir);
           const ttlValid = teacherData.tempatLahir || teacherData.tanggalLahir;
           const ttl = ttlValid ? `${teacherData.tempatLahir || ""}${teacherData.tempatLahir && teacherData.tanggalLahir ? ', ' : ''}${ttlDate !== "-" ? ttlDate : ""}` : "-";
           const tmtFormatted = formatIndoDate(teacherData.tmtPendidik || teacherData.tmt);
           const tanggalPenetapanFormatted = formatIndoDate(skDoc.tanggalPenetapan);

           // Extract pure 4-digit sequence from long nomorSk to prevent double numbering
           const rawNomor = skDoc.nomorSk || "-";
           const seqMatch = rawNomor.match(/^(\d{1,4})/);
           const sequenceOnly = seqMatch ? seqMatch[1] : rawNomor;

           // Align variables exactly with SkGeneratorPage (Kitchen Sink)
           const renderData: any = {
               ...skDoc,
               ...teacherData,
               
               // NAMA
               nama: skDoc.nama || "-",
               Nama: skDoc.nama || "-",
               NAMA: skDoc.nama?.toUpperCase() || "-",
               NAMA_LENGKAP: skDoc.nama || "-",
               NAMA_GURU: skDoc.nama || "-",

               // NOMOR SK
               nomor_sk: rawNomor,
               Nomor_SK: rawNomor,
               NOMOR_SURAT: rawNomor,
               NOMOR: sequenceOnly,
               nomor_induk: teacherData.nuptk || teacherData.nip || "-",
               NOMOR_INDUK: teacherData.nuptk || teacherData.nip || "-",
               "NOMOR INDUK MAARIF": teacherData.nuptk || teacherData.nip || "-",
               "NOMOR INDUK MA'ARIF": teacherData.nuptk || teacherData.nip || "-",
               "NOMOR INDUK MA’ARIF": teacherData.nuptk || teacherData.nip || "-",

               // BIODATA
               tempatLahir: teacherData.tempatLahir || "-",
               tanggalLahir: ttlDate,
               tanggallahir: ttlDate,
               ttl: ttl,
               TTL: ttl,
               "TEMPAT/TANGGAL LAHIR": ttl,
               "TEMPAT, TANGGAL LAHIR": ttl,
               
               // IDS
               nuptk: teacherData.nuptk || "-",
               NUPTK: teacherData.nuptk || "-",
               nip: teacherData.nip || teacherData.nuptk || "-",
               NIP: teacherData.nip || teacherData.nuptk || "-",

               // PEKERJAAN
               unitKerja: skDoc.unitKerja || "-",
               unit_kerja: skDoc.unitKerja || "-",
               Unit_Kerja: skDoc.unitKerja || "-",
               UNIT_KERJA: skDoc.unitKerja || "-",
               "UNIT KERJA": skDoc.unitKerja || "-",
               KECAMATAN: teacherData.kecamatan || ".....",
               
               jabatan: skDoc.jabatan || teacherData.jabatan || teacherData.mapel || "Guru",
               JABATAN: skDoc.jabatan || teacherData.jabatan || teacherData.mapel || "Guru",
               
               pendidikanTerakhir: teacherData.pendidikanTerakhir || "-",
               pendidikan: teacherData.pendidikanTerakhir || "-",
               PENDIDIKAN: teacherData.pendidikanTerakhir || "-",
               jurusan: teacherData.jurusan || "-",
               pangkat: teacherData.pangkat || "-",
               golongan: teacherData.golongan || "-",

               // TMT
               tmtPendidik: tmtFormatted,
               tmt: tmtFormatted,
               TMT: tmtFormatted,
               TANGGAL_MULAI_TUGAS: tmtFormatted,
               TGL_MULAI_TUGAS: tmtFormatted,

               // JENIS SK
               jenisSk: skDoc.jenisSk || "-",
               jenis_sk: skDoc.jenisSk?.toUpperCase() || "-",
               Jenis_SK: skDoc.jenisSk || "-",
               mengingat_tambahan: skDoc.jenisSk?.includes("GTY") ? "Kekurangan Guru" : "-",
               status: skDoc.status || teacherData.status || "-",
               STATUS: skDoc.status || teacherData.status || "-",

               // PERMOHONAN & TAHUN
               "NOMOR SURAT PERMOHONAN": "-",
               "TANGGAL SURAT PERMOHONAN": "-",
               "TAHUN PELAJARAN": "-",
               TAHUN_PELAJARAN: "-",
               "TANGGAL_BERAKHIR": addOneYearIndonesian(tanggalPenetapanFormatted),
               "TANGGAL LENGKAP": tanggalPenetapanFormatted,
               TANGGAL_PENETAPAN: tanggalPenetapanFormatted,
               "TANGGAL PENETAPAN": tanggalPenetapanFormatted,
               
               // QR
               qrcode: qrDataUrl,
           };

           // Format CreatedAt / Tanggal SK (Indonesian)
           const months = [
               "Januari", "Februari", "Maret", "April", "Mei", "Juni",
               "Juli", "Agustus", "September", "Oktober", "November", "Desember"
           ];
           const rawCreated = skDoc.tanggalPenetapan || skDoc.createdAt || Date.now();
           const d = new Date(rawCreated as string | number);
           if (!isNaN(d.getTime())) {
               renderData.tanggal_sk = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
               renderData.Tanggal_SK = renderData.tanggal_sk;
               renderData.TANGGAL = `${d.getDate()}`;
               renderData.BULAN = `${d.getMonth() + 1}`;
               renderData.TAHUN = `${d.getFullYear()}`;
               renderData.NAMA_BULAN = months[d.getMonth()];
           } else {
               renderData.tanggal_sk = "-";
               renderData.Tanggal_SK = "-";
               renderData.TANGGAL = "-";
               renderData.BULAN = "-";
               renderData.TAHUN = "-";
               renderData.NAMA_BULAN = "-";
           }

           doc.render(renderData);

           const out = doc.getZip().generate({
               type: "blob",
               mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
           });

           saveAs(out, `SK_${renderData.nama.replace(/\s+/g, '_')}_${renderData.unitKerja.replace(/\s+/g, '_')}.docx`);
           toast.success("Berhasil mengunduh dokumen SK DOCX!");
       } catch (error) {
           console.error("Error DOCX:", error);
           toast.error("Gagal men-generate template DOCX. Pastikan format template sudah benar.");
       } finally {
           setIsProcessing(false);
       }
  }

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Memuat data SK...</div>
  if (!sk) return <div className="p-8 text-center text-muted-foreground">Data SK tidak ditemukan.</div>

  const badgeStatus = getBadgeStatus(sk.status);
  const isIssued = badgeStatus === "issued";

  return (
    <div className="max-w-4xl space-y-6">
       <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate("/dashboard/sk")} className="pl-0">
                <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
            </Button>
            <div className="flex gap-2">
                 {isIssued && (
                    <Button variant="outline" onClick={() => handleAction("revise")}>
                        <AlertTriangle className="mr-2 h-4 w-4 text-orange-500" /> Kembalikan ke Draft
                    </Button>
                 )}
                 {sk.fileUrl ? (
                     <Button variant="outline" onClick={() => window.open(sk.fileUrl, '_blank')}>
                        <Printer className="mr-2 h-4 w-4" /> Cetak / Download
                     </Button>
                 ) : (
                     <Button variant="outline" disabled>
                        <FileText className="mr-2 h-4 w-4" /> PDF Belum Tersedia
                     </Button>
                 )}
                 {isIssued && (
                    <Button variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100" onClick={handleDownloadDocx} disabled={isProcessing}>
                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} Unduh SK (Word DOCX)
                    </Button>
                 )}
            </div>
       </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Info */}
        <div className="md:col-span-2 space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-xl">{sk.jenis}</CardTitle>
                            <CardDescription>Nomor: {sk.nomorSurat || "Belum Terbit"}</CardDescription>
                        </div>
                        <StatusBadge status={badgeStatus} className="text-sm px-3 py-1" />
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="text-muted-foreground">Nama Lengkap</p>
                            <p className="font-medium">{sk.nama}</p>
                        </div>
                         <div>
                            <p className="text-muted-foreground">NIY / NUPTK</p>
                            <p className="font-medium">{sk.niy || "-"}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Tanggal Pengajuan</p>
                            <p className="font-medium">
                                {new Date(sk.createdAt).toLocaleDateString('id-ID', {
                                    day: 'numeric', month: 'long', year: 'numeric'
                                })}
                            </p>
                        </div>
                         <div>
                            <p className="text-muted-foreground">Unit Kerja</p>
                            <p className="font-medium">{sk.unitKerja}</p>
                        </div>
                         <div>
                            <p className="text-muted-foreground">Jenis Pengajuan</p>
                            <p className="font-medium">{sk.jenisPengajuan}</p>
                        </div>
                         <div className="col-span-2">
                            <p className="text-muted-foreground">Keterangan / Pesan</p>
                            <p className="font-medium text-slate-700 bg-slate-50 p-2 rounded block mt-1">
                                {sk.keterangan || "-"}
                            </p>
                        </div>
                    </div>
                    
                    <Separator />

                    <div>
                        <h4 className="mb-2 font-semibold">Preview SK</h4>
                        {sk.fileUrl && (sk.fileUrl.startsWith('http') || sk.fileUrl.startsWith('/')) ? (
                             <div className="rounded-md border p-0 overflow-hidden bg-slate-100 h-[600px]">
                                <iframe 
                                    src={sk.fileUrl} 
                                    className="w-full h-full" 
                                    title="Preview SK"
                                />
                             </div>
                        ) : sk.fileUrl ? (
                             <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground bg-slate-50">
                                <FileText className="mx-auto h-8 w-8 mb-2 opacity-50" />
                                <p>Preview tidak tersedia.</p>
                                <p className="text-sm font-medium mt-1">{sk.fileUrl}</p> 
                                <p className="text-xs mt-1 text-slate-500">File SK ini digenerate secara massal (ZIP). Silakan cek file yang sudah didownload.</p>
                            </div>
                        ) : (
                            <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground bg-slate-50">
                                <FileText className="mx-auto h-8 w-8 mb-2 opacity-50" />
                                <p>File SK belum digenerate.</p>
                                <p className="text-xs mt-1">Silakan minta Admin untuk memproses.</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Admin Actions Area */}
            {isAdmin && badgeStatus === "submitted" && (
                 <Card className="border-blue-200 bg-blue-50/50">
                    <CardHeader>
                        <CardTitle className="text-lg text-blue-800">Tindakan Admin</CardTitle>
                        <CardDescription className="text-blue-600">
                            Silakan periksa data sebelum memberikan persetujuan.
                        </CardDescription>
                    </CardHeader>
                     <CardContent className="flex gap-3">
                        <Button className="bg-green-600 hover:bg-green-700 flex-1" onClick={() => handleAction("approve")}>
                            <CheckCircle className="mr-2 h-4 w-4" /> Setujui
                        </Button>
                        <Button variant="destructive" className="flex-1" onClick={() => handleAction("reject")}>
                            <XCircle className="mr-2 h-4 w-4" /> Tolak
                        </Button>
                     </CardContent>
                 </Card>
            )}
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
             <Card>
                <CardHeader>
                    <CardTitle className="text-base">Metadata</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                    <div>
                        <span className="text-muted-foreground block text-xs uppercase tracking-wider">ID Sistem</span>
                        <span className="font-mono text-xs text-slate-600 truncate block bg-slate-100 p-1 rounded">{sk.id}</span>
                    </div>
                    <div>
                        <span className="text-muted-foreground block text-xs uppercase tracking-wider">Status Database</span>
                        <span className="font-mono text-xs">{sk.status}</span>
                    </div>
                    <Separator />
                    <div className="pt-2">
                        <p className="text-xs text-muted-foreground text-center">
                            Jika data salah, silakan hubungi Administrator PUSAT.
                        </p>
                    </div>
                </CardContent>
             </Card>
        </div>
      </div>
 
      {/* Confirmation Dialog */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
          <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                  <div className={`flex items-center gap-3 mb-2 ${
                      pendingAction === 'approve' ? 'text-green-600' : 
                      pendingAction === 'reject' ? 'text-red-600' : 'text-amber-600'
                  }`}>
                      <div className={`p-2 rounded-full ${
                          pendingAction === 'approve' ? 'bg-green-50' : 
                          pendingAction === 'reject' ? 'bg-red-50' : 'bg-amber-50'
                      }`}>
                          {pendingAction === 'approve' ? <CheckCircle className="h-6 w-6" /> : 
                           pendingAction === 'reject' ? <XCircle className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
                      </div>
                      <DialogTitle className="text-xl font-bold">
                          {pendingAction === 'approve' ? 'Setujui SK' : 
                           pendingAction === 'reject' ? 'Tolak SK' : 'Kembalikan ke Draft'}
                      </DialogTitle>
                  </div>
              </DialogHeader>
              <div className="py-4">
                  <p className="text-muted-foreground leading-relaxed">
                      Apakah Anda yakin ingin {
                          pendingAction === 'approve' ? 'menyetujui' : 
                          pendingAction === 'reject' ? 'menolak' : 'mengembalikan ke draft'
                      } dokumen SK ini? Tindakan ini akan mengubah status dokumen secara langsung.
                  </p>
              </div>
              <DialogFooter className="gap-2 sm:gap-0 border-t pt-4">
                  <Button variant="ghost" onClick={() => setIsConfirmOpen(false)} disabled={isProcessing}>
                      Batal
                  </Button>
                  <Button 
                    onClick={executeAction} 
                    disabled={isProcessing}
                    className={
                        pendingAction === 'approve' ? 'bg-green-600 hover:bg-green-700' : 
                        pendingAction === 'reject' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'
                    }
                  >
                      {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Ya, Lanjutkan
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  )
}
