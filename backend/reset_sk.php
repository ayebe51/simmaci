<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\SkDocument;

$count = SkDocument::where('file_url', 'like', 'Generated via Bulk%')
    ->update([
        'file_url' => null,
        'nomor_sk' => null,
    ]);

echo "Reset $count SK documents.\n";
