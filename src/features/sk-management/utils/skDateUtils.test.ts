import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getCurrentSkYear,
  deriveStartDate,
  deriveEndDate,
  deriveTahunAjaran,
} from './skDateUtils'

describe('getCurrentSkYear', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('mengembalikan tahun kalender saat ini', () => {
    vi.setSystemTime(new Date(2025, 6, 1)) // 1 Juli 2025
    expect(getCurrentSkYear()).toBe(2025)
  })

  it('tidak berubah berdasarkan bulan — Januari', () => {
    vi.setSystemTime(new Date(2025, 0, 1)) // 1 Januari 2025
    expect(getCurrentSkYear()).toBe(2025)
  })

  it('tidak berubah berdasarkan bulan — Desember', () => {
    vi.setSystemTime(new Date(2025, 11, 31)) // 31 Desember 2025
    expect(getCurrentSkYear()).toBe(2025)
  })
})

describe('deriveStartDate', () => {
  it('menghasilkan 1 Juli untuk tahun normal', () => {
    const d = deriveStartDate(2025)
    expect(d.getMonth()).toBe(6)  // 0-indexed: 6 = Juli
    expect(d.getDate()).toBe(1)
    expect(d.getFullYear()).toBe(2025)
  })

  it('menghasilkan 1 Juli untuk tahun kabisat 2024', () => {
    const d = deriveStartDate(2024)
    expect(d.getMonth()).toBe(6)
    expect(d.getDate()).toBe(1)
    expect(d.getFullYear()).toBe(2024)
  })

  it('menghasilkan 1 Juli untuk tahun kabisat 2028', () => {
    const d = deriveStartDate(2028)
    expect(d.getMonth()).toBe(6)
    expect(d.getDate()).toBe(1)
    expect(d.getFullYear()).toBe(2028)
  })
})

describe('deriveEndDate', () => {
  it('menghasilkan 30 Juni tahun berikutnya untuk tahun normal', () => {
    const d = deriveEndDate(2025)
    expect(d.getMonth()).toBe(5)  // 0-indexed: 5 = Juni
    expect(d.getDate()).toBe(30)
    expect(d.getFullYear()).toBe(2026)
  })

  it('menghasilkan 30 Juni 2025 untuk input 2024 (tahun kabisat)', () => {
    // 2024 adalah tahun kabisat — offset hari akan salah, konstruktor eksplisit harus benar
    const d = deriveEndDate(2024)
    expect(d.getMonth()).toBe(5)
    expect(d.getDate()).toBe(30)
    expect(d.getFullYear()).toBe(2025)
  })

  it('menghasilkan 30 Juni 2029 untuk input 2028 (tahun kabisat)', () => {
    const d = deriveEndDate(2028)
    expect(d.getMonth()).toBe(5)
    expect(d.getDate()).toBe(30)
    expect(d.getFullYear()).toBe(2029)
  })

  it('menghasilkan 30 Juni 2024 untuk input 2023 (sebelum tahun kabisat)', () => {
    // deriveEndDate(2023) → 30 Juni 2024, bukan terpengaruh kabisat
    const d = deriveEndDate(2023)
    expect(d.getMonth()).toBe(5)
    expect(d.getDate()).toBe(30)
    expect(d.getFullYear()).toBe(2024)
  })
})

describe('deriveTahunAjaran', () => {
  it('deriveTahunAjaran(2025) mengembalikan "2025/2026"', () => {
    expect(deriveTahunAjaran(2025)).toBe('2025/2026')
  })

  it('deriveTahunAjaran(2024) mengembalikan "2024/2025"', () => {
    expect(deriveTahunAjaran(2024)).toBe('2024/2025')
  })

  it('deriveTahunAjaran(2000) mengembalikan "2000/2001"', () => {
    expect(deriveTahunAjaran(2000)).toBe('2000/2001')
  })
})
