/**
 * Unit tests — Nomor Urut Mulai initialization logic
 *
 * Bug: nomor urut mulai otomatis terisi 0130 padahal belum ada SK yang di-generate.
 * Root cause: query mengambil SK terbaru tanpa filter status, sehingga SK request
 * pending (format REQ/2026/0129) ikut dihitung via regex fallback.
 *
 * Fix: hanya SK dengan status 'approved' dan nomor_sk yang dimulai dengan digit
 * yang boleh mempengaruhi nomor urut mulai.
 */

import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Helpers — mirror logika di SkGeneratorPage.tsx useEffect lastSkData
// ---------------------------------------------------------------------------

/**
 * UNFIXED: mengambil nomor dari SK pertama (terbaru) tanpa filter,
 * termasuk format REQ/YYYY/XXXX dari pending requests.
 */
function computeNomorMulai_UNFIXED(skList: Array<{ nomor_sk: string }>): string {
  const defaultNomor = '0001'
  if (!skList?.[0]?.nomor_sk) return defaultNomor

  const nomor = skList[0].nomor_sk
  const match = nomor.match(/^(\d+)/) || nomor.match(/REQ\/\d+\/(\d+)/)
  if (match) {
    return String(parseInt(match[1]) + 1).padStart(4, '0')
  }
  return defaultNomor
}

/**
 * FIXED: hanya SK dengan nomor_sk yang dimulai dengan digit (bukan REQ/...)
 * yang dihitung. Cari nilai maksimum dari semua SK yang lolos filter.
 */
function computeNomorMulai_FIXED(skList: Array<{ nomor_sk: string }>): string {
  const defaultNomor = '0001'
  if (!skList || skList.length === 0) return defaultNomor

  const generatedSks = skList
    .map(sk => sk.nomor_sk)
    .filter(nomor => nomor && /^\d+/.test(nomor))

  if (generatedSks.length === 0) return defaultNomor

  const maxNum = generatedSks.reduce((max, nomor) => {
    const match = nomor.match(/^(\d+)/)
    if (match) {
      const num = parseInt(match[1])
      return num > max ? num : max
    }
    return max
  }, 0)

  if (maxNum === 0) return defaultNomor
  return String(maxNum + 1).padStart(4, '0')
}

// ---------------------------------------------------------------------------
// Bug condition: REQ/YYYY/XXXX pending requests mempengaruhi nomor urut
// ---------------------------------------------------------------------------

describe('Nomor Urut Mulai — Bug Condition: REQ pending requests ikut dihitung', () => {
  /**
   * Counterexample utama: 129 SK request pending (REQ/2026/0001 s/d REQ/2026/0129)
   * → unfixed code menghasilkan 0130, padahal belum ada SK yang di-generate.
   *
   * isBugCondition: skList[0].nomor_sk matches REQ/YYYY/XXXX
   * Expected: nomor urut mulai = "0001" (tidak terpengaruh pending requests)
   */
  it('C_NOMOR.1 — 129 pending REQ requests seharusnya tidak mempengaruhi nomor urut (harus 0001)', () => {
    // Simulasi: 129 SK request pending, diurutkan terbaru dulu
    const skList = Array.from({ length: 129 }, (_, i) => ({
      nomor_sk: `REQ/2026/${String(129 - i).padStart(4, '0')}`
    }))

    // UNFIXED: menghasilkan 0130 (bug)
    const unfixedResult = computeNomorMulai_UNFIXED(skList)
    expect(unfixedResult).toBe('0130') // konfirmasi bug ada

    // FIXED: menghasilkan 0001 (tidak ada SK approved dengan format digit)
    const fixedResult = computeNomorMulai_FIXED(skList)
    expect(fixedResult, `
      Counterexample: 129 pending REQ requests → nomor urut = "${fixedResult}" (seharusnya "0001")
      Bug: regex REQ\\/\\d+\\/(\\d+) menangkap angka dari pending requests
      Fix: filter hanya nomor_sk yang dimulai dengan digit
    `).toBe('0001')
  })

  /**
   * Property: untuk SEMUA jumlah pending REQ requests (1–200),
   * nomor urut mulai harus tetap "0001".
   */
  it('C_NOMOR.2 — Property: berapapun jumlah REQ pending, nomor urut harus 0001', () => {
    for (const count of [1, 10, 50, 100, 129, 150, 200]) {
      const skList = Array.from({ length: count }, (_, i) => ({
        nomor_sk: `REQ/2026/${String(count - i).padStart(4, '0')}`
      }))

      const result = computeNomorMulai_FIXED(skList)
      expect(result, `
        count=${count} pending REQ requests → nomor urut = "${result}" (seharusnya "0001")
        isBugCondition: semua nomor_sk format REQ/YYYY/XXXX, tidak ada yang dimulai digit
      `).toBe('0001')
    }
  })

  /**
   * Dokumen bug: unfixed code MEMANG menghasilkan 0130 untuk 129 pending requests.
   */
  it('C_NOMOR.3 — [DOCUMENTS BUG] unfixed code menghasilkan 0130 untuk 129 pending REQ requests', () => {
    const skList = [{ nomor_sk: 'REQ/2026/0129' }] // SK terbaru
    const result = computeNomorMulai_UNFIXED(skList)
    expect(result).toBe('0130') // konfirmasi bug
  })
})

// ---------------------------------------------------------------------------
// Perilaku yang benar setelah fix
// ---------------------------------------------------------------------------

describe('Nomor Urut Mulai — Perilaku yang benar (FIXED)', () => {
  /**
   * Belum ada SK sama sekali → default 0001
   */
  it('list kosong → default 0001', () => {
    expect(computeNomorMulai_FIXED([])).toBe('0001')
  })

  /**
   * Hanya ada pending REQ requests → default 0001
   */
  it('hanya REQ pending requests → 0001 (tidak terpengaruh)', () => {
    const skList = [
      { nomor_sk: 'REQ/2026/0129' },
      { nomor_sk: 'REQ/2026/0128' },
      { nomor_sk: 'REQ/2026/0001' },
    ]
    expect(computeNomorMulai_FIXED(skList)).toBe('0001')
  })

  /**
   * Ada 1 SK approved dengan format digit → increment dengan benar
   */
  it('1 SK approved (0005/PC.L/...) → nomor urut 0006', () => {
    const skList = [
      { nomor_sk: '0005/PC.L/A.II/H-34.B/24.29/07/2026' },
    ]
    expect(computeNomorMulai_FIXED(skList)).toBe('0006')
  })

  /**
   * Campuran: ada SK approved dan REQ pending → hanya SK approved yang dihitung
   */
  it('campuran SK approved + REQ pending → hanya SK approved yang dihitung', () => {
    const skList = [
      { nomor_sk: 'REQ/2026/0129' }, // pending — diabaikan
      { nomor_sk: '0010/PC.L/A.II/H-34.B/24.29/07/2026' }, // approved
      { nomor_sk: 'REQ/2026/0050' }, // pending — diabaikan
      { nomor_sk: '0003/PC.L/A.II/H-34.B/24.29/07/2026' }, // approved
    ]
    expect(computeNomorMulai_FIXED(skList)).toBe('0011')
  })

  /**
   * Beberapa SK approved tidak berurutan → ambil nilai maksimum
   */
  it('SK approved tidak berurutan → ambil nilai maksimum + 1', () => {
    const skList = [
      { nomor_sk: '0003/PC.L/...' },
      { nomor_sk: '0015/PC.L/...' },
      { nomor_sk: '0007/PC.L/...' },
    ]
    expect(computeNomorMulai_FIXED(skList)).toBe('0016')
  })

  /**
   * SK approved dengan nomor besar → padding 4 digit tetap benar
   */
  it('SK approved nomor 0099 → nomor urut 0100', () => {
    const skList = [{ nomor_sk: '0099/PC.L/A.II/H-34.B/24.29/07/2026' }]
    expect(computeNomorMulai_FIXED(skList)).toBe('0100')
  })

  /**
   * SK approved dengan nomor 4 digit penuh → tetap increment
   */
  it('SK approved nomor 0999 → nomor urut 1000', () => {
    const skList = [{ nomor_sk: '0999/PC.L/A.II/H-34.B/24.29/07/2026' }]
    expect(computeNomorMulai_FIXED(skList)).toBe('1000')
  })
})
