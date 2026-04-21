import { describe, it, expect } from 'vitest'
import { calculatePeriode } from './calculatePeriode'

describe('calculatePeriode', () => {
  // Kasus dari SK fisik: TMT 14 Juli 2008, penetapan 1 Juli 2025 → 17
  it('TMT 2008-07-14, cetak 2025-07-01 → 17 (sesuai konvensi SK LP Ma\'arif)', () => {
    expect(calculatePeriode('2008-07-14', new Date('2025-07-01'))).toBe(17)
  })

  it('TMT 2000-07-01, cetak 2026-07-01 → 26', () => {
    expect(calculatePeriode('2000-07-01', new Date('2026-07-01'))).toBe(26)
  })

  // Bulan cetak lebih awal dari bulan TMT — tetap selisih tahun saja
  it('TMT 2000-10-01, cetak 2026-07-01 → 26 (bulan diabaikan)', () => {
    expect(calculatePeriode('2000-10-01', new Date('2026-07-01'))).toBe(26)
  })

  // Hari cetak sehari sebelum ulang tahun TMT — tetap selisih tahun
  it('cetak sehari sebelum ulang tahun TMT → N (hari diabaikan)', () => {
    // TMT: 2000-07-15, cetak: 2026-07-14 → 26 (bukan 25)
    expect(calculatePeriode('2000-07-15', new Date('2026-07-14'))).toBe(26)
  })

  it('cetak tepat pada hari ulang tahun TMT → N', () => {
    // TMT: 2000-07-15, cetak: 2026-07-15 → 26
    expect(calculatePeriode('2000-07-15', new Date('2026-07-15'))).toBe(26)
  })

  it('cetak sehari setelah ulang tahun TMT → N', () => {
    // TMT: 2000-07-15, cetak: 2026-07-16 → 26
    expect(calculatePeriode('2000-07-15', new Date('2026-07-16'))).toBe(26)
  })

  // TMT = tanggalCetak → 0
  it('TMT sama dengan tanggalCetak → 0', () => {
    expect(calculatePeriode('2026-07-01', new Date('2026-07-01'))).toBe(0)
  })

  // tanggalCetak lebih awal dari TMT → 0 (non-negatif)
  it('tanggalCetak lebih awal dari TMT → 0 (non-negatif)', () => {
    expect(calculatePeriode('2030-01-01', new Date('2026-07-01'))).toBe(0)
  })
})
