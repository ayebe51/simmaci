<?php
use App\Models\SkDocument;

echo "=== SAMPEL FORMAT NOMOR SK ===\n\n";

$sks = SkDocument::withoutGlobalScopes()
    ->whereNotNull('nomor_sk')
    ->limit(20)
    ->pluck('nomor_sk')
    ->toArray();

foreach ($sks as $sk) {
    echo "- {$sk}\n";
}

echo "\n=== MENCARI SK DENGAN ANGKA 3837 ===\n\n";
$sk3837 = SkDocument::withoutGlobalScopes()
    ->where('nomor_sk', 'like', '%3837%')
    ->pluck('nomor_sk')
    ->toArray();

foreach ($sk3837 as $sk) {
    echo "- {$sk}\n";
}
