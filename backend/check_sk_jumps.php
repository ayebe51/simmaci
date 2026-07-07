<?php
use App\Models\SkDocument;

echo "=== MENDETEKSI NOMOR SK YANG MELOMPAT (HILANG) ===\n\n";

$startNumber = 3837;

// Ambil semua nomor SK, lalu ekstrak angka di dalamnya
$allSks = SkDocument::withoutGlobalScopes()->pluck('nomor_sk')->toArray();
$numbers = [];

foreach ($allSks as $sk) {
    // Asumsi nomor SK diawali dengan angka, misal "3837/SK/..." atau terdapat angka urut di awalnya
    if (preg_match('/^(\d+)/', $sk, $matches)) {
        $num = (int)$matches[1];
        if ($num >= $startNumber) {
            $numbers[] = $num;
        }
    }
}

// Buang duplikat dan urutkan
$numbers = array_unique($numbers);
sort($numbers);

if (empty($numbers)) {
    echo "Tidak ditemukan nomor SK dengan awalan angka di atas $startNumber.\n";
    exit;
}

$highest = end($numbers);
echo "Rentang yang diperiksa: $startNumber s/d $highest\n\n";

$missing = [];
for ($i = $startNumber; $i <= $highest; $i++) {
    if (!in_array($i, $numbers)) {
        $missing[] = $i;
    }
}

if (empty($missing)) {
    echo "✅ LUAR BIASA! Urutan SK dari $startNumber sampai $highest sangat rapi. Tidak ada yang melompat/hilang.\n";
} else {
    echo "⚠️ DITEMUKAN " . count($missing) . " NOMOR SK YANG HILANG (MELOMPAT):\n\n";
    
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
            echo "   -> Nomor " . $g[0] . " (Hilang)\n";
        } else {
            echo "   -> Nomor " . $g[0] . " s/d " . end($g) . " (Hilang beruntun sebanyak " . count($g) . " nomor)\n";
        }
    }
    echo "\nKemungkinan penyebab: Pengajuan SK dihapus/ditolak, atau *auto-increment* terganggu akibat anomali sebelumnya.\n";
}
