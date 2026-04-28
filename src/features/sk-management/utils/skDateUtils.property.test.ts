/**
 * Property-based tests untuk `skDateUtils.ts`.
 * Menggunakan fast-check untuk verifikasi properti universal.
 *
 * **Validates: Requirements 1.1, 1.2, 2.2, 2.3, 2.5, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3**
 */

import { describe, it } from 'vitest'
import * as fc from 'fast-check'
import { deriveStartDate, deriveEndDate, deriveTahunAjaran } from './skDateUtils'

// Helper lokal untuk format tanggal Indonesia (mirror dari SkGeneratorPage.tsx)
function formatDateIndo(dateStr: string): string {
  const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
  const d = new Date(dateStr)
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

describe('skDateUtils — property tests', () => {
  /**
   * Property 1: `deriveStartDate` selalu menghasilkan 1 Juli
   * Untuk sembarang tahun valid, bulan harus Juli (index 6) dan hari harus 1.
   *
   * **Validates: Requirements 1.1, 2.2, 4.3**
   */
  it('Property 1: deriveStartDate selalu menghasilkan 1 Juli untuk sembarang tahun valid', () => {
    // Feature: sk-auto-date, Property 1: deriveStartDate selalu menghasilkan 1 Juli
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 9999 }), (year) => {
        const d = deriveStartDate(year)
        return d.getMonth() === 6 && d.getDate() === 1 // bulan 0-indexed: 6 = Juli
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 2: `deriveEndDate` selalu menghasilkan 30 Juni tahun berikutnya
   * Untuk sembarang tahun valid, bulan harus Juni (index 5), hari 30, tahun = year+1.
   * Ini harus benar bahkan untuk tahun kabisat.
   *
   * **Validates: Requirements 1.2, 2.3, 4.1, 4.2**
   */
  it('Property 2: deriveEndDate selalu menghasilkan 30 Juni tahun berikutnya', () => {
    // Feature: sk-auto-date, Property 2: deriveEndDate selalu menghasilkan 30 Juni tahun berikutnya
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 9998 }), (year) => {
        const d = deriveEndDate(year)
        return d.getMonth() === 5 && d.getDate() === 30 && d.getFullYear() === year + 1
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 3: Konsistensi tiga nilai yang diturunkan dari Tahun_SK
   * Ketiga nilai harus konsisten satu sama lain untuk sembarang tahun valid.
   *
   * **Validates: Requirements 2.5, 3.3**
   */
  it('Property 3: Konsistensi tiga nilai yang diturunkan dari Tahun_SK', () => {
    // Feature: sk-auto-date, Property 3: Konsistensi tiga nilai yang diturunkan dari Tahun_SK
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 9998 }), (year) => {
        return deriveStartDate(year).getFullYear() === year
          && deriveEndDate(year).getFullYear() === year + 1
          && deriveTahunAjaran(year) === `${year}/${year + 1}`
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 4: Format tanggal Indonesia konsisten dengan nilai yang diturunkan
   * formatDateIndo dari startDate harus mengandung "1 Juli" dan tahun yang benar.
   * formatDateIndo dari endDate harus mengandung "30 Juni" dan tahun+1 yang benar.
   *
   * **Validates: Requirements 3.1, 3.2**
   */
  it('Property 4: Format tanggal Indonesia konsisten dengan nilai yang diturunkan', () => {
    // Feature: sk-auto-date, Property 4: Format tanggal Indonesia konsisten
    fc.assert(
      fc.property(fc.integer({ min: 1900, max: 2100 }), (year) => {
        const startStr = formatDateIndo(deriveStartDate(year).toISOString().split('T')[0])
        const endStr = formatDateIndo(deriveEndDate(year).toISOString().split('T')[0])
        return startStr.includes('1 Juli') && startStr.includes(String(year))
          && endStr.includes('30 Juni') && endStr.includes(String(year + 1))
      }),
      { numRuns: 100 }
    )
  })
})
