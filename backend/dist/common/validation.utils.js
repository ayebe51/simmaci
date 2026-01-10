const PROVINCE_CODES = {
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
export function validatePhoneNumber(phone) {
    if (!phone) {
        return { isValid: false, normalized: '', error: 'Nomor HP wajib diisi' };
    }
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('62')) {
        cleaned = '0' + cleaned.substring(2);
    }
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
export function validateNIK(nik) {
    if (!nik) {
        return { isValid: true, warning: 'NIK kosong' };
    }
    if (!/^[0-9]{16}$/.test(nik)) {
        return {
            isValid: true,
            warning: 'NIK harus 16 digit angka',
        };
    }
    const provinceCode = nik.substring(0, 2);
    const province = PROVINCE_CODES[provinceCode];
    if (!province) {
        return {
            isValid: true,
            warning: `Kode provinsi ${provinceCode} tidak valid`,
        };
    }
    return {
        isValid: true,
        province: province,
    };
}
export function isValidPhoneNumber(phone) {
    const result = validatePhoneNumber(phone);
    return result.isValid;
}
export function normalizePhoneNumber(phone) {
    if (!phone)
        return '';
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('62')) {
        cleaned = '0' + cleaned.substring(2);
    }
    return cleaned;
}
//# sourceMappingURL=validation.utils.js.map