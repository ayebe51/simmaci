# Bugfix Requirements Document

## Introduction

Sistem notifikasi SK (Surat Keputusan) memiliki empat bug yang menyebabkan admin dan operator tidak mendapatkan informasi yang tepat waktu tentang status pengajuan SK. Bug-bug ini berdampak pada alur kerja persetujuan SK karena admin tidak mengetahui adanya pengajuan baru dari jalur kolektif, operator tidak mendapat konfirmasi saat SK mereka disetujui atau ditolak, dan badge notifikasi menampilkan jumlah yang tidak akurat karena notifikasi yang sudah dibaca masih dihitung.

Berdasarkan analisis kode:
- `processBulkRequestSync()` (pengajuan kolektif ≤3 dokumen) tidak memanggil `NotifyAdminsOfSkSubmission` — berbeda dengan `submitRequest()` (individual) yang sudah memanggil job tersebut.
- `batchUpdateStatus()` sudah mengirim notifikasi approved/rejected, namun `update()` (single SK) juga sudah mengirim — keduanya berfungsi. Bug yang dilaporkan user kemungkinan terjadi karena notifikasi dikirim ke `created_by` (email pembuat SK), bukan ke operator yang sedang login, sehingga notifikasi tidak muncul jika operator berbeda.
- `unreadCount` di backend menggunakan scope `unread()` yang benar (`is_read = false`), namun frontend mengambil `unreadRes?.count` — perlu diverifikasi apakah ada kondisi di mana badge tidak berkurang setelah `markRead` atau `markAllRead` dipanggil.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN operator mengajukan SK kolektif dengan jumlah dokumen ≤ 3 (diproses secara sinkron via `processBulkRequestSync`) THEN sistem tidak mengirimkan notifikasi apapun kepada admin (`super_admin` / `admin_yayasan`)

1.2 WHEN operator mengajukan SK kolektif dengan jumlah dokumen > 3 (diproses via queue `ProcessBulkSkSubmission`) THEN sistem mengirimkan notifikasi ke admin dengan tipe `sk_bulk_submitted`, namun pengajuan kolektif ≤ 3 dokumen tidak mendapat perlakuan yang sama

1.3 WHEN admin menyetujui atau menolak pengajuan SK (via `update()` atau `batchUpdateStatus()`) THEN sistem mencari user berdasarkan `created_by` (email pembuat SK), sehingga notifikasi tidak terkirim jika field `created_by` kosong atau email tidak cocok dengan user yang terdaftar

1.4 WHEN pengguna mengklik sebuah notifikasi (memanggil `markRead`) THEN sistem memperbarui `is_read = true` di database dan menginvalidasi query cache, namun badge unread count di tombol notifikasi tidak langsung berkurang karena query `notifications-unread-count` di-refetch secara terpisah dan mungkin menampilkan nilai lama sebelum refetch selesai

1.5 WHEN pengguna mengklik "Read All" (memanggil `markAllRead`) THEN sistem memperbarui semua notifikasi menjadi `is_read = true`, namun badge unread count tetap menampilkan angka lama hingga polling interval 30 detik berikutnya selesai

### Expected Behavior (Correct)

2.1 WHEN operator mengajukan SK kolektif dengan jumlah dokumen ≤ 3 (diproses via `processBulkRequestSync`) THEN sistem SHALL mengirimkan notifikasi kepada semua admin (`super_admin` / `admin_yayasan`) dengan tipe `sk_bulk_submitted` yang berisi jumlah dokumen yang diajukan

2.2 WHEN operator mengajukan SK kolektif dengan jumlah dokumen berapa pun THEN sistem SHALL mengirimkan notifikasi ke admin dengan format dan konten yang konsisten, tidak bergantung pada jalur pemrosesan (sinkron atau queue)

2.3 WHEN admin menyetujui atau menolak pengajuan SK THEN sistem SHALL mengirimkan notifikasi kepada operator yang mengajukan SK tersebut, dengan fallback yang tepat jika `created_by` tidak ditemukan di tabel users

2.4 WHEN pengguna mengklik sebuah notifikasi untuk menandainya sudah dibaca THEN sistem SHALL segera memperbarui badge unread count tanpa menunggu polling interval berikutnya

2.5 WHEN pengguna mengklik "Read All" THEN sistem SHALL segera menghilangkan badge unread count (menampilkan 0) tanpa menunggu polling interval berikutnya

### Unchanged Behavior (Regression Prevention)

3.1 WHEN operator mengajukan SK individual (satuan) via `submitRequest` THEN sistem SHALL CONTINUE TO mengirimkan notifikasi ke semua admin via job `NotifyAdminsOfSkSubmission` seperti yang sudah berjalan saat ini

3.2 WHEN operator mengajukan SK kolektif dengan jumlah dokumen > 3 (diproses via queue) THEN sistem SHALL CONTINUE TO mengirimkan notifikasi ke admin dengan tipe `sk_bulk_submitted` dan notifikasi ke operator dengan tipe `sk_bulk_completed` seperti yang sudah berjalan saat ini

3.3 WHEN pengguna membuka dropdown notifikasi THEN sistem SHALL CONTINUE TO menampilkan daftar notifikasi terbaru (maksimal 50) yang diurutkan dari yang terbaru

3.4 WHEN notifikasi diklik THEN sistem SHALL CONTINUE TO mengarahkan pengguna ke halaman yang relevan berdasarkan tipe notifikasi (misal: `/dashboard/sk/{id}` untuk notifikasi SK)

3.5 WHEN sistem melakukan polling notifikasi setiap 30 detik THEN sistem SHALL CONTINUE TO memperbarui daftar notifikasi dan unread count secara otomatis

3.6 WHEN badge unread count menampilkan angka THEN sistem SHALL CONTINUE TO menampilkan "9+" jika jumlah notifikasi belum dibaca melebihi 9
