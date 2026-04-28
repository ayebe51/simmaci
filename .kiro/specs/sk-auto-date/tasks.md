# Tasks — sk-auto-date

## Task List

- [x] 1. Buat file utility `skDateUtils.ts`
  - [x] 1.1 Buat `src/features/sk-management/utils/skDateUtils.ts` dengan fungsi `deriveStartDate(year)`, `deriveEndDate(year)`, `deriveTahunAjaran(year)`, dan `getCurrentSkYear()`
  - [x] 1.2 Pastikan `deriveEndDate` menggunakan konstruktor `Date` eksplisit (`new Date(year + 1, 5, 30)`) — bukan offset hari — agar benar di tahun kabisat

- [x] 2. Tulis unit tests untuk `skDateUtils.ts`
  - [x] 2.1 Buat `src/features/sk-management/utils/skDateUtils.test.ts` dengan test cases: tahun normal, tahun kabisat, `getCurrentSkYear` dengan mock Date di berbagai bulan, `deriveTahunAjaran`

- [x] 3. Tulis property tests untuk `skDateUtils.ts`
  - [x] 3.1 Buat `src/features/sk-management/utils/skDateUtils.property.test.ts` menggunakan fast-check
  - [x] 3.2 Implementasikan Property 1: `deriveStartDate` selalu menghasilkan 1 Juli untuk sembarang tahun valid
  - [x] 3.3 Implementasikan Property 2: `deriveEndDate` selalu menghasilkan 30 Juni tahun+1 untuk sembarang tahun valid
  - [x] 3.4 Implementasikan Property 3: konsistensi tiga nilai yang diturunkan dari Tahun_SK
  - [x] 3.5 Implementasikan Property 4: format tanggal Indonesia konsisten dengan nilai yang diturunkan

- [x] 4. Refactor state `SkGeneratorPage.tsx`
  - [x] 4.1 Tambahkan state `tahunSk` dengan inisialisasi `getCurrentSkYear()`
  - [x] 4.2 Ubah `tanggalPenetapan` dari `useState` menjadi derived value: `deriveStartDate(tahunSk).toISOString().split('T')[0]`
  - [x] 4.3 Ubah `tahunAjaran` dari `useState` menjadi derived value: `deriveTahunAjaran(tahunSk)`
  - [x] 4.4 Ganti kalkulasi `tglBerakhirVal` di dalam `handleGenerate` dari offset hari menjadi `deriveEndDate(tahunSk)`

- [x] 5. Tambahkan input Tahun SK di panel pengaturan UI
  - [x] 5.1 Tambahkan input number `Tahun SK` di `CardHeader` panel pengaturan generator (sejajar dengan input Nomor Urut, Format Nomor, Tahun Ajaran)
  - [x] 5.2 Tambahkan handler `handleTahunSkChange` yang memvalidasi input (hanya integer positif) sebelum memanggil `setTahunSk`
  - [x] 5.3 Tampilkan preview `Tanggal Penetapan` dan `Tanggal Berakhir` yang aktif di panel pengaturan (read-only, update real-time saat Tahun SK berubah)

- [x] 6. Verifikasi tidak ada regresi
  - [x] 6.1 Jalankan semua test yang sudah ada (`calculatePeriode.test.ts`, `calculatePeriode.property.test.ts`) dan pastikan tidak ada yang rusak
  - [x] 6.2 Verifikasi `syncPayload.tanggal_penetapan` menggunakan nilai dari `tanggalPenetapan` (derived dari `tahunSk`), bukan `new Date()`
