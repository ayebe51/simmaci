<?php

use App\Models\SkDocument;
use Illuminate\Support\Facades\DB;

echo "=== MEMBERSIHKAN SISA HANTU & MEMPERBAIKI PRIMAWANTI ===\n\n";

DB::beginTransaction();
try {
    // 1. Perbaiki Nomor SK Primawanti
    $primawantiSk = SkDocument::withoutGlobalScopes()->find(893);
    if ($primawantiSk) {
        $oldNum = $primawantiSk->nomor_permohonan;
        $newNum = '025/MI.KDRJ/SP.SK.Mrf/V/2026';
        $primawantiSk->nomor_permohonan = $newNum;
        $primawantiSk->save();
        echo "✅ SK Primawanti (ID 893) berhasil diperbaiki:\n";
        echo "   [{$oldNum}] ---> [{$newNum}]\n\n";
    }

    // 2. Hapus SK Nyasar / Hantu (12 SK yang school_id-nya beda dengan school_id guru)
    $sksActive = SkDocument::withoutGlobalScopes()
        ->where('status', 'active')
        ->with('teacher')
        ->get();

    $deletedCount = 0;
    foreach ($sksActive as $sk) {
        if (!$sk->teacher) continue;
        
        $skSchoolId = $sk->school_id;
        $teacherSchoolId = $sk->teacher->school_id;
        
        // Jika SK terdaftar di sekolah yang BUKAN sekolah asli gurunya
        if ($skSchoolId != $teacherSchoolId && $skSchoolId !== null && $teacherSchoolId !== null) {
            echo "Menghapus SK Hantu ID {$sk->id} ({$sk->nama}) dari School ID {$skSchoolId}...\n";
            $sk->delete();
            $deletedCount++;
        }
    }
    
    DB::commit();
    echo "\n=== SELESAI ===\n";
    echo "Total SK Hantu yang dihapus: {$deletedCount}\n";
    echo "Dany Ramadhan Syah sekarang sudah lenyap dari MI Al Ma'arif Kedungreja!\n";

} catch (\Exception $e) {
    DB::rollBack();
    echo "ERROR: " . $e->getMessage() . "\n";
}
