# Tasks: SK Generator Workflow Fix + QR Verification Page

## Task List

- [x] 1. Buat utility function untuk URL verifikasi QR code
  - [x] 1.1 Buat file `src/utils/verification.ts` dengan fungsi `getVerificationBaseUrl()` dan `getSkVerificationUrl(nomorSk)`
  - [x] 1.2 Update `src/features/sk-management/SkGeneratorPage.tsx` — ganti `window.location.origin` dengan `getSkVerificationUrl()`
  - [x] 1.3 Update `src/features/sk-management/MySkPage.tsx` — ganti `window.location.origin` dengan `getSkVerificationUrl()`
  - [x] 1.4 Update `src/features/approval/YayasanApprovalPage.tsx` — ganti `window.location.origin` dengan `getSkVerificationUrl()`
  - [x] 1.5 Update `src/features/sk-management/SkDetailPage.tsx` — ganti `window.location.origin` dengan `getSkVerificationUrl()`
  - [x] 1.6 Update `src/features/sk-management/SkPrintPage.tsx` — ganti `window.location.origin` dengan `getSkVerificationUrl()`
  - [x] 1.7 Update `src/features/sk-management/SkRevisionListPage.tsx` — ganti `window.location.origin` dengan `getSkVerificationUrl()`

- [x] 2. Fix bug SK Generator — error handling dan UX
  - [x] 2.1 Fix bug 1.2: Ganti `console.error` dengan `toast.warning` untuk guru dengan TMT kosong di `SkGeneratorPage.tsx`
  - [x] 2.2 Fix bug 1.3: Ganti return `""` dengan `"-"` dan tambahkan `console.warn` di `customParser` pada `SkGeneratorPage.tsx`
  - [x] 2.3 Fix bug 1.4: Tambahkan cleanup separator ganda `//` setelah resolve `{PERIODE}` kosong untuk template kamad di `SkGeneratorPage.tsx`
  - [x] 2.4 Fix bug 1.5: Tambahkan `toast.info` yang menjelaskan output ZIP ketika bulk generate dengan tipe SK berbeda di `SkGeneratorPage.tsx`

- [x] 3. Buat backend endpoint verifikasi SK publik
  - [x] 3.1 Buat `backend/app/Http/Controllers/Api/SkVerificationController.php` dengan method `verifyBySk(string $nomor)`
  - [x] 3.2 Tambahkan route publik `GET /api/verify/sk/{nomor}` di `backend/routes/api.php` (di luar middleware `auth:sanctum`)
  - [x] 3.3 Pastikan controller menggunakan `withoutTenantScope()` dan hanya mengembalikan SK dengan status `approved` atau `active`
  - [x] 3.4 Hitung `tanggal_kadaluarsa` = `tanggal_penetapan + 1 tahun` secara runtime dan set `is_expired` berdasarkan perbandingan dengan `now()`
  - [x] 3.5 Kembalikan 200 dengan `is_expired: true` untuk SK kadaluarsa (bukan 404), dan 404 hanya untuk SK tidak ditemukan atau status bukan approved
  - [x] 3.6 Load relasi `school` pada response untuk menampilkan nama sekolah

- [x] 4. Buat frontend halaman verifikasi SK
  - [x] 4.1 Tambahkan method `verifyBySk(nomor: string)` ke `verificationApi` di `src/lib/api.ts`
  - [x] 4.2 Buat `src/features/verification/VerifySkPage.tsx` — halaman publik yang menampilkan detail SK (nama guru, nomor SK, jabatan, unit kerja, tanggal penetapan, tanggal kadaluarsa, jenis SK, nama sekolah) dengan tiga kondisi badge: "SK VALID & AKTIF" (hijau), "SK KADALUARSA" (amber), "SK TIDAK DITEMUKAN" (merah)
  - [x] 4.3 Update `src/App.tsx` — ganti route `/verify/sk/:nomor` dari `PublicVerificationPage` ke `VerifySkPage`

- [x] 5. Verifikasi dan testing
  - [x] 5.1 Pastikan build frontend berhasil tanpa TypeScript error (`npm run build`)
  - [x] 5.2 Verifikasi route `/verify/sk/:nomor` dapat diakses tanpa login
  - [x] 5.3 Verifikasi endpoint `GET /api/verify/sk/{nomor}` mengembalikan 200 + `is_expired: false` untuk SK approved yang masih aktif
  - [x] 5.4 Verifikasi endpoint mengembalikan 200 + `is_expired: true` untuk SK approved yang sudah > 1 tahun dari `tanggal_penetapan`
  - [x] 5.5 Verifikasi endpoint mengembalikan 404 untuk SK dengan status `pending` atau nomor SK yang tidak ada
  - [x] 5.6 Verifikasi nomor SK kamad tidak mengandung `//` setelah generate
  - [x] 5.7 Verifikasi QR code URL menggunakan `VITE_APP_URL` jika di-set di `.env`
