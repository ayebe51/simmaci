import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, CheckCircle, FileText, AlertTriangle, XCircle, Printer } from "lucide-react"
import { useNavigate, useParams } from "react-router-dom"
import StatusBadge from "@/components/shared/StatusBadge"
import type { StatusType } from "@/components/shared/StatusBadge"
import { useState } from "react"
import { Separator } from "@/components/ui/separator"
// 🔥 CONVEX REAL-TIME
import { useQuery, useMutation } from "convex/react"
import { api as convexApi } from "../../../convex/_generated/api"
import { Id } from "../../../convex/_generated/dataModel"
import { toast } from "sonner"

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
  
  // Mutations
  const updateSk = useMutation(convexApi.sk.update)
  
  // ✅ CHECK ACTUAL USER ROLE from localStorage
  const [isAdmin] = useState(() => {
    try {
      const userStr = localStorage.getItem("user")
      if (!userStr) return false
      const user = JSON.parse(userStr)
      // Only super_admin can approve/reject SK
      return user.role === "super_admin"
    } catch {
      return false
    }
  })
  
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

  const handleAction = async (action: "approve" | "reject" | "revise") => {
      console.log("[DEBUG] handleAction called with action:", action, "| SK id:", id);
      
      // Confirmation
      const confirmMsg = action === 'approve' ? 'Menyetujui' : action === 'reject' ? 'Menolak' : 'Merevisi';
      const confirmed = window.confirm(`Apakah Anda yakin ingin ${confirmMsg} SK ini?`);
      
      console.log("[DEBUG] User confirmed:", confirmed);
      if(!confirmed) return;

      try {
          let status = "";
          if (action === "approve") status = "active";
          else if (action === "reject") status = "archived";
          else if (action === "revise") status = "draft";

          console.log("[DEBUG] Calling Convex update with id:", id, "status:", status);
          toast.info(`Memproses ${confirmMsg}...`);
          
          await updateSk({ 
            id: id as Id<"skDocuments">, 
            status: status 
          });
          
          console.log("[DEBUG] Convex update successful");
          toast.success(`SK Berhasil di-${status}`);
          // No need to re-fetch, Convex auto-updates!
      } catch (e: any) {
          console.error("[ERROR] handleAction failed:", e);
          const errorMessage = e?.message || "Error tidak diketahui";
          toast.error(`Gagal memproses tindakan: ${errorMessage}`);
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
                        <AlertTriangle className="mr-2 h-4 w-4 text-orange-500" /> Ajukan Revisi
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
    </div>
  )
}
