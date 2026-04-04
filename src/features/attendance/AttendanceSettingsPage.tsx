import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Shield, QrCode, UserCheck, GraduationCap, Save, RefreshCw, Copy, Eye, EyeOff, MessageSquare, Activity, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { attendanceApi } from "@/lib/api";

export default function AttendanceSettingsPage() {
  const queryClient = useQueryClient();
  
  // 🔥 REST API QUERIES
  const { data: settings, isLoading } = useQuery({ 
      queryKey: ['attendance-settings'], 
      queryFn: attendanceApi.settingsShow 
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => attendanceApi.settingsUpdate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-settings'] });
      toast.success("Pengaturan absensi berhasil disimpan!");
    }
  });

  const [formState, setFormState] = useState({
    absensi_guru_aktif: false,
    absensi_siswa_aktif: false,
    qr_scan_aktif: false,
    gowa_url: "",
    gowa_device_id: "",
  });

  const [showPin, setShowPin] = useState(false);
  const [waStatus, setWaStatus] = useState<"idle" | "checking" | "online" | "offline">("idle");

  useEffect(() => {
    if (settings) {
      setFormState({
        absensi_guru_aktif: !!settings.absensi_guru_aktif,
        absensi_siswa_aktif: !!settings.absensi_siswa_aktif,
        qr_scan_aktif: !!settings.qr_scan_aktif,
        gowa_url: settings.gowa_url || "",
        gowa_device_id: settings.gowa_device_id || "",
      });
    }
  }, [settings]);

  const handleSave = () => {
    saveMutation.mutate(formState);
  };

  const handleCopyPin = () => {
    if (settings?.scanner_pin) {
      navigator.clipboard.writeText(settings.scanner_pin);
      toast.success("PIN berhasil disalin!");
    }
  };

  const checkConnection = async () => {
    if (!formState.gowa_url) {
      toast.error("Masukkan URL GoWA terlebih dahulu");
      return;
    }
    setWaStatus("checking");
    try {
      const res = await attendanceApi.checkWaConnection();
      if (res.status === 'online') {
          setWaStatus("online");
          toast.success("Koneksi Server WA Berhasil! 🟢");
      } else {
          setWaStatus("offline");
          toast.error("Server WA Offline: " + (res.message || "Unknown error"));
      }
    } catch (e: any) {
        setWaStatus("offline");
        toast.error("Gagal cek koneksi: " + e.message);
    }
  };

  if (isLoading) return <div className="h-96 flex items-center justify-center"><Loader2 className="animate-spin text-emerald-500" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Pengaturan Absensi</h1>
        <p className="text-slate-500 text-sm mt-1">Kelola fitur absensi untuk sekolah Anda</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="pb-3 bg-slate-50/50">
            <CardTitle className="text-base flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-emerald-600" />
              Absensi Guru
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-slate-600">Aktifkan modul absensi guru</Label>
              <Switch 
                checked={formState.absensi_guru_aktif} 
                onCheckedChange={(v) => setFormState({...formState, absensi_guru_aktif: v})} 
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="pb-3 bg-slate-50/50">
            <CardTitle className="text-base flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-blue-600" />
              Absensi Siswa
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-slate-600">Aktifkan modul absensi siswa</Label>
              <Switch 
                checked={formState.absensi_siswa_aktif} 
                onCheckedChange={(v) => setFormState({...formState, absensi_siswa_aktif: v})} 
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="pb-3 bg-slate-50/50">
            <CardTitle className="text-base flex items-center gap-2">
              <QrCode className="h-4 w-4 text-purple-600" />
              QR Scan & Real-time
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-slate-600">Aktifkan fitur scan kartu (KTA)</Label>
              <Switch 
                checked={formState.qr_scan_aktif} 
                onCheckedChange={(v) => setFormState({...formState, qr_scan_aktif: v})} 
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="pb-3 bg-slate-50/50">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-amber-600" />
              PIN Scanner Device
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <p className="text-[10px] text-slate-400 leading-relaxed font-medium">
              PIN ini digunakan untuk login ke mode scanner di tablet/smartphone sekolah. Rahasiakan PIN ini.
            </p>

            <div className="flex items-center gap-2">
              <div className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-mono text-xl tracking-[0.3em] text-center font-bold text-slate-700">
                {showPin ? settings?.scanner_pin : "••••••"}
              </div>
              <Button variant="outline" size="icon" className="h-12 w-12 rounded-xl" onClick={() => setShowPin(!showPin)}>
                {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button variant="outline" size="icon" className="h-12 w-12 rounded-xl" onClick={handleCopyPin}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm rounded-xl overflow-hidden md:col-span-2">
          <CardHeader className="pb-3 bg-slate-50/50">
            <CardTitle className="text-base flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-green-600" />
                Integrasi Gateway WhatsApp (GoWA)
              </div>
              <Badge variant={waStatus === "online" ? "default" : "outline"} className={waStatus === "online" ? "bg-green-500" : ""}>
                {waStatus.toUpperCase()}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">URL Server Gateway</Label>
                <button 
                  onClick={checkConnection}
                  disabled={waStatus === "checking"}
                  className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 uppercase"
                >
                  {waStatus === "checking" ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Activity className="h-3 w-3" />}
                  Cek Koneksi
                </button>
              </div>
              <Input
                placeholder="https://wa.maarif-cilacap.or.id"
                value={formState.gowa_url}
                onChange={(e) => setFormState({...formState, gowa_url: e.target.value})}
                className="font-mono text-sm rounded-xl h-11"
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Instance / Device ID</Label>
              <Input
                placeholder="unit_01"
                value={formState.gowa_device_id}
                onChange={(e) => setFormState({...formState, gowa_device_id: e.target.value})}
                className="font-mono text-sm rounded-xl h-11"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end pt-4">
        <Button onClick={handleSave} size="lg" className="bg-emerald-600 hover:bg-emerald-700 h-12 px-8 rounded-xl" disabled={saveMutation.isPending}>
          {saveMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Save className="mr-2 h-5 w-5" />}
          Simpan Semua Pengaturan
        </Button>
      </div>
    </div>
  );
}
