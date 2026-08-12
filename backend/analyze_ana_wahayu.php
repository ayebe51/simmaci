<?php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Teacher;
use App\Models\SkDocument;

echo "=== ANALISA DATA GURU: ANA WAHAYU ===\n";

$teachers = Teacher::where('nama', 'ilike', '%ana waha%')->with(['school'])->get();
echo "\n1. Ditemukan " . $teachers->count() . " guru dengan nama mirip 'ana waha':\n";

foreach ($teachers as $t) {
    echo "--------------------------------------------------\n";
    echo "ID Guru      : " . $t->id . "\n";
    echo "Nama         : " . $t->nama . "\n";
    echo "NUPTK        : " . $t->nuptk . "\n";
    echo "Sekolah      : " . ($t->school ? $t->school->nama_sekolah : 'TIDAK ADA') . " (ID: " . $t->school_id . ")\n";
    echo "Status Guru  : " . $t->status_guru . "\n";
    echo "Deleted At   : " . ($t->deleted_at ? $t->deleted_at : 'NULL (Aktif)') . "\n";
    
    $sks = SkDocument::where('teacher_id', $t->id)->get();
    echo "Total SK     : " . $sks->count() . " dokumen\n";
    
    foreach ($sks as $sk) {
        echo "  -> SK ID: " . $sk->id . " | Nomor: " . $sk->nomor_sk . " | Jenis: " . $sk->jenis_sk . " | Status: " . $sk->status . " | Thn Ajaran: " . $sk->tahun_ajaran . "\n";
    }
}

echo "\n\n=== PENCARIAN SK BERDASARKAN NAMA (Jaga-jaga unlinked) ===\n";
$sksByName = SkDocument::where('nama', 'ilike', '%ana waha%')->get();
echo "Ditemukan " . $sksByName->count() . " SK dengan nama mirip 'ana waha':\n";

foreach ($sksByName as $sk) {
    echo "--------------------------------------------------\n";
    echo "SK ID        : " . $sk->id . "\n";
    echo "Nama di SK   : " . $sk->nama . "\n";
    echo "Sekolah ID   : " . $sk->school_id . "\n";
    echo "Teacher ID   : " . ($sk->teacher_id ?? 'NULL') . "\n";
    echo "Jenis SK     : " . $sk->jenis_sk . "\n";
    echo "Status       : " . $sk->status . "\n";
    echo "Tahun Ajaran : " . $sk->tahun_ajaran . "\n";
}

echo "\nSelesai.\n";
