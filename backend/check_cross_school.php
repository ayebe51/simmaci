<?php

use App\Models\SkDocument;

// Cari SK yang school_id-nya BERBEDA dengan school_id milik gurunya
$sks = SkDocument::withoutGlobalScopes()
    ->whereNotNull('teacher_id')
    ->with('teacher')
    ->get();

$crossSchoolCount = 0;
foreach ($sks as $sk) {
    if ($sk->teacher && $sk->school_id != $sk->teacher->school_id) {
        $crossSchoolCount++;
        echo "SK ID {$sk->id} (Nama: {$sk->nama}, SK School: {$sk->school_id}) menunjuk ke Guru ID {$sk->teacher_id} (Nama: {$sk->teacher->nama}, Guru School: {$sk->teacher->school_id})\n";
    }
}

echo "\nTotal SK yang menyilang antar sekolah: {$crossSchoolCount}\n";
