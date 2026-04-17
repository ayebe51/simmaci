# Implementation Plan: SK Nomor Periode

## Overview

Implementasi dilakukan sepenuhnya di frontend. Langkah utama: (1) buat fungsi `calculatePeriode` sebagai utilitas murni, (2) tulis unit + property tests, (3) integrasikan ke `SkGeneratorPage.tsx` dengan update format default, logika replacement, renderData, dan tooltip UI.

## Tasks

- [x] 1. Buat fungsi `calculatePeriode` di file utilitas baru
  - Buat file `src/features/sk-management/utils/calculatePeriode.ts`
  - Implementasikan fungsi `calculatePeriode(tmt: string, tanggalCetak: Date): number`
  - Algoritma: hitung selisih tahun kalender, kurangi 1 jika bulan/hari cetak belum melewati bulan/hari TMT, kembalikan `Math.max(0, years)`
  - _Requirements: 2.1, 2.4, 2.5, 2.6_

  - [x] 1.1 Tulis unit tests untuk `calculatePeriode`
    - Test case: TMT 2000-07-01, cetak 2026-07-01 → 26 _(Requirements: 2.4)_
    - Test case: TMT 2000-10-01, cetak 2026-07-01 → 25 _(Requirements: 2.5)_
    - Test case: cetak tepat sehari sebelum ulang tahun TMT → N-1
    - Test case: cetak tepat pada hari ulang tahun TMT → N
    - Test case: cetak sehari setelah ulang tahun TMT → N
    - Test case: TMT = tanggalCetak → 0
    - Test case: tanggalCetak lebih awal dari TMT → 0 (non-negatif)
    - _Requirements: 2.1, 2.6_

  - [x] 1.2 Tulis property test untuk `calculatePeriode`
    - **Property 1: Simetri Tepat Satu Tahun** — jika cetak tepat N tahun setelah TMT, hasil = N
    - **Validates: Requirements 2.4, 2.6**
    - **Property 2: Monoton Tidak Menurun** — ∀ d1 ≤ d2, calculatePeriode(tmt, d1) ≤ calculatePeriode(tmt, d2)
    - **Validates: Requirements 2.6**
    - **Property 3: Floor** — hasil ≤ selisih tahun kalender
    - **Validates: Requirements 2.6**
    - **Property 4: Non-Negatif** — hasil selalu ≥ 0
    - **Validates: Requirements 2.6**

- [x] 2. Checkpoint — pastikan semua tests untuk `calculatePeriode` lulus
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Integrasikan `calculatePeriode` ke `SkGeneratorPage.tsx`
  - [x] 3.1 Update default `nomorFormat` state
    - Ganti `{TANGGAL}` → `{PERIODE}` pada nilai default `useState`
    - _Requirements: 1.1, 1.2, 7.1_

  - [x] 3.2 Import `calculatePeriode` dan tambahkan kalkulasi periode per guru di `handleGenerate`
    - Tambahkan `import { calculatePeriode } from "@/features/sk-management/utils/calculatePeriode"`
    - Di dalam loop, ambil `tmtRaw = t.tmt || teacher.tmt`
    - Jika `tmtRaw` tidak ada: `console.error(...)` dan `continue` (skip guru tersebut)
    - Hitung `periodeValue = calculatePeriode(tmtRaw, tglPenetapanVal)`
    - Simpan `periodeStr = String(periodeValue)`
    - _Requirements: 2.1, 2.2, 2.3, 5.2, 5.4_

  - [x] 3.3 Update chain `.replace()` pada `generatedNomor`
    - Hapus `.replace(/{TANGGAL}/g, dd)` dari chain
    - Tambahkan `.replace(/{PERIODE}/g, templateId !== "sk_template_kamad" ? periodeStr : "")` setelah replace `{NOMOR}`
    - Pertahankan semua replace lain (`{BULAN}`, `{BL_ROMA}`, `{TAHUN}`) tanpa perubahan
    - _Requirements: 1.1, 3.1, 3.2, 3.3, 3.4, 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 3.4 Tambahkan `renderData["PERIODE"]` untuk docxtemplater
    - Tambahkan `"PERIODE": templateId !== "sk_template_kamad" ? periodeStr : ""` ke objek `renderData`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4. Update UI — tambahkan tooltip/help text untuk placeholder `{PERIODE}`
  - Tambahkan `<p>` di bawah input "Format Nomor SK" yang menjelaskan semua placeholder yang tersedia
  - Sertakan penjelasan bahwa `{PERIODE}` = tahun masa kerja dari TMT sampai tanggal cetak
  - _Requirements: 7.3, 7.4_

- [x] 5. Checkpoint akhir — pastikan semua tests lulus
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks bertanda `*` bersifat opsional dan bisa dilewati untuk MVP yang lebih cepat
- `calculatePeriode` adalah fungsi murni — tidak ada side effect, mudah diuji secara isolasi
- Tidak ada perubahan backend yang diperlukan
- Kamad dikecualikan dari `{PERIODE}` di dua tempat: `generatedNomor` replacement dan `renderData`
- `{TANGGAL}` dihapus dari chain replacement; jika user mengetik manual di format field, akan dibiarkan literal (backward compatible)
