# Implementation Plan

- [x] 1. Write bug condition exploration tests (BEFORE implementing any fix)
  - **Property 1: Bug Condition** - QR Double-Encoding, Template GTY→GTT, Tembusan Counter
  - **CRITICAL**: These tests MUST FAIL on unfixed code — failure confirms the bugs exist
  - **DO NOT attempt to fix the tests or the code when they fail**
  - **NOTE**: These tests encode the expected behavior — they will validate the fixes when they pass after implementation
  - **GOAL**: Surface counterexamples that demonstrate each bug exists
  - **Scoped PBT Approach**: Scope each property to the concrete failing case(s) for reproducibility

  **C1 — Double Encoding (QR Code 404):**
  - Test that `verificationApi.verifyBySk("0001/PC.L/A.II/H-34.B/24.29/07/2026")` produces a request URL containing `%252F` (double-encoded slash) on unfixed code
  - Assert: request URL does NOT contain `%252F` (this assertion will FAIL on unfixed code)
  - Scope: any `nomorSk` string containing `/`
  - Document counterexample: `verifyBySk("0001/PC.L/...")` → request to `/verify/sk/0001%252FPC.L%252F...`
  - _Bug_Condition: isBugCondition_C1(input) where input.nomorSk CONTAINS '/'_
  - _Expected_Behavior: request URL contains `%2F` (single-encoded), NOT `%252F`_

  **C3 — Template Selection (GTY masuk GTT, Kamad seharusnya GTY, TMT fallback, Tendik berbasis pendidikan):**
  - Test that `selectTemplate({ teacherStatus: "Guru Tetap Yayasan", jenis: "" })` returns `"sk_template_gtt"` on unfixed code
  - Assert: result equals `"sk_template_gty"` (this assertion will FAIL on unfixed code)
  - Also test: `selectTemplate({ teacherStatus: "kamad", jenis: "" })` → should return `"sk_template_gty"` (Kamad = GTY)
  - Also test boundary: `teacherStatus = "guru tetap"` → should NOT return `"sk_template_gtt"`
  - Also test TMT fallback: `selectTemplate({ status: "", jenis: "", tmt: <2 years ago> })` → `"sk_template_gtt"`
  - Also test TMT fallback: `selectTemplate({ status: "", jenis: "", tmt: <3 years ago> })` → `"sk_template_gty"`
  - Also test Tendik: `selectTemplate({ status: "honorer", jenis: "", pendidikan: "SMA/MA" })` → `"sk_template_tendik"`
  - Also test Tendik: `selectTemplate({ status: "honorer", jenis: "", pendidikan: "D3" })` → `"sk_template_tendik"`
  - Also test safe default: `selectTemplate({ status: "honorer", jenis: "", pendidikan: "S1" })` → `"sk_template_gtt"`
  - Document counterexample: `selectTemplate({ teacherStatus: "Guru Tetap Yayasan" })` → `"sk_template_gtt"` instead of `"sk_template_gty"`
  - _Bug_Condition: isBugCondition_C3 — GTT too broad; no TMT fallback; no Tendik-by-education logic_
  - _Expected_Behavior: GTY/Kamad → gty; explicit GTT → gtt; empty+TMT≥2 → gty; empty+TMT<2 → gtt; unknown+<S1 → tendik; unknown+≥S1 → gtt_

  **C4 — Tembusan Counter Not Reset:**
  - Simulate generating 2 documents in sequence using the unfixed `handleGenerate` logic
  - Assert: document at index 1 has `tembusanStartNumber === 1` (this assertion will FAIL on unfixed code)
  - Document counterexample: batch of 2 → doc[0] tembusan 1–6 ✓, doc[1] tembusan 7–12 ✗
  - _Bug_Condition: isBugCondition_C4(input) where documentIndex > 0 AND tembusanCounterNotReset = true_
  - _Expected_Behavior: tembusanStartNumber = 1 for every documentIndex_

  - Run all exploration tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (this is correct — it proves the bugs exist)
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.6_

- [x] 2. Write preservation property tests (BEFORE implementing any fix)
  - **Property 2: Preservation** - Template Routing, QR URL, Tembusan Single-Doc
  - **IMPORTANT**: Follow observation-first methodology — observe UNFIXED code behavior for non-buggy inputs first
  - **GOAL**: Capture baseline behavior that must not regress after fixes

  **Observe on UNFIXED code (non-buggy inputs):**
  - Observe: `selectTemplate({ teacherStatus: "Guru Tidak Tetap", jenis: "" })` → `"sk_template_gtt"` ✓
  - Observe: `selectTemplate({ teacherStatus: "gtt", jenis: "" })` → `"sk_template_gtt"` ✓
  - Observe: `selectTemplate({ teacherStatus: "tendik", jenis: "" })` → `"sk_template_tendik"` (default) ✓
  - Observe: `verifyBySk("SK-001-2026")` (no `/`) → request URL is `/verify/sk/SK-001-2026` ✓
  - Observe: single-document generate → doc[0] tembusan starts at 1 ✓
  - Note: `selectTemplate({ teacherStatus: "kamad" })` behavior on unfixed code is irrelevant — this will intentionally change to GTY after fix

  **Write property-based tests asserting observed behavior:**
  - For all `teacherStatus` values containing "gtt" or "tidak tetap" (but NOT "gty"/"tetap yayasan"/"kamad"/"kepala") → result is always `"sk_template_gtt"`
  - For all `nomorSk` strings NOT containing `/` → `verifyBySk(nomor)` request URL equals `/verify/sk/${nomor}` unchanged
  - For single-document generate (N=1) → doc[0] tembusan starts at 1
  - For TMT fallback: empty status + TMT exactly 2 years → `"sk_template_gty"` (boundary)
  - For TMT fallback: empty status + TMT exactly 1 year 11 months → `"sk_template_gtt"` (boundary)
  - For Tendik: unrecognized status + pendidikan "SMA/MA" → `"sk_template_tendik"`
  - For Tendik: unrecognized status + pendidikan "D3" → `"sk_template_tendik"`
  - For safe default: unrecognized status + pendidikan "S1" → `"sk_template_gtt"`

  - Run all preservation tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.8_

- [x] 3. Fix all 4 SK Generator bugs

  - [x] 3.1 Bug 1: Hapus `encodeURIComponent` dari `verificationApi.verifyBySk()` di `src/lib/api.ts`
    - Locate `verifyBySk` method in `src/lib/api.ts` (around line 333)
    - Change: `apiClient.get(\`/verify/sk/${encodeURIComponent(nomor)}\`)` → `apiClient.get(\`/verify/sk/${nomor}\`)`
    - `nomor` from `useParams()` is already decoded by React Router — no additional encoding needed
    - The single encoding in `getSkVerificationUrl()` at QR generation time is sufficient
    - Verify backend route `GET /api/verify/sk/{nomor}` accepts `/` in the parameter (check Laravel route constraints)
    - _Bug_Condition: isBugCondition_C1(input) where input.nomorSk CONTAINS '/' AND verifyBySk calls encodeURIComponent_
    - _Expected_Behavior: request URL contains single-encoded %2F, not double-encoded %252F_
    - _Preservation: nomor SK tanpa '/' tetap menghasilkan URL request yang identik_
    - _Requirements: 2.1, 2.2, 3.4, 3.5, 3.6_

  - [x] 3.2 Bug 2: Tambahkan `<w:b/>` dan `<w:bCs/>` pada run XML placeholder `{NAMA}` di semua template DOCX
    - Open each DOCX template file (GTY, GTT, Kamad, Tendik) stored in backend storage
    - For each template: locate the run XML containing `{NAMA}` placeholder
    - Add `<w:rPr><w:b/><w:bCs/></w:rPr>` inside the `<w:r>` element wrapping `{NAMA}`
    - Result: `<w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t>{NAMA}</w:t></w:r>`
    - `<w:bCs/>` is required for complex script fonts (Indonesian characters)
    - Alternatively: open each template in Word/LibreOffice, select `{NAMA}` text, apply Bold, save
    - Verify all 4 templates (GTY, GTT, Kamad, Tendik) are updated
    - _Bug_Condition: isBugCondition_C2(template) where namaRunXml NOT CONTAINS '<w:b/>'_
    - _Expected_Behavior: rendered DOCX contains bold nama for all template types_
    - _Preservation: semua placeholder lain (jabatan, unit kerja, TMT, nomor SK) tidak berubah_
    - _Requirements: 2.3, 3.7_

  - [x] 3.3 Bug 3: Refactor logika pemilihan template — Kamad → GTY, hapus kondisi GTT yang terlalu broad, tambah TMT fallback dan Tendik berbasis pendidikan
    - Locate the template selection logic in `src/features/sk-management/SkGeneratorPage.tsx` inside `handleGenerate`
    - Change status source: use `t.status_kepegawaian || teacher.status` (sk_document field takes priority)
    - Extract `pendidikan` from `t.pendidikan_terakhir || teacher.pendidikan_terakhir`
    - Move Kamad conditions (`kamad`, `kepala`) into the GTY branch
    - Remove `|| teacherStatus.includes("guru")` and duplicate `|| jenis.includes("tidak tetap")` from GTT condition
    - Remove the now-unused `else if` branch for `sk_template_kamad`
    - Add TMT-based fallback when status is completely empty:
      ```typescript
      } else if (isEmpty) {
          const periodeForTemplate = tmtRaw ? calculatePeriode(tmtRaw, tglPenetapanVal) : 0
          templateId = periodeForTemplate >= 2 ? "sk_template_gty" : "sk_template_gtt"
      }
      ```
    - Add Tendik condition for unrecognized status + pendidikan below S1:
      ```typescript
      const PENDIDIKAN_TINGGI = ["s1", "s2", "s3", "d4", "s1/d4", "strata"]
      const isBelowS1 = pendidikan !== "" && !PENDIDIKAN_TINGGI.some(p => pendidikan.includes(p))
      // ...
      } else if (isBelowS1) {
          templateId = "sk_template_tendik"
      } else {
          templateId = "sk_template_gtt" // default aman untuk status tidak dikenal + pendidikan >= S1
      }
      ```
    - Final priority order:
      1. Explicit GTY/Kamad → `sk_template_gty`
      2. Explicit GTT → `sk_template_gtt`
      3. Empty status + TMT ≥ 2 years → `sk_template_gty`
      4. Empty status + TMT < 2 years or TMT empty → `sk_template_gtt`
      5. Unrecognized status + pendidikan < S1 → `sk_template_tendik`
      6. Unrecognized status + pendidikan ≥ S1 → `sk_template_gtt` (safe default)
    - _Requirements: 2.4, 2.5, 3.1, 3.3_

  - [x] 3.4 Bug 4: Reset counter tembusan di dalam loop iterasi dokumen di `SkGeneratorPage.tsx`
    - Locate the `handleGenerate` function in `src/features/sk-management/SkGeneratorPage.tsx`
    - Find the document iteration loop (`for (let i = 0; i < selectedTeachers.length; i++)`)
    - Find the tembusan counter variable (e.g., `tembusanCounter`, `tembusanIndex`, or similar)
    - If declared outside the loop: move declaration inside the loop body (reset to initial value per iteration)
    - If the tembusan array is built by appending: change to re-generate the array fresh for each document
    - Ensure each document's `renderData` receives a tembusan array with indices starting from 1
    - _Bug_Condition: isBugCondition_C4(input) where documentIndex > 0 AND tembusanCounterNotReset = true_
    - _Expected_Behavior: tembusanStartNumber = 1 for every document in the batch_
    - _Preservation: single-document generate tetap menampilkan tembusan dimulai dari 1; jumlah dan isi tembusan tidak berubah_
    - _Requirements: 2.6, 3.8, 3.9_

  - [x] 3.5 Bug 5: Tambahkan penolakan otomatis PNS di backend
    - Add `isPns(array $doc): bool` helper to `SkDocumentController` — detects PNS via status containing "pns"/"asn" OR NIP length = 18 digits
    - In `submitRequest()`: check `isPns($data)` after validation; if true, create SK document with `status = 'rejected'` and `rejection_reason = 'PTK berstatus PNS tidak dapat mengajukan SK melalui yayasan.'`, return 422
    - In `processBulkRequestSync()`: check `isPns($doc)` at start of loop; if true, create rejected SK document, increment `$skipped`, `continue`
    - In `ProcessBulkSkSubmission::handle()`: same pattern as `processBulkRequestSync()` — add `isPns` check at start of loop
    - NIP detection: strip non-digits from `nip` field, check `strlen === 18` (standard Indonesian PNS NIP format)
    - Status detection: `strtolower` check for "pns" or "asn" in `status_kepegawaian` or `status` field
    - Rejected PNS documents should still be created in DB (for audit trail) but with `status = 'rejected'`
    - _Expected_Behavior: PNS submissions are rejected at submission time, never reach the SK generator queue_
    - _Preservation: non-PNS submissions (GTY, GTT, Tendik, empty status) continue to be processed normally_
    - _Requirements: 1.6 (new), 2.6 (new)_

  - [x] 3.6 Verify bug condition exploration tests now pass
    - **Property 1: Expected Behavior** - QR Double-Encoding, Template GTY→GTT, Tembusan Counter
    - **IMPORTANT**: Re-run the SAME tests from task 1 — do NOT write new tests
    - The tests from task 1 encode the expected behavior; passing now confirms bugs are fixed
    - Run all exploration tests from step 1 against the fixed code
    - **EXPECTED OUTCOME**: All 3 exploration tests PASS (confirms all bugs are fixed)
    - _Requirements: 2.1, 2.2, 2.4, 2.5, 2.6_

  - [x] 3.7 Verify preservation tests still pass
    - **Property 2: Preservation** - Template Routing, QR URL, Tembusan Single-Doc
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run all preservation property tests from step 2 against the fixed code
    - **EXPECTED OUTCOME**: All preservation tests PASS (confirms no regressions)
    - Confirm GTT routing unchanged; QR URL for non-slash SK unchanged; single-doc tembusan unchanged
    - Note: Kamad → GTY is an intentional behavior change, not a regression — no preservation test for Kamad
    - _Requirements: 3.1, 3.3, 3.4, 3.5, 3.6, 3.8_

- [x] 4. Checkpoint — Ensure all tests pass
  - Run the full test suite: `npm run lint` and any unit tests in the frontend; `php artisan test` in the backend
  - Verify all 5 bugs are fixed end-to-end:
    - Scan QR code on a generated SK with `/` in nomor → halaman verifikasi terbuka tanpa 404
    - Open generated DOCX → nama guru tercetak bold
    - Generate SK untuk guru dengan `status_kepegawaian = "Guru Tetap Yayasan"` → template GTY digunakan
    - Generate SK untuk guru dengan status Kamad/Kepala → template GTY digunakan
    - Generate SK untuk guru dengan status kosong + TMT 3 tahun → template GTY digunakan
    - Generate SK untuk guru dengan status kosong + TMT 1 tahun → template GTT digunakan
    - Generate SK untuk PTK dengan pendidikan SMA/MA dan status tidak dikenal → template Tendik digunakan
    - Generate SK batch 3 guru → setiap dokumen memiliki nomor tembusan dimulai dari 1
    - Submit pengajuan SK untuk PTK dengan status PNS → ditolak otomatis dengan pesan yang jelas
    - Submit pengajuan SK untuk PTK dengan NIP 18 digit → ditolak otomatis
  - Ensure all tests pass; ask the user if questions arise
