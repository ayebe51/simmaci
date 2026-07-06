<?php

use App\Models\Teacher;
use App\Models\SkDocument;

echo "=== INVESTIGASI ASAL USUL KARTINI, DIN AZIZAH, AAN ===\n\n";

$names = ['KARTINI SURATMI', 'DIN AZIZAH', 'AAN RUSLIANA'];

foreach ($names as $name) {
    echo "GURU: {$name}\n";
    $teachers = Teacher::withoutGlobalScopes()->where('nama', 'LIKE', "%{$name}%")->get();
    foreach ($teachers as $t) {
        $schoolName = $t->school ? $t->school->nama : 'KOSONG';
        echo "  - DATA GURU: ID {$t->id} | School ID: {$t->school_id} ({$schoolName}) | Unit Kerja Text: {$t->unit_kerja}\n";
    }
    
    $sks = SkDocument::withoutGlobalScopes()->where('nama', 'LIKE', "%{$name}%")->get();
    foreach ($sks as $sk) {
        $schoolName = $sk->school ? $sk->school->nama : 'KOSONG';
        echo "  - DATA SK  : ID {$sk->id} | School ID: {$sk->school_id} ({$schoolName}) | No Permohonan: {$sk->nomor_permohonan} | Status: {$sk->status}\n";
    }
    echo "--------------------------------------------------\n";
}
