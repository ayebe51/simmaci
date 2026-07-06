<?php

use App\Models\SkDocument;

echo "=== MENDIAGNOSIS SK DENGAN DATA KOSONG ===\n\n";

$sks = SkDocument::withoutGlobalScopes()->get();
$emptyCount = 0;

foreach ($sks as $sk) {
    $teacher = $sk->teacher; // Load relasi teacher

    // Cek apakah relasi teacher kosong, ATAU data-data pentingnya kosong
    if (!$teacher || empty($teacher->tempat_lahir) || empty($teacher->tanggal_lahir)) {
        $emptyCount++;
        echo "SK ID: {$sk->id} (Nama di SK: {$sk->nama})\n";
        echo "-> Teacher ID: " . ($sk->teacher_id ?? 'NULL') . "\n";
        
        if (!$teacher && $sk->teacher_id) {
            echo "-> PENYEBAB: Teacher ID {$sk->teacher_id} terhapus (soft-delete) atau hilang dari tabel guru!\n";
            // Cek apakah ada di soft-deleted
            $trashedTeacher = \App\Models\Teacher::withoutGlobalScopes()->withTrashed()->find($sk->teacher_id);
            if ($trashedTeacher) {
                echo "   (Fakta: Guru ini ada di TONG SAMPAH / Ter-Soft Delete!)\n";
            }
        } elseif ($teacher) {
            echo "-> PENYEBAB: Data di Profil Guru tersebut memang masih kosong (Belum diisi oleh sekolah).\n";
        } else {
            echo "-> PENYEBAB: Teacher ID kosong (NULL). Belum terkait dengan guru manapun.\n";
        }
        echo "----------------------------------------\n";
        
        // Batasi output agar tidak terlalu panjang
        if ($emptyCount >= 15) {
            echo "... dan masih banyak lagi.\n";
            break;
        }
    }
}

echo "\nTotal SK bermasalah (Data kosong): {$emptyCount} (sampel)\n";
