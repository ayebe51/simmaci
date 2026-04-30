# Implementation Plan: Notification SK Bugs

## Overview

Perbaikan tiga bug pada sistem notifikasi SK yang menyebabkan admin dan operator tidak mendapat informasi tepat waktu. Semua perubahan bersifat minimal dan terlokalisasi:

1. **Bug 1** — `processBulkRequestSync()` tidak mengirim notifikasi ke admin untuk bulk request ≤3 dokumen
2. **Bug 2** — Notifikasi approved/rejected gagal terkirim jika `created_by` kosong atau tidak cocok dengan user terdaftar
3. **Bug 3** — Badge unread count tidak langsung berkurang setelah `markRead`/`markAllRead`

---

## Tasks

- [x] 1. Exploratory Testing — Verifikasi bug ada sebelum fix
  - [x] 1.1 Tulis exploratory test untuk Bug 1 (bulk sync tanpa notifikasi)
    - Buat test di `backend/tests/Unit/SkDocumentNotificationTest.php`
    - Mock `Notification::create` dan assert TIDAK dipanggil dengan tipe `sk_bulk_submitted` saat `processBulkRequestSync` dipanggil dengan 2 dokumen
    - Jalankan test pada kode unfixed — test harus PASS (membuktikan bug ada: notifikasi memang tidak dibuat)
    - Dokumentasikan output sebagai bukti bug
    - _Requirements: 1.1, 1.2_

  - [x] 1.2 Tulis exploratory test untuk Bug 2 (created_by null/tidak ditemukan)
    - Tambahkan test di `backend/tests/Unit/SkDocumentNotificationTest.php`
    - Test case A: SK dengan `created_by = null` → assert tidak ada `Notification` dibuat saat status diubah ke `approved`
    - Test case B: SK dengan `created_by = 'nonexistent@email.com'` → assert tidak ada `Notification` dibuat
    - Jalankan test pada kode unfixed — test harus PASS (membuktikan bug ada)
    - _Requirements: 1.3_

  - [x] 1.3 Tulis exploratory test untuk Bug 3 (badge stale)
    - Buat test di `src/components/common/NotificationDropdown.test.tsx`
    - Render `NotificationDropdown` dengan `unreadCount = 3`
    - Simulasikan klik notifikasi (trigger `markRead`)
    - Assert bahwa badge count TIDAK langsung berubah (masih 3) sebelum refetch selesai
    - Jalankan test pada kode unfixed — test harus PASS (membuktikan bug ada)
    - _Requirements: 1.4, 1.5_

- [x] 2. Fix Bug 1 — Tambah notifikasi admin di `processBulkRequestSync()`
  - [x] 2.1 Tambahkan blok notifikasi ke admin di `processBulkRequestSync()`
    - Buka `backend/app/Http/Controllers/Api/SkDocumentController.php`
    - Temukan method `processBulkRequestSync()` (sekitar baris 713)
    - Setelah `ActivityLog::create(...)` dan sebelum `return response()->json(...)`, tambahkan blok notifikasi:
      ```php
      $admins = User::whereIn('role', ['super_admin', 'admin_yayasan'])->get();
      $operatorSchoolName = $request->user()->school_id
          ? (School::find($request->user()->school_id)?->nama ?? 'Unknown')
          : 'Unknown';
      foreach ($admins as $admin) {
          try {
              Notification::create([
                  'user_id'   => $admin->id,
                  'school_id' => $request->user()->school_id,
                  'type'      => 'sk_bulk_submitted',
                  'title'     => '📋 Pengajuan SK Kolektif Baru',
                  'message'   => "Pengajuan SK kolektif dari {$operatorSchoolName}: {$created} permohonan menunggu verifikasi" .
                      ($skipped > 0 ? ", {$skipped} dilewati." : '.'),
                  'is_read'   => false,
                  'metadata'  => [
                      'school_id' => $request->user()->school_id,
                      'total'     => $created + $skipped,
                      'created'   => $created,
                      'skipped'   => $skipped,
                  ],
              ]);
          } catch (\Exception $e) {
              \Log::error('processBulkRequestSync: Failed to notify admin', [
                  'admin_id' => $admin->id,
                  'error'    => $e->getMessage(),
              ]);
          }
      }
      ```
    - Pastikan `User`, `School`, dan `Notification` sudah di-import (sudah ada di controller)
    - _Requirements: 2.1, 2.2_

  - [x] 2.2 Tulis fix-checking test untuk Bug 1
    - Tambahkan test di `backend/tests/Unit/SkDocumentNotificationTest.php`
    - Panggil `processBulkRequestSync` dengan 1, 2, dan 3 dokumen
    - Assert bahwa `Notification` dengan tipe `sk_bulk_submitted` dibuat untuk setiap admin (`super_admin` dan `admin_yayasan`)
    - Assert bahwa `message` mengandung jumlah dokumen yang benar
    - Jalankan test — harus PASS setelah fix diterapkan
    - _Requirements: 2.1, 2.2_

- [x] 3. Fix Bug 2 — Fallback lookup operator untuk notifikasi approved/rejected
  - [x] 3.1 Tambahkan helper method `findSkOperator()` di `SkDocumentController`
    - Buka `backend/app/Http/Controllers/Api/SkDocumentController.php`
    - Tambahkan private method baru sebelum `isPns()`:
      ```php
      /**
       * Find the operator user who submitted the SK.
       * Primary: lookup by email in created_by field.
       * Fallback: find active operator for the same school.
       */
      private function findSkOperator(SkDocument $sk): ?User
      {
          // Primary: lookup by email stored in created_by
          if (!empty($sk->created_by)) {
              $user = User::where('email', $sk->created_by)->first();
              if ($user) return $user;
          }

          // Fallback: find active operator for the same school
          if ($sk->school_id) {
              return User::where('role', 'operator')
                  ->where('school_id', $sk->school_id)
                  ->first();
          }

          return null;
      }
      ```
    - _Requirements: 2.3_

  - [x] 3.2 Ganti lookup di method `update()` dengan `findSkOperator()`
    - Temukan blok notifikasi di method `update()` (sekitar baris 175):
      ```php
      if ($oldStatus !== $newStatus && in_array($newStatus, ['approved', 'rejected']) && $skDocument->created_by) {
          $targetUser = User::where('email', $skDocument->created_by)->first();
          if ($targetUser) {
      ```
    - Ganti dengan:
      ```php
      if ($oldStatus !== $newStatus && in_array($newStatus, ['approved', 'rejected'])) {
          $targetUser = $this->findSkOperator($skDocument);
          if ($targetUser) {
      ```
    - Hapus kondisi `&& $skDocument->created_by` dari guard luar (fallback sudah menangani kasus null)
    - _Requirements: 2.3_

  - [x] 3.3 Ganti lookup di method `batchUpdateStatus()` dengan `findSkOperator()`
    - Temukan blok notifikasi di method `batchUpdateStatus()` (sekitar baris 280):
      ```php
      if ($sk->created_by) {
          $targetUser = User::where('email', $sk->created_by)->first();
          if ($targetUser) {
      ```
    - Ganti dengan:
      ```php
      $targetUser = $this->findSkOperator($sk);
      if ($targetUser) {
      ```
    - Hapus kondisi `if ($sk->created_by)` yang membungkus blok notifikasi
    - _Requirements: 2.3_

  - [x] 3.4 Tulis fix-checking test untuk Bug 2
    - Tambahkan test di `backend/tests/Unit/SkDocumentNotificationTest.php`
    - Test case A: SK dengan `created_by = null`, ada operator di `school_id` yang sama → assert notifikasi terkirim ke operator tersebut
    - Test case B: SK dengan `created_by = 'deleted@email.com'` (tidak ada di DB), ada operator di `school_id` → assert notifikasi terkirim via fallback
    - Test case C: SK dengan `created_by = 'valid@email.com'` (ada di DB) → assert notifikasi terkirim ke user tersebut (perilaku lama tetap bekerja)
    - Test case D: SK dengan `created_by = null` dan `school_id = null` → assert tidak ada notifikasi (tidak crash)
    - Jalankan test — harus PASS setelah fix diterapkan
    - _Requirements: 2.3_

- [-] 4. Fix Bug 3 — Optimistic update badge unread count
  - [x] 4.1 Tambahkan optimistic update di `handleNotificationClick`
    - Buka `src/components/common/NotificationDropdown.tsx`
    - Temukan `handleNotificationClick` callback (sekitar baris 42)
    - Sebelum `await notificationApi.markRead(notif.id)`, tambahkan optimistic update:
      ```typescript
      // Optimistic update: decrement badge immediately
      queryClient.setQueryData(['notifications-unread-count'], (old: any) => ({
        count: Math.max(0, (old?.count ?? 0) - 1)
      }))
      ```
    - Pertahankan `queryClient.invalidateQueries` yang sudah ada setelah API call untuk sinkronisasi dengan server
    - Tambahkan rollback di catch block jika belum ada:
      ```typescript
      } catch (error) {
        // Rollback: refetch dari server jika optimistic update gagal
        queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] })
        console.error("Failed to mark as read:", error)
      }
      ```
    - _Requirements: 2.4_

  - [x] 4.2 Tambahkan optimistic update di `handleMarkAllRead`
    - Temukan `handleMarkAllRead` function (sekitar baris 84)
    - Sebelum `await notificationApi.markAllRead()`, tambahkan optimistic update:
      ```typescript
      // Optimistic update: clear badge immediately
      queryClient.setQueryData(['notifications-unread-count'], { count: 0 })
      ```
    - Pertahankan `queryClient.invalidateQueries` yang sudah ada setelah API call
    - Tambahkan rollback di catch block jika belum ada:
      ```typescript
      } catch (error) {
        // Rollback: refetch dari server jika optimistic update gagal
        queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] })
        toast.error("Gagal menandai semua notifikasi sebagai dibaca")
      }
      ```
    - _Requirements: 2.5_

  - [-] 4.3 Tulis fix-checking test untuk Bug 3
    - Tambahkan test di `src/components/common/NotificationDropdown.test.tsx`
    - Test A: Render dengan `unreadCount = 3`, simulasikan klik notifikasi, assert badge langsung menampilkan `2` (sebelum API call selesai)
    - Test B: Render dengan `unreadCount = 5`, simulasikan klik "Read All", assert badge langsung menampilkan `0`
    - Test C: Simulasikan API call gagal, assert badge di-rollback ke nilai sebelumnya (via invalidateQueries)
    - Jalankan test — harus PASS setelah fix diterapkan
    - _Requirements: 2.4, 2.5_

- [~] 5. Preservation Testing — Verifikasi perilaku yang tidak berubah
  - [~] 5.1 Tulis preservation test untuk pengajuan individual
    - Tambahkan test di `backend/tests/Unit/SkDocumentNotificationTest.php`
    - Panggil `submitRequest()` dengan data valid
    - Assert bahwa `NotifyAdminsOfSkSubmission` job di-dispatch dengan tipe `sk_submitted`
    - Assert bahwa job TIDAK di-dispatch dengan tipe `sk_bulk_submitted`
    - _Requirements: 3.1_

  - [~] 5.2 Tulis preservation test untuk jalur queue bulk (>3 dokumen)
    - Tambahkan test di `backend/tests/Unit/SkDocumentNotificationTest.php`
    - Panggil `bulkRequest()` dengan 4 dokumen
    - Assert bahwa `ProcessBulkSkSubmission` job di-dispatch (bukan diproses sinkron)
    - Assert bahwa `processBulkRequestSync` TIDAK dipanggil
    - _Requirements: 3.2_

  - [~] 5.3 Tulis preservation test untuk notifikasi dengan created_by valid
    - Tambahkan test di `backend/tests/Unit/SkDocumentNotificationTest.php`
    - SK dengan `created_by = 'valid@email.com'` yang ada di DB
    - Ubah status ke `approved` via `update()`
    - Assert notifikasi terkirim ke user dengan email tersebut (bukan ke operator fallback)
    - _Requirements: 3.1_

  - [~] 5.4 Tulis preservation test untuk polling dan badge display
    - Tambahkan test di `src/components/common/NotificationDropdown.test.tsx`
    - Assert bahwa `refetchInterval: 30000` masih dikonfigurasi pada query `notifications-unread-count`
    - Assert bahwa badge menampilkan "9+" ketika `unreadCount > 9`
    - Assert bahwa badge tidak muncul ketika `unreadCount = 0`
    - _Requirements: 3.5, 3.6_

- [~] 6. Checkpoint — Jalankan semua test dan verifikasi
  - [~] 6.1 Jalankan backend unit tests
    - Dari direktori `backend/`, jalankan: `php artisan test --filter=SkDocumentNotificationTest`
    - Semua test harus PASS
    - Tidak ada regresi pada test lain: `php artisan test`
    - _Requirements: semua_

  - [~] 6.2 Jalankan frontend tests
    - Dari root direktori, jalankan: `npm run test -- --run`
    - Semua test di `NotificationDropdown.test.tsx` harus PASS
    - Tidak ada regresi pada test lain
    - _Requirements: semua_

  - [ ] 6.3 Verifikasi manual di browser (opsional)
    - Login sebagai operator, upload Excel dengan 2 guru
    - Verifikasi admin menerima notifikasi `sk_bulk_submitted`
    - Login sebagai admin, approve SK yang `created_by` kosong
    - Verifikasi operator sekolah menerima notifikasi `sk_approved`
    - Klik notifikasi, verifikasi badge berkurang segera
    - Klik "Read All", verifikasi badge langsung menjadi 0
    - _Requirements: 2.1, 2.3, 2.4, 2.5_

---

## Notes

- Semua perubahan backend ada di satu file: `SkDocumentController.php`
- Semua perubahan frontend ada di satu file: `NotificationDropdown.tsx`
- Fix bersifat additive — tidak ada logika yang dihapus, hanya ditambah/diperbaiki
- Optimistic update di frontend menggunakan `setQueryData` yang sudah tersedia via `useQueryClient()`
- Fallback lookup operator menggunakan `school_id` — jika satu sekolah punya banyak operator, notifikasi dikirim ke operator pertama yang ditemukan (bisa dioptimalkan di masa depan)
- Test exploratory dijalankan SEBELUM fix untuk membuktikan bug ada; test fix-checking dijalankan SETELAH fix

---

## Implementation Order

1. **Phase 1**: Exploratory tests (Task 1) — Buktikan bug ada
2. **Phase 2**: Fix Bug 1 (Task 2) — Backend, 1 method
3. **Phase 3**: Fix Bug 2 (Task 3) — Backend, 1 helper + 2 method updates
4. **Phase 4**: Fix Bug 3 (Task 4) — Frontend, 2 handlers
5. **Phase 5**: Preservation tests + checkpoint (Tasks 5-6) — Verifikasi tidak ada regresi
