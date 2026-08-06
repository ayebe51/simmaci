/**
 * MeetingWalkInPage — Self-service walk-in check-in page (no auth required)
 *
 * Peserta scan QR Umum yang dipasang di lokasi rapat, kemudian mengisi form
 * identitas dan submit sendiri. Geolokasi diambil dari browser jika rapat
 * mengaktifkan validasi lokasi (opsional — jika ditolak tetap bisa lanjut).
 *
 * Route: /meetings/:id/walk-in  (signed URL query params: ?expires=...&signature=...)
 */

import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Clock, MapPin, Loader2, CheckCircle2, AlertCircle,
  Navigation, NavigationOff, UserCheck,
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

interface WalkInPayload {
  nama: string;
  jabatan: string;
  instansi: string;
  no_hp: string;
  latitude?: number;
  longitude?: number;
}

interface WalkInResult {
  nama: string;
  jabatan: string;
  instansi: string;
  checked_in_at: string;
  meeting_title: string;
}

// ── Zod schema ───────────────────────────────────────────────────────────────

const schema = z.object({
  nama: z.string().min(3, 'Nama minimal 3 karakter'),
  jabatan: z.string().min(2, 'Jabatan wajib diisi'),
  instansi: z.string().min(2, 'Asal instansi wajib diisi'),
  no_hp: z
    .string()
    .min(8, 'Nomor HP tidak valid')
    .regex(/^[0-9+\s-]+$/, 'Nomor HP hanya boleh berisi angka, +, spasi, atau tanda hubung'),
});

type FormValues = z.infer<typeof schema>;

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Component ────────────────────────────────────────────────────────────────

export default function MeetingWalkInPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const queryString = searchParams.toString();

  // Geolocation state
  const [geoStatus, setGeoStatus] = useState<'idle' | 'loading' | 'granted' | 'denied' | 'unavailable'>('idle');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const geoFetched = useRef(false);

  // After successful submission
  const [result, setResult] = useState<WalkInResult | null>(null);

  // ── Fetch meeting info ───────────────────────────────────────────────────
  const { data, isLoading, error } = useQuery({
    queryKey: ['public-meeting-walkin', id, queryString],
    queryFn: async () => {
      const res = await apiClient.get(`/public/meetings/${id}/walk-in?${queryString}`);
      return (res.data?.data ?? res.data) as { meeting: MeetingInfo };
    },
    enabled: !!id,
    retry: false,
    staleTime: Infinity,
  });

  const meeting = data?.meeting;

  // ── Auto-request geolocation when meeting requires it ────────────────────
  useEffect(() => {
    if (!meeting?.geolocation_enabled || geoFetched.current) return;
    geoFetched.current = true;
    requestGeolocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // ── Submit mutation ───────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload: WalkInPayload = {
        nama: values.nama,
        jabatan: values.jabatan,
        instansi: values.instansi,
        no_hp: values.no_hp,
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
          <p className="text-slate-600">Memuat informasi rapat...</p>
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
          <Card className="border-emerald-200">
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              <div className="flex justify-center">
                <div className="bg-emerald-100 rounded-full p-4">
                  <CheckCircle2 className="h-12 w-12 text-emerald-600" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xl font-bold text-slate-800">Kehadiran Tercatat!</p>
                <p className="text-sm text-slate-500">
                  Selamat datang, <span className="font-semibold text-slate-700">{result.nama}</span>
                </p>
              </div>
              <div className="bg-emerald-50 rounded-lg p-4 text-left space-y-2 text-sm">
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
          Lokasi terdeteksi — akan divalidasi saat submit
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
            className="underline shrink-0"
            onClick={requestGeolocation}
          >
            Coba lagi
          </button>
        </div>
      );
    }
    if (geoStatus === 'idle') {
      return (
        <div className="flex items-center justify-between gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
          <div className="flex items-center gap-2">
            <Navigation className="h-3.5 w-3.5 shrink-0" />
            Rapat ini menggunakan validasi lokasi
          </div>
          <button
            type="button"
            className="underline shrink-0 text-blue-600"
            onClick={requestGeolocation}
          >
            Aktifkan GPS
          </button>
        </div>
      );
    }
    return null;
  };

  // ── Main form ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">

        {/* Meeting info */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-emerald-700 text-xs font-semibold uppercase tracking-wider mb-1">
              <UserCheck className="h-3.5 w-3.5" />
              Absensi Walk-In
            </div>
            <CardTitle className="text-lg leading-snug">{meeting.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600 pt-0">
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

        {/* Walk-in form */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Isi Data Kehadiran</CardTitle>
            <p className="text-xs text-slate-500">
              Semua field wajib diisi dengan data yang benar.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

              {/* Geolocation banner */}
              {renderGeoBanner()}

              {/* Nama */}
              <div className="space-y-1.5">
                <Label htmlFor="nama">Nama Lengkap <span className="text-red-500">*</span></Label>
                <Input
                  id="nama"
                  placeholder="Contoh: Ahmad Fauzi, S.Pd."
                  {...register('nama')}
                  className={errors.nama ? 'border-red-400' : ''}
                />
                {errors.nama && (
                  <p className="text-xs text-red-500">{errors.nama.message}</p>
                )}
              </div>

              {/* Jabatan */}
              <div className="space-y-1.5">
                <Label htmlFor="jabatan">Jabatan <span className="text-red-500">*</span></Label>
                <Input
                  id="jabatan"
                  placeholder="Contoh: Kepala Madrasah, Guru, Staf"
                  {...register('jabatan')}
                  className={errors.jabatan ? 'border-red-400' : ''}
                />
                {errors.jabatan && (
                  <p className="text-xs text-red-500">{errors.jabatan.message}</p>
                )}
              </div>

              {/* Instansi */}
              <div className="space-y-1.5">
                <Label htmlFor="instansi">Asal Sekolah / Instansi <span className="text-red-500">*</span></Label>
                <Input
                  id="instansi"
                  placeholder="Contoh: MI Maarif 01 Cilacap"
                  {...register('instansi')}
                  className={errors.instansi ? 'border-red-400' : ''}
                />
                {errors.instansi && (
                  <p className="text-xs text-red-500">{errors.instansi.message}</p>
                )}
              </div>

              {/* Nomor HP */}
              <div className="space-y-1.5">
                <Label htmlFor="no_hp">Nomor HP / WhatsApp <span className="text-red-500">*</span></Label>
                <Input
                  id="no_hp"
                  type="tel"
                  inputMode="numeric"
                  placeholder="Contoh: 08123456789"
                  {...register('no_hp')}
                  className={errors.no_hp ? 'border-red-400' : ''}
                />
                {errors.no_hp && (
                  <p className="text-xs text-red-500">{errors.no_hp.message}</p>
                )}
              </div>

              {/* Submit */}
              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                disabled={mutation.isPending}
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Menyimpan kehadiran...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Konfirmasi Kehadiran Saya
                  </>
                )}
              </Button>

              {/* Server error */}
              {mutation.isError && (
                <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>
                    {(mutation.error as any)?.response?.data?.message ??
                      'Terjadi kesalahan. Silakan coba lagi.'}
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
