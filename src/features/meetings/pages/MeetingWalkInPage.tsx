/**
 * MeetingWalkInPage — Self-service walk-in check-in page (no auth required)
 *
 * Mendukung 3 kategori kehadiran:
 * 1. Peserta Terdaftar (Kepala Sekolah / Guru yang Diundang)
 * 2. Perwakilan / Delegasi (Mewakili Kepala Sekolah yang Berhalangan)
 * 3. Peserta Walk-In / Tamu (Peserta Tambahan di Luar Undangan)
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Clock, MapPin, Loader2, CheckCircle2, AlertCircle,
  Navigation, NavigationOff, UserCheck, Users, UserPlus,
  Search, X, Check, Building2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

// ── Types ────────────────────────────────────────────────────────────────────

interface MeetingInfo {
  id: number;
  title: string;
  location: string;
  started_at: string;
  ended_at: string;
  geolocation_enabled: boolean;
  latitude: number | null;
  longitude: number | null;
  geolocation_radius_meters: number | null;
}

interface RegisteredParticipant {
  id: number;
  name: string;
  jabatan: string;
  instansi: string;
}

interface WalkInPayload {
  nama: string;
  jabatan: string;
  instansi: string;
  no_hp: string;
  kehadiran_sebagai?: 'peserta' | 'perwakilan' | 'walk_in';
  mewakili_nama?: string;
  participant_id?: number;
  latitude?: number;
  longitude?: number;
}

interface WalkInResult {
  nama: string;
  jabatan: string;
  instansi: string;
  checked_in_at: string;
  meeting_title: string;
  is_delegation?: boolean;
  mewakili?: string | null;
}

type AttendanceCategory = 'peserta' | 'perwakilan' | 'walk_in';

// ── Zod schema ───────────────────────────────────────────────────────────────

const schema = z.object({
  nama: z.string().min(3, 'Nama minimal 3 karakter'),
  jabatan: z.string().min(2, 'Jabatan wajib diisi'),
  instansi: z.string().min(2, 'Asal instansi / sekolah wajib diisi'),
  no_hp: z
    .string()
    .min(8, 'Nomor WhatsApp tidak valid')
    .regex(/^[0-9+\s-]+$/, 'Nomor WhatsApp hanya boleh berisi angka, +, spasi, atau tanda hubung'),
  mewakili_nama: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function MeetingWalkInPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const queryString = searchParams.toString();

  // Mode kehadiran
  const [category, setCategory] = useState<AttendanceCategory>('peserta');
  const [selectedParticipant, setSelectedParticipant] = useState<RegisteredParticipant | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isManualPeserta, setIsManualPeserta] = useState(false);

  // Geolocation state
  const [geoStatus, setGeoStatus] = useState<'idle' | 'loading' | 'granted' | 'denied' | 'unavailable'>('idle');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const geoFetched = useRef(false);

  // After successful submission
  const [result, setResult] = useState<WalkInResult | null>(null);

  // ── Fetch meeting info & participants ─────────────────────────────────────
  const { data, isLoading, error } = useQuery({
    queryKey: ['public-meeting-walkin', id, queryString],
    queryFn: async () => {
      const res = await apiClient.get(`/public/meetings/${id}/walk-in?${queryString}`);
      return (res.data?.data ?? res.data) as {
        meeting: MeetingInfo;
        registered_participants?: RegisteredParticipant[];
      };
    },
    enabled: !!id,
    retry: false,
    staleTime: Infinity,
  });

  const meeting = data?.meeting;
  const registeredParticipants = data?.registered_participants || [];

  // ── Auto-request geolocation when meeting requires it ────────────────────
  useEffect(() => {
    if (!meeting?.geolocation_enabled || geoFetched.current) return;
    geoFetched.current = true;
    requestGeolocation();
  }, [meeting?.geolocation_enabled]);

  const requestGeolocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus('unavailable');
      return;
    }
    setGeoStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus('granted');
      },
      () => {
        setGeoStatus('denied');
      },
      { timeout: 10_000, enableHighAccuracy: true }
    );
  };

  // ── Form ─────────────────────────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nama: '',
      jabatan: '',
      instansi: '',
      no_hp: '',
      mewakili_nama: '',
    },
  });

  // Filter peserta terdaftar berdasarkan pencarian nama atau sekolah
  const filteredParticipants = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return registeredParticipants.filter(
      (p) => p.name.toLowerCase().includes(q) || p.instansi.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [searchQuery, registeredParticipants]);

  // Saat peserta terdaftar dipilih
  const handleSelectParticipant = (p: RegisteredParticipant) => {
    setSelectedParticipant(p);
    setSearchQuery('');
    if (category === 'peserta') {
      setValue('nama', p.name);
      setValue('jabatan', p.jabatan);
      setValue('instansi', p.instansi);
    } else if (category === 'perwakilan') {
      setValue('instansi', p.instansi);
      setValue('mewakili_nama', p.name);
    }
  };

  // Reset form saat ganti kategori
  const handleCategoryChange = (cat: AttendanceCategory) => {
    setCategory(cat);
    setSelectedParticipant(null);
    setSearchQuery('');
    setIsManualPeserta(false);
    setValue('nama', '');
    setValue('jabatan', '');
    setValue('instansi', '');
    setValue('mewakili_nama', '');
  };

  // ── Submit mutation ───────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload: WalkInPayload = {
        nama: category === 'peserta' && selectedParticipant && !isManualPeserta
          ? selectedParticipant.name
          : values.nama,
        jabatan: category === 'peserta' && selectedParticipant && !isManualPeserta
          ? selectedParticipant.jabatan
          : values.jabatan,
        instansi: (category === 'peserta' || category === 'perwakilan') && selectedParticipant
          ? selectedParticipant.instansi
          : values.instansi,
        no_hp: values.no_hp,
        kehadiran_sebagai: category,
        ...(selectedParticipant ? { participant_id: selectedParticipant.id } : {}),
        ...(category === 'perwakilan' ? {
          mewakili_nama: selectedParticipant ? selectedParticipant.name : values.mewakili_nama,
        } : {}),
        ...(coords ? { latitude: coords.lat, longitude: coords.lng } : {}),
      };

      const res = await apiClient.post(
        `/public/meetings/${id}/walk-in?${queryString}`,
        payload
      );
      return (res.data?.data ?? res.data) as WalkInResult;
    },
    onSuccess: (data) => {
      setResult(data);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'Gagal menyimpan kehadiran. Silakan coba lagi.';
      toast.error(msg);
    },
  });

  const onSubmit = (values: FormValues) => {
    mutation.mutate(values);
  };

  // ── Loading state ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-emerald-600 mx-auto" />
          <p className="text-slate-600 font-medium">Memuat informasi rapat...</p>
        </div>
      </div>
    );
  }

  // ── Error state (expired / not found) ─────────────────────────────────────
  if (error || !meeting) {
    const errMsg =
      (error as any)?.response?.data?.message ?? 'QR Code tidak valid atau sudah tidak berlaku.';
    const status = (error as any)?.response?.status;

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card className="border-red-200">
            <CardContent className="pt-6 text-center space-y-3">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
              <p className="font-semibold text-slate-800">
                {status === 410 ? 'QR Code Sudah Tidak Berlaku' : 'Tidak Dapat Memuat Rapat'}
              </p>
              <p className="text-sm text-slate-500">{errMsg}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── Success state ─────────────────────────────────────────────────────────
  if (result) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4">
          <Card className="border-emerald-200 shadow-sm">
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              <div className="flex justify-center">
                <div className="bg-emerald-100 rounded-full p-4">
                  <CheckCircle2 className="h-12 w-12 text-emerald-600" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xl font-bold text-slate-800">Kehadiran Tercatat!</p>
                <p className="text-sm text-slate-600">
                  Selamat datang, <span className="font-semibold text-slate-800">{result.nama}</span>
                </p>
                {result.is_delegation && result.mewakili && (
                  <div className="mt-2 bg-amber-50 border border-amber-200 rounded-md p-2 text-xs text-amber-800 font-medium">
                    Mewakili: {result.mewakili} ({result.instansi})
                  </div>
                )}
              </div>
              <div className="bg-slate-50 rounded-lg p-4 text-left space-y-2 text-sm border border-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-500">Jabatan</span>
                  <span className="font-medium text-slate-700">{result.jabatan}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Instansi</span>
                  <span className="font-medium text-slate-700">{result.instansi}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Waktu check-in</span>
                  <span className="font-medium text-emerald-700">{result.checked_in_at} WIB</span>
                </div>
              </div>
              <p className="text-xs text-slate-400 pt-2">{result.meeting_title}</p>
            </CardContent>
          </Card>
          <p className="text-center text-xs text-slate-400">
            LP Ma'arif NU Cilacap · Sistem Absensi Digital
          </p>
        </div>
      </div>
    );
  }

  // ── Geolocation status banner ─────────────────────────────────────────────
  const renderGeoBanner = () => {
    if (!meeting.geolocation_enabled) return null;

    if (geoStatus === 'loading') {
      return (
        <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
          Mengambil lokasi Anda...
        </div>
      );
    }
    if (geoStatus === 'granted') {
      return (
        <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
          <Navigation className="h-3.5 w-3.5 shrink-0" />
          Lokasi terdeteksi — siap divalidasi saat submit
        </div>
      );
    }
    if (geoStatus === 'denied' || geoStatus === 'unavailable') {
      return (
        <div className="flex items-center justify-between gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          <div className="flex items-center gap-2">
            <NavigationOff className="h-3.5 w-3.5 shrink-0" />
            Izin lokasi ditolak — validasi jarak dilewati
          </div>
          <button
            type="button"
            className="underline shrink-0 font-medium"
            onClick={requestGeolocation}
          >
            Coba lagi
          </button>
        </div>
      );
    }
    return null;
  };

  // ── Main form ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-md space-y-3 sm:space-y-4">

        {/* Meeting info header */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-semibold uppercase tracking-wider mb-1">
              <UserCheck className="h-3.5 w-3.5" />
              Absensi Kehadiran Rapat
            </div>
            <CardTitle className="text-lg leading-snug">{meeting.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-xs sm:text-sm text-slate-600 pt-0">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              {formatDate(meeting.started_at)}
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              {meeting.location}
            </div>
          </CardContent>
        </Card>

        {/* Kategori Kehadiran (3 Tabs) */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-200/70 rounded-xl text-xs font-medium">
          <button
            type="button"
            onClick={() => handleCategoryChange('peserta')}
            className={`flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-2 rounded-lg transition-all ${
              category === 'peserta'
                ? 'bg-white text-emerald-800 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <span>Peserta</span>
          </button>
          <button
            type="button"
            onClick={() => handleCategoryChange('perwakilan')}
            className={`flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-2 rounded-lg transition-all ${
              category === 'perwakilan'
                ? 'bg-white text-amber-800 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <span>Perwakilan</span>
          </button>
          <button
            type="button"
            onClick={() => handleCategoryChange('walk_in')}
            className={`flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-2 rounded-lg transition-all ${
              category === 'walk_in'
                ? 'bg-white text-blue-800 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserPlus className="h-3.5 w-3.5 text-blue-600 shrink-0" />
            <span>Tamu / Walk-In</span>
          </button>
        </div>

        {/* Main Form Card */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {category === 'peserta' && 'Data Peserta Terdaftar'}
              {category === 'perwakilan' && 'Data Perwakilan / Utusan'}
              {category === 'walk_in' && 'Data Tamu / Walk-In'}
            </CardTitle>
            <p className="text-xs text-slate-500">
              {category === 'peserta' && 'Pilih nama atau sekolah Anda di bawah untuk check-in instan.'}
              {category === 'perwakilan' && 'Pilih kepala/sekolah yang Anda wakili, lalu isi data diri Anda.'}
              {category === 'walk_in' && 'Isi data diri Anda sebagai peserta tambahan/tamu rapat.'}
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

              {/* Geolocation banner */}
              {renderGeoBanner()}

              {/* ── MODE 1: PESERTA TERDAFTAR ── */}
              {category === 'peserta' && (
                <>
                  {!isManualPeserta ? (
                    <div className="space-y-3">
                      {selectedParticipant ? (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 relative space-y-1">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedParticipant(null);
                              setValue('nama', '');
                              setValue('jabatan', '');
                              setValue('instansi', '');
                            }}
                            className="absolute top-2.5 right-2.5 text-emerald-700 hover:text-emerald-900 text-xs font-semibold underline flex items-center gap-0.5"
                          >
                            <X className="h-3.5 w-3.5" /> Ganti
                          </button>
                          <p className="text-xs text-emerald-700 font-semibold uppercase tracking-wider">
                            Peserta Terpilih
                          </p>
                          <p className="font-bold text-slate-800 text-sm">{selectedParticipant.name}</p>
                          <p className="text-xs text-slate-600">{selectedParticipant.jabatan} · {selectedParticipant.instansi}</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Label htmlFor="search-peserta" className="text-xs font-semibold">
                            Cari Nama atau Asal Sekolah <span className="text-red-500">*</span>
                          </Label>
                          <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                            <Input
                              id="search-peserta"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              placeholder="Ketik nama Anda atau sekolah (misal: Patimuan)..."
                              className="pl-9 text-sm"
                            />
                          </div>

                          {/* List saran */}
                          {searchQuery.trim().length > 0 && (
                            <div className="max-h-56 overflow-y-auto border rounded-lg bg-white divide-y shadow-md">
                              {filteredParticipants.length > 0 ? (
                                filteredParticipants.map((p) => (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => handleSelectParticipant(p)}
                                    className="w-full text-left px-3 py-2 hover:bg-emerald-50 transition-colors flex items-center justify-between gap-2"
                                  >
                                    <div>
                                      <p className="font-medium text-sm text-slate-800">{p.name}</p>
                                      <p className="text-xs text-slate-500">{p.jabatan} · {p.instansi}</p>
                                    </div>
                                    <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                                  </button>
                                ))
                              ) : (
                                <div className="p-3 text-center text-xs text-slate-400">
                                  Tidak ditemukan peserta yang cocok dengan "{searchQuery}"
                                </div>
                              )}
                            </div>
                          )}

                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => setIsManualPeserta(true)}
                              className="text-xs text-emerald-600 hover:text-emerald-800 underline"
                            >
                              Nama tidak tercantum di daftar? Ketik manual
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Manual Entry untuk Peserta */
                    <div className="space-y-3 border-t pt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">Ketik Data Manual</span>
                        <button
                          type="button"
                          onClick={() => setIsManualPeserta(false)}
                          className="text-xs text-emerald-600 hover:text-emerald-800 underline"
                        >
                          Cari di daftar peserta
                        </button>
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="nama" className="text-xs">Nama Lengkap <span className="text-red-500">*</span></Label>
                        <Input
                          id="nama"
                          placeholder="Nama lengkap Anda beserta gelar"
                          {...register('nama')}
                          className={errors.nama ? 'border-red-400' : ''}
                        />
                        {errors.nama && <p className="text-xs text-red-500">{errors.nama.message}</p>}
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="jabatan" className="text-xs">Jabatan <span className="text-red-500">*</span></Label>
                        <Input
                          id="jabatan"
                          placeholder="Contoh: Kepala Madrasah / Guru"
                          {...register('jabatan')}
                          className={errors.jabatan ? 'border-red-400' : ''}
                        />
                        {errors.jabatan && <p className="text-xs text-red-500">{errors.jabatan.message}</p>}
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="instansi" className="text-xs">Asal Sekolah / Instansi <span className="text-red-500">*</span></Label>
                        <Input
                          id="instansi"
                          placeholder="Contoh: MTs Maarif Patimuan"
                          {...register('instansi')}
                          className={errors.instansi ? 'border-red-400' : ''}
                        />
                        {errors.instansi && <p className="text-xs text-red-500">{errors.instansi.message}</p>}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ── MODE 2: PERWAKILAN / DELEGASI ── */}
              {category === 'perwakilan' && (
                <div className="space-y-3">
                  {/* Pilihan sekolah / kepala yang diwakili */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      Sekolah / Pejabat yang Anda Wakili <span className="text-red-500">*</span>
                    </Label>

                    {selectedParticipant ? (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 relative space-y-1">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedParticipant(null);
                            setValue('instansi', '');
                            setValue('mewakili_nama', '');
                          }}
                          className="absolute top-2.5 right-2.5 text-amber-800 hover:text-amber-950 text-xs font-semibold underline flex items-center gap-0.5"
                        >
                          <X className="h-3.5 w-3.5" /> Ganti
                        </button>
                        <p className="text-xs text-amber-700 font-semibold uppercase tracking-wider">
                          Mewakili
                        </p>
                        <p className="font-bold text-slate-800 text-sm">{selectedParticipant.name}</p>
                        <p className="text-xs text-slate-600">{selectedParticipant.jabatan} · {selectedParticipant.instansi}</p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                          <Input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Ketik asal sekolah atau nama kepala (misal: Patimuan)..."
                            className="pl-9 text-sm"
                          />
                        </div>

                        {searchQuery.trim().length > 0 && (
                          <div className="max-h-48 overflow-y-auto border rounded-lg bg-white divide-y shadow-md">
                            {filteredParticipants.length > 0 ? (
                              filteredParticipants.map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => handleSelectParticipant(p)}
                                  className="w-full text-left px-3 py-2 hover:bg-amber-50 transition-colors flex items-center justify-between gap-2"
                                >
                                  <div>
                                    <p className="font-medium text-sm text-slate-800">{p.name}</p>
                                    <p className="text-xs text-slate-500">{p.jabatan} · {p.instansi}</p>
                                  </div>
                                  <Building2 className="h-4 w-4 text-amber-600 shrink-0" />
                                </button>
                              ))
                            ) : (
                              <div className="p-3 text-center text-xs text-slate-400">
                                Tidak ditemukan di daftar. Anda dapat mengetik asal sekolah di bawah.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {!selectedParticipant && (
                    <>
                      <div className="space-y-1">
                        <Label htmlFor="instansi" className="text-xs">Asal Sekolah yang Diwakili <span className="text-red-500">*</span></Label>
                        <Input
                          id="instansi"
                          placeholder="Contoh: MTs Maarif Patimuan"
                          {...register('instansi')}
                          className={errors.instansi ? 'border-red-400' : ''}
                        />
                        {errors.instansi && <p className="text-xs text-red-500">{errors.instansi.message}</p>}
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="mewakili_nama" className="text-xs">Nama Kepala / Pejabat yang Diwakili</Label>
                        <Input
                          id="mewakili_nama"
                          placeholder="Contoh: Khayat, S.Pd.I"
                          {...register('mewakili_nama')}
                        />
                      </div>
                    </>
                  )}

                  {/* Data Diri Perwakilan */}
                  <div className="border-t pt-3 space-y-3">
                    <p className="text-xs font-semibold text-slate-700">Data Diri Anda (Perwakilan)</p>

                    <div className="space-y-1">
                      <Label htmlFor="nama" className="text-xs">Nama Lengkap Perwakilan <span className="text-red-500">*</span></Label>
                      <Input
                        id="nama"
                        placeholder="Nama lengkap Anda yang hadir di lokasi"
                        {...register('nama')}
                        className={errors.nama ? 'border-red-400' : ''}
                      />
                      {errors.nama && <p className="text-xs text-red-500">{errors.nama.message}</p>}
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="jabatan" className="text-xs">Jabatan Anda di Sekolah <span className="text-red-500">*</span></Label>
                      <Input
                        id="jabatan"
                        placeholder="Contoh: Waka Kurikulum / Guru / Staf"
                        {...register('jabatan')}
                        className={errors.jabatan ? 'border-red-400' : ''}
                      />
                      {errors.jabatan && <p className="text-xs text-red-500">{errors.jabatan.message}</p>}
                    </div>
                  </div>
                </div>
              )}

              {/* ── MODE 3: TAMU / WALK-IN ── */}
              {category === 'walk_in' && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="nama" className="text-xs">Nama Lengkap <span className="text-red-500">*</span></Label>
                    <Input
                      id="nama"
                      placeholder="Contoh: Ahmad Fauzi, S.Pd."
                      {...register('nama')}
                      className={errors.nama ? 'border-red-400' : ''}
                    />
                    {errors.nama && <p className="text-xs text-red-500">{errors.nama.message}</p>}
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="jabatan" className="text-xs">Jabatan <span className="text-red-500">*</span></Label>
                    <Input
                      id="jabatan"
                      placeholder="Contoh: Pengurus MWC / Tamu Undangan"
                      {...register('jabatan')}
                      className={errors.jabatan ? 'border-red-400' : ''}
                    />
                    {errors.jabatan && <p className="text-xs text-red-500">{errors.jabatan.message}</p>}
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="instansi" className="text-xs">Asal Instansi / Lembaga <span className="text-red-500">*</span></Label>
                    <Input
                      id="instansi"
                      placeholder="Contoh: MWC NU Patimuan"
                      {...register('instansi')}
                      className={errors.instansi ? 'border-red-400' : ''}
                    />
                    {errors.instansi && <p className="text-xs text-red-500">{errors.instansi.message}</p>}
                  </div>
                </div>
              )}

              {/* ── NOMOR WHATSAPP (SEMUA KATEGORI) ── */}
              <div className="space-y-1.5 pt-1">
                <Label htmlFor="no_hp" className="text-xs font-semibold">
                  Nomor HP / WhatsApp Anda <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="no_hp"
                  type="tel"
                  inputMode="numeric"
                  placeholder="Contoh: 08123456789"
                  {...register('no_hp')}
                  className={errors.no_hp ? 'border-red-400' : ''}
                />
                {errors.no_hp && <p className="text-xs text-red-500">{errors.no_hp.message}</p>}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 h-11 text-sm font-medium shadow"
                disabled={mutation.isPending || (category === 'peserta' && !selectedParticipant && !isManualPeserta)}
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Menyimpan Kehadiran...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Konfirmasi Kehadiran Saya
                  </>
                )}
              </Button>

              {/* Warning if peserta not selected */}
              {category === 'peserta' && !selectedParticipant && !isManualPeserta && (
                <p className="text-[11px] text-center text-amber-700 bg-amber-50 border border-amber-200 rounded p-1.5">
                  Silakan cari dan pilih nama Anda di atas, atau klik "Ketik manual".
                </p>
              )}

              {/* Server error */}
              {mutation.isError && (
                <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    {(mutation.error as any)?.response?.data?.message ??
                      'Terjadi kesalahan saat menyimpan kehadiran. Silakan coba lagi.'}
                  </span>
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-400">
          LP Ma'arif NU Cilacap · Sistem Absensi Digital
        </p>
      </div>
    </div>
  );
}
