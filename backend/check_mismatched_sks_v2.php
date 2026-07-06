<?php

use App\Models\SkDocument;
use App\Models\Teacher;

echo "=== CEK SK 'ACTIVE' YANG TIDAK SESUAI UNIT KERJA ===\n\n";

$sksActive = SkDocument::withoutGlobalScopes()
    ->where('status', 'active')
    ->with('teacher', 'school')
    ->get();

$mismatchCountActive = 0;

foreach ($sksActive as $sk) {
    if (!$sk->teacher) continue;
    
    $skSchoolId = $sk->school_id;
    $teacherSchoolId = $sk->teacher->school_id;
    
    if ($skSchoolId != $teacherSchoolId && $skSchoolId !== null && $teacherSchoolId !== null) {
        $skSchoolName = $sk->school ? $sk->school->nama : 'KOSONG';
        $teacherSchoolName = $sk->teacher->school ? $sk->teacher->school->nama : 'KOSONG';
        
        echo "SK ID: {$sk->id} | Guru: {$sk->nama}\n";
        echo "  [SK]   School ID: {$skSchoolId} ({$skSchoolName}) | Unit Kerja: '{$sk->unit_kerja}'\n";
        echo "  [GURU] School ID: {$teacherSchoolId} ({$teacherSchoolName}) | Unit Kerja: '{$sk->teacher->unit_kerja}'\n";
        echo "--------------------------------------------------\n";
        
        $mismatchCountActive++;
    }
}
echo "Total pengajuan SK 'active' yang tidak sesuai: {$mismatchCountActive}\n";
