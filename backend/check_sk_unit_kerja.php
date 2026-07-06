<?php

use App\Models\SkDocument;

echo "=== CEK SK KHALIMATUS SA'DIYAH & TEMAN-TEMANNYA ===\n\n";

$sks = SkDocument::withoutGlobalScopes()
    ->whereIn('nama', [
        "KHALIMATUS SA'DIYAH, S.Pd.",
        "SUPRIYATUN, S.Pd.I",
        "PRIMAWANTI, S.Pd.",
        "AHMAD MAFTUH, S.Pd.",
        "DASINI, S.Pd.I"
    ])
    ->get();

foreach ($sks as $sk) {
    echo "SK ID: {$sk->id}\n";
    echo "  Nama: {$sk->nama}\n";
    echo "  Unit Kerja di tabel SK: '{$sk->unit_kerja}'\n";
    echo "  School ID di tabel SK: {$sk->school_id}\n";
    echo "--------------------------------------------------\n";
}
