import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SaveConfigPayload } from "../types/waBlast.types";

const configSchema = z.object({
  api_url: z.string().url("URL harus valid").max(500, "URL maksimal 500 karakter"),
  api_token: z.string().min(1, "API Token tidak boleh kosong"),
  sender_number: z
    .string()
    .regex(/^62[0-9]{9,13}$/, "Nomor harus format 62xxxxxxxxx (9-13 digit)"),
  device_id: z.string().optional(),
  max_recipients_per_session: z
    .number()
    .int()
    .min(1, "Minimal 1")
    .max(1000, "Maksimal 1000"),
  max_daily_messages: z
    .number()
    .int()
    .min(1, "Minimal 1")
    .max(5000, "Maksimal 5000"),
});

type ConfigFormData = z.infer<typeof configSchema>;

interface GoWaConfigFormProps {
  initialData?: SaveConfigPayload;
  onSubmit: (data: SaveConfigPayload) => Promise<void>;
  onTestConnection: () => Promise<{ success: boolean; message: string }>;
  loading?: boolean;
}

export function GoWaConfigForm({
  initialData,
  onSubmit,
  onTestConnection,
  loading = false,
}: GoWaConfigFormProps) {
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ConfigFormData>({
    resolver: zodResolver(configSchema),
    defaultValues: initialData
      ? {
          ...initialData,
          max_recipients_per_session: initialData.max_recipients_per_session || 500,
          max_daily_messages: initialData.max_daily_messages || 1000,
        }
      : {
          api_url: "",
          api_token: "",
          sender_number: "",
          max_recipients_per_session: 500,
          max_daily_messages: 1000,
        },
  });

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await onTestConnection();
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        message: "Gagal menghubungi Go-WA Gateway. Periksa konfigurasi Anda.",
      });
    } finally {
      setTesting(false);
    }
  };

  const onFormSubmit = async (data: ConfigFormData) => {
    await onSubmit(data);
    setTestResult(null);
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
      {/* API URL */}
      <div className="space-y-2">
        <Label htmlFor="api_url">URL Endpoint Go-WA</Label>
        <Input
          id="api_url"
          type="url"
          placeholder="https://go-wa.example.com"
          {...register("api_url")}
        />
        {errors.api_url && (
          <p className="text-sm text-red-600">{errors.api_url.message}</p>
        )}
      </div>

      {/* API Token */}
      <div className="space-y-2">
        <Label htmlFor="api_token">API Token</Label>
        <Input
          id="api_token"
          type="password"
          placeholder="Masukkan API Token"
          {...register("api_token")}
        />
        {errors.api_token && (
          <p className="text-sm text-red-600">{errors.api_token.message}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Token akan dienkripsi sebelum disimpan ke database.
        </p>
      </div>

      {/* Sender Number */}
      <div className="space-y-2">
        <Label htmlFor="sender_number">Nomor Pengirim</Label>
        <Input
          id="sender_number"
          type="text"
          placeholder="628123456789"
          {...register("sender_number")}
        />
        {errors.sender_number && (
          <p className="text-sm text-red-600">{errors.sender_number.message}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Format: 62xxxxxxxxx (tanpa tanda + atau spasi)
        </p>
      </div>

      {/* Device ID */}
      <div className="space-y-2">
        <Label htmlFor="device_id">Device ID (GoWA v8)</Label>
        <Input
          id="device_id"
          type="text"
          placeholder="Contoh: Maarif Cilacap"
          {...register("device_id")}
        />
        {errors.device_id && (
          <p className="text-sm text-red-600">{errors.device_id.message}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Nama device yang terdaftar di GoWA. Cek di{" "}
          <code className="bg-muted px-1 rounded">URL-GoWA/app/devices</code>.
          Kosongkan jika menggunakan GoWA versi lama.
        </p>
      </div>

      {/* Max Recipients Per Session */}
      <div className="space-y-2">
        <Label htmlFor="max_recipients_per_session">Maksimal Penerima per Sesi</Label>
        <Input
          id="max_recipients_per_session"
          type="number"
          min="1"
          max="1000"
          {...register("max_recipients_per_session", { valueAsNumber: true })}
        />
        {errors.max_recipients_per_session && (
          <p className="text-sm text-red-600">{errors.max_recipients_per_session.message}</p>
        )}
      </div>

      {/* Max Daily Messages */}
      <div className="space-y-2">
        <Label htmlFor="max_daily_messages">Maksimal Pesan per Hari</Label>
        <Input
          id="max_daily_messages"
          type="number"
          min="1"
          max="5000"
          {...register("max_daily_messages", { valueAsNumber: true })}
        />
        {errors.max_daily_messages && (
          <p className="text-sm text-red-600">{errors.max_daily_messages.message}</p>
        )}
      </div>

      {/* Test Connection Result */}
      {testResult && (
        <div
          className={`p-4 rounded-lg border ${
            testResult.success
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {testResult.success ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <XCircle className="h-5 w-5" />
            )}
            <span className="font-medium">{testResult.message}</span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Simpan Konfigurasi
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleTestConnection}
          disabled={testing}
        >
          {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Test Koneksi
        </Button>
      </div>
    </form>
  );
}
