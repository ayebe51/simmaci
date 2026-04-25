# Tasks: Generate/Input NIM di SK Generator

## Task List

- [x] 1. Backend — Endpoint Preview NIM
  - [x] 1.1 Tambahkan method `previewNim` di `TeacherController` untuk `GET /api/teachers/nim/generate`
  - [x] 1.2 Daftarkan route `GET /api/teachers/nim/generate` di `routes/api.php` (sebelum `apiResource teachers`)
  - [x] 1.3 Tulis unit test untuk `previewNim` — empty DB, single NIM, multiple NIMs, format `1134XXXXX`

- [x] 2. Backend — Endpoint Update NIM
  - [x] 2.1 Buat `UpdateNimRequest` di `backend/app/Http/Requests/Teacher/UpdateNimRequest.php` dengan validasi `regex:/^\d+$/`
  - [x] 2.2 Tambahkan method `updateNim` di `TeacherController` untuk `PATCH /api/teachers/{id}/nim`
  - [x] 2.3 Implementasikan validasi global uniqueness di `updateNim` menggunakan `withoutTenantScope()` (bukan `UniqueForTenant`)
  - [x] 2.4 Tambahkan ActivityLog entry saat NIM berhasil disimpan (event: `update_nim`, properties: `old_nim`, `new_nim`)
  - [x] 2.5 Daftarkan route `PATCH /api/teachers/{id}/nim` di `routes/api.php`
  - [x] 2.6 Tulis unit test untuk `updateNim` — success, duplicate NIM (same tenant), duplicate NIM (cross-tenant), invalid format, unauthorized

- [x] 3. Frontend — API Client
  - [x] 3.1 Tambahkan `teacherApi.previewNim()` di `src/lib/api.ts` (GET `/teachers/nim/generate`)
  - [x] 3.2 Tambahkan `teacherApi.updateNim(teacherId, nim)` di `src/lib/api.ts` (PATCH `/teachers/{id}/nim`)

- [x] 4. Frontend — NimDialog Component
  - [x] 4.1 Buat file `src/features/sk-management/components/NimDialog.tsx`
  - [x] 4.2 Implementasikan 3 mode: `select` (pilih opsi), `generate` (preview + konfirmasi), `manual` (input + validasi)
  - [x] 4.3 Mode `select`: tampilkan nama guru, unit_kerja, dan dua tombol ("Generate Otomatis" / "Input Manual")
  - [x] 4.4 Mode `generate`: panggil `teacherApi.previewNim()`, tampilkan preview NIM, tombol "Simpan" dan "Kembali"
  - [x] 4.5 Mode `manual`: input field numerik, inline validation client-side, tombol "Simpan" dan "Kembali"
  - [x] 4.6 Panggil `teacherApi.updateNim()` saat user klik "Simpan" di kedua mode
  - [x] 4.7 Tampilkan inline error message saat response 422 (duplikasi atau format invalid)
  - [x] 4.8 Panggil `onSuccess(updatedTeacher)` setelah save berhasil, `onCancel()` saat cancel
  - [x] 4.9 Tulis unit test untuk NimDialog — render data guru, transisi mode, error handling, cancel behavior

- [x] 5. Frontend — Integrasi di SkGeneratorPage
  - [x] 5.1 Tambahkan state `nimDialogTeacher` dan `pendingGenerateAfterNim` di `SkGeneratorPage`
  - [x] 5.2 Modifikasi `handleGenerate` — sebelum generate, cek apakah ada guru terpilih tanpa `nomor_induk_maarif`
  - [x] 5.3 Jika ada guru tanpa NIM, buka `NimDialog` untuk guru pertama yang tidak punya NIM
  - [x] 5.4 Setelah `onSuccess` dari NimDialog, invalidate TanStack Query cache (`queryClient.invalidateQueries`) dan lanjutkan generate
  - [x] 5.5 Render `<NimDialog>` di JSX `SkGeneratorPage` dengan props yang sesuai

- [ ] 6. Property-Based Tests
  - [ ] 6.1 Tulis PHPUnit data provider test untuk Property 1 (NIM generate = MAX sequence + 1)
  - [ ] 6.2 Tulis PHPUnit test untuk Property 3 (global uniqueness lintas tenant)
  - [ ] 6.3 Tulis PHPUnit data provider test untuk Property 5 (format validation — berbagai input non-numerik)
  - [ ] 6.4 Tulis Vitest + fast-check test untuk Property 6 (NimDialog selalu render data teacher yang benar)
  - [ ] 6.5 Tulis Vitest + fast-check test untuk Property 5 frontend (input non-numerik ditolak sebelum submit)
