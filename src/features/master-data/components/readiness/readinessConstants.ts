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

export const JENJANG_LIST = ['RA', 'MI', 'MTs', 'MA', 'SMK'];

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
- Jika data siswa per individu belum selesai diinput, Bapak/Ibu dapat mengisi "Estimasi Jumlah Siswa" terlebih dahulu pada Profil Lembaga.

Demikian pengingat ini kami sampaikan untuk kelancaran pendataan dan peta sebaran pendidikan Ma'arif NU Cilacap. Terima kasih atas kerja samanya.

Wassalamu'alaikum Wr. Wb.
PC LP Ma'arif NU Cilacap`;
}
