<?php

use App\Models\SkDocument;
use App\Models\Teacher;

function searchData($keyword) {
    echo "=== PENCARIAN DATA UNTUK: {$keyword} ===\n\n";

    $keywordLower = strtolower($keyword);

    echo "[1] MENCARI DI TABEL PROFIL GURU (TEACHERS) ...\n";
    $teachers = Teacher::withoutGlobalScopes()->withTrashed()
        ->whereRaw('LOWER(nama) LIKE ?', ['%' . $keywordLower . '%'])
        ->get();

    if ($teachers->isEmpty()) {
        echo "   -> Tidak ditemukan profil guru dengan nama tersebut.\n";
    } else {
        foreach ($teachers as $t) {
            $status = $t->trashed() ? "[TERHAPUS/TRASH]" : "[AKTIF]";
            echo "   -> ID: {$t->id} | Nama: {$t->nama} | School ID: {$t->school_id} {$status}\n";
            echo "      NIM: " . ($t->nomor_induk_maarif ?: 'KOSONG') . " | TMT: " . ($t->tmt ?: 'KOSONG') . " | TTL: " . ($t->tempat_lahir ?: 'KOSONG') . ", " . ($t->tanggal_lahir ?: 'KOSONG') . "\n";
        }
    }

    echo "\n[2] MENCARI DI TABEL PENGAJUAN SK (SK_DOCUMENTS) ...\n";
    $sks = SkDocument::withoutGlobalScopes()->withTrashed()
        ->whereRaw('LOWER(nama) LIKE ?', ['%' . $keywordLower . '%'])
        ->get();

    if ($sks->isEmpty()) {
        echo "   -> Tidak ditemukan pengajuan SK dengan nama tersebut.\n";
    } else {
        foreach ($sks as $sk) {
            $status = $sk->trashed() ? "[TERHAPUS/TRASH]" : "[AKTIF]";
            echo "   -> SK ID: {$sk->id} | Nama: {$sk->nama} | School ID: {$sk->school_id} {$status}\n";
            echo "      Nomor SK: {$sk->nomor_sk} | Teacher ID: " . ($sk->teacher_id ?: 'NULL') . "\n";
            
            $rev = is_string($sk->revision_data) ? json_decode($sk->revision_data, true) : $sk->revision_data;
            if (is_array($rev) && (!empty($rev['tempat_lahir']) || !empty($rev['tanggal_lahir']))) {
                echo "      * REVISION DATA MEMILIKI TTL: {$rev['tempat_lahir']}, {$rev['tanggal_lahir']}\n";
            } else {
                echo "      * REVISION DATA KOSONG/TIDAK ADA TTL\n";
            }
        }
    }
    
    echo "\n=============================================\n";
}

// Check if we are running from CLI with an argument
if (php_sapi_name() === 'cli' && isset($argv[1])) {
    searchData($argv[1]);
}
