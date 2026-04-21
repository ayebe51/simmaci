/**
 * Property-based tests untuk `calculatePeriode`.
 * Karena fast-check tidak tersedia, properti diverifikasi dengan iterasi
 * atas rentang input yang representatif.
 *
 * **Validates: Requirements 2.4, 2.6**
 */

import { describe, it, expect } from 'vitest'
import { calculatePeriode } from './calculatePeriode'

// Helper: buat Date dari komponen tahun/bulan/hari (bulan 1-indexed)
function makeDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day)
}

// Helper: format Date ke string "YYYY-MM-DD" untuk argumen tmt
function toTmtString(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

// Rentang tahun yang digunakan untuk generasi input
const TMT_YEARS = [1990, 1995, 2000, 2005, 2010, 2015, 2020]
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
const DAYS = [1, 10, 15, 20, 28]
const N_VALUES = [0, 1, 2, 5, 10, 20, 26, 30]

describe('calculatePeriode — property tests', () => {
  /**
   * Property 1: Simetri Tepat Satu Tahun
   * Jika tanggalCetak berada di tahun TMT + N (berapapun bulan/harinya), hasil = N.
   * Karena hanya selisih tahun yang diperhitungkan.
   *
   * **Validates: Requirements 2.4, 2.6**
   */
  it('Property 1: Simetri Tepat Satu Tahun — cetak di tahun TMT+N → N', () => {
    for (const tmtYear of TMT_YEARS) {
      for (const month of MONTHS) {
        for (const day of DAYS) {
          // Lewati tanggal yang tidak valid (mis. 30 Feb)
          const probe = makeDate(tmtYear, month, day)
          if (probe.getMonth() !== month - 1) continue

          const tmt = toTmtString(tmtYear, month, day)

          for (const n of N_VALUES) {
            const cetakYear = tmtYear + n
            // Lewati jika tahun cetak tidak valid
            const cetak = makeDate(cetakYear, month, day)
            if (cetak.getMonth() !== month - 1) continue

            const result = calculatePeriode(tmt, cetak)
            expect(result, `TMT=${tmt}, n=${n}, cetak=${cetak.toISOString()}`).toBe(n)
          }
        }
      }
    }
  })

  /**
   * Property 2: Monoton Tidak Menurun
   * ∀ d1 ≤ d2 : calculatePeriode(tmt, d1) ≤ calculatePeriode(tmt, d2)
   *
   * **Validates: Requirements 2.6**
   */
  it('Property 2: Monoton Tidak Menurun — d1 ≤ d2 → periode(d1) ≤ periode(d2)', () => {
    // Pasangan tanggal cetak yang berurutan (d1 < d2)
    const cetakPairs: Array<[Date, Date]> = [
      [makeDate(2020, 1, 1), makeDate(2020, 6, 1)],
      [makeDate(2020, 6, 1), makeDate(2021, 6, 1)],
      [makeDate(2021, 6, 1), makeDate(2026, 7, 1)],
      [makeDate(2025, 12, 31), makeDate(2026, 1, 1)],
      [makeDate(2026, 7, 14), makeDate(2026, 7, 15)],
      [makeDate(2026, 7, 15), makeDate(2026, 7, 16)],
    ]

    for (const tmtYear of TMT_YEARS) {
      for (const month of MONTHS) {
        for (const day of DAYS) {
          const probe = makeDate(tmtYear, month, day)
          if (probe.getMonth() !== month - 1) continue

          const tmt = toTmtString(tmtYear, month, day)

          for (const [d1, d2] of cetakPairs) {
            const p1 = calculatePeriode(tmt, d1)
            const p2 = calculatePeriode(tmt, d2)
            expect(p1, `TMT=${tmt}, d1=${d1.toISOString()}, d2=${d2.toISOString()}`).toBeLessThanOrEqual(p2)
          }
        }
      }
    }
  })

  /**
   * Property 3: Hasil = selisih tahun kalender (cetak.year - tmt.year)
   * Karena bulan dan hari diabaikan, hasil selalu persis sama dengan selisih tahun.
   * Properti ini hanya berlaku ketika cetak.year ≥ tmt.year (kasus normal).
   * Ketika cetak lebih awal dari TMT, hasil di-clamp ke 0 oleh Math.max (Property 4).
   *
   * **Validates: Requirements 2.6**
   */
  it('Property 3: Hasil = selisih tahun kalender', () => {
    const cetakDates = [
      makeDate(2010, 3, 15),
      makeDate(2015, 7, 1),
      makeDate(2020, 12, 31),
      makeDate(2026, 7, 1),
      makeDate(2030, 1, 1),
    ]

    for (const tmtYear of TMT_YEARS) {
      for (const month of MONTHS) {
        for (const day of DAYS) {
          const probe = makeDate(tmtYear, month, day)
          if (probe.getMonth() !== month - 1) continue

          const tmt = toTmtString(tmtYear, month, day)

          for (const cetak of cetakDates) {
            const calendarDiff = cetak.getFullYear() - tmtYear
            // Properti hanya bermakna ketika cetak tidak lebih awal dari TMT
            if (calendarDiff < 0) continue

            const result = calculatePeriode(tmt, cetak)
            expect(result, `TMT=${tmt}, cetak=${cetak.toISOString()}`).toBe(calendarDiff)
          }
        }
      }
    }
  })

  /**
   * Property 4: Non-Negatif — hasil selalu ≥ 0
   *
   * **Validates: Requirements 2.6**
   */
  it('Property 4: Non-Negatif — hasil selalu ≥ 0', () => {
    // Termasuk kasus di mana cetak lebih awal dari TMT
    const cetakDates = [
      makeDate(1985, 1, 1),   // jauh sebelum TMT termuda (1990)
      makeDate(1995, 6, 15),
      makeDate(2000, 1, 1),
      makeDate(2010, 7, 1),
      makeDate(2026, 7, 1),
      makeDate(2035, 12, 31),
    ]

    for (const tmtYear of TMT_YEARS) {
      for (const month of MONTHS) {
        for (const day of DAYS) {
          const probe = makeDate(tmtYear, month, day)
          if (probe.getMonth() !== month - 1) continue

          const tmt = toTmtString(tmtYear, month, day)

          for (const cetak of cetakDates) {
            const result = calculatePeriode(tmt, cetak)
            expect(result, `TMT=${tmt}, cetak=${cetak.toISOString()}`).toBeGreaterThanOrEqual(0)
          }
        }
      }
    }
  })
})
