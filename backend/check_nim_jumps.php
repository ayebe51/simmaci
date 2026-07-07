<?php
use App\Models\Teacher;

echo "=== MENDETEKSI NIM YANG MELOMPAT (HILANG) ===\n\n";

$startNimPrefix = '1134';
$startNum = 3837; // Angka urut 5 digit terakhir

// Ambil semua NIM yang berformat valid (1134 + 5 angka)
$allNims = Teacher::withoutGlobalScopes()
    ->whereNotNull('nomor_induk_maarif')
    ->where('nomor_induk_maarif', 'like', $startNimPrefix . '%')
    ->whereRaw("LENGTH(nomor_induk_maarif) = 9")
    ->pluck('nomor_induk_maarif')
    ->toArray();

$numbers = [];

foreach ($allNims as $nim) {
    // Ekstrak 5 angka terakhir (setelah 1134)
    $suffix = substr($nim, 4);
    $num = (int)$suffix;
    
    if ($num >= $startNum) {
        $numbers[] = $num;
    }
}

// Buang duplikat dan urutkan
$numbers = array_unique($numbers);
sort($numbers);

if (empty($numbers)) {
    echo "Tidak ditemukan NIM dengan angka urut di atas $startNum.\n";
    exit;
}

$highest = end($numbers);
$startStr = $startNimPrefix . str_pad($startNum, 5, '0', STR_PAD_LEFT);
$endStr = $startNimPrefix . str_pad($highest, 5, '0', STR_PAD_LEFT);

echo "Rentang yang diperiksa: $startStr s/d $endStr\n\n";

$missing = [];
for ($i = $startNum; $i <= $highest; $i++) {
    if (!in_array($i, $numbers)) {
        $missing[] = $i;
    }
}

if (empty($missing)) {
    echo "✅ LUAR BIASA! Urutan NIM dari $startStr sampai $endStr sangat rapi. Tidak ada yang melompat/hilang.\n";
} else {
    echo "⚠️ DITEMUKAN " . count($missing) . " NIM YANG HILANG (MELOMPAT):\n\n";
    
    // Kelompokkan angka yang berurutan agar tampilan lebih rapi
    $groups = [];
    $currentGroup = [];
    
    foreach ($missing as $num) {
        if (empty($currentGroup)) {
            $currentGroup[] = $num;
        } else {
            $last = end($currentGroup);
            if ($num == $last + 1) {
                $currentGroup[] = $num;
            } else {
                $groups[] = $currentGroup;
                $currentGroup = [$num];
            }
        }
    }
    if (!empty($currentGroup)) {
        $groups[] = $currentGroup;
    }
    
    foreach ($groups as $g) {
        if (count($g) == 1) {
            $nimMissing = $startNimPrefix . str_pad($g[0], 5, '0', STR_PAD_LEFT);
            echo "   -> NIM $nimMissing (Hilang)\n";
        } else {
            $nimStart = $startNimPrefix . str_pad($g[0], 5, '0', STR_PAD_LEFT);
            $nimEnd = $startNimPrefix . str_pad(end($g), 5, '0', STR_PAD_LEFT);
            echo "   -> NIM $nimStart s/d $nimEnd (Hilang beruntun sebanyak " . count($g) . " nomor)\n";
        }
    }
    echo "\nKemungkinan penyebab: Data profil guru dihapus secara permanen (Hard Delete) setelah NIM dibuat, atau terjadi *typo/lompatan* saat pembuatan (Generate) NIM.\n";
}
