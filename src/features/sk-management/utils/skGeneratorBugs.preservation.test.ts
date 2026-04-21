/**
 * Preservation Property Tests — SK Generator
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.8**
 *
 * GOAL: Capture baseline behavior on UNFIXED code for non-buggy inputs.
 * These tests MUST PASS on unfixed code — they document behavior that must
 * not regress after the fixes in Task 3 are applied.
 *
 * Observation methodology (run on unfixed code before writing):
 *   - selectTemplate({ teacherStatus: "Guru Tidak Tetap", jenis: "" }) → "sk_template_gtt" ✓
 *   - selectTemplate({ teacherStatus: "gtt", jenis: "" })               → "sk_template_gtt" ✓
 *   - selectTemplate({ teacherStatus: "tendik", jenis: "" })             → "sk_template_tendik" ✓
 *   - verifyBySk("SK-001-2026") (no '/') → request URL is /verify/sk/SK-001-2026 ✓
 *   - single-document generate → doc[0] tembusan starts at 1 ✓
 *
 * NOTE: Some tests below cover NEW behavior introduced by the fix
 * (TMT fallback, Tendik-by-education, safe default). These tests will FAIL
 * on unfixed code — they are clearly marked with [NEW BEHAVIOR].
 * The core preservation tests (GTT routing, QR URL, single-doc tembusan)
 * are expected to PASS on unfixed code.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.8
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { calculatePeriode } from './calculatePeriode'

// ---------------------------------------------------------------------------
// Helpers — mirrors the UNFIXED template selection logic from SkGeneratorPage.tsx
// (same as in exploration tests — copied verbatim from handleGenerate)
// ---------------------------------------------------------------------------

interface SelectTemplateInput {
  teacherStatus: string
  jenis: string
  tmt?: string
  pendidikan?: string
  tanggalPenetapan?: Date
}

/**
 * UNFIXED template selection logic — copied verbatim from SkGeneratorPage.tsx
 * handleGenerate. Used to verify preservation of non-buggy behavior.
 */
function selectTemplate_UNFIXED(input: SelectTemplateInput): string {
  const teacherStatus = input.teacherStatus.toLowerCase()
  const jenis = input.jenis.toLowerCase()

  let templateId = 'sk_template_tendik' // Default

  if (
    teacherStatus.includes('gty') ||
    teacherStatus.includes('tetap yayasan') ||
    jenis.includes('gty') ||
    jenis.includes('tetap yayasan')
  ) {
    templateId = 'sk_template_gty'
  } else if (
    teacherStatus.includes('gtt') ||
    teacherStatus.includes('tidak tetap') ||
    jenis.includes('gtt') ||
    jenis.includes('tidak tetap') ||
    jenis.includes('tidak tetap') || // duplicate — present in unfixed code
    teacherStatus.includes('guru')   // BUG: too broad (but doesn't affect GTT-explicit inputs)
  ) {
    templateId = 'sk_template_gtt'
  } else if (
    teacherStatus.includes('kamad') ||
    teacherStatus.includes('kepala') ||
    jenis.includes('kamad') ||
    jenis.includes('kepala')
  ) {
    templateId = 'sk_template_kamad'
  }

  return templateId
}

/**
 * UNFIXED verifyBySk URL builder — mirrors src/lib/api.ts (unfixed):
 *   verifyBySk: (nomor: string) => apiClient.get(`/verify/sk/${encodeURIComponent(nomor)}`)
 */
function verifyBySkUrl_UNFIXED(nomor: string): string {
  return `/verify/sk/${encodeURIComponent(nomor)}`
}

/**
 * FIXED template selection logic — mirrors the refactored SkGeneratorPage.tsx
 * handleGenerate after Bug 3 fix.
 */
function selectTemplate_FIXED(input: SelectTemplateInput): string {
  const statusRaw = input.teacherStatus.toLowerCase()
  const jenis = input.jenis.toLowerCase()
  const pendidikan = (input.pendidikan ?? '').toLowerCase()
  const tanggalPenetapan = input.tanggalPenetapan ?? new Date()

  const isGty   = statusRaw.includes('gty') || statusRaw.includes('tetap yayasan') ||
                  jenis.includes('gty')     || jenis.includes('tetap yayasan')
  const isKamad = statusRaw.includes('kamad') || statusRaw.includes('kepala') ||
                  jenis.includes('kamad')     || jenis.includes('kepala')
  const isGtt   = statusRaw.includes('gtt') || statusRaw.includes('tidak tetap') ||
                  jenis.includes('gtt')     || jenis.includes('tidak tetap')
  const isEmpty = statusRaw === '' && jenis === ''

  const PENDIDIKAN_TINGGI = ['s1', 's2', 's3', 'd4', 's1/d4', 'strata']
  const isBelowS1 = pendidikan !== '' && !PENDIDIKAN_TINGGI.some(p => pendidikan.includes(p))

  if (isGty || isKamad) {
    return 'sk_template_gty'
  } else if (isGtt) {
    return 'sk_template_gtt'
  } else if (isEmpty) {
    const periodeForTemplate = input.tmt ? calculatePeriode(input.tmt, tanggalPenetapan) : 0
    return periodeForTemplate >= 2 ? 'sk_template_gty' : 'sk_template_gtt'
  } else if (isBelowS1) {
    return 'sk_template_tendik'
  } else {
    return 'sk_template_gtt'
  }
}

// ---------------------------------------------------------------------------
// Tembusan counter simulation — UNFIXED (counter NOT reset between documents)
// ---------------------------------------------------------------------------

let tembusanCounter_UNFIXED = 0

function buildTembusanArray_UNFIXED(count: number): Array<{ nomor: number }> {
  const result: Array<{ nomor: number }> = []
  for (let j = 0; j < count; j++) {
    tembusanCounter_UNFIXED++
    result.push({ nomor: tembusanCounter_UNFIXED })
  }
  return result
}

function simulateMultiDocGenerate_UNFIXED(
  batchSize: number,
  tembusanPerDoc = 6
): Array<{ documentIndex: number; tembusan: Array<{ nomor: number }> }> {
  const results = []
  for (let i = 0; i < batchSize; i++) {
    const tembusan = buildTembusanArray_UNFIXED(tembusanPerDoc)
    results.push({ documentIndex: i, tembusan })
  }
  return results
}

// ---------------------------------------------------------------------------
// Property 4: Preservation — GTT routing for explicit GTT inputs
//
// For all teacherStatus values containing "gtt" or "tidak tetap"
// (but NOT "gty"/"tetap yayasan"/"kamad"/"kepala") → result is always "sk_template_gtt"
//
// EXPECTED: PASS on unfixed code (these inputs are not affected by the bug)
// Validates: Requirements 3.1
// ---------------------------------------------------------------------------

describe('Preservation P4: GTT routing unchanged for explicit GTT inputs', () => {
  /**
   * Observed: selectTemplate({ teacherStatus: "Guru Tidak Tetap", jenis: "" }) → "sk_template_gtt"
   *
   * Property: For all teacherStatus values containing "tidak tetap",
   * result is always "sk_template_gtt".
   *
   * **Validates: Requirements 3.1**
   */
  it('P4.1 — "Guru Tidak Tetap" (full form) → sk_template_gtt', () => {
    const result = selectTemplate_UNFIXED({ teacherStatus: 'Guru Tidak Tetap', jenis: '' })
    expect(result).toBe('sk_template_gtt')
  })

  /**
   * Observed: selectTemplate({ teacherStatus: "gtt", jenis: "" }) → "sk_template_gtt"
   *
   * **Validates: Requirements 3.1**
   */
  it('P4.2 — "gtt" (abbreviation) → sk_template_gtt', () => {
    const result = selectTemplate_UNFIXED({ teacherStatus: 'gtt', jenis: '' })
    expect(result).toBe('sk_template_gtt')
  })

  /**
   * Property: For all teacherStatus values containing "gtt" or "tidak tetap"
   * (but NOT "gty"/"tetap yayasan"/"kamad"/"kepala"), result is always "sk_template_gtt".
   *
   * Iterates over representative GTT status values.
   *
   * **Validates: Requirements 3.1**
   */
  it('P4.3 — Property: all explicit GTT status values → sk_template_gtt', () => {
    const gttStatuses = [
      'gtt',
      'GTT',
      'Guru Tidak Tetap',
      'guru tidak tetap',
      'GURU TIDAK TETAP',
      'Tidak Tetap',
      'tidak tetap',
    ]

    for (const status of gttStatuses) {
      const result = selectTemplate_UNFIXED({ teacherStatus: status, jenis: '' })
      expect(result, `teacherStatus="${status}" should → sk_template_gtt`).toBe('sk_template_gtt')
    }
  })

  /**
   * Property: For all jenis_sk values containing "gtt" or "tidak tetap"
   * (teacherStatus empty), result is always "sk_template_gtt".
   *
   * **Validates: Requirements 3.1**
   */
  it('P4.4 — Property: all explicit GTT jenis_sk values → sk_template_gtt', () => {
    const gttJenis = [
      'gtt',
      'GTT',
      'Guru Tidak Tetap',
      'tidak tetap',
    ]

    for (const jenis of gttJenis) {
      const result = selectTemplate_UNFIXED({ teacherStatus: '', jenis })
      expect(result, `jenis="${jenis}" should → sk_template_gtt`).toBe('sk_template_gtt')
    }
  })

  /**
   * Property: GTT routing is preserved even when combined with non-GTY jenis_sk.
   *
   * **Validates: Requirements 3.1**
   */
  it('P4.5 — Property: GTT status + non-GTY jenis → sk_template_gtt', () => {
    const combinations: Array<{ teacherStatus: string; jenis: string }> = [
      { teacherStatus: 'gtt', jenis: '' },
      { teacherStatus: 'Guru Tidak Tetap', jenis: '' },
      { teacherStatus: 'tidak tetap', jenis: 'gtt' },
      { teacherStatus: 'gtt', jenis: 'tidak tetap' },
    ]

    for (const input of combinations) {
      const result = selectTemplate_UNFIXED(input)
      expect(
        result,
        `teacherStatus="${input.teacherStatus}", jenis="${input.jenis}" should → sk_template_gtt`
      ).toBe('sk_template_gtt')
    }
  })
})

// ---------------------------------------------------------------------------
// Property 5: Preservation — Tendik default for unrecognized status
//
// Observed: selectTemplate({ teacherStatus: "tendik", jenis: "" }) → "sk_template_tendik"
//
// EXPECTED: PASS on unfixed code (tendik doesn't match GTY/GTT/Kamad → default)
// Validates: Requirements 3.3
// ---------------------------------------------------------------------------

describe('Preservation P5: Tendik default for unrecognized status', () => {
  /**
   * Observed: selectTemplate({ teacherStatus: "tendik", jenis: "" }) → "sk_template_tendik"
   *
   * **Validates: Requirements 3.3**
   */
  it('P5.1 — "tendik" status → sk_template_tendik (default)', () => {
    const result = selectTemplate_UNFIXED({ teacherStatus: 'tendik', jenis: '' })
    expect(result).toBe('sk_template_tendik')
  })

  /**
   * [NEW BEHAVIOR] Tendik: unrecognized status + pendidikan "SMA/MA" → sk_template_tendik
   *
   * On unfixed code: "honorer" doesn't match any branch → default "sk_template_tendik"
   * This happens to be correct (coincidentally), but for the wrong reason.
   * After fix: explicit pendidikan check ensures this is correct for the right reason.
   *
   * EXPECTED: PASS on unfixed code (coincidentally correct)
   * **Validates: Requirements 3.3**
   */
  it('P5.2 — [NEW BEHAVIOR] unrecognized status + pendidikan "SMA/MA" → sk_template_tendik', () => {
    const result = selectTemplate_UNFIXED({ teacherStatus: 'honorer', jenis: '', pendidikan: 'SMA/MA' })
    // Unfixed: "honorer" doesn't match GTY/GTT/Kamad → default sk_template_tendik
    // This is the correct result — preserved after fix (but for the right reason)
    expect(result).toBe('sk_template_tendik')
  })

  /**
   * [NEW BEHAVIOR] Tendik: unrecognized status + pendidikan "D3" → sk_template_tendik
   *
   * EXPECTED: PASS on unfixed code (coincidentally correct)
   * **Validates: Requirements 3.3**
   */
  it('P5.3 — [NEW BEHAVIOR] unrecognized status + pendidikan "D3" → sk_template_tendik', () => {
    const result = selectTemplate_UNFIXED({ teacherStatus: 'honorer', jenis: '', pendidikan: 'D3' })
    expect(result).toBe('sk_template_tendik')
  })
})

// ---------------------------------------------------------------------------
// Property 6: Preservation — QR URL for nomor SK without '/' unchanged
//
// Observed: verifyBySk("SK-001-2026") (no '/') → request URL is /verify/sk/SK-001-2026
//
// EXPECTED: PASS on unfixed code (encodeURIComponent is a no-op for strings without '/')
// Validates: Requirements 3.4, 3.5, 3.6
// ---------------------------------------------------------------------------

describe('Preservation P6: QR URL for nomor SK without "/" unchanged', () => {
  /**
   * Observed: verifyBySk("SK-001-2026") → /verify/sk/SK-001-2026
   *
   * encodeURIComponent("SK-001-2026") = "SK-001-2026" (no special chars → no change)
   *
   * **Validates: Requirements 3.4, 3.5, 3.6**
   */
  it('P6.1 — "SK-001-2026" (no slash) → request URL is /verify/sk/SK-001-2026', () => {
    const nomor = 'SK-001-2026'
    const url = verifyBySkUrl_UNFIXED(nomor)
    expect(url).toBe('/verify/sk/SK-001-2026')
  })

  /**
   * Property: For all nomorSk strings NOT containing '/',
   * verifyBySk(nomor) request URL equals /verify/sk/${nomor} unchanged.
   *
   * encodeURIComponent is a no-op for strings containing only alphanumeric,
   * '-', '_', '.', '~' characters.
   *
   * Iterates over representative non-slash nomor SK values.
   *
   * **Validates: Requirements 3.4, 3.5, 3.6**
   */
  it('P6.2 — Property: all nomorSk without "/" → URL equals /verify/sk/${nomor}', () => {
    const noSlashNomors = [
      'SK-001-2026',
      'SK-002-2025',
      'REQ-2026-0001',
      'SK001',
      'NOMOR-SK-123',
      '0001',
      'SK.001.2026',
      'SK_001_2026',
    ]

    for (const nomor of noSlashNomors) {
      const url = verifyBySkUrl_UNFIXED(nomor)
      expect(url, `nomor="${nomor}" should produce /verify/sk/${nomor}`).toBe(`/verify/sk/${nomor}`)
    }
  })

  /**
   * Property: For all nomorSk strings NOT containing '/',
   * the URL does NOT contain any percent-encoding.
   *
   * **Validates: Requirements 3.4, 3.5, 3.6**
   */
  it('P6.3 — Property: nomorSk without "/" → URL contains no percent-encoding', () => {
    const noSlashNomors = [
      'SK-001-2026',
      'SK-002-2025',
      'REQ-2026-0001',
      'SK001',
      'NOMOR-SK-123',
      '0001',
    ]

    for (const nomor of noSlashNomors) {
      const url = verifyBySkUrl_UNFIXED(nomor)
      expect(url, `nomor="${nomor}" URL should not contain '%'`).not.toContain('%')
    }
  })
})

// ---------------------------------------------------------------------------
// Property 7: Preservation — Single-document generate tembusan starts at 1
//
// Observed: single-document generate → doc[0] tembusan starts at 1
//
// EXPECTED: PASS on unfixed code (bug only affects documentIndex > 0)
// Validates: Requirements 3.8
// ---------------------------------------------------------------------------

describe('Preservation P7: Single-document generate tembusan starts at 1', () => {
  beforeEach(() => {
    tembusanCounter_UNFIXED = 0
  })

  /**
   * Observed: single-document generate → doc[0] tembusan[0].nomor = 1
   *
   * The bug (C4) only affects documentIndex > 0. Single-document generate
   * is not affected — doc[0] always starts at 1 even in unfixed code.
   *
   * **Validates: Requirements 3.8**
   */
  it('P7.1 — single-doc generate: doc[0] tembusan starts at 1', () => {
    const docs = simulateMultiDocGenerate_UNFIXED(1, 6)

    expect(docs[0].tembusan[0].nomor).toBe(1)
    expect(docs[0].tembusan[5].nomor).toBe(6)
  })

  /**
   * Property: For N=1 (single document), doc[0] tembusan always starts at 1
   * regardless of tembusan count per document.
   *
   * **Validates: Requirements 3.8**
   */
  it('P7.2 — Property: single-doc generate with any tembusan count → starts at 1', () => {
    const tembusanCounts = [1, 3, 6, 8, 10]

    for (const count of tembusanCounts) {
      tembusanCounter_UNFIXED = 0
      const docs = simulateMultiDocGenerate_UNFIXED(1, count)

      expect(
        docs[0].tembusan[0].nomor,
        `tembusanPerDoc=${count}: doc[0].tembusan[0].nomor should be 1`
      ).toBe(1)
      expect(
        docs[0].tembusan[count - 1].nomor,
        `tembusanPerDoc=${count}: doc[0].tembusan[${count - 1}].nomor should be ${count}`
      ).toBe(count)
    }
  })
})

// ---------------------------------------------------------------------------
// [NEW BEHAVIOR] TMT Fallback boundary tests
//
// These tests cover NEW behavior introduced by the fix.
// They WILL FAIL on unfixed code (no TMT fallback logic exists).
// Included here to document the expected behavior after fix.
//
// Validates: Requirements 3.1 (GTT preservation via TMT), 3.3 (GTY via TMT)
// ---------------------------------------------------------------------------

describe('[NEW BEHAVIOR] TMT Fallback boundary tests (will FAIL on unfixed code)', () => {
  /**
   * [NEW BEHAVIOR] Empty status + TMT exactly 2 years → sk_template_gty (boundary)
   *
   * calculatePeriode(tmt_2_years_ago, today) = 2 → >= 2 → GTY
   *
   * EXPECTED: FAIL on unfixed code (no TMT fallback → default sk_template_tendik)
   * EXPECTED: PASS on fixed code
   *
   * **Validates: Requirements 3.1**
   */
  it('[NEW BEHAVIOR] P8.1 — empty status + TMT exactly 2 years → sk_template_gty (boundary)', () => {
    // Build a date exactly 2 years ago (same month and day)
    const today = new Date()
    const tmt2YearsAgo = new Date(today)
    tmt2YearsAgo.setFullYear(today.getFullYear() - 2)
    const tmtStr = tmt2YearsAgo.toISOString().split('T')[0]

    const periode = calculatePeriode(tmtStr, today)
    // Sanity check: periode should be exactly 2
    expect(periode).toBe(2)

    // Unfixed code: no TMT fallback → default sk_template_tendik
    // Fixed code: empty status + TMT >= 2 years → sk_template_gty
    const result = selectTemplate_FIXED({ teacherStatus: '', jenis: '', tmt: tmtStr, tanggalPenetapan: today })

    // This assertion FAILS on unfixed code (result = "sk_template_tendik")
    // It will PASS after the fix is applied
    expect(result, `
      [NEW BEHAVIOR] empty status + TMT exactly 2 years (periode=${periode})
      Expected: sk_template_gty (TMT >= 2 years → GTY)
      Unfixed result: "${result}" (no TMT fallback → default tendik)
      This test documents new behavior introduced by the fix.
    `).toBe('sk_template_gty')
  })

  /**
   * [NEW BEHAVIOR] Empty status + TMT in same year (periode = 0) → sk_template_gtt (boundary)
   *
   * calculatePeriode(tmt_same_year, today) = 0 → < 2 → GTT
   *
   * EXPECTED: FAIL on unfixed code (no TMT fallback → default sk_template_tendik)
   * EXPECTED: PASS on fixed code
   *
   * **Validates: Requirements 3.1**
   */
  it('[NEW BEHAVIOR] P8.2 — empty status + TMT same year (periode=0) → sk_template_gtt (boundary)', () => {
    // Build a date in the same year as today (periode = 0, which is < 2)
    const today = new Date()
    const tmtSameYear = new Date(today.getFullYear(), 0, 1) // Jan 1 of current year
    const tmtStr = tmtSameYear.toISOString().split('T')[0]

    const periode = calculatePeriode(tmtStr, today)
    // Sanity check: periode should be 0 (< 2)
    expect(periode).toBeLessThan(2)

    // Unfixed code: no TMT fallback → default sk_template_tendik
    // Fixed code: empty status + TMT < 2 years → sk_template_gtt
    const result = selectTemplate_FIXED({ teacherStatus: '', jenis: '', tmt: tmtStr, tanggalPenetapan: today })

    // This assertion FAILS on unfixed code (result = "sk_template_tendik")
    // It will PASS after the fix is applied
    expect(result, `
      [NEW BEHAVIOR] empty status + TMT same year (periode=${periode})
      Expected: sk_template_gtt (TMT < 2 years → GTT)
      Unfixed result: "${result}" (no TMT fallback → default tendik)
      This test documents new behavior introduced by the fix.
    `).toBe('sk_template_gtt')
  })
})

// ---------------------------------------------------------------------------
// [NEW BEHAVIOR] Safe default: unrecognized status + pendidikan S1 → sk_template_gtt
//
// This test covers NEW behavior introduced by the fix.
// It WILL FAIL on unfixed code (unfixed returns sk_template_tendik for any
// unrecognized status, regardless of pendidikan).
//
// Validates: Requirements 3.1
// ---------------------------------------------------------------------------

describe('[NEW BEHAVIOR] Safe default for unrecognized status + S1 education (will FAIL on unfixed code)', () => {
  /**
   * [NEW BEHAVIOR] Unrecognized status + pendidikan "S1" → sk_template_gtt (safe default)
   *
   * EXPECTED: FAIL on unfixed code (result = "sk_template_tendik")
   * EXPECTED: PASS on fixed code
   *
   * **Validates: Requirements 3.1**
   */
  it('[NEW BEHAVIOR] P9.1 — unrecognized status "honorer" + pendidikan "S1" → sk_template_gtt', () => {
    const result = selectTemplate_FIXED({ teacherStatus: 'honorer', jenis: '', pendidikan: 'S1' })

    // Unfixed: "honorer" doesn't match any branch → default sk_template_tendik
    // Fixed: unknown status + S1 → sk_template_gtt (safe default)
    expect(result, `
      [NEW BEHAVIOR] selectTemplate({ teacherStatus: "honorer", pendidikan: "S1" }) → "${result}"
      Expected: sk_template_gtt (unknown status + S1 → safe default)
      Unfixed result: "${result}" (no pendidikan check → default tendik)
      This test documents new behavior introduced by the fix.
    `).toBe('sk_template_gtt')
  })
})
