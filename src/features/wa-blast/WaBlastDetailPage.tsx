import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, RefreshCw, X, FileText, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { BlastStatusBadge } from "./components/BlastStatusBadge"
import { BlastProgressBar } from "./components/BlastProgressBar"
import { RecipientDetailTable } from "./components/RecipientDetailTable"
import { useWaBlast } from "./hooks/useWaBlast"
import { useWaBlastProgress } from "./hooks/useWaBlastProgress"
import { waBlastService } from "./services/waBlastService"
import { format } from "date-fns"
import { id } from "date-fns/locale"
import { toast } from "sonner"
import { useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"

export default function WaBlastDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: blast, isLoading, error, refetch } = useWaBlast(Number(id))
  const { data: progress } = useWaBlastProgress(
    Number(id),
    blast?.blast_status === "sending"
  )

  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [showRetryDialog, setShowRetryDialog] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleCancel = async () => {
    setIsProcessing(true)
    try {
      await waBlastService.deleteBlast(Number(id))
      toast.success("Blast berhasil dibatalkan")
      navigate("/dashboard/wa-blast")
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Gagal membatalkan blast")
      setIsProcessing(false)
    }
  }

  const handleRetry = async () => {
    setIsProcessing(true)
    try {
      const result = await waBlastService.retryBlast(Number(id))
      toast.success("Blast retry berhasil dibuat!")
      navigate(`/dashboard/wa-blast/${result.data.id}`)
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Gagal membuat retry blast")
      setIsProcessing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (error || !blast) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Gagal memuat detail blast. Silakan coba lagi.
        </AlertDescription>
      </Alert>
    )
  }

  const canCancel = blast.blast_status === "scheduled" || blast.blast_status === "draft"
  const canRetry = blast.blast_status === "completed" && (blast.failed_count || 0) > 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard/wa-blast")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-800">{blast.title}</h1>
            <p className="text-sm text-slate-500 mt-1">
              Dibuat pada{" "}
              {format(new Date(blast.created_at), "dd MMMM yyyy HH:mm", {
                locale: id,
              })}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {canCancel && (
            <Button
              variant="destructive"
              onClick={() => setShowCancelDialog(true)}
            >
              <X className="h-4 w-4 mr-2" />
              Batalkan
            </Button>
          )}
          {canRetry && (
            <Button
              variant="outline"
              onClick={() => setShowRetryDialog(true)}
              className="border-emerald-600 text-emerald-600 hover:bg-emerald-50"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Kirim Ulang ke yang Gagal
            </Button>
          )}
        </div>
      </div>

      {/* Status & Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informasi Blast</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-slate-500">Status</p>
              <BlastStatusBadge status={blast.blast_status} />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Penerima</p>
              <p className="text-lg font-semibold">{blast.total_recipients || 0}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Terkirim</p>
              <p className="text-lg font-semibold text-emerald-600">
                {progress?.sent_count || blast.sent_count || 0}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Gagal</p>
              <p className="text-lg font-semibold text-red-600">
                {progress?.failed_count || blast.failed_count || 0}
              </p>
            </div>
          </div>

          {blast.scheduled_at && (
            <div>
              <p className="text-sm text-slate-500">Waktu Terjadwal</p>
              <p className="text-base font-medium">
                {format(new Date(blast.scheduled_at), "dd MMMM yyyy HH:mm", {
                  locale: id,
                })}
              </p>
            </div>
          )}

          {blast.sent_at && (
            <div>
              <p className="text-sm text-slate-500">Waktu Mulai Kirim</p>
              <p className="text-base font-medium">
                {format(new Date(blast.sent_at), "dd MMMM yyyy HH:mm", {
                  locale: id,
                })}
              </p>
            </div>
          )}

          {blast.completed_at && (
            <div>
              <p className="text-sm text-slate-500">Waktu Selesai</p>
              <p className="text-base font-medium">
                {format(new Date(blast.completed_at), "dd MMMM yyyy HH:mm", {
                  locale: id,
                })}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Progress Bar (if sending) */}
      {blast.blast_status === "sending" && progress && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Progres Pengiriman</CardTitle>
          </CardHeader>
          <CardContent>
            <BlastProgressBar
              sentCount={progress.sent_count}
              totalCount={progress.total_count}
            />
          </CardContent>
        </Card>
      )}

      {/* Message Content */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Isi Pesan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-slate-50 p-4 rounded-lg whitespace-pre-wrap">
            {blast.message_body}
          </div>
          {blast.attachment_name && (
            <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
              <FileText className="h-4 w-4" />
              <span>Lampiran: {blast.attachment_name}</span>
              {blast.attachment_path && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    // Download attachment logic
                    window.open(
                      `${import.meta.env.VITE_API_URL?.replace("/api", "") || ""}/storage/${blast.attachment_path}`,
                      "_blank"
                    )
                  }}
                >
                  <Download className="h-3 w-3 mr-1" />
                  Unduh
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recipients Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daftar Penerima</CardTitle>
        </CardHeader>
        <CardContent>
          <RecipientDetailTable blastId={Number(id)} />
        </CardContent>
      </Card>

      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Batalkan Blast</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin membatalkan blast ini? Tindakan ini tidak
              dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(false)}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={isProcessing}
            >
              {isProcessing ? "Membatalkan..." : "Ya, Batalkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Retry Dialog */}
      <Dialog open={showRetryDialog} onOpenChange={setShowRetryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kirim Ulang ke yang Gagal</DialogTitle>
            <DialogDescription>
              Sistem akan membuat blast baru yang hanya mengirim ke{" "}
              <strong>{blast.failed_count} penerima yang gagal</strong>. Apakah
              Anda ingin melanjutkan?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRetryDialog(false)}>
              Batal
            </Button>
            <Button
              onClick={handleRetry}
              disabled={isProcessing}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isProcessing ? "Membuat..." : "Ya, Kirim Ulang"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
