<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\SkDocument;

$count = SkDocument::withoutGlobalScopes()->onlyTrashed()->where('deleted_at', '>=', '2026-07-06 00:00:00')->count();
echo "SKs still deleted today: " . $count . "\n";
