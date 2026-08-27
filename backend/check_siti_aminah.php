<?php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Teacher;
use App\Models\School;
use App\Models\SkDocument;
use Illuminate\Support\Facades\DB;

echo "DB Connection: " . config('database.default') . "\n";
echo "DB Host: " . config('database.connections.pgsql.host') . "\n";
echo "DB Database: " . config('database.connections.pgsql.database') . "\n";

echo "School count: " . School::count() . "\n";
echo "Teacher count: " . Teacher::withoutTenantScope()->count() . "\n";
echo "SkDocument count: " . SkDocument::withoutTenantScope()->count() . "\n";

echo "\n--- Sample Schools ---\n";
foreach (School::limit(10)->get(['id', 'nama', 'kecamatan']) as $s) {
    echo "ID: {$s->id} | {$s->nama} | Kec: {$s->kecamatan}\n";
}

echo "\n--- Search 'Majenang' in all schools ---\n";
$mSchools = School::where('nama', 'LIKE', '%Majenang%')->orWhere('kecamatan', 'LIKE', '%Majenang%')->get(['id', 'nama', 'kecamatan']);
foreach ($mSchools as $s) {
    echo "ID: {$s->id} | {$s->nama} | Kec: {$s->kecamatan}\n";
}

echo "\n--- Search 'Siti' in Teachers ---\n";
$sTeachers = Teacher::withoutTenantScope()->where('nama', 'LIKE', '%Siti%')->get(['id', 'nama', 'unit_kerja', 'school_id']);
foreach ($sTeachers as $t) {
    echo "ID: {$t->id} | {$t->nama} | Unit: {$t->unit_kerja} | School ID: {$t->school_id}\n";
}

echo "\n--- Search 'Siti' in SkDocuments ---\n";
$sSks = SkDocument::withoutTenantScope()->where('nama', 'LIKE', '%Siti%')->get(['id', 'nomor_sk', 'nama', 'unit_kerja', 'tanggal_penetapan', 'status']);
foreach ($sSks as $sk) {
    echo "ID: {$sk->id} | {$sk->nomor_sk} | {$sk->nama} | Unit: {$sk->unit_kerja} | Tanggal: {$sk->tanggal_penetapan} | Status: {$sk->status}\n";
}
