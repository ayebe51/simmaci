<?php

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\SkDocument;

echo "=== MEMULAI NORMALISASI HURUF KAPITAL UNIT KERJA DI SK ===\n\n";

$updatedSks = 0;
SkDocument::chunk(200, function ($sks) use (&$updatedSks) {
    foreach ($sks as $sk) {
        $changes = [];
        if ($sk->unit_kerja && strtoupper($sk->unit_kerja) === $sk->unit_kerja) {
            $changes['unit_kerja'] = ucwords(strtolower($sk->unit_kerja));
        }
        
        // Optionally normalize teacher name if all caps? No, usually names are all caps in some systems, let's just stick to unit_kerja
        if (!empty($changes)) {
            SkDocument::where('id', $sk->id)->update($changes);
            $updatedSks++;
            echo "✅ [SK ID: {$sk->id}] {$sk->nama} -> " . json_encode($changes) . "\n";
        }
    }
});

echo "\nTotal SK Diperbarui: $updatedSks\n";
echo "\n=== NORMALISASI SELESAI ===\n";
