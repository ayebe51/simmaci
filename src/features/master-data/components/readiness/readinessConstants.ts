import { SchoolReadinessItem } from '@/lib/api';

export const CILACAP_KECAMATAN = [
  'Dayeuhluhur',
  'Wanareja',
  'Majenang',
  'Cimanggu',
  'Karangpucung',
  'Sidareja',
  'Gandrungmangu',
  'Kedungreja',
  'Patimuan',
  'Cipari',
  'Bantarsari',
  'Kawunganten',
  'Kampung Laut',
  'Jeruklegi',
  'Kesugihan',
  'Adipala',
  'Maos',
  'Sampang',
  'Kroya',
  'Binangun',
  'Nusawungu',
  'Cilacap Selatan',
  'Cilacap Tengah',
  'Cilacap Utara',
];

export const JENJANG_LIST = ['MI', 'MTs', 'MA', 'SMK'];

/**
 * Formal grade levels for LP Ma'arif madrasahs (MI, MTs, MA, SMK).
 * Note: RA/PAUD/TK is excluded from formal per-class student reporting.
 */
export const FORMAL_GRADE_LEVELS: Record<string, string[]> = {
  MI: ['Kelas 1', 'Kelas 2', 'Kelas 3', 'Kelas 4', 'Kelas 5', 'Kelas 6'],
  SD: ['Kelas 1', 'Kelas 2', 'Kelas 3', 'Kelas 4', 'Kelas 5', 'Kelas 6'],
  MTS: ['Kelas 7', 'Kelas 8', 'Kelas 9'],
  SMP: ['Kelas 7', 'Kelas 8', 'Kelas 9'],
  MA: ['Kelas 10', 'Kelas 11', 'Kelas 12'],
  SMA: ['Kelas 10', 'Kelas 11', 'Kelas 12'],
  SMK: ['Kelas 10', 'Kelas 11', 'Kelas 12'],
};

/**
 * Resolves list of grade levels for a given school jenjang/nama.
 * Returns null if jenjang is RA/TK/PAUD or non-formal.
 */
export function getGradeLevelsForSchool(jenjang?: string | null, nama?: string | null): string[] | null {
  const rawJenjang = (jenjang || '').toUpperCase().trim();
  const rawNama = (nama || '').toUpperCase().trim();

  // Exclude RA / TK / PAUD
  if (
    rawJenjang === 'RA' ||
    rawJenjang === 'TK' ||
    rawJenjang === 'PAUD' ||
    rawJenjang === 'BA' ||
    rawNama.startsWith('RA ') ||
    rawNama.startsWith('TK ') ||
    rawNama.startsWith('PAUD ') ||
    rawNama.startsWith('BA ')
  ) {
    return null;
  }

  if (rawJenjang.includes('SMK') || rawNama.includes('SMK')) {
    return FORMAL_GRADE_LEVELS.SMK;
  }
  if (rawJenjang.includes('MI') || rawNama.includes('MI ') || rawNama.includes('SD ')) {
    return FORMAL_GRADE_LEVELS.MI;
  }
  if (rawJenjang.includes('MTS') || rawNama.includes('MTS ') || rawNama.includes('SMP ')) {
    return FORMAL_GRADE_LEVELS.MTS;
  }
  if (rawJenjang.includes('MA') || rawNama.includes('MA ') || rawNama.includes('SMA ')) {
    return FORMAL_GRADE_LEVELS.MA;
  }

  // Default fallback for formal primary madrasah
  return FORMAL_GRADE_LEVELS.MI;
}

/**
 * Normalizes phone number to international WhatsApp format (e.g. 0812 -> 62812)
 */
export function normalizeWhatsappNumber(phone?: string | null): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/\D/g, '');
  if (!cleaned) return null;
  if (cleaned.startsWith('0')) {
    return '62' + cleaned.slice(1);
  }
  if (cleaned.startsWith('62')) {
    return cleaned;
  }
  return '62' + cleaned;
}

/**
 * Generates official polite WhatsApp reminder message for school heads/operators
 */
export function generateWaMessage(school: SchoolReadinessItem): string {
  let deficiencyText = '';
  if (school.completeness_status === 'empty') {
    deficiencyText = 'data Guru dan data Siswa belum terdata sama sekali';
  } else if (school.completeness_status === 'teachers_only') {
    deficiencyText = `data Guru telah terdata (${school.teachers_count} orang), namun data Siswa masih kosong (0 siswa)`;
  } else if (school.completeness_status === 'students_only') {
    deficiencyText = `data Siswa telah terdata (${school.effective_students_count} siswa), namun data Guru/Tendik belum diinput`;
  } else {
    deficiencyText = 'kelengkapan data madrasah';
  }

  return `Assalamu'alaikum Wr. Wb.

Yth. Kepala Madrasah / Operator ${school.nama},
Kecamatan ${school.kecamatan || '-'}

Kami dari Pengurus Cabang Lembaga Pendidikan Ma'arif NU Kabupaten Cilacap menginformasikan bahwa berdasarkan sistem SIMMACI, ${deficiencyText}.

Mohon perkenan Bapak/Ibu Kepala Madrasah atau Operator untuk segera melengkapi data tersebut melalui SIMMACI:
- Alamat Sistem: https://simmaci.com
- Jika data siswa per individu belum selesai diinput, Bapak/Ibu dapat mengisi "Estimasi Jumlah Siswa Per Kelas" pada Profil Lembaga.

Demikian pengingat ini kami sampaikan untuk kelancaran pendataan dan peta sebaran pendidikan Ma'arif NU Cilacap. Terima kasih atas kerja samanya.

Wassalamu'alaikum Wr. Wb.
PC LP Ma'arif NU Cilacap`;
}
