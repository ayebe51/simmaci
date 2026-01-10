import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, CheckCircle } from 'lucide-react';

interface NIKInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
}

// Indonesian province codes (first 2 digits of NIK)
const PROVINCE_CODES: Record<string, string> = {
  '11': 'Aceh',
  '12': 'Sumatra Utara',
  '13': 'Sumatra Barat',
  '14': 'Riau',
  '15': 'Jambi',
  '16': 'Sumatra Selatan',
  '17': 'Bengkulu',
  '18': 'Lampung',
  '19': 'Kepulauan Bangka Belitung',
  '21': 'Kepulauan Riau',
  '31': 'DKI Jakarta',
  '32': 'Jawa Barat',
  '33': 'Jawa Tengah',
  '34': 'DI Yogyakarta',
  '35': 'Jawa Timur',
  '36': 'Banten',
  '51': 'Bali',
  '52': 'Nusa Tenggara Barat',
  '53': 'Nusa Tenggara Timur',
  '61': 'Kalimantan Barat',
  '62': 'Kalimantan Tengah',
  '63': 'Kalimantan Selatan',
  '64': 'Kalimantan Timur',
  '65': 'Kalimantan Utara',
  '71': 'Sulawesi Utara',
  '72': 'Sulawesi Tengah',
  '73': 'Sulawesi Selatan',
  '74': 'Sulawesi Tenggara',
  '75': 'Gorontalo',
  '76': 'Sulawesi Barat',
  '81': 'Maluku',
  '82': 'Maluku Utara',
  '91': 'Papua Barat',
  '94': 'Papua',
};

/**
 * NIK input with Indonesian NIK validation (warning only, doesn't block)
 */
export const NIKInput: React.FC<NIKInputProps> = ({
  label = 'NIK',
  value,
  onChange,
  required = false,
  className = '',
}) => {
  const [warning, setWarning] = useState('');
  const [province, setProvince] = useState('');

  useEffect(() => {
    if (!value) {
      setWarning('');
      setProvince('');
      return;
    }

    // Must be exactly 16 digits
    if (!/^[0-9]{16}$/.test(value)) {
      setWarning('NIK harus 16 digit angka');
      setProvince('');
      return;
    }

    // Check province code (first 2 digits)
    const provinceCode = value.substring(0, 2);
    const provinceName = PROVINCE_CODES[provinceCode];

    if (!provinceName) {
      setWarning(`Kode provinsi ${provinceCode} tidak valid`);
      setProvince('');
    } else {
      setWarning('');
      setProvince(provinceName);
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow numbers, max 16 digits
    const cleaned = e.target.value.replace(/\D/g, '').substring(0, 16);
    onChange(cleaned);
  };

  const isValid = value.length === 16 && province && !warning;

  return (
    <div className={className}>
      {label && (
        <Label htmlFor="nik-input">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}
      <Input
        id="nik-input"
        type="text"
        value={value}
        onChange={handleChange}
        placeholder="16 digit NIK"
        maxLength={16}
        className={warning ? 'border-yellow-500' : isValid ? 'border-green-500' : ''}
      />
      {warning && (
        <div className="flex items-center gap-1 mt-1 text-sm text-yellow-600">
          <AlertCircle className="h-3 w-3" />
          <span>{warning}</span>
        </div>
      )}
      {isValid && (
        <div className="flex items-center gap-1 mt-1 text-sm text-green-600">
          <CheckCircle className="h-3 w-3" />
          <span>Provinsi: {province}</span>
        </div>
      )}
      <p className="text-xs text-gray-500 mt-1">
        Nomor Induk Kependudukan (16 digit)
      </p>
    </div>
  );
};
