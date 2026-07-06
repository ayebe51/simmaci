<?php

use App\Models\Teacher;
use App\Models\School;

echo "=== MENGUBAH PURWASARI MENJADI WANAREJA ===\n\n";

$teachers = Teacher::withoutGlobalScopes()
    ->whereRaw("LOWER(unit_kerja) LIKE '%purwasari%'")
    ->get();

$count = 0;
foreach ($teachers as $t) {
    echo "Update Guru: {$t->nama} (ID: {$t->id})\n";
    echo "  - Unit Kerja Lama: {$t->unit_kerja}\n";
    echo "  - School ID Lama: " . ($t->school_id ?? 'KOSONG') . "\n";
    
    // Ganti School ID ke 164 (MTs Ma'arif Wanareja)
    $t->school_id = 164;
    
    // Opsional: Ganti teks unit_kerja agar seragam
    $t->unit_kerja = "MTs Ma'arif Wanareja";
    
    $t->save();
    $count++;
    
    echo "  -> BERHASIL diubah ke MTs Ma'arif Wanareja (School ID 164)\n";
    echo "---------------------------------------\n";
}

echo "Total {$count} guru berhasil disatukan ke MTs Ma'arif Wanareja!\n";
