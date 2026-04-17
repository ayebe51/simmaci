import { describe, it, expect } from 'vitest'
import { calculatePeriode } from './calculatePeriode'

describe('calculatePeriode', () => {
  // Requirements: 2.4
  it('TMT 2000-07-01, cetak 2026-07-01 → 26', () => {
    expect(calculatePeriode('2000-07-01', new Date('2026-07-01'))).toBe(26)
  })

  // Requirements: 2.5
  it('TMT 2000-10-01, cetak 2026-07-01 → 25 (bulan cetak belum melewati bulan TMT)', () => {
    expect(calculatePeriode('2000-10-01', new Date('2026-07-01'))).toBe(25)
  })

  // Sehari sebelum ulang tahun TMT → N-1
  it('cetak tepat sehari sebelum ulang tahun TMT → N-1', () => {
    // TMT: 2000-07-15, cetak: 2026-07-14 → 25 (hari 14 < 15)
    expect(calculatePeriode('2000-07-15', new Date('2026-07-14'))).toBe(25)
  })

  // Tepat pada hari ulang tahun TMT → N
  it('cetak tepat pada hari ulang tahun TMT → N', () => {
    // TMT: 2000-07-15, cetak: 2026-07-15 → 26
    expect(calculatePeriode('2000-07-15', new Date('2026-07-15'))).toBe(26)
  })

  // Sehari setelah ulang tahun TMT → N
  it('cetak sehari setelah ulang tahun TMT → N', () => {
    // TMT: 2000-07-15, cetak: 2026-07-16 → 26
    expect(calculatePeriode('2000-07-15', new Date('2026-07-16'))).toBe(26)
  })

  // Requirements: 2.6 — TMT = tanggalCetak → 0
  it('TMT sama dengan tanggalCetak → 0', () => {
    expect(calculatePeriode('2026-07-01', new Date('2026-07-01'))).toBe(0)
  })

  // Requirements: 2.1, 2.6 — tanggalCetak lebih awal dari TMT → 0 (non-negatif)
  it('tanggalCetak lebih awal dari TMT → 0 (non-negatif)', () => {
    expect(calculatePeriode('2030-01-01', new Date('2026-07-01'))).toBe(0)
  })
})
