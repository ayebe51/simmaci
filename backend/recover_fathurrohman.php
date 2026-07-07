<?php
use App\Models\Teacher;
use App\Models\SkDocument;
use Illuminate\Support\Facades\DB;

echo "=== MENCARI DATA ASLI CILOPADANG DARI TONG SAMPAH ===\n\n";

$fathurCilopadang = Teacher::withoutGlobalScopes()->withTrashed()->where('nomor_induk_maarif', '113403337')->first();

if (!$fathurCilopadang) {
    echo "❌ Data Fathurrohman Cilopadang (NIM 113403337) TIDAK DITEMUKAN di database maupun tong sampah!\n";
    exit;
}

echo "✅ DATA CILOPADANG DITEMUKAN!\n";
echo "NIM: {$fathurCilopadang->nomor_induk_maarif}\n";
echo "School ID: {$fathurCilopadang->school_id}\n";
echo "Nama: {$fathurCilopadang->nama}\n";
if ($fathurCilopadang->trashed()) {
    echo "Status: 🗑️ TERHAPUS (Di Tong Sampah)\n";
} else {
    echo "Status: 🟢 AKTIF\n";
}

DB::beginTransaction();
try {
    // 1. Pulihkan profil Cilopadang
    if ($fathurCilopadang->trashed()) {
        $fathurCilopadang->restore();
        echo "\n🔄 Profil Cilopadang (113403337) BERHASIL DIPULIHKAN DARI TONG SAMPAH!\n";
    }

    // 2. Kembalikan SK 433 ke profil Cilopadang
    $skCilopadang = SkDocument::withoutGlobalScopes()->find(433);
    if ($skCilopadang) {
        $skCilopadang->teacher_id = $fathurCilopadang->id;
        $skCilopadang->save();
        echo "🔄 SK ID 433 (Cilopadang) berhasil dikembalikan ke Profil aslinya (NIM 113403337).\n";
    }

    // 3. Kembalikan profil Layansari (113401741) ke sekolah 64
    $fathurLayansari = Teacher::withoutGlobalScopes()->where('nomor_induk_maarif', '113401741')->first();
    if ($fathurLayansari) {
        $fathurLayansari->school_id = 64; // Layansari
        $fathurLayansari->save();
        echo "🔄 Profil Layansari (113401741) berhasil dikembalikan murni ke MI Ma'arif 02 Layansari (School 64).\n";
    }

    DB::commit();
    echo "\n✅ MASALAH FATHURROHMAN SELESAI!\n";
} catch (\Exception $e) {
    DB::rollBack();
    echo "❌ GAGAL: " . $e->getMessage() . "\n";
}
