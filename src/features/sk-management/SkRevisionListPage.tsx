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
import { Search, FileEdit, CheckCircle, XCircle } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useState, useMemo } from "react"
import { useQuery, useMutation } from "convex/react"
import { Loader2, Download } from "lucide-react"
import { api as convexApi, api } from "../../../convex/_generated/api"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { useConvex } from "convex/react"

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
    // @ts-ignore
    binaryString = new Buffer(stringBase64, "base64").toString("binary");
  }
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export default function SkRevisionListPage() {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState("")
  const [isActionLoading, setIsActionLoading] = useState(false)
  const convex = useConvex(); // For fetching templates
  
  // Use the new getRevisions query
  const revisionsList = useQuery(convexApi.sk.getRevisions)
  const approveRevisionMutation = useMutation(convexApi.sk.approveRevision)
  const rejectRevisionMutation = useMutation(convexApi.sk.rejectRevision)

  const handleApproveRevisionSubmit = async (skId: string) => {
    try {
        setIsActionLoading(true);
        await approveRevisionMutation({ skId: skId as any });
        toast.success("Revisi disetujui dan data diperbarui");
    } catch (e: any) {
        toast.error("Gagal menyetujui revisi: " + e.message);
    } finally {
        setIsActionLoading(false);
    }
  };

  const handleRejectRevisionSubmit = async (skId: string) => {
    try {
        setIsActionLoading(true);
        await rejectRevisionMutation({ skId: skId as any, reason: "Dibatalkan Admin" });
        toast.success("Revisi ditolak");
    } catch (e: any) {
        toast.error("Gagal menolak revisi: " + e.message);
    } finally {
        setIsActionLoading(false);
    }
  };

  // --- DOCX GENERATION FUNCTION ---
  const handleDownloadDocx = async (skDoc: any) => {
       if (!skDoc) return;
       setIsActionLoading(true);
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
               setIsActionLoading(false);
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
           setIsActionLoading(false);
       }
  }

  // Filter functionality
  const filteredData = useMemo(() => {
    if (!revisionsList) return []
    if (!searchTerm) return revisionsList
    const term = searchTerm.toLowerCase()
    return revisionsList.filter(sk => 
      sk.nama?.toLowerCase().includes(term) || 
      sk.nomorSk?.toLowerCase().includes(term) ||
      sk.unitKerja?.toLowerCase().includes(term)
    )
  }, [revisionsList, searchTerm])

  const renderRevisionBadge = (status: string | undefined) => {
      switch (status) {
          case "pending":
              return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-200">Menunggu ACC</Badge>;
          case "approved":
              return <Badge className="bg-green-100 text-green-700 hover:bg-green-200">Sudah Selesai</Badge>;
          case "rejected":
              return <Badge className="bg-red-100 text-red-700 hover:bg-red-200">Ditolak</Badge>;
          default:
              return null;
      }
  }

  // Authorization Check
  const user = JSON.parse(localStorage.getItem("user") || "{}")
  const isAdmin = ["admin", "super_admin"].includes(user?.role)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Perbaikan Data SK (Riwayat)</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Kotak Masuk Revisi (Typo/Error)</CardTitle>
          <CardDescription>
            Memantau dan menyetujui perubahan nama, NIP, atau TMT yang diajukan oleh Operator Madrasah.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Cari nama guru atau no surat..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No. Surat / Nama Pendidik</TableHead>
                  <TableHead>Alasan / Pesan Operator</TableHead>
                  <TableHead>Status Revisi</TableHead>
                  <TableHead className="text-right">Aksi & Putusan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {revisionsList === undefined ? (
                     <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin inline-block" /> Memuat data revisi...
                        </TableCell>
                    </TableRow>
                ) : filteredData.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                            Belum ada satupun riwayat pengajuan revisi SK.
                        </TableCell>
                    </TableRow>
                ) : (
                    filteredData.map((item) => (
                      <TableRow 
                        key={item._id} 
                        className="hover:bg-muted/50"
                      >
                        <TableCell>
                          <div className="font-medium">{item.nama}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{item.nomorSk || "No belum terbit"}</div>
                          <div className="text-xs text-muted-foreground">{item.unitKerja || "-"}</div>
                        </TableCell>
                        <TableCell>
                            <span className="text-sm italic text-orange-900 bg-orange-50 px-2 py-1 rounded inline-block">
                                "{item.revisionReason || "Tidak ada detail alasan yang dilampirkan."}"
                            </span>
                        </TableCell>
                        <TableCell>
                            {renderRevisionBadge(item.revisionStatus)}
                        </TableCell>
                        <TableCell className="text-right align-middle">
                            {/* ACTION BUTTONS (Only Admin can approve/reject) */}
                            {item.revisionStatus === "pending" && isAdmin ? (
                                <div className="inline-flex flex-col gap-1 w-full max-w-[120px] ml-auto">
                                    <Button variant="outline" size="sm" className="border-green-300 bg-green-50 text-green-700 hover:bg-green-100 justify-start" onClick={() => handleApproveRevisionSubmit(item._id)} disabled={isActionLoading}>
                                        <CheckCircle className="h-3 w-3 mr-2"/> ACC Revisi
                                    </Button>
                                    <Button variant="outline" size="sm" className="border-red-300 bg-red-50 text-red-700 hover:bg-red-100 justify-start" onClick={() => handleRejectRevisionSubmit(item._id)} disabled={isActionLoading}>
                                        <XCircle className="h-3 w-3 mr-2"/> Tolak & Batal
                                    </Button>
                                </div>
                            ) : (
                                <div className="inline-flex flex-col gap-1 w-full max-w-[140px] ml-auto">
                                    {item.revisionStatus === "approved" && (
                                        <Button variant="outline" size="sm" className="bg-slate-50 hover:bg-slate-100 justify-start" onClick={() => handleDownloadDocx(item)} disabled={isActionLoading}>
                                            <Download className="h-4 w-4 mr-2 text-blue-600" />
                                            Cetak SK (Word)
                                        </Button>
                                    )}
                                    <Button variant="ghost" size="sm" onClick={() => navigate(`/dashboard/sk/${item._id}`)} className="justify-start">
                                        <FileEdit className="h-4 w-4 mr-2" />
                                        Lihat Detail SK
                                    </Button>
                                </div>
                            )}
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
