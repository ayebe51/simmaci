<?php

use App\Models\SkDocument;
use Illuminate\Support\Facades\DB;

echo "=== MENSIMULASIKAN QUERY GENERATOR SK MASAL UNTUK SCHOOL 164 ===\n\n";

$sks = SkDocument::withoutGlobalScopes()
    ->where('school_id', 164)
    ->whereIn('status', ['pending', 'draft'])
    ->get();

echo "Jumlah SK yang dikembalikan oleh DB: " . $sks->count() . "\n\n";

foreach ($sks as $sk) {
    echo "- SK ID: {$sk->id} | Nama: {$sk->nama} | Unit Kerja DB: {$sk->unit_kerja} | School ID: {$sk->school_id}\n";
}
