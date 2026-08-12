<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\HeadmasterTenure;

$count = HeadmasterTenure::count();
HeadmasterTenure::truncate();
echo "Berhasil menghapus " . $count . " pengajuan SK Kamad.";
