<?php

use App\Models\SkDocument;
use App\Models\Teacher;

echo "=== [DRY RUN] SIMULASI SINKRONISASI TAHAP 2 ===\n";
echo "Peringatan: Ini hanya simulasi. Tidak ada data yang benar-benar diubah di database.\n\n";

$sks = SkDocument::withoutGlobalScopes()->whereNull('deleted_at')->get();
$simulatedCount = 0;

foreach ($sks as $sk) {
    $currentT = $sk->teacher;
    if (!$currentT) {
        continue; 
    }

    $willBeUpdated = false;
    $updatedFields = [];

    // 1. CARI DARI REVISION DATA SK ITU SENDIRI (Atau SK duplikat di tong sampah)
    $allTwinSks = SkDocument::withoutGlobalScopes()
        ->withTrashed()
        ->where('school_id', $sk->school_id)
        ->where('nama', $sk->nama)
        ->get();

    foreach ($allTwinSks as $twin) {
        if (!empty($twin->revision_data)) {
            $rev = is_string($twin->revision_data) ? json_decode($twin->revision_data, true) : $twin->revision_data;
            if (is_array($rev)) {
                if (empty($currentT->nomor_induk_maarif) && !empty($rev['nomor_induk_maarif'])) { 
                    $updatedFields['NIM'] = $rev['nomor_induk_maarif'];
                    $willBeUpdated = true; 
                }
                if (empty($currentT->tmt) && !empty($rev['tmt'])) { 
                    $updatedFields['TMT'] = $rev['tmt'];
                    $willBeUpdated = true; 
                }
                if (empty($currentT->tanggal_lahir) && !empty($rev['tanggal_lahir'])) { 
                    $updatedFields['Tanggal Lahir'] = $rev['tanggal_lahir'];
                    $willBeUpdated = true; 
                }
                if (empty($currentT->tempat_lahir) && !empty($rev['tempat_lahir'])) { 
                    $updatedFields['Tempat Lahir'] = $rev['tempat_lahir'];
                    $willBeUpdated = true; 
                }
            }
        }
    }

    // 2. CARI DARI PROFIL GURU DI TONG SAMPAH
    $bareName = trim(explode(',', $sk->nama)[0]);
    $bareNameLower = strtolower($bareName);
    
    $trashedTeachers = Teacher::withoutGlobalScopes()
        ->onlyTrashed()
        ->where('school_id', $sk->school_id)
        ->whereRaw('LOWER(nama) LIKE ?', ['%' . $bareNameLower . '%'])
        ->get();

    foreach ($trashedTeachers as $tt) {
        if (empty($currentT->nomor_induk_maarif) && !empty($tt->nomor_induk_maarif)) { 
            $updatedFields['NIM'] = $tt->nomor_induk_maarif;
            $willBeUpdated = true; 
        }
        if (empty($currentT->tmt) && !empty($tt->tmt)) { 
            $updatedFields['TMT'] = $tt->tmt;
            $willBeUpdated = true; 
        }
        if (empty($currentT->tanggal_lahir) && !empty($tt->tanggal_lahir)) { 
            $updatedFields['Tanggal Lahir'] = $tt->tanggal_lahir;
            $willBeUpdated = true; 
        }
        if (empty($currentT->tempat_lahir) && !empty($tt->tempat_lahir)) { 
            $updatedFields['Tempat Lahir'] = $tt->tempat_lahir;
            $willBeUpdated = true; 
        }
    }

    if ($willBeUpdated) {
        $fieldsStr = implode(", ", array_keys($updatedFields));
        echo "🔍 [SIMULASI] Guru: {$currentT->nama}\n";
        echo "   -> Akan diisi datanya yang kosong: {$fieldsStr}\n";
        
        $simulatedCount++;
    }
}

echo "\n======================================================\n";
echo "SIMULASI SELESAI!\n";
echo "Total data profil guru yang AKAN diselamatkan: {$simulatedCount}\n";
