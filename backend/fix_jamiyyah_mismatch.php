<?php

use App\Models\SkDocument;
use App\Models\Teacher;
use App\Models\School;

echo "=== [DRY RUN] PEMULANGAN GURU NYASAR (KHUSUS JAM'IYYAH) ===\n";
echo "Peringatan: Ini hanya simulasi. Tidak ada data yang diubah.\n\n";

// Ambil semua SK aktif
$sks = SkDocument::withoutGlobalScopes()->whereNull('deleted_at')->get();
$simulatedCount = 0;

foreach ($sks as $sk) {
    $school = $sk->school;
    if (!$school) continue;
    
    // FOKUS HANYA JAMIYYAH
    $statusJamiyyah = strtolower($school->status_jamiyyah ?? '');
    $status = strtolower($school->status ?? '');
    if ($statusJamiyyah !== 'jamiyyah' && $status !== 'jamiyyah' && $statusJamiyyah !== "jam'iyyah" && $status !== "jam'iyyah") {
        continue;
    }

    $currentT = $sk->teacher;
    // Cek apakah data kosong
    $isDataMissing = !$currentT || empty($currentT->tmt) || empty($currentT->tanggal_lahir);
    if (!$isDataMissing) {
        continue; 
    }

    $bareName = trim(explode(',', $sk->nama)[0]);
    $bareNameLower = strtolower($bareName);
    
    // Cari Wanderer: Guru dengan nama sama di sekolah manapun, yang punya data lengkap
    $wanderers = Teacher::withoutGlobalScopes()
        ->withTrashed()
        ->whereRaw('LOWER(nama) LIKE ?', ['%' . $bareNameLower . '%'])
        ->get();
        
    $bestWanderer = null;
    
    foreach ($wanderers as $wt) {
        // Harus beda school_id (berarti nyasar)
        if ($wt->school_id == $sk->school_id) continue;
        
        // HARUS punya data yang lumayan lengkap
        if (empty($wt->tmt) || empty($wt->tanggal_lahir)) continue;
        
        // KUNCI KEAMANAN: Teks unit_kerja harus sama persis dengan nama sekolah SK
        $wtUnitKerja = strtolower(trim(str_replace(['’', "'"], '', $wt->unit_kerja)));
        $schoolName = strtolower(trim(str_replace(['’', "'"], '', $school->nama)));
        
        if ($wtUnitKerja === $schoolName || strpos($schoolName, $wtUnitKerja) !== false || strpos($wtUnitKerja, $schoolName) !== false) {
            $bestWanderer = $wt;
            break; // Ketemu!
        }
    }
    
    if ($bestWanderer) {
        $simulatedCount++;
        echo "✅ GURU NYASAR DITEMUKAN: {$sk->nama} (SK ID: {$sk->id})\n";
        echo "   -> Profil guru ini terjebak di School ID {$bestWanderer->school_id} walau unit_kerjanya '{$bestWanderer->unit_kerja}'\n";
        echo "   -> AKAN DIPULANGKAN KE: {$school->nama} (School ID: {$school->id})\n";
        echo "   -> Skenario Aksi:\n";
        echo "      1. Update school_id Guru ID {$bestWanderer->id} menjadi {$school->id}\n";
        echo "      2. Tautkan SK ID {$sk->id} ke Guru ID {$bestWanderer->id}\n";
        if ($currentT) {
            echo "      3. Hapus profil kosong lama (Guru ID {$currentT->id})\n";
        }
        echo "\n";
    }
}

echo "======================================================\n";
echo "SIMULASI SELESAI!\n";
echo "Total Guru Jam'iyyah yang akan dipulangkan ke sekolah asalnya: {$simulatedCount}\n";
