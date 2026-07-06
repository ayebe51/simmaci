<?php

use App\Models\SkDocument;
use Illuminate\Support\Facades\DB;

echo "=== MENCARI SK PENGGANTI UNTUK 'NOMOR 65' ===\n\n";

$sks65 = SkDocument::withoutGlobalScopes()
    ->where('nomor_permohonan', '65')
    ->get();

$deletedCount = 0;

DB::beginTransaction();
try {
    foreach ($sks65 as $sk) {
        $otherSks = SkDocument::withoutGlobalScopes()
            ->where('teacher_id', $sk->teacher_id)
            ->where('id', '!=', $sk->id)
            ->whereNotNull('nomor_permohonan')
            ->where('nomor_permohonan', '!=', '65')
            ->where('nomor_permohonan', '!=', '')
            ->get();
            
        echo "Guru: {$sk->nama} (SK 65 ID: {$sk->id})\n";
        
        if ($otherSks->count() > 0) {
            echo "  --> Ditemukan {$otherSks->count()} SK lain:\n";
            foreach ($otherSks as $o) {
                echo "      - SK ID: {$o->id} | Nomor: {$o->nomor_permohonan} | Status: {$o->status}\n";
            }
            // Delete the invalid SK 65
            $sk->delete();
            $deletedCount++;
            echo "  --> [!] SK ID {$sk->id} (nomor 65) BERHASIL DIHAPUS.\n";
        } else {
            echo "  --> TIDAK ADA SK LAIN! (Aman untuk dibiarkan atau perlu diupdate?)\n";
        }
        echo "--------------------------------------------------\n";
    }
    
    DB::commit();
    echo "\n=== SELESAI: {$deletedCount} SK 'Nomor 65' berhasil dihapus! ===\n";
    
} catch (\Exception $e) {
    DB::rollBack();
    echo "ERROR: " . $e->getMessage() . "\n";
}
