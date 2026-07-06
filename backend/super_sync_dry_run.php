<?php

use App\Models\SkDocument;
use App\Models\Teacher;

echo "=== [DRY RUN] SIMULASI SUPER SYNC LINTAS SEKOLAH ===\n";
echo "Peringatan: Ini hanya simulasi, tidak ada data yang disimpan ke database.\n\n";

$sks = SkDocument::withoutGlobalScopes()->whereNull('deleted_at')->get();
$simulatedCount = 0;

foreach ($sks as $sk) {
    $currentT = $sk->teacher;
    
    // Jika guru saat ini sudah ada dan datanya lumayan lengkap, lewati
    if ($currentT && !empty($currentT->tmt) && !empty($currentT->tanggal_lahir)) {
        continue;
    }

    $bareName = trim(explode(',', $sk->nama)[0]);
    $bareNameLower = strtolower($bareName);
    
    // Cari "Wanderer" (Profil kembar yang nyasar di seluruh penjuru database, termasuk tong sampah)
    $wanderers = Teacher::withoutGlobalScopes()
        ->withTrashed()
        ->whereRaw('LOWER(nama) LIKE ?', ['%' . $bareNameLower . '%'])
        ->get();
        
    $bestWanderer = null;
    $bestScore = -1;
    
    foreach ($wanderers as $wt) {
        $score = 0;
        if (!empty($wt->nomor_induk_maarif)) $score += 20;
        if (!empty($wt->tmt)) $score += 20;
        if (!empty($wt->tanggal_lahir)) $score += 20;
        if (!empty($wt->tempat_lahir)) $score += 20;
        
        if ($score > $bestScore) {
            $bestScore = $score;
            $bestWanderer = $wt;
        }
    }
    
    if ($bestWanderer && $bestScore > 0) {
        // Jika kita menemukan data!
        $simulatedCount++;
        echo "✅ DITEMUKAN DATA LENGKAP UNTUK: {$sk->nama} (SK ID: {$sk->id})\n";
        echo "   -> Sumber Data: Guru ID {$bestWanderer->id} yang nyasar di School ID {$bestWanderer->school_id}\n";
        
        if ($currentT) {
            echo "   -> AKSI: Meng-COPY data NIM/TTL/TMT ke Profil Guru yang benar di School ID {$sk->school_id}\n";
        } else {
            echo "   -> AKSI: Membuat Profil Guru BARU di School ID {$sk->school_id} dan mengisinya dengan data hasil Copy-Paste.\n";
        }
        echo "   -> Data yang akan disalin: NIM ({$bestWanderer->nomor_induk_maarif}), TTL ({$bestWanderer->tempat_lahir}, {$bestWanderer->tanggal_lahir})\n\n";
    }
}

echo "======================================================\n";
echo "SIMULASI SELESAI!\n";
echo "Total Guru yang akan diselamatkan datanya lewat Super Sync: {$simulatedCount}\n";
