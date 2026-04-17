# Design Document: SK Nomor Periode

## Overview

Fitur ini mengganti placeholder `{TANGGAL}` pada format nomor SK dengan `{PERIODE}` yang merepresentasikan masa kerja guru dalam tahun penuh (floor) dari TMT sampai tanggal cetak SK. Perubahan dilakukan sepenuhnya di frontend (`SkGeneratorPage.tsx`) tanpa perubahan backend.

Scope perubahan:
1. Fungsi murni `calculatePeriode` untuk menghitung masa kerja
2. Update default format string
3. Update logika `nomorFormat` replacement di `handleGenerate`
4. Tambah `renderData["PERIODE"]` untuk docxtemplater
5. Tooltip/help text di UI

---

## High-Level Design

```
SkGeneratorPage
│
├── State: nomorFormat (default: "{NOMOR}/PC.L/A.II/H-34.B/24.29/{PERIODE}/{BULAN}/{TAHUN}")
│
└── handleGenerate()
    ├── untuk setiap guru:
    │   ├── ambil tmt dari t.tmt || teacher.tmt
    │   ├── calculatePeriode(tmt, tanggalPenetapan) → number
    │   ├── jika bukan Kamad: replace {PERIODE} → periodeStr
    │   ├── jika Kamad: skip {PERIODE} (format Kamad berbeda)
    │   └── renderData["PERIODE"] = periodeStr
    └── placeholder lain tetap sama
```

---

## Low-Level Design

### 1. Fungsi `calculatePeriode`

Fungsi murni yang diekstrak ke file utilitas terpisah agar mudah diuji.

**Lokasi**: `src/features/sk-management/utils/calculatePeriode.ts`

```typescript
/**
 * Menghitung periode masa kerja guru dalam tahun penuh (floor).
 * Bulan diperhitungkan: jika bulan/tanggal cetak belum mencapai bulan/tanggal TMT
 * di tahun yang sama, maka tahun dikurangi 1.
 *
 * Contoh:
 *   TMT: 2000-07-01, cetak: 2026-07-01 → 26
 *   TMT: 2000-10-01, cetak: 2026-07-01 → 25
 */
export function calculatePeriode(tmt: string, tanggalCetak: Date): number {
  const tmtDate = new Date(tmt)
  let years = tanggalCetak.getFullYear() - tmtDate.getFullYear()

  const monthDiff = tanggalCetak.getMonth() - tmtDate.getMonth()
  const dayDiff = tanggalCetak.getDate() - tmtDate.getDate()

  // Belum genap ulang tahun TMT di tahun ini
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    years -= 1
  }

  return Math.max(0, years)
}
```

**Algoritma**:
1. Hitung selisih tahun kalender: `cetak.year - tmt.year`
2. Cek apakah bulan/hari cetak sudah melewati bulan/hari TMT di tahun berjalan
3. Jika belum, kurangi 1 (belum genap satu tahun penuh)
4. Kembalikan `max(0, years)` untuk mencegah nilai negatif

**Tabel kebenaran**:

| TMT | Tanggal Cetak | Selisih Tahun Kalender | Koreksi | Hasil |
|-----|---------------|------------------------|---------|-------|
| 2000-07-01 | 2026-07-01 | 26 | tidak | 26 |
| 2000-10-01 | 2026-07-01 | 26 | -1 (bulan 7 < 10) | 25 |
| 2000-07-15 | 2026-07-14 | 26 | -1 (hari 14 < 15) | 25 |
| 2000-07-15 | 2026-07-15 | 26 | tidak | 26 |
| 2000-07-15 | 2026-07-16 | 26 | tidak | 26 |

---

### 2. Update Default Format State

**File**: `src/features/sk-management/SkGeneratorPage.tsx`

```typescript
// Sebelum:
const [nomorFormat, setNomorFormat] = useState(
  "{NOMOR}/PC.L/A.II/H-34.B/24.29/{TANGGAL}/{BULAN}/{TAHUN}"
)

// Sesudah:
const [nomorFormat, setNomorFormat] = useState(
  "{NOMOR}/PC.L/A.II/H-34.B/24.29/{PERIODE}/{BULAN}/{TAHUN}"
)
```

---

### 3. Update `handleGenerate` — Nomor Format Replacement

Tambahkan kalkulasi periode per guru, lalu replace `{PERIODE}` di `generatedNomor`.

```typescript
// Import di atas file:
import { calculatePeriode } from "@/features/sk-management/utils/calculatePeriode"

// Di dalam loop for (let i = 0; i < selectedTeachers.length; i++):

const tmtRaw = t.tmt || teacher.tmt
if (!tmtRaw) {
  console.error(`TMT tidak ditemukan untuk guru: ${teacher.nama || t.nama}`)
  continue
}

const periodeValue = calculatePeriode(tmtRaw, tglPenetapanVal)
const periodeStr = String(periodeValue)

// Ganti logika generatedNomor:
const generatedNomor = nomorFormat
  .replace(/{NOMOR}/g, seqStr)
  .replace(/{PERIODE}/g, templateId !== "sk_template_kamad" ? periodeStr : "")
  .replace(/{BULAN}/g, String(dateObj.getMonth() + 1))
  .replace(/{BL_ROMA}/g, mmRoma)
  .replace(/{TAHUN}/g, String(yyyy))
```

> Catatan: `{TANGGAL}` dihapus dari chain replacement. Jika user masih mengetik `{TANGGAL}` secara manual di format field, tidak akan di-replace (dibiarkan literal) — ini backward compatible karena format lama tidak digunakan untuk generate baru.

---

### 4. Tambah `renderData["PERIODE"]`

Agar docxtemplater bisa menggunakan `{PERIODE}` di dalam body dokumen .docx (bukan hanya di nomor SK):

```typescript
renderData["PERIODE"] = templateId !== "sk_template_kamad" ? periodeStr : ""
```

Tambahkan di blok `renderData` setelah kalkulasi `periodeStr`.

---

### 5. Update UI — Tooltip Help Text

Tambahkan teks bantuan di bawah input "Format Nomor SK" untuk menjelaskan placeholder `{PERIODE}`:

```tsx
<div className="space-y-2 lg:col-span-2">
  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
    Format Nomor SK
  </label>
  <Input
    value={nomorFormat}
    onChange={e => setNomorFormat(e.target.value)}
    className="h-11 rounded-xl bg-white border-slate-200"
  />
  <p className="text-[10px] text-slate-400">
    Placeholder: <code>{"{NOMOR}"}</code> urutan, <code>{"{PERIODE}"}</code> tahun masa kerja dari TMT,{" "}
    <code>{"{BULAN}"}</code> bulan, <code>{"{BL_ROMA}"}</code> bulan romawi, <code>{"{TAHUN}"}</code> tahun
  </p>
</div>
```

---

## Correctness Properties

### Property 1: Simetri Tepat Satu Tahun

Jika `tanggalCetak` tepat N tahun setelah TMT (hari dan bulan sama), maka `calculatePeriode` mengembalikan N.

```
∀ tmt: Date, n: ℕ≥0
  tanggalCetak = tmt + n tahun (hari & bulan sama)
  ⟹ calculatePeriode(tmt, tanggalCetak) = n
```

### Property 2: Monoton Tidak Menurun

Semakin besar `tanggalCetak`, periode tidak pernah berkurang.

```
∀ tmt: Date, d1 ≤ d2: Date
  ⟹ calculatePeriode(tmt, d1) ≤ calculatePeriode(tmt, d2)
```

### Property 3: Floor — Tidak Pernah Melebihi Selisih Tahun Kalender

Hasil `calculatePeriode` selalu ≤ selisih tahun kalender antara cetak dan TMT.

```
∀ tmt: Date, cetak: Date
  ⟹ calculatePeriode(tmt, cetak) ≤ cetak.year - tmt.year
```

### Property 4: Non-Negatif

Hasil selalu ≥ 0, bahkan jika `tanggalCetak` sama dengan atau lebih awal dari TMT.

```
∀ tmt: Date, cetak: Date
  ⟹ calculatePeriode(tmt, cetak) ≥ 0
```

---

## File yang Diubah

| File | Jenis Perubahan |
|------|----------------|
| `src/features/sk-management/utils/calculatePeriode.ts` | Baru — fungsi kalkulasi periode |
| `src/features/sk-management/SkGeneratorPage.tsx` | Modifikasi — default format, handleGenerate, renderData, UI tooltip |

Tidak ada perubahan backend.
