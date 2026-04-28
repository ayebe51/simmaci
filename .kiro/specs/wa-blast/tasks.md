# Implementation Tasks: WA Blast

## Overview

Daftar tugas implementasi fitur WA Blast — pengiriman pesan WhatsApp massal melalui Go-WA Gateway. Tugas diurutkan berdasarkan dependensi: fondasi database dan backend core terlebih dahulu, diikuti integrasi queue dan frontend.

---

## Tasks

- [ ] 1. Database migrations dan Eloquent models
  - [ ] 1.1 Buat migration untuk tabel `wa_blasts` dengan semua kolom, index, dan foreign key sesuai design — termasuk kolom `jenjang_filter JSONB` untuk menyimpan filter jenjang yang dipilih
  - [ ] 1.2 Buat migration untuk tabel `wa_blast_recipients` dengan index pada `wa_blast_id`, `delivery_status`, dan `phone_number`
  - [ ] 1.3 Buat migration untuk tabel `wa_blast_templates` dengan unique index case-insensitive pada `name` (partial index `WHERE deleted_at IS NULL`)
  - [ ] 1.4 Buat migration untuk tabel `wa_blast_configs` (singleton, tanpa soft deletes)
  - [ ] 1.5 Buat Eloquent model `WaBlast` dengan traits `SoftDeletes` dan `AuditLogTrait`, relasi `hasMany(WaBlastRecipient)`, `belongsTo(User, 'created_by')`, `belongsTo(WaBlast, 'parent_blast_id')`, dan casts untuk `school_ids`, `jenjang_filter`, `scheduled_at`, `sent_at`, `completed_at`
  - [ ] 1.6 Buat Eloquent model `WaBlastRecipient` dengan trait `SoftDeletes` dan relasi `belongsTo(WaBlast)`
  - [ ] 1.7 Buat Eloquent model `WaBlastTemplate` dengan trait `SoftDeletes` dan relasi `belongsTo(User, 'created_by')`
  - [ ] 1.8 Buat Eloquent model `WaBlastConfig` tanpa `SoftDeletes`, dengan method helper `getDecryptedToken(): string`

- [ ] 2. Repository layer
  - [ ] 2.1 Buat interface `WaBlastRepositoryInterface` dengan method: `paginate(array $filters)`, `findById(int $id)`, `create(array $data)`, `updateStatus(int $id, string $status, array $extra = [])`, `delete(int $id)`
  - [ ] 2.2 Implementasi `WaBlastRepository` yang mengimplementasi interface di atas, dengan filter berdasarkan `blast_status` dan rentang tanggal `created_at`
  - [ ] 2.3 Buat interface `WaBlastRecipientRepositoryInterface` dengan method: `createMany(int $blastId, array $recipients)`, `findByBlast(int $blastId)`, `updateDeliveryStatus(int $recipientId, string $status, ?string $errorMessage, ?Carbon $sentAt)`, `countByStatus(int $blastId)`, `findFailedByBlast(int $blastId)`
  - [ ] 2.4 Implementasi `WaBlastRecipientRepository`
  - [ ] 2.5 Buat interface `WaBlastTemplateRepositoryInterface` dengan method: `all()`, `findById(int $id)`, `create(array $data)`, `update(int $id, array $data)`, `delete(int $id)`, `existsByName(string $name, ?int $excludeId = null): bool`
  - [ ] 2.6 Implementasi `WaBlastTemplateRepository` dengan pengecekan uniqueness nama case-insensitive
  - [ ] 2.7 Buat interface `WaBlastConfigRepositoryInterface` dengan method: `get(): ?WaBlastConfig`, `save(array $data): WaBlastConfig`
  - [ ] 2.8 Implementasi `WaBlastConfigRepository` (upsert singleton)
  - [ ] 2.9 Daftarkan semua binding repository di `AppServiceProvider`

- [ ] 3. Core services — normalisasi, kompilasi penerima, dan konfigurasi
  - [ ] 3.1 Buat `PhoneNormalizerService` dengan method `normalize(string $phone): string` yang menghapus spasi/tanda hubung, mengganti awalan `0` → `62`, menghapus `+` dari `+62`, dan method `isValid(string $normalizedPhone): bool` yang memvalidasi pola `^62[0-9]{9,13}$`
  - [ ] 3.2 Buat `RecipientCompilerService` dengan method `compile(string $category, array $schoolIds, array $jenjang, array $excludedPhones): array` yang query `schools.kepala_whatsapp` dan/atau `teachers.phone_number` (filter `is_active = true`), dengan filter `WHERE schools.jenjang IN (...)` jika `$jenjang` tidak kosong, normalisasi nomor, deduplication, dan tandai nomor tidak valid sebagai `invalid_number`
  - [ ] 3.3 Buat `WaBlastConfigService` dengan method `get(): ?WaBlastConfig`, `save(array $data): WaBlastConfig` (enkripsi token dengan `encrypt()`), `getDecryptedToken(): string`
  - [ ] 3.4 Buat `GoWaGatewayService` dengan method `sendText(string $to, string $message, WaBlastConfig $config): array`, `sendFile(string $to, string $message, string $filePath, WaBlastConfig $config): array`, `testConnection(WaBlastConfig $config): array` — menggunakan Laravel HTTP Client dengan timeout 30 detik

- [ ] 4. Property-based tests untuk core services
  - [ ] 4.1 Install library `eris/eris` via composer: `composer require --dev eris/eris`
  - [ ] 4.2 Buat `PhoneNormalizerServiceTest` dengan property test Property 1: untuk setiap awalan `0`, `+62`, `62` dengan panjang digit 9–13, hasil normalisasi harus cocok pola `^62[0-9]{9,13}$` (min 100 iterasi)
  - [ ] 4.3 Buat property test Property 2 di `PhoneNormalizerServiceTest`: untuk string yang tidak bisa menjadi nomor valid setelah normalisasi, `isValid()` harus mengembalikan `false`
  - [ ] 4.4 Buat `RecipientCompilerServiceTest` dengan property test Property 3: untuk daftar nomor dengan duplikat, hasil `compile()` tidak boleh mengandung nomor yang sama lebih dari sekali per blast
  - [ ] 4.5 Buat property test Property 7 di `RecipientCompilerServiceTest`: kategori `kepala_sekolah` hanya menghasilkan data dari `schools`, kategori `gtk` hanya dari `teachers` dengan `is_active = true`; filter jenjang `MI` hanya menghasilkan sekolah dengan `jenjang = 'MI'`

- [ ] 5. WaBlastService dan WaBlastTemplateService
  - [ ] 5.1 Buat `WaBlastTemplateService` dengan method `list(): Collection`, `create(array $data): WaBlastTemplate`, `update(int $id, array $data): WaBlastTemplate`, `delete(int $id): void` — validasi uniqueness nama via repository
  - [ ] 5.2 Buat `WaBlastService` dengan method `previewRecipients(string $category, array $schoolIds): array` yang mengembalikan daftar penerima beserta jumlah valid/invalid
  - [ ] 5.3 Implementasi `WaBlastService::createBlast(array $data, int $userId): WaBlast` yang: kompilasi recipients, validasi max per sesi, validasi daily limit, simpan `WaBlast` + `WaBlastRecipient[]`, upload PDF ke storage jika ada, dispatch `SendBlastJob` jika segera atau set status `scheduled` jika terjadwal
  - [ ] 5.4 Implementasi `WaBlastService::retryBlast(int $blastId, int $userId): WaBlast` yang membuat blast baru dari recipient `failed` dengan referensi `parent_blast_id`
  - [ ] 5.5 Implementasi `WaBlastService::cancelBlast(int $blastId): void` yang hanya mengizinkan pembatalan blast berstatus `scheduled` atau `draft`
  - [ ] 5.6 Implementasi `WaBlastService::getProgress(int $blastId): array` yang mengembalikan `blast_status`, `total_count`, `sent_count`, `failed_count`, `pending_count`, `invalid_count`
  - [ ] 5.7 Buat `WaBlastServiceTest` dengan property test Property 4: untuk jumlah recipient > `max_recipients_per_session`, `createBlast()` harus throw `ValidationException`

- [ ] 6. SendBlastJob dan ProcessScheduledBlastsCommand
  - [ ] 6.1 Buat `SendBlastJob` yang implements `ShouldQueue` dengan `tries = 1`, method `handle()` yang: load konfigurasi Go-WA, iterasi setiap recipient `pending`, substitusi variabel `{{nama}}` dan `{{nama_sekolah}}`, kirim via `GoWaGatewayService` (text atau file), update `delivery_status`, sleep 2 detik, update `blast_status` → `completed` atau `failed` setelah semua recipient diproses
  - [ ] 6.2 Implementasi penanganan timeout Go-WA di `SendBlastJob`: jika `GoWaGatewayService` throw exception timeout, set blast `failed` dengan pesan "Go-WA Gateway tidak dapat dihubungi." dan hentikan pengiriman
  - [ ] 6.3 Implementasi substitusi template variabel di `SendBlastJob` sebagai method private `substituteVariables(string $template, string $nama, string $namaSekolah): string`
  - [ ] 6.4 Buat `ProcessScheduledBlastsCommand` (`php artisan wa-blast:process-scheduled`) yang query `WaBlast` dengan `blast_status = scheduled` dan `scheduled_at <= now()`, lalu dispatch `SendBlastJob` untuk setiap blast dan update status ke `sending`
  - [ ] 6.5 Daftarkan `ProcessScheduledBlastsCommand` di `app/Console/Kernel.php` untuk dijalankan setiap menit via `$schedule->command(...)->everyMinute()`
  - [ ] 6.6 Buat `SendBlastJobTest` dengan property test Property 5: untuk setiap kombinasi `nama` dan `namaSekolah` yang tidak kosong, hasil `substituteVariables()` harus mengandung nilai aktual dan tidak mengandung placeholder `{{nama}}` atau `{{nama_sekolah}}`

- [ ] 7. Form Requests dan Controllers backend
  - [ ] 7.1 Buat `StoreWaBlastRequest` dengan validasi: `title` required string max 255, `recipient_category` required in `[kepala_sekolah, gtk, both]`, `jenjang` nullable array of strings in `[MI, MTs, MA]`, `school_ids` nullable array of integers, `message_body` required string max 4096, `attachment` nullable file mimes:pdf max:10240, `scheduled_at` nullable date after:now, `excluded_phone_numbers` nullable array
  - [ ] 7.2 Buat `PreviewRecipientsRequest` dengan validasi: `recipient_category` required in `[kepala_sekolah, gtk, both]`, `jenjang` nullable array of strings in `[MI, MTs, MA]`, `school_ids` nullable array of integers
  - [ ] 7.3 Buat `StoreWaBlastTemplateRequest` dengan validasi: `name` required string max 255, `body` required string
  - [ ] 7.4 Buat `UpdateWaBlastTemplateRequest` (sama dengan Store, tapi `name` unique check exclude current ID)
  - [ ] 7.5 Buat `StoreWaBlastConfigRequest` dengan validasi: `api_url` required url max 500, `api_token` required string, `sender_number` required string regex `^62[0-9]{9,13}$`, `max_recipients_per_session` required integer min:1 max:1000, `max_daily_messages` required integer min:1 max:5000
  - [ ] 7.6 Buat `WaBlastController` dengan method: `index` (list paginated + filter), `store` (buat blast), `show` (detail), `destroy` (batalkan), `previewRecipients`, `retry`, `progress` — semua menggunakan trait `ApiResponse`
  - [ ] 7.7 Buat `WaBlastTemplateController` dengan method CRUD lengkap: `index`, `store`, `show`, `update`, `destroy`
  - [ ] 7.8 Buat `WaBlastConfigController` dengan method: `show` (token ditampilkan sebagai `***`), `store` (enkripsi token), `testConnection`
  - [ ] 7.9 Daftarkan semua route di `routes/api.php` dalam group `auth:sanctum` + `role:super_admin,admin_yayasan`, dengan endpoint konfigurasi dalam sub-group `role:super_admin`

- [ ] 8. Integration tests backend
  - [ ] 8.1 Buat `WaBlastControllerTest` yang test: create blast (segera dan terjadwal), preview recipients, retry, cancel, progress endpoint, validasi 422 untuk input invalid, 403 untuk role operator
  - [ ] 8.2 Buat `WaBlastTemplateControllerTest` yang test: CRUD template, uniqueness constraint nama, 403 untuk role operator
  - [ ] 8.3 Buat `WaBlastConfigControllerTest` yang test: simpan konfigurasi (token terenkripsi di DB), show (token masked), test connection (mock `GoWaGatewayService`), 403 untuk role `admin_yayasan`
  - [ ] 8.4 Buat `SendBlastJobIntegrationTest` yang test end-to-end job dengan mock `GoWaGatewayService`: semua recipient berhasil → status `completed`, sebagian gagal → status `completed` dengan `failed_count` > 0, semua gagal → status `failed`, timeout gateway → status `failed` dengan pesan error

- [ ] 9. Frontend — types, services, dan hooks
  - [ ] 9.1 Buat `src/features/wa-blast/types/waBlast.types.ts` dengan interfaces: `WaBlast`, `WaBlastRecipient`, `WaBlastTemplate`, `WaBlastConfig`, `RecipientPreview`, dan enums `BlastStatus` (`draft | scheduled | sending | completed | failed`), `DeliveryStatus` (`pending | sent | failed | invalid_number`)
  - [ ] 9.2 Buat `src/features/wa-blast/services/waBlastService.ts` dengan fungsi: `getBlasts(params)`, `createBlast(data)`, `getBlast(id)`, `deleteBlast(id)`, `previewRecipients(data)`, `retryBlast(id)`, `getBlastProgress(id)` — semua via `apiClient`
  - [ ] 9.3 Buat `src/features/wa-blast/services/waBlastTemplateService.ts` dengan fungsi CRUD: `getTemplates()`, `createTemplate(data)`, `getTemplate(id)`, `updateTemplate(id, data)`, `deleteTemplate(id)`
  - [ ] 9.4 Buat `src/features/wa-blast/services/waBlastConfigService.ts` dengan fungsi: `getConfig()`, `saveConfig(data)`, `testConnection()`
  - [ ] 9.5 Buat `src/features/wa-blast/hooks/useWaBlasts.ts` menggunakan TanStack Query dengan filter `status`, `date_from`, `date_to`
  - [ ] 9.6 Buat `src/features/wa-blast/hooks/useWaBlast.ts` untuk detail satu blast session
  - [ ] 9.7 Buat `src/features/wa-blast/hooks/useWaBlastProgress.ts` dengan polling setiap 5 detik, aktif hanya ketika `blast_status === 'sending'`
  - [ ] 9.8 Buat `src/features/wa-blast/hooks/useWaBlastTemplates.ts` dengan query list dan mutations CRUD
  - [ ] 9.9 Buat `src/features/wa-blast/hooks/useWaBlastConfig.ts` dengan query dan mutation save/test
  - [ ] 9.10 Buat `src/features/wa-blast/hooks/useRecipientPreview.ts` sebagai TanStack Query mutation

- [ ] 10. Frontend — komponen UI
  - [ ] 10.1 Buat `BlastStatusBadge.tsx` dan `DeliveryStatusBadge.tsx` dengan warna berbeda per status (menggunakan `class-variance-authority`)
  - [ ] 10.2 Buat `RecipientSelector.tsx` dengan radio group kategori (Kepala Sekolah / GTK / Keduanya), checkbox group jenjang (MI / MTs / MA / Semua Jenjang), dan multi-select sekolah (atau "Semua Sekolah") — filter jenjang dan sekolah dapat dikombinasikan
  - [ ] 10.3 Buat `RecipientPreviewTable.tsx` yang menampilkan daftar penerima dengan kolom nama, sekolah, nomor, status valid/invalid, dan tombol hapus per baris; tampilkan ringkasan jumlah valid dan invalid di atas tabel
  - [ ] 10.4 Buat `MessageComposer.tsx` dengan textarea, counter karakter (maks 4.096), dan tombol sisipkan variabel `{{nama}}` dan `{{nama_sekolah}}`
  - [ ] 10.5 Buat `TemplatePickerModal.tsx` sebagai modal dengan input pencarian berdasarkan nama template dan daftar template yang dapat dipilih
  - [ ] 10.6 Buat `AttachmentUploader.tsx` dengan validasi tipe PDF dan ukuran maks 10 MB di sisi client, tampilkan nama file yang dipilih dan tombol hapus
  - [ ] 10.7 Buat `ScheduleSelector.tsx` dengan toggle "Kirim Sekarang" / "Jadwalkan" dan datetime picker yang muncul saat opsi terjadwal dipilih
  - [ ] 10.8 Buat `BlastProgressBar.tsx` yang menampilkan progress bar `sent/total` dengan label persentase, menggunakan data dari `useWaBlastProgress`
  - [ ] 10.9 Buat `RecipientDetailTable.tsx` dengan kolom nama, nama sekolah, nomor WhatsApp, `DeliveryStatusBadge`, dan pesan error (jika ada)
  - [ ] 10.10 Buat `GoWaConfigForm.tsx` dengan field URL, token (input type password), nomor pengirim, batas per sesi, batas harian, dan tombol "Test Koneksi" yang menampilkan hasil uji
  - [ ] 10.11 Buat `TemplateForm.tsx` dengan field nama template, textarea isi pesan, keterangan variabel yang tersedia (`{{nama}}`, `{{nama_sekolah}}`), dan validasi client-side

- [ ] 11. Frontend — halaman
  - [ ] 11.1 Buat `WaBlastListPage.tsx` dengan tabel daftar blast session (judul, tanggal, total penerima, sent, failed, status), filter status dan rentang tanggal, tombol "Buat Blast Baru", dan link ke detail
  - [ ] 11.2 Buat `WaBlastCreatePage.tsx` yang mengintegrasikan semua komponen: `RecipientSelector` → `RecipientPreviewTable` (dengan tombol preview), `MessageComposer` + `TemplatePickerModal` + `AttachmentUploader`, `ScheduleSelector`, tombol konfirmasi kirim dengan dialog konfirmasi; tampilkan peringatan jika konfigurasi Go-WA belum diatur
  - [ ] 11.3 Buat `WaBlastDetailPage.tsx` dengan: header info blast (judul, status, waktu), `BlastProgressBar` (jika status `sending`), isi pesan dan nama lampiran, `RecipientDetailTable`, tombol "Kirim Ulang ke yang Gagal" (jika ada recipient `failed` dan status `completed`), tombol batalkan (jika status `scheduled`)
  - [ ] 11.4 Buat `WaBlastTemplatePage.tsx` dengan tabel daftar template (nama, cuplikan 100 karakter, tanggal diubah), tombol buat baru, dan aksi edit/hapus per baris menggunakan `TemplateForm` dalam dialog/sheet
  - [ ] 11.5 Buat `WaBlastConfigPage.tsx` yang hanya dapat diakses `super_admin`, menampilkan `GoWaConfigForm` dengan data konfigurasi yang tersimpan (token dimasking)
  - [ ] 11.6 Daftarkan semua route WA Blast di React Router (`/wa-blast`, `/wa-blast/create`, `/wa-blast/:id`, `/wa-blast/templates`, `/wa-blast/config`) dengan proteksi role `super_admin` atau `admin_yayasan`
  - [ ] 11.7 Tambahkan menu WA Blast di sidebar navigasi dengan ikon yang sesuai, hanya tampil untuk role `super_admin` dan `admin_yayasan`

- [ ] 12. Validasi end-to-end dan pengujian integrasi frontend
  - [ ] 12.1 Tulis integration test untuk `WaBlastCreatePage` menggunakan React Testing Library: validasi field kosong, preview recipient, pilih template, upload PDF, submit form
  - [ ] 12.2 Tulis E2E test Playwright untuk alur lengkap: login sebagai `super_admin` → konfigurasi Go-WA → buat blast → konfirmasi → monitoring progres → lihat detail
  - [ ] 12.3 Verifikasi bahwa role `operator` tidak dapat mengakses halaman WA Blast (redirect atau tampilkan 403)
  - [ ] 12.4 Verifikasi bahwa role `admin_yayasan` tidak dapat mengakses halaman konfigurasi Go-WA

- [ ] 13. Property-based test Property 6 (template round-trip)
  - [ ] 13.1 Buat `WaBlastTemplateServiceTest` dengan property test Property 6: untuk setiap `name` dan `body` yang valid (tidak kosong, nama unik), setelah `create()` diikuti `findById()`, data yang dikembalikan harus identik dengan data yang disimpan (min 100 iterasi)
