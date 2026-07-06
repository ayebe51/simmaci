<?php

use App\Models\SkDocument;

echo "=== MENCARI PASANGAN SK LENGKAP UNTUK 29 DATA INCOMPLETE ===\n\n";

$query = SkDocument::withoutGlobalScopes()
    ->where('status', 'active')
    ->where(function ($q) {
        $q->whereNull('nomor_permohonan')
          ->orWhere('nomor_permohonan', '')
          ->orWhereNull('tanggal_permohonan');
    });

$incompleteSks = $query->get();

foreach ($incompleteSks as $incompleteSk) {
    // Cari SK lain atas nama guru yang sama, di sekolah yang sama, tapi datanya LENGKAP
    $completeSks = SkDocument::withoutGlobalScopes()
        ->where('teacher_id', $incompleteSk->teacher_id)
        ->where('school_id', $incompleteSk->school_id)
        ->where('id', '!=', $incompleteSk->id)
        ->whereNotNull('nomor_permohonan')
        ->where('nomor_permohonan', '!=', '')
        ->whereNotNull('tanggal_permohonan')
        ->get();
        
    $schoolName = $incompleteSk->school ? $incompleteSk->school->nama : ($incompleteSk->unit_kerja ?? 'TIDAK DIKETAHUI');
    
    echo "SK INCOMPLETE ID: {$incompleteSk->id} | Guru: {$incompleteSk->nama} | Sekolah: {$schoolName}\n";
    
    if ($completeSks->count() > 0) {
        echo "  --> DITEMUKAN {$completeSks->count()} SK LENGKAP sebagai pengganti/referensi:\n";
        foreach ($completeSks as $c) {
            echo "      - SK ID: {$c->id} | Nomor: {$c->nomor_permohonan} | Tanggal: {$c->tanggal_permohonan} | Status: {$c->status}\n";
        }
    } else {
        echo "  --> TIDAK DITEMUKAN SK lengkap di sekolah yang sama untuk guru ini.\n";
    }
    echo "--------------------------------------------------\n";
}
