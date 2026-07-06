<?php

use App\Models\SkDocument;
use Illuminate\Support\Facades\DB;

echo "=== MENGHAPUS SK DUPLIKAT SUPRIYATUN ===\n\n";

DB::beginTransaction();
try {
    $sk = SkDocument::withoutGlobalScopes()->find(684);
    if ($sk) {
        $sk->delete();
        echo "✅ SK ID 684 (Nomor Permohonan 65) milik Supriyatun berhasil dihapus!\n";
        echo "Sekarang sistem hanya akan membaca SK ID 1950 yang valid dengan file surat yang benar.\n";
    } else {
        echo "❌ SK ID 684 tidak ditemukan (mungkin sudah dihapus sebelumnya).\n";
    }
    
    DB::commit();
} catch (\Exception $e) {
    DB::rollBack();
    echo "ERROR: " . $e->getMessage() . "\n";
}
