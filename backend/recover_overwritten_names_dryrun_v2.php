<?php
use App\Models\ActivityLog;
use App\Models\SkDocument;
use Illuminate\Support\Facades\DB;

echo "=== [DRY RUN V2 - KUNCIAN TANGGAL 4 JULI] MEMULIHKAN NAMA SK YANG TERTUKAR ===\n";
echo "*(Tidak ada data yang benar-benar dirubah di database pada mode ini)*\n\n";

// HANYA ambil log dari tanggal 4 Juli 2026!
$logs = ActivityLog::where('subject_type', SkDocument::class)
    ->where('event', 'updated')
    ->where('description', 'like', '%Updated SkDocument%')
    ->whereDate('created_at', '2026-07-04')
    ->orderBy('created_at', 'asc') // Urutkan dari yang terlama
    ->get();

$recoveredCount = 0;
$skippedCount = 0;
$processedSkIds = [];

function getBareName($name) {
    $bare = trim(explode(',', $name)[0]);
    $bare = strtolower(preg_replace('/[^a-zA-Z\s]/', '', $bare));
    return trim(preg_replace('/\s+/', ' ', $bare));
}

foreach ($logs as $log) {
    if (in_array($log->subject_id, $processedSkIds)) continue;

    $props = $log->properties;
    
    if (isset($props['old']['nama']) && isset($props['new']['nama'])) {
        $oldName = $props['old']['nama'];
        $newName = $props['new']['nama'];
        
        if ($oldName !== $newName) {
            $bareOld = getBareName($oldName);
            $bareNew = getBareName($newName);
            
            $isCompletelyDifferent = false;
            
            if (strpos($bareNew, $bareOld) === false && strpos($bareOld, $bareNew) === false) {
                $levenshtein = levenshtein($bareOld, $bareNew);
                $maxLength = max(strlen($bareOld), strlen($bareNew));
                if ($maxLength > 0 && ($levenshtein / $maxLength) > 0.4) {
                    $isCompletelyDifferent = true;
                }
            }
            
            if ($isCompletelyDifferent) {
                $sk = SkDocument::withoutGlobalScopes()->find($log->subject_id);
                // Cek apakah namanya memang masih salah (belum kembali ke nama asli)
                if ($sk && $sk->nama !== $oldName) {
                    echo "[SIMULASI] 🔄 MEMULIHKAN SK ID: {$sk->id}\n";
                    echo "           [NAMA SAAT INI] : {$sk->nama}\n";
                    echo "           [DIKEMBALIKAN KE]: {$oldName} (Serta memutus tautan dari Guru Nyasar)\n";
                    echo "------------------------------------------------------\n";
                    
                    $processedSkIds[] = $sk->id;
                    $recoveredCount++;
                }
            } else {
                $skippedCount++;
            }
        }
    }
}

echo "\n===============================================\n";
echo "✅ [DRY RUN V2] SELESAI!\n";
echo "Total SK yang namanya AKAN DIPULIHKAN secara akurat: {$recoveredCount}\n";
echo "Total perubahan wajar (tambah gelar/typo) yang DIBIARKAN: {$skippedCount}\n";
