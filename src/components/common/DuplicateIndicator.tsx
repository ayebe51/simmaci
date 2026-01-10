import React from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface DuplicateIndicatorProps {
  type?: 'NUPTK' | 'NIK' | 'NSM' | 'NPSN' | 'Name+School';
  count?: number;
  records?: Array<{
    id: string;
    nama: string;
    [key: string]: any;
  }>;
}

/**
 * Badge indicator for duplicate data
 */
export const DuplicateIndicator: React.FC<DuplicateIndicatorProps> = ({
  type,
  count = 0,
  records = [],
}) => {
  if (!type || count === 0) return null;

  const getMessage = () => {
    switch (type) {
      case 'NUPTK':
        return `Duplikat NUPTK (${count} data)`;
      case 'NIK':
        return `Duplikat NIK (${count} data)`;
      case 'NSM':
        return `Duplikat NSM (${count} data)`;
      case 'NPSN':
        return `Duplikat NPSN (${count} data)`;
      case 'Name+School':
        return `Duplikat Nama+Sekolah (${count} data)`;
      default:
        return `Duplikat (${count})`;
    }
  };

  const tooltipContent = (
    <div className="max-w-xs">
      <p className="font-semibold mb-1">{getMessage()}</p>
      <div className="space-y-1">
        {records.slice(0, 3).map((record) => (
          <p key={record.id} className="text-xs">
            • {record.nama}
          </p>
        ))}
        {records.length > 3 && (
          <p className="text-xs italic">
            +{records.length - 3} lainnya...
          </p>
        )}
      </div>
    </div>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Badge variant="destructive" className="ml-2">
            <AlertTriangle className="h-3 w-3 mr-1" />
            {type}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>{tooltipContent}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
