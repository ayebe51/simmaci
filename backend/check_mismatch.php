<?php

use App\Models\Teacher;
use App\Models\School;

$teachers = Teacher::withoutGlobalScopes()->get();
$mismatchCount = 0;

foreach ($teachers as $t) {
    if (empty($t->unit_kerja)) continue;
    
    $school = School::find($t->school_id);
    if (!$school) continue;
    
    // Normalisasi string untuk perbandingan
    $schoolName = strtolower(trim(str_replace(['’', "'"], '', $school->nama)));
    $unitKerja = strtolower(trim(str_replace(['’', "'"], '', $t->unit_kerja)));
    
    if ($schoolName !== $unitKerja) {
        $mismatchCount++;
        if ($mismatchCount <= 10) {
            echo "Mismatch ID {$t->id} ({$t->nama}):\n";
            echo "  - Di DB tertaut ke School ID {$school->id} ({$school->nama})\n";
            echo "  - Tapi text unit_kerja adalah '{$t->unit_kerja}'\n";
        }
    }
}

echo "\nTotal Guru yang salah kamar (Mismatch): {$mismatchCount}\n";
