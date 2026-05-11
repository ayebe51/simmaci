/**
 * WA Blast Configuration Page
 * Feature: wa-blast
 * 
 * Halaman konfigurasi Go-WA Gateway yang hanya dapat diakses oleh super_admin.
 * Menampilkan form untuk mengatur URL, API Token (terenkripsi), nomor pengirim,
 * dan batas pengiriman (per sesi dan harian).
 */

import { AlertCircle, Settings } from "lucide-react";
import { toast } from "sonner";
import { GoWaConfigForm } from "../components/GoWaConfigForm";
import { useWaBlastConfig, useSaveConfig, useTestConnection } from "../hooks/useWaBlastConfig";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SaveConfigPayload } from "../types/waBlast.types";

export function WaBlastConfigPage() {
  const { data: config, isLoading, error } = useWaBlastConfig();
  const saveConfigMutation = useSaveConfig();
  const testConnectionMutation = useTestConnection();

  const handleSubmit = async (data: SaveConfigPayload) => {
    try {
      await saveConfigMutation.mutateAsync(data);
      toast.success("Konfigurasi berhasil disimpan");
    } catch (error) {
      toast.error("Gagal menyimpan konfigurasi");
      throw error;
    }
  };

  const handleTestConnection = async () => {
    try {
      const result = await testConnectionMutation.mutateAsync();
      return result;
    } catch (error) {
      return {
        success: false,
        message: "Gagal menghubungi Go-WA Gateway. Periksa konfigurasi Anda.",
      };
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Memuat konfigurasi...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Settings className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Konfigurasi Go-WA Gateway</h1>
          <p className="text-muted-foreground">
            Atur kredensial dan batas pengiriman untuk integrasi WhatsApp Gateway
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Gagal memuat konfigurasi</AlertTitle>
          <AlertDescription>
            Terjadi kesalahan saat memuat konfigurasi. Silakan coba lagi.
          </AlertDescription>
        </Alert>
      )}

      {/* Info Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Informasi Penting</AlertTitle>
        <AlertDescription>
          Konfigurasi ini bersifat global dan akan digunakan untuk semua pengiriman WA Blast.
          API Token akan dienkripsi sebelum disimpan ke database. Pastikan kredensial yang
          Anda masukkan sudah benar sebelum menyimpan.
        </AlertDescription>
      </Alert>

      {/* Configuration Form */}
      <Card>
        <CardHeader>
          <CardTitle>Pengaturan Gateway</CardTitle>
          <CardDescription>
            Masukkan kredensial Go-WA Gateway dan atur batas pengiriman untuk mencegah
            pemblokiran nomor WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GoWaConfigForm
            initialData={
              config
                ? {
                    api_url: config.api_url,
                    api_token: config.api_token_encrypted === "***" ? "" : config.api_token_encrypted,
                    sender_number: config.sender_number,
                    device_id: config.device_id ?? "",
                    max_recipients_per_session: config.max_recipients_per_session,
                    max_daily_messages: config.max_daily_messages,
                  }
                : undefined
            }
            onSubmit={handleSubmit}
            onTestConnection={handleTestConnection}
            loading={saveConfigMutation.isPending}
          />
        </CardContent>
      </Card>

      {/* Additional Info */}
      <Card>
        <CardHeader>
          <CardTitle>Panduan Konfigurasi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">URL Endpoint Go-WA</h3>
            <p className="text-sm text-muted-foreground">
              URL lengkap endpoint API Go-WA Gateway Anda. Contoh: https://go-wa.example.com
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">API Token</h3>
            <p className="text-sm text-muted-foreground">
              Token autentikasi yang diberikan oleh penyedia layanan Go-WA. Token akan
              dienkripsi menggunakan AES-256-CBC sebelum disimpan ke database.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Nomor Pengirim</h3>
            <p className="text-sm text-muted-foreground">
              Nomor WhatsApp yang terdaftar di Go-WA Gateway dalam format internasional
              Indonesia (62xxxxxxxxx). Nomor ini akan digunakan sebagai pengirim untuk
              semua pesan blast.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Batas Pengiriman</h3>
            <p className="text-sm text-muted-foreground">
              Atur batas maksimal penerima per sesi (default: 500) dan batas harian
              (default: 1000) untuk menghindari risiko pemblokiran nomor WhatsApp oleh
              WhatsApp. Sesuaikan dengan kebijakan penyedia layanan Go-WA Anda.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
