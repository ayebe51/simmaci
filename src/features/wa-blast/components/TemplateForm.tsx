import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CreateTemplatePayload, UpdateTemplatePayload } from "../types/waBlast.types";

const templateSchema = z.object({
  name: z
    .string()
    .min(1, "Nama template tidak boleh kosong")
    .max(255, "Nama template maksimal 255 karakter"),
  body: z
    .string()
    .min(1, "Isi template tidak boleh kosong")
    .max(4096, "Isi template maksimal 4.096 karakter"),
});

type TemplateFormData = z.infer<typeof templateSchema>;

interface TemplateFormProps {
  initialData?: UpdateTemplatePayload;
  onSubmit: (data: CreateTemplatePayload | UpdateTemplatePayload) => Promise<void>;
  onCancel?: () => void;
  loading?: boolean;
  mode?: "create" | "edit";
}

export function TemplateForm({
  initialData,
  onSubmit,
  onCancel,
  loading = false,
  mode = "create",
}: TemplateFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: initialData || {
      name: "",
      body: "",
    },
  });

  const bodyValue = watch("body");
  const remainingChars = 4096 - (bodyValue?.length || 0);
  const isOverLimit = remainingChars < 0;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Template Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Nama Template</Label>
        <Input
          id="name"
          type="text"
          placeholder="Contoh: Undangan Rapat Koordinasi"
          {...register("name")}
        />
        {errors.name && (
          <p className="text-sm text-red-600">{errors.name.message}</p>
        )}
      </div>

      {/* Template Body */}
      <div className="space-y-2">
        <Label htmlFor="body">Isi Template</Label>
        <Textarea
          id="body"
          placeholder="Tulis isi template di sini... Gunakan {{nama}} dan {{nama_sekolah}} untuk variabel dinamis."
          className="min-h-[200px] font-mono text-sm"
          {...register("body")}
        />
        {errors.body && (
          <p className="text-sm text-red-600">{errors.body.message}</p>
        )}
        <div className="flex items-center justify-between text-sm">
          <div className="text-muted-foreground">
            {bodyValue?.length || 0} / 4.096 karakter
          </div>
          {isOverLimit && (
            <span className="text-red-600 font-semibold">Melebihi batas!</span>
          )}
        </div>
      </div>

      {/* Available Variables Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-900">
            <div className="font-semibold mb-1">Variabel yang Tersedia:</div>
            <ul className="space-y-1">
              <li>
                <code className="bg-blue-100 px-1.5 py-0.5 rounded">{"{{nama}}"}</code> - Akan
                diganti dengan nama penerima
              </li>
              <li>
                <code className="bg-blue-100 px-1.5 py-0.5 rounded">{"{{nama_sekolah}}"}</code> -
                Akan diganti dengan nama sekolah penerima
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Batal
          </Button>
        )}
        <Button type="submit" disabled={loading || isOverLimit}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === "create" ? "Buat Template" : "Simpan Perubahan"}
        </Button>
      </div>
    </form>
  );
}
