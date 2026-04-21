import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, FileEdit, CheckCircle, XCircle, Loader2, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { skApi, authApi, skTemplateApi } from "@/lib/api";
import { getSkVerificationUrl } from "@/utils/verification";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Info } from "lucide-react";
import { Separator } from "@/components/ui/separator";

// DOCX Generation Imports
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import ImageModule from "docxtemplater-image-module-free";
import { saveAs } from "file-saver";
import QRCode from "qrcode";

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

export default function SkRevisionListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const user = authApi.getStoredUser();
  const isAdmin = ["admin", "super_admin", "admin_yayasan"].includes(user?.role);

  // 🔥 REST API QUERIES
  const { data: revisionsList, isLoading, error } = useQuery({
    queryKey: ['sk-revisions'],
    queryFn: () => skApi.getRevisions()
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ ids, status, reason }: { ids: number[], status: string, reason?: string }) => 
      skApi.batchUpdateStatus(ids, status, reason),
    onSuccess: () => {
      toast.success("Status revisi berhasil diperbarui");
      queryClient.invalidateQueries({ queryKey: ['sk-revisions'] });
    },
    onError: (err: any) => toast.error("Gagal memperbarui status: " + (err.response?.data?.message || err.message))
  });

  const handleApproveRevisionSubmit = async (skId: number) => {
    setIsActionLoading(true);
    await updateStatusMutation.mutateAsync({ ids: [skId], status: 'approved' });
    setIsActionLoading(false);
  };

  const handleRejectRevisionSubmit = async (skId: number) => {
    setIsActionLoading(true);
    await updateStatusMutation.mutateAsync({ ids: [skId], status: 'rejected', reason: 'Ditolak Admin' });
    setIsActionLoading(false);
    setIsPreviewOpen(false);
  };

  const handleOpenPreview = (item: any) => {
    setSelectedItem(item);
    setIsPreviewOpen(true);
  };

  const handleApproveFromPreview = async () => {
    if (!selectedItem) return;
    await handleApproveRevisionSubmit(selectedItem.id);
    setIsPreviewOpen(false);
  };

  // --- DOCX GENERATION FUNCTION ---
  const handleDownloadDocx = async (skDoc: any) => {
    if (!skDoc) return;
    setIsActionLoading(true);
    toast.info("Sedang menyiapkan file DOCX...");

    try {
      const teacherData = skDoc.teacher || {};

      // Determine template type — same logic as SkGeneratorPage
      const statusRaw = (skDoc.status_kepegawaian || teacherData.status || "").toLowerCase()
      const jenis = (skDoc.jenis_sk || "").toLowerCase()
      let skType = "tendik"
      if (statusRaw.includes("gty") || statusRaw.includes("tetap yayasan") ||
          jenis.includes("gty") || jenis.includes("tetap yayasan") ||
          statusRaw.includes("kamad") || statusRaw.includes("kepala") ||
          jenis.includes("kamad") || jenis.includes("kepala")) {
        skType = "gty"
      } else if (statusRaw.includes("gtt") || statusRaw.includes("tidak tetap") ||
                 jenis.includes("gtt") || jenis.includes("tidak tetap")) {
        skType = "gtt"
      }

      // 1. Fetch Template — use skTemplateApi.getActive with fallback to static file
      const fallbackUrl = `/templates/sk-${skType}-template.docx`
      let templateBinary: string

      try {
        const templateRes = await skTemplateApi.getActive(skType)
        const fileUrl = templateRes?.file_url ?? fallbackUrl
        const resp = await fetch(fileUrl)
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const arrayBuffer = await resp.arrayBuffer()
        const bytes = new Uint8Array(arrayBuffer)
        let binary = ''
        for (let b = 0; b < bytes.byteLength; b++) binary += String.fromCharCode(bytes[b])
        templateBinary = binary
      } catch {
        // Fallback to static bundled template
        const resp = await fetch(fallbackUrl)
        if (!resp.ok) throw new Error(`Template ${skType} tidak tersedia (${resp.status})`)
        const arrayBuffer = await resp.arrayBuffer()
        const bytes = new Uint8Array(arrayBuffer)
        let binary = ''
        for (let b = 0; b < bytes.byteLength; b++) binary += String.fromCharCode(bytes[b])
        templateBinary = binary
      }

      // 2. Generate QR
      const verificationUrl = getSkVerificationUrl(skDoc.nomor_sk);
      const qrDataUrl = await QRCode.toDataURL(verificationUrl, { width: 400, margin: 1 });

      // 3. Document Data Mapping (Standardized)
      const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
      const d = new Date(skDoc.tanggal_penetapan || skDoc.created_at);
      const tanggalFormatted = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;

      const renderData = {
        ...teacherData,
        ...skDoc,
        NAMA: skDoc.nama?.toUpperCase(),
        NOMOR_SURAT: skDoc.nomor_sk,
        TANGGAL_PENETAPAN: tanggalFormatted,
        UNIT_KERJA: skDoc.unit_kerja,
        qrcode: qrDataUrl,
        // Kitchen Sink (Compatibility)
        "TEMPAT, TANGGAL LAHIR": `${teacherData.tempat_lahir || ""}, ${teacherData.tanggal_lahir || ""}`,
        TANGGAL_MULAI_TUGAS: teacherData.tmt || "-",
        PENDIDIKAN: teacherData.pendidikan_terakhir || "-"
      };

      // 4. Render DOCX
      const pzip = new PizZip(templateBinary);
      const doc = new Docxtemplater(pzip, {
        paragraphLoop: true,
        linebreaks: true,
        modules: [new ImageModule({
          getImage: (tag: string) => base64DataURLToArrayBuffer(tag),
          getSize: () => [100, 100]
        })],
        nullGetter: () => ""
      });

      doc.render(renderData);
      const out = doc.getZip().generate({ type: "blob" });
      saveAs(out, `SK_REVISI_${skDoc.nama.replace(/\s+/g, "_")}.docx`);
      toast.success("Berhasil mengunduh dokumen SK DOCX!");

    } catch (error: any) {
      console.error(error);
      toast.error("Gagal membuat dokumen: " + error.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const filteredData = useMemo(() => {
    const list = Array.isArray(revisionsList) ? revisionsList : ((revisionsList as any)?.data || []);
    if (!list.length) return [];
    
    // Normalize and filter based on search
    let results = list;
    if (searchTerm) {
      const term = searchTerm.toLowerCase().trim();
      results = results.filter(
        (item: any) =>
          item.nama?.toLowerCase().includes(term) ||
          item.teacher?.nama?.toLowerCase().includes(term) ||
          item.sk_document?.nomor_sk?.toLowerCase().includes(term) ||
          item.revision_reason?.toLowerCase().includes(term)
      );
    }
    return results;
  }, [revisionsList, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-black tracking-tight text-blue-900 uppercase">Perbaikan Data SK (Riwayat)</h1>
      </div>

      <Card className="border-0 shadow-sm bg-white rounded-[2.5rem] overflow-hidden">
        <CardHeader className="p-10 border-b bg-slate-50/50">
          <CardTitle className="text-xl font-black text-slate-800 uppercase tracking-tight">Kotak Masuk Revisi (Typo/Error)</CardTitle>
          <CardDescription className="font-medium text-slate-400">
            Daftar pengajuan perbaikan data yang diajukan oleh Operator Madrasah.
          </CardDescription>
          <div className="mt-6">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
              <Input
                placeholder="Cari nama guru atau no surat..."
                className="pl-10 h-11 border-slate-200 rounded-xl"
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
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-widest py-5 pl-10">Data SK</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-widest py-5">Alasan Perubahan</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-widest py-5">Status</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-widest py-5 text-right pr-10">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {error ? (
                <TableRow><TableCell colSpan={4} className="h-40 text-center text-red-500 font-bold uppercase tracking-widest px-10">Gagal memuat data revisi. Silakan coba lagi nanti.</TableCell></TableRow>
              ) : isLoading ? (
                <TableRow><TableCell colSpan={4} className="h-40 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500"/></TableCell></TableRow>
              ) : filteredData.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="h-40 text-center opacity-30 text-xs font-bold uppercase tracking-widest">Tidak ada pengajuan revisi</TableCell></TableRow>
              ) : (
                filteredData.map((item: any) => (
                  <TableRow key={item.id} className="hover:bg-slate-50/50 border-slate-50">
                    <TableCell className="py-6 pl-10">
                      <div className="font-bold text-slate-800">{item.nama}</div>
                      <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1">
                        {item.nomor_sk || "DRAFT"} • {item.unit_kerja}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg inline-block border border-slate-200">
                        "{item.revision_reason || "Tidak ada detail alasan."}"
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge className={`rounded-lg uppercase text-[9px] font-black tracking-widest py-1 px-3 ${
                        (item.revision_status || item.status) === 'revision_pending' ? "bg-amber-100 text-amber-700 hover:bg-amber-100" :
                        (item.revision_status || item.status) === 'approved' ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" :
                        "bg-slate-100 text-slate-700 hover:bg-slate-100"
                      }`}>
                        {(item.revision_status || item.status) === 'revision_pending' ? 'Menunggu' : (item.revision_status || item.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-10">
                      <div className="flex justify-end gap-2">
                        {((item.status?.toLowerCase() === "revision_pending") || (item.revision_status?.toLowerCase() === "revision_pending")) && isAdmin ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-9 px-4 rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-bold uppercase text-[10px] tracking-widest"
                              onClick={() => handleApproveRevisionSubmit(item.id)}
                              disabled={isActionLoading}
                            >
                              <CheckCircle className="h-3 w-3 mr-2" /> ACC
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-9 px-4 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 font-bold uppercase text-[10px] tracking-widest"
                              onClick={() => handleOpenPreview(item)}
                            >
                              <Search className="h-3 w-3 mr-2" /> Cek Data
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-9 px-4 rounded-xl border-red-200 text-red-700 hover:bg-red-50 font-bold uppercase text-[10px] tracking-widest"
                              onClick={() => handleRejectRevisionSubmit(item.id)}
                              disabled={isActionLoading}
                            >
                              <XCircle className="h-3 w-3 mr-2" /> Tolak
                            </Button>
                          </>
                        ) : (
                          <>
                            {item.status === "approved" && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-9 w-9 rounded-xl border-slate-200 text-slate-400 hover:text-blue-600"
                                onClick={() => handleDownloadDocx(item)}
                                disabled={isActionLoading}
                                title="Download SK (Word)"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/dashboard/sk/${item.id}`)}
                              className="h-9 rounded-xl font-bold uppercase text-[10px] tracking-widest text-slate-400 hover:text-blue-600"
                            >
                              Detail
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden border-0 rounded-[2.5rem] shadow-2xl">
          <DialogHeader className="p-10 bg-amber-50 border-b border-amber-100">
            <div className="flex items-center gap-4">
               <div className="bg-white p-3 rounded-2xl text-amber-600 shadow-sm">
                  <FileEdit className="h-6 w-6" />
               </div>
               <div>
                  <DialogTitle className="text-2xl font-black text-amber-900 uppercase tracking-tight">Tinjau Perubahan Data</DialogTitle>
                  <DialogDescription className="text-amber-700/60 font-medium">
                    Bandingkan data saat ini dengan perubahan yang diusulkan oleh sekolah.
                  </DialogDescription>
               </div>
            </div>
          </DialogHeader>
          
          <div className="p-10 space-y-8 max-h-[60vh] overflow-y-auto bg-white">
            <div className="bg-slate-50 p-6 rounded-2xl border border-dashed border-slate-200">
               <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
                  <Info className="h-3 w-3" /> Alasan Pengajuan:
               </h4>
               <p className="text-sm font-bold text-slate-700 italic">"{selectedItem?.revision_reason || 'Tidak ada alasan.'}"</p>
            </div>

            <div className="grid grid-cols-2 gap-10">
              <div className="space-y-6">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b pb-3">Data Saat Ini (Lama)</h4>
                <div className="space-y-4">
                  {[
                    { label: "Nama", val: selectedItem?.nama },
                    { label: "NIP", val: selectedItem?.teacher?.nip },
                    { label: "Tempat Lahir", val: selectedItem?.teacher?.tempat_lahir },
                    { label: "Tgl Lahir", val: selectedItem?.teacher?.tanggal_lahir?.split('T')[0] },
                    { label: "Pendidikan", val: selectedItem?.teacher?.pendidikan_terakhir },
                    { label: "Unit Kerja", val: selectedItem?.unit_kerja },
                    { label: "TMT", val: selectedItem?.teacher?.tmt?.split('T')[0] },
                  ].map(f => (
                    <div key={f.label} className="space-y-1">
                      <p className="text-[9px] font-black uppercase text-slate-300 tracking-wider font-mono">{f.label}</p>
                      <p className="text-xs font-bold text-slate-400">{f.val || "-"}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-600 border-b border-amber-100 pb-3">Data Usulan (Baru)</h4>
                <div className="space-y-4">
                  {[
                    { key: 'nama', label: "Nama" },
                    { key: 'nip', label: "NIP" },
                    { key: 'tempat_lahir', label: "Tempat Lahir" },
                    { key: 'tanggal_lahir', label: "Tgl Lahir" },
                    { key: 'pendidikan_terakhir', label: "Pendidikan" },
                    { key: 'unit_kerja', label: "Unit Kerja" },
                    { key: 'tmt', label: "TMT" },
                  ].map(f => {
                    const isChanged = selectedItem?.revision_data?.[f.key] && 
                                      selectedItem?.revision_data?.[f.key] !== (f.key === 'nama' || f.key === 'unit_kerja' ? selectedItem?.[f.key] : selectedItem?.teacher?.[f.key]);
                    return (
                      <div key={f.label} className="space-y-1">
                        <p className="text-[9px] font-black uppercase text-slate-300 tracking-wider font-mono">{f.label}</p>
                        <p className={`text-xs font-black ${isChanged ? 'text-blue-600 bg-blue-50 px-2 py-1 rounded-md inline-block' : 'text-slate-500'}`}>
                          {selectedItem?.revision_data?.[f.key] || "-"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="p-10 bg-slate-50 border-t flex justify-between items-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Verifikasi data di atas sebelum setuju</p>
            <div className="flex gap-4">
              <Button variant="ghost" onClick={() => setIsPreviewOpen(false)} className="h-12 px-8 rounded-xl font-black uppercase text-xs tracking-widest text-slate-400">Batal</Button>
              <Button 
                onClick={handleApproveFromPreview}
                disabled={isActionLoading}
                className="h-12 px-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-xs tracking-widest shadow-lg shadow-emerald-100"
              >
                {isActionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <CheckCircle className="h-4 w-4 mr-2"/>} Setujui Perubahan
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
