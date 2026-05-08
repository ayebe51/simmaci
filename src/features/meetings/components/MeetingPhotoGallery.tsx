/**
 * MeetingPhotoGallery Component
 * Display meeting photos in a gallery with lightbox
 */

import React, { useState } from 'react';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';
import { MeetingPhoto } from '../types/meeting.types';
import { meetingPhotoService } from '../services/meetingPhotoService';
import { Button } from '@/components/ui/button';
import { Download, Trash2, Image as ImageIcon } from 'lucide-react';
import { useDeleteMeetingPhoto, useDownloadPhotosAsZip } from '../hooks/useMeetingPhotos';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface MeetingPhotoGalleryProps {
  photos: MeetingPhoto[];
  meetingId: number;
  isLoading?: boolean;
  canDelete?: boolean;
}

export const MeetingPhotoGallery: React.FC<MeetingPhotoGalleryProps> = ({
  photos,
  meetingId,
  isLoading = false,
  canDelete = false,
}) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [deletePhotoId, setDeletePhotoId] = useState<number | null>(null);

  const deletePhotoMutation = useDeleteMeetingPhoto();
  const downloadZipMutation = useDownloadPhotosAsZip();

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-2 text-gray-600">Memuat foto...</p>
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="p-8 text-center bg-gray-50 rounded-lg border border-dashed">
        <ImageIcon className="w-12 h-12 mx-auto text-gray-400 mb-3" />
        <p className="text-gray-600">Belum ada foto untuk rapat ini</p>
      </div>
    );
  }

  const slides = photos.map((photo) => ({
    src: meetingPhotoService.getFileUrl(photo.file_path),
    title: photo.caption || `Foto ${photo.id}`,
  }));

  const handleDeletePhoto = (photoId: number) => {
    deletePhotoMutation.mutate(
      { meetingId, photoId },
      {
        onSuccess: () => {
          setDeletePhotoId(null);
        },
      }
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">
          Total foto: <span className="font-medium">{photos.length}</span>
        </p>
        {photos.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => downloadZipMutation.mutate(meetingId)}
            disabled={downloadZipMutation.isPending}
          >
            <Download className="w-4 h-4 mr-2" />
            Unduh Semua
          </Button>
        )}
      </div>

      {/* Gallery Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {photos.map((photo, index) => (
          <div
            key={photo.id}
            className="relative group rounded-lg overflow-hidden bg-gray-100 aspect-square cursor-pointer"
            onClick={() => {
              setLightboxIndex(index);
              setLightboxOpen(true);
            }}
          >
            {/* Image */}
            <img
              src={meetingPhotoService.getThumbnailUrl(photo.thumbnail_path) || meetingPhotoService.getFileUrl(photo.file_path)}
              alt={photo.caption || `Foto ${photo.id}`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            />

            {/* Overlay */}
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-200 flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-2">
                {canDelete && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletePhotoId(photo.id);
                    }}
                    disabled={deletePhotoMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Caption Badge */}
            {photo.caption && (
              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-2 truncate">
                {photo.caption}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox */}
      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        slides={slides}
        index={lightboxIndex}
        on={{
          view: ({ index }) => setLightboxIndex(index),
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deletePhotoId !== null} onOpenChange={(open) => !open && setDeletePhotoId(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Hapus Foto</AlertDialogTitle>
          <AlertDialogDescription>
            Apakah Anda yakin ingin menghapus foto ini? Tindakan ini tidak dapat dibatalkan.
          </AlertDialogDescription>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletePhotoId && handleDeletePhoto(deletePhotoId)}
              className="bg-red-600 hover:bg-red-700"
            >
              Hapus
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
