<?php
use App\Models\Teacher;
use Illuminate\Support\Facades\DB;

echo "=== MENGOSONGKAN NIM '0' SAJA ===\n\n";

DB::beginTransaction();
try {
    $zerosCleared = Teacher::withoutGlobalScopes()
        ->where('nomor_induk_maarif', '0')
        ->update(['nomor_induk_maarif' => null]);

    if ($zerosCleared > 0) {
        echo "✅ Berhasil mengosongkan NIM '0' pada {$zerosCleared} profil guru.\n\n";
    } else {
        echo "✅ Tidak ada NIM '0' yang ditemukan.\n\n";
    }

    DB::commit();
    echo "=== PEMBERSIHAN NIM '0' SELESAI! ===\n";
} catch (\Exception $e) {
    DB::rollBack();
    echo "❌ GAGAL: " . $e->getMessage() . "\n";
}
