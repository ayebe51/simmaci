<?php

use App\Models\SkDocument;

echo "=== CEK SK TUTI ROHAYATI ===\n\n";

$sks = SkDocument::withoutGlobalScopes()
    ->where('nama', 'LIKE', '%TUTI ROHAYATI%')
    ->get();

foreach ($sks as $sk) {
    echo "SK ID: {$sk->id}\n";
    echo "  - Nama Guru: {$sk->nama}\n";
    echo "  - Asal Sekolah: {$sk->unit_kerja} (School ID: {$sk->school_id})\n";
    echo "  - Status SK: {$sk->status}\n";
    echo "  - Nomor Surat: [" . $sk->nomor_permohonan . "]\n";
    echo "  - Tanggal Surat: [" . $sk->tanggal_permohonan . "]\n";
    
    // Hex dump to check for hidden spaces/characters
    echo "  - Nomor Surat (HEX): " . bin2hex($sk->nomor_permohonan ?? '') . "\n";
    echo "--------------------------------------------------\n";
}
