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
  d.setUTCFullYear(year + 1, 5, 30) // bulan 5 = Juni (0-indexed), tanggal 30
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

/**
 * Map nama bulan Indonesia (panjang & singkat) ke nomor bulan 1-indexed.
 * Kunci dalam huruf kecil semua.
 */
const BULAN_MAP: Record<string, number> = {
  // Panjang
  januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6,
  juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12,
  // Singkat (3 huruf)
  jan: 1, feb: 2, mar: 3, apr: 4, // mei sudah ada di atas
  jun: 6, jul: 7, agu: 8, ags: 8, sep: 9, okt: 10, nov: 11, des: 12,
}

/** Buat string ISO "YYYY-MM-DD" dari komponen angka. */
function toIso(yyyy: number | string, mm: number | string, dd: number | string): string {
  return `${String(yyyy).padStart(4, '0')}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
}

/**
 * Konversi string tanggal dari berbagai format ke "YYYY-MM-DD".
 *
 * Format yang didukung:
 *   1. "YYYY-MM-DD"          → ISO, dikembalikan apa adanya
 *   2. "YYYY/MM/DD"          → ISO dengan slash
 *   3. "DD MMMM YYYY"        → Indonesia panjang  ("13 Desember 2020")
 *   4. "DD MMM YYYY"         → Indonesia singkat  ("13 Des 2020")
 *   5. "DD-MM-YYYY"          → Eropa/Indonesia numerik dengan dash
 *   6. "DD/MM/YYYY"          → Eropa/Indonesia numerik dengan slash
 *   7. "DD.MM.YYYY"          → Eropa numerik dengan titik
 *   8. "D/M/YYYY" dll        → Varian tanpa leading zero
 *
 * Semua parsing dilakukan secara eksplisit (tanpa new Date()) agar
 * deterministik dan tidak terpengaruh timezone browser.
 *
 * Jika tidak bisa di-parse, kembalikan string asli.
 */
export function parseIndonesianDate(val: string): string {
  const trimmed = val.trim()
  if (!trimmed) return trimmed

  // 1. Sudah ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed

  // 2. YYYY/MM/DD
  const isoSlash = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/)
  if (isoSlash) return toIso(isoSlash[1], isoSlash[2], isoSlash[3])

  // 3 & 4. DD MMMM YYYY atau DD MMM YYYY (nama bulan Indonesia)
  const textMonth = trimmed.match(/^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})$/)
  if (textMonth) {
    const monthNum = BULAN_MAP[textMonth[2].toLowerCase()]
    if (monthNum) return toIso(textMonth[3], monthNum, textMonth[1])
  }

  // 5. DD-MM-YYYY
  const dashDmy = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (dashDmy) return toIso(dashDmy[3], dashDmy[2], dashDmy[1])

  // 6. DD/MM/YYYY
  const slashDmy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slashDmy) return toIso(slashDmy[3], slashDmy[2], slashDmy[1])

  // 7. DD.MM.YYYY
  const dotDmy = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (dotDmy) return toIso(dotDmy[3], dotDmy[2], dotDmy[1])

  // Tidak dikenali — kembalikan string asli
  return trimmed
}
