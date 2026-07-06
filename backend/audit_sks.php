<?php

use App\Models\SkDocument;
use App\Models\Teacher;

echo "=== ALAT AUDIT SK (MENCARI KASUS ALFINA TERSEMBUNYI) ===\n\n";

// Ambil semua SK yang tidak punya teacher_id (unlinked / ghost)
$orphanedSks = SkDocument::withoutGlobalScopes()
    ->whereNull('teacher_id')
    ->get();

$ghostCount = 0;
$alfinaSuspects = 0;

foreach ($orphanedSks as $sk) {
    $bareName = strtoupper(trim(explode(',', $sk->nama)[0]));

    // Coba cari guru di sekolah yang sama, pakai pencarian LIKE untuk toleransi typo
    $teacherInSchool = Teacher::withTrashed()
        ->withoutGlobalScopes()
        ->where('school_id', $sk->school_id)
        ->where(function($q) use ($bareName) {
            $q->where('nama', 'LIKE', "%{$bareName}%")
              ->orWhereRaw("UPPER(TRIM(SPLIT_PART(nama, ',', 1))) = ?", [$bareName]);
        })
        ->first();

    // Jika KETEMU, berarti ini BUKAN kasus Alfina. Ini cuma SK asli yang gurunya typo/beda gelar.
    if ($teacherInSchool) {
        continue;
    }

    // JIKA TIDAK KETEMU, berarti SK ini murni GHOST atau ALFINA CASE!
    
    // Mari cari siapa korban di sekolah ini (Guru yang tidak punya SK sama sekali)
    $teachersWithoutSk = Teacher::withoutGlobalScopes()
        ->where('school_id', $sk->school_id)
        ->where('is_active', true)
        ->whereDoesntHave('skDocuments') // Guru yang tidak punya relasi SK
        ->get(['id', 'nama']);

    echo "⚠️ [TERSANGKA] SK ID {$sk->id} (Nama di SK: {$sk->nama})\n";
    echo "   📍 Lokasi: Sekolah ID {$sk->school_id}\n";
    echo "   👉 Status: TIDAK DITEMUKAN guru bernama mirip '{$bareName}' di sekolah ini.\n";

    if ($teachersWithoutSk->count() > 0) {
        $alfinaSuspects++;
        echo "   🚨 INDIKASI KORBAN (KASUS ALFINA): Ada {$teachersWithoutSk->count()} guru di sekolah ini yang TIDAK PUNYA SK!\n";
        echo "   Kandidat Pemilik Asli:\n";
        foreach ($teachersWithoutSk as $korban) {
            echo "      - {$korban->nama} (ID: {$korban->id})\n";
        }
    } else {
        $ghostCount++;
        echo "   👻 MURNI SK HANTU/GANDA: Semua guru di sekolah ini SUDAH PUNYA SK.\n";
        echo "      (SK ini dipastikan 100% aman untuk dihapus)\n";
    }
    echo "------------------------------------------------------\n";
}

echo "\n=== KESIMPULAN ===\n";
echo "Total SK Murni Hantu (Aman Dihapus): {$ghostCount}\n";
echo "Total SK Terduga Korban Salah Nama (Kasus Alfina): {$alfinaSuspects}\n";
