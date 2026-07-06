<?php

use App\Models\SkDocument;

echo "=== CEK STATUS GURU DI SK WANAREJA ===\n";

$sks = SkDocument::withoutGlobalScopes()
    ->where('school_id', 164)
    ->whereNull('deleted_at')
    ->get();

$activeTeacherCount = 0;
$trashedTeacherCount = 0;
$nullTeacherCount = 0;

foreach ($sks as $sk) {
    $teacher = $sk->teacher()->withoutGlobalScopes()->withTrashed()->first();
    
    echo "- SK: {$sk->nama} | Nomor: {$sk->nomor_permohonan}\n";
    if (!$teacher) {
        echo "  -> GURU TIDAK DITEMUKAN SAMA SEKALI (Null)\n";
        $nullTeacherCount++;
    } else {
        if ($teacher->trashed()) {
            echo "  -> GURU SUDAH DIHAPUS (Trashed) | Teacher ID: {$teacher->id}\n";
            $trashedTeacherCount++;
        } else {
            echo "  -> GURU AKTIF | Teacher ID: {$teacher->id}\n";
            $activeTeacherCount++;
        }
    }
}

echo "\nRingkasan dari " . $sks->count() . " SK Aktif:\n";
echo "- Guru Aktif: {$activeTeacherCount}\n";
echo "- Guru Terhapus: {$trashedTeacherCount}\n";
echo "- Guru Null/Kosong: {$nullTeacherCount}\n";
