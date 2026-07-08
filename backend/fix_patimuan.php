<?php
use App\Models\Teacher;
use Illuminate\Support\Facades\DB;

echo "=== EKSEKUSI: PENYELAMATAN DATA MTs NURUL HUDA PATIMUAN ===\n\n";

// Ambil semua guru Patimuan yang NIM-nya masih kosong
$patimuanTeachers = Teacher::withoutGlobalScopes()
    ->whereNull('deleted_at')
    ->where(function($q) {
        $q->where('unit_kerja', 'like', '%Patimuan%')
          ->orWhereHas('school', function($sq) {
              $sq->where('nama', 'like', '%Patimuan%');
          });
    })
    ->whereNull('nomor_induk_maarif')
    ->get();

$successCount = 0;
$failCount = 0;

DB::beginTransaction();
try {
    foreach ($patimuanTeachers as $p) {
        // Bersihkan nama dari gelar untuk pencarian (contoh: "AMIR MAHFUD, S.Pd.I" jadi "AMIR MAHFUD")
        $cleanName = preg_replace('/\,.*$/', '', $p->nama); 
        // Tangani kasus typo khusus AKHMAD KHOMASI / KOMASI
        if (strpos($cleanName, 'KHOMASI') !== false) {
            $cleanName = 'AKHMAD KOMASI';
        }
        
        $duplicates = Teacher::withoutGlobalScopes()
            ->whereNull('deleted_at')
            ->where('id', '!=', $p->id)
            ->where('nama', 'like', "%{$cleanName}%")
            ->whereNotNull('nomor_induk_maarif')
            ->get();

        if ($duplicates->count() == 1) {
            $dup = $duplicates->first();
            
            // 1. Pindahkan NIM ke Patimuan
            $p->nomor_induk_maarif = $dup->nomor_induk_maarif;
            $p->save();
            
            // 2. Hapus Permanen (Hard Delete) kloningan yang salah tempat
            $dup->forceDelete();
            
            echo "✅ [BERHASIL] {$p->nama} (ID: {$p->id})\n";
            echo "   -> Mendapat NIM {$p->nomor_induk_maarif}\n";
            echo "   -> Kloningan salah alamat (ID: {$dup->id}) BERHASIL DIHAPUS PERMANEN.\n";
            echo "---------------------------------------------------\n";
            $successCount++;
        } else if ($duplicates->count() > 1) {
            echo "❓ [BINGUNG] Ada lebih dari 1 kembaran bernim untuk {$p->nama}. Harus manual.\n";
            $failCount++;
        } else {
            echo "❌ [GAGAL] Tidak menemukan data kembaran bernim untuk {$p->nama}.\n";
            $failCount++;
        }
    }

    DB::commit();
    echo "\n=== PROSES SELESAI ===\n";
    echo "Berhasil diselamatkan : {$successCount} guru\n";
    echo "Gagal / Butuh manual  : {$failCount} guru\n";
} catch (\Exception $e) {
    DB::rollBack();
    echo "❌ GAGAL TOTAL: " . $e->getMessage() . "\n";
}
