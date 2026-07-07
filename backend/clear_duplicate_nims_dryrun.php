<?php
use App\Models\Teacher;
use App\Models\School;
use Illuminate\Support\Facades\DB;

echo "=== [DRY RUN] MENGOSONGKAN NIM GANDA DAN NIM '0' ===\n";
echo "*(Tidak ada data yang benar-benar dirubah di database pada mode ini)*\n\n";

// 1. Cari semua NIM yang jumlahnya lebih dari 1 (ganda)
$duplicateNims = DB::table('teachers')
    ->select('nomor_induk_maarif')
    ->whereNotNull('nomor_induk_maarif')
    ->where('nomor_induk_maarif', '!=', '')
    ->whereNull('deleted_at')
    ->groupBy('nomor_induk_maarif')
    ->havingRaw('COUNT(id) > 1')
    ->pluck('nomor_induk_maarif');

$totalDuplicateTeachersCleared = 0;

if ($duplicateNims->isNotEmpty()) {
    echo "🔍 MENDETEKSI NIM GANDA YANG AKAN DICABUT:\n";
    foreach ($duplicateNims as $nim) {
        echo "NIM Ganda: {$nim}\n";
        $teachers = Teacher::withoutGlobalScopes()->where('nomor_induk_maarif', $nim)->get();
        foreach ($teachers as $t) {
            $schoolName = $t->school ? $t->school->nama : "Tanpa Sekolah (ID: {$t->school_id})";
            echo "   -> [SIMULASI CABUT] {$t->nama} (ID: {$t->id}) di {$schoolName}\n";
            $totalDuplicateTeachersCleared++;
        }
        echo "--------------------------------------------------------\n";
    }
    echo "📋 SIMULASI: Total {$totalDuplicateTeachersCleared} profil guru akan dikosongkan NIM-nya akibat bentrok NIM ganda.\n\n";
} else {
    echo "✅ Tidak ada NIM ganda yang ditemukan.\n\n";
}

// 2. Bersihkan juga NIM yang berisi angka 0
echo "🔍 MENDETEKSI NIM '0' YANG AKAN DIKOSONGKAN:\n";
$zeroTeachers = Teacher::withoutGlobalScopes()
    ->where('nomor_induk_maarif', '0')
    ->get();

if ($zeroTeachers->isNotEmpty()) {
    foreach ($zeroTeachers as $t) {
        $schoolName = $t->school ? $t->school->nama : "Tanpa Sekolah (ID: {$t->school_id})";
        echo "   -> [SIMULASI CABUT '0'] {$t->nama} (ID: {$t->id}) di {$schoolName}\n";
    }
    echo "📋 SIMULASI: Total {$zeroTeachers->count()} profil guru akan dikosongkan NIM-nya (berisi '0').\n\n";
} else {
    echo "✅ Tidak ada NIM '0' yang ditemukan.\n\n";
}

echo "=== SELESAI (HANYA SIMULASI DRY RUN) ===\n";
