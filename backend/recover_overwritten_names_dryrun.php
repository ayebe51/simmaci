<?php
use App\Models\ActivityLog;
use App\Models\SkDocument;
use Illuminate\Support\Facades\DB;

echo "=== [DRY RUN] MEMULIHKAN NAMA SK YANG TERTUKAR (MESIN WAKTU) ===\n";
echo "*(Tidak ada data yang benar-benar dirubah di database pada mode ini)*\n\n";

$logs = ActivityLog::where('subject_type', SkDocument::class)
    ->where('event', 'updated')
    ->where('description', 'like', '%Updated SkDocument%')
    ->orderBy('created_at', 'desc')
    ->get();

$recoveredCount = 0;
$skippedCount = 0;

function getBareName($name) {
    $bare = trim(explode(',', $name)[0]);
    $bare = strtolower(preg_replace('/[^a-zA-Z\s]/', '', $bare));
    return trim(preg_replace('/\s+/', ' ', $bare));
}

foreach ($logs as $log) {
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
                if ($sk && $sk->nama === $newName) {
                    echo "[SIMULASI] 🔄 MEMULIHKAN SK ID: {$sk->id}\n";
                    echo "           [DARI]  : {$newName}\n";
                    echo "           [MENJADI]: {$oldName} (Serta memutus tautan dari Guru Nyasar)\n";
                    echo "------------------------------------------------------\n";
                    
                    $recoveredCount++;
                }
            } else {
                $skippedCount++;
            }
        }
    }
}

echo "\n===============================================\n";
echo "✅ [DRY RUN] SELESAI!\n";
echo "Total SK yang namanya AKAN DIPULIHKAN & diputus dari guru nyasar: {$recoveredCount}\n";
echo "Total perubahan wajar (tambah gelar/typo) yang DIBIARKAN: {$skippedCount}\n";
