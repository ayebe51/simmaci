# Notification SK Bugs — Bugfix Design

## Overview

Tiga bug pada sistem notifikasi SK menyebabkan admin dan operator tidak mendapat informasi tepat waktu tentang status pengajuan SK. Fix yang diperlukan bersifat minimal dan terlokalisasi:

1. **Bug 1 — Missing bulk notification (sync path)**: `processBulkRequestSync()` di `SkDocumentController` tidak memanggil `NotifyAdminsOfSkSubmission` setelah berhasil membuat SK, berbeda dengan jalur queue (`ProcessBulkSkSubmission`) yang sudah mengirim notifikasi. Fix: tambahkan dispatch `NotifyAdminsOfSkSubmission` di akhir `processBulkRequestSync()`.

2. **Bug 2 — Notification delivery failure (created_by lookup)**: `update()` dan `batchUpdateStatus()` mencari user penerima notifikasi via `User::where('email', $sk->created_by)`. Jika `created_by` kosong atau email tidak cocok dengan user terdaftar, notifikasi tidak terkirim. Fix: tambahkan fallback lookup via `school_id` untuk menemukan operator yang tepat.

3. **Bug 3 — Badge count stale after markRead/markAllRead**: Frontend memanggil `queryClient.invalidateQueries()` setelah `markRead`/`markAllRead`, namun badge tetap menampilkan nilai lama karena invalidation hanya memicu refetch — badge tidak diperbarui secara optimistis. Fix: gunakan `queryClient.setQueryData()` untuk memperbarui cache secara langsung sebelum refetch.

## Glossary

- **Bug_Condition (C)**: Kondisi yang memicu bug — jalur sinkron bulk request, `created_by` kosong/tidak cocok, atau badge tidak diperbarui optimistis
- **Property (P)**: Perilaku yang diharapkan — notifikasi terkirim ke semua admin untuk bulk sync, notifikasi terkirim ke operator yang tepat, badge berkurang segera
- **Preservation**: Perilaku yang tidak boleh berubah — pengajuan individual, jalur queue bulk, navigasi notifikasi, polling 30 detik
- **processBulkRequestSync**: Method private di `SkDocumentController` (baris ~713) yang memproses bulk request ≤3 dokumen secara sinkron
- **NotifyAdminsOfSkSubmission**: Job di `app/Jobs/NotifyAdminsOfSkSubmission.php` yang mengirim notifikasi `sk_submitted` ke semua `super_admin` dan `admin_yayasan`
- **created_by**: Field email di tabel `sk_documents` yang menyimpan email pembuat SK — digunakan untuk lookup user penerima notifikasi approved/rejected
- **invalidateQueries**: TanStack Query API yang menandai cache sebagai stale dan memicu refetch — tidak memperbarui nilai secara langsung
- **setQueryData**: TanStack Query API yang memperbarui cache secara langsung (optimistic update) tanpa menunggu network request

## Bug Details

### Bug Condition

Bug manifests dalam tiga kondisi berbeda yang dapat diidentifikasi secara independen:

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { action, context }
  OUTPUT: boolean

  IF action = 'bulk_submit' AND context.documentCount <= 3
    RETURN true  // Bug 1: sync path tidak notify admin

  IF action IN ['approve', 'reject'] AND (
    context.sk.created_by IS NULL OR
    context.sk.created_by = '' OR
    NOT EXISTS(User WHERE email = context.sk.created_by)
  )
    RETURN true  // Bug 2: created_by lookup gagal

  IF action IN ['markRead', 'markAllRead'] AND
    context.badgeCount > 0 AND
    context.updateMethod = 'invalidateOnly'
    RETURN true  // Bug 3: badge tidak update optimistis

  RETURN false
END FUNCTION
```

### Examples

**Bug 1:**
- Operator mengupload Excel dengan 2 guru → `processBulkRequestSync` dipanggil → SK dibuat → **tidak ada notifikasi ke admin** (expected: admin menerima `sk_bulk_submitted`)
- Operator mengupload Excel dengan 3 guru → sama, tidak ada notifikasi
- Operator mengupload Excel dengan 4 guru → `ProcessBulkSkSubmission` job dipanggil → **admin menerima notifikasi** (jalur ini sudah benar)

**Bug 2:**
- Admin menyetujui SK yang `created_by = null` → `if ($sk->created_by)` bernilai false → **tidak ada notifikasi ke operator**
- Admin menyetujui SK yang `created_by = 'lama@sekolah.com'` tapi user sudah dihapus → `User::where('email', ...)` returns null → **tidak ada notifikasi**
- Admin menyetujui SK yang `created_by = 'operator@sekolah.com'` dan user ada → notifikasi terkirim (jalur ini sudah benar)

**Bug 3:**
- User klik notifikasi → `markRead` dipanggil → `invalidateQueries` dipanggil → badge masih menampilkan angka lama selama ~100-500ms hingga refetch selesai
- User klik "Read All" → `markAllRead` dipanggil → `invalidateQueries` dipanggil → badge tetap menampilkan angka lama hingga polling 30 detik berikutnya (jika refetch tidak segera terjadi)

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Pengajuan SK individual via `submitRequest()` tetap mengirim notifikasi ke admin via `NotifyAdminsOfSkSubmission` job seperti sekarang
- Pengajuan SK kolektif >3 dokumen via `ProcessBulkSkSubmission` job tetap mengirim notifikasi `sk_bulk_submitted` ke admin dan `sk_bulk_completed` ke operator
- Dropdown notifikasi tetap menampilkan maksimal 50 notifikasi terbaru, diurutkan dari yang terbaru
- Klik notifikasi tetap mengarahkan ke halaman yang relevan berdasarkan tipe notifikasi
- Polling notifikasi setiap 30 detik tetap berjalan untuk memperbarui daftar dan unread count
- Badge menampilkan "9+" jika unread count > 9

**Scope:**
Semua input yang TIDAK memenuhi kondisi bug di atas harus sepenuhnya tidak terpengaruh oleh fix ini. Ini mencakup:
- Pengajuan individual (bukan bulk)
- Bulk request dengan >3 dokumen (jalur queue)
- Notifikasi untuk SK yang `created_by` valid dan user-nya ada
- Interaksi UI selain markRead/markAllRead

## Hypothesized Root Cause

### Bug 1 — Missing notification in sync path

`processBulkRequestSync()` adalah method yang ditambahkan sebagai optimasi untuk batch kecil (≤3 dokumen) agar tidak perlu menunggu queue. Namun saat method ini ditulis, bagian notifikasi ke admin tidak disertakan — kemungkinan karena fokus pada logika pembuatan SK dan activity log saja. Jalur queue (`ProcessBulkSkSubmission`) sudah memiliki notifikasi karena ditulis lebih lengkap.

**Root cause**: `processBulkRequestSync()` tidak memanggil `NotifyAdminsOfSkSubmission::dispatch()` setelah loop pembuatan SK selesai.

### Bug 2 — Notification delivery failure

Kode di `update()` dan `batchUpdateStatus()` menggunakan `$sk->created_by` (email) untuk mencari user penerima notifikasi. Ini fragile karena:
1. `created_by` bisa null jika SK dibuat via import/admin panel tanpa user context
2. Email bisa berubah jika user mengubah email mereka
3. User bisa dihapus (soft delete) sehingga query tidak menemukan record

**Root cause**: Lookup `User::where('email', $sk->created_by)` tidak memiliki fallback. Seharusnya ada fallback ke operator aktif di sekolah yang sama (`school_id`).

### Bug 3 — Stale badge after markRead/markAllRead

`queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] })` hanya menandai query sebagai stale dan memicu background refetch. Badge tidak diperbarui sampai refetch selesai. Untuk `markAllRead`, jika refetch tidak segera terjadi (misalnya karena network lambat atau window tidak fokus), badge tetap menampilkan angka lama hingga polling 30 detik berikutnya.

**Root cause**: Tidak ada optimistic update pada `unreadCount` cache setelah `markRead`/`markAllRead`. Solusi: gunakan `queryClient.setQueryData()` untuk langsung set count ke nilai yang benar sebelum/bersamaan dengan invalidation.

## Correctness Properties

Property 1: Bug Condition — Bulk Sync Notification

_For any_ bulk SK submission where `documentCount <= 3` (processed via `processBulkRequestSync`), the fixed function SHALL dispatch `NotifyAdminsOfSkSubmission` to all `super_admin` and `admin_yayasan` users with type `sk_bulk_submitted`, identical to the behavior of the queue path for `documentCount > 3`.

**Validates: Requirements 2.1, 2.2**

Property 2: Bug Condition — Approved/Rejected Notification Delivery

_For any_ SK status change to `approved` or `rejected`, the fixed function SHALL successfully deliver a notification to the operator who submitted the SK, even when `created_by` is null, empty, or does not match any active user — using `school_id`-based fallback lookup.

**Validates: Requirements 2.3**

Property 3: Bug Condition — Immediate Badge Update

_For any_ call to `markRead` or `markAllRead`, the fixed frontend SHALL immediately update the badge unread count (via optimistic update) without waiting for the next polling interval or network refetch to complete.

**Validates: Requirements 2.4, 2.5**

Property 4: Preservation — Individual Submission Unchanged

_For any_ individual SK submission via `submitRequest`, the fixed code SHALL produce exactly the same notification behavior as the original code — dispatching `NotifyAdminsOfSkSubmission` with type `sk_submitted`.

**Validates: Requirements 3.1**

Property 5: Preservation — Queue Bulk Path Unchanged

_For any_ bulk SK submission where `documentCount > 3` (processed via `ProcessBulkSkSubmission` job), the fixed code SHALL produce exactly the same notification behavior as the original code — sending `sk_bulk_submitted` to admins and `sk_bulk_completed` to the operator.

**Validates: Requirements 3.2**

## Fix Implementation

### Changes Required

#### Fix 1: `processBulkRequestSync()` — Tambah dispatch notifikasi

**File**: `backend/app/Http/Controllers/Api/SkDocumentController.php`

**Function**: `processBulkRequestSync()`

**Specific Changes**:
1. **Tambah dispatch NotifyAdminsOfSkSubmission**: Setelah loop `foreach` selesai dan activity log dibuat, tambahkan blok notifikasi yang mirip dengan `ProcessBulkSkSubmission::handle()`:
   ```php
   // Notify admins about the new bulk submission
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
2. **Pastikan import**: `User`, `School`, dan `Notification` sudah di-import di bagian atas controller (sudah ada).

#### Fix 2: `update()` dan `batchUpdateStatus()` — Fallback lookup operator

**File**: `backend/app/Http/Controllers/Api/SkDocumentController.php`

**Functions**: `update()` dan `batchUpdateStatus()`

**Specific Changes**:
1. **Buat helper method private** `findSkOperator(SkDocument $sk): ?User` yang melakukan lookup dengan fallback:
   ```php
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
2. **Ganti lookup di `update()`**: Ubah `User::where('email', $skDocument->created_by)->first()` menjadi `$this->findSkOperator($skDocument)`, dan hapus kondisi `if ($skDocument->created_by)` yang membungkusnya.
3. **Ganti lookup di `batchUpdateStatus()`**: Ubah `User::where('email', $sk->created_by)->first()` menjadi `$this->findSkOperator($sk)`, dan hapus kondisi `if ($sk->created_by)` yang membungkusnya.

#### Fix 3: `NotificationDropdown.tsx` — Optimistic update badge

**File**: `src/components/common/NotificationDropdown.tsx`

**Specific Changes**:
1. **`handleNotificationClick`**: Sebelum memanggil `notificationApi.markRead()`, tambahkan optimistic update:
   ```typescript
   // Optimistic update: decrement badge immediately
   queryClient.setQueryData(['notifications-unread-count'], (old: any) => ({
     count: Math.max(0, (old?.count ?? 0) - 1)
   }))
   ```
2. **`handleMarkAllRead`**: Sebelum memanggil `notificationApi.markAllRead()`, tambahkan optimistic update:
   ```typescript
   // Optimistic update: clear badge immediately
   queryClient.setQueryData(['notifications-unread-count'], { count: 0 })
   ```
3. **Tetap pertahankan `invalidateQueries`** setelah API call selesai untuk memastikan data konsisten dengan server.
4. **Rollback on error**: Jika API call gagal, invalidate query untuk memaksa refetch dari server (sudah di-handle oleh `invalidateQueries` di catch block yang perlu ditambahkan).

## Testing Strategy

### Validation Approach

Strategi testing mengikuti dua fase: pertama, surface counterexample yang mendemonstrasikan bug pada kode yang belum difix, kemudian verifikasi fix bekerja dengan benar dan tidak merusak perilaku yang sudah ada.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexample yang mendemonstrasikan bug SEBELUM mengimplementasikan fix. Konfirmasi atau refutasi analisis root cause.

**Test Plan**: Tulis unit test yang memanggil method yang bermasalah dengan input yang memenuhi bug condition, lalu assert bahwa perilaku yang diharapkan TIDAK terjadi (untuk membuktikan bug ada).

**Test Cases**:
1. **Bulk Sync No Notification Test**: Panggil `processBulkRequestSync` dengan 2 dokumen, assert bahwa tidak ada `Notification` dengan tipe `sk_bulk_submitted` yang dibuat (akan PASS pada kode unfixed, membuktikan bug)
2. **Created By Null Test**: Panggil `update()` dengan status `approved` pada SK yang `created_by = null`, assert bahwa tidak ada `Notification` yang dibuat (akan PASS pada kode unfixed, membuktikan bug)
3. **Created By Not Found Test**: Panggil `update()` dengan status `approved` pada SK yang `created_by = 'nonexistent@email.com'`, assert bahwa tidak ada `Notification` yang dibuat (akan PASS pada kode unfixed, membuktikan bug)
4. **Badge Stale Test**: Simulasikan `markRead` call, assert bahwa `notifications-unread-count` cache diperbarui secara sinkron (akan FAIL pada kode unfixed karena hanya invalidate)

**Expected Counterexamples**:
- Tidak ada notifikasi `sk_bulk_submitted` untuk bulk sync ≤3 dokumen
- Tidak ada notifikasi `sk_approved`/`sk_rejected` ketika `created_by` null atau tidak ditemukan
- Badge count tidak berubah segera setelah `markRead`/`markAllRead`

### Fix Checking

**Goal**: Verifikasi bahwa untuk semua input di mana bug condition terpenuhi, fungsi yang sudah difix menghasilkan perilaku yang diharapkan.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := fixedFunction(input)
  ASSERT expectedBehavior(result)
END FOR
```

**Test Cases**:
1. Bulk sync dengan 1, 2, 3 dokumen → assert notifikasi `sk_bulk_submitted` dibuat untuk semua admin
2. Approve SK dengan `created_by = null` → assert notifikasi `sk_approved` dikirim ke operator sekolah
3. Approve SK dengan `created_by = 'deleted@email.com'` → assert notifikasi dikirim ke operator sekolah via fallback
4. `markRead` → assert `notifications-unread-count` cache langsung berkurang 1
5. `markAllRead` → assert `notifications-unread-count` cache langsung menjadi 0

### Preservation Checking

**Goal**: Verifikasi bahwa untuk semua input di mana bug condition TIDAK terpenuhi, fungsi yang sudah difix menghasilkan hasil yang sama dengan fungsi original.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT originalFunction(input) = fixedFunction(input)
END FOR
```

**Testing Approach**: Property-based testing direkomendasikan untuk preservation checking karena:
- Menghasilkan banyak test case secara otomatis di seluruh domain input
- Menangkap edge case yang mungkin terlewat oleh unit test manual
- Memberikan jaminan kuat bahwa perilaku tidak berubah untuk semua input non-buggy

**Test Cases**:
1. **Individual Submission Preservation**: Verifikasi `submitRequest` masih dispatch `NotifyAdminsOfSkSubmission` dengan tipe `sk_submitted`
2. **Queue Bulk Preservation**: Verifikasi `ProcessBulkSkSubmission` job masih mengirim `sk_bulk_submitted` ke admin dan `sk_bulk_completed` ke operator
3. **Valid Created By Preservation**: Verifikasi notifikasi approved/rejected masih terkirim ketika `created_by` valid dan user ditemukan
4. **Polling Preservation**: Verifikasi `refetchInterval: 30000` masih ada dan berfungsi

### Unit Tests

- Test `processBulkRequestSync` dengan 1, 2, 3 dokumen — verifikasi notifikasi dibuat untuk semua admin
- Test `findSkOperator` helper dengan berbagai skenario: `created_by` valid, null, tidak ditemukan, fallback ke school operator
- Test `update()` dengan status change ke `approved`/`rejected` — verifikasi notifikasi terkirim dengan dan tanpa `created_by`
- Test `batchUpdateStatus()` dengan multiple SK — verifikasi notifikasi terkirim untuk setiap SK
- Test optimistic update di `handleNotificationClick` — verifikasi cache diperbarui sebelum API call selesai
- Test optimistic update di `handleMarkAllRead` — verifikasi cache di-set ke 0 segera

### Property-Based Tests

- Generate random array of SK documents (1-3 items) dan verifikasi bahwa `processBulkRequestSync` selalu membuat notifikasi untuk semua admin
- Generate random SK dengan berbagai kombinasi `created_by` (null, valid email, invalid email) dan verifikasi notifikasi selalu terkirim ke operator yang tepat
- Generate random sequence of `markRead`/`markAllRead` calls dan verifikasi badge count selalu konsisten dengan state yang diharapkan

### Integration Tests

- Test full flow: operator upload 2 dokumen → admin menerima notifikasi → admin approve → operator menerima notifikasi
- Test full flow: operator upload 5 dokumen (queue) → admin menerima notifikasi → verifikasi konsistensi dengan jalur sync
- Test badge update: buka dropdown → klik notifikasi → verifikasi badge berkurang segera tanpa reload
