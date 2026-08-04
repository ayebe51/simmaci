<?php
/**
 * Script: cari_sk_ulin_nabillah.php
 * Tujuan: Mencari pengajuan SK atas nama "Ulin Nabillah" termasuk yang sudah soft-deleted.
 *
 * Cara menjalankan di server via Docker VPS:
 *
 *   # 1. Copy file ke container (jalankan dari direktori backend/)
 *   docker cp cari_sk_ulin_nabillah.php simmaci-backend:/var/www/
 *
 *   # 2. Jalankan di dalam container
 *   docker exec simmaci-backend php /var/www/cari_sk_ulin_nabillah.php
 *
 * Pastikan nama container sesuai (cek: docker ps | grep backend)
 */

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

$keyword = 'ulin nabillah';

echo "======================================================\n";
echo " PENCARIAN SK: \"{$keyword}\"\n";
echo " Termasuk: aktif + soft-deleted\n";
echo " Dijalankan: " . date('Y-m-d H:i:s') . "\n";
echo "======================================================\n\n";

// ── 1. Cari di sk_documents (aktif + soft-deleted) ──
// Gunakan DB::table langsung agar soft-deleted ikut terbaca (tidak pakai Eloquent scope)
$skResults = DB::table('sk_documents')
    ->whereRaw("LOWER(nama) LIKE ?", ['%' . strtolower($keyword) . '%'])
    ->orderBy('created_at', 'desc')
    ->get([
        'id', 'nomor_sk', 'nomor_permohonan', 'nama', 'jabatan', 'unit_kerja',
        'jenis_sk', 'jenis_pengajuan', 'status',
        'tanggal_penetapan', 'tanggal_permohonan',
        'teacher_id', 'school_id',
        'revision_status', 'revision_reason',
        'archived_at', 'archive_reason',
        'created_at', 'updated_at', 'deleted_at',
    ]);

echo "=== [1] SK DOCUMENTS (sk_documents) ===\n";
echo "Ditemukan: {$skResults->count()} record\n\n";

if ($skResults->isEmpty()) {
    echo "  ❌ Tidak ada SK ditemukan dengan nama mengandung \"{$keyword}\"\n\n";
} else {
    foreach ($skResults as $sk) {
        $isDeleted  = !is_null($sk->deleted_at);
        $isArchived = !is_null($sk->archived_at);
        $flag = $isDeleted ? ' 🗑️  [SOFT-DELETED]' : ($isArchived ? ' 📦 [ARCHIVED]' : ' ✅ [AKTIF]');
        echo "┌─────────────────────────────────────────────────\n";
        echo "│ ID             : {$sk->id}{$flag}\n";
        echo "│ Nomor SK       : " . ($sk->nomor_sk ?: '-') . "\n";
        echo "│ Nomor Permohonan: " . ($sk->nomor_permohonan ?: '-') . "\n";
        echo "│ Nama           : {$sk->nama}\n";
        echo "│ Jabatan        : " . ($sk->jabatan ?: '-') . "\n";
        echo "│ Unit Kerja     : " . ($sk->unit_kerja ?: '-') . "\n";
        echo "│ Jenis SK       : " . ($sk->jenis_sk ?: '-') . "\n";
        echo "│ Jenis Pengajuan: " . ($sk->jenis_pengajuan ?: '-') . "\n";
        echo "│ Status         : " . ($sk->status ?: '-') . "\n";
        echo "│ Tgl Penetapan  : " . ($sk->tanggal_penetapan ?: '-') . "\n";
        echo "│ Tgl Permohonan : " . ($sk->tanggal_permohonan ?: '-') . "\n";
        echo "│ Teacher ID     : " . ($sk->teacher_id ?: 'NULL') . "\n";
        echo "│ School ID      : " . ($sk->school_id ?: '-') . "\n";
        echo "│ Revision Status: " . ($sk->revision_status ?: '-') . "\n";
        echo "│ Revision Reason: " . ($sk->revision_reason ?: '-') . "\n";
        echo "│ Created At     : {$sk->created_at}\n";
        echo "│ Updated At     : {$sk->updated_at}\n";
        if ($isDeleted) {
            echo "│ ⚠️  Deleted At  : {$sk->deleted_at}  ← SOFT-DELETED\n";
        }
        if ($isArchived) {
            echo "│ 📦 Archived At  : {$sk->archived_at} | Alasan: " . ($sk->archive_reason ?: '-') . "\n";
        }
        echo "└─────────────────────────────────────────────────\n\n";
    }
}

// ── 2. Cari di teachers (aktif + soft-deleted) ──
$teacherResults = DB::table('teachers')
    ->whereRaw("LOWER(nama) LIKE ?", ['%' . strtolower($keyword) . '%'])
    ->orderBy('created_at', 'desc')
    ->get([
        'id', 'nama', 'nuptk', 'nomor_induk_maarif', 'nip',
        'unit_kerja', 'school_id', 'status', 'is_active',
        'created_at', 'updated_at', 'deleted_at',
    ]);

echo "\n=== [2] TEACHERS (teachers) ===\n";
echo "Ditemukan: {$teacherResults->count()} record guru\n\n";

if ($teacherResults->isEmpty()) {
    echo "  ❌ Tidak ada guru ditemukan dengan nama mengandung \"{$keyword}\"\n\n";
} else {
    foreach ($teacherResults as $t) {
        $isDeleted = !is_null($t->deleted_at);
        $flag = $isDeleted ? ' 🗑️  [SOFT-DELETED]' : ' ✅ [AKTIF]';
        echo "┌─────────────────────────────────────────────────\n";
        echo "│ ID          : {$t->id}{$flag}\n";
        echo "│ Nama        : {$t->nama}\n";
        echo "│ NUPTK       : " . ($t->nuptk ?: '-') . "\n";
        echo "│ NIM (Maarif): " . ($t->nomor_induk_maarif ?: '-') . "\n";
        echo "│ NIP         : " . ($t->nip ?: '-') . "\n";
        echo "│ Unit Kerja  : " . ($t->unit_kerja ?: '-') . "\n";
        echo "│ School ID   : " . ($t->school_id ?: '-') . "\n";
        echo "│ Status      : " . ($t->status ?: '-') . "\n";
        echo "│ Is Active   : " . (isset($t->is_active) ? ($t->is_active ? 'Ya' : 'Tidak') : '-') . "\n";
        echo "│ Created At  : {$t->created_at}\n";
        if ($isDeleted) {
            echo "│ ⚠️  Deleted At: {$t->deleted_at}  ← SOFT-DELETED\n";
        }
        echo "└─────────────────────────────────────────────────\n\n";
    }

    // ── 3. Cari semua SK milik teacher_id yang ditemukan ──
    $teacherIds = $teacherResults->pluck('id')->toArray();

    $skByTeacher = DB::table('sk_documents')
        ->whereIn('teacher_id', $teacherIds)
        ->orderBy('created_at', 'desc')
        ->get([
            'id', 'nomor_sk', 'nama', 'jabatan', 'unit_kerja',
            'jenis_sk', 'jenis_pengajuan', 'status',
            'tanggal_penetapan', 'teacher_id', 'school_id',
            'created_at', 'deleted_at',
        ]);

    if ($skByTeacher->isNotEmpty()) {
        echo "\n=== [2b] SEMUA SK MILIK TEACHER IDs: [" . implode(', ', $teacherIds) . "] ===\n";
        echo "Ditemukan: {$skByTeacher->count()} SK\n\n";

        foreach ($skByTeacher as $sk) {
            $isDeleted = !is_null($sk->deleted_at);
            $flag = $isDeleted ? ' 🗑️ [DELETED]' : ' ✅ [AKTIF]';
            echo "  • ID:{$sk->id}{$flag} | {$sk->nomor_sk} | {$sk->nama}\n";
            echo "    Jenis: {$sk->jenis_sk} | Status: {$sk->status} | School: {$sk->school_id} | Dibuat: {$sk->created_at}\n\n";
        }
    }
}

// ── 4. Cek activity_logs untuk jejak aktivitas (hapus/update/create) ──
echo "\n=== [3] ACTIVITY LOGS (jejak create/update/hapus) ===\n";

$logs = DB::table('activity_log')
    ->where(function ($q) use ($keyword) {
        $q->whereRaw("LOWER(description) LIKE ?", ['%' . strtolower($keyword) . '%'])
          ->orWhereRaw("LOWER(properties::text) LIKE ?", ['%' . strtolower($keyword) . '%']);
    })
    ->orderBy('created_at', 'desc')
    ->limit(30)
    ->get(['id', 'description', 'event', 'subject_type', 'subject_id', 'causer_id', 'created_at', 'properties']);

echo "Ditemukan: {$logs->count()} log entry\n\n";

if ($logs->isEmpty()) {
    echo "  ℹ️  Tidak ada activity log terkait \"{$keyword}\"\n";
} else {
    foreach ($logs as $log) {
        echo "  [{$log->created_at}] Event: " . strtoupper($log->event ?? '-') . "\n";
        echo "  Deskripsi : {$log->description}\n";
        echo "  Subject   : {$log->subject_type} #{$log->subject_id} | Causer (User ID): #{$log->causer_id}\n";
        if (!empty($log->properties) && $log->properties !== 'null' && $log->properties !== '{}') {
            $props = json_decode($log->properties, true);
            if (is_array($props)) {
                // Tampilkan attributes/old jika ada, untuk melihat nilai sebelum/sesudah perubahan
                if (!empty($props['attributes'])) {
                    echo "  Nilai Baru: " . json_encode($props['attributes'], JSON_UNESCAPED_UNICODE) . "\n";
                }
                if (!empty($props['old'])) {
                    echo "  Nilai Lama: " . json_encode($props['old'], JSON_UNESCAPED_UNICODE) . "\n";
                }
            }
        }
        echo "  " . str_repeat('-', 50) . "\n";
    }
}

// ── 5. Pencarian nama partial yang lebih luas (jaga-jaga salah eja) ──
echo "\n=== [4] PENCARIAN LUAS (partial: 'ulin' saja di sk_documents) ===\n";

$partial = DB::table('sk_documents')
    ->whereRaw("LOWER(nama) LIKE ?", ['%ulin%'])
    ->orderBy('created_at', 'desc')
    ->get(['id', 'nomor_sk', 'nama', 'status', 'school_id', 'created_at', 'deleted_at']);

echo "Ditemukan: {$partial->count()} record dengan nama mengandung 'ulin'\n\n";

foreach ($partial as $sk) {
    $isDeleted = !is_null($sk->deleted_at);
    $flag = $isDeleted ? ' 🗑️ [DELETED]' : ' ✅';
    echo "  • ID:{$sk->id}{$flag} | Nama: {$sk->nama} | Status: {$sk->status} | School: {$sk->school_id} | {$sk->created_at}\n";
}

echo "\n======================================================\n";
echo " SELESAI\n";
echo "======================================================\n";
