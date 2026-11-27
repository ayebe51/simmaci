import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { parseIndonesianDate } from './skDateUtils'

/**
 * Helper to create an Excel serial date number (1900 date system) using pure UTC math
 * so tests are 100% deterministic across host timezones.
 */
function toExcelSerial(year: number, month: number, day: number): number {
  const utcMs = Date.UTC(year, month - 1, day)
  const excelEpochMs = Date.UTC(1899, 11, 30)
  return Math.round((utcMs - excelEpochMs) / 86400000)
}

describe('P1.1 — Excel Date Parser & SheetJS Consistency (Frontend)', () => {
  describe('English 3-letter & full month names produced by SheetJS', () => {
    it('parses Aug, Oct, Dec abbreviations consistently', () => {
      expect(parseIndonesianDate('03 Aug 1992')).toBe('1992-08-03')
      expect(parseIndonesianDate('15 Oct 1990')).toBe('1990-10-15')
      expect(parseIndonesianDate('02 Dec 2018')).toBe('2018-12-02')
    })

    it('parses full English month names produced by SheetJS dd mmmm yyyy', () => {
      expect(parseIndonesianDate('03 August 1992')).toBe('1992-08-03')
      expect(parseIndonesianDate('20 February 1984')).toBe('1984-02-20')
      expect(parseIndonesianDate('15 July 2013')).toBe('2013-07-15')
      expect(parseIndonesianDate('02 December 2018')).toBe('2018-12-02')
      expect(parseIndonesianDate('15 October 1990')).toBe('1990-10-15')
    })
  })

  describe('Indonesian Agst variation & hyphen-separated dates', () => {
    it('parses Agst alias (case-insensitive)', () => {
      expect(parseIndonesianDate('03 Agst 1992')).toBe('1992-08-03')
      expect(parseIndonesianDate('21 AGST 2024')).toBe('2024-08-21')
      expect(parseIndonesianDate('03-Agst-1992')).toBe('1992-08-03')
    })

    it('parses hyphen-separated Indonesian & English month dates', () => {
      expect(parseIndonesianDate('11-Mei-2022')).toBe('2022-05-11')
      expect(parseIndonesianDate('11-Agu-2022')).toBe('2022-08-11')
      expect(parseIndonesianDate('11-Okt-2022')).toBe('2022-10-11')
      expect(parseIndonesianDate('11-Des-2022')).toBe('2022-12-11')
      expect(parseIndonesianDate('03-Aug-1992')).toBe('1992-08-03')
      expect(parseIndonesianDate('15-Oct-1990')).toBe('1990-10-15')
      expect(parseIndonesianDate('02-Dec-2018')).toBe('2018-12-02')
    })
  })

  describe('SheetJS Excel Date Cell vs Excel Text Cell consistency', () => {
    it('produces identical ISO date for Excel Date Cell (dd mmm yyyy / dd mmmm yyyy) and Text Cell', () => {
      const wb = XLSX.utils.book_new()
      const ws: XLSX.WorkSheet = {
        A1: { t: 's', v: 'Tanggal Lahir' },
        B1: { t: 's', v: 'TMT' },
        // Row 2: Text Cells
        A2: { t: 's', v: '03 Agst 1992' },
        B2: { t: 's', v: '02 Desember 2018' },
        // Row 3: Excel Date Cells with dd mmm yyyy -> SheetJS outputs "03 Aug 1992" / "02 Dec 2018"
        A3: { t: 'n', v: toExcelSerial(1992, 8, 3), z: 'dd mmm yyyy' },
        B3: { t: 'n', v: toExcelSerial(2018, 12, 2), z: 'dd mmm yyyy' },
        // Row 4: Excel Date Cells with Indonesian locale [$-id-ID]dd mmm yyyy & [$-421]dd mmmm yyyy
        A4: { t: 'n', v: toExcelSerial(1990, 10, 15), z: '[$-id-ID]dd mmm yyyy' },
        B4: { t: 'n', v: toExcelSerial(1992, 8, 3), z: '[$-421]dd mmmm yyyy' },
        // Row 5: Hyphenated Indonesian Text Cells
        A5: { t: 's', v: '11-Mei-2022' },
        B5: { t: 's', v: '11-Okt-2022' },
        '!ref': 'A1:B5',
      }
      XLSX.utils.book_append_sheet(wb, ws, 'Template')

      // Round-trip write & read with the exact options used in BulkSkSubmission.tsx & FileUploadStep.tsx
      const bin = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' })
      const readWb = XLSX.read(bin, { type: 'binary', cellDates: false, cellNF: true })
      const readWs = readWb.Sheets[readWb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(readWs, { header: 1, raw: false, defval: '' }) as string[][]

      // SheetJS formatted values
      expect(rows[1]).toEqual(['03 Agst 1992', '02 Desember 2018'])
      expect(rows[2]).toEqual(['03 Aug 1992', '02 Dec 2018'])
      expect(rows[3]).toEqual(['15 Oct 1990', '03 August 1992'])
      expect(rows[4]).toEqual(['11-Mei-2022', '11-Okt-2022'])

      // Text Cell & Date Cell must normalize to the EXACT SAME ISO dates
      expect(parseIndonesianDate(rows[1][0])).toBe('1992-08-03')
      expect(parseIndonesianDate(rows[2][0])).toBe('1992-08-03')
      expect(parseIndonesianDate(rows[3][1])).toBe('1992-08-03')

      expect(parseIndonesianDate(rows[1][1])).toBe('2018-12-02')
      expect(parseIndonesianDate(rows[2][1])).toBe('2018-12-02')

      expect(parseIndonesianDate(rows[3][0])).toBe('1990-10-15')
      expect(parseIndonesianDate(rows[4][0])).toBe('2022-05-11')
      expect(parseIndonesianDate(rows[4][1])).toBe('2022-10-11')
    })
  })
})
