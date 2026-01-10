/**
 * Validation utilities for data cleansing
 */

// Indonesian province codes (first 2 digits of NIK)
const PROVINCE_CODES: Record<string, string> = {
  '11': 'Aceh',
  '12': 'Sumatera Utara',
  '13': 'Sumatera Barat',
  '14': 'Riau',
  '15': 'Jambi',
  '16': 'Sumatera Selatan',
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

interface PhoneValidationResult {
  isValid: boolean;
  normalized: string;
  error?: string;
}

interface NIKValidationResult {
  isValid: boolean;
  error?: string;
  warning?: string;
  province?: string;
}

/**
 * Validate and normalize Indonesian phone number
 * Accepts: 08xxx, +62xxx, 62xxx
 * Returns: 08xxxxxxxxxx (standardized format)
 */
export function validatePhoneNumber(phone: string): PhoneValidationResult {
  if (!phone) {
    return { isValid: false, normalized: '', error: 'Nomor HP wajib diisi' };
  }

  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');

  // Convert +62 or 62 to 08
  if (cleaned.startsWith('62')) {
    cleaned = '0' + cleaned.substring(2);
  }

  // Check format: 08[0-9]{8,11}
  // Total length: 10-13 digits (08 + 8-11 digits)
  const phoneRegex = /^08[0-9]{8,11}$/;

  if (!phoneRegex.test(cleaned)) {
    return {
      isValid: false,
      normalized: cleaned,
      error: 'Format harus 08xxxxxxxxxx (10-13 digit)',
    };
  }

  return { isValid: true, normalized: cleaned };
}

/**
 * Validate Indonesian NIK (Nomor Induk Kependudukan)
 * Format: 16 digits with valid province code
 */
export function validateNIK(nik: string): NIKValidationResult {
  if (!nik) {
    return { isValid: true, warning: 'NIK kosong' };
  }

  // Must be exactly 16 digits
  if (!/^[0-9]{16}$/.test(nik)) {
    return {
      isValid: true, // Don't block, just warn
      warning: 'NIK harus 16 digit angka',
    };
  }

  // Check province code (first 2 digits)
  const provinceCode = nik.substring(0, 2);
  const province = PROVINCE_CODES[provinceCode];

  if (!province) {
    return {
      isValid: true, // Don't block
      warning: `Kode provinsi ${provinceCode} tidak valid`,
    };
  }

  return {
    isValid: true,
    province: province,
  };
}

/**
 * Check if phone number is valid (for quick checks)
 */
export function isValidPhoneNumber(phone: string): boolean {
  const result = validatePhoneNumber(phone);
  return result.isValid;
}

/**
 * Normalize phone number without validation
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';

  let cleaned = phone.replace(/\D/g, '');

  if (cleaned.startsWith('62')) {
    cleaned = '0' + cleaned.substring(2);
  }

  return cleaned;
}
