/**
 * Utility functions untuk kalkulasi tanggal SK berdasarkan Tahun_SK.
 * Semua fungsi menggunakan konstruktor Date eksplisit (bukan offset hari)
 * agar deterministik dan benar di tahun kabisat.
 */

/**
 * Mengembalikan tanggal penetapan SK: 1 Juli tahun yang diberikan.
 * Menggunakan setUTCFullYear agar deterministik di semua timezone dan benar untuk tahun 0–99.
 */
export function deriveStartDate(year: number): Date {
  const d = new Date(0)
  d.setUTCFullYear(year, 6, 1) // bulan 6 = Juli (0-indexed)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

/**
 * Mengembalikan tanggal berakhir SK: 30 Juni tahun berikutnya.
 * Menggunakan setUTCFullYear — bukan +365 hari — agar benar di tahun kabisat dan tahun 0–99.
 */
export function deriveEndDate(year: number): Date {
  const d = new Date(0)
  d.setUTCFullYear(year + 1, 5, 30) // bulan 5 = Juni (0-indexed)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

/**
 * Mengembalikan string tahun ajaran format "YYYY/YYYY+1".
 */
export function deriveTahunAjaran(year: number): string {
  return `${year}/${year + 1}`
}

/**
 * Mengembalikan tahun kalender saat ini sebagai default Tahun_SK.
 * Hanya menggunakan getFullYear() — tidak mempertimbangkan bulan atau tanggal.
 */
export function getCurrentSkYear(): number {
  return new Date().getFullYear()
}
