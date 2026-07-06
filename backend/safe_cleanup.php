<?php

use App\Models\SkDocument;
use Illuminate\Support\Facades\DB;

echo "=== MENGHAPUS SK GANDA DENGAN METODE SCORING (AMAN) ===\n\n";

// Mengambil semua SK yang aktif
$allSks = SkDocument::withoutGlobalScopes()->whereNull('deleted_at')->get();

// Mengelompokkan berdasarkan school_id dan NAMA GURU
// Menggunakan strtolower(trim()) agar case-insensitive
$groupedSks = $allSks->groupBy(function($sk) {
    // Kita pecah nama dan gelar (ambil bagian nama saja jika ada koma)
    $bareName = trim(explode(',', $sk->nama)[0]);
    return $sk->school_id . '|' . strtolower($bareName);
});

$totalDeleted = 0;
$totalGroupsCleaned = 0;

foreach ($groupedSks as $groupKey => $sksInGroup) {
    // Jika jumlah SK <= 1, tidak ada ganda. Lanjut.
    if ($sksInGroup->count() <= 1) {
        continue;
    }
    
    // Memberikan skor pada masing-masing SK
    $scoredSks = [];
    foreach ($sksInGroup as $sk) {
        $score = 0;
        
        // 1. Nomor SK Asli (+100 poin)
        if (strpos($sk->nomor_sk, 'REQ') !== 0 && strpos($sk->nomor_sk, 'DRAFT') !== 0) {
            $score += 100;
        }
        
        // 2. Status (+50 poin)
        if (in_array($sk->status, ['approved', 'active', 'published'])) {
            $score += 50;
        }
        
        // 3. Revisi Admin (+30 poin)
        if (!empty($sk->revision_data)) {
            $score += 30;
        }
        
        // 4. Ada file pendukung (+10 poin)
        if (!empty($sk->file_url)) {
            $score += 10;
        }
        
        // 5. Data jabatan (+5 poin)
        if (!empty($sk->jabatan)) $score += 5;
        if (!empty($sk->tugas_mengajar)) $score += 5;
        
        $scoredSks[] = [
            'sk' => $sk,
            'score' => $score,
            // Kita butuh timestamp untuk tie-breaker (pilih yang terlama atau terbaru?)
            // Jika skornya sama persis (misal sama-sama masih kosong & REQ),
            // kita pertahankan yang terbaru di-upload.
            'time' => strtotime($sk->created_at)
        ];
    }
    
    // Mengurutkan berdasarkan:
    // 1. Skor (Descending - paling tinggi di atas)
    // 2. Waktu Upload (Descending - paling baru di atas jika skor sama)
    usort($scoredSks, function($a, $b) {
        if ($a['score'] === $b['score']) {
            return $b['time'] <=> $a['time'];
        }
        return $b['score'] <=> $a['score'];
    });
    
    // SK di urutan 0 adalah sang "Pemenang" yang paling lengkap
    $winner = $scoredSks[0]['sk'];
    $winnerScore = $scoredSks[0]['score'];
    
    // SK lainnya kita hapus (Soft Delete)
    $deletedCountForThisGroup = 0;
    for ($i = 1; $i < count($scoredSks); $i++) {
        $loser = $scoredSks[$i]['sk'];
        $loserScore = $scoredSks[$i]['score'];
        
        $loser->delete();
        $totalDeleted++;
        $deletedCountForThisGroup++;
    }
    
    if ($deletedCountForThisGroup > 0) {
        $totalGroupsCleaned++;
        echo "✅ " . $winner->nama . " (Skor: {$winnerScore}) DIPERTAHANKAN.\n";
        echo "   -> {$deletedCountForThisGroup} pengajuan ganda lainnya dihapus ke tong sampah.\n";
    }
}

echo "\n===============================================\n";
echo "PEMBERSIHAN SELESAI!\n";
echo "Total Guru yang dibersihkan pengajuan gandanya : {$totalGroupsCleaned}\n";
echo "Total SK Kosong/Ganda yang berhasil dihapus    : {$totalDeleted}\n";
