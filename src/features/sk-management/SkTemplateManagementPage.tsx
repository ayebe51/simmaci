import { useState, useRef } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Upload, FileText, Loader2, CheckCircle2, Download, Trash2,
  Zap, FileUp, LayoutTemplate,
} from 'lucide-react'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

import { skTemplateApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import PageHeader from '@/components/ui/PageHeader'

// ── Types ──────────────────────────────────────────────────────────────────

interface SkTemplate {
  id: number
  sk_type: string
  original_filename: string
  is_active: boolean
  uploaded_by: string
  created_at: string
  updated_at: string
}

// ── Zod schema ─────────────────────────────────────────────────────────────

const uploadFormSchema = z.object({
  file: z
    .instanceof(File, { message: 'Pilih file terlebih dahulu' })
    .refine((f) => f.name.toLowerCase().endsWith('.docx'), 'File harus berformat .docx')
    .refine((f) => f.size <= 10 * 1024 * 1024, 'Ukuran file maksimal 10 MB'),
  sk_type: z.enum(['gty', 'gtt', 'kamad', 'tendik'], {
    required_error: 'Pilih jenis SK',
  }),
})

type UploadFormValues = z.infer<typeof uploadFormSchema>

// ── SK type config ─────────────────────────────────────────────────────────

const SK_TYPES = [
  { value: 'gty', label: 'GTY', fullLabel: 'Guru Tetap Yayasan' },
  { value: 'gtt', label: 'GTT', fullLabel: 'Guru Tidak Tetap' },
  { value: 'kamad', label: 'Kamad', fullLabel: 'Kepala Madrasah' },
  { value: 'tendik', label: 'Tendik', fullLabel: 'Tenaga Kependidikan' },
] as const

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  try {
    return format(new Date(dateStr), 'd MMM yyyy, HH:mm', { locale: localeId })
  } catch {
    return dateStr
  }
}

// ── Upload Form ────────────────────────────────────────────────────────────

function UploadForm({ onSuccess }: { onSuccess: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<UploadFormValues>({
    resolver: zodResolver(uploadFormSchema),
  })

  const selectedFile = watch('file')

  const uploadMutation = useMutation({
    mutationFn: ({ file, sk_type }: UploadFormValues) =>
      skTemplateApi.upload(file, sk_type),
    onSuccess: () => {
      toast.success('Template berhasil diunggah')
      reset()
      if (fileInputRef.current) fileInputRef.current.value = ''
      onSuccess()
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Gagal mengunggah template'
      toast.error(msg)
    },
  })

  const onSubmit = (data: UploadFormValues) => uploadMutation.mutate(data)

  return (
    <Card className="border-0 shadow-sm rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-black uppercase tracking-widest text-slate-700 flex items-center gap-2">
          <FileUp className="h-4 w-4 text-blue-500" />
          Unggah Template Baru
        </CardTitle>
        <CardDescription className="text-xs text-slate-400">
          Format .docx, maksimal 10 MB
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* File picker */}
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
              File Template (.docx)
            </Label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-3 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 hover:bg-slate-100 cursor-pointer transition-all p-4"
            >
              {selectedFile ? (
                <>
                  <FileText className="h-5 w-5 text-blue-500 shrink-0" />
                  <span className="text-sm font-semibold text-blue-700 truncate">{selectedFile.name}</span>
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5 text-slate-300 shrink-0" />
                  <span className="text-sm text-slate-400">Klik untuk memilih file</span>
                </>
              )}
            </div>
            <Controller
              name="file"
              control={control}
              render={() => (
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".docx"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) setValue('file', f, { shouldValidate: true })
                  }}
                />
              )}
            />
            {errors.file && (
              <p className="text-xs text-red-500 font-medium">{errors.file.message}</p>
            )}
          </div>

          {/* SK Type select */}
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
              Jenis SK
            </Label>
            <Controller
              name="sk_type"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-0 focus:ring-blue-500 font-bold text-slate-700">
                    <SelectValue placeholder="Pilih jenis SK" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {SK_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label} — {t.fullLabel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.sk_type && (
              <p className="text-xs text-red-500 font-medium">{errors.sk_type.message}</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={uploadMutation.isPending}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11 font-black uppercase tracking-widest text-xs shadow-lg shadow-blue-100"
          >
            {uploadMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Unggah Template
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

// ── Template Row ───────────────────────────────────────────────────────────

interface TemplateRowProps {
  template: SkTemplate
  optimisticActiveId: number | null
  onActivate: (template: SkTemplate) => void
  onDownload: (template: SkTemplate) => void
  onDelete: (template: SkTemplate) => void
  isActivating: boolean
  isDownloading: boolean
  isDeleting: boolean
}

function TemplateRow({
  template,
  optimisticActiveId,
  onActivate,
  onDownload,
  onDelete,
  isActivating,
  isDownloading,
  isDeleting,
}: TemplateRowProps) {
  const isActive =
    optimisticActiveId !== null
      ? template.id === optimisticActiveId
      : template.is_active

  return (
    <div className="flex items-center gap-3 py-3 px-4 rounded-xl hover:bg-slate-50 transition-colors group">
      <FileText className="h-4 w-4 text-slate-300 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-700 truncate">{template.original_filename}</p>
        <p className="text-[10px] text-slate-400 mt-0.5">
          {template.uploaded_by} · {formatDate(template.created_at)}
        </p>
      </div>
      {isActive ? (
        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 border shrink-0 text-[10px] font-black uppercase tracking-widest">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Aktif
        </Badge>
      ) : (
        <Badge variant="outline" className="text-slate-400 shrink-0 text-[10px] font-black uppercase tracking-widest">
          Tidak Aktif
        </Badge>
      )}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!isActive && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onActivate(template)}
            disabled={isActivating}
            className="h-8 px-2 text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            title="Aktifkan"
          >
            {isActivating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onDownload(template)}
          disabled={isDownloading}
          className="h-8 px-2 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100"
          title="Unduh"
        >
          {isDownloading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onDelete(template)}
          disabled={isDeleting}
          className="h-8 px-2 text-xs font-bold text-red-400 hover:text-red-600 hover:bg-red-50"
          title="Hapus"
        >
          {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
        </Button>
      </div>
    </div>
  )
}

// ── SK Type Section ────────────────────────────────────────────────────────

interface SkTypeSectionProps {
  skType: (typeof SK_TYPES)[number]
  templates: SkTemplate[]
  onActivate: (template: SkTemplate) => void
  onDownload: (template: SkTemplate) => void
  onDelete: (template: SkTemplate) => void
  activatingId: number | null
  downloadingId: number | null
  deletingId: number | null
  optimisticActiveIds: Record<string, number | null>
}

function SkTypeSection({
  skType,
  templates,
  onActivate,
  onDownload,
  onDelete,
  activatingId,
  downloadingId,
  deletingId,
  optimisticActiveIds,
}: SkTypeSectionProps) {
  const sectionTemplates = templates.filter((t) => t.sk_type === skType.value)
  const activeCount = sectionTemplates.filter((t) => t.is_active).length

  return (
    <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
      <CardHeader className="pb-2 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-700">
              {skType.label}
            </CardTitle>
            <CardDescription className="text-xs text-slate-400 mt-0.5">
              {skType.fullLabel}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {sectionTemplates.length} template
            </span>
            {activeCount > 0 && (
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 border text-[10px] font-black uppercase tracking-widest">
                1 aktif
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-2">
        {sectionTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-300">
            <FileText className="h-8 w-8 mb-2" />
            <p className="text-xs font-bold uppercase tracking-widest">Belum ada template</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {sectionTemplates.map((t) => (
              <TemplateRow
                key={t.id}
                template={t}
                optimisticActiveId={optimisticActiveIds[t.sk_type] ?? null}
                onActivate={onActivate}
                onDownload={onDownload}
                onDelete={onDelete}
                isActivating={activatingId === t.id}
                isDownloading={downloadingId === t.id}
                isDeleting={deletingId === t.id}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function SkTemplateManagementPage() {
  const queryClient = useQueryClient()
  const [deleteTarget, setDeleteTarget] = useState<SkTemplate | null>(null)
  const [activatingId, setActivatingId] = useState<number | null>(null)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  // Optimistic active state: sk_type → active template id (null = revert to server state)
  const [optimisticActiveIds, setOptimisticActiveIds] = useState<Record<string, number | null>>({})

  const { data: templates = [], isLoading } = useQuery<SkTemplate[]>({
    queryKey: ['sk-templates'],
    queryFn: () => skTemplateApi.list(),
  })

  // ── Activate ──

  const activateMutation = useMutation({
    mutationFn: (template: SkTemplate) => skTemplateApi.activate(template.id),
    onMutate: (template) => {
      setActivatingId(template.id)
      setOptimisticActiveIds((prev) => ({ ...prev, [template.sk_type]: template.id }))
    },
    onSuccess: (_data, template) => {
      toast.success(`Template "${template.original_filename}" diaktifkan`)
      queryClient.invalidateQueries({ queryKey: ['sk-templates'] })
      queryClient.invalidateQueries({ queryKey: ['sk-template-active', template.sk_type] })
    },
    onError: (err: any, template) => {
      // Revert optimistic update
      setOptimisticActiveIds((prev) => ({ ...prev, [template.sk_type]: null }))
      const msg = err.response?.data?.message || 'Gagal mengaktifkan template'
      toast.error(msg)
    },
    onSettled: () => setActivatingId(null),
  })

  // ── Download ──

  const downloadMutation = useMutation({
    mutationFn: (template: SkTemplate) => skTemplateApi.downloadUrl(template.id),
    onMutate: (template) => setDownloadingId(template.id),
    onSuccess: (data) => {
      const url = data?.url ?? data
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
      else toast.error('URL unduhan tidak tersedia')
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Gagal mendapatkan URL unduhan'
      toast.error(msg)
    },
    onSettled: () => setDownloadingId(null),
  })

  // ── Delete ──

  const deleteMutation = useMutation({
    mutationFn: (template: SkTemplate) => skTemplateApi.delete(template.id),
    onMutate: (template) => setDeletingId(template.id),
    onSuccess: (_data, template) => {
      toast.success(`Template "${template.original_filename}" dihapus`)
      queryClient.invalidateQueries({ queryKey: ['sk-templates'] })
      queryClient.invalidateQueries({ queryKey: ['sk-template-active', template.sk_type] })
      setDeleteTarget(null)
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Gagal menghapus template'
      toast.error(msg)
    },
    onSettled: () => setDeletingId(null),
  })

  const handleDeleteConfirm = () => {
    if (deleteTarget) deleteMutation.mutate(deleteTarget)
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20">
      <PageHeader
        title="Manajemen Template SK"
        description="Kelola template dokumen SK untuk setiap jenis surat keputusan"
        icon={<LayoutTemplate className="h-7 w-7 text-white" />}
        gradient="from-blue-600 via-blue-700 to-indigo-800"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload form — left column */}
        <div className="lg:col-span-1">
          <UploadForm
            onSuccess={() => queryClient.invalidateQueries({ queryKey: ['sk-templates'] })}
          />
        </div>

        {/* Template list — right columns */}
        <div className="lg:col-span-2 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span className="text-sm font-bold uppercase tracking-widest">Memuat template...</span>
            </div>
          ) : (
            SK_TYPES.map((skType) => (
              <SkTypeSection
                key={skType.value}
                skType={skType}
                templates={templates}
                onActivate={(t) => activateMutation.mutate(t)}
                onDownload={(t) => downloadMutation.mutate(t)}
                onDelete={(t) => setDeleteTarget(t)}
                activatingId={activatingId}
                downloadingId={downloadingId}
                deletingId={deletingId}
                optimisticActiveIds={optimisticActiveIds}
              />
            ))
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black text-slate-800">Hapus Template?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500">
              Template{' '}
              <span className="font-semibold text-slate-700">
                "{deleteTarget?.original_filename}"
              </span>{' '}
              akan dihapus secara permanen.
              {deleteTarget?.is_active && (
                <span className="block mt-2 text-amber-600 font-semibold">
                  ⚠️ Template ini sedang aktif. Status aktif akan dihapus.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl font-bold">Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
