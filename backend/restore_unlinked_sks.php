<?php

use App\Models\SkDocument;
use App\Models\Teacher;
use Illuminate\Support\Facades\DB;

echo "Memulai pemulihan data SK yang tidak sengaja ter-unlink...\n";

// Ambil semua SK yang saat ini teacher_id nya NULL
$orphanedSks = SkDocument::withoutGlobalScopes()->whereNull('teacher_id')->get();

$restored = 0;
$stillOrphaned = 0;

foreach ($orphanedSks as $sk) {
    $bareName = trim(explode(',', $sk->nama)[0]);

    // Cari guru dengan nama yang sama persis (abaikan school_id)
    // Urutkan berdasarkan yang memiliki school_id sama dengan SK (jika ada), lalu yang school_id nya NULL, lalu lainnya.
    $correctTeacher = Teacher::withoutGlobalScopes()
        ->whereRaw("UPPER(TRIM(SPLIT_PART(nama, ',', 1))) = ?", [strtoupper($bareName)])
        ->orderByRaw("CASE WHEN school_id = ? THEN 1 WHEN school_id IS NULL THEN 2 ELSE 3 END", [$sk->school_id])
        ->orderBy('updated_at', 'desc')
        ->first();

    if ($correctTeacher) {
        $sk->teacher_id = $correctTeacher->id;
        $sk->save();
        $restored++;
        echo "✅ [RESTORED] SK ID {$sk->id} ({$sk->nama}) dikembalikan ke Guru ID {$correctTeacher->id} (Sekolah Guru: " . ($correctTeacher->school_id ?? 'NULL') . ")\n";
    } else {
        $stillOrphaned++;
        echo "❌ [NOT FOUND] SK ID {$sk->id} ({$sk->nama}) tetap yatim karena Master Guru tidak ditemukan sama sekali.\n";
    }
}

echo "\n--- SELESAI ---\n";
echo "Total SK berhasil dipulihkan (TMT akan kembali muncul): {$restored}\n";
echo "Total SK tetap kosong (Guru benar-benar sudah tidak ada): {$stillOrphaned}\n";
