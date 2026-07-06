<?php

use App\Models\SkDocument;
use App\Models\Teacher;

echo "=== SINKRONISASI SK DENGAN PROFIL GURU TERLENGKAP ===\n\n";

// Mengambil seluruh SK yang aktif
$sks = SkDocument::withoutGlobalScopes()->whereNull('deleted_at')->get();
$syncedCount = 0;

foreach ($sks as $sk) {
    // 1. Ambil nama bersih tanpa gelar (contoh: "BUDI SANTOSO, S.Pd" -> "BUDI SANTOSO")
    $bareName = trim(explode(',', $sk->nama)[0]);
    $bareNameLower = strtolower($bareName);
    
    // 2. Cari semua profil guru di sekolah yang sama dengan nama tersebut
    $teachers = Teacher::withoutGlobalScopes()
        ->where('school_id', $sk->school_id)
        ->whereNull('deleted_at')
        ->whereRaw('LOWER(nama) LIKE ?', ['%' . $bareNameLower . '%'])
        ->get();
        
    if ($teachers->isEmpty()) {
        continue;
    }
    
    // 3. Dari semua guru kembar/mirip tersebut, cari yang datanya PALING LENGKAP
    $bestTeacher = null;
    $bestScore = -1;
    
    foreach ($teachers as $t) {
        $score = 0;
        
        // Cek kelengkapan data kunci
        if (!empty($t->nomor_induk_maarif)) $score += 20;
        if (!empty($t->tmt)) $score += 20;
        if (!empty($t->tanggal_lahir)) $score += 20;
        if (!empty($t->tempat_lahir)) $score += 20;
        
        // Bonus jika namanya persis sama huruf-per-huruf dengan di SK
        if (strtolower(trim($t->nama)) === strtolower(trim($sk->nama))) {
            $score += 10;
        }
        
        // Jika skornya mengalahkan yang sebelumnya, jadikan kandidat terbaik
        if ($score > $bestScore) {
            $bestScore = $score;
            $bestTeacher = $t;
        }
    }
    
    // 4. Jika kandidat terbaik ditemukan, punya data (skor > 0), dan belum ditautkan ke SK ini
    if ($bestTeacher && $bestScore > 0 && $sk->teacher_id !== $bestTeacher->id) {
        $oldId = $sk->teacher_id ?: 'TIDAK ADA';
        
        // Lakukan sinkronisasi (Update relasi SK -> Teacher)
        $sk->teacher_id = $bestTeacher->id;
        $sk->save();
        
        $syncedCount++;
        echo "🔗 SINKRONISASI BERHASIL: {$sk->nama} \n";
        echo "   -> Pindah dari Guru ID [{$oldId}] ke Guru ID [{$bestTeacher->id}] (Memiliki NIM/TTL/TMT)\n";
    }
}

echo "\n======================================================\n";
echo "PROSES SELESAI!\n";
echo "Total pengajuan SK yang berhasil disinkronkan ke profil guru lengkap: {$syncedCount}\n";
