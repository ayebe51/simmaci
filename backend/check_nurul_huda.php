<?php
use App\Models\Teacher;
use App\Models\School;

echo "=== DATA GURU MTs NURUL HUDA & MTs NURUL HUDA PATIMUAN ===\n\n";

// Mengambil semua guru yang unit kerjanya atau nama sekolahnya mengandung "MTs Nurul Huda"
$teachers = Teacher::withoutGlobalScopes()
    ->whereNull('deleted_at')
    ->where(function($q) {
        $q->where('unit_kerja', 'like', '%MTs Nurul Huda%')
          ->orWhereHas('school', function($sq) {
              $sq->where('nama', 'like', '%MTs Nurul Huda%');
          });
    })
    ->get(['id', 'nama', 'nomor_induk_maarif', 'school_id', 'unit_kerja'])
    ->sortBy(function($t) {
        return $t->school ? $t->school->nama : $t->unit_kerja;
    });

if ($teachers->isEmpty()) {
    echo "✅ Tidak ada guru yang terdeteksi dari sekolah tersebut.\n";
} else {
    echo "⚠️ DITEMUKAN {$teachers->count()} GURU:\n\n";
    
    $no = 1;
    foreach ($teachers as $t) {
        $schoolName = "TIDAK TERTAUT / KOSONG (ID: " . ($t->school_id ?? 'NULL') . ")";
        if ($t->school_id && $t->school) {
            $schoolName = $t->school->nama;
        }

        echo "{$no}. NAMA: {$t->nama} (ID: {$t->id})\n";
        echo "   NIM          : " . ($t->nomor_induk_maarif ?: 'KOSONG') . "\n";
        echo "   Unit Kerja   : " . ($t->unit_kerja ?: 'KOSONG') . "\n";
        echo "   Tautan Asli  : {$schoolName}\n";
        echo "--------------------------------------------------------\n";
        $no++;
    }
}
