<?php
/**
 * Script: cari_sk_hasan_puro.php
 * Tujuan: Mencari pengajuan SK atas nama "Hasan Puro" termasuk yang sudah soft-deleted.
 *
 * Cara menjalankan di server via Docker VPS (SSH ke server dulu):
 *
 *   # Copy file ke container
 *   docker cp cari_sk_hasan_puro.php simmaci-backend:/var/www/
 *
 *   # Jalankan di dalam container
 *   docker exec simmaci-backend php /var/www/cari_sk_hasan_puro.php
 *
 * Atau langsung via artisan tinker tanpa copy file:
 *   docker exec -it simmaci-backend php artisan tinker
 */

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

$keyword = 'hasan puro';

echo "======================================================\n";
echo " PENCARIAN SK: \"{$keyword}\"\n";
echo " Termasuk: aktif + soft-deleted\n";
echo "======================================================\n\n";

// ── 1. Cari di sk_documents (aktif + soft-deleted) ──
$skResults = DB::table('sk_documents')
    ->whereRaw("LOWER(nama) LIKE ?", ['%' . strtolower($keyword) . '%'])
    ->orderBy('created_at', 'desc')
    ->get([
        'id', 'nomor_sk', 'nama', 'jabatan', 'unit_kerja',
        'jenis_sk', 'jenis_pengajuan', 'status',
        'tanggal_penetapan', 'teacher_id', 'school_id',
        'created_at', 'updated_at', 'deleted_at',
    ]);

echo "=== SK DOCUMENTS (sk_documents) ===\n";
echo "Ditemukan: {$skResults->count()} record\n\n";

if ($skResults->isEmpty()) {
    echo "  ❌ Tidak ada SK ditemukan dengan nama mengandung \"{$keyword}\"\n\n";
} else {
    foreach ($skResults as $sk) {
        $isDeleted = !is_null($sk->deleted_at);
        $flag = $isDeleted ? ' 🗑️  [SOFT-DELETED]' : ' ✅ [AKTIF]';
        echo "┌─────────────────────────────────────────────────\n";
        echo "│ ID          : {$sk->id}{$flag}\n";
        echo "│ Nomor SK    : " . ($sk->nomor_sk ?: '-') . "\n";
        echo "│ Nama        : {$sk->nama}\n";
        echo "│ Jabatan     : " . ($sk->jabatan ?: '-') . "\n";
        echo "│ Unit Kerja  : " . ($sk->unit_kerja ?: '-') . "\n";
        echo "│ Jenis SK    : " . ($sk->jenis_sk ?: '-') . "\n";
        echo "│ Jenis Peng. : " . ($sk->jenis_pengajuan ?: '-') . "\n";
        echo "│ Status      : " . ($sk->status ?: '-') . "\n";
        echo "│ Tgl Penetapan: " . ($sk->tanggal_penetapan ?: '-') . "\n";
        echo "│ Teacher ID  : " . ($sk->teacher_id ?: '-') . "\n";
        echo "│ School ID   : " . ($sk->school_id ?: '-') . "\n";
        echo "│ Created At  : {$sk->created_at}\n";
        echo "│ Updated At  : {$sk->updated_at}\n";
        if ($isDeleted) {
            echo "│ Deleted At  : {$sk->deleted_at}  ← TERHAPUS\n";
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

echo "\n=== TEACHERS (teachers) ===\n";
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
        echo "│ NIM         : " . ($t->nomor_induk_maarif ?: '-') . "\n";
        echo "│ NIP         : " . ($t->nip ?: '-') . "\n";
        echo "│ Unit Kerja  : " . ($t->unit_kerja ?: '-') . "\n";
        echo "│ School ID   : " . ($t->school_id ?: '-') . "\n";
        echo "│ Status      : " . ($t->status ?: '-') . "\n";
        echo "│ Is Active   : " . ($t->is_active ? 'Ya' : 'Tidak') . "\n";
        echo "│ Created At  : {$t->created_at}\n";
        if ($isDeleted) {
            echo "│ Deleted At  : {$t->deleted_at}  ← TERHAPUS\n";
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
            'tanggal_penetapan', 'teacher_id',
            'created_at', 'deleted_at',
        ]);

    echo "\n=== SEMUA SK MILIK TEACHER IDs: [" . implode(', ', $teacherIds) . "] ===\n";
    echo "Ditemukan: {$skByTeacher->count()} SK\n\n";

    foreach ($skByTeacher as $sk) {
        $isDeleted = !is_null($sk->deleted_at);
        $flag = $isDeleted ? ' 🗑️  [SOFT-DELETED]' : ' ✅ [AKTIF]';
        echo "  ID:{$sk->id}{$flag} | {$sk->nomor_sk} | {$sk->nama} | {$sk->jenis_sk} | {$sk->status} | {$sk->created_at}\n";
    }
}

// ── 4. Cek activity_logs untuk jejak hapus ──
echo "\n=== ACTIVITY LOGS (jejak hapus/update) ===\n";

$logs = DB::table('activity_log')
    ->where(function ($q) use ($keyword) {
        $q->whereRaw("LOWER(description) LIKE ?", ['%' . strtolower($keyword) . '%'])
          ->orWhereRaw("LOWER(properties::text) LIKE ?", ['%' . strtolower($keyword) . '%']);
    })
    ->orderBy('created_at', 'desc')
    ->limit(20)
    ->get(['id', 'description', 'event', 'subject_type', 'subject_id', 'causer_id', 'created_at', 'properties']);

echo "Ditemukan: {$logs->count()} log entry\n\n";

if ($logs->isEmpty()) {
    echo "  ℹ️  Tidak ada log aktivitas terkait \"{$keyword}\"\n";
} else {
    foreach ($logs as $log) {
        echo "  [{$log->created_at}] {$log->event} — {$log->description}\n";
        echo "  Subject: {$log->subject_type} #{$log->subject_id} | Causer: #{$log->causer_id}\n";
        if ($log->properties && $log->properties !== 'null') {
            $props = json_decode($log->properties, true);
            if ($props) {
                echo "  Properties: " . json_encode($props, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n";
            }
        }
        echo "\n";
    }
}

echo "======================================================\n";
echo " SELESAI\n";
echo "======================================================\n";
