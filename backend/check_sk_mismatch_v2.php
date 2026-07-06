<?php

use App\Models\SkDocument;
use App\Models\Teacher;
use App\Models\School;

echo "=== MENCARI SEMUA SK NYASAR (TERMASUK GURU TERHAPUS) ===\n\n";

$sks = SkDocument::withoutGlobalScopes()->whereNull('deleted_at')->get();
$mismatchCount = 0;
$ghostSkCount = 0;

foreach ($sks as $sk) {
    if (empty($sk->teacher_id)) {
        $ghostSkCount++;
        continue;
    }
    
    // PENTING: Gunakan withTrashed() untuk menemukan guru yang sudah dihapus
    $teacher = Teacher::withoutGlobalScopes()->withTrashed()->find($sk->teacher_id);
    
    if (!$teacher) {
        $ghostSkCount++;
        continue;
    }
    
    // Cek apakah school_id di SK berbeda dengan school_id di tabel Teacher
    if ($sk->school_id != $teacher->school_id && !empty($teacher->school_id)) {
        $mismatchCount++;
        
        $status = $teacher->trashed() ? "[TERHAPUS/TRASH]" : "[AKTIF]";
        $schoolTeacher = School::find($teacher->school_id);
        $schoolTeacherName = $schoolTeacher ? $schoolTeacher->nama : "Unknown";
        
        $schoolSk = School::find($sk->school_id);
        $schoolSkName = $schoolSk ? $schoolSk->nama : "Unknown";
        
        echo "SK ID {$sk->id} ({$sk->nama}):\n";
        echo "  - SK tertaut di School ID: {$sk->school_id} ({$schoolSkName})\n";
        echo "  - Profil Guru {$status} ada di School ID: {$teacher->school_id} ({$schoolTeacherName})\n";
        echo "  - Teks Unit Kerja Guru: {$teacher->unit_kerja}\n";
        echo "-----------------------------------------\n";
    }
}

echo "Total SK Nyasar (Beda Server): {$mismatchCount}\n";
echo "Total SK Hantu (Teacher ID kosong/hilang permanen): {$ghostSkCount}\n";
