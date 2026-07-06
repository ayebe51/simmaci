<?php

use App\Models\SkDocument;

echo "=== MENCARI SK DENGAN NOMOR PERMOHONAN '65' ===\n\n";

$sks = SkDocument::withoutGlobalScopes()
    ->where('nomor_permohonan', '65')
    ->get();

echo "Ditemukan: {$sks->count()} SK\n";

foreach ($sks as $sk) {
    echo "SK ID: {$sk->id} | Guru: {$sk->nama} | School ID: {$sk->school_id} | Status: {$sk->status} | No Permohonan: {$sk->nomor_permohonan} | Tanggal: {$sk->tanggal_permohonan}\n";
}
