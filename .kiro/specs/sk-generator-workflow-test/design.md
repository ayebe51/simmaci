# Design Document: SK Generator Workflow Fix + QR Verification Page

## Overview

Dokumen ini mendeskripsikan desain teknis untuk memperbaiki 8 bug pada workflow SK Generator dan mengimplementasikan fitur halaman verifikasi SK publik. Perubahan mencakup frontend (React/TypeScript) dan backend (Laravel 12).

---

## Technical Context

### Komponen yang Terlibat

**Frontend:**
- `src/features/sk-management/SkGeneratorPage.tsx` — halaman utama generator SK, mengandung bug 1.1–1.6
- `src/features/sk-management/MySkPage.tsx` — juga menggunakan `window.location.origin` untuk QR URL
- `src/features/approval/YayasanApprovalPage.tsx` — juga menggunakan `window.location.origin` untuk QR URL
- `src/features/sk-management/SkDetailPage.tsx` — juga menggunakan `window.location.origin` untuk QR URL
- `src/features/sk-management/SkPrintPage.tsx` — juga menggunakan `window.location.origin` untuk QR URL
- `src/features/sk-management/SkRevisionListPage.tsx` — juga menggunakan `window.location.origin` untuk QR URL
- `src/features/verification/PublicVerificationPage.tsx` — halaman verifikasi generik yang sudah ada
- `src/features/verification/VerifySkPage.tsx` — **file baru** untuk halaman verifikasi SK khusus
- `src/lib/api.ts` — central API client, perlu tambah `verifyBySk` method
- `src/App.tsx` — router, perlu update route `/verify/sk/:nomor`

**Backend:**
- `backend/app/Http/Controllers/Api/SkVerificationController.php` — **controller baru** untuk endpoint publik
- `backend/routes/api.php` — perlu tambah route publik `GET /verify/sk/{nomor}`

### Environment Variables

**Frontend (`.env`):**
```
VITE_APP_URL=https://simmaci.example.com
```

**Backend (`.env`):**
Tidak ada perubahan — endpoint verifikasi SK tidak memerlukan konfigurasi tambahan.

---

## Architecture Decisions

### 1. URL Verifikasi QR Code

**Masalah:** Semua 6 file frontend menggunakan `window.location.origin` secara hardcode.

**Solusi:** Buat utility function terpusat `getVerificationBaseUrl()` di `src/utils/verification.ts`:

```typescript
// src/utils/verification.ts
export function getVerificationBaseUrl(): string {
  return import.meta.env.VITE_APP_URL || window.location.origin;
}

export function getSkVerificationUrl(nomorSk: string): string {
  return `${getVerificationBaseUrl()}/verify/sk/${encodeURIComponent(nomorSk)}`;
}
```

Semua 6 file yang menggunakan `window.location.origin` akan diupdate untuk menggunakan `getSkVerificationUrl()`.

### 2. Backend Endpoint Verifikasi SK Publik

**Route:** `GET /api/verify/sk/{nomor}` — **tanpa middleware auth:sanctum** (publik)

**Controller:** `SkVerificationController@verifyBySk`

Logic:
- Cari `SkDocument` berdasarkan `nomor_sk` (exact match, case-insensitive)
- Bypass tenant scope (`withoutTenantScope()`) karena ini endpoint publik
- Hanya kembalikan data jika status `approved` atau `active`
- Hitung `tanggal_kadaluarsa` = `tanggal_penetapan + 1 tahun` secara runtime (tidak perlu kolom baru di DB)
- Set `is_expired = true` jika `now() > tanggal_kadaluarsa`, tetap kembalikan 200 (bukan 404) agar pengguna tahu SK pernah valid
- Return 404 hanya jika SK tidak ditemukan atau status bukan `approved`/`active`
- Load relasi `school` untuk nama sekolah

**Response shape (200 — SK valid & aktif):**
```json
{
  "success": true,
  "data": {
    "nomor_sk": "0001/PC.L/A.II/H-34.B/24.29/07/2026",
    "nama": "AHMAD RIFAI, S.Pd.I",
    "jabatan": "Guru Tetap Yayasan",
    "unit_kerja": "MI Darwata Glempang",
    "tanggal_penetapan": "1 Juli 2026",
    "tanggal_kadaluarsa": "1 Juli 2027",
    "jenis_sk": "GTY",
    "status": "approved",
    "is_expired": false,
    "school": {
      "nama": "MI Darwata Glempang"
    }
  }
}
```

**Response shape (200 — SK kadaluarsa):**
```json
{
  "success": true,
  "data": {
    "nomor_sk": "0001/PC.L/A.II/H-34.B/24.29/07/2024",
    "nama": "AHMAD RIFAI, S.Pd.I",
    "jabatan": "Guru Tetap Yayasan",
    "unit_kerja": "MI Darwata Glempang",
    "tanggal_penetapan": "1 Juli 2024",
    "tanggal_kadaluarsa": "1 Juli 2025",
    "jenis_sk": "GTY",
    "status": "approved",
    "is_expired": true,
    "school": {
      "nama": "MI Darwata Glempang"
    }
  }
}
```

**Response shape (404):**
```json
{
  "success": false,
  "message": "Dokumen SK tidak ditemukan atau tidak aktif."
}
```

### 3. Frontend Halaman Verifikasi SK

**Route:** `/verify/sk/:nomor` (sudah ada di `App.tsx`, saat ini mengarah ke `PublicVerificationPage` generik)

**Perubahan:** Buat `VerifySkPage.tsx` baru di `src/features/verification/` yang khusus untuk SK, lalu update route di `App.tsx`.

**Tampilan `VerifySkPage`:**
- Mengikuti design language yang sama dengan `VerifyTeacherPage` dan `VerifyStudentPage`
- Gradient bar hijau di atas (konsisten dengan tema SK)
- Icon `FileCheck` atau `ShieldCheck`
- Field yang ditampilkan: Nomor SK, Nama Guru, Jabatan, Unit Kerja, Tanggal Penetapan, Tanggal Kadaluarsa, Jenis SK, Status
- Badge status tiga kondisi:
  - **"SK VALID & AKTIF"** (hijau) — status `approved` dan belum kadaluarsa
  - **"SK KADALUARSA"** (kuning/amber) — status `approved` tapi `is_expired: true`
  - **"SK TIDAK DITEMUKAN"** (merah) — 404 dari backend
- Logo sekolah/lembaga di footer
- Tidak memerlukan autentikasi

**API call:** `verificationApi.verifyBySk(nomor)` → `GET /api/verify/sk/{nomor}`

### 4. Fix Bug 1.1 — Template Fetch Fallback

**Lokasi:** `src/features/sk-management/hooks/useSkTemplate.ts`

**Perubahan:** Ketika fetch template dari backend gagal dengan 5xx atau network error, hook harus:
1. Log error ke console
2. Mengembalikan URL fallback ke `/public/templates/sk-{type}-template.docx`
3. Set flag `usedFallback: true` agar `SkGeneratorPage` bisa menampilkan toast info

### 5. Fix Bug 1.2 — Toast Warning untuk TMT Kosong

**Lokasi:** `SkGeneratorPage.tsx`, dalam loop `handleGenerate`

**Perubahan:** Ganti `console.error` dengan `toast.warning`:
```typescript
// Before
console.error(`TMT tidak ditemukan untuk guru: ${teacher.nama || t.nama}`)
continue

// After
toast.warning(`Guru "${teacher.nama || t.nama}" dilewati: field TMT kosong.`)
continue
```

### 6. Fix Bug 1.3 — Default Value untuk Placeholder Tidak Ditemukan

**Lokasi:** `SkGeneratorPage.tsx`, `customParser`

**Perubahan:** Ganti return `""` dengan `"-"` dan tambahkan console.warn:
```typescript
get(scope: any) {
  if (cleanTag === ".") return scope;
  for (const k in scope) {
    if (k.toLowerCase() === cleanTag) return scope[k];
  }
  console.warn(`[SK Generator] Placeholder tidak ditemukan: "${tag}"`);
  return "-";
}
```

### 7. Fix Bug 1.4 — Nomor SK Kamad dengan {PERIODE}

**Lokasi:** `SkGeneratorPage.tsx`, dalam `handleGenerate`

**Perubahan:** Setelah replace `{PERIODE}` dengan `""` untuk kamad, bersihkan separator ganda:
```typescript
let generatedNomor = nomorFormat
  .replace(/{NOMOR}/g, seqStr)
  .replace(/{PERIODE}/g, templateId !== "sk_template_kamad" ? periodeStr : "")
  .replace(/{BULAN}/g, String(dateObj.getMonth() + 1))
  .replace(/{BL_ROMA}/g, mmRoma)
  .replace(/{TAHUN}/g, String(yyyy))

// Fix: hapus separator ganda yang muncul akibat {PERIODE} kosong
generatedNomor = generatedNomor.replace(/\/\//g, '/').replace(/^\/|\/$/g, '')
```

### 8. Fix Bug 1.5 — Bulk Gabung dengan Tipe SK Berbeda

**Lokasi:** `SkGeneratorPage.tsx`, dalam `handleGenerate` bagian `combineInOneFile`

**Perubahan:** Ketika `groupIds.length > 1`, tetap buat ZIP (perilaku saat ini sudah benar secara teknis). Yang perlu diperbaiki adalah UX — tampilkan toast info yang menjelaskan bahwa karena ada beberapa tipe SK, output akan berupa ZIP berisi beberapa file kolektif:
```typescript
if (groupIds.length > 1) {
  toast.info(`Terdapat ${groupIds.length} tipe SK berbeda. Output akan berupa ZIP berisi ${groupIds.length} file kolektif.`)
  // ... existing ZIP logic
}
```

---

## File Changes Summary

### Files to Create
| File | Deskripsi |
|------|-----------|
| `src/utils/verification.ts` | Utility function `getVerificationBaseUrl()` dan `getSkVerificationUrl()` |
| `src/features/verification/VerifySkPage.tsx` | Halaman verifikasi SK publik |
| `backend/app/Http/Controllers/Api/SkVerificationController.php` | Controller publik untuk verifikasi SK |

### Files to Modify
| File | Perubahan |
|------|-----------|
| `src/App.tsx` | Update route `/verify/sk/:nomor` → `VerifySkPage` |
| `src/lib/api.ts` | Tambah `verificationApi.verifyBySk(nomor)` |
| `backend/routes/api.php` | Tambah route publik `GET /verify/sk/{nomor}` |
| `src/features/sk-management/SkGeneratorPage.tsx` | Fix bug 1.1–1.6 |
| `src/features/sk-management/MySkPage.tsx` | Gunakan `getSkVerificationUrl()` |
| `src/features/approval/YayasanApprovalPage.tsx` | Gunakan `getSkVerificationUrl()` |
| `src/features/sk-management/SkDetailPage.tsx` | Gunakan `getSkVerificationUrl()` |
| `src/features/sk-management/SkPrintPage.tsx` | Gunakan `getSkVerificationUrl()` |
| `src/features/sk-management/SkRevisionListPage.tsx` | Gunakan `getSkVerificationUrl()` |

---

## Correctness Properties

### Property 1: QR URL Konsistensi
Untuk semua SK yang di-generate, URL QR code harus menggunakan `VITE_APP_URL` jika tersedia, bukan `window.location.origin`.

```
FOR ALL sk IN generated_sks:
  qr_url(sk) STARTS_WITH (env.VITE_APP_URL ?? window.location.origin)
```

### Property 2: Endpoint Verifikasi Publik — SK Valid & Aktif
Untuk semua SK dengan status `approved` dan belum melewati 1 tahun sejak `tanggal_penetapan`, endpoint publik harus mengembalikan 200 dengan `is_expired: false`.

```
FOR ALL sk WHERE sk.status IN ['approved', 'active'] AND now() <= sk.tanggal_penetapan + 1 year:
  GET /api/verify/sk/{sk.nomor_sk} → 200 WITH { nomor_sk, nama, jabatan, unit_kerja, tanggal_penetapan, tanggal_kadaluarsa, is_expired: false }
```

### Property 3: Endpoint Verifikasi Publik — SK Kadaluarsa
Untuk semua SK dengan status `approved` tetapi sudah melewati 1 tahun, endpoint harus mengembalikan 200 dengan `is_expired: true` (bukan 404).

```
FOR ALL sk WHERE sk.status IN ['approved', 'active'] AND now() > sk.tanggal_penetapan + 1 year:
  GET /api/verify/sk/{sk.nomor_sk} → 200 WITH { is_expired: true, tanggal_kadaluarsa }
```

### Property 4: Endpoint Verifikasi Publik — SK Tidak Valid
Untuk semua SK dengan status selain `approved`/`active`, atau nomor SK yang tidak ada, endpoint harus mengembalikan 404.

```
FOR ALL nomor WHERE NOT EXISTS sk WITH nomor_sk = nomor AND status IN ['approved', 'active']:
  GET /api/verify/sk/{nomor} → 404
```

### Property 4: Nomor SK Kamad Tidak Mengandung Separator Ganda
Untuk semua SK dengan template kamad, nomor SK yang di-generate tidak boleh mengandung `//`.

```
FOR ALL sk WHERE sk.templateId = 'sk_template_kamad':
  NOT CONTAINS(sk.nomor_sk, '//')
```

### Property 5: Guru dengan TMT Kosong Menghasilkan Toast Warning
Untuk semua guru dengan TMT kosong/null yang dipilih untuk generate, sistem harus menampilkan toast warning (bukan hanya console.error).

```
FOR ALL teacher WHERE teacher.tmt IS NULL OR teacher.tmt = '':
  generate(teacher) → toast.warning SHOWN AND teacher SKIPPED
```
