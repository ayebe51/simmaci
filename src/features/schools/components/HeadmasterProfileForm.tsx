import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation } from "@tanstack/react-query"
import { schoolApi, School } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { toast } from "sonner"
import { Save, X, Loader2, User, Phone, Calendar } from "lucide-react"

// Zod schema for headmaster profile validation
const headmasterProfileSchema = z.object({
  kepala_madrasah: z.string().max(255, "Nama maksimal 255 karakter").optional().nullable(),
  kepala_nim: z.string().max(50, "NIM maksimal 50 karakter").optional().nullable(),
  kepala_nuptk: z.string().max(50, "NUPTK maksimal 50 karakter").optional().nullable(),
  kepala_whatsapp: z.string().max(20, "WhatsApp maksimal 20 karakter").optional().nullable(),
  kepala_jabatan_mulai: z.string().optional().nullable(),
  kepala_jabatan_selesai: z.string().optional().nullable(),
}).refine(
  (data) => {
    // Validate end date is after or equal to start date
    if (data.kepala_jabatan_mulai && data.kepala_jabatan_selesai) {
      const startDate = new Date(data.kepala_jabatan_mulai)
      const endDate = new Date(data.kepala_jabatan_selesai)
      return endDate >= startDate
    }
    return true
  },
  {
    message: "Tanggal selesai jabatan harus setelah atau sama dengan tanggal mulai jabatan",
    path: ["kepala_jabatan_selesai"],
  }
)

type HeadmasterProfileFormData = z.infer<typeof headmasterProfileSchema>

interface HeadmasterProfileFormProps {
  school: School & {
    kepala_madrasah?: string | null
    kepala_nim?: string | null
    kepala_nuptk?: string | null
    kepala_whatsapp?: string | null
    kepala_jabatan_mulai?: string | null
    kepala_jabatan_selesai?: string | null
  }
  onSuccess: () => void
  onCancel: () => void
  isAdminMode?: boolean
}

export default function HeadmasterProfileForm({
  school,
  onSuccess,
  onCancel,
  isAdminMode = false,
}: HeadmasterProfileFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<HeadmasterProfileFormData>({
    resolver: zodResolver(headmasterProfileSchema),
    defaultValues: {
      kepala_madrasah: school.kepala_madrasah || "",
      kepala_nim: school.kepala_nim || "",
      kepala_nuptk: school.kepala_nuptk || "",
      kepala_whatsapp: school.kepala_whatsapp || "",
      kepala_jabatan_mulai: school.kepala_jabatan_mulai || "",
      kepala_jabatan_selesai: school.kepala_jabatan_selesai || "",
    },
  })

  // Reset form when school data changes
  useEffect(() => {
    reset({
      kepala_madrasah: school.kepala_madrasah || "",
      kepala_nim: school.kepala_nim || "",
      kepala_nuptk: school.kepala_nuptk || "",
      kepala_whatsapp: school.kepala_whatsapp || "",
      kepala_jabatan_mulai: school.kepala_jabatan_mulai || "",
      kepala_jabatan_selesai: school.kepala_jabatan_selesai || "",
    })
  }, [school, reset])

  const updateMutation = useMutation({
    mutationFn: (data: HeadmasterProfileFormData) => {
      return schoolApi.update(school.id, data)
    },
    onSuccess: (updated) => {
      toast.success("Profil kepala madrasah berhasil diperbarui!")
      
      // Update form with fresh data from server
      if (updated) {
        reset({
          kepala_madrasah: updated.kepala_madrasah || "",
          kepala_nim: updated.kepala_nim || "",
          kepala_nuptk: updated.kepala_nuptk || "",
          kepala_whatsapp: updated.kepala_whatsapp || "",
          kepala_jabatan_mulai: updated.kepala_jabatan_mulai || "",
          kepala_jabatan_selesai: updated.kepala_jabatan_selesai || "",
        })
      }
      
      onSuccess()
    },
    onError: (err: any) => {
      // Handle different error types
      if (err.response?.status === 403) {
        toast.error("Anda tidak memiliki akses untuk mengubah data sekolah ini")
      } else if (err.response?.status === 422) {
        // Validation errors from backend
        const backendErrors = err.response?.data?.errors
        if (backendErrors) {
          Object.entries(backendErrors).forEach(([field, messages]) => {
            if (Array.isArray(messages) && messages.length > 0) {
              toast.error(`${field}: ${messages[0]}`)
            }
          })
        } else {
          toast.error("Validasi gagal: " + (err.response?.data?.message || "Data tidak valid"))
        }
      } else {
        toast.error("Gagal memperbarui profil: " + (err.response?.data?.message || err.message))
      }
    },
  })

  const onSubmit = (data: HeadmasterProfileFormData) => {
    updateMutation.mutate(data)
  }

  const isSubmitting = updateMutation.isPending

  return (
    <Card className="border-0 shadow-sm bg-white rounded-[2.5rem] overflow-hidden border-l-4 border-l-blue-600">
      <CardHeader className="p-10 border-b bg-blue-50/30">
        <CardTitle className="text-lg font-black text-blue-900 uppercase tracking-tight flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
            <User className="h-5 w-5" />
          </div>
          Profil Kepala Madrasah
        </CardTitle>
        <CardDescription className="text-xs font-medium text-blue-600/60">
          {isAdminMode
            ? `Kelola informasi kepala madrasah untuk ${school.nama}`
            : "Informasi personal dan masa bakti pimpinan lembaga."}
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="p-10 space-y-8">
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {/* Nama Lengkap */}
            <div className="space-y-2 lg:col-span-1">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                Nama Lengkap (Tanpa Gelar)
              </Label>
              <Input
                {...register("kepala_madrasah")}
                placeholder="Nama Lengkap"
                className="h-12 rounded-xl border-slate-200 font-bold"
                disabled={isSubmitting}
              />
              {errors.kepala_madrasah && (
                <p className="text-sm text-red-600 mt-1">{errors.kepala_madrasah.message}</p>
              )}
            </div>

            {/* NIM */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                NIM (Nomor Induk Ma'arif)
              </Label>
              <Input
                {...register("kepala_nim")}
                placeholder="No Induk"
                className="h-12 rounded-xl border-slate-200 font-bold"
                disabled={isSubmitting}
              />
              {errors.kepala_nim && (
                <p className="text-sm text-red-600 mt-1">{errors.kepala_nim.message}</p>
              )}
            </div>

            {/* NUPTK */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                NUPTK
              </Label>
              <Input
                {...register("kepala_nuptk")}
                placeholder="NUPTK"
                className="h-12 rounded-xl border-slate-200 font-bold"
                disabled={isSubmitting}
              />
              {errors.kepala_nuptk && (
                <p className="text-sm text-red-600 mt-1">{errors.kepala_nuptk.message}</p>
              )}
            </div>

            {/* WhatsApp */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                <Phone className="h-3 w-3" /> WhatsApp Kepala
              </Label>
              <Input
                {...register("kepala_whatsapp")}
                placeholder="08..."
                className="h-12 rounded-xl border-slate-200 font-bold"
                disabled={isSubmitting}
              />
              {errors.kepala_whatsapp && (
                <p className="text-sm text-red-600 mt-1">{errors.kepala_whatsapp.message}</p>
              )}
            </div>

            {/* Jabatan Mulai */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                <Calendar className="h-3 w-3" /> Jabatan Mulai
              </Label>
              <Input
                type="date"
                {...register("kepala_jabatan_mulai")}
                className="h-12 rounded-xl border-slate-200 font-bold"
                disabled={isSubmitting}
              />
              {errors.kepala_jabatan_mulai && (
                <p className="text-sm text-red-600 mt-1">{errors.kepala_jabatan_mulai.message}</p>
              )}
            </div>

            {/* Jabatan Selesai */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                <Calendar className="h-3 w-3" /> Jabatan Selesai
              </Label>
              <Input
                type="date"
                {...register("kepala_jabatan_selesai")}
                className="h-12 rounded-xl border-slate-200 font-bold"
                disabled={isSubmitting}
              />
              {errors.kepala_jabatan_selesai && (
                <p className="text-sm text-red-600 mt-1">{errors.kepala_jabatan_selesai.message}</p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-4 pt-6 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={onCancel}
              disabled={isSubmitting}
              className="h-14 px-8 rounded-2xl font-black uppercase text-xs tracking-widest"
            >
              <X className="mr-2 h-4 w-4" />
              Batal
            </Button>
            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting}
              className="h-14 px-12 rounded-2xl bg-slate-900 hover:bg-black text-white font-black uppercase text-xs tracking-widest shadow-2xl shadow-slate-200"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-5 w-5" />
                  Simpan Perubahan
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </form>
    </Card>
  )
}
