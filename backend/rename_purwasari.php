<?php

use App\Models\Teacher;
use App\Models\SkDocument;
use Illuminate\Support\Facades\DB;

echo "=== MENGGANTI TEKS PURWASARI MENJADI WANAREJA ===\n\n";

DB::beginTransaction();
try {
    // 1. Update Tabel Teachers
    $teachers = Teacher::withoutGlobalScopes()
        ->whereRaw("LOWER(unit_kerja) LIKE '%purwasari%'")
        ->get();
        
    $tCount = 0;
    foreach ($teachers as $t) {
        $t->unit_kerja = "MTs Ma'arif Wanareja";
        $t->school_id = 164; // Pastikan juga terhubung ke Wanareja
        $t->save();
        $tCount++;
    }
    
    // 2. Update Tabel SK Documents
    $sks = SkDocument::withoutGlobalScopes()
        ->whereRaw("LOWER(unit_kerja) LIKE '%purwasari%'")
        ->get();
        
    $skCount = 0;
    foreach ($sks as $sk) {
        $sk->unit_kerja = "MTs Ma'arif Wanareja";
        $sk->school_id = 164; // Pastikan juga terhubung ke Wanareja
        $sk->save();
        $skCount++;
    }
    
    DB::commit();
    echo "✅ SUKSES!\n";
    echo "- Berhasil mengubah {$tCount} teks pada profil Guru.\n";
    echo "- Berhasil mengubah {$skCount} teks pada dokumen SK.\n";
} catch (\Exception $e) {
    DB::rollBack();
    echo "❌ GAGAL: " . $e->getMessage() . "\n";
}
