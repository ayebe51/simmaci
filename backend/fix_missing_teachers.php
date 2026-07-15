<?php

use App\Models\SkDocument;
use App\Models\Teacher;

echo "Memulai pembuatan Master Guru untuk Pengajuan SK yang kehilangan data Guru...\n";

$sks = SkDocument::withoutGlobalScopes()->whereNull("teacher_id")->get();
$created = 0;

foreach ($sks as $sk) {
    if (!$sk->school_id || !$sk->nama) continue;
    
    // Cek lagi apakah guru ada
    $teacher = Teacher::withoutGlobalScopes()
        ->where("nama", $sk->nama)
        ->where("school_id", $sk->school_id)
        ->first();
        
    if (!$teacher) {
        $teacher = Teacher::create([
            "nama" => $sk->nama,
            "school_id" => $sk->school_id,
            "unit_kerja" => $sk->unit_kerja,
            "status" => "Draft", // status kepegawaian default
            "is_verified" => false,
            "is_active" => true,
        ]);
        echo "? [CREATED] Guru baru dibuat: {$teacher->nama} (ID: {$teacher->id})\n";
        $created++;
    }
    
    $sk->teacher_id = $teacher->id;
    $sk->save();
    echo "?? [LINKED] SK ID {$sk->id} dikaitkan ke Guru ID {$teacher->id}\n";
}

echo "Selesai. Total Guru Dibuat: {$created}\n";

