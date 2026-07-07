<?php

use App\Models\SkDocument;
use App\Models\Teacher;
use App\Models\School;

echo "=== MELACAK GURU YANG SK-NYA TERCURI / TERTEMPA ===\n\n";

// Daftar School ID tempat terjadinya SK Hantu
$targetSchoolIds = [
    115 => "MI Al Ma'arif Kedungreja (Korban Dany)",
    50  => "MI Ma'arif NU 10 Bantarsari (Korban Tri Okta & Aan)",
    20  => "MI Ma'arif 03 Gentasari (Korban Tri Okta)",
    120 => "MI Al Ma'arif 01 Tambaksari (Korban Din Azizah)",
    149 => "MTs Ma'arif NU 01 Gandrungmangu (Korban Kartini)",
    100 => "MI Ma'arif Sidasari (Korban Intiha'us)",
    101 => "MI Ma'arif Kutasari (Korban Maftuhin)",
    68  => "MI Ma'arif NU 11 Bulusari (Korban Ana Wahayu)",
];

foreach ($targetSchoolIds as $schoolId => $label) {
    echo "Mencari di Sekolah: {$label}\n";
    
    // Cari semua guru di sekolah ini
    $teachers = Teacher::withoutGlobalScopes()
        ->where('school_id', $schoolId)
        ->where('is_active', true)
        ->get();
        
    $missingSkTeachers = [];
    
    foreach ($teachers as $t) {
        // Cek apakah guru ini punya SK yang statusnya active
        $hasActiveSk = SkDocument::withoutGlobalScopes()
            ->where('teacher_id', $t->id)
            ->where('status', 'active')
            ->exists();
            
        if (!$hasActiveSk) {
            $missingSkTeachers[] = $t;
        }
    }
    
    if (count($missingSkTeachers) > 0) {
        echo "  Ditemukan " . count($missingSkTeachers) . " guru aktif yang TIDAK PUNYA SK (Kemungkinan ini pemilik asli SK yang tertimpa):\n";
        foreach ($missingSkTeachers as $mt) {
            echo "    - Guru ID: {$mt->id} | Nama: {$mt->nama} | NIM: {$mt->nomor_induk_maarif}\n";
        }
    } else {
        echo "  Hebat! Semua guru aktif di sekolah ini sudah punya SK masing-masing. Berarti SK hantu itu murni data lebih (surplus).\n";
    }
    echo "--------------------------------------------------\n";
}
