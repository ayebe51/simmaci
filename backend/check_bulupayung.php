<?php

use App\Models\SkDocument;
use App\Models\Teacher;

echo "=== MEMBONGKAR RAHASIA BULUPAYUNG ===\n\n";

// Ambil SEMUA SK di Bulupayung (ID 126), urutkan berdasarkan ID
$sks = SkDocument::withoutGlobalScopes()
    ->where('school_id', 126)
    ->orderBy('id', 'asc')
    ->get();

echo "Total SK di Bulupayung: " . $sks->count() . "\n\n";

$no = 1;
foreach ($sks as $sk) {
    echo "SK #" . $no . " (ID: {$sk->id})\n";
    echo "Tertulis saat ini: {$sk->nama} (Teacher ID: " . ($sk->teacher_id ?? 'NULL') . ")\n";
    
    // Cek asal sekolah dari teacher_id tersebut
    if ($sk->teacher_id) {
        $teacher = Teacher::withoutGlobalScopes()->find($sk->teacher_id);
        if ($teacher) {
            echo "   -> Berasal dari Sekolah ID: {$teacher->school_id}\n";
            if ($teacher->school_id != 126) {
                echo "   -> 🚨 CROSS-SCHOOL BUG DETECTED!\n";
            }
        }
    }
    echo "----------------------------------------\n";
    $no++;
}
