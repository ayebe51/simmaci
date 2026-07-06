<?php

use App\Models\SkDocument;
use App\Models\Teacher;

echo "=== MENCARI SK NYASAR (SK SCHOOL_ID != TEACHER SCHOOL_ID) ===\n\n";

$sks = SkDocument::withoutGlobalScopes()->whereNull('deleted_at')->get();

$mismatchCount = 0;
foreach ($sks as $sk) {
    if (empty($sk->teacher_id)) continue;
    
    $teacher = Teacher::withoutGlobalScopes()->find($sk->teacher_id);
    if (!$teacher) continue;
    
    // Cek apakah school_id di SK berbeda dengan school_id di tabel Teacher
    if ($sk->school_id != $teacher->school_id && !empty($teacher->school_id)) {
        $mismatchCount++;
        echo "SK ID {$sk->id} ({$sk->nama}):\n";
        echo "  - SK tertaut di School ID: {$sk->school_id}\n";
        echo "  - Tapi Profil Guru ada di School ID: {$teacher->school_id} ({$teacher->unit_kerja})\n";
        echo "-----------------------------------------\n";
    }
}

echo "Total SK Nyasar (Beda Server): {$mismatchCount}\n";
