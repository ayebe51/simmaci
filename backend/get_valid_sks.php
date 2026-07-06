<?php

use App\Models\SkDocument;

echo "=== DAFTAR NOMOR VALID UNTUK KARTINI, DIN AZIZAH, AAN ===\n\n";

$teachers = ['KARTINI SURATMI', 'DIN AZIZAH', 'AAN RUSLIANA'];

foreach ($teachers as $name) {
    $sks = SkDocument::withoutGlobalScopes()
        ->where('nama', 'LIKE', '%' . $name . '%')
        ->whereNotNull('nomor_permohonan')
        ->where('nomor_permohonan', '!=', '65')
        ->where('nomor_permohonan', '!=', '')
        ->orderBy('id', 'desc')
        ->get();
        
    echo "Guru: {$name}\n";
    if ($sks->count() > 0) {
        foreach ($sks as $sk) {
            echo "  - SK ID: {$sk->id} | Nomor Valid: {$sk->nomor_permohonan} | Status: {$sk->status} | Tanggal: {$sk->tanggal_permohonan}\n";
        }
    } else {
        echo "  - [!] TIDAK DITEMUKAN NOMOR VALID LAINNYA.\n";
    }
    echo "--------------------------------------------------\n";
}
