<?php

use App\Models\Teacher;
use App\Models\School;
use App\Models\SkDocument;

echo "=== CEK KONSISTENSI DATA GURU & SK ===\n\n";

echo "1. CEK GURU: PRIMAWANTI & DANY\n";
$names = ['PRIMAWANTI', 'DANY RAMADHAN SYAH'];
foreach ($names as $name) {
    echo "GURU: {$name}\n";
    $teachers = Teacher::withoutGlobalScopes()->where('nama', 'LIKE', "%{$name}%")->get();
    foreach ($teachers as $t) {
        $schoolName = $t->school ? $t->school->nama : 'KOSONG';
        echo "  - DATA GURU: ID {$t->id} | School ID: {$t->school_id} ({$schoolName}) | Unit Kerja: {$t->unit_kerja}\n";
    }
    
    $sks = SkDocument::withoutGlobalScopes()->where('nama', 'LIKE', "%{$name}%")->get();
    foreach ($sks as $sk) {
        $schoolName = $sk->school ? $sk->school->nama : 'KOSONG';
        echo "  - DATA SK  : ID {$sk->id} | School ID: {$sk->school_id} ({$schoolName}) | No Permohonan: {$sk->nomor_permohonan} | Status: {$sk->status} | Tanggal: {$sk->tanggal_permohonan}\n";
    }
    echo "--------------------------------------------------\n";
}

// Cek semua guru yang namanya tidak cocok dengan nama sekolahnya
echo "\n2. CEK SELURUH TABEL GURU (SCHOOL ID vs UNIT KERJA)\n";
$mismatchedTeachers = 0;
$teachers = Teacher::withoutGlobalScopes()->with('school')->get();
foreach ($teachers as $t) {
    if (!$t->school) continue;
    
    // Normalisasi string untuk perbandingan
    $schoolName = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $t->school->nama));
    $unitKerja = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $t->unit_kerja));
    
    // Cek jika berbeda jauh (tidak mengandung satu sama lain)
    if (strpos($schoolName, $unitKerja) === false && strpos($unitKerja, $schoolName) === false) {
        echo "GURU ID: {$t->id} | {$t->nama}\n";
        echo "  - School ID  : {$t->school_id} ({$t->school->nama})\n";
        echo "  - Unit Kerja : {$t->unit_kerja}\n";
        $mismatchedTeachers++;
    }
}
echo "Total Guru dengan School ID & Unit Kerja Mismatch: {$mismatchedTeachers}\n";

