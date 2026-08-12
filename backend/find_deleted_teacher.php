<?php

/**
 * Script: Cari data guru terhapus atas nama Nani Widianingsih
 * Jalankan dari folder backend/ dengan:
 *   php artisan tinker --execute="require base_path('find_deleted_teacher.php');"
 * atau langsung:
 *   php find_deleted_teacher.php
 */

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Teacher;
use App\Models\School;
use Illuminate\Support\Str;

$keyword = 'nani widianingsih';

echo "=============================================================\n";
echo "  PENCARIAN DATA GURU TERHAPUS\n";
echo "  Kata kunci: \"{$keyword}\"\n";
echo "=============================================================\n\n";

// Cari dengan withTrashed() agar soft-deleted ikut terambil
// Gunakan withoutGlobalScopes agar tidak terkena TenantScope
$results = Teacher::withoutGlobalScopes()
    ->withTrashed()
    ->whereRaw("LOWER(nama) LIKE ?", ['%' . strtolower($keyword) . '%'])
    ->with('school:id,nama')
    ->orderBy('deleted_at', 'asc')
    ->get();

if ($results->isEmpty()) {
    echo "❌ Tidak ditemukan data guru dengan nama mengandung \"{$keyword}\".\n";
    echo "   (termasuk yang aktif, tidak aktif, maupun yang terhapus)\n\n";

    // Coba pencarian lebih longgar per kata
    $words = explode(' ', strtolower($keyword));
    echo "Mencoba pencarian per kata:\n";
    foreach ($words as $word) {
        $count = Teacher::withoutGlobalScopes()
            ->withTrashed()
            ->whereRaw("LOWER(nama) LIKE ?", ['%' . $word . '%'])
            ->count();
        echo "  - \"{$word}\": {$count} record ditemukan\n";
    }
    exit;
}

echo "✅ Ditemukan {$results->count()} record:\n\n";

foreach ($results as $i => $teacher) {
    $no        = $i + 1;
    $status    = $teacher->deleted_at ? '🗑️  TERHAPUS' : '✅ AKTIF';
    $sekolah   = $teacher->school ? $teacher->school->nama : "(school_id: {$teacher->school_id})";

    echo "── Record #{$no} ─────────────────────────────────────────────\n";
    echo "  ID             : {$teacher->id}\n";
    echo "  Nama           : {$teacher->nama}\n";
    echo "  Status Record  : {$status}\n";
    echo "  Sekolah        : {$sekolah}  (school_id: {$teacher->school_id})\n";
    echo "  NUPTK          : " . ($teacher->nuptk      ?: '-') . "\n";
    echo "  NIM Maarif     : " . ($teacher->nomor_induk_maarif ?: '-') . "\n";
    echo "  NIP            : " . ($teacher->nip        ?: '-') . "\n";
    echo "  No. KTA        : " . ($teacher->kta_number ?: '-') . "\n";
    echo "  Jenis Kelamin  : " . ($teacher->jenis_kelamin ?: '-') . "\n";
    echo "  TTL            : " . ($teacher->tempat_lahir ?: '-') . ", " . ($teacher->tanggal_lahir ?: '-') . "\n";
    echo "  Status Guru    : " . ($teacher->status     ?: '-') . "\n";
    echo "  Is Active      : " . ($teacher->is_active  ? 'Ya' : 'Tidak') . "\n";
    echo "  Is Verified    : " . ($teacher->is_verified ? 'Ya' : 'Tidak') . "\n";
    echo "  Phone          : " . ($teacher->phone_number ?: '-') . "\n";
    echo "  Email          : " . ($teacher->email      ?: '-') . "\n";
    echo "  Created At     : {$teacher->created_at}\n";
    echo "  Updated At     : {$teacher->updated_at}\n";
    echo "  Deleted At     : " . ($teacher->deleted_at ?: '(tidak terhapus)') . "\n";

    // Cek apakah punya SK dokumen terkait
    $skCount = \App\Models\SkDocument::withoutGlobalScopes()
        ->withTrashed()
        ->where('teacher_id', $teacher->id)
        ->count();
    echo "  SK Terkait     : {$skCount} dokumen\n";

    echo "\n";
}

echo "=============================================================\n";
echo "  Selesai.\n";
echo "=============================================================\n";
