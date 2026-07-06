<?php

use App\Models\SkDocument;
use Illuminate\Support\Facades\DB;

echo "=== FIXING NOMOR PERMOHONAN UNTUK SK NOMOR '65' ===\n\n";

$sks65 = SkDocument::withoutGlobalScopes()
    ->where('nomor_permohonan', '65')
    ->get();

$fixedCount = 0;
$skippedCount = 0;

DB::beginTransaction();
try {
    foreach ($sks65 as $sk) {
        // Cari SK lain milik guru ini yang nomor permohonannya valid (lengkap)
        $validSk = SkDocument::withoutGlobalScopes()
            ->where('teacher_id', $sk->teacher_id)
            ->where('id', '!=', $sk->id)
            ->whereNotNull('nomor_permohonan')
            ->where('nomor_permohonan', '!=', '65')
            ->where('nomor_permohonan', '!=', '')
            ->orderBy('id', 'desc')
            ->first();
            
        echo "SK ID {$sk->id} | Guru: {$sk->nama}\n";
        
        if ($validSk) {
            echo "  --> Ditemukan nomor yang benar: {$validSk->nomor_permohonan}\n";
            $sk->nomor_permohonan = $validSk->nomor_permohonan;
            
            if (!empty($validSk->tanggal_permohonan)) {
                $sk->tanggal_permohonan = $validSk->tanggal_permohonan;
            }
            
            $sk->save();
            $fixedCount++;
            echo "  --> ✅ BERHASIL DIUPDATE.\n";
            
            // Opsional: Hapus SK valid tersebut agar tidak menjadi duplikat?
            // User hanya minta "difixing nomornya", jadi kita biarkan dulu kecuali user minta hapus duplikatnya.
            // $validSk->delete();
        } else {
            echo "  --> ❌ GAGAL: Tidak ditemukan SK lain yang valid sebagai referensi.\n";
            $skippedCount++;
        }
        echo "--------------------------------------------------\n";
    }
    
    DB::commit();
    echo "\n=== RINGKASAN ===\n";
    echo "Total SK yang difix: {$fixedCount}\n";
    echo "Total SK yang dilewati: {$skippedCount}\n";
    
} catch (\Exception $e) {
    DB::rollBack();
    echo "ERROR: " . $e->getMessage() . "\n";
}
