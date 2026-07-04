<?php

use App\Models\SkDocument;
use Illuminate\Support\Facades\DB;

// Cari nama yang muncul lebih dari 1 kali di tabel sk_documents
// tetapi memiliki school_id atau unit_kerja yang BERBEDA
$duplicates = SkDocument::withoutGlobalScopes()
    ->select('nama', DB::raw('COUNT(DISTINCT school_id) as school_count'), DB::raw('COUNT(id) as total_sk'))
    ->groupBy('nama')
    ->havingRaw('COUNT(DISTINCT school_id) > 1')
    ->orderBy('school_count', 'desc')
    ->get();

echo "=== DAFTAR NAMA GANDA (MUNCUL DI LEBIH DARI 1 SEKOLAH) ===\n\n";

if ($duplicates->isEmpty()) {
    echo "Tidak ada nama ganda antar sekolah.\n";
} else {
    foreach ($duplicates as $dup) {
        echo "Nama: {$dup->nama}\n";
        echo "Total SK: {$dup->total_sk} | Tersebar di: {$dup->school_count} sekolah berbeda\n";
        
        $sks = SkDocument::withoutGlobalScopes()
            ->where('nama', $dup->nama)
            ->select('id', 'unit_kerja', 'teacher_id')
            ->get();
            
        foreach ($sks as $sk) {
            echo "  - SK ID: {$sk->id} | Unit Kerja: {$sk->unit_kerja} | Teacher ID: {$sk->teacher_id}\n";
        }
        echo "----------------------------------------\n";
    }
}
