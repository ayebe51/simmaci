/**
 * MeetingDetailPage Component
 * Display meeting details with tabs for attendance, minutes, and photos
 * 
 * Note: This is a stub implementation for Tasks 19-21
 * Full implementation will be completed in Task 10
 */

import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MeetingMinutesEditor } from './components/MeetingMinutesEditor';
import { MeetingMinutesView } from './components/MeetingMinutesView';
import { MeetingPhotoGallery } from './components/MeetingPhotoGallery';
import { MeetingPhotoUploader } from './components/MeetingPhotoUploader';
import { useMeetingMinutes, useCreateMeetingMinutes, useUpdateMeetingMinutes } from './hooks/useMeetingMinutes';
import { useMeetingPhotos } from './hooks/useMeetingPhotos';
import { Button } from '@/components/ui/button';
import { Edit2, Save } from 'lucide-react';

export const MeetingDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const meetingId = id ? parseInt(id) : null;

  const [isEditingMinutes, setIsEditingMinutes] = useState(false);
  const [showPhotoUploader, setShowPhotoUploader] = useState(false);

  // Queries
  const minutesQuery = useMeetingMinutes(meetingId);
  const photosQuery = useMeetingPhotos(meetingId);

  // Mutations
  const createMinutesMutation = useCreateMeetingMinutes();
  const updateMinutesMutation = useUpdateMeetingMinutes();

  if (!meetingId) {
    return <div className="p-4 text-red-600">Invalid meeting ID</div>;
  }

  const handleSaveMinutes = (content: string) => {
    if (minutesQuery.data) {
      updateMinutesMutation.mutate(
        { meetingId, payload: { content } },
        {
          onSuccess: () => {
            setIsEditingMinutes(false);
          },
        }
      );
    } else {
      createMinutesMutation.mutate(
        { meeting_id: meetingId, content },
        {
          onSuccess: () => {
            setIsEditingMinutes(false);
          },
        }
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <Tabs defaultValue="attendance" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="attendance">Kehadiran</TabsTrigger>
          <TabsTrigger value="minutes">Notulensi</TabsTrigger>
          <TabsTrigger value="photos">Foto Kegiatan</TabsTrigger>
        </TabsList>

        {/* Attendance Tab */}
        <TabsContent value="attendance" className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              Tab Kehadiran akan menampilkan daftar peserta dan status kehadiran mereka.
              Implementasi lengkap tersedia di Task 10.
            </p>
          </div>
        </TabsContent>

        {/* Minutes Tab */}
        <TabsContent value="minutes" className="space-y-4">
          {isEditingMinutes ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Edit Notulensi</h3>
                <Button
                  variant="outline"
                  onClick={() => setIsEditingMinutes(false)}
                >
                  Batal
                </Button>
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
                <Button
                  onClick={() => setIsEditingMinutes(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  {minutesQuery.data ? 'Edit' : 'Buat'} Notulensi
                </Button>
              </div>
              <MeetingMinutesView
                minutes={minutesQuery.data || null}
                isLoading={minutesQuery.isLoading}
              />
            </div>
          )}
        </TabsContent>

        {/* Photos Tab */}
        <TabsContent value="photos" className="space-y-4">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Foto Kegiatan</h3>
              {!showPhotoUploader && (
                <Button
                  onClick={() => setShowPhotoUploader(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  Unggah Foto
                </Button>
              )}
            </div>

            {showPhotoUploader && (
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg border">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium">Unggah Foto Baru</h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPhotoUploader(false)}
                  >
                    Tutup
                  </Button>
                </div>
                <MeetingPhotoUploader
                  meetingId={meetingId}
                  onUploadComplete={() => {
                    setShowPhotoUploader(false);
                    photosQuery.refetch();
                  }}
                />
              </div>
            )}

            <MeetingPhotoGallery
              photos={photosQuery.data || []}
              meetingId={meetingId}
              isLoading={photosQuery.isLoading}
              canDelete={true}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
