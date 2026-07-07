<?php
use App\Models\School;
use App\Models\Teacher;
use Illuminate\Support\Facades\DB;

echo "=== MEMULIHKAN GURU MI MAARIF 09 PUCUNG LOR YANG TERHAPUS ===\n\n";

// ID sekolah Pucung Lor akan dicari atau bisa disesuaikan
$schools = School::where('nama', 'like', '%Pucung Lor%')->get();

if ($schools->isEmpty()) {
    echo "Sekolah dengan nama 'Pucung Lor' tidak ditemukan.\n";
    exit;
}

$restoredCount = 0;

DB::beginTransaction();
try {
    foreach ($schools as $school) {
        $deletedTeachers = Teacher::withoutGlobalScopes()
            ->onlyTrashed()
            ->where('school_id', $school->id)
            ->get();
            
        if ($deletedTeachers->isNotEmpty()) {
            echo "Memproses Sekolah: {$school->nama}...\n";
            foreach ($deletedTeachers as $t) {
                $t->restore();
                echo "  ✅ BERHASIL MEMULIHKAN: {$t->nama} (NIM: {$t->nomor_induk_maarif})\n";
                $restoredCount++;
            }
        }
    }
    DB::commit();
    echo "\n✅ TOTAL {$restoredCount} GURU BERHASIL DIPULIHKAN DARI TONG SAMPAH!\n";
} catch (\Exception $e) {
    DB::rollBack();
    echo "❌ GAGAL: " . $e->getMessage() . "\n";
}
