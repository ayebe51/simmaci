<?php

use App\Models\Teacher;
use App\Models\SkDocument;

echo "=== CEK STATUS DATABASE (APAKAH TER-RESTORE?) ===\n\n";

$ghostCount = Teacher::withoutGlobalScopes()
    ->where(function($q) {
        $q->whereNull('school_id');
    })
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
    $school = $sk->school_id ? \App\Models\School::find($sk->school_id) : null;
    $schoolName = $school ? $school->nama : 'KOSONG/TIDAK ADA';
    echo "  - SK ID: {$sk->id} | School ID: {$sk->school_id} ({$schoolName}) | Nomor: {$sk->nomor_sk} | Status: {$sk->status} | Nomor Permohonan: {$sk->nomor_permohonan}\n";
}
