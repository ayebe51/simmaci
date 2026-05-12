/**
 * MeetingCheckInPage — Public check-in page (no auth required)
 * Accessible via signed URL from QR code scan
 */

import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import {
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  Loader2,
  AlertTriangle,
  QrCode,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePublicMeetingInfo, useMeetingCheckIn, useMeetingWalkIn } from '../hooks/useMeetingCheckIn';
import { CheckInPayload, WalkInPayload } from '../types/meeting.types';

// ── Walk-in form schema ──
const walkInSchema = z.object({
  walk_in_name: z.string().min(1, 'Nama wajib diisi'),
  walk_in_jabatan: z.string().min(1, 'Jabatan wajib diisi'),
  walk_in_instansi: z.string().min(1, 'Instansi wajib diisi'),
  walk_in_phone: z.string().min(9, 'Nomor WA tidak valid'),
});
type WalkInForm = z.infer<typeof walkInSchema>;

type CheckInState = 'idle' | 'success' | 'already_checked_in' | 'expired' | 'invalid' | 'rate_limited';

export default function MeetingCheckInPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const participantId = searchParams.get('participant');
  const isWalkIn = !participantId;
  const queryString = searchParams.toString();

  const [checkInState, setCheckInState] = useState<CheckInState>('idle');
  const [successData, setSuccessData] = useState<any>(null);
  const [isDelegation, setIsDelegation] = useState(false);
  const [delegatedForId, setDelegatedForId] = useState<string>('');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showQr, setShowQr] = useState(false);
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
  const [geoError, setGeoError] = useState<string | null>(null);

  const { data: meeting, isLoading, error } = usePublicMeetingInfo(id, queryString);
  const checkInMutation = useMeetingCheckIn(id, queryString);
  const walkInMutation = useMeetingWalkIn(id, queryString);

  const walkInForm = useForm<WalkInForm>({
    resolver: zodResolver(walkInSchema),
  });

  // Request geolocation if required
  useEffect(() => {
    if (meeting?.geolocation_enabled) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => setGeoError('Validasi lokasi diperlukan. Silakan izinkan akses lokasi di browser Anda.')
      );
    }
  }, [meeting?.geolocation_enabled]);

  // Map API errors to states
  const getErrorState = (status: number): CheckInState => {
    if (status === 403) return 'invalid';
    if (status === 409) return 'already_checked_in';
    if (status === 410) return 'expired';
    if (status === 429) return 'rate_limited';
    return 'idle';
  };

  const handlePersonalCheckIn = () => {
    if (meeting?.geolocation_enabled && !coords) {
      setGeoError('Izinkan akses lokasi untuk melanjutkan check-in.');
      return;
    }

    const payload: CheckInPayload = {
      is_delegation: isDelegation,
      delegated_for_participant_id: isDelegation && delegatedForId ? parseInt(delegatedForId) : undefined,
      latitude: coords?.latitude,
      longitude: coords?.longitude,
    };

    checkInMutation.mutate(payload, {
      onSuccess: (data) => {
        setSuccessData(data.data);
        setCheckInState('success');
      },
      onError: (error: any) => {
        const state = getErrorState(error.response?.status);
        setCheckInState(state !== 'idle' ? state : 'idle');
      },
    });
  };

  const handleWalkIn = (values: WalkInForm) => {
    if (meeting?.geolocation_enabled && !coords) {
      setGeoError('Izinkan akses lokasi untuk melanjutkan check-in.');
      return;
    }

    const payload: WalkInPayload = {
      ...values,
      latitude: coords?.latitude,
      longitude: coords?.longitude,
    };

    walkInMutation.mutate(payload, {
      onSuccess: (data) => {
        setSuccessData(data.data);
        setCheckInState('success');
      },
      onError: (error: any) => {
        const state = getErrorState(error.response?.status);
        setCheckInState(state !== 'idle' ? state : 'idle');
      },
    });
  };

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-emerald-600 mx-auto" />
          <p className="text-slate-600">Memvalidasi QR Code...</p>
        </div>
      </div>
    );
  }

  // ── Error states from initial load ──
  if (error) {
    const status = (error as any).response?.status;
    return <ErrorScreen status={status} />;
  }

  // ── Post-submit states ──
  if (checkInState === 'success' && successData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-10 pb-8 space-y-4">
            <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto" />
            <h2 className="text-xl font-bold text-slate-800">Check-in Berhasil!</h2>
            <p className="text-slate-600">
              Selamat datang, <strong>{successData.participant_name}</strong>
            </p>
            <div className="bg-emerald-50 rounded-lg p-3 text-sm text-emerald-700 space-y-1">
              <p>
                <Clock className="inline h-3.5 w-3.5 mr-1" />
                {format(new Date(successData.checked_in_at), 'dd MMM yyyy, HH:mm:ss', { locale: idLocale })}
              </p>
              {successData.device_info && (
                <p className="text-xs text-emerald-600">
                  {successData.device_info.browser} · {successData.device_info.device_type}
                </p>
              )}
            </div>
            {successData.is_delegation && successData.delegated_for_name && (
              <p className="text-sm text-slate-500">
                Hadir sebagai delegasi untuk <strong>{successData.delegated_for_name}</strong>
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (checkInState === 'already_checked_in') {
    return <ErrorScreen status={409} />;
  }
  if (checkInState === 'expired') {
    return <ErrorScreen status={410} />;
  }
  if (checkInState === 'invalid') {
    return <ErrorScreen status={403} />;
  }
  if (checkInState === 'rate_limited') {
    return <ErrorScreen status={429} />;
  }

  if (!meeting) return null;

  // ── Main check-in form ──
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        {/* Meeting Info */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-emerald-700 text-xs font-semibold uppercase tracking-wider mb-1">
              <CalendarIcon className="h-3.5 w-3.5" />
              Absensi Rapat
            </div>
            <CardTitle className="text-lg leading-snug">{meeting.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              {format(new Date(meeting.started_at), 'dd MMM yyyy, HH:mm', { locale: idLocale })}
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-slate-400" />
              {meeting.location}
            </div>
          </CardContent>
        </Card>

        {/* Geolocation warning */}
        {meeting.geolocation_enabled && geoError && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            {geoError}
          </div>
        )}

        {/* Walk-in form */}
        {isWalkIn ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Isi Identitas Anda</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={walkInForm.handleSubmit(handleWalkIn)} className="space-y-3">
                <div>
                  <Label htmlFor="walk_in_name">Nama Lengkap *</Label>
                  <Input id="walk_in_name" {...walkInForm.register('walk_in_name')} placeholder="Nama lengkap" />
                  {walkInForm.formState.errors.walk_in_name && (
                    <p className="text-xs text-red-500 mt-1">{walkInForm.formState.errors.walk_in_name.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="walk_in_jabatan">Jabatan *</Label>
                  <Input id="walk_in_jabatan" {...walkInForm.register('walk_in_jabatan')} placeholder="Jabatan Anda" />
                </div>
                <div>
                  <Label htmlFor="walk_in_instansi">Instansi *</Label>
                  <Input id="walk_in_instansi" {...walkInForm.register('walk_in_instansi')} placeholder="Asal instansi" />
                </div>
                <div>
                  <Label htmlFor="walk_in_phone">Nomor WhatsApp *</Label>
                  <Input id="walk_in_phone" {...walkInForm.register('walk_in_phone')} placeholder="081234567890" />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  disabled={walkInMutation.isPending || (meeting.geolocation_enabled && !coords)}
                >
                  {walkInMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Konfirmasi Kehadiran
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          /* Personal QR check-in — show QR only, panitia must scan */
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <QrCode className="h-4 w-4 text-emerald-600" />
                QR Code Kehadiran Anda
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col items-center gap-3">
                <div className="bg-white p-4 rounded-xl border-2 border-emerald-200 shadow-sm">
                  <QRCodeSVG
                    value={currentUrl}
                    size={220}
                    level="M"
                    includeMargin={false}
                  />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-semibold text-slate-700">
                    Tunjukkan QR ini ke panitia
                  </p>
                  <p className="text-xs text-slate-500">
                    Panitia akan men-scan QR code ini untuk mencatat kehadiran Anda
                  </p>
                </div>
              </div>

              {/* Participant info if available */}
              {meeting.participant && (
                <div className="bg-emerald-50 rounded-lg p-3 text-sm">
                  <p className="font-medium text-emerald-800">{meeting.participant.name}</p>
                  <p className="text-emerald-600 text-xs">{meeting.participant.jabatan} · {meeting.participant.instansi}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-slate-400">
          LP Ma'arif NU Cilacap · Sistem Absensi Digital
        </p>
      </div>
    </div>
  );
}

// ── Helper components ──

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ErrorScreen({ status }: { status: number }) {
  const config: Record<number, { icon: React.ReactNode; title: string; message: string }> = {
    403: {
      icon: <XCircle className="h-16 w-16 text-red-400 mx-auto" />,
      title: 'QR Code Tidak Valid',
      message: 'QR Code tidak valid atau telah dimodifikasi. Pastikan Anda menggunakan QR Code yang benar.',
    },
    409: {
      icon: <CheckCircle2 className="h-16 w-16 text-blue-400 mx-auto" />,
      title: 'Sudah Check-in',
      message: 'Anda sudah melakukan check-in sebelumnya untuk rapat ini.',
    },
    410: {
      icon: <Clock className="h-16 w-16 text-amber-400 mx-auto" />,
      title: 'QR Code Kadaluarsa',
      message: 'QR Code sudah tidak berlaku. Hubungi panitia rapat untuk bantuan.',
    },
    429: {
      icon: <AlertTriangle className="h-16 w-16 text-orange-400 mx-auto" />,
      title: 'Terlalu Banyak Percobaan',
      message: 'Terlalu banyak percobaan check-in dari perangkat Anda. Silakan tunggu beberapa menit.',
    },
  };

  const c = config[status] ?? {
    icon: <XCircle className="h-16 w-16 text-red-400 mx-auto" />,
    title: 'Terjadi Kesalahan',
    message: 'Gagal memproses check-in. Silakan coba lagi atau hubungi panitia.',
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-sm text-center">
        <CardContent className="pt-10 pb-8 space-y-4">
          {c.icon}
          <h2 className="text-xl font-bold text-slate-800">{c.title}</h2>
          <p className="text-slate-500 text-sm">{c.message}</p>
        </CardContent>
      </Card>
    </div>
  );
}
