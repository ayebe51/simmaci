<?php

use App\Models\SkDocument;
use Carbon\Carbon;

echo "=== DAFTAR 9 SK YANG BERHASIL DISELAMATKAN ===\n\n";

// Cari SK yang baru saja diupdate dalam 10 menit terakhir
$recentSks = SkDocument::withoutGlobalScopes()
    ->where('updated_at', '>=', Carbon::now()->subMinutes(10))
    ->get();

foreach ($recentSks as $sk) {
    $teacher = $sk->teacher()->withoutGlobalScopes()->first();
    $school = $sk->school;
    
    echo "SK ID: {$sk->id}\n";
    echo "  Nama Guru: {$sk->nama}\n";
    echo "  Nomor SK: {$sk->nomor_sk}\n";
    echo "  Sekarang Berada di: " . ($school ? $school->nama : "Unknown") . " (School ID: {$sk->school_id})\n";
    if ($teacher) {
        echo "  Teks Unit Kerja (Asal Muasal): {$teacher->unit_kerja}\n";
    }
    echo "--------------------------------------------------\n";
}
