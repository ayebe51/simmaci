import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Shield, QrCode, UserCheck, GraduationCap, Save, RefreshCw, Copy, Eye, EyeOff, MessageSquare } from "lucide-react";

export default function AttendanceSettingsPage() {
  const userStr = localStorage.getItem("user");
  const user = userStr ? JSON.parse(userStr) : null;
  const schoolId = user?.schoolId as Id<"schools"> | undefined;
  const settings = useQuery(api.attendanceSettings.get, schoolId ? { schoolId } : "skip");
  const saveMutation = useMutation(api.attendanceSettings.save);
  const regeneratePinMutation = useMutation(api.attendanceSettings.regeneratePin);

  const [absensiGuruAktif, setAbsensiGuruAktif] = useState(false);
  const [absensiSiswaAktif, setAbsensiSiswaAktif] = useState(false);
  const [qrScanAktif, setQrScanAktif] = useState(false);
  const [gowaUrl, setGowaUrl] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Load settings when data arrives
  if (settings && !loaded) {
    setAbsensiGuruAktif(settings.absensiGuruAktif);
    setAbsensiSiswaAktif(settings.absensiSiswaAktif);
    setQrScanAktif(settings.qrScanAktif);
    setGowaUrl(settings.gowaUrl || "");
    setLoaded(true);
  }

  const handleSave = async () => {
    if (!schoolId) {
      toast.error("School ID tidak ditemukan");
      return;
    }
    try {
      const result = await saveMutation({
        schoolId,
        absensiGuruAktif,
        absensiSiswaAktif,
        scannerPin: settings?.scannerPin || undefined,
        qrScanAktif,
        gowaUrl,
      });
      if (result.pin && !settings?.scannerPin) {
        toast.success(`Pengaturan disimpan! PIN baru: ${result.pin}`);
      } else {
        toast.success("Pengaturan absensi berhasil disimpan!");
      }
    } catch (err) {
      toast.error("Gagal menyimpan pengaturan");
    }
  };

  const handleRegenerate = async () => {
    if (!schoolId) return;
    setRegenerating(true);
    try {
      const result = await regeneratePinMutation({ schoolId });
      toast.success(`PIN baru: ${result.pin}`);
      setShowPin(true);
    } catch (err) {
      toast.error("Gagal generate PIN baru");
    }
    setRegenerating(false);
  };

  const handleCopyPin = () => {
    if (settings?.scannerPin) {
      navigator.clipboard.writeText(settings.scannerPin);
      toast.success("PIN berhasil disalin!");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Pengaturan Absensi</h1>
        <p className="text-slate-500 text-sm mt-1">Kelola fitur absensi untuk sekolah Anda</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-emerald-200/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-emerald-600" />
              Absensi Guru
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Label htmlFor="guru-toggle" className="text-sm text-slate-600">Aktifkan absensi guru</Label>
              <Switch id="guru-toggle" checked={absensiGuruAktif} onCheckedChange={setAbsensiGuruAktif} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-blue-600" />
              Absensi Siswa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Label htmlFor="siswa-toggle" className="text-sm text-slate-600">Aktifkan absensi siswa</Label>
              <Switch id="siswa-toggle" checked={absensiSiswaAktif} onCheckedChange={setAbsensiSiswaAktif} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-200/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <QrCode className="h-4 w-4 text-purple-600" />
              QR Scan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Label htmlFor="qr-toggle" className="text-sm text-slate-600">Aktifkan QR Scanner</Label>
              <Switch id="qr-toggle" checked={qrScanAktif} onCheckedChange={setQrScanAktif} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-amber-600" />
              PIN Scanner
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-slate-500">
              PIN ini digunakan guru untuk masuk ke halaman scanner absensi. PIN di-generate otomatis dan unik per sekolah.
            </p>

            {settings?.scannerPin ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 font-mono text-2xl tracking-[0.3em] text-center font-bold text-slate-800">
                    {showPin ? settings.scannerPin : "••••••"}
                  </div>
                  <Button variant="outline" size="icon" onClick={() => setShowPin(!showPin)} title={showPin ? "Sembunyikan" : "Tampilkan"}>
                    {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button variant="outline" size="icon" onClick={handleCopyPin} title="Salin PIN">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerate}
                  disabled={regenerating}
                  className="w-full text-amber-700 border-amber-200 hover:bg-amber-50"
                >
                  <RefreshCw className={`mr-2 h-3.5 w-3.5 ${regenerating ? "animate-spin" : ""}`} />
                  {regenerating ? "Generating..." : "Generate PIN Baru"}
                </Button>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                <p className="text-sm text-amber-700 font-medium">PIN belum dibuat</p>
                <p className="text-xs text-amber-600 mt-1">Klik "Simpan Pengaturan" untuk auto-generate PIN</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-green-200/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-green-600" />
              Notifikasi WhatsApp (GoWA)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-slate-500">
              URL server GoWA (diisi dengan link Cloudflare Tunnel). Kosongkan jika tidak mau kirim notif WA.
            </p>
            <Input
              placeholder="https://gowa.contoh.com"
              value={gowaUrl}
              onChange={(e) => setGowaUrl(e.target.value)}
              className="font-mono text-sm"
            />
          </CardContent>
        </Card>
      </div>

      <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700">
        <Save className="mr-2 h-4 w-4" />
        Simpan Pengaturan
      </Button>
    </div>
  );
}
