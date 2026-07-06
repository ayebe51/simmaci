<?php

use App\Models\Teacher;
use App\Models\SkDocument;

echo "=== CEK STATUS DATABASE ===\n\n";

$ghostCount = Teacher::withoutGlobalScopes()
    ->whereNull('school_id')
    ->whereNotNull('unit_kerja')
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
    $schoolName = $sk->school ? $sk->school->nama : 'KOSONG/TIDAK ADA';
    echo "  - SK ID: {$sk->id} | School ID: {$sk->school_id} ({$schoolName}) | Status: {$sk->status} | No Permohonan: {$sk->nomor_permohonan} | No SK: {$sk->nomor_sk}\n";
}
