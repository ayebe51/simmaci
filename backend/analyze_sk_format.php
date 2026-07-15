<?php

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$sks = \App\Models\SkDocument::where('nomor_sk', 'like', '%/%/%/%')
    ->get(['id', 'nomor_sk']);

$messy = [];
foreach ($sks as $sk) {
    $parts = explode('/', $sk->nomor_sk);
    // Standard format has exactly 7 parts: 0284, PC.L, A.II, H-34.B, 24.29, VII, 2026
    // If it has 8 parts, e.g. 0284, PC.L, A.II, H-34.B, 24.29, 12, 7, 2026
    if (count($parts) > 7) {
        $messy[] = $sk->nomor_sk;
    } else {
        // also check if the month part is not roman numeral
        $monthPart = $parts[5] ?? '';
        if (is_numeric($monthPart)) {
            $messy[] = $sk->nomor_sk;
        }
    }
}

echo "Ditemukan " . count($messy) . " SK dengan format aneh.\n";
foreach (array_slice($messy, 0, 20) as $m) {
    echo $m . "\n";
}
