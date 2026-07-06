<?php

use App\Models\Teacher;
use App\Models\SkDocument;

echo "=== CEK STATUS DATABASE (APAKAH TER-RESTORE?) ===\n\n";

$ghostCount = Teacher::withoutGlobalScopes()
    ->where(function($q) {
        $q->whereNull('school_id')
          ->orWhere('school_id', '')
          ->orWhere('school_id', 0);
    })
    ->whereNotNull('unit_kerja')
    ->where('unit_kerja', '!=', '')
    ->count();

echo "Jumlah Guru Hantu saat ini: {$ghostCount}\n";

$supriyatun = Teacher::withoutGlobalScopes()->where('nama', 'LIKE', '%SUPRIYATUN%')->first();
if ($supriyatun) {
    echo "School ID Supriyatun: " . ($supriyatun->school_id ?? 'KOSONG') . "\n";
    echo "Unit Kerja Supriyatun: {$supriyatun->unit_kerja}\n";
}

$sks = SkDocument::withoutGlobalScopes()->where('nama', 'LIKE', '%SUPRIYATUN%')->get();
echo "Jumlah SK Supriyatun: {$sks->count()}\n";
foreach ($sks as $sk) {
    echo "  - SK ID: {$sk->id} | School ID: {$sk->school_id} | Nomor: {$sk->nomor_sk}\n";
}
