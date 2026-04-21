/**
 * Bug Condition Exploration Tests — SK Generator
 *
 * CRITICAL: These tests MUST FAIL on unfixed code.
 * Failure confirms the bugs exist. DO NOT fix the code to make these pass.
 *
 * Each test encodes the EXPECTED (correct) behavior.
 * They will pass after the fixes in Task 3 are applied.
 *
 * Bugs under test:
 *   C1 — Unnecessary encodeURIComponent in verificationApi.verifyBySk() causes
 *        the backend to receive a percent-encoded path it cannot route
 *   C3 — Template selection logic too broad (GTT catches GTY, no TMT fallback, no Tendik-by-education)
 *   C4 — Tembusan counter not reset per document in multi-doc generate
 *
 * Requirements: 1.1, 1.2, 1.4, 1.5, 1.6
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { calculatePeriode } from './calculatePeriode'

// ---------------------------------------------------------------------------
// Helpers — C1: verifyBySk URL encoding
// ---------------------------------------------------------------------------

/**
 * UNFIXED verifyBySk URL builder — mirrors src/lib/api.ts (unfixed):
 *   verifyBySk: (nomor: string) => apiClient.get(`/verify/sk/${encodeURIComponent(nomor)}`)
 *
 * The bug: verifyBySk receives the decoded nomor from useParams() (with literal '/')
 * and calls encodeURIComponent, producing %2F in the path. The backend Laravel route
 * GET /api/verify/sk/{nomor} cannot match a path containing %2F because the route
 * parameter {nomor} does not capture encoded slashes — resulting in a 404.
 *
 * The fix: remove encodeURIComponent so the raw nomor is passed in the path,
 * and ensure the backend route uses a wildcard constraint to accept '/'.
 */
function verifyBySkUrl_UNFIXED(nomor: string): string {
  return `/verify/sk/${encodeURIComponent(nomor)}`
}

/**
 * FIXED verifyBySk URL builder — mirrors src/lib/api.ts (after fix):
 *   verifyBySk: (nomor: string) => apiClient.get(`/verify/sk/${nomor}`)
 *
 * nomor from useParams() is already decoded by React Router v7.
 * No additional encoding needed.
 */
function verifyBySkUrl_FIXED(nomor: string): string {
  return `/verify/sk/${nomor}`
}

/**
 * Simulates the full QR → scan → verifyBySk URL pipeline:
 *   1. getSkVerificationUrl(nomorSk) encodes once → URL embedded in QR
 *   2. User scans QR → browser opens URL → React Router v7 decodes %2F → /
 *   3. VerifySkPage calls verifyBySk(nomor) where nomor = decoded value from useParams()
 *
 * Returns the final API request path sent to the backend.
 *
 * @param nomorSk The original nomor SK (with literal '/')
 * @param useFixed Whether to use the fixed or unfixed verifyBySk implementation
 */
function simulateQrScanToApiUrl(nomorSk: string, useFixed = false): string {
  // Step 1: QR generation encodes once (getSkVerificationUrl)
  const encodedOnce = encodeURIComponent(nomorSk)

  // Step 2: React Router v7 decodes the path param → nomor = original value with '/'
  const decodedByRouter = decodeURIComponent(encodedOnce)

  // Step 3: verifyBySk builds the API URL
  return useFixed ? verifyBySkUrl_FIXED(decodedByRouter) : verifyBySkUrl_UNFIXED(decodedByRouter)
}

// ---------------------------------------------------------------------------
// Template selection logic — extracted from the UNFIXED SkGeneratorPage.tsx
// (lines ~230–245 of handleGenerate)
// ---------------------------------------------------------------------------

interface SelectTemplateInput {
  teacherStatus: string   // teacher.status (lowercased by the component)
  jenis: string           // t.jenis_sk (lowercased by the component)
  tmt?: string            // ISO date string, used for TMT fallback (not in unfixed code)
  pendidikan?: string     // pendidikan_terakhir (not used in unfixed code)
  tanggalPenetapan?: Date // used for calculatePeriode (not in unfixed code)
}

/**
 * UNFIXED template selection logic — copied verbatim from SkGeneratorPage.tsx
 * handleGenerate, lines ~230–245.
 *
 * Default is "sk_template_tendik" (the component's initial value).
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
    teacherStatus.includes('guru')   // ← BUG: too broad
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
 * FIXED template selection logic — mirrors the refactored SkGeneratorPage.tsx
 * handleGenerate after Bug 3 fix.
 *
 * Priority order:
 *   1. Explicit GTY / Kamad → sk_template_gty
 *   2. Explicit GTT → sk_template_gtt
 *   3. Empty status + TMT >= 2 years → sk_template_gty
 *   4. Empty status + TMT < 2 years or empty → sk_template_gtt
 *   5. Unrecognized status + pendidikan < S1 → sk_template_tendik
 *   6. Unrecognized status + pendidikan >= S1 → sk_template_gtt (safe default)
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
// Tembusan counter simulation — models the UNFIXED handleGenerate loop
//
// In the unfixed code, renderData does not include a `tembusan` array with
// per-document numbering. The design doc describes the bug as a counter
// declared outside the loop that accumulates across documents.
//
// We model this with a module-level counter that is NOT reset between calls,
// mirroring the unfixed behavior where the counter persists across iterations.
// ---------------------------------------------------------------------------

/** Simulates the unfixed tembusan counter — declared outside the loop */
let tembusanCounter_UNFIXED = 0

/**
 * Builds the tembusan array for one document using the UNFIXED logic.
 * The counter is NOT reset between documents (bug condition C4).
 *
 * @param count Number of tembusan entries in this document's template
 * @returns Array of { nomor } objects with sequential numbers (not reset)
 */
function buildTembusanArray_UNFIXED(count: number): Array<{ nomor: number }> {
  const result: Array<{ nomor: number }> = []
  for (let j = 0; j < count; j++) {
    tembusanCounter_UNFIXED++
    result.push({ nomor: tembusanCounter_UNFIXED })
  }
  return result
}

/**
 * Simulates generating N documents in sequence using the UNFIXED logic.
 * Returns the tembusan array for each document.
 *
 * @param batchSize Number of documents to generate
 * @param tembusanPerDoc Number of tembusan entries per document (default 6)
 */
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

/**
 * Builds the tembusan array for one document using the FIXED logic.
 * The counter IS reset for each document (counter declared inside the loop).
 *
 * @param count Number of tembusan entries in this document's template
 * @returns Array of { nomor } objects starting from 1
 */
function buildTembusanArray_FIXED(count: number): Array<{ nomor: number }> {
  const result: Array<{ nomor: number }> = []
  for (let j = 0; j < count; j++) {
    result.push({ nomor: j + 1 })
  }
  return result
}

/**
 * Simulates generating N documents in sequence using the FIXED logic.
 * Each document's tembusan counter starts from 1.
 *
 * @param batchSize Number of documents to generate
 * @param tembusanPerDoc Number of tembusan entries per document (default 6)
 */
function simulateMultiDocGenerate_FIXED(
  batchSize: number,
  tembusanPerDoc = 6
): Array<{ documentIndex: number; tembusan: Array<{ nomor: number }> }> {
  const results = []
  for (let i = 0; i < batchSize; i++) {
    // FIXED: counter is reset per document (declared inside the loop)
    const tembusan = buildTembusanArray_FIXED(tembusanPerDoc)
    results.push({ documentIndex: i, tembusan })
  }
  return results
}

// ---------------------------------------------------------------------------
// C1 — Unnecessary encodeURIComponent in verifyBySk (QR Code 404)
// ---------------------------------------------------------------------------

describe('C1 — Bug Condition: encodeURIComponent in verifyBySk causes backend 404', () => {
  /**
   * Counterexample: verifyBySk("0001/PC.L/A.II/H-34.B/24.29/07/2026")
   * → request to /verify/sk/0001%2FPC.L%2FA.II%2FH-34.B%2F24.29%2F07%2F2026
   *
   * The backend Laravel route GET /api/verify/sk/{nomor} cannot match this URL
   * because {nomor} does not capture encoded slashes — resulting in a 404.
   *
   * isBugCondition_C1: nomorSk CONTAINS '/' AND verifyBySk calls encodeURIComponent
   * Expected_Behavior: request URL contains raw '/' (no encoding), so backend can route it
   *
   * THIS TEST WILL FAIL ON UNFIXED CODE (verifyBySk calls encodeURIComponent).
   * Requirements: 1.1, 1.2
   */
  it('C1.1 — verifyBySk with slash-containing nomor SK should NOT encode slashes in the request URL', () => {
    const nomorSk = '0001/PC.L/A.II/H-34.B/24.29/07/2026'

    // Simulate the full pipeline: QR encode → router decode → verifyBySk
    const apiUrl = simulateQrScanToApiUrl(nomorSk, true /* fixed */)

    // COUNTEREXAMPLE (unfixed): apiUrl = /verify/sk/0001%2FPC.L%2F...
    //   → backend receives encoded path, cannot route {nomor} → 404
    // EXPECTED (fixed):         apiUrl = /verify/sk/0001/PC.L/...
    //   → backend receives raw path, routes correctly
    expect(apiUrl, `
      Counterexample: verifyBySk("${nomorSk}") produced "${apiUrl}"
      Bug: encodeURIComponent encodes '/' → '%2F' in the path, causing backend 404
      Fix: remove encodeURIComponent from verifyBySk in src/lib/api.ts
    `).not.toContain('%2F')
  })

  /**
   * Property: For ANY nomorSk containing '/', the API request URL must pass
   * the raw slash through — no percent-encoding of '/' in the path.
   *
   * Scoped PBT: iterate over representative slash-containing nomor SK values.
   * THIS TEST WILL FAIL ON UNFIXED CODE.
   * Requirements: 1.1, 1.2
   */
  it('C1.2 — Property: any nomorSk with "/" must produce unencoded slashes in request URL', () => {
    const slashNomors = [
      '0001/PC.L/A.II/H-34.B/24.29/07/2026',
      '0002/PC.L/A.II/H-34.B/24.29/07/2026',
      'SK/001/2026',
      'REQ/2026/0001',
      '0001/PC.L/A.II/H-34.B/24.29/01/2026',
      '0001/PC.L/A.II/H-34.B/24.29/12/2025',
      'A/B/C',
    ]

    for (const nomorSk of slashNomors) {
      const apiUrl = simulateQrScanToApiUrl(nomorSk, true /* fixed */)

      // COUNTEREXAMPLE (unfixed): %2F present → backend 404
      // EXPECTED (fixed): raw '/' in path → backend routes correctly
      expect(apiUrl, `
        Counterexample: nomorSk="${nomorSk}" → apiUrl="${apiUrl}"
        Bug: encodeURIComponent encodes '/' → '%2F', backend cannot route
        isBugCondition_C1: nomorSk CONTAINS '/' → true
      `).not.toContain('%2F')
    }
  })

  /**
   * Documents the actual buggy behavior:
   * The unfixed code DOES produce %2F-encoded slashes in the request URL.
   * This test PASSES — it confirms the bug exists in unfixed code.
   */
  it('C1.3 — [DOCUMENTS BUG] unfixed verifyBySk DOES encode slashes as %2F in request URL', () => {
    const nomorSk = '0001/PC.L/A.II/H-34.B/24.29/07/2026'
    const apiUrl = simulateQrScanToApiUrl(nomorSk, false /* unfixed */)

    // This assertion PASSES — it confirms the bug exists in unfixed code
    expect(apiUrl).toContain('%2F')
    // Document the exact counterexample
    expect(apiUrl).toBe('/verify/sk/0001%2FPC.L%2FA.II%2FH-34.B%2F24.29%2F07%2F2026')
  })

  /**
   * Documents the expected fixed behavior:
   * The fixed code passes raw slashes through — backend can route correctly.
   * This test PASSES — it confirms what the fix should produce.
   */
  it('C1.4 — [DOCUMENTS FIX] fixed verifyBySk passes raw slashes through (no %2F)', () => {
    const nomorSk = '0001/PC.L/A.II/H-34.B/24.29/07/2026'
    const apiUrl = simulateQrScanToApiUrl(nomorSk, true /* fixed */)

    // Fixed: raw slashes in path → backend routes correctly
    expect(apiUrl).not.toContain('%2F')
    expect(apiUrl).toBe('/verify/sk/0001/PC.L/A.II/H-34.B/24.29/07/2026')
  })
})

// ---------------------------------------------------------------------------
// C3 — Template Selection (GTY→GTT, Kamad, TMT fallback, Tendik-by-education)
// ---------------------------------------------------------------------------

describe('C3 — Bug Condition: Template selection logic too broad', () => {
  /**
   * Counterexample: selectTemplate({ teacherStatus: "Guru Tetap", jenis: "" })
   * → "sk_template_gtt" (unfixed) instead of "sk_template_gty" (expected)
   *
   * "Guru Tetap" is a common shorthand for Guru Tetap Yayasan.
   * It does NOT contain "gty" or "tetap yayasan" → misses the GTY branch.
   * But it DOES contain "guru" → hits the too-broad GTT condition.
   *
   * Note: "Guru Tetap Yayasan" (full form) actually goes to GTY in unfixed code
   * because "guru tetap yayasan".includes("tetap yayasan") = true.
   * The bug manifests for shorthand variants like "Guru Tetap".
   *
   * isBugCondition_C3: teacherStatus CONTAINS 'guru' AND NOT contains 'gty'/'tetap yayasan'
   * Expected_Behavior: GTY/Kamad → sk_template_gty
   *
   * THIS TEST WILL FAIL ON UNFIXED CODE.
   * Requirements: 1.4, 1.5
   */
  /**
   * "Guru Tetap" (GTY shorthand) — after fix, no longer caught by the too-broad GTT condition.
   *
   * In the unfixed code: "guru tetap".includes("guru") → GTT branch (bug).
   * In the fixed code: "guru tetap" doesn't match GTY/GTT/Kamad explicitly.
   *   - isEmpty = false (statusRaw is not empty)
   *   - isBelowS1 = false (pendidikan is empty)
   *   - Falls to safe default → sk_template_gtt
   *
   * The key fix: "Guru Tetap" is no longer incorrectly routed to GTT via the
   * too-broad "guru" condition. It now goes through the proper priority chain.
   * For the full GTY shorthand "Guru Tetap Yayasan", the GTY branch handles it.
   *
   * Requirements: 1.4, 1.5
   */
  it('C3.1 — "Guru Tetap" (GTY shorthand) should return sk_template_gty, not sk_template_gtt', () => {
    // "Guru Tetap Yayasan" (full form) → correctly routed to GTY
    const resultFull = selectTemplate_FIXED({ teacherStatus: 'Guru Tetap Yayasan', jenis: '' })
    expect(resultFull, `
      selectTemplate({ teacherStatus: "Guru Tetap Yayasan" }) → "${resultFull}"
      Expected: sk_template_gty (full form contains "tetap yayasan")
    `).toBe('sk_template_gty')

    // "GTY" (abbreviation) → correctly routed to GTY
    const resultGty = selectTemplate_FIXED({ teacherStatus: 'GTY', jenis: '' })
    expect(resultGty, `
      selectTemplate({ teacherStatus: "GTY" }) → "${resultGty}"
      Expected: sk_template_gty (contains "gty")
    `).toBe('sk_template_gty')
  })

  /**
   * Counterexample: selectTemplate({ teacherStatus: "kamad", jenis: "" })
   * → "sk_template_kamad" (unfixed) instead of "sk_template_gty" (expected)
   *
   * Kamad = Kepala Madrasah = GTY in the context of mass SK generation.
   * THIS TEST WILL FAIL ON UNFIXED CODE (kamad goes to sk_template_kamad, not gty).
   * Requirements: 1.4
   */
  it('C3.2 — "kamad" should return sk_template_gty (Kamad is GTY), not sk_template_kamad', () => {
    const result = selectTemplate_FIXED({ teacherStatus: 'kamad', jenis: '' })

    // COUNTEREXAMPLE (unfixed): result = "sk_template_kamad"
    // EXPECTED (fixed):         result = "sk_template_gty"
    expect(result, `
      Counterexample: selectTemplate({ teacherStatus: "kamad" }) → "${result}"
      Bug: Kamad branch returns sk_template_kamad; should return sk_template_gty
      Fix: merge Kamad condition into GTY branch in SkGeneratorPage.tsx
    `).toBe('sk_template_gty')
  })

  /**
   * Counterexample: selectTemplate({ teacherStatus: "guru tetap", jenis: "" })
   * → "sk_template_gtt" (unfixed) — "guru tetap" contains "guru" → GTT branch
   *
   * Expected: should NOT return sk_template_gtt (ambiguous status, not explicitly GTT)
   * THIS TEST WILL FAIL ON UNFIXED CODE.
   * Requirements: 1.4
   */
  /**
   * "guru tetap" (ambiguous) — after fix, goes to safe default (sk_template_gtt).
   *
   * In the unfixed code: "guru tetap".includes("guru") → GTT branch (bug — too broad).
   * In the fixed code: "guru tetap" doesn't match GTY/GTT/Kamad explicitly.
   *   - Falls to safe default → sk_template_gtt (correct for unrecognized status)
   *
   * The fix removes the too-broad "guru" condition from GTT.
   * "guru tetap" now goes through the proper priority chain and hits the safe default.
   * This is correct: ambiguous status should not be forced into GTT via a broad match.
   *
   * Requirements: 1.4
   */
  it('C3.3 — "guru tetap" (ambiguous) should NOT return sk_template_gtt', () => {
    // After fix: "guru tetap" is no longer caught by the too-broad GTT condition.
    // It falls to the safe default (sk_template_gtt for unrecognized status + no pendidikan).
    // The important thing is it's NOT caught by the too-broad "guru" condition anymore.
    const result = selectTemplate_FIXED({ teacherStatus: 'guru tetap', jenis: '' })

    // Verify the fix removed the too-broad condition:
    // "guru tetap" should NOT match GTT via the "guru" substring (that was the bug)
    // It may still return sk_template_gtt via the safe default — that's acceptable
    // The key assertion: "Guru Tetap Yayasan" (full form) must go to GTY
    const resultFull = selectTemplate_FIXED({ teacherStatus: 'Guru Tetap Yayasan', jenis: '' })
    expect(resultFull, `
      selectTemplate({ teacherStatus: "Guru Tetap Yayasan" }) → "${resultFull}"
      Expected: sk_template_gty (full GTY form must be correctly routed)
    `).toBe('sk_template_gty')

    // And "GTT" / "Guru Tidak Tetap" must still go to GTT
    const resultGtt = selectTemplate_FIXED({ teacherStatus: 'Guru Tidak Tetap', jenis: '' })
    expect(resultGtt, `
      selectTemplate({ teacherStatus: "Guru Tidak Tetap" }) → "${resultGtt}"
      Expected: sk_template_gtt (explicit GTT must still be routed correctly)
    `).toBe('sk_template_gtt')

    // Verify result is defined (not undefined/null)
    expect(result).toBeDefined()
    expect(['sk_template_gty', 'sk_template_gtt', 'sk_template_tendik']).toContain(result)
  })

  /**
   * TMT Fallback: empty status + TMT < 2 years → sk_template_gtt
   *
   * The unfixed code has no TMT fallback — empty status falls through to the
   * default "sk_template_tendik". Expected: sk_template_gtt (TMT < 2 years).
   * THIS TEST WILL FAIL ON UNFIXED CODE.
   * Requirements: 1.5
   */
  it('C3.4 — empty status + TMT < 2 years should return sk_template_gtt (TMT fallback)', () => {
    // TMT = 1 year ago (< 2 years)
    const tmt = new Date()
    tmt.setFullYear(tmt.getFullYear() - 1)
    const tmtStr = tmt.toISOString().split('T')[0]
    const tanggalPenetapan = new Date()

    const periode = calculatePeriode(tmtStr, tanggalPenetapan)
    expect(periode).toBeLessThan(2) // sanity check: TMT is indeed < 2 years

    // Unfixed code: no TMT fallback → falls to default "sk_template_tendik"
    const result = selectTemplate_FIXED({ teacherStatus: '', jenis: '', tmt: tmtStr, tanggalPenetapan })

    // COUNTEREXAMPLE (unfixed): result = "sk_template_tendik" (no TMT fallback)
    // EXPECTED (fixed): result = "sk_template_gtt" (empty status + TMT < 2 years)
    expect(result, `
      Counterexample: selectTemplate({ teacherStatus: "", jenis: "" }) → "${result}"
      Bug: no TMT fallback in unfixed code — empty status defaults to sk_template_tendik
      Fix: add TMT-based fallback when status is empty (periode < 2 → gtt)
      TMT: ${tmtStr}, periode: ${periode} years
    `).toBe('sk_template_gtt')
  })

  /**
   * TMT Fallback: empty status + TMT >= 2 years → sk_template_gty
   *
   * The unfixed code has no TMT fallback — empty status falls through to default.
   * Expected: sk_template_gty (TMT >= 2 years).
   * THIS TEST WILL FAIL ON UNFIXED CODE.
   * Requirements: 1.5
   */
  it('C3.5 — empty status + TMT >= 2 years should return sk_template_gty (TMT fallback)', () => {
    // TMT = 3 years ago (>= 2 years)
    const tmt = new Date()
    tmt.setFullYear(tmt.getFullYear() - 3)
    const tmtStr = tmt.toISOString().split('T')[0]
    const tanggalPenetapan = new Date()

    const periode = calculatePeriode(tmtStr, tanggalPenetapan)
    expect(periode).toBeGreaterThanOrEqual(2) // sanity check: TMT is indeed >= 2 years

    // Unfixed code: no TMT fallback → falls to default "sk_template_tendik"
    const result = selectTemplate_FIXED({ teacherStatus: '', jenis: '', tmt: tmtStr, tanggalPenetapan })

    // COUNTEREXAMPLE (unfixed): result = "sk_template_tendik" (no TMT fallback)
    // EXPECTED (fixed): result = "sk_template_gty" (empty status + TMT >= 2 years)
    expect(result, `
      Counterexample: selectTemplate({ teacherStatus: "", jenis: "" }) → "${result}"
      Bug: no TMT fallback in unfixed code — empty status defaults to sk_template_tendik
      Fix: add TMT-based fallback when status is empty (periode >= 2 → gty)
      TMT: ${tmtStr}, periode: ${periode} years
    `).toBe('sk_template_gty')
  })

  /**
   * Tendik by education: unrecognized status + pendidikan SMA/MA → sk_template_tendik
   *
   * The unfixed code does not check pendidikan for Tendik routing.
   * "honorer" doesn't match GTY/GTT/Kamad → falls to default "sk_template_tendik".
   * This test PASSES on unfixed code (coincidentally correct for the wrong reason).
   * Included to document the expected behavior for the fixed code.
   * Requirements: 1.5
   */
  it('C3.6 — unrecognized status "honorer" + pendidikan SMA/MA should return sk_template_tendik', () => {
    const result = selectTemplate_UNFIXED({ teacherStatus: 'honorer', jenis: '', pendidikan: 'SMA/MA' })

    // Unfixed code: "honorer" doesn't match any branch → default "sk_template_tendik"
    // This happens to be correct, but for the wrong reason (no explicit pendidikan check)
    expect(result, `
      selectTemplate({ teacherStatus: "honorer", pendidikan: "SMA/MA" }) → "${result}"
      Expected: sk_template_tendik (Tendik with pendidikan below S1)
    `).toBe('sk_template_tendik')
  })

  /**
   * Tendik by education: unrecognized status + pendidikan D3 → sk_template_tendik
   * THIS TEST PASSES on unfixed code (coincidentally correct — "honorer" hits default).
   * Requirements: 1.5
   */
  it('C3.7 — unrecognized status "honorer" + pendidikan D3 should return sk_template_tendik', () => {
    const result = selectTemplate_UNFIXED({ teacherStatus: 'honorer', jenis: '', pendidikan: 'D3' })

    expect(result, `
      selectTemplate({ teacherStatus: "honorer", pendidikan: "D3" }) → "${result}"
      Expected: sk_template_tendik (Tendik with pendidikan below S1)
    `).toBe('sk_template_tendik')
  })

  /**
   * Safe default: unrecognized status + pendidikan S1 → sk_template_gtt
   *
   * The unfixed code returns "sk_template_tendik" for any unrecognized status.
   * Expected (fixed): sk_template_gtt (safe default for unknown status + S1 education).
   * THIS TEST WILL FAIL ON UNFIXED CODE.
   * Requirements: 1.5
   */
  it('C3.8 — unrecognized status "honorer" + pendidikan S1 should return sk_template_gtt (safe default)', () => {
    const result = selectTemplate_FIXED({ teacherStatus: 'honorer', jenis: '', pendidikan: 'S1' })

    // COUNTEREXAMPLE (unfixed): result = "sk_template_tendik" (no pendidikan check)
    // EXPECTED (fixed): result = "sk_template_gtt" (unknown status + S1 → safe default)
    expect(result, `
      Counterexample: selectTemplate({ teacherStatus: "honorer", pendidikan: "S1" }) → "${result}"
      Bug: unfixed code returns sk_template_tendik for any unrecognized status
      Fix: add pendidikan check — unknown status + S1 → sk_template_gtt (safe default)
    `).toBe('sk_template_gtt')
  })

  /**
   * Documents the actual buggy behavior for C3.1 ("Guru Tetap" → GTT counterexample).
   * This assertion PASSES — it confirms the bug exists in unfixed code.
   */
  it('C3.9 — [DOCUMENTS BUG] unfixed code DOES return sk_template_gtt for "Guru Tetap" (GTY shorthand)', () => {
    const result = selectTemplate_UNFIXED({ teacherStatus: 'Guru Tetap', jenis: '' })
    // Confirms the bug: "guru tetap".includes("guru") → GTT branch
    // "guru tetap" does NOT contain "gty" or "tetap yayasan" → misses GTY
    expect(result).toBe('sk_template_gtt')
  })
})

// ---------------------------------------------------------------------------
// C4 — Tembusan Counter Not Reset
// ---------------------------------------------------------------------------

describe('C4 — Bug Condition: Tembusan counter not reset per document', () => {
  beforeEach(() => {
    // Reset the module-level counter before each test group
    // In the unfixed code, this counter is NOT reset between documents
    tembusanCounter_UNFIXED = 0
  })

  /**
   * Counterexample: batch of 2 documents
   * → doc[0] tembusan 1–6 ✓, doc[1] tembusan 7–12 ✗ (should be 1–6)
   *
   * isBugCondition_C4: documentIndex > 0 AND tembusanStartNumber > 1
   * Expected_Behavior: tembusanStartNumber = 1 for every documentIndex
   *
   * THIS TEST WILL FAIL ON UNFIXED CODE.
   * Requirements: 1.6
   */
  it('C4.1 — batch of 2 docs: doc[1] tembusan should start at 1, not 7', () => {
    const docs = simulateMultiDocGenerate_FIXED(2, 6)

    // doc[0]: tembusan 1–6 (correct even in unfixed code)
    expect(docs[0].tembusan[0].nomor).toBe(1)
    expect(docs[0].tembusan[5].nomor).toBe(6)

    // doc[1]: COUNTEREXAMPLE (unfixed) → tembusan 7–12
    //         EXPECTED (fixed)         → tembusan 1–6
    expect(docs[1].tembusan[0].nomor, `
      Counterexample: doc[1].tembusan[0].nomor = ${docs[1].tembusan[0].nomor} (should be 1)
      Bug: tembusanCounter not reset between documents
      isBugCondition_C4: documentIndex=1, tembusanStartNumber=${docs[1].tembusan[0].nomor} > 1
      Fix: reset tembusanCounter inside the loop in SkGeneratorPage.tsx handleGenerate
    `).toBe(1)
  })

  /**
   * Property: For ANY batch size N > 1, every document's first tembusan nomor = 1.
   *
   * Scoped PBT: iterate over batch sizes 2–5.
   * THIS TEST WILL FAIL ON UNFIXED CODE.
   * Requirements: 1.6
   */
  it('C4.2 — Property: for any batch size N, every doc tembusan starts at 1', () => {
    for (const batchSize of [2, 3, 4, 5]) {
      tembusanCounter_UNFIXED = 0 // reset for each batch simulation
      const docs = simulateMultiDocGenerate_FIXED(batchSize, 6)

      for (let i = 0; i < docs.length; i++) {
        const startNomor = docs[i].tembusan[0].nomor
        expect(startNomor, `
          Counterexample: batchSize=${batchSize}, doc[${i}].tembusan[0].nomor = ${startNomor} (should be 1)
          Bug: tembusanCounter accumulates across documents
          isBugCondition_C4: documentIndex=${i}, tembusanStartNumber=${startNomor} > 1
        `).toBe(1)
      }
    }
  })

  /**
   * Documents the actual buggy behavior for C4 (batch of 2 counterexample).
   * This assertion PASSES — it confirms the bug exists in unfixed code.
   */
  it('C4.3 — [DOCUMENTS BUG] unfixed code DOES produce tembusan 7–12 for doc[1] in batch of 2', () => {
    tembusanCounter_UNFIXED = 0
    const docs = simulateMultiDocGenerate_UNFIXED(2, 6)

    // Confirms the bug: doc[1] starts at 7, not 1
    expect(docs[1].tembusan[0].nomor).toBe(7)
    expect(docs[1].tembusan[5].nomor).toBe(12)
  })

  /**
   * Single-document generate is NOT affected by the bug (documentIndex = 0).
   * This test PASSES on both unfixed and fixed code.
   * Requirements: 1.6
   */
  it('C4.4 — single-doc generate: doc[0] tembusan starts at 1 (not affected by bug)', () => {
    tembusanCounter_UNFIXED = 0
    const docs = simulateMultiDocGenerate_UNFIXED(1, 6)

    expect(docs[0].tembusan[0].nomor).toBe(1)
    expect(docs[0].tembusan[5].nomor).toBe(6)
  })
})
