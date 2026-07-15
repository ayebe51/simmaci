<?php

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$sks = \App\Models\SkDocument::select('id', 'nomor_sk', 'created_at')
    ->whereNotNull('nomor_sk')
    ->orderBy('id', 'desc')
    ->take(30)
    ->get();

foreach ($sks as $sk) {
    echo "ID: {$sk->id} | Nomor SK: {$sk->nomor_sk} | Created: {$sk->created_at}\n";
}
