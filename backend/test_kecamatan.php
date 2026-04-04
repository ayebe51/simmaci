<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Http\Kernel::class);

$teachers = \App\Models\Teacher::all();
foreach($teachers as $t) {
    echo $t->nama . " - Kecamatan: " . ($t->kecamatan ?? 'NULL') . "\n";
}
