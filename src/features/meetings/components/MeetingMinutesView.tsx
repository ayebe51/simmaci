/**
 * MeetingMinutesView Component
 * Display meeting minutes in read-only mode
 */

import React from 'react';
import { MeetingMinutes } from '../types/meeting.types';
import { Button } from '@/components/ui/button';
import { Download, FileText } from 'lucide-react';
import { useExportMinutesPdf, useExportMinutesDocx } from '../hooks/useMeetingMinutes';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface MeetingMinutesViewProps {
  minutes: MeetingMinutes | null;
  isLoading?: boolean;
}

export const MeetingMinutesView: React.FC<MeetingMinutesViewProps> = ({
  minutes,
  isLoading = false,
}) => {
  const exportPdfMutation = useExportMinutesPdf();
  const exportDocxMutation = useExportMinutesDocx();

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-2 text-gray-600">Memuat notulensi...</p>
      </div>
    );
  }

  if (!minutes) {
    return (
      <div className="p-8 text-center bg-gray-50 rounded-lg border border-dashed">
        <FileText className="w-12 h-12 mx-auto text-gray-400 mb-3" />
        <p className="text-gray-600">Belum ada notulensi untuk rapat ini</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm text-gray-600">
            Dibuat oleh <span className="font-medium">{minutes.created_by_name}</span> pada{' '}
            <span className="font-medium">
              {format(new Date(minutes.created_at), 'dd MMMM yyyy HH:mm', { locale: idLocale })}
            </span>
          </p>
          {minutes.updated_by_name && (
            <p className="text-sm text-gray-600 mt-1">
              Diperbarui oleh <span className="font-medium">{minutes.updated_by_name}</span> pada{' '}
              <span className="font-medium">
                {format(new Date(minutes.updated_at), 'dd MMMM yyyy HH:mm', { locale: idLocale })}
              </span>
            </p>
          )}
        </div>

        {/* Export Buttons */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => exportPdfMutation.mutate(minutes.meeting_id)}
            disabled={exportPdfMutation.isPending}
          >
            <Download className="w-4 h-4 mr-2" />
            PDF
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => exportDocxMutation.mutate(minutes.meeting_id)}
            disabled={exportDocxMutation.isPending}
          >
            <Download className="w-4 h-4 mr-2" />
            DOCX
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white border rounded-lg p-6 prose prose-sm max-w-none">
        <div dangerouslySetInnerHTML={{ __html: minutes.content }} />
      </div>
    </div>
  );
};
