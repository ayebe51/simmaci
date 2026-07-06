<?php

use App\Models\SkDocument;
use App\Models\Teacher;
use App\Models\School;

echo "=== INVESTIGASI KASUS AHMAD MAHRUM DI BULUPAYUNG ===\n\n";

// 1. Cari data SK Ahmad Mahrum
$sks = SkDocument::withoutGlobalScopes()
    ->where('nama', 'like', '%AHMAD MAHRUM%')
    ->get(['id', 'school_id', 'nama', 'surat_permohonan_url', 'nomor_surat_permohonan']);

foreach ($sks as $sk) {
    $school = School::find($sk->school_id);
    $schoolName = $school ? $school->nama : "Unknown (ID: {$sk->school_id})";
    
    echo "SK ID: {$sk->id}\n";
    echo "Sekolah: {$schoolName}\n";
    echo "Nomor Surat: {$sk->nomor_surat_permohonan}\n";
    echo "File PDF / Gambar Surat: " . basename($sk->surat_permohonan_url) . "\n";
    echo "----------------------------------------\n";
}

echo "\n=== MENCARI KORBAN ASLI DI BULUPAYUNG ===\n";
// ID Sekolah Bulupayung adalah 68 (dari history sebelumnya).
$sksBulupayung = $sks->where('school_id', 68)->first();

if ($sksBulupayung) {
    // Cari guru di Bulupayung yang TIDAK PUNYA SK
    $teachersWithoutSk = Teacher::withoutGlobalScopes()
        ->where('school_id', 68)
        ->where('is_active', true)
        ->whereDoesntHave('skDocuments')
        ->get(['id', 'nama']);

    if ($teachersWithoutSk->count() > 0) {
        echo "Ternyata ada {$teachersWithoutSk->count()} Guru di Bulupayung yang KEHILANGAN SK-nya!\n";
        echo "Kandidat pemilik asli SK Ahmad Mahrum (Bulupayung) tersebut adalah:\n";
        foreach ($teachersWithoutSk as $t) {
            echo "- {$t->nama} (ID: {$t->id})\n";
        }
    } else {
        echo "Aneh! Semua guru di Bulupayung SUDAH PUNYA SK.\n";
        echo "Berarti ini murni salah ketik Kepala Sekolah saat input dari awal.\n";
    }
}
