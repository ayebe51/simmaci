import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Shield, QrCode, UserCheck, GraduationCap, Save, RefreshCw, Copy, Eye, EyeOff, MessageSquare, Activity, Loader2, MapPin, Navigation, KeyRound, ExternalLink } from "lucide-react";
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

  const [formState, setFormState] = useState<{
    absensi_guru_aktif: boolean;
    absensi_siswa_aktif: boolean;
    qr_scan_aktif: boolean;
    gowa_url: string;
    gowa_device_id: string;
    geolocation_enabled: boolean;
    school_latitude: number | null;
    school_longitude: number | null;
    geofence_radius_meters: number;
    scanner_pin?: string;
  }>({
    absensi_guru_aktif: false,
    absensi_siswa_aktif: false,
    qr_scan_aktif: false,
    gowa_url: "",
    gowa_device_id: "",
    geolocation_enabled: false,
    school_latitude: null,
    school_longitude: null,
    geofence_radius_meters: 100,
  });

  const [showPin, setShowPin] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [waStatus, setWaStatus] = useState<"idle" | "checking" | "online" | "offline">("idle");

  useEffect(() => {
    if (settings) {
      setFormState({
        absensi_guru_aktif: !!settings.absensi_guru_aktif,
        absensi_siswa_aktif: !!settings.absensi_siswa_aktif,
        qr_scan_aktif: !!settings.qr_scan_aktif,
        gowa_url: settings.gowa_url || "",
        gowa_device_id: settings.gowa_device_id || "",
        geolocation_enabled: !!settings.geolocation_enabled,
        school_latitude: settings.school_latitude || null,
        school_longitude: settings.school_longitude || null,
        geofence_radius_meters: settings.geofence_radius_meters || 100,
      });
    }
  }, [settings]);

  const handleSave = () => {
    const payload: any = { ...formState };
    // Jangan kirim scanner_pin jika input kosong (agar PIN lama tidak tertimpa)
    if (!pinInput) {
      delete payload.scanner_pin;
    }
    saveMutation.mutate(payload);
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

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation tidak didukung oleh browser Anda");
      return;
    }

    toast.info("Mengambil lokasi Anda...");
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormState({
          ...formState,
          school_latitude: position.coords.latitude,
          school_longitude: position.coords.longitude,
        });
        toast.success("Koordinat berhasil diambil dari lokasi Anda!");
      },
      (error) => {
        let errorMessage = "Gagal mendapatkan lokasi";
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Izin akses lokasi ditolak. Aktifkan GPS dan izinkan akses lokasi.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Informasi lokasi tidak tersedia";
            break;
          case error.TIMEOUT:
            errorMessage = "Timeout mendapatkan lokasi";
            break;
        }
        
        toast.error(errorMessage);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
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
            <CardTitle className="text-base flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-amber-600" />
                PIN Scanner Device
              </div>
              <a
                href="/scan"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 hover:text-blue-700"
              >
                <ExternalLink className="h-3 w-3" />
                Buka Halaman Scanner
              </a>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <p className="text-[10px] text-slate-400 leading-relaxed font-medium">
              PIN ini digunakan untuk login ke mode scanner di tablet/smartphone sekolah. Rahasiakan PIN ini.
            </p>

            {/* PIN saat ini */}
            {settings?.scanner_pin ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-mono text-xl tracking-[0.3em] text-center font-bold text-slate-700">
                  {showPin ? settings.scanner_pin : "••••••"}
                </div>
                <Button variant="outline" size="icon" className="h-12 w-12 rounded-xl" onClick={() => setShowPin(!showPin)}>
                  {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button variant="outline" size="icon" className="h-12 w-12 rounded-xl" onClick={handleCopyPin}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <p className="text-xs text-amber-600 font-medium bg-amber-50 rounded-lg px-3 py-2">
                PIN belum diatur. Masukkan PIN di bawah lalu simpan.
              </p>
            )}

            {/* Set PIN baru */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <KeyRound className="h-3 w-3" />
                {settings?.scanner_pin ? "Ganti PIN" : "Set PIN Baru"}
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={8}
                  placeholder="Contoh: 123456"
                  value={pinInput}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    setPinInput(val);
                    setFormState((prev: any) => ({ ...prev, scanner_pin: val || undefined }));
                  }}
                  className="font-mono text-sm rounded-xl h-11 tracking-widest"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 px-3 rounded-xl whitespace-nowrap"
                  onClick={() => {
                    const pin = Math.floor(100000 + Math.random() * 900000).toString();
                    setPinInput(pin);
                    setFormState((prev: any) => ({ ...prev, scanner_pin: pin }));
                  }}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Generate
                </Button>
              </div>
              <p className="text-[10px] text-slate-400">Kosongkan jika tidak ingin mengubah PIN yang ada.</p>
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

        <Card className="border-0 shadow-sm rounded-xl overflow-hidden md:col-span-2">
          <CardHeader className="pb-3 bg-slate-50/50">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4 text-red-600" />
              Geolocation & Geofencing
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-sm text-slate-600">Aktifkan tracking lokasi GPS</Label>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Rekam koordinat GPS setiap kali absensi dilakukan untuk validasi lokasi
                </p>
              </div>
              <Switch 
                checked={formState.geolocation_enabled} 
                onCheckedChange={(v) => setFormState({...formState, geolocation_enabled: v})} 
              />
            </div>
            
            {formState.geolocation_enabled && (
              <>
                <div className="border-t pt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Koordinat Sekolah</Label>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleUseCurrentLocation}
                      className="h-8 text-xs rounded-lg"
                    >
                      <Navigation className="h-3 w-3 mr-1.5" />
                      Gunakan Lokasi Saat Ini
                    </Button>
                  </div>
                  
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Latitude</Label>
                      <Input
                        type="number"
                        step="0.000001"
                        placeholder="-7.123456"
                        value={formState.school_latitude || ''}
                        onChange={(e) => setFormState({...formState, school_latitude: e.target.value ? parseFloat(e.target.value) : null})}
                        className="font-mono text-sm rounded-xl h-11"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Longitude</Label>
                      <Input
                        type="number"
                        step="0.000001"
                        placeholder="109.123456"
                        value={formState.school_longitude || ''}
                        onChange={(e) => setFormState({...formState, school_longitude: e.target.value ? parseFloat(e.target.value) : null})}
                        className="font-mono text-sm rounded-xl h-11"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-2">
                  <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Radius Geofencing (meter)</Label>
                  <div className="flex items-center gap-4">
                    <Input
                      type="number"
                      min="10"
                      max="1000"
                      step="10"
                      value={formState.geofence_radius_meters}
                      onChange={(e) => setFormState({...formState, geofence_radius_meters: parseInt(e.target.value) || 100})}
                      className="font-mono text-sm rounded-xl h-11 w-32"
                    />
                    <p className="text-xs text-slate-500 flex-1">
                      Absensi hanya diterima jika user berada dalam radius <strong>{formState.geofence_radius_meters}m</strong> dari koordinat sekolah
                    </p>
                  </div>
                </div>
              </>
            )}
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
