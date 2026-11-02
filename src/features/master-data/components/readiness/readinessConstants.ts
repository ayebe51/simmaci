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

export const JENJANG_GROUPS = {
  MI_SD: 'MI / SD',
  MTS_SMP: 'MTs / SMP',
  MA_SMK_SMA: 'MA / SMK / SMA',
} as const;

export const JENJANG_LIST = [
  'MI / SD',
  'MTs / SMP',
  'MA / SMK / SMA',
];

/**
 * Formal grade levels for LP Ma'arif madrasahs.
 * Unified groups:
 * - MI / SD: Kelas 1 s.d. 6
 * - MTs / SMP: Kelas 7 s.d. 9
 * - MA / SMK / SMA: Kelas 10 s.d. 12
 */
export const FORMAL_GRADE_LEVELS: Record<string, string[]> = {
  'MI / SD': ['Kelas 1', 'Kelas 2', 'Kelas 3', 'Kelas 4', 'Kelas 5', 'Kelas 6'],
  'MTs / SMP': ['Kelas 7', 'Kelas 8', 'Kelas 9'],
  'MA / SMK / SMA': ['Kelas 10', 'Kelas 11', 'Kelas 12'],
  MI: ['Kelas 1', 'Kelas 2', 'Kelas 3', 'Kelas 4', 'Kelas 5', 'Kelas 6'],
  SD: ['Kelas 1', 'Kelas 2', 'Kelas 3', 'Kelas 4', 'Kelas 5', 'Kelas 6'],
  MTS: ['Kelas 7', 'Kelas 8', 'Kelas 9'],
  SMP: ['Kelas 7', 'Kelas 8', 'Kelas 9'],
  MA: ['Kelas 10', 'Kelas 11', 'Kelas 12'],
  SMA: ['Kelas 10', 'Kelas 11', 'Kelas 12'],
  SMK: ['Kelas 10', 'Kelas 11', 'Kelas 12'],
};

/**
 * Resolves standard 3-tier jenjang label from school jenjang or name.
 * Uses strict word-boundary matching and negative lookaheads to prevent false positives
 * (e.g. 'Al Jawami' matching 'MI', or 'Ma\'arif' matching 'MA').
 */
export function resolveSchoolJenjang(jenjang?: string | null, nama?: string | null): string {
  const rawJenjang = (jenjang || '').toUpperCase().trim();
  const rawNama = (nama || '').trim();

  // 1. If jenjang is explicitly defined, resolve directly from jenjang
  if (rawJenjang && rawJenjang !== 'LAINNYA' && rawJenjang !== '-' && rawJenjang !== 'UNDEFINED' && rawJenjang !== 'NULL') {
    if (['RA', 'TK', 'PAUD', 'BA'].includes(rawJenjang) || rawJenjang.includes('RA') || rawJenjang.includes('TK')) {
      return 'RA / TK';
    }
    if (['MTS', 'SMP'].includes(rawJenjang) || rawJenjang.includes('MTS') || rawJenjang.includes('SMP')) {
      return 'MTs / SMP';
    }
    if (['MA', 'SMA', 'SMK'].includes(rawJenjang) || rawJenjang.includes('SMK') || rawJenjang.includes('SMA') || rawJenjang.includes('MA')) {
      return 'MA / SMK / SMA';
    }
    if (['MI', 'SD'].includes(rawJenjang) || rawJenjang.includes('MI') || rawJenjang.includes('SD')) {
      return 'MI / SD';
    }
  }

  // 2. If jenjang is empty/unassigned, inspect school name
  if (rawNama) {
    if (/\b(ra|tk|paud|ba)\b|raudhatul|bustanul/i.test(rawNama)) {
      return 'RA / TK';
    }
    if (/\b(mts|smp|tsanawiyah)\b/i.test(rawNama)) {
      return 'MTs / SMP';
    }
    if (/\b(mi|sd|ibtidaiyah)\b/i.test(rawNama)) {
      return 'MI / SD';
    }
    if (/\b(smk|sma|aliyah|kejuruan)\b/i.test(rawNama) || /\bma\b(?!['’]?arif)/i.test(rawNama)) {
      return 'MA / SMK / SMA';
    }
  }

  return 'MI / SD';
}

/**
 * Resolves list of grade levels for a given school jenjang/nama.
 * Returns null if jenjang is RA/TK/PAUD or non-formal.
 */
export function getGradeLevelsForSchool(jenjang?: string | null, nama?: string | null): string[] | null {
  const tier = resolveSchoolJenjang(jenjang, nama);
  if (tier === 'RA / TK') {
    return null;
  }
  return FORMAL_GRADE_LEVELS[tier] || FORMAL_GRADE_LEVELS['MI / SD'];
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
