<?php

use App\Models\SkDocument;
use App\Models\Teacher;

echo "=== SINKRONISASI TAHAP 2 (MENYISIR TONG SAMPAH & REVISI) ===\n\n";

$sks = SkDocument::withoutGlobalScopes()->whereNull('deleted_at')->get();
$syncedCount = 0;

foreach ($sks as $sk) {
    $currentT = $sk->teacher;
    if (!$currentT) {
        continue; // Jika tidak ada guru tertaut, dilewati dulu (harus ditautkan dulu)
    }

    $updated = false;

    // 1. CARI DARI REVISION DATA SK ITU SENDIRI (Atau SK duplikat di tong sampah)
    // Coba ambil semua SK kembar (termasuk yang di tong sampah)
    $allTwinSks = SkDocument::withoutGlobalScopes()
        ->withTrashed()
        ->where('school_id', $sk->school_id)
        ->where('nama', $sk->nama)
        ->get();

    foreach ($allTwinSks as $twin) {
        if (!empty($twin->revision_data)) {
            $rev = is_string($twin->revision_data) ? json_decode($twin->revision_data, true) : $twin->revision_data;
            if (is_array($rev)) {
                if (empty($currentT->nomor_induk_maarif) && !empty($rev['nomor_induk_maarif'])) { $currentT->nomor_induk_maarif = $rev['nomor_induk_maarif']; $updated = true; }
                if (empty($currentT->tmt) && !empty($rev['tmt'])) { $currentT->tmt = $rev['tmt']; $updated = true; }
                if (empty($currentT->tanggal_lahir) && !empty($rev['tanggal_lahir'])) { $currentT->tanggal_lahir = $rev['tanggal_lahir']; $updated = true; }
                if (empty($currentT->tempat_lahir) && !empty($rev['tempat_lahir'])) { $currentT->tempat_lahir = $rev['tempat_lahir']; $updated = true; }
                if (empty($currentT->pendidikan_terakhir) && !empty($rev['pendidikan_terakhir'])) { $currentT->pendidikan_terakhir = $rev['pendidikan_terakhir']; $updated = true; }
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
        if (empty($currentT->nomor_induk_maarif) && !empty($tt->nomor_induk_maarif)) { $currentT->nomor_induk_maarif = $tt->nomor_induk_maarif; $updated = true; }
        if (empty($currentT->tmt) && !empty($tt->tmt)) { $currentT->tmt = $tt->tmt; $updated = true; }
        if (empty($currentT->tanggal_lahir) && !empty($tt->tanggal_lahir)) { $currentT->tanggal_lahir = $tt->tanggal_lahir; $updated = true; }
        if (empty($currentT->tempat_lahir) && !empty($tt->tempat_lahir)) { $currentT->tempat_lahir = $tt->tempat_lahir; $updated = true; }
        if (empty($currentT->pendidikan_terakhir) && !empty($tt->pendidikan_terakhir)) { $currentT->pendidikan_terakhir = $tt->pendidikan_terakhir; $updated = true; }
    }

    if ($updated) {
        $currentT->save();
        echo "📥 RECOVERY DATA BERHASIL: Menyalin data TTL/NIM/TMT yang hilang kembali ke Profil Guru [{$currentT->nama}]\n";
        $syncedCount++;
    }
}

echo "\n======================================================\n";
echo "PROSES SELESAI!\n";
echo "Total data profil guru yang berhasil diselamatkan/dilengkapi: {$syncedCount}\n";
