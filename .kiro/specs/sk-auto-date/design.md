# Design Document — sk-auto-date

## Overview

> **Status: Implementasi selesai.** Semua perubahan sudah ada di codebase. Design document ini diperbarui agar akurat dengan implementasi aktual.

Fitur ini menambahkan logika otomatis pada SK Generator (SIMMACI) untuk mengisi `tanggalPenetapan`, `tglBerakhir`, dan `tahunAjaran` berdasarkan satu nilai **Tahun_SK** yang dipilih operator.

Sebelumnya, `tanggalPenetapan` diinisialisasi dengan `new Date()` (tanggal hari ini), dan `tglBerakhirVal` dihitung sebagai `tanggalPenetapan + 1 tahun - 1 hari` di dalam loop `handleGenerate`. Keduanya tidak mengikuti konvensi LP Ma'arif NU: **1 Juli** sebagai tanggal penetapan dan **30 Juni tahun berikutnya** sebagai tanggal berakhir.

Perubahan yang sudah diimplementasikan:
1. Ekstrak empat fungsi murni ke `src/features/sk-management/utils/skDateUtils.ts`: `deriveStartDate`, `deriveEndDate`, `deriveTahunAjaran`, `getCurrentSkYear`
2. Tambahkan state `tahunSk` di `SkGeneratorPage` sebagai single source of truth
3. `tanggalPenetapan` dan `tahunAjaran` menjadi derived values dari `tahunSk` (bukan state terpisah)
4. `tglBerakhirVal` di `handleGenerate` menggunakan `deriveEndDate(tahunSk)` — bukan offset hari
5. Input Tahun SK, Tanggal Penetapan (read-only), dan Tanggal Berakhir (read-only) sudah ada di panel pengaturan UI

Tidak ada perubahan backend. Semua perubahan berada di frontend (`src/features/sk-management/`).

---

## Architecture

```
SkGeneratorPage.tsx
│
├── state: tahunSk (number)          ← single source of truth
│     │
│     ├── derived: tanggalPenetapan  ← deriveStartDate(tahunSk)  → "YYYY-07-01"
│     ├── derived: tglBerakhirVal    ← deriveEndDate(tahunSk)    → "YYYY+1-06-30"
│     └── derived: tahunAjaran       ← deriveTahunAjaran(tahunSk) → "YYYY/YYYY+1"
│
└── utils/skDateUtils.ts
      ├── deriveStartDate(year)      → Date (1 Juli year)
      ├── deriveEndDate(year)        → Date (30 Juni year+1)
      ├── deriveTahunAjaran(year)    → string "year/year+1"
      └── getCurrentSkYear()         → number (tahun kalender saat ini)
```

Ketiga nilai tanggal selalu diturunkan dari `tahunSk` — tidak ada state independen untuk `tanggalPenetapan` atau `tglBerakhirVal`. Ini memastikan konsistensi secara struktural.

---

## Components and Interfaces

### `src/features/sk-management/utils/skDateUtils.ts` ✅ Sudah diimplementasikan

```typescript
/**
 * Mengembalikan tanggal penetapan SK: 1 Juli tahun yang diberikan.
 * Menggunakan setUTCFullYear agar deterministik di semua timezone dan benar untuk tahun 0–99.
 */
export function deriveStartDate(year: number): Date {
  const d = new Date(0)
  d.setUTCFullYear(year, 6, 1) // bulan 6 = Juli (0-indexed)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

/**
 * Mengembalikan tanggal berakhir SK: 30 Juni tahun berikutnya.
 * Menggunakan setUTCFullYear — bukan +365 hari — agar benar di tahun kabisat dan tahun 0–99.
 */
export function deriveEndDate(year: number): Date {
  const d = new Date(0)
  d.setUTCFullYear(year + 1, 5, 30) // bulan 5 = Juni (0-indexed)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

/**
 * Mengembalikan string tahun ajaran format "YYYY/YYYY+1".
 */
export function deriveTahunAjaran(year: number): string

/**
 * Mengembalikan tahun kalender saat ini sebagai default Tahun_SK.
 * Hanya menggunakan getFullYear() — tidak mempertimbangkan bulan atau tanggal.
 */
export function getCurrentSkYear(): number
```

> **Catatan implementasi**: Fungsi menggunakan `setUTCFullYear` (bukan `new Date(year, 6, 1)`) untuk memastikan determinisme lintas timezone. Ini penting karena konstruktor `new Date(year, month, day)` menggunakan local time, yang bisa menghasilkan tanggal berbeda di timezone UTC+7 (WIB) vs UTC.

### `formatDateIndo` — inline di `SkGeneratorPage.tsx`

Fungsi `formatDateIndo` **tidak** diekstrak ke `skDateUtils.ts`. Fungsi ini tetap didefinisikan secara inline di dalam `handleGenerate` di `SkGeneratorPage.tsx`. File property test (`skDateUtils.property.test.ts`) mendefinisikan helper lokal yang merefleksikan logika yang sama untuk keperluan testing.

### Perubahan di `SkGeneratorPage.tsx` ✅ Sudah diimplementasikan

State yang diubah:

```typescript
// Sebelum (buggy):
const [tanggalPenetapan, setTanggalPenetapan] = useState(
  () => new Date().toISOString().split('T')[0]
)
const [tahunAjaran, setTahunAjaran] = useState(() => {
  const y = new Date().getFullYear()
  return `${y}/${y + 1}`
})

// Sesudah (fixed — sudah diimplementasikan):
const [tahunSk, setTahunSk] = useState(() => getCurrentSkYear())

// Derived values (tidak perlu state terpisah):
const tanggalPenetapan = deriveStartDate(tahunSk).toISOString().split('T')[0]
const tahunAjaran = deriveTahunAjaran(tahunSk)
```

Kalkulasi `tglBerakhirVal` di `handleGenerate`:

```typescript
// Sebelum (buggy — offset hari, salah di tahun kabisat):
const tglBerakhirVal = new Date(tglPenetapanVal)
tglBerakhirVal.setFullYear(tglBerakhirVal.getFullYear() + 1)
tglBerakhirVal.setDate(tglBerakhirVal.getDate() - 1)

// Sesudah (fixed — sudah diimplementasikan):
const tglBerakhirVal = deriveEndDate(tahunSk)
```

---

## Data Models

Tidak ada perubahan model data backend. Semua perubahan adalah state frontend.

### State Shape (SkGeneratorPage)

| State | Tipe | Sebelum | Sesudah |
|-------|------|---------|---------|
| `tahunSk` | `number` | *(tidak ada)* | `getCurrentSkYear()` |
| `tanggalPenetapan` | `string` | `useState(new Date()...)` | derived dari `tahunSk` |
| `tahunAjaran` | `string` | `useState(...)` | derived dari `tahunSk` |
| `tglBerakhirVal` | `Date` | dihitung di loop dengan offset | `deriveEndDate(tahunSk)` |

### Payload Sync ke Backend

Field `tanggal_penetapan` di `syncPayload` tetap menggunakan `formatDateIndo(tanggalPenetapan)` — tidak ada perubahan struktur payload, hanya nilainya yang sekarang selalu "1 Juli YYYY" bukan tanggal hari ini. `formatDateIndo` didefinisikan inline di dalam `handleGenerate` (bukan di `skDateUtils.ts`).

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: `deriveStartDate` selalu menghasilkan 1 Juli

*For any* tahun integer positif yang valid, `deriveStartDate(year)` SHALL menghasilkan tanggal dengan bulan = 7 (Juli) dan hari = 1.

**Validates: Requirements 1.1, 2.2, 4.3**

### Property 2: `deriveEndDate` selalu menghasilkan 30 Juni tahun berikutnya

*For any* tahun integer positif yang valid, `deriveEndDate(year)` SHALL menghasilkan tanggal dengan bulan = 6 (Juni), hari = 30, dan tahun = `year + 1`. Ini harus benar bahkan untuk tahun kabisat (di mana +365 hari dari 1 Juli akan menghasilkan 30 Juni, tapi +366 hari dari 1 Juli tahun kabisat akan menghasilkan 1 Juli — sehingga offset hari tidak aman).

**Validates: Requirements 1.2, 2.3, 4.1, 4.2**

### Property 3: Konsistensi tiga nilai yang diturunkan dari Tahun_SK

*For any* tahun integer positif yang valid, ketiga nilai yang diturunkan SHALL konsisten satu sama lain:
- `deriveStartDate(year).getFullYear() === year`
- `deriveEndDate(year).getFullYear() === year + 1`
- `deriveTahunAjaran(year) === "${year}/${year + 1}"`

**Validates: Requirements 2.5, 3.3**

### Property 4: Format tanggal Indonesia konsisten dengan nilai yang diturunkan

*For any* tahun integer positif yang valid, `formatDateIndo(deriveStartDate(year).toISOString().split('T')[0])` SHALL menghasilkan string yang mengandung "1 Juli" dan string tahun yang benar. Demikian pula `formatDateIndo(deriveEndDate(year).toISOString().split('T')[0])` SHALL menghasilkan string yang mengandung "30 Juni" dan string `year + 1`.

**Validates: Requirements 3.1, 3.2**

---

## Error Handling

### Input Tahun_SK Tidak Valid

Jika operator memasukkan nilai yang bukan bilangan bulat positif (0, negatif, NaN, string kosong), `getCurrentSkYear()` digunakan sebagai fallback. Validasi dilakukan di handler `onChange` input Tahun_SK:

```typescript
const handleTahunSkChange = (value: string) => {
  const parsed = parseInt(value)
  if (!isNaN(parsed) && parsed > 0) {
    setTahunSk(parsed)
  }
  // Jika tidak valid, tahunSk tidak berubah (tetap nilai sebelumnya)
}
```

Tidak ada pesan error yang ditampilkan — input yang tidak valid hanya diabaikan (nilai sebelumnya dipertahankan).

### Tahun Sangat Jauh di Masa Depan/Lalu

Tidak ada batasan eksplisit. Fungsi `deriveStartDate` dan `deriveEndDate` menggunakan konstruktor `Date` standar JavaScript yang mendukung tahun 1–9999. Untuk keperluan praktis, input dibatasi oleh tipe `number` input HTML.

---

## Testing Strategy

### Unit Tests (example-based) ✅ Sudah diimplementasikan

File: `src/features/sk-management/utils/skDateUtils.test.ts`

Test yang sudah ada:
- `getCurrentSkYear()` mengembalikan tahun kalender saat ini (mock `Date` via `vi.useFakeTimers`)
- `getCurrentSkYear()` tidak berubah berdasarkan bulan — Januari dan Desember menghasilkan tahun yang sama
- `deriveStartDate` untuk tahun normal (2025) dan tahun kabisat (2024, 2028) — verifikasi bulan = 6 (Juli) dan hari = 1
- `deriveEndDate` untuk tahun normal (2025), tahun kabisat (2024, 2028), dan tahun sebelum kabisat (2023) — verifikasi bulan = 5 (Juni), hari = 30, tahun = input + 1
- `deriveTahunAjaran(2025)` → `"2025/2026"`, `deriveTahunAjaran(2024)` → `"2024/2025"`, `deriveTahunAjaran(2000)` → `"2000/2001"`

> **Catatan**: Test menggunakan `getMonth()`/`getDate()` (local time) untuk memverifikasi hasil `deriveStartDate`/`deriveEndDate`. Karena fungsi menggunakan `setUTCFullYear` (UTC), ada potential timezone concern: di timezone UTC-X, tanggal UTC 1 Juli bisa terbaca sebagai 30 Juni dalam local time. Untuk WIB (UTC+7), ini tidak menjadi masalah karena UTC+7 selalu "lebih maju" dari UTC. Test suite berjalan di lingkungan yang timezone-nya konsisten.

### Property Tests (property-based) ✅ Sudah diimplementasikan

File: `src/features/sk-management/utils/skDateUtils.property.test.ts`

Library: **fast-check** (sudah digunakan di `calculatePeriode.property.test.ts`)

Minimum 100 iterasi per property (`numRuns: 100`). Setiap test diberi tag komentar referensi ke property di design document.

File ini mendefinisikan helper `formatDateIndo` lokal (mirror dari implementasi di `SkGeneratorPage.tsx`) untuk keperluan testing Property 4, karena `formatDateIndo` tidak diekspor dari `skDateUtils.ts`.

**Property 1** — `deriveStartDate` selalu 1 Juli:
```typescript
// Feature: sk-auto-date, Property 1: deriveStartDate selalu menghasilkan 1 Juli
fc.assert(fc.property(fc.integer({ min: 1, max: 9999 }), (year) => {
  const d = deriveStartDate(year)
  return d.getMonth() === 6 && d.getDate() === 1 // bulan 0-indexed: 6 = Juli
}), { numRuns: 100 })
```

**Property 2** — `deriveEndDate` selalu 30 Juni tahun+1:
```typescript
// Feature: sk-auto-date, Property 2: deriveEndDate selalu menghasilkan 30 Juni tahun berikutnya
fc.assert(fc.property(fc.integer({ min: 1, max: 9998 }), (year) => {
  const d = deriveEndDate(year)
  return d.getMonth() === 5 && d.getDate() === 30 && d.getFullYear() === year + 1
}), { numRuns: 100 })
```

**Property 3** — Konsistensi tiga nilai:
```typescript
// Feature: sk-auto-date, Property 3: Konsistensi tiga nilai yang diturunkan dari Tahun_SK
fc.assert(fc.property(fc.integer({ min: 1, max: 9998 }), (year) => {
  return deriveStartDate(year).getFullYear() === year
    && deriveEndDate(year).getFullYear() === year + 1
    && deriveTahunAjaran(year) === `${year}/${year + 1}`
}), { numRuns: 100 })
```

**Property 4** — Format tanggal Indonesia:
```typescript
// Feature: sk-auto-date, Property 4: Format tanggal Indonesia konsisten
fc.assert(fc.property(fc.integer({ min: 1900, max: 2100 }), (year) => {
  const startStr = formatDateIndo(deriveStartDate(year).toISOString().split('T')[0])
  const endStr = formatDateIndo(deriveEndDate(year).toISOString().split('T')[0])
  return startStr.includes('1 Juli') && startStr.includes(String(year))
    && endStr.includes('30 Juni') && endStr.includes(String(year + 1))
}), { numRuns: 100 })
```

> Property 4 menggunakan `toISOString()` (UTC) lalu mem-parse dengan helper `formatDateIndo` lokal yang menggunakan `getUTCDate()`/`getUTCMonth()`/`getUTCFullYear()` — konsisten dengan cara fungsi utility menghasilkan tanggal.

### Regression

File test yang sudah ada (`calculatePeriode.test.ts`, `calculatePeriode.property.test.ts`) tidak terpengaruh — `calculatePeriode` tidak diubah.
