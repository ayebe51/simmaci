import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Send, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { RecipientSelector } from "./components/RecipientSelector"
import { RecipientPreviewTable } from "./components/RecipientPreviewTable"
import { MessageComposer } from "./components/MessageComposer"
import { TemplatePickerModal } from "./components/TemplatePickerModal"
import { AttachmentUploader } from "./components/AttachmentUploader"
import { ScheduleSelector } from "./components/ScheduleSelector"
import { useRecipientPreview } from "./hooks/useRecipientPreview"
import { useWaBlastConfig } from "./hooks/useWaBlastConfig"
import { createBlast } from "./services/waBlastService"
import { toast } from "sonner"

export default function WaBlastCreatePage() {
  const navigate = useNavigate()
  const { data: config, isLoading: configLoading } = useWaBlastConfig()
  const previewMutation = useRecipientPreview()

  const [title, setTitle] = useState("")
  const [recipientCategory, setRecipientCategory] = useState<string>("kepala_sekolah")
  const [jenjang, setJenjang] = useState<string[]>([])
  const [schoolIds, setSchoolIds] = useState<number[]>([])
  const [messageBody, setMessageBody] = useState("")
  const [attachment, setAttachment] = useState<File | null>(null)
  const [scheduledAt, setScheduledAt] = useState<string | null>(null)
  const [excludedPhones, setExcludedPhones] = useState<string[]>([])
  
  const [previewData, setPreviewData] = useState<any>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const configMissing = !configLoading && (!config || !config.api_url || !config.api_token)

  const handlePreview = async () => {
    if (!recipientCategory) {
      toast.error("Pilih kategori penerima terlebih dahulu")
      return
    }

    try {
      const result = await previewMutation.mutateAsync({
        recipient_category: recipientCategory,
        jenjang: jenjang.length > 0 ? jenjang : undefined,
        school_ids: schoolIds.length > 0 ? schoolIds : undefined,
      })
      setPreviewData(result)
      setShowPreview(true)
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Gagal memuat preview penerima")
    }
  }

  const handleRemoveRecipient = (phone: string) => {
    setExcludedPhones((prev) => [...prev, phone])
    if (previewData && previewData.recipients && Array.isArray(previewData.recipients)) {
      setPreviewData({
        ...previewData,
        recipients: previewData.recipients.filter((r: any) => r.phone_number !== phone),
        valid_count: Math.max(0, (previewData.valid_count || 0) - 1),
      })
    }
  }

  const handleTemplateSelect = (templateBody: string) => {
    setMessageBody(templateBody)
  }

  const handleSubmit = async () => {
    // Validation
    if (!title.trim()) {
      toast.error("Judul blast tidak boleh kosong")
      return
    }
    if (!messageBody.trim()) {
      toast.error("Isi pesan tidak boleh kosong")
      return
    }
    if (!previewData || !previewData.recipients || previewData.recipients.length === 0) {
      toast.error("Belum ada penerima. Klik Preview untuk melihat daftar penerima.")
      return
    }

    setShowConfirmDialog(true)
  }

  const handleConfirmSend = async () => {
    setIsSubmitting(true)
    setShowConfirmDialog(false)

    try {
      const result = await createBlast({
        title,
        recipient_category: recipientCategory,
        jenjang: jenjang.length > 0 ? jenjang : undefined,
        school_ids: schoolIds.length > 0 ? schoolIds : undefined,
        message_body: messageBody,
        attachment: attachment || undefined,
        scheduled_at: scheduledAt || undefined,
        excluded_phone_numbers: excludedPhones.length > 0 ? excludedPhones : undefined,
      })
      
      toast.success(
        scheduledAt
          ? "Blast berhasil dijadwalkan!"
          : "Blast sedang dikirim di latar belakang!"
      )
      navigate(`/dashboard/wa-blast/${result.id}`)
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Gagal membuat blast")
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/dashboard/wa-blast")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Buat Blast Baru</h1>
          <p className="text-sm text-slate-500 mt-1">
            Kirim pesan WhatsApp massal ke kepala sekolah dan/atau guru
          </p>
        </div>
      </div>

      {/* Config Warning */}
      {configMissing && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Konfigurasi Go-WA Gateway belum diatur. Hubungi administrator untuk
            mengkonfigurasi sistem sebelum mengirim blast.
          </AlertDescription>
        </Alert>
      )}

      {/* Title */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Judul Blast</CardTitle>
        </CardHeader>
        <CardContent>
          <Label htmlFor="title">Judul</Label>
          <Input
            id="title"
            placeholder="Contoh: Pengumuman Rapat Koordinasi"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-2"
          />
        </CardContent>
      </Card>

      {/* Recipient Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pilih Penerima</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RecipientSelector
            category={recipientCategory}
            onCategoryChange={setRecipientCategory}
            jenjang={jenjang}
            onJenjangChange={setJenjang}
            schoolIds={schoolIds}
            onSchoolIdsChange={setSchoolIds}
          />
          <Button
            onClick={handlePreview}
            variant="outline"
            disabled={previewMutation.isPending}
          >
            {previewMutation.isPending ? "Memuat..." : "Preview Penerima"}
          </Button>
        </CardContent>
      </Card>

      {/* Preview Table */}
      {showPreview && previewData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daftar Penerima</CardTitle>
          </CardHeader>
          <CardContent>
            <RecipientPreviewTable
              recipients={previewData.recipients}
              validCount={previewData.valid_count}
              invalidCount={previewData.invalid_count}
              onRemove={handleRemoveRecipient}
            />
          </CardContent>
        </Card>
      )}

      {/* Message Composition */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Komposisi Pesan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <TemplatePickerModal onSelect={handleTemplateSelect} />
          </div>
          <MessageComposer value={messageBody} onChange={setMessageBody} />
        </CardContent>
      </Card>

      {/* Attachment */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lampiran (Opsional)</CardTitle>
        </CardHeader>
        <CardContent>
          <AttachmentUploader
            file={attachment}
            onFileChange={setAttachment}
            onRemove={() => setAttachment(null)}
          />
        </CardContent>
      </Card>

      {/* Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Jadwal Pengiriman</CardTitle>
        </CardHeader>
        <CardContent>
          <ScheduleSelector
            scheduledAt={scheduledAt}
            onScheduledAtChange={setScheduledAt}
          />
        </CardContent>
      </Card>

      {/* Submit Button */}
      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => navigate("/dashboard/wa-blast")}
        >
          Batal
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={configMissing || isSubmitting}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Send className="h-4 w-4 mr-2" />
          {scheduledAt ? "Jadwalkan Blast" : "Kirim Sekarang"}
        </Button>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konfirmasi Pengiriman</DialogTitle>
            <DialogDescription>
              Anda akan mengirim pesan ke{" "}
              <strong>{previewData?.valid_count || 0} penerima</strong>.
              {scheduledAt && (
                <>
                  {" "}
                  Pesan akan dikirim pada{" "}
                  <strong>
                    {new Date(scheduledAt).toLocaleString("id-ID")}
                  </strong>
                  .
                </>
              )}
              <br />
              <br />
              Apakah Anda yakin ingin melanjutkan?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
            >
              Batal
            </Button>
            <Button
              onClick={handleConfirmSend}
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isSubmitting ? "Mengirim..." : "Ya, Kirim"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
