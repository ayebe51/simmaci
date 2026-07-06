<?php

use App\Models\Teacher;
use App\Models\SkDocument;

echo "=== CEK GURU KEMBAR: ANA WAHAYU, MAFTUHIN, INTIHAUS, DLL ===\n\n";

$namesToCheck = [
    'ANA WAHAYU',
    'MAFTUHIN',
    'INTIHA\'US SANGADAH',
    'DANY RAMADHAN',
    'TRI OKTA',
    'DIN AZIZAH',
    'KARTINI SURATMI',
    'AAN RUSLIANA'
];

foreach ($namesToCheck as $name) {
    echo "PENCARIAN UNTUK: {$name}\n";
    $teachers = Teacher::withoutGlobalScopes()->where('nama', 'LIKE', "%{$name}%")->get();
    
    echo "Total Data Guru ditemukan: {$teachers->count()}\n";
    foreach ($teachers as $t) {
        $schoolName = $t->school ? $t->school->nama : 'KOSONG';
        echo "  - GURU ID: {$t->id} | NPK/NUPTK: {$t->nuptk_npk} | NIM: {$t->nim} | Unit Kerja: {$t->unit_kerja} | School ID: {$t->school_id} ({$schoolName})\n";
        
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
    
    // Cek juga apakah ada SK atas nama ini yang tidak terhubung ke Teacher ID yang tepat
    $sksByName = SkDocument::withoutGlobalScopes()->where('nama', 'LIKE', "%{$name}%")->get();
    foreach ($sksByName as $sk) {
        if (!in_array($sk->teacher_id, $teachers->pluck('id')->toArray())) {
            echo "  ⚠️ Ditemukan SK dengan nama ini TAPI Teacher ID berbeda / Kosong!\n";
            $skSchoolName = $sk->school ? $sk->school->nama : 'KOSONG';
            echo "     - SK ID {$sk->id} | Teacher ID: {$sk->teacher_id} | School ID: {$sk->school_id} ({$skSchoolName})\n";
        }
    }
    
    echo "--------------------------------------------------\n";
}
