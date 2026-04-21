/**
 * Menghitung periode masa kerja guru dalam tahun, dihitung dari selisih tahun kalender.
 * Hanya selisih tahun yang diperhitungkan — bulan dan hari diabaikan.
 * Ini sesuai dengan konvensi penomoran SK LP Ma'arif NU Cilacap.
 *
 * Contoh:
 *   TMT: 2008-07-14, cetak: 2025-07-01 → 17  (2025 - 2008)
 *   TMT: 2000-07-01, cetak: 2026-07-01 → 26  (2026 - 2000)
 *   TMT: 2000-10-01, cetak: 2026-07-01 → 26  (2026 - 2000, bulan diabaikan)
 */
export function calculatePeriode(tmt: string, tanggalCetak: Date): number {
  const tmtDate = new Date(tmt)
  const years = tanggalCetak.getFullYear() - tmtDate.getFullYear()
  return Math.max(0, years)
}
