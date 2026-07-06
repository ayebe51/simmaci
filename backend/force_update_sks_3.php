<?php

use App\Models\SkDocument;
use Illuminate\Support\Facades\DB;

echo "=== FIXING NOMOR SK SESUAI INSTRUKSI (TANPA SUPRIYATUN) ===\n\n";

$updates = [
    // 684 => '045/MI.NU10/34.13/SP/VI/2026', // SUPRIYATUN (DIPENDING)
    687 => '31/MTs.MF/33.24/V/2026',       // KARTINI SURATMI
    688 => '31/MTs.MF/33.24/V/2026',       // DIN AZIZAH
    689 => '31/MTs.MF/33.24/V/2026',       // AAN RUSLIANA
];

DB::beginTransaction();
try {
    foreach ($updates as $id => $nomorBaru) {
        $sk = SkDocument::withoutGlobalScopes()->find($id);
        if ($sk) {
            $nomorLama = $sk->nomor_permohonan;
            $sk->nomor_permohonan = $nomorBaru;
            $sk->save();
            echo "✅ SK ID {$id} ({$sk->nama}) berhasil diupdate:\n";
            echo "   [{$nomorLama}] ---> [{$nomorBaru}]\n\n";
        } else {
            echo "❌ SK ID {$id} tidak ditemukan!\n";
        }
    }
    DB::commit();
    echo "=== SELESAI! TIGA DATA TELAH DIPERBARUI. ===\n";
} catch (\Exception $e) {
    DB::rollBack();
    echo "ERROR: " . $e->getMessage() . "\n";
}
