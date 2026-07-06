<?php

use App\Models\Teacher;
use App\Models\School;
use App\Models\SkDocument;

echo "=== ANALISA 13 GURU MTs MA'ARIF WANAREJA ===\n\n";

$teacherNames = [
    "KARTINI SURATMI", "DIN AZIZAH", "AAN RUSLIANA", "NASTITI",
    "SITI ZAHROTUL MAKIYAH", "NURFAIZIN", "SITI PARTIMAH",
    "IMAM BAEHAKI", "ZAENAL MUFTI", "TOHIRIN", "MURSIATI",
    "DANY RAMADHAN SYAH", "SITI MUZAYANAH"
];

$teachers = Teacher::withoutGlobalScopes()
    ->whereIn(DB::raw("REPLACE(nama, ',', '')"), array_map(function($n) { return $n; }, $teacherNames))
    ->orWhereIn(DB::raw("SPLIT_PART(nama, ',', 1)"), $teacherNames) // PostgreSQL split_part to ignore titles
    ->get();

foreach ($teachers as $t) {
    echo "GURU: {$t->nama}\n";
    echo "  - School ID: {$t->school_id}\n";
    echo "  - Unit Kerja Text: {$t->unit_kerja}\n";
    echo "  - TMT: {$t->tmt}\n";
    
    // Cek anomali 1: Apakah ada duplikat di DB?
    $dups = Teacher::withoutGlobalScopes()->where('nama', $t->nama)->where('id', '!=', $t->id)->count();
    if ($dups > 0) {
        echo "  [!] PERINGATAN: Ada {$dups} guru lain dengan nama yang sama di database!\n";
    }
    
    // Cek anomali 2: Apakah SK-nya ada di sekolah lain?
    $sks = SkDocument::withoutGlobalScopes()->where('teacher_id', $t->id)->get();
    foreach ($sks as $sk) {
        if ($sk->school_id != 164) {
            echo "  [!] PERINGATAN: SK ID {$sk->id} ({$sk->nomor_sk}) terdaftar di School ID {$sk->school_id}!\n";
        }
    }
    
    echo "--------------------------------------------------\n";
}

echo "Total Guru Dianalisa: " . $teachers->count() . "\n";
