<?php
// Jalankan: php artisan tinker --execute="require 'check_nim_gap.php';"

use App\Models\Teacher;

// 1. NIM tertinggi aktif
$maxNim = Teacher::withoutGlobalScope(\App\Models\Scopes\TenantScope::class)
    ->where('nomor_induk_maarif', 'like', '1134%')
    ->whereRaw("LENGTH(nomor_induk_maarif) = 9")
    ->whereRaw("nomor_induk_maarif ~ '^[0-9]+$'")
    ->whereNull('deleted_at')
    ->orderByRaw('CAST(nomor_induk_maarif AS BIGINT) DESC')
    ->value('nomor_induk_maarif');

echo "NIM tertinggi aktif : $maxNim\n";
$maxSeq = (int) substr($maxNim, 4);

// 2. Semua NIM aktif dalam range 113403800 - MAX
$nims = Teacher::withoutGlobalScope(\App\Models\Scopes\TenantScope::class)
    ->whereRaw("nomor_induk_maarif ~ '^[0-9]+$'")
    ->whereRaw("CAST(nomor_induk_maarif AS BIGINT) BETWEEN 113403800 AND $maxNim")
    ->whereNull('deleted_at')
    ->orderByRaw('CAST(nomor_induk_maarif AS BIGINT) ASC')
    ->pluck('nomor_induk_maarif')
    ->toArray();

echo "Total NIM aktif di range 113403800-$maxNim : " . count($nims) . "\n\n";

// 3. Temukan semua gap
$nimSet = array_flip($nims);
$gaps = [];
for ($seq = 3800; $seq <= $maxSeq; $seq++) {
    $candidate = '1134' . str_pad($seq, 5, '0', STR_PAD_LEFT);
    if (!isset($nimSet[$candidate])) {
        $gaps[] = $candidate;
    }
}

echo "Jumlah gap (NIM kosong) di range: " . count($gaps) . "\n";
if (!empty($gaps)) {
    echo "Gap pertama : " . $gaps[0] . "\n";
    echo "Gap terakhir: " . end($gaps) . "\n";
    echo "\nDaftar semua gap:\n";
    foreach ($gaps as $g) {
        echo "  $g\n";
    }
}

echo "\nKesimpulan:\n";
echo "  Jika generate dari gap pertama  : mulai dari " . ($gaps[0] ?? 'tidak ada gap') . "\n";
echo "  Jika generate dari MAX+1        : mulai dari 1134" . str_pad($maxSeq + 1, 5, '0', STR_PAD_LEFT) . "\n";
