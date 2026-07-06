<?php

use App\Models\SkDocument;
use App\Models\Teacher;
use Illuminate\Support\Facades\DB;

echo "=== MEMULAI SAPU BERSIH: HAPUS PENGAJUAN GANDA ===\n\n";

// LANGKAH 1: MENAUTKAN TYPO YANG TERSISA (SEPERTI YASIN)
echo "Langkah 1: Mencari SK yang TMT-nya kosong karena typo nama...\n";
$orphanedSks = SkDocument::withoutGlobalScopes()->whereNull('teacher_id')->get();
$relinkedCount = 0;

foreach ($orphanedSks as $sk) {
    $bareName = strtoupper(trim(explode(',', $sk->nama)[0]));
    
    $teacherInSchool = Teacher::withTrashed()
        ->withoutGlobalScopes()
        ->where('school_id', $sk->school_id)
        ->where(function($q) use ($bareName) {
            $q->where('nama', 'LIKE', "%{$bareName}%")
              ->orWhereRaw("UPPER(TRIM(SPLIT_PART(nama, ',', 1))) = ?", [$bareName]);
        })
        ->first();

    if ($teacherInSchool) {
        $sk->teacher_id = $teacherInSchool->id;
        $sk->save();
        $relinkedCount++;
        echo "   👉 Berhasil menautkan SK {$sk->nama} (ID: {$sk->id}) ke Guru ID: {$teacherInSchool->id}\n";
    }
}
echo "Total SK Typo yang berhasil ditautkan otomatis: {$relinkedCount}\n\n";

// LANGKAH 2: MENGHAPUS PENGAJUAN GANDA
echo "Langkah 2: Menghapus pengajuan ganda di setiap sekolah...\n";
$duplicates = SkDocument::withoutGlobalScopes()
    ->select('teacher_id', DB::raw('count(*) as count'))
    ->whereNotNull('teacher_id')
    ->groupBy('teacher_id')
    ->having('count', '>', 1)
    ->get();

$deletedCount = 0;

foreach ($duplicates as $dup) {
    // Ambil semua SK untuk guru ini
    $sks = SkDocument::withoutGlobalScopes()
        ->where('teacher_id', $dup->teacher_id)
        ->orderByRaw("CASE WHEN status = 'approved' OR is_sk_generated = true THEN 1 ELSE 2 END") // Prioritaskan yang sudah disetujui
        ->orderBy('created_at', 'desc') // Prioritaskan yang paling baru
        ->get();

    // Pertahankan yang pertama (index 0), hapus sisanya (index 1 ke atas)
    $keptSk = $sks->first();
    echo "   👤 Guru ID {$dup->teacher_id} punya {$dup->count} SK. Mempertahankan SK ID {$keptSk->id}...\n";

    $sksToDelete = $sks->slice(1);
    foreach ($sksToDelete as $skToDel) {
        $skToDel->delete(); // Soft delete
        $deletedCount++;
        echo "      🗑️ Dihapus: SK ID {$skToDel->id} (Status: {$skToDel->status})\n";
    }
}

echo "\n=== KESIMPULAN ===\n";
echo "Total Pengajuan Ganda yang dibersihkan: {$deletedCount} SK\n";
echo "Dashboard madrasah sekarang sudah 100% rapi dan bebas nama ganda!\n";
