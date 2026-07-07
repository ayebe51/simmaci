<?php
use App\Models\Teacher;

echo "=== MENGECEK STATUS 20 GURU DENGAN NIM TERTINGGI ===\n\n";

$topNims = Teacher::withoutGlobalScopes()
    ->whereNotNull('nomor_induk_maarif')
    ->where('nomor_induk_maarif', 'like', '1134%')
    ->whereRaw("LENGTH(nomor_induk_maarif) = 9")
    ->orderByRaw("CAST(nomor_induk_maarif AS BIGINT) DESC")
    ->limit(20)
    ->get(['nama', 'nomor_induk_maarif', 'id', 'deleted_at', 'school_id']);

foreach ($topNims as $idx => $t) {
    $num = $idx + 1;
    $status = $t->deleted_at ? "🗑️ DI TONG SAMPAH (Dihapus: {$t->deleted_at})" : "✅ AKTIF";
    $school = $t->school ? $t->school->nama : "Tanpa Sekolah/Tidak Diketahui (ID: {$t->school_id})";
    
    echo "{$num}. NIM: {$t->nomor_induk_maarif} | {$t->nama} (ID: {$t->id})\n";
    echo "   Status : {$status}\n";
    echo "   Sekolah: {$school}\n";
    echo "--------------------------------------------------------\n";
}
