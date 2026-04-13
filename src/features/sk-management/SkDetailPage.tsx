import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowLeft,
  CheckCircle,
  FileText,
  AlertTriangle,
  XCircle,
  Printer,
  Loader2,
  Download,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import StatusBadge from "@/components/shared/StatusBadge";
import type { StatusType } from "@/components/shared/StatusBadge";
import { useState } from "react";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { skApi, settingApi, authApi } from "@/lib/api";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// DOCX Generation Imports
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import ImageModule from "docxtemplater-image-module-free";
import { saveAs } from "file-saver";
import QRCode from "qrcode";

// Helper to base64 to array buffer
function base64DataURLToArrayBuffer(dataURL: string) {
  const stringBase64 = dataURL.replace(/^data:image\/[a-z]+;base64,/, "");
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

export default function SkDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();

  // 🔥 REST API QUERY
  const { data: skDoc, isLoading, error } = useQuery({
    queryKey: ['sk-document', id],
    queryFn: () => id ? skApi.get(parseInt(id)) : null,
    enabled: !!id,
    retry: 1
  });

  const user = authApi.getStoredUser();
  const isAdmin = ["super_admin", "admin_yayasan"].includes(user?.role);

  // Mutations
  const updateStatus = useMutation({
    mutationFn: ({ status, reason }: { status: string, reason?: string }) => 
      skApi.batchUpdateStatus([parseInt(id!)], status, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sk-document', id] });
      toast.success("Status dokumen berhasil diperbarui");
      setIsConfirmOpen(false);
    },
    onError: (err: any) => toast.error("Gagal memperbarui status: " + (err.response?.data?.message || err.message))
  });

  // Confirmation Dialog State
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"approved" | "rejected" | "draft" | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Helper to map backend status to frontend badge status
  const getBadgeStatus = (backendStatus: string): StatusType => {
    const lower = backendStatus?.toLowerCase() || "";
    if (lower === "pending" || lower === "draft") return "submitted";
    if (lower === "approved" || lower === "active") return "issued";
    if (lower === "rejected" || lower === "archived") return "rejected";
    return "draft";
  };

  const handleAction = (action: "approved" | "rejected" | "draft") => {
    setPendingAction(action);
    setIsConfirmOpen(true);
  };

  const executeAction = async () => {
    if (!pendingAction || !id) return;
    updateStatus.mutate({ status: pendingAction });
  };

  // --- DOCX GENERATION FUNCTION ---
  const handleDownloadDocx = async () => {
    if (!skDoc) return;
    setIsProcessing(true);
    toast.info("Sedang menyiapkan file DOCX...");

    try {
      const teacherData: any = skDoc.teacher || {};

      // Determine Template ID
      const jenis = (skDoc.jenis_sk || "").toLowerCase();
      const jabatan = (skDoc.jabatan || "").toLowerCase();
      const nip = (teacherData.nip || "").replace(/[^0-9]/g, "");
      
      let templateId = "sk_template_tendik";
      if (jenis.includes("tetap yayasan") || jenis.includes("gty"))
        templateId = "sk_template_gty";
      else if (jenis.includes("tidak tetap") || jenis.includes("gtt"))
        templateId = "sk_template_gtt";
      else if (jenis.includes("kepala") || jenis.includes("kamad")) {
        const isPns = nip.length > 10 || (teacherData.status_kepegawaian || "").includes("PNS");
        if (jabatan.includes("plt")) templateId = "sk_template_kamad_plt";
        else if (isPns) templateId = "sk_template_kamad_pns";
        else templateId = "sk_template_kamad_nonpns";
      }

      // Fetch Template via REST API
      let base64Template = localStorage.getItem(templateId + "_blob");
      if (!base64Template) {
        const result = await settingApi.get(templateId);
        if (result && result.value) {
          base64Template = result.value.includes(";base64,")
            ? result.value
            : "data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64," + result.value;
        }
      }

      if (!base64Template) {
        toast.error(`Template tidak ditemukan (ID: ${templateId}).`);
        setIsProcessing(false);
        return;
      }

      const block = base64Template.split(";base64,");
      const realData = block[1] ? block[1] : base64Template;
      const content = atob(realData);

      // Generate QR
      const verificationUrl = `${window.location.origin}/verify/sk/${skDoc.nomor_sk}`;
      const qrDataUrl = await QRCode.toDataURL(verificationUrl, { width: 400, margin: 1 });

      const pzip = new PizZip(content);
      const imageOpts = {
        getImage: (tagValue: string) => base64DataURLToArrayBuffer(tagValue),
        getSize: () => [100, 100],
      };
      const imageModule = new ImageModule(imageOpts);

      const doc = new Docxtemplater(pzip, {
        paragraphLoop: true,
        linebreaks: true,
        modules: [imageModule],
        nullGetter: () => "",
      });

      // Format Dates
      const formatIndoDate = (dateStr: string) => {
        if (!dateStr) return "-";
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
      };

      const renderData: any = {
        ...skDoc,
        ...teacherData,
        nama: skDoc.nama?.toUpperCase() || "-",
        nuptk: teacherData.nuptk || "-",
        nomor_sk: skDoc.nomor_sk || "-",
        unit_kerja: skDoc.unit_kerja || "-",
        jabatan: skDoc.jabatan || "Guru",
        tanggal_sk: formatIndoDate(skDoc.tanggal_penetapan),
        qrcode: qrDataUrl,
      };

      doc.render(renderData);
      const out = doc.getZip().generate({
        type: "blob",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });

      saveAs(out, `SK_${skDoc.nama.replace(/\s+/g, "_")}.docx`);
      toast.success("Dokumen SK berhasil diunduh!");
    } catch (e: any) {
      console.error("Error DOCX:", e);
      toast.error("Gagal membuat dokumen: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) return <div className="p-20 text-center"><Loader2 className="h-10 w-10 animate-spin mx-auto text-blue-500" /></div>;
  
  if (error) return (
    <div className="p-20 text-center space-y-4">
      <AlertTriangle className="h-12 w-12 text-red-500 mx-auto" />
      <h3 className="text-lg font-bold text-slate-800 uppercase">Gagal Memuat Data</h3>
      <p className="text-slate-500 text-sm max-w-md mx-auto">Terjadi kesalahan saat mengambil detail dokumen. Pastikan koneksi internet stabil atau hubungi admin.</p>
      <Button onClick={() => navigate("/dashboard/sk")} variant="outline" className="mt-4 rounded-xl">Kembali ke Dashboard</Button>
    </div>
  );

  if (!skDoc) return <div className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest">Dokumen Tidak Ditemukan</div>;

  const badgeStatus = getBadgeStatus(skDoc.status);
  const isIssued = badgeStatus === "issued";

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard/sk")}
          className="text-slate-400 hover:text-blue-600 font-black uppercase tracking-widest text-xs h-10 px-0"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Kembali ke Dashboard
        </Button>
        <div className="flex gap-3">
          {isIssued && (
            <Button 
                variant="outline" 
                onClick={() => handleAction("draft")}
                className="rounded-xl border-slate-200 text-slate-600 font-bold text-xs uppercase px-6"
            >
              <AlertTriangle className="mr-2 h-4 w-4 text-amber-500" /> Kembalikan ke Draft
            </Button>
          )}
          {skDoc.file_url ? (
            <Button
              variant="default"
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs uppercase px-6 shadow-lg shadow-blue-50"
              onClick={() => window.open(skDoc.file_url, "_blank")}
            >
              <Printer className="mr-2 h-4 w-4" /> Cetak / Download PDF
            </Button>
          ) : (
                   <>
                     {isIssued && (
                         <Button
                             variant="default"
                             className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs uppercase px-6 shadow-lg shadow-emerald-50"
                             onClick={handleDownloadDocx}
                             disabled={isProcessing}
                         >
                             {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                             Generate Word (DOCX)
                         </Button>
                     )}
                     {isIssued && !isAdmin && (
                         <Button
                             variant="outline"
                             className="rounded-xl border-amber-200 text-amber-700 hover:bg-amber-50 font-bold text-xs uppercase px-6"
                             onClick={() => navigate(`/dashboard/sk/${id}/revision`)}
                         >
                             <AlertTriangle className="mr-2 h-4 w-4" /> Ajukan Perbaikan Data
                         </Button>
                     )}
                   </>
          )}
        </div>
      </div>

      {skDoc.revision_status === 'revision_pending' && (
        <div className="bg-amber-50 border border-amber-200 p-6 rounded-[2rem] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-amber-100 p-3 rounded-2xl text-amber-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-black text-amber-900 uppercase tracking-tight">Menunggu Persetujuan Perbaikan</p>
              <p className="text-xs text-amber-700/70 font-medium">Pengajuan perbaikan data sedang ditinjau oleh Admin Yayasan.</p>
            </div>
          </div>
          {isAdmin && (
            <Button 
                onClick={() => navigate('/dashboard/sk-revisions')}
                className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl h-10 px-6 text-[10px] font-black uppercase tracking-widest"
            >
                Cek Kotak Masuk Revisi
            </Button>
          )}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          <Card className="border-0 shadow-sm rounded-[2.5rem] overflow-hidden">
            <CardHeader className="p-10 border-b bg-slate-50/50">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{skDoc.jenis_sk}</p>
                  <CardTitle className="text-3xl font-black text-slate-800 tracking-tight leading-tight">
                    {skDoc.nama}
                  </CardTitle>
                  <CardDescription className="font-mono text-sm font-bold text-slate-400">
                    ID: {skDoc.nomor_sk || "PENDING"}
                  </CardDescription>
                </div>
                <StatusBadge status={badgeStatus} className="rounded-full px-5 py-2 font-black uppercase tracking-widest text-[10px]" />
              </div>
            </CardHeader>
            <CardContent className="p-10 space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-1.5">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Unit Kerja / Madrasah</p>
                    <p className="font-bold text-slate-700">{skDoc.unit_kerja || "-"}</p>
                </div>
                <div className="space-y-1.5">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Jabatan / Mapel</p>
                    <p className="font-bold text-slate-700">{skDoc.jabatan || "-"}</p>
                </div>
                <div className="space-y-1.5">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tanggal Penetapan</p>
                    <p className="font-bold text-slate-700">
                        {new Date(skDoc.tanggal_penetapan).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                </div>
                <div className="space-y-1.5">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">NIY / NUPTK</p>
                    <p className="font-bold text-slate-700">{skDoc.teacher?.nuptk || "-"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {isAdmin && badgeStatus === "submitted" && (
            <Card className="border-0 bg-blue-600 text-white rounded-[2.5rem] shadow-xl shadow-blue-100 p-2 overflow-hidden">
              <CardHeader className="p-8">
                <CardTitle className="text-xl font-black uppercase tracking-tight">Panel Persetujuan Admin</CardTitle>
                <CardDescription className="text-blue-100 font-medium">Data ini memerlukan verifikasi akhir sebelum nomor SK diterbitkan secara otomatis.</CardDescription>
              </CardHeader>
              <CardContent className="px-8 pb-8 flex gap-4">
                <Button
                  className="bg-white text-emerald-600 hover:bg-emerald-50 h-14 rounded-2xl flex-1 font-black uppercase tracking-widest text-xs shadow-lg"
                  onClick={() => handleAction("approved")}
                >
                  <CheckCircle className="mr-2 h-5 w-5" /> Setujui Dokumen
                </Button>
                <Button
                  className="bg-white/10 text-white hover:bg-white/20 h-14 rounded-2xl flex-1 font-black uppercase tracking-widest text-xs border border-white/20"
                  onClick={() => handleAction("rejected")}
                >
                  <XCircle className="mr-2 h-5 w-5 text-red-400" /> Tolak Pengajuan
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-8">
          <Card className="border-0 shadow-sm rounded-[2rem] overflow-hidden">
            <CardHeader className="p-8 pb-4 bg-slate-50/50">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">Metadata Sistem</CardTitle>
            </CardHeader>
            <CardContent className="p-8 pt-4 space-y-6">
              <div className="space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">UUID Dokumen</span>
                <span className="font-mono text-[10px] block bg-slate-50 p-3 rounded-xl border border-slate-100 text-slate-600 break-all">
                  {id}
                </span>
              </div>
              <div className="space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status Database</span>
                <Badge variant="outline" className="font-mono text-[10px] uppercase border-slate-200">{skDoc.status}</Badge>
              </div>
              <div className="space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Dibuat Oleh</span>
                <span className="text-xs font-bold text-slate-700 block">{skDoc.created_by || "System"}</span>
              </div>
              <Separator />
              <div className="pt-2 text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter leading-relaxed">
                  Dokumen ini dilindungi secara digital oleh Sistem Informasi Manajemen Ma'arif Cilacap.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="rounded-[2.5rem] p-10 sm:max-w-md border-0 ring-1 ring-slate-100">
          <DialogHeader className="items-center text-center">
            <div className={`h-16 w-16 rounded-3xl flex items-center justify-center mb-6 ${
                pendingAction === "approved" ? "bg-emerald-50 text-emerald-600" : 
                pendingAction === "rejected" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"
            }`}>
              {pendingAction === "approved" ? <CheckCircle className="h-8 w-8" /> : 
               pendingAction === "rejected" ? <XCircle className="h-8 w-8" /> : <AlertTriangle className="h-8 w-8" />}
            </div>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight"> Konfirmasi Tindakan </DialogTitle>
            <DialogDescription className="text-sm font-medium pt-2">
              Apakah Anda yakin ingin <span className="font-bold text-slate-800 uppercase italic">
                {pendingAction === "approved" ? "menyetujui" : pendingAction === "rejected" ? "menolak" : "mengembalikan ke draft"}
              </span> dokumen ini? Tindakan ini tidak dapat dibatalkan secara otomatis.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-8 flex gap-3 sm:justify-center">
            <Button variant="ghost" onClick={() => setIsConfirmOpen(false)} className="rounded-2xl h-12 px-8 font-black uppercase tracking-widest text-xs">Batal</Button>
            <Button 
              onClick={executeAction} 
              disabled={updateStatus.isPending}
              className={`rounded-2xl h-12 px-8 font-black uppercase tracking-widest text-xs text-white ${
                pendingAction === "approved" ? "bg-emerald-600 hover:bg-emerald-700" : 
                pendingAction === "rejected" ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700"
              }`}
            >
              Ya, Proses Sekarang
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
