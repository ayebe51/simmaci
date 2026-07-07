<?php
use App\Models\Teacher;
use App\Models\School;

echo "=== MENDETEKSI GURU YANG BELUM TERHUBUNG DENGAN SCHOOL ID ===\n\n";

// Ambil semua ID sekolah yang valid
$validSchoolIds = School::pluck('id')->toArray();

// 1. Guru dengan school_id NULL, 0, atau kosong
$unlinkedTeachers = Teacher::withoutGlobalScopes()
    ->whereNull('deleted_at')
    ->where(function($q) {
        $q->whereNull('school_id')
          ->orWhere('school_id', 0);
    })
    ->get();

// 2. Guru dengan school_id yang TIDAK ADA di tabel schools (Orphaned)
$orphanedTeachers = Teacher::withoutGlobalScopes()
    ->whereNull('deleted_at')
    ->whereNotNull('school_id')
    ->whereNotIn('school_id', $validSchoolIds)
    ->get();

$totalUnlinked = $unlinkedTeachers->count() + $orphanedTeachers->count();

if ($totalUnlinked == 0) {
    echo "✅ Luar biasa! Semua profil guru sudah terhubung dengan School ID yang valid.\n";
} else {
    echo "⚠️ DITEMUKAN {$totalUnlinked} GURU YANG BERMASALAH DENGAN SCHOOL ID:\n\n";
    
    if ($unlinkedTeachers->count() > 0) {
        echo "--- KATEGORI 1: SCHOOL ID KOSONG / NULL ({$unlinkedTeachers->count()} orang) ---\n";
        foreach ($unlinkedTeachers as $idx => $t) {
            $unitKerja = $t->unit_kerja ?: 'TIDAK DIISI';
            echo "- NAMA: {$t->nama} | NIM: {$t->nomor_induk_maarif} | ID: {$t->id}\n";
            echo "  Unit Kerja (Teks Excel): {$unitKerja}\n";
        }
        echo "\n";
    }
    
    if ($orphanedTeachers->count() > 0) {
        echo "--- KATEGORI 2: SCHOOL ID TIDAK VALID / SEKOLAH TERHAPUS ({$orphanedTeachers->count()} orang) ---\n";
        foreach ($orphanedTeachers as $idx => $t) {
            $unitKerja = $t->unit_kerja ?: 'TIDAK DIISI';
            echo "- NAMA: {$t->nama} | NIM: {$t->nomor_induk_maarif} | ID: {$t->id} | School ID Invalid: {$t->school_id}\n";
            echo "  Unit Kerja (Teks Excel): {$unitKerja}\n";
        }
        echo "\n";
    }
}
