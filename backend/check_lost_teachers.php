<?php

use App\Models\Teacher;
use App\Models\SkDocument;

// Cari guru yang kehilangan school_id dan unit_kerja
$lostTeachers = Teacher::withoutGlobalScopes()
    ->where(function ($q) {
        $q->whereNull('school_id')->orWhere('school_id', '')->orWhere('school_id', 0);
    })
    ->where(function ($q) {
        $q->whereNull('unit_kerja')->orWhere('unit_kerja', '');
    })
    ->get();

$totalLost = $lostTeachers->count();
echo "=== PENGECEKAN GURU YANG KEHILANGAN UNIT KERJA & SCHOOL ID ===\n\n";
echo "Total Guru yang hilang arah (tanpa school_id dan tanpa unit_kerja): {$totalLost}\n\n";

if ($totalLost > 0) {
    echo "Daftar 20 Guru Pertama:\n";
    $count = 0;
    foreach ($lostTeachers as $t) {
        $count++;
        if ($count > 20) break;
        
        // Cek apakah guru ini terkait dengan SK apapun?
        $sk = SkDocument::withoutGlobalScopes()->where('teacher_id', $t->id)->first();
        $skInfo = $sk ? "Terkait SK ID {$sk->id} (School ID: {$sk->school_id})" : "TIDAK ADA SK";
        
        $status = $t->trashed() ? "[TERHAPUS/TRASH]" : "[AKTIF]";
        echo "{$count}. ID: {$t->id} | Nama: {$t->nama} {$status}\n";
        echo "   -> NIM: " . ($t->nomor_induk_maarif ?: 'KOSONG') . " | {$skInfo}\n";
    }
}
