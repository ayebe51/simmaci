<?php
use App\Models\Teacher;

echo "=== MENDETEKSI GURU TANPA TEKS UNIT KERJA ===\n\n";

$teachers = Teacher::withoutGlobalScopes()
    ->whereNull('deleted_at')
    ->where(function($q) {
        $q->whereNull('unit_kerja')
          ->orWhere('unit_kerja', '')
          ->orWhere('unit_kerja', '-');
    })
    ->get(['id', 'nama', 'nomor_induk_maarif', 'school_id']);

if ($teachers->isEmpty()) {
    echo "✅ Semua profil guru (aktif) sudah memiliki isian kolom unit_kerja.\n";
} else {
    echo "⚠️ DITEMUKAN {$teachers->count()} GURU DENGAN KOLOM UNIT KERJA KOSONG:\n\n";
    
    foreach ($teachers as $idx => $t) {
        $no = $idx + 1;
        
        // Coba cari nama sekolah aslinya jika school_id-nya valid
        $schoolName = "TIDAK TERTAUT (School ID: " . ($t->school_id ?? 'KOSONG') . ")";
        if ($t->school_id && $t->school) {
            $schoolName = $t->school->nama;
        }

        echo "{$no}. NAMA: {$t->nama} (ID: {$t->id})\n";
        echo "   NIM        : " . ($t->nomor_induk_maarif ?: 'KOSONG') . "\n";
        echo "   Sekolah    : {$schoolName}\n";
        echo "--------------------------------------------------------\n";
    }
    
    echo "\nTotal ada {$teachers->count()} guru yang tidak memiliki data unit kerja.\n";
}
