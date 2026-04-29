import { describe, it, expect } from 'vitest'
import { parseIndonesianDate } from './skDateUtils'

describe('parseIndonesianDate', () => {

  describe('Format 1: ISO YYYY-MM-DD — dikembalikan apa adanya', () => {
    it('"1990-05-12" → "1990-05-12"', () => expect(parseIndonesianDate('1990-05-12')).toBe('1990-05-12'))
    it('"2024-02-20" → "2024-02-20"', () => expect(parseIndonesianDate('2024-02-20')).toBe('2024-02-20'))
    it('"2000-01-01" → "2000-01-01"', () => expect(parseIndonesianDate('2000-01-01')).toBe('2000-01-01'))
  })

  describe('Format 2: YYYY/MM/DD', () => {
    it('"2020/12/13" → "2020-12-13"', () => expect(parseIndonesianDate('2020/12/13')).toBe('2020-12-13'))
    it('"2024/2/5"   → "2024-02-05"', () => expect(parseIndonesianDate('2024/2/5')).toBe('2024-02-05'))
  })

  describe('Format 3: DD MMMM YYYY — Indonesia panjang', () => {
    it('"13 Desember 2020" → "2020-12-13"', () => expect(parseIndonesianDate('13 Desember 2020')).toBe('2020-12-13'))
    it('"20 Februari 2024" → "2024-02-20"', () => expect(parseIndonesianDate('20 Februari 2024')).toBe('2024-02-20'))
    it('"1 Januari 2000"   → "2000-01-01"', () => expect(parseIndonesianDate('1 Januari 2000')).toBe('2000-01-01'))
    it('"31 Maret 1990"    → "1990-03-31"', () => expect(parseIndonesianDate('31 Maret 1990')).toBe('1990-03-31'))
    it('"15 April 2015"    → "2015-04-15"', () => expect(parseIndonesianDate('15 April 2015')).toBe('2015-04-15'))
    it('"10 Mei 2010"      → "2010-05-10"', () => expect(parseIndonesianDate('10 Mei 2010')).toBe('2010-05-10'))
    it('"5 Juni 2018"      → "2018-06-05"', () => expect(parseIndonesianDate('5 Juni 2018')).toBe('2018-06-05'))
    it('"17 Juli 2019"     → "2019-07-17"', () => expect(parseIndonesianDate('17 Juli 2019')).toBe('2019-07-17'))
    it('"8 Agustus 2022"   → "2022-08-08"', () => expect(parseIndonesianDate('8 Agustus 2022')).toBe('2022-08-08'))
    it('"25 September 2021"→ "2021-09-25"', () => expect(parseIndonesianDate('25 September 2021')).toBe('2021-09-25'))
    it('"3 Oktober 2017"   → "2017-10-03"', () => expect(parseIndonesianDate('3 Oktober 2017')).toBe('2017-10-03'))
    it('"11 November 2016" → "2016-11-11"', () => expect(parseIndonesianDate('11 November 2016')).toBe('2016-11-11'))
  })

  describe('Format 4: DD MMM YYYY — Indonesia singkat (3 huruf)', () => {
    it('"13 Des 2020" → "2020-12-13"', () => expect(parseIndonesianDate('13 Des 2020')).toBe('2020-12-13'))
    it('"20 Feb 2024" → "2024-02-20"', () => expect(parseIndonesianDate('20 Feb 2024')).toBe('2024-02-20'))
    it('"1 Jan 2000"  → "2000-01-01"', () => expect(parseIndonesianDate('1 Jan 2000')).toBe('2000-01-01'))
    it('"5 Mar 2015"  → "2015-03-05"', () => expect(parseIndonesianDate('5 Mar 2015')).toBe('2015-03-05'))
    it('"7 Apr 2010"  → "2010-04-07"', () => expect(parseIndonesianDate('7 Apr 2010')).toBe('2010-04-07'))
    it('"9 Jun 2018"  → "2018-06-09"', () => expect(parseIndonesianDate('9 Jun 2018')).toBe('2018-06-09'))
    it('"2 Jul 2019"  → "2019-07-02"', () => expect(parseIndonesianDate('2 Jul 2019')).toBe('2019-07-02'))
    it('"8 Agu 2022"  → "2022-08-08"', () => expect(parseIndonesianDate('8 Agu 2022')).toBe('2022-08-08'))
    it('"8 Ags 2022"  → "2022-08-08" (alias ags)', () => expect(parseIndonesianDate('8 Ags 2022')).toBe('2022-08-08'))
    it('"4 Sep 2021"  → "2021-09-04"', () => expect(parseIndonesianDate('4 Sep 2021')).toBe('2021-09-04'))
    it('"3 Okt 2017"  → "2017-10-03"', () => expect(parseIndonesianDate('3 Okt 2017')).toBe('2017-10-03'))
    it('"1 Nov 2016"  → "2016-11-01"', () => expect(parseIndonesianDate('1 Nov 2016')).toBe('2016-11-01'))
  })

  describe('Format 5: DD-MM-YYYY — numerik dengan dash', () => {
    it('"13-12-2020" → "2020-12-13"', () => expect(parseIndonesianDate('13-12-2020')).toBe('2020-12-13'))
    it('"01-01-2000" → "2000-01-01"', () => expect(parseIndonesianDate('01-01-2000')).toBe('2000-01-01'))
    it('"5-3-2015"   → "2015-03-05"', () => expect(parseIndonesianDate('5-3-2015')).toBe('2015-03-05'))
  })

  describe('Format 6: DD/MM/YYYY — numerik dengan slash', () => {
    it('"13/12/2020" → "2020-12-13"', () => expect(parseIndonesianDate('13/12/2020')).toBe('2020-12-13'))
    it('"01/01/2000" → "2000-01-01"', () => expect(parseIndonesianDate('01/01/2000')).toBe('2000-01-01'))
    it('"5/3/2015"   → "2015-03-05"', () => expect(parseIndonesianDate('5/3/2015')).toBe('2015-03-05'))
  })

  describe('Format 7: DD.MM.YYYY — numerik dengan titik', () => {
    it('"13.12.2020" → "2020-12-13"', () => expect(parseIndonesianDate('13.12.2020')).toBe('2020-12-13'))
    it('"01.01.2000" → "2000-01-01"', () => expect(parseIndonesianDate('01.01.2000')).toBe('2000-01-01'))
    it('"5.3.2015"   → "2015-03-05"', () => expect(parseIndonesianDate('5.3.2015')).toBe('2015-03-05'))
  })

  describe('Case-insensitive untuk nama bulan', () => {
    it('"13 desember 2020" (huruf kecil) → "2020-12-13"', () => expect(parseIndonesianDate('13 desember 2020')).toBe('2020-12-13'))
    it('"20 FEBRUARI 2024" (huruf besar) → "2024-02-20"', () => expect(parseIndonesianDate('20 FEBRUARI 2024')).toBe('2024-02-20'))
    it('"13 DES 2020" (singkat besar)    → "2020-12-13"', () => expect(parseIndonesianDate('13 DES 2020')).toBe('2020-12-13'))
  })

  describe('Whitespace di awal/akhir', () => {
    it('"  13 Desember 2020  " → "2020-12-13"', () => expect(parseIndonesianDate('  13 Desember 2020  ')).toBe('2020-12-13'))
    it('"  13-12-2020  "       → "2020-12-13"', () => expect(parseIndonesianDate('  13-12-2020  ')).toBe('2020-12-13'))
  })

  describe('Fallback — string tidak dikenali dikembalikan apa adanya', () => {
    it('string kosong dikembalikan apa adanya', () => expect(parseIndonesianDate('')).toBe(''))
    it('"bukan tanggal" dikembalikan apa adanya', () => expect(parseIndonesianDate('bukan tanggal')).toBe('bukan tanggal'))
  })
})
