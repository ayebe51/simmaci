<?php
use App\Models\Teacher;

echo "=== DAFTAR 20 NIM TERTINGGI DI DATABASE ===\n\n";

$topNims = Teacher::withoutGlobalScopes()
    ->whereNotNull('nomor_induk_maarif')
    ->where('nomor_induk_maarif', 'like', '1134%')
    ->whereRaw("LENGTH(nomor_induk_maarif) = 9")
    ->orderByRaw("CAST(nomor_induk_maarif AS BIGINT) DESC")
    ->limit(20)
    ->get(['nama', 'nomor_induk_maarif', 'id']);

foreach ($topNims as $idx => $t) {
    $num = $idx + 1;
    echo "{$num}. NIM: {$t->nomor_induk_maarif} | Nama: {$t->nama} (ID: {$t->id})\n";
}

echo "\nDari daftar di atas, kita bisa melihat apakah ada lompatan angka ekstrem (typo) di nomor teratas.\n";
