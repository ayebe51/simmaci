<?php

use App\Models\SkDocument;
use Illuminate\Support\Facades\DB;

echo "=== EKSEKUSI PENGHAPUSAN SK DUPLIKAT YANG TIDAK LENGKAP ===\n\n";

$query = SkDocument::withoutGlobalScopes()
    ->where('status', 'active')
    ->where(function ($q) {
        $q->whereNull('nomor_permohonan')
          ->orWhere('nomor_permohonan', '')
          ->orWhereNull('tanggal_permohonan');
    });

$incompleteSks = $query->get();
$deletedCount = 0;
$skippedCount = 0;

DB::beginTransaction();
try {
    foreach ($incompleteSks as $incompleteSk) {
        // Cari SK pengganti
        $completeSks = SkDocument::withoutGlobalScopes()
            ->where('teacher_id', $incompleteSk->teacher_id)
            ->where('school_id', $incompleteSk->school_id)
            ->where('id', '!=', $incompleteSk->id)
            ->whereNotNull('nomor_permohonan')
            ->where('nomor_permohonan', '!=', '')
            ->whereNotNull('tanggal_permohonan')
            ->get();
            
        if ($completeSks->count() > 0) {
            echo "Menghapus SK Incomplete ID {$incompleteSk->id} (Guru: {$incompleteSk->nama})... ";
            // Delete the incomplete one permanently (or soft delete)
            $incompleteSk->delete();
            $deletedCount++;
            echo "✅ BERHASIL\n";
        } else {
            echo "Melewati SK Incomplete ID {$incompleteSk->id} (Guru: {$incompleteSk->nama}) karena TIDAK ADA PENGGANTI.\n";
            $skippedCount++;
        }
    }
    
    DB::commit();
    echo "\n=== RINGKASAN EKSEKUSI ===\n";
    echo "- Total SK duplikat (kosong) yang berhasil dihapus: {$deletedCount}\n";
    echo "- Total SK yang dilewati (karena tidak punya pengganti): {$skippedCount}\n";
    echo "- Selesai!\n";
    
} catch (\Exception $e) {
    DB::rollBack();
    echo "\n❌ TERJADI KESALAHAN: " . $e->getMessage() . "\n";
}
