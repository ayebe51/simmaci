<?php

use App\Models\SkDocument;
use App\Models\Teacher;

echo "=== MEMULAI BEDAH PRESISI (FINAL RESOLUTION) ===\n\n";

// DAFTAR TYPO YANG AKAN KITA LURUSKAN
$typoFixes = [
    // NANI WIDIANINGSIH DEWI
    ['sk_ids' => [796, 797], 'correct_teacher_id' => 1389],
    
    // HJ. ANIS KURNIASIH
    ['sk_ids' => [601], 'correct_teacher_id' => 155],
    
    // AYUSROSIBAWAIHI
    ['sk_ids' => [1755, 1748], 'correct_teacher_id' => 157],
    
    // 'TUTI ROHAYATI
    ['sk_ids' => [322, 333], 'correct_teacher_id' => 1169],
];

$fixedCount = 0;

foreach ($typoFixes as $fix) {
    $sks = SkDocument::withoutGlobalScopes()->whereIn('id', $fix['sk_ids'])->get();
    $teacher = Teacher::withoutGlobalScopes()->find($fix['correct_teacher_id']);
    
    if ($teacher) {
        foreach ($sks as $sk) {
            $sk->teacher_id = $teacher->id;
            $sk->nama = $teacher->nama; // Samakan namanya 100% agar tidak masalah lagi
            $sk->save();
            $fixedCount++;
            echo "✅ BERHASIL MEMPERBAIKI: SK ID {$sk->id} ditautkan ke {$teacher->nama}\n";
        }
    }
}

echo "\nTotal SK Typo yang berhasil disembuhkan: {$fixedCount}\n";
echo "Catatan: SK Hantu (Kholisin dkk) DIBIARKAN UTUH karena itu adalah bukti bahwa Master Guru mereka belum diinput/hilang!\n";
