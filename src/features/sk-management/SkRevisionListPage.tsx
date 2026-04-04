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
import { skApi, authApi, settingApi } from "@/lib/api";

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

  const user = authApi.getStoredUser();
  const isAdmin = ["admin", "super_admin", "admin_yayasan"].includes(user?.role);

  // 🔥 REST API QUERIES
  const { data: revisionsList, isLoading } = useQuery({
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
  };

  // --- DOCX GENERATION FUNCTION ---
  const handleDownloadDocx = async (skDoc: any) => {
    if (!skDoc) return;
    setIsActionLoading(true);
    toast.info("Sedang menyiapkan file DOCX...");

    try {
      const teacherData = skDoc.teacher || {};
      const jenis = (skDoc.jenis_sk || "").toLowerCase();
      let templateId = "sk_template_tendik";
      if (jenis.includes("gty") || jenis.includes("tetap yayasan")) templateId = "sk_template_gty";
      else if (jenis.includes("gtt") || jenis.includes("tidak tetap")) templateId = "sk_template_gtt";
      else if (jenis.includes("kepala") || jenis.includes("kamad")) templateId = "sk_template_kamad_nonpns";

      // 1. Fetch Template from Backend
      const res = await settingApi.get(templateId);
      if (!res?.value) {
        toast.error(`Template ${templateId} tidak ditemukan di sistem.`);
        return;
      }
      
      const base64 = res.value.split(";base64,")[1] || res.value;
      const content = atob(base64);

      // 2. Generate QR
      const verificationUrl = `${window.location.origin}/verify/sk/${skDoc.nomor_sk}`;
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
      const pzip = new PizZip(content);
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
    if (!revisionsList) return [];
    if (!searchTerm) return revisionsList;
    const term = searchTerm.toLowerCase();
    return (revisionsList as any[]).filter(
      (sk) =>
        sk.nama?.toLowerCase().includes(term) ||
        sk.nomor_sk?.toLowerCase().includes(term) ||
        sk.unit_kerja?.toLowerCase().includes(term)
    );
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
              {isLoading ? (
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
                        item.status === 'revision_pending' ? "bg-amber-100 text-amber-700 hover:bg-amber-100" :
                        item.status === 'approved' ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" :
                        "bg-slate-100 text-slate-700 hover:bg-slate-100"
                      }`}>
                        {item.status === 'revision_pending' ? 'Menunggu' : item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-10">
                      <div className="flex justify-end gap-2">
                        {item.status === "revision_pending" && isAdmin ? (
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
    </div>
  );
}
