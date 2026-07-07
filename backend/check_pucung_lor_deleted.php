<?php
use App\Models\School;
use App\Models\Teacher;

echo "=== MENCARI GURU MI MAARIF 09 PUCUNG LOR YANG TERHAPUS ===\n\n";

$schools = School::where('nama', 'like', '%Pucung Lor%')->get();

if ($schools->isEmpty()) {
    echo "Sekolah dengan nama 'Pucung Lor' tidak ditemukan.\n";
    exit;
}

foreach ($schools as $school) {
    echo "Menemukan Sekolah: {$school->nama} (ID: {$school->id})\n";
    
    $deletedTeachers = Teacher::withoutGlobalScopes()
        ->onlyTrashed()
        ->where('school_id', $school->id)
        ->get();
        
    if ($deletedTeachers->isEmpty()) {
        echo " -> Tidak ada guru yang terhapus (Soft Delete) di sekolah ini.\n\n";
    } else {
        echo " -> DITEMUKAN " . $deletedTeachers->count() . " GURU YANG TERHAPUS:\n";
        foreach ($deletedTeachers as $t) {
            echo "    - Nama: {$t->nama} | NIM: {$t->nomor_induk_maarif} | ID: {$t->id} | Dihapus Pada: {$t->deleted_at}\n";
        }
        echo "\n";
    }
}
