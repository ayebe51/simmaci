<?php

use App\Models\SkDocument;
use App\Models\Teacher;
use Illuminate\Support\Facades\DB;

echo "Memulai pembersihan SK Hantu (Ghost SKs)...\n";

// Ambil semua SK yang aktif (tidak di-soft-delete)
$sks = SkDocument::withoutGlobalScopes()->get();

$deletedCount = 0;

foreach ($sks as $sk) {
    $bareName = trim(explode(',', $sk->nama)[0]);
    $bareNameUpper = strtoupper($bareName);

    // Cari apakah ADA guru dengan nama ini di sekolah milik SK tersebut (termasuk yang di tong sampah)
    $teacherInSameSchool = Teacher::withTrashed()
        ->withoutGlobalScopes()
        ->whereRaw("UPPER(TRIM(SPLIT_PART(nama, ',', 1))) = ?", [$bareNameUpper])
        ->where('school_id', $sk->school_id)
        ->first();

    if (!$teacherInSameSchool) {
        // Jika tidak ada guru bernama ini di sekolah tersebut, berarti SK ini nyasar/duplikat!
        // Hapus (soft-delete) SK ini
        $sk->delete();
        $deletedCount++;
        echo "🗑️ [DELETED] SK ID {$sk->id} ({$sk->nama}) dihapus dari Sekolah {$sk->school_id} karena tidak ada guru dengan nama tersebut di sekolah ini.\n";
    }
}

echo "\n--- SELESAI ---\n";
echo "Total SK Hantu yang berhasil disapu bersih: {$deletedCount}\n";
