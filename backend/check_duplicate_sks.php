<?php

use App\Models\Teacher;
use App\Models\SkDocument;

echo "=== MENDETEKSI GURU DENGAN SK GANDA (DUPLIKAT) ===\n\n";

// Ambil semua guru yang punya lebih dari 1 SK active
$teachers = Teacher::withoutGlobalScopes()->whereHas('skDocuments', function($q) {
    $q->where('status', 'active');
}, '>', 1)->get();

echo "Total Guru dengan SK Aktif Ganda: {$teachers->count()} orang\n\n";

$totalGhostDuplicates = 0;

foreach ($teachers as $t) {
    echo "GURU: {$t->nama} (ID: {$t->id}) | Unit Kerja: {$t->unit_kerja}\n";
    $sks = SkDocument::withoutGlobalScopes()
        ->where('teacher_id', $t->id)
        ->where('status', 'active')
        ->orderBy('tanggal_permohonan', 'desc') // Yang terbaru di atas
        ->get();
        
    foreach ($sks as $i => $sk) {
        $schoolName = $sk->school ? $sk->school->nama : 'KOSONG';
        $isLatest = ($i === 0) ? "[SK TERBARU/PALING VALID]" : "[SK LAMA/DUPLIKAT]";
        
        // Cek anomali nomor
        $anomaly = "";
        if (strpos($sk->nomor_permohonan, 'MTs.MF') !== false && stripos($t->unit_kerja, 'MTs') === false) {
            $anomaly = " (AWAS: Nomor MTs di Guru MI)";
        }
        
        echo "  - {$isLatest} SK ID: {$sk->id} | Tanggal: {$sk->tanggal_permohonan} | No: {$sk->nomor_permohonan} | School: {$schoolName}{$anomaly}\n";
    }
    echo "--------------------------------------------------\n";
    $totalGhostDuplicates += ($sks->count() - 1);
}

echo "\nKESIMPULAN:\n";
echo "Sebagian besar 'kekacauan' ini hanyalah DUPLIKASI SK. User kemungkinan melakukan kesalahan input nomor surat, lalu membuat SK BARU tanpa menghapus SK yang LAMA.\n";
echo "Total SK Duplikat yang bisa dihapus: {$totalGhostDuplicates} SK.\n";
