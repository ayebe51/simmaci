<?php
use App\Models\Teacher;
use Illuminate\Support\Facades\DB;

echo "=== MENGOSONGKAN NIM GANDA DAN NIM '0' ===\n\n";

DB::beginTransaction();
try {
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
        echo "Mereset NIM Ganda menjadi kosong...\n";
        // 2. Kosongkan NIM untuk guru-guru tersebut
        $totalDuplicateTeachersCleared = Teacher::withoutGlobalScopes()
            ->whereIn('nomor_induk_maarif', $duplicateNims)
            ->update(['nomor_induk_maarif' => null]);
            
        echo "✅ Berhasil mengosongkan NIM untuk {$totalDuplicateTeachersCleared} profil guru yang terlibat bentrok NIM ganda.\n\n";
    } else {
        echo "✅ Tidak ada NIM ganda yang ditemukan.\n\n";
    }

    // 3. Bersihkan juga NIM yang berisi angka 0
    echo "Mereset NIM yang berisi angka '0' menjadi kosong...\n";
    $zerosCleared = Teacher::withoutGlobalScopes()
        ->where('nomor_induk_maarif', '0')
        ->update(['nomor_induk_maarif' => null]);

    if ($zerosCleared > 0) {
        echo "✅ Berhasil mengosongkan NIM '0' pada {$zerosCleared} profil guru.\n\n";
    } else {
        echo "✅ Tidak ada NIM '0' yang ditemukan.\n\n";
    }

    DB::commit();
    echo "=== PEMBERSIHAN SELESAI! ===\n";
    echo "Sekarang admin/operator sekolah bisa meng-*generate* atau memasukkan NIM baru yang valid.\n";

} catch (\Exception $e) {
    DB::rollBack();
    echo "❌ GAGAL: " . $e->getMessage() . "\n";
}
