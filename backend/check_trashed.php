<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\SkDocument;
use Illuminate\Support\Facades\DB;

$count = DB::table('sk_documents')->whereNotNull('deleted_at')->where('deleted_at', '>=', '2026-07-06 00:00:00')->count();
echo "SKs still deleted today: " . $count . "\n";

$sks = DB::table('sk_documents')->whereNotNull('deleted_at')->where('deleted_at', '>=', '2026-07-06 00:00:00')->get();
foreach ($sks as $sk) {
    echo "ID: {$sk->id}, Nama: {$sk->nama}, Deleted At: {$sk->deleted_at}\n";
}
