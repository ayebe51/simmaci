<?php

use App\Models\Teacher;
use App\Models\School;
use App\Models\SkDocument;

echo "=== MENCARI GURU HANTU (SCHOOL_ID KOSONG) & SK NYASAR MEREKA ===\n\n";

$ghostTeachers = Teacher::withoutGlobalScopes()->where(function ($q) {
    $q->whereNull('school_id')->orWhere('school_id', '')->orWhere('school_id', 0);
})->whereNotNull('unit_kerja')->where('unit_kerja', '!=', '')->get();

$allSchools = School::all();
$schoolMap = [];
foreach ($allSchools as $s) {
    $normalized = strtolower(trim(str_replace(['’', "'", '.', ','], '', $s->nama)));
    $schoolMap[$normalized] = $s->id;
}

$fixableCount = 0;
$unfixableCount = 0;

foreach ($ghostTeachers as $t) {
    $unitKerjaNorm = strtolower(trim(str_replace(['’', "'", '.', ','], '', $t->unit_kerja)));
    
    $correctSchoolId = null;
    if (isset($schoolMap[$unitKerjaNorm])) {
        $correctSchoolId = $schoolMap[$unitKerjaNorm];
    } else {
        // Coba partial match
        foreach ($allSchools as $s) {
            $sNorm = strtolower(trim(str_replace(['’', "'", '.', ','], '', $s->nama)));
            if (strpos($unitKerjaNorm, $sNorm) !== false || strpos($sNorm, $unitKerjaNorm) !== false) {
                $correctSchoolId = $s->id;
                break;
            }
        }
    }
    
    if ($correctSchoolId) {
        $fixableCount++;
        echo "✅ GURU ID {$t->id} ({$t->nama}):\n";
        echo "   - Unit Kerja Text: '{$t->unit_kerja}'\n";
        echo "   - Akan dipulihkan ke School ID: {$correctSchoolId}\n";
        
        $sks = SkDocument::withoutGlobalScopes()->where('teacher_id', $t->id)->get();
        foreach ($sks as $sk) {
            if ($sk->school_id != $correctSchoolId) {
                echo "   - SK NYASAR DITEMUKAN: SK ID {$sk->id} (Saat ini di School ID {$sk->school_id})\n";
                echo "     -> SK ini akan ditarik paksa ke School ID {$correctSchoolId}\n";
            }
        }
        echo "--------------------------------------------------------\n";
    } else {
        $unfixableCount++;
    }
}

echo "\nTotal Guru Hantu yang BISA dipulihkan: {$fixableCount}\n";
echo "Total Guru Hantu yang GAGAL dipulihkan (Sekolah tidak ditemukan): {$unfixableCount}\n";
