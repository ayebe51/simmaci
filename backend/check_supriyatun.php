<?php

use App\Models\SkDocument;
use App\Models\Teacher;

echo "=== CEK SK SUPRIYATUN & AAN ===\n\n";

$sks = SkDocument::withoutGlobalScopes()
    ->whereIn('nama', ['SUPRIYATUN, S.Pd.I', 'AAN RUSLIANA, S.Pd.I'])
    ->get();

foreach ($sks as $sk) {
    echo "SK ID: {$sk->id} | Nama: {$sk->nama}\n";
    echo "  - School ID: {$sk->school_id}\n";
    echo "  - Unit Kerja: {$sk->unit_kerja}\n";
    echo "  - Status: {$sk->status}\n";
    echo "  - Nomor: {$sk->nomor_sk} (Permohonan: {$sk->nomor_permohonan})\n";
    echo "--------------------------------------------------\n";
}
