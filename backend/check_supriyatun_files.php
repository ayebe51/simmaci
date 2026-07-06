<?php

use App\Models\SkDocument;

echo "=== CEK FILE URL SUPRIYATUN ===\n\n";

$sks = SkDocument::withoutGlobalScopes()->where('nama', 'LIKE', '%SUPRIYATUN%')->get();
foreach ($sks as $sk) {
    echo "SK ID: {$sk->id}\n";
    echo "  - No Permohonan: {$sk->nomor_permohonan}\n";
    echo "  - File URL: " . ($sk->file_url ?: 'KOSONG') . "\n";
    echo "  - Surat Permohonan URL: " . ($sk->surat_permohonan_url ?: 'KOSONG') . "\n";
    echo "--------------------------------------------------\n";
}
