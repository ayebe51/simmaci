/**
 * MeetingCheckInPage — Public QR display page (no auth required)
 * Accessible via signed URL from QR code in WhatsApp invitation.
 * Participants open this page and show the QR to the panitia scanner.
 */

import { useParams, useSearchParams } from 'react-router-dom';
import { Clock, MapPin, Loader2, QrCode, AlertCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api';

export default function MeetingCheckInPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const queryString = searchParams.toString();

  // The QR value is the current page URL (the signed URL from the invitation)
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

  // Fetch meeting info (optional — for display purposes)
  const { data, isLoading, error } = useQuery({
    queryKey: ['public-meeting-qr', id, queryString],
    queryFn: async () => {
      const res = await apiClient.get(`/public/meetings/${id}/check-in?${queryString}`);
      return res.data?.data ?? res.data;
    },
    enabled: !!id,
    retry: false,
    staleTime: Infinity,
  });

  const meeting = data?.meeting;
  const participant = data?.participant;

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

  if (error) {
    // Even if the API call fails, still show the QR code
    // The QR is the URL itself — panitia scanner will validate it
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4">
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
                  <QRCodeSVG value={currentUrl} size={220} level="M" includeMargin={false} />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-semibold text-slate-700">Tunjukkan QR ini ke panitia</p>
                  <p className="text-xs text-slate-500">
                    Panitia akan men-scan QR code ini untuk mencatat kehadiran Anda
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <p className="text-center text-xs text-slate-400">
            LP Ma'arif NU Cilacap · Sistem Absensi Digital
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        {/* Meeting Info */}
        {meeting && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-emerald-700 text-xs font-semibold uppercase tracking-wider mb-1">
                <AlertCircle className="h-3.5 w-3.5" />
                Absensi Rapat
              </div>
              <CardTitle className="text-lg leading-snug">{meeting.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-600">
              {meeting.started_at && (
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  {new Date(meeting.started_at).toLocaleDateString('id-ID', {
                    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </div>
              )}
              {meeting.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  {meeting.location}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* QR Code Display */}
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
                <QRCodeSVG value={currentUrl} size={220} level="M" includeMargin={false} />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-semibold text-slate-700">Tunjukkan QR ini ke panitia</p>
                <p className="text-xs text-slate-500">
                  Panitia akan men-scan QR code ini untuk mencatat kehadiran Anda
                </p>
              </div>
            </div>

            {/* Participant info */}
            {participant && (
              <div className="bg-emerald-50 rounded-lg p-3 text-sm">
                <p className="font-medium text-emerald-800">{participant.name}</p>
                <p className="text-emerald-600 text-xs">
                  {participant.jabatan} · {participant.instansi}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-400">
          LP Ma'arif NU Cilacap · Sistem Absensi Digital
        </p>
      </div>
    </div>
  );
}
