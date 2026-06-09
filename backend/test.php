<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$urls = App\Models\SkDocument::whereHas('school', function($q) {
    $q->where('nama', 'ilike', '%Salebu%');
})->pluck('surat_permohonan_url', 'nama')->toArray();

echo json_encode($urls, JSON_PRETTY_PRINT);
