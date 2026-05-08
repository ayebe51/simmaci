/**
 * MeetingPhotoUploader Component
 * Upload photos for a meeting with drag-and-drop support
 */

import React, { useCallback, useState } from 'react';
import { useUploadMeetingPhotos } from '../hooks/useMeetingPhotos';
import { Button } from '@/components/ui/button';
import { Upload, X } from 'lucide-react';
import { toast } from 'sonner';

interface MeetingPhotoUploaderProps {
  meetingId: number;
  onUploadComplete?: () => void;
}

interface FileWithCaption {
  file: File;
  caption: string;
}

export const MeetingPhotoUploader: React.FC<MeetingPhotoUploaderProps> = ({
  meetingId,
  onUploadComplete,
}) => {
  const [files, setFiles] = useState<FileWithCaption[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const uploadMutation = useUploadMeetingPhotos();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter((file) =>
      file.type.startsWith('image/')
    );

    if (droppedFiles.length === 0) {
      toast.error('Hanya file gambar yang diperbolehkan');
      return;
    }

    addFiles(droppedFiles);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    addFiles(selectedFiles);
  }, []);

  const addFiles = (newFiles: File[]) => {
    const validFiles = newFiles.filter((file) => {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} bukan file gambar`);
        return false;
      }
      if (file.size > 10 * 1024 * 1024) {
        // 10MB limit
        toast.error(`${file.name} terlalu besar (max 10MB)`);
        return false;
      }
      return true;
    });

    setFiles((prev) => [
      ...prev,
      ...validFiles.map((file) => ({
        file,
        caption: '',
      })),
    ]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const updateCaption = (index: number, caption: string) => {
    setFiles((prev) => {
      const updated = [...prev];
      updated[index].caption = caption;
      return updated;
    });
  };

  const handleUpload = () => {
    if (files.length === 0) {
      toast.error('Pilih minimal satu foto');
      return;
    }

    uploadMutation.mutate(
      {
        meetingId,
        files: files.map((f) => f.file),
        captions: files.map((f) => f.caption),
      },
      {
        onSuccess: () => {
          setFiles([]);
          onUploadComplete?.();
        },
      }
    );
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-gray-50 hover:border-gray-400'
        }`}
      >
        <Upload className="w-12 h-12 mx-auto text-gray-400 mb-3" />
        <p className="text-gray-700 font-medium mb-1">Seret foto ke sini atau klik untuk memilih</p>
        <p className="text-sm text-gray-500 mb-4">Format: JPG, PNG, GIF (max 10MB per file)</p>
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
          id="photo-input"
        />
        <label htmlFor="photo-input">
          <Button asChild variant="outline" className="cursor-pointer">
            <span>Pilih Foto</span>
          </Button>
        </label>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700">
            {files.length} foto dipilih
          </p>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {files.map((item, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border"
              >
                {/* Thumbnail */}
                <div className="flex-shrink-0">
                  <img
                    src={URL.createObjectURL(item.file)}
                    alt={item.file.name}
                    className="w-12 h-12 object-cover rounded"
                  />
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {item.file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {(item.file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <input
                    type="text"
                    placeholder="Tambahkan keterangan (opsional)"
                    value={item.caption}
                    onChange={(e) => updateCaption(index, e.target.value)}
                    className="mt-2 w-full px-2 py-1 text-xs border rounded bg-white"
                  />
                </div>

                {/* Remove Button */}
                <button
                  onClick={() => removeFile(index)}
                  className="flex-shrink-0 p-1 text-gray-400 hover:text-red-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end pt-2">
            <Button
              variant="outline"
              onClick={() => setFiles([])}
              disabled={uploadMutation.isPending}
            >
              Batal
            </Button>
            <Button
              onClick={handleUpload}
              disabled={uploadMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {uploadMutation.isPending ? 'Mengunggah...' : `Unggah ${files.length} Foto`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
