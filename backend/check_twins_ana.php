<?php

use App\Models\Teacher;
use App\Models\SkDocument;

echo "=== CEK GURU KEMBAR: ANA WAHAYU ===\n\n";

$name = 'ANA WAHAYU';
$teachers = Teacher::withoutGlobalScopes()->where('nama', 'LIKE', "%{$name}%")->get();

echo "Total Data Guru ditemukan: {$teachers->count()}\n";
foreach ($teachers as $t) {
    $schoolName = $t->school ? $t->school->nama : 'KOSONG';
    echo "  - GURU ID: {$t->id} | NPK/NUPTK: {$t->nuptk} | NIM: {$t->nomor_induk_maarif} | Unit Kerja: {$t->unit_kerja} | School ID: {$t->school_id} ({$schoolName})\n";
    
    $sks = SkDocument::withoutGlobalScopes()->where('teacher_id', $t->id)->get();
    if ($sks->count() > 0) {
        echo "    -> Punya {$sks->count()} SK:\n";
        foreach ($sks as $sk) {
            $skSchoolName = $sk->school ? $sk->school->nama : 'KOSONG';
            echo "       - SK ID {$sk->id} | Status: {$sk->status} | School ID: {$sk->school_id} ({$skSchoolName}) | No Permohonan: {$sk->nomor_permohonan}\n";
        }
    } else {
        echo "    -> Tidak punya SK yang terhubung dengan Teacher ID ini.\n";
    }
}

// Cek jika ada guru di Bulusari yang bernama ANA WAHAYU
echo "\n=== MENCARI GURU DI BULUSARI (68) ===\n";
$teachers68 = Teacher::withoutGlobalScopes()->where('school_id', 68)->get();
$found = false;
foreach ($teachers68 as $t) {
    if (stripos($t->nama, 'ANA') !== false) {
        echo "GURU DI BULUSARI MENGANDUNG 'ANA': ID {$t->id} | {$t->nama} | NIM: {$t->nomor_induk_maarif}\n";
        $found = true;
    }
}
if (!$found) {
    echo "Tidak ditemukan guru bernama 'ANA...' di Bulusari.\n";
}
