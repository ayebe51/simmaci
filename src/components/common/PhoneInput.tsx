import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle } from 'lucide-react';

interface PhoneInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  className?: string;
}

/**
 * Phone input with Indonesian format validation
 * Auto-converts +62 or 62 to 08
 */
export const PhoneInput: React.FC<PhoneInputProps> = ({
  label = 'No. HP',
  value,
  onChange,
  error: externalError,
  required = false,
  className = '',
}) => {
  const [internalError, setInternalError] = useState('');

  const validateAndFormat = (input: string) => {
    if (!input) {
      setInternalError('');
      return '';
    }

    // Remove all non-digit characters
    let cleaned = input.replace(/\D/g, '');

    // Convert +62 or 62 to 08
    if (cleaned.startsWith('62')) {
      cleaned = '0' + cleaned.substring(2);
    }

    // Validate format: 08[0-9]{8,11}
    if (cleaned && !cleaned.startsWith('08')) {
      setInternalError('Nomor HP harus dimulai dengan 08');
    } else if (cleaned.length > 13) {
      setInternalError('Nomor HP maksimal 13 digit');
      cleaned = cleaned.substring(0, 13);
    } else if (cleaned.length > 0 && cleaned.length < 10) {
      setInternalError('Nomor HP minimal 10 digit');
    } else {
      setInternalError('');
    }

    return cleaned;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = validateAndFormat(e.target.value);
    onChange(formatted);
  };

  const displayError = externalError || internalError;

  return (
    <div className={className}>
      {label && (
        <Label htmlFor="phone-input">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}
      <Input
        id="phone-input"
        type="tel"
        value={value}
        onChange={handleChange}
        placeholder="08xxxxxxxxxx"
        className={displayError ? 'border-red-500' : ''}
      />
      {displayError && (
        <div className="flex items-center gap-1 mt-1 text-sm text-red-500">
          <AlertCircle className="h-3 w-3" />
          <span>{displayError}</span>
        </div>
      )}
      <p className="text-xs text-gray-500 mt-1">
        Format: 08xxxxxxxxxx (10-13 digit)
      </p>
    </div>
  );
};
