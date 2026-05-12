/**
 * MeetingDetailPage Component
 * Display meeting details with tabs for attendance, minutes, and photos
 */

import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MeetingMinutesEditor } from './components/MeetingMinutesEditor';
import { MeetingMinutesView } from './components/MeetingMinutesView';
import { MeetingPhotoGallery } from './components/MeetingPhotoGallery';
import { MeetingPhotoUploader } from './components/MeetingPhotoUploader';
import { useMeetingMinutes, useCreateMeetingMinutes, useUpdateMeetingMinutes } from './hooks/useMeetingMinutes';
import { useMeetingPhotos } from './hooks/useMeetingPhotos';
import { useMeeting, useDownloadMeetingPdf, useDownloadMeetingExcel } from './hooks/useMeeting';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Edit2, ArrowLeft, Pencil, FileText, FileSpreadsheet,
  MapPin, Clock, Users, CalendarDays, CheckCircle2, XCircle,
} from 'lucide-react';
import { useNavigate as useNav } from 'react-router-dom';

const statusColor: Record<string, string> = {
  upcoming: 'bg-blue-100 text-blue-700 border-blue-200',
  ongoing: 'bg-green-100 text-green-700 border-green-200',
  completed: 'bg-slate-100 text-slate-600 border-slate-200',
};
const statusLabel: Record<string, string> = {
  upcoming: 'Akan Datang',
  ongoing: 'Berlangsung',
  completed: 'Selesai',
};

export const MeetingDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const meetingId = id ? parseInt(id) : null;

  const [isEditingMinutes, setIsEditingMinutes] = useState(false);
  const [showPhotoUploader, setShowPhotoUploader] = useState(false);

  const user = (() => {
    try { return JSON.parse(localStorage.getItem('user_data') || '{}'); } catch { return {}; }
  })();
  const isAdmin = ['super_admin', 'admin_yayasan'].includes(user?.role);

  // Queries
  const { data: meeting, isLoading: meetingLoading } = useMeeting(meetingId);
  const minutesQuery = useMeetingMinutes(meetingId);
  const photosQuery = useMeetingPhotos(meetingId);

  // Mutations
  const createMinutesMutation = useCreateMeetingMinutes();
  const updateMinutesMutation = useUpdateMeetingMinutes();
  const downloadPdfMutation = useDownloadMeetingPdf();
  const downloadExcelMutation = useDownloadMeetingExcel();

  if (!meetingId) {
    return <div className="p-4 text-red-600">Invalid meeting ID</div>;
  }

  const handleSaveMinutes = (content: string) => {
    if (minutesQuery.data) {
      updateMinutesMutation.mutate(
        { meetingId, payload: { content } },
        { onSuccess: () => setIsEditingMinutes(false) }
      );
    } else {
      createMinutesMutation.mutate(
        { meeting_id: meetingId, content },
        { onSuccess: () => setIsEditingMinutes(false) }
      );
    }
  };

  if (meetingLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/meetings')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-800">
                {meeting?.title ?? 'Detail Rapat'}
              </h1>
              {meeting && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${statusColor[meeting.status]}`}>
                  {statusLabel[meeting.status]}
                </span>
              )}
            </div>
            {meeting && (
              <p className="text-sm text-slate-500 mt-1">
                Dibuat oleh {meeting.created_by_name} ·{' '}
                {format(new Date(meeting.created_at), 'dd MMM yyyy', { locale: idLocale })}
              </p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        {isAdmin && meeting && (
          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/dashboard/meetings/${meetingId}/edit`)}
            >
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadExcelMutation.mutate(meetingId)}
              disabled={downloadExcelMutation.isPending}
            >
              <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
              {downloadExcelMutation.isPending ? 'Mengunduh...' : 'Excel'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadPdfMutation.mutate(meetingId)}
              disabled={downloadPdfMutation.isPending}
            >
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              {downloadPdfMutation.isPending ? 'Mengunduh...' : 'PDF'}
            </Button>
          </div>
        )}
      </div>

      {/* Meeting Info Card */}
      {meeting && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-slate-500">Waktu Mulai</p>
                  <p className="font-medium">{format(new Date(meeting.started_at), 'dd MMM yyyy, HH:mm', { locale: idLocale })}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-slate-500">Waktu Selesai</p>
                  <p className="font-medium">{format(new Date(meeting.ended_at), 'dd MMM yyyy, HH:mm', { locale: idLocale })}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-slate-500">Lokasi</p>
                  <p className="font-medium">{meeting.location}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Users className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-slate-500">Kehadiran</p>
                  <p className="font-medium">
                    {meeting.attendance_stats?.present ?? 0}/{meeting.attendance_stats?.total ?? 0}
                    {' '}
                    <span className="text-emerald-600">({meeting.attendance_stats?.percentage ?? 0}%)</span>
                  </p>
                </div>
              </div>
            </div>
            {meeting.agenda && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-xs text-slate-500 mb-1">Agenda</p>
                <p className="text-sm text-slate-700 whitespace-pre-line">{meeting.agenda}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="attendance" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="attendance">Kehadiran</TabsTrigger>
          <TabsTrigger value="minutes">Notulensi</TabsTrigger>
          <TabsTrigger value="photos">Foto Kegiatan</TabsTrigger>
        </TabsList>

        {/* Attendance Tab */}
        <TabsContent value="attendance" className="space-y-4">
          {meeting && meeting.participants && meeting.participants.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Daftar Peserta</span>
                  <span className="text-sm font-normal text-slate-500">
                    {meeting.attendance_stats?.present ?? 0} hadir dari {meeting.attendance_stats?.total ?? 0} peserta
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {meeting.participants.map((participant) => (
                    <div key={participant.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="font-medium text-sm">{participant.name}</p>
                        <p className="text-xs text-slate-500">{participant.jabatan} · {participant.instansi}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {participant.attendance ? (
                          <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Hadir · {format(new Date(participant.attendance.checked_in_at), 'HH:mm')}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            <XCircle className="h-3.5 w-3.5" />
                            Belum hadir
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="p-8 text-center text-slate-400">
              <Users className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p>Belum ada peserta terdaftar</p>
            </div>
          )}
        </TabsContent>

        {/* Minutes Tab */}
        <TabsContent value="minutes" className="space-y-4">
          {isEditingMinutes ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Edit Notulensi</h3>
                <Button variant="outline" onClick={() => setIsEditingMinutes(false)}>Batal</Button>
              </div>
              <MeetingMinutesEditor
                initialContent={minutesQuery.data?.content || ''}
                onSave={handleSaveMinutes}
                isSaving={createMinutesMutation.isPending || updateMinutesMutation.isPending}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Notulensi Rapat</h3>
                {isAdmin && (
                  <Button onClick={() => setIsEditingMinutes(true)} className="bg-blue-600 hover:bg-blue-700">
                    <Edit2 className="w-4 h-4 mr-2" />
                    {minutesQuery.data ? 'Edit' : 'Buat'} Notulensi
                  </Button>
                )}
              </div>
              <MeetingMinutesView minutes={minutesQuery.data || null} isLoading={minutesQuery.isLoading} />
            </div>
          )}
        </TabsContent>

        {/* Photos Tab */}
        <TabsContent value="photos" className="space-y-4">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Foto Kegiatan</h3>
              {isAdmin && !showPhotoUploader && (
                <Button onClick={() => setShowPhotoUploader(true)} className="bg-blue-600 hover:bg-blue-700">
                  <Edit2 className="w-4 h-4 mr-2" />
                  Unggah Foto
                </Button>
              )}
            </div>
            {showPhotoUploader && (
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg border">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium">Unggah Foto Baru</h4>
                  <Button variant="outline" size="sm" onClick={() => setShowPhotoUploader(false)}>Tutup</Button>
                </div>
                <MeetingPhotoUploader
                  meetingId={meetingId}
                  onUploadComplete={() => { setShowPhotoUploader(false); photosQuery.refetch(); }}
                />
              </div>
            )}
            <MeetingPhotoGallery
              photos={photosQuery.data || []}
              meetingId={meetingId}
              isLoading={photosQuery.isLoading}
              canDelete={isAdmin}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
