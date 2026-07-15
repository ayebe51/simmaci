<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\SkDocument;

$trashed = SkDocument::withoutGlobalScopes()->onlyTrashed()->get();
$badDeletes = 0;

foreach ($trashed as $t) {
    if (strpos($t->nomor_sk, 'REQ') !== 0 || $t->status !== 'pending') {
        echo "Trash ID: {$t->id} | Nama: {$t->nama} | Nomor SK: {$t->nomor_sk} | Status: {$t->status} | teacher_id: {$t->teacher_id}\n";
        $badDeletes++;
    }
}
echo "Total potentially bad deletes: " . $badDeletes . "\n";
