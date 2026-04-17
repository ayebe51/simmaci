/**
 * Menghitung periode masa kerja guru dalam tahun penuh (floor).
 * Bulan diperhitungkan: jika bulan/tanggal cetak belum mencapai bulan/tanggal TMT
 * di tahun yang sama, maka tahun dikurangi 1.
 *
 * Contoh:
 *   TMT: 2000-07-01, cetak: 2026-07-01 → 26
 *   TMT: 2000-10-01, cetak: 2026-07-01 → 25
 */
export function calculatePeriode(tmt: string, tanggalCetak: Date): number {
  const tmtDate = new Date(tmt)
  let years = tanggalCetak.getFullYear() - tmtDate.getFullYear()

  const monthDiff = tanggalCetak.getMonth() - tmtDate.getMonth()
  const dayDiff = tanggalCetak.getDate() - tmtDate.getDate()

  // Belum genap ulang tahun TMT di tahun ini
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    years -= 1
  }

  return Math.max(0, years)
}
