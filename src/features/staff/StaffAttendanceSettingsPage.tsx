import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { MapPin, Navigation, Save, Loader2, Camera, Clock } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { settingApi } from "@/lib/api";

export default function StaffAttendanceSettingsPage() {
  const queryClient = useQueryClient();

  // Fetch all global settings
  const { data: allSettings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: settingApi.list,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      // settingApi.update takes {key, value} 
      const promises = Object.entries(data).map(([key, value]) => {
         return settingApi.update(key, value?.toString() ?? '');
      });
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success("Pengaturan absensi staff berhasil disimpan!");
    },
    onError: (e: any) => {
      toast.error("Gagal menyimpan pengaturan: " + e.message);
    }
  });

  const [formState, setFormState] = useState<{
    staff_geolocation_enabled: boolean;
    office_latitude: number | null;
    office_longitude: number | null;
    office_geofence_radius: number;
    staff_photo_enabled: boolean;
    staff_enforce_time: boolean;
    staff_batas_jam_masuk: string;
    staff_batas_jam_pulang: string;
  }>({
    staff_geolocation_enabled: false,
    office_latitude: null,
    office_longitude: null,
    office_geofence_radius: 100,
    staff_photo_enabled: false,
    staff_enforce_time: false,
    staff_batas_jam_masuk: "08:00",
    staff_batas_jam_pulang: "15:30",
  });

  useEffect(() => {
    if (allSettings) {
      const map: Record<string, string> = {};
      
      // Handle both array and object response structures
      if (Array.isArray(allSettings)) {
        allSettings.forEach((s: any) => map[s.key] = s.value);
      } else {
        Object.values(allSettings).forEach((s: any) => map[s.key] = s.value);
      }

      setFormState({
        staff_geolocation_enabled: map['staff_geolocation_enabled'] === 'true',
        office_latitude: map['office_latitude'] ? parseFloat(map['office_latitude']) : null,
        office_longitude: map['office_longitude'] ? parseFloat(map['office_longitude']) : null,
        office_geofence_radius: map['office_geofence_radius'] ? parseInt(map['office_geofence_radius']) : 100,
        staff_photo_enabled: map['staff_photo_enabled'] === 'true',
        staff_enforce_time: map['staff_enforce_time'] === 'true',
        staff_batas_jam_masuk: map['staff_batas_jam_masuk'] ? map['staff_batas_jam_masuk'].substring(0, 5) : "08:00",
        staff_batas_jam_pulang: map['staff_batas_jam_pulang'] ? map['staff_batas_jam_pulang'].substring(0, 5) : "15:30",
      });
    }
  }, [allSettings]);

  const handleSave = () => {
    saveMutation.mutate({
      staff_geolocation_enabled: formState.staff_geolocation_enabled ? 'true' : 'false',
      office_latitude: formState.office_latitude,
      office_longitude: formState.office_longitude,
      office_geofence_radius: formState.office_geofence_radius,
      staff_photo_enabled: formState.staff_photo_enabled ? 'true' : 'false',
      staff_enforce_time: formState.staff_enforce_time ? 'true' : 'false',
      staff_batas_jam_masuk: formState.staff_batas_jam_masuk + ":00",
      staff_batas_jam_pulang: formState.staff_batas_jam_pulang + ":00",
    });
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
          office_latitude: position.coords.latitude,
          office_longitude: position.coords.longitude,
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
        <h1 className="text-2xl font-bold text-slate-800">Pengaturan Absensi Staff PCNU</h1>
        <p className="text-slate-500 text-sm mt-1">Kelola fitur absensi (geolocation, waktu, & foto selfie) untuk staff</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-0 shadow-sm rounded-xl overflow-hidden md:col-span-2">
          <CardHeader className="pb-3 bg-slate-50/50">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" />
              Jadwal & Waktu Absensi
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-sm text-slate-600">Enforce Jadwal Masuk & Pulang</Label>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Jika diaktifkan, staff akan ditolak jika absen melebihi batas jam masuk atau absen pulang lebih awal.
                </p>
              </div>
              <Switch 
                checked={formState.staff_enforce_time} 
                onCheckedChange={(v) => setFormState({...formState, staff_enforce_time: v})} 
              />
            </div>
            
            {formState.staff_enforce_time && (
              <div className="border-t pt-4 grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Batas Maksimal Jam Masuk</Label>
                  <Input
                    type="time"
                    value={formState.staff_batas_jam_masuk}
                    onChange={(e) => setFormState({...formState, staff_batas_jam_masuk: e.target.value})}
                    className="font-mono text-sm rounded-xl h-11 w-full"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Batas Minimal Jam Pulang</Label>
                  <Input
                    type="time"
                    value={formState.staff_batas_jam_pulang}
                    onChange={(e) => setFormState({...formState, staff_batas_jam_pulang: e.target.value})}
                    className="font-mono text-sm rounded-xl h-11 w-full"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm rounded-xl overflow-hidden md:col-span-2">
          <CardHeader className="pb-3 bg-slate-50/50">
            <CardTitle className="text-base flex items-center gap-2">
              <Camera className="h-4 w-4 text-emerald-600" />
              Bukti Foto Selfie
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-sm text-slate-600">Wajibkan Foto Selfie</Label>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Jika diaktifkan, staff akan diminta mengambil foto selfie menggunakan kamera saat melakukan scan QR Code.
                </p>
              </div>
              <Switch 
                checked={formState.staff_photo_enabled} 
                onCheckedChange={(v) => setFormState({...formState, staff_photo_enabled: v})} 
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
                <Label className="text-sm text-slate-600">Aktifkan validasi lokasi GPS</Label>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Batasi jangkauan area absensi agar staff hanya bisa absen di sekitar area kantor PCNU.
                </p>
              </div>
              <Switch 
                checked={formState.staff_geolocation_enabled} 
                onCheckedChange={(v) => setFormState({...formState, staff_geolocation_enabled: v})} 
              />
            </div>
            
            {formState.staff_geolocation_enabled && (
              <>
                <div className="border-t pt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Koordinat Kantor PCNU</Label>
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
                        value={formState.office_latitude || ''}
                        onChange={(e) => setFormState({...formState, office_latitude: e.target.value ? parseFloat(e.target.value) : null})}
                        className="font-mono text-sm rounded-xl h-11"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Longitude</Label>
                      <Input
                        type="number"
                        step="0.000001"
                        placeholder="109.123456"
                        value={formState.office_longitude || ''}
                        onChange={(e) => setFormState({...formState, office_longitude: e.target.value ? parseFloat(e.target.value) : null})}
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
                      value={formState.office_geofence_radius}
                      onChange={(e) => setFormState({...formState, office_geofence_radius: parseInt(e.target.value) || 100})}
                      className="font-mono text-sm rounded-xl h-11 w-32"
                    />
                    <p className="text-xs text-slate-500 flex-1">
                      Absensi hanya valid jika staff berada dalam radius <strong>{formState.office_geofence_radius}m</strong> dari koordinat kantor.
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
          Simpan Pengaturan
        </Button>
      </div>
    </div>
  );
}
