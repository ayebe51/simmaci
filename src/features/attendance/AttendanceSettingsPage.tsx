import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Settings, Shield, QrCode, UserCheck, GraduationCap, Save } from "lucide-react";


export default function AttendanceSettingsPage() {
  const userStr = localStorage.getItem('user');
const user = userStr ? JSON.parse(userStr) : null;
  const schoolId = user?.schoolId as Id<"schools"> | undefined;
  const settings = useQuery(api.attendanceSettings.get, schoolId ? { schoolId } : "skip");
  const saveMutation = useMutation(api.attendanceSettings.save);

  const [absensiGuruAktif, setAbsensiGuruAktif] = useState(false);
  const [absensiSiswaAktif, setAbsensiSiswaAktif] = useState(false);
  const [qrScanAktif, setQrScanAktif] = useState(false);
  const [scannerPin, setScannerPin] = useState("");
  const [loaded, setLoaded] = useState(false);

  // Load settings when data arrives
  if (settings && !loaded) {
    setAbsensiGuruAktif(settings.absensiGuruAktif);
    setAbsensiSiswaAktif(settings.absensiSiswaAktif);
    setQrScanAktif(settings.qrScanAktif);
    setScannerPin(settings.scannerPin || "");
    setLoaded(true);
  }

  const handleSave = async () => {
    if (!schoolId) {
      toast.error("School ID tidak ditemukan");
      return;
    }
    try {
      await saveMutation({
        schoolId,
        absensiGuruAktif,
        absensiSiswaAktif,
        scannerPin: scannerPin || undefined,
        qrScanAktif,
      });
      toast.success("Pengaturan absensi berhasil disimpan!");
    } catch (err) {
      toast.error("Gagal menyimpan pengaturan");
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
          <CardContent className="space-y-2">
            <p className="text-xs text-slate-500">PIN ini digunakan guru untuk mengakses halaman scanner</p>
            <Input
              type="text"
              value={scannerPin}
              onChange={(e) => setScannerPin(e.target.value)}
              placeholder="Masukkan PIN (misal: 1234)"
              className="font-mono tracking-wider"
              maxLength={6}
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
