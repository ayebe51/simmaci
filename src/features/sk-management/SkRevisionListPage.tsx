import { Button } from "@/components/ui/button";
import SoftPageHeader from "@/components/ui/SoftPageHeader";
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
import { 
  Search, 
  FileEdit, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Download, 
  Plus, 
  Clock, 
  Eye, 
  Info, 
  FileText, 
  ArrowRight,
  ShieldCheck,
  Building2,
  Calendar,
  AlertTriangle
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useState, useMemo } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { skApi, authApi, skTemplateApi, API_URL } from "@/lib/api";
import { getSkVerificationUrl } from "@/utils/verification";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

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
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const user = authApi.getStoredUser();
  const isAdmin = ["admin", "super_admin", "admin_yayasan"].includes(user?.role);

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 400);
  const [activeTab, setActiveTab] = useState<"all" | "pending" | "approved" | "rejected">(
    (searchParams.get("tab") as any) || (isAdmin ? "pending" : "all")
  );
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // State for "Pilih SK untuk Direvisi" Modal
  const [isSelectSkModalOpen, setIsSelectSkModalOpen] = useState(false);
  const [skSelectorSearch, setSkSelectorSearch] = useState("");
  const debouncedSkSelectorSearch = useDebounce(skSelectorSearch, 400);

  // 1. Fetch Revisions
  const { data: revisionsList, isLoading, error } = useQuery({
    queryKey: ['sk-revisions'],
    queryFn: () => skApi.getRevisions()
  });

  // 2. Fetch Approved SKs for the selection modal
  const { data: approvedSksData, isLoading: isLoadingApprovedSks } = useQuery({
    queryKey: ['approved-sks-for-revision-picker', debouncedSkSelectorSearch],
    queryFn: () => skApi.list({
      status: 'approved',
      search: debouncedSkSelectorSearch,
      per_page: 25,
      sort_by: 'nomor_sk',
      sort_dir: 'desc'
    }),
    enabled: isSelectSkModalOpen
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
      const statusRaw = (skDoc.status_kepegawaian || teacherData.status || "").toLowerCase();
      const jenis = (skDoc.jenis_sk || "").toLowerCase();
      let skType = "tendik";
      if (statusRaw.includes("gty") || statusRaw.includes("tetap yayasan") ||
          jenis.includes("gty") || jenis.includes("tetap yayasan") ||
          statusRaw.includes("kamad") || statusRaw.includes("kepala") ||
          jenis.includes("kamad") || jenis.includes("kepala")) {
        skType = "gty";
      } else if (statusRaw.includes("gtt") || statusRaw.includes("tidak tetap") ||
                 jenis.includes("gtt") || jenis.includes("tidak tetap")) {
        skType = "gtt";
      }

      // 1. Fetch Template — use skTemplateApi.getActive with fallback to static file
      const fallbackUrl = `/templates/sk-${skType}-template.docx`;
      let templateBinary: string;

      try {
        const templateRes = await skTemplateApi.getActive(skType);
        const fileUrl = templateRes?.file_url ?? fallbackUrl;
        const resp = await fetch(fileUrl);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const arrayBuffer = await resp.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let b = 0; b < bytes.byteLength; b++) binary += String.fromCharCode(bytes[b]);
        templateBinary = binary;
      } catch {
        // Fallback to static bundled template
        const resp = await fetch(fallbackUrl);
        if (!resp.ok) throw new Error(`Template ${skType} tidak tersedia (${resp.status})`);
        const arrayBuffer = await resp.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let b = 0; b < bytes.byteLength; b++) binary += String.fromCharCode(bytes[b]);
        templateBinary = binary;
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

  const rawList = useMemo(() => {
    const list = Array.isArray(revisionsList) ? revisionsList : ((revisionsList as any)?.data || []);
    return list;
  }, [revisionsList]);

  // Tab counts
  const tabCounts = useMemo(() => {
    const counts = { all: rawList.length, pending: 0, approved: 0, rejected: 0 };
    rawList.forEach((item: any) => {
      const st = (item.revision_status || item.status || "").toLowerCase();
      if (st === "revision_pending" || st === "pending") counts.pending++;
      else if (st === "approved") counts.approved++;
      else if (st === "rejected") counts.rejected++;
    });
    return counts;
  }, [rawList]);

  const filteredData = useMemo(() => {
    if (!rawList.length) return [];
    
    let results = rawList;

    // Filter by Tab
    if (activeTab === "pending") {
      results = results.filter((item: any) => {
        const st = (item.revision_status || item.status || "").toLowerCase();
        return st === "revision_pending" || st === "pending";
      });
    } else if (activeTab === "approved") {
      results = results.filter((item: any) => {
        const st = (item.revision_status || item.status || "").toLowerCase();
        return st === "approved";
      });
    } else if (activeTab === "rejected") {
      results = results.filter((item: any) => {
        const st = (item.revision_status || item.status || "").toLowerCase();
        return st === "rejected";
      });
    }

    // Filter by Search
    if (debouncedSearchTerm) {
      const term = debouncedSearchTerm.toLowerCase().trim();
      results = results.filter(
        (item: any) =>
          item.nama?.toLowerCase().includes(term) ||
          item.teacher?.nama?.toLowerCase().includes(term) ||
          item.sk_document?.nomor_sk?.toLowerCase().includes(term) ||
          item.nomor_sk?.toLowerCase().includes(term) ||
          item.unit_kerja?.toLowerCase().includes(term) ||
          item.revision_reason?.toLowerCase().includes(term)
      );
    }
    return results;
  }, [rawList, activeTab, debouncedSearchTerm]);

  const approvedSksList = useMemo(() => {
    if (Array.isArray(approvedSksData?.data)) return approvedSksData.data;
    if (Array.isArray(approvedSksData)) return approvedSksData;
    return [];
  }, [approvedSksData]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header with CTA Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <SoftPageHeader
          title="Layanan Revisi & Koreksi SK"
          description="Kelola permohonan koreksi data SK terbit serta lacak status verifikasi dari Pengurus Cabang."
          category="PUSAT LAYANAN SK"
          icon={<FileEdit className="w-6 h-6 text-purple-600" />}
        />
        <div className="flex-shrink-0">
          <Button
            onClick={() => setIsSelectSkModalOpen(true)}
            className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-2xl h-11 px-5 font-extrabold text-xs shadow-md shadow-purple-200 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Ajukan Revisi SK Baru</span>
          </Button>
        </div>
      </div>

      {/* Main Card with Tabs & Search */}
      <Card className="border border-slate-200/80 shadow-sm bg-white rounded-3xl overflow-hidden">
        <CardHeader className="p-6 sm:p-8 border-b bg-slate-50/50 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-600" />
                <span>Daftar Tiket Permohonan Revisi</span>
              </CardTitle>
              <CardDescription className="font-medium text-slate-500 text-xs mt-1">
                {isAdmin 
                  ? "Daftar permohonan koreksi data yang diajukan oleh Operator Satuan Pendidikan." 
                  : "Pantau progres verifikasi permohonan perbaikan data SK madrasah Anda."}
              </CardDescription>
            </div>

            {/* Search Bar */}
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Cari guru, no. SK, unit kerja..."
                className="pl-10 h-10 border-slate-200 rounded-xl text-xs bg-white focus-visible:ring-purple-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-2">
            {[
              { id: "all", label: "Semua", count: tabCounts.all },
              { id: "pending", label: "Menunggu Verifikasi", count: tabCounts.pending, color: "text-amber-700 bg-amber-50 border-amber-200" },
              { id: "approved", label: "Disetujui", count: tabCounts.approved, color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
              { id: "rejected", label: "Ditolak", count: tabCounts.rejected, color: "text-red-700 bg-red-50 border-red-200" },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap border ${
                    isActive
                      ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100/70"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                    isActive ? "bg-slate-800 text-purple-200" : "bg-slate-100 text-slate-500"
                  }`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="border-slate-100">
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-wider py-4 pl-6 sm:pl-8">Data Guru & SK</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-wider py-4">Alasan & Catatan</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-wider py-4">Status</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-wider py-4 text-right pr-6 sm:pr-8">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {error ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-44 text-center text-red-500 font-bold uppercase tracking-wider px-8">
                    Gagal memuat data revisi. Silakan coba lagi nanti.
                  </TableCell>
                </TableRow>
              ) : isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-44 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-purple-600"/>
                  </TableCell>
                </TableRow>
              ) : filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3 py-6">
                      <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-500">
                        <FileEdit className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-700">Tidak ada data permohonan revisi</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {activeTab !== "all" ? "Tidak ada item pada filter ini." : "Belum ada pengajuan koreksi data yang terdaftar."}
                        </p>
                      </div>
                      <Button
                        onClick={() => setIsSelectSkModalOpen(true)}
                        variant="outline"
                        size="sm"
                        className="rounded-xl border-purple-200 text-purple-700 hover:bg-purple-50 font-bold text-xs"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" /> Buat Pengajuan Baru
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((item: any) => {
                  const statusKey = (item.revision_status || item.status || "").toLowerCase();
                  const isPending = statusKey === "revision_pending" || statusKey === "pending";
                  const isApproved = statusKey === "approved";
                  const isRejected = statusKey === "rejected";

                  return (
                    <TableRow key={item.id} className="hover:bg-slate-50/70 border-slate-100 transition-colors">
                      <TableCell className="py-4 pl-6 sm:pl-8">
                        <div className="font-extrabold text-slate-800 text-sm">{item.nama}</div>
                        <div className="text-[11px] font-bold text-purple-700 mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span>{item.nomor_sk || "DRAFT SK"}</span>
                          <span>•</span>
                          <span className="text-slate-500">{item.unit_kerja || "-"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 max-w-xs">
                        <span className="text-xs font-medium text-slate-600 bg-slate-100/90 px-3 py-1.5 rounded-xl inline-block border border-slate-200/80 line-clamp-2">
                          "{item.revision_reason || "Tidak ada detail alasan."}"
                        </span>
                      </TableCell>
                      <TableCell className="py-4">
                        {isPending ? (
                          <Badge className="bg-amber-100/80 text-amber-800 hover:bg-amber-100 border-amber-200 font-bold text-[10px] uppercase tracking-wider py-1 px-2.5 rounded-lg flex items-center gap-1 w-fit">
                            <Clock className="w-3 h-3" />
                            <span>Menunggu</span>
                          </Badge>
                        ) : isApproved ? (
                          <Badge className="bg-emerald-100/80 text-emerald-800 hover:bg-emerald-100 border-emerald-200 font-bold text-[10px] uppercase tracking-wider py-1 px-2.5 rounded-lg flex items-center gap-1 w-fit">
                            <CheckCircle className="w-3 h-3" />
                            <span>Disetujui</span>
                          </Badge>
                        ) : isRejected ? (
                          <Badge className="bg-red-100/80 text-red-800 hover:bg-red-100 border-red-200 font-bold text-[10px] uppercase tracking-wider py-1 px-2.5 rounded-lg flex items-center gap-1 w-fit">
                            <XCircle className="w-3 h-3" />
                            <span>Ditolak</span>
                          </Badge>
                        ) : (
                          <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 border-slate-200 font-bold text-[10px] uppercase tracking-wider py-1 px-2.5 rounded-lg w-fit">
                            {statusKey}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-4 text-right pr-6 sm:pr-8">
                        <div className="flex justify-end items-center gap-2">
                          {isPending && isAdmin ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-3 rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-bold text-xs"
                                onClick={() => handleApproveRevisionSubmit(item.id)}
                                disabled={isActionLoading}
                              >
                                <CheckCircle className="h-3.5 w-3.5 mr-1" /> Setujui
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-3 rounded-xl border-purple-200 text-purple-700 hover:bg-purple-50 font-bold text-xs"
                                onClick={() => handleOpenPreview(item)}
                              >
                                <Eye className="h-3.5 w-3.5 mr-1" /> Cek Diff
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-3 rounded-xl border-red-200 text-red-700 hover:bg-red-50 font-bold text-xs"
                                onClick={() => handleRejectRevisionSubmit(item.id)}
                                disabled={isActionLoading}
                              >
                                <XCircle className="h-3.5 w-3.5 mr-1" /> Tolak
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-3 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs"
                                onClick={() => handleOpenPreview(item)}
                              >
                                <Eye className="h-3.5 w-3.5 mr-1" /> Tinjau
                              </Button>
                              {isApproved && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 p-0 rounded-xl border-slate-200 text-slate-500 hover:text-blue-600"
                                  onClick={() => handleDownloadDocx(item)}
                                  disabled={isActionLoading}
                                  title="Download SK (Word)"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/dashboard/sk/${item.id}`)}
                                className="h-8 rounded-xl font-bold text-xs text-slate-500 hover:text-purple-600"
                              >
                                Detail
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* DIALOG 1: MODAL PEMILIH SK UNTUK DIREVISI */}
      <Dialog open={isSelectSkModalOpen} onOpenChange={setIsSelectSkModalOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden border-0 rounded-3xl shadow-2xl bg-white">
          <DialogHeader className="p-6 sm:p-8 bg-gradient-to-r from-purple-50 via-indigo-50 to-purple-50 border-b border-purple-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-200">
                <FileEdit className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-slate-900 tracking-tight">
                  Pilih Dokumen SK untuk Diajukan Revisi
                </DialogTitle>
                <DialogDescription className="text-slate-500 text-xs font-medium mt-0.5">
                  Pilih guru/tendik dengan SK resmi terbit yang ingin Anda ajukan koreksi datanya.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Search box in modal */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Ketik nama guru, NIP, atau nomor SK..."
                className="pl-10 h-11 border-slate-200 rounded-xl text-xs bg-slate-50/50 focus-visible:ring-purple-500"
                value={skSelectorSearch}
                onChange={(e) => setSkSelectorSearch(e.target.value)}
                autoFocus
              />
            </div>

            {/* SK List */}
            <div className="space-y-2 pt-1">
              {isLoadingApprovedSks ? (
                <div className="py-12 text-center space-y-2">
                  <Loader2 className="w-7 h-7 animate-spin mx-auto text-purple-600" />
                  <p className="text-xs text-slate-400 font-medium">Memuat data SK terbit...</p>
                </div>
              ) : approvedSksList.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto opacity-70" />
                  <p className="text-xs font-bold text-slate-700">Tidak ditemukan dokumen SK yang sesuai</p>
                  <p className="text-[11px] text-slate-400">Pastikan SK telah disetujui resmi oleh Pengurus Cabang.</p>
                </div>
              ) : (
                approvedSksList.map((sk: any) => (
                  <div
                    key={sk.id}
                    className="p-4 rounded-2xl border border-slate-200/80 hover:border-purple-300 hover:bg-purple-50/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-slate-900 group-hover:text-purple-700 transition-colors">
                          {sk.nama}
                        </span>
                        <Badge variant="outline" className="text-[9px] font-bold text-slate-500 border-slate-200">
                          {sk.status_kepegawaian || "Guru"}
                        </Badge>
                      </div>
                      <div className="text-xs text-slate-500 font-medium flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-purple-700 font-bold">{sk.nomor_sk || "Tanpa No. SK"}</span>
                        <span>•</span>
                        <span>{sk.unit_kerja || "-"}</span>
                      </div>
                    </div>
                    <Button
                      onClick={() => {
                        setIsSelectSkModalOpen(false);
                        navigate(`/dashboard/sk/${sk.id}/revision`);
                      }}
                      className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl h-9 px-4 text-xs font-bold flex items-center gap-1.5 shadow-sm self-end sm:self-center flex-shrink-0"
                    >
                      <span>Pilih & Ajukan</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          <DialogFooter className="p-4 sm:p-6 bg-slate-50 border-t flex justify-end">
            <Button
              variant="ghost"
              onClick={() => setIsSelectSkModalOpen(false)}
              className="rounded-xl font-bold text-xs text-slate-500"
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 2: PREVIEW DIFF PERUBAHAN DATA */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden border-0 rounded-3xl shadow-2xl bg-white">
          <DialogHeader className="p-6 sm:p-8 bg-gradient-to-r from-purple-50 via-slate-50 to-indigo-50 border-b border-slate-200/80">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-200">
                <FileEdit className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-slate-900 tracking-tight">
                  Tinjau Usulan Koreksi Data SK
                </DialogTitle>
                <DialogDescription className="text-slate-500 text-xs font-medium mt-0.5">
                  Bandingkan data eksisting pada arsip dengan usulan perbaikan dari sekolah.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <div className="p-6 sm:p-8 space-y-6 max-h-[65vh] overflow-y-auto">
            {/* Reason Box */}
            <div className="bg-purple-50/70 p-4 rounded-2xl border border-purple-100">
              <h4 className="text-[10px] font-black uppercase tracking-wider text-purple-700 mb-1 flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5" /> Alasan Pengajuan Koreksi:
              </h4>
              <p className="text-xs font-bold text-slate-800 italic">
                "{selectedItem?.revision_reason || 'Tidak ada alasan khusus dicantumkan.'}"
              </p>
            </div>

            {/* Dokumen Pendukung — Ijazah */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-4">
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Dokumen Pendukung (Scan Ijazah/Bukti)
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedItem?.ijazah_url ? "Dokumen lampiran tersedia untuk diverifikasi." : "Tidak ada file pendukung dilampirkan."}
                </p>
              </div>
              {selectedItem?.ijazah_url && (
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-blue-50 border-blue-200 rounded-xl text-xs font-bold text-blue-700 hover:bg-blue-100 flex items-center gap-1.5"
                  onClick={(e) => {
                    e.preventDefault();
                    const token = localStorage.getItem('auth_token');
                    const path = selectedItem.ijazah_url.replace(/^\/?(storage\/|api\/minio\/)?/, '');
                    const url = `${API_URL}/files/view/${path.split('/').map(encodeURIComponent).join('/')}`;
                    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
                      .then(r => {
                        if (!r.ok) throw new Error(`HTTP ${r.status}`);
                        return r.blob();
                      })
                      .then(blob => {
                        const objUrl = URL.createObjectURL(blob);
                        window.open(objUrl, '_blank');
                      })
                      .catch(() => toast.error('Gagal membuka ijazah. File mungkin tidak tersedia.'));
                  }}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Lihat Ijazah</span>
                </Button>
              )}
            </div>

            {/* Diff Comparison Table / Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
              {/* Left: Original Data */}
              <div className="space-y-4 p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80">
                <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-2">
                  Data Saat Ini (Lama)
                </h4>
                <div className="space-y-3">
                  {[
                    { label: "Nama Lengkap", val: selectedItem?.nama },
                    { label: "NIP", val: selectedItem?.teacher?.nip },
                    { label: "Tempat Lahir", val: selectedItem?.teacher?.tempat_lahir },
                    { label: "Tanggal Lahir", val: selectedItem?.teacher?.tanggal_lahir?.split('T')[0] },
                    { label: "Pendidikan Terakhir", val: selectedItem?.teacher?.pendidikan_terakhir },
                    { label: "Unit Kerja", val: selectedItem?.unit_kerja },
                    { label: "TMT", val: selectedItem?.teacher?.tmt?.split('T')[0] },
                  ].map(f => (
                    <div key={f.label} className="space-y-0.5">
                      <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">{f.label}</p>
                      <p className="text-xs font-bold text-slate-600">{f.val || "-"}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Proposed Data */}
              <div className="space-y-4 p-4 rounded-2xl bg-purple-50/40 border border-purple-200/70">
                <h4 className="text-[11px] font-black uppercase tracking-wider text-purple-700 border-b border-purple-200 pb-2">
                  Data Usulan (Koreksi Baru)
                </h4>
                <div className="space-y-3">
                  {[
                    { key: 'nama', label: "Nama Lengkap" },
                    { key: 'nip', label: "NIP" },
                    { key: 'tempat_lahir', label: "Tempat Lahir" },
                    { key: 'tanggal_lahir', label: "Tanggal Lahir" },
                    { key: 'pendidikan_terakhir', label: "Pendidikan Terakhir" },
                    { key: 'unit_kerja', label: "Unit Kerja" },
                    { key: 'tmt', label: "TMT" },
                  ].map(f => {
                    const originalVal = f.key === 'nama' || f.key === 'unit_kerja' 
                      ? selectedItem?.[f.key] 
                      : selectedItem?.teacher?.[f.key];
                    const proposedVal = selectedItem?.revision_data?.[f.key];
                    const isChanged = proposedVal && proposedVal !== originalVal;

                    return (
                      <div key={f.label} className="space-y-0.5">
                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">{f.label}</p>
                        <p className={`text-xs font-bold ${
                          isChanged 
                            ? 'text-purple-700 bg-purple-100/90 px-2 py-0.5 rounded-md inline-block font-extrabold' 
                            : 'text-slate-600'
                        }`}>
                          {proposedVal || "-"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 sm:p-6 bg-slate-50 border-t flex flex-col sm:flex-row justify-between items-center gap-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 text-center sm:text-left">
              Pastikan verifikasi berkas telah sesuai regulasi Pengurus Cabang
            </p>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button 
                variant="ghost" 
                onClick={() => setIsPreviewOpen(false)} 
                className="h-10 px-4 rounded-xl font-bold text-xs text-slate-500"
              >
                Tutup
              </Button>
              {isAdmin && ((selectedItem?.status?.toLowerCase() === "revision_pending") || (selectedItem?.revision_status?.toLowerCase() === "revision_pending")) && (
                <Button 
                  onClick={handleApproveFromPreview}
                  disabled={isActionLoading}
                  className="h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-100 flex items-center gap-1.5"
                >
                  {isActionLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <CheckCircle className="h-4 w-4"/>}
                  <span>Setujui Perubahan</span>
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
