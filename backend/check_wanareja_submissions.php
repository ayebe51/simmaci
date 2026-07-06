<?php

use App\Models\SkDocument;

echo "=== RIWAYAT PENGAJUAN SK MTs MA'ARIF WANAREJA (School ID: 164) ===\n\n";

$sks = SkDocument::withoutGlobalScopes()->withTrashed()->where('school_id', 164)->orderBy('created_at', 'asc')->get();

if ($sks->count() == 0) {
    echo "TIDAK ADA DATA.\n";
} else {
    foreach ($sks as $sk) {
        $status = $sk->trashed() ? "[TERHAPUS/TRASH]" : "[AKTIF]";
        $date = $sk->created_at ? $sk->created_at->format('Y-m-d H:i') : 'Unknown Date';
        
        echo "Tgl Submit: {$date} | SK ID: {$sk->id} {$status}\n";
        echo "  Nama Guru: {$sk->nama}\n";
        echo "  Nomor Permohonan: {$sk->nomor_permohonan}\n";
        echo "  File Lampiran: " . ($sk->file_url ? 'ADA' : 'TIDAK ADA') . "\n";
        echo "--------------------------------------------------------\n";
    }
}

echo "\nTotal Pengajuan (Aktif & Terhapus): " . $sks->count() . "\n";
