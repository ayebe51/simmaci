<?php

use App\Models\SkDocument;
use App\Models\Teacher;

echo "=== CEK SK 'APPROVED' YANG TIDAK SESUAI UNIT KERJA ===\n\n";

$sks = SkDocument::withoutGlobalScopes()
    ->where('status', 'approved')
    ->with('teacher', 'school')
    ->get();

$mismatchCount = 0;

foreach ($sks as $sk) {
    if (!$sk->teacher) {
        continue;
    }
    
    $skSchoolId = $sk->school_id;
    $teacherSchoolId = $sk->teacher->school_id;
    
    // Check if the school IDs do not match
    if ($skSchoolId != $teacherSchoolId && $skSchoolId !== null && $teacherSchoolId !== null) {
        $skSchoolName = $sk->school ? $sk->school->nama : 'KOSONG';
        $teacherSchoolName = $sk->teacher->school ? $sk->teacher->school->nama : 'KOSONG';
        
        echo "SK ID: {$sk->id} | Guru: {$sk->nama}\n";
        echo "  - School ID di SK    : {$skSchoolId} ({$skSchoolName})\n";
        echo "  - School ID di Guru  : {$teacherSchoolId} ({$teacherSchoolName})\n";
        echo "  - Unit Kerja Text SK : {$sk->unit_kerja}\n";
        echo "  - Unit Kerja Txt Guru: {$sk->teacher->unit_kerja}\n";
        echo "--------------------------------------------------\n";
        
        $mismatchCount++;
    }
}

echo "Total pengajuan SK 'approved' yang tidak sesuai: {$mismatchCount}\n";

// Mari kita cek juga untuk status 'active' untuk berjaga-jaga
echo "\n=== CEK SK 'ACTIVE' YANG TIDAK SESUAI UNIT KERJA ===\n\n";

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
        echo "  - School ID di SK    : {$skSchoolId} ({$skSchoolName})\n";
        echo "  - School ID di Guru  : {$teacherSchoolId} ({$teacherSchoolName})\n";
        echo "--------------------------------------------------\n";
        
        $mismatchCountActive++;
    }
}
echo "Total pengajuan SK 'active' yang tidak sesuai: {$mismatchCountActive}\n";
