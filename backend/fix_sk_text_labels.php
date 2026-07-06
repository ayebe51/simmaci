<?php

use App\Models\SkDocument;
use App\Models\School;

echo "=== MEMBERSIHKAN LABEL TEKS (UNIT KERJA) PADA SK NYASAR ===\n\n";

$sks = SkDocument::withoutGlobalScopes()->get();
$count = 0;

foreach ($sks as $sk) {
    if (!$sk->school_id) continue;
    
    $school = School::find($sk->school_id);
    if (!$school) continue;
    
    // Jika teks unit_kerja di SK tidak sama dengan nama resmi sekolahnya (berarti labelnya usang)
    if (strtolower(trim($sk->unit_kerja)) !== strtolower(trim($school->nama))) {
        echo "Mengupdate label SK ID {$sk->id} ({$sk->nama}):\n";
        echo "  - Label Lama: '{$sk->unit_kerja}'\n";
        echo "  - Label Baru: '{$school->nama}' (Berdasarkan School ID {$sk->school_id})\n";
        
        $sk->unit_kerja = $school->nama;
        $sk->save();
        $count++;
    }
}

echo "\nBerhasil memperbarui label teks untuk {$count} dokumen SK!\n";
