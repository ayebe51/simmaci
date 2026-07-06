<?php

use App\Models\SkDocument;

echo "=== MENCARI SK TANPA TEACHER_ID DI SCHOOL 164 ===\n\n";

$sks = SkDocument::withoutGlobalScopes()
    ->where('school_id', 164)
    ->whereNull('teacher_id')
    ->get();

foreach ($sks as $sk) {
    echo "SK ID: {$sk->id} | Nama: {$sk->nama} | Status: {$sk->status} | Unit Kerja DB: {$sk->unit_kerja}\n";
}

echo "\nTotal: " . $sks->count() . "\n";
