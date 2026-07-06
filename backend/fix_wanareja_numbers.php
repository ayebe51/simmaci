<?php

use App\Models\SkDocument;
use App\Models\Teacher;
use Illuminate\Support\Facades\DB;

echo "=== PERBAIKAN NOMOR SURAT MTs MA'ARIF WANAREJA & PEMULIHAN SUPRIYATUN ===\n\n";

DB::beginTransaction();
try {
    // 1. Membetulkan Nomor Surat Kartini, Din Azizah, Aan Rusliana, dan Supriyatun (SK ID 684)
    $targetNames = ['KARTINI SURATMI', 'DIN AZIZAH', 'AAN RUSLIANA', 'SUPRIYATUN'];
    $correctNumber = '31/MTs.MF/33.24/V/2026';
    $schoolWanarejaId = 164;
    
    $sks = SkDocument::withoutGlobalScopes()
        ->where('school_id', $schoolWanarejaId)
        ->where('nomor_permohonan', '65')
        ->whereNull('deleted_at')
        ->get();
        
    $fixedSkCount = 0;
    foreach ($sks as $sk) {
        $bareName = strtoupper(trim(explode(',', $sk->nama)[0]));
        foreach ($targetNames as $target) {
            if (strpos($bareName, $target) !== false) {
                $sk->nomor_permohonan = $correctNumber;
                $sk->save();
                echo "✅ Berhasil memperbaiki Nomor Surat untuk: {$sk->nama} (SK ID: {$sk->id})\n";
                $fixedSkCount++;
                break;
            }
        }
    }
    
    echo "\n";
    
    // 2. Memulihkan School ID Ibu Supriyatun (Guru ID 1076)
    // Karena Unit Kerjanya adalah 'MI Ma’arif NU 10 Bantarsari' (School ID 50), kita kembalikan dia ke sana.
    $supriyatun = Teacher::withoutGlobalScopes()->find(1076);
    if ($supriyatun && empty($supriyatun->school_id)) {
        $supriyatun->school_id = 50;
        $supriyatun->save();
        echo "✅ Berhasil memulihkan profil hantu SUPRIYATUN, S.Pd.I (Guru ID 1076)\n";
        echo "   -> School ID yang tadinya KOSONG sekarang diisi menjadi: 50 (MI NU 10)\n";
    }

    DB::commit();
    echo "\nEKSEKUSI SELESAI! Semua perbaikan berhasil disimpan ke database.\n";
} catch (\Exception $e) {
    DB::rollBack();
    echo "❌ GAGAL: " . $e->getMessage() . "\n";
}
