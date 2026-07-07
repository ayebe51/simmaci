<?php
use App\Models\Teacher;
use App\Models\SkDocument;
use Illuminate\Support\Facades\DB;

echo "=== MENGGABUNGKAN GURU GANDA DI SEKOLAH YANG SAMA ===\n\n";

$duplicateNims = DB::table('teachers')
    ->select('nomor_induk_maarif')
    ->whereNotNull('nomor_induk_maarif')
    ->where('nomor_induk_maarif', '!=', '')
    ->where('nomor_induk_maarif', '!=', '0')
    ->whereNull('deleted_at')
    ->groupBy('nomor_induk_maarif')
    ->havingRaw('COUNT(id) > 1')
    ->pluck('nomor_induk_maarif');

$mergedCount = 0;

DB::beginTransaction();
try {
    foreach ($duplicateNims as $nim) {
        $teachers = Teacher::withoutGlobalScopes()->where('nomor_induk_maarif', $nim)->get();
        
        // Kelompokkan berdasarkan school_id
        $groupedBySchool = $teachers->groupBy('school_id');
        
        foreach ($groupedBySchool as $schoolId => $twins) {
            if ($twins->count() > 1) {
                echo "NIM: {$nim} (School ID: {$schoolId})\n";
                // Urutkan berdasarkan yang paling lama dibuat (master)
                $sorted = $twins->sortBy('created_at')->values();
                $master = $sorted->first();
                
                echo "  ✅ Master Profil: {$master->nama} (ID: {$master->id})\n";
                
                for ($i = 1; $i < $sorted->count(); $i++) {
                    $clone = $sorted[$i];
                    echo "  🔄 Menggabungkan duplikat: {$clone->nama} (ID: {$clone->id})\n";
                    
                    // Pindahkan semua SK dari clone ke master
                    $sks = SkDocument::withoutGlobalScopes()->where('teacher_id', $clone->id)->get();
                    foreach ($sks as $sk) {
                        $sk->teacher_id = $master->id;
                        $sk->save();
                        echo "     -> SK ID {$sk->id} dipindahkan ke Master.\n";
                    }
                    
                    // Hapus clone
                    $clone->delete();
                    $mergedCount++;
                }
                echo "--------------------------------------------------------\n";
            }
        }
    }
    
    // Perbaiki NIM = '0' menjadi NULL
    $zeros = Teacher::withoutGlobalScopes()->where('nomor_induk_maarif', '0')->update(['nomor_induk_maarif' => null]);
    if ($zeros > 0) {
        echo "✅ Berhasil menghapus NIM '0' pada {$zeros} guru.\n";
    }

    DB::commit();
    echo "\n✅ PENGGABUNGAN SELESAI!\n";
    echo "Total profil duplikat (dalam 1 sekolah) yang berhasil digabung: {$mergedCount}\n";
} catch (\Exception $e) {
    DB::rollBack();
    echo "❌ GAGAL: " . $e->getMessage() . "\n";
}
