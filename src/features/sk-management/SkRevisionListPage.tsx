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
import { Loader2 } from "lucide-react"
import { api as convexApi } from "../../../convex/_generated/api"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

export default function SkRevisionListPage() {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState("")
  const [isActionLoading, setIsActionLoading] = useState(false)
  
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
                                <Button variant="ghost" size="sm" onClick={() => navigate(`/dashboard/sk/${item._id}`)}>
                                    <FileEdit className="h-4 w-4 mr-2" />
                                    Lihat Detail SK
                                </Button>
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
