<?php

use App\Models\SkDocument;
use App\Models\Teacher;

echo "=== MENCARI KASUS DATA HILANG ===\n\n";

// Kita akan mencari SK Aktif yang tidak punya TTL, 
// namun sebenarnya ada jejak TTL di tempat lain.

$sks = SkDocument::withoutGlobalScopes()->whereNull('deleted_at')->get();
$issuesFound = 0;

foreach ($sks as $sk) {
    // 1. Cek apakah SK ini punya TTL dari relasi Teacher
    $hasTtlInTeacher = false;
    $teacher = $sk->teacher;
    if ($teacher && (!empty($teacher->tempat_lahir) || !empty($teacher->tanggal_lahir))) {
        $hasTtlInTeacher = true;
    }
    if (!$teacher) {
        $activeT = Teacher::where('school_id', $sk->school_id)
            ->whereRaw('LOWER(TRIM(nama)) = ?', [strtolower(trim($sk->nama))])
            ->whereNull('deleted_at')
            ->first();
        if ($activeT && (!empty($activeT->tempat_lahir) || !empty($activeT->tanggal_lahir))) {
            $hasTtlInTeacher = true;
        }
    }

    // 2. Cek apakah SK ini punya TTL dari revision_data
    $hasTtlInRev = false;
    if (!empty($sk->revision_data)) {
        $rev = is_string($sk->revision_data) ? json_decode($sk->revision_data, true) : $sk->revision_data;
        if (is_array($rev) && (!empty($rev['tempat_lahir']) || !empty($rev['tanggal_lahir']))) {
            $hasTtlInRev = true;
        }
    }

    // Jika SK ini SEKARANG KOSONG (tidak punya TTL di Teacher maupun di Revision)
    if (!$hasTtlInTeacher && !$hasTtlInRev) {
        
        $reason = [];

        // ALASAN A: Ada SK Aktif lain (Duplikat) yang punya data
        $duplicateSk = SkDocument::withoutGlobalScopes()
            ->whereNull('deleted_at')
            ->where('school_id', $sk->school_id)
            ->where('nama', $sk->nama)
            ->where('id', '!=', $sk->id)
            ->get();

        foreach ($duplicateSk as $d) {
            $drev = is_string($d->revision_data) ? json_decode($d->revision_data, true) : $d->revision_data;
            if (is_array($drev) && (!empty($drev['tempat_lahir']) || !empty($drev['tanggal_lahir']))) {
                $reason[] = "-> DATA TIDAK HILANG, tapi ada di SK Duplikatnya yang Aktif (ID: {$d->id})";
                break;
            }
        }

        // ALASAN B: Datanya ada di SK yang terhapus (Tong Sampah)
        $trashedSk = SkDocument::withoutGlobalScopes()
            ->onlyTrashed()
            ->where('school_id', $sk->school_id)
            ->where('nama', $sk->nama)
            ->get();
            
        foreach ($trashedSk as $t) {
            $trev = is_string($t->revision_data) ? json_decode($t->revision_data, true) : $t->revision_data;
            if (is_array($trev) && (!empty($trev['tempat_lahir']) || !empty($trev['tanggal_lahir']))) {
                $reason[] = "-> DATA ADA di SK yang terhapus di tong sampah (ID: {$t->id})";
                break;
            }
        }

        // ALASAN C: Datanya ada di Profil Guru yang terhapus
        $trashedTeacher = Teacher::withoutGlobalScopes()
            ->onlyTrashed()
            ->where('school_id', $sk->school_id)
            ->where('nama', $sk->nama)
            ->first();
            
        if ($trashedTeacher && (!empty($trashedTeacher->tempat_lahir) || !empty($trashedTeacher->tanggal_lahir))) {
            $reason[] = "-> DATA ADA di Profil Guru (Teacher ID: {$trashedTeacher->id}) yang berstatus Terhapus (Trash)";
        }

        if (!empty($reason)) {
            echo "❌ KASUS DITEMUKAN PADA: {$sk->nama} (SK ID: {$sk->id}, Nomor: {$sk->nomor_sk})\n";
            foreach ($reason as $r) {
                echo $r . "\n";
            }
            echo "---------------------------------------------------\n";
            $issuesFound++;
            if ($issuesFound >= 5) break;
        }
    }
}

if ($issuesFound == 0) {
    echo "PENCARIAN SELESAI: Tidak ditemukan SK yang TTL-nya kosong namun datanya tersimpan di duplikat/tong sampah.\n";
    echo "Kemungkinan TTL/NIM memang dari awal tidak pernah terisi untuk nama-nama tersebut.\n";
} else {
    echo "PENCARIAN SELESAI: Ditemukan {$issuesFound} sampel kasus.\n";
}
