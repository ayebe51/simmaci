<?php

use App\Models\SkDocument;
use App\Models\Teacher;

echo "=== DAFTAR SEMUA SK AAN RUSLIANA ===\n\n";

$sks = SkDocument::withoutGlobalScopes()
    ->where('nama', 'LIKE', '%AAN RUSLIANA%')
    ->get();

foreach ($sks as $sk) {
    echo "SK ID: {$sk->id}\n";
    echo "  Nomor SK: {$sk->nomor_sk}\n";
    echo "  School ID: {$sk->school_id}\n";
    echo "  Unit Kerja Text: {$sk->unit_kerja}\n";
    echo "  Status: {$sk->status}\n";
    echo "--------------------------------------------------\n";
}
