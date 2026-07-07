<?php
use App\Models\ActivityLog;
use App\Models\SkDocument;
use Illuminate\Support\Facades\DB;

echo "=== MEMULIHKAN NAMA SK YANG TERTUKAR (MESIN WAKTU) ===\n\n";

$logs = ActivityLog::where('subject_type', SkDocument::class)
    ->where('event', 'updated')
    ->where('description', 'like', '%Updated SkDocument%')
    ->orderBy('created_at', 'desc')
    ->get();

$recoveredCount = 0;
$skippedCount = 0;

function getBareName($name) {
    // Ambil bagian sebelum koma pertama (buang gelar)
    $bare = trim(explode(',', $name)[0]);
    // Hapus karakter khusus dan ubah ke huruf kecil
    $bare = strtolower(preg_replace('/[^a-zA-Z\s]/', '', $bare));
    // Hapus spasi ganda
    return trim(preg_replace('/\s+/', ' ', $bare));
}

DB::beginTransaction();
try {
    foreach ($logs as $log) {
        $props = $log->properties;
        
        if (isset($props['old']['nama']) && isset($props['new']['nama'])) {
            $oldName = $props['old']['nama'];
            $newName = $props['new']['nama'];
            
            if ($oldName !== $newName) {
                $bareOld = getBareName($oldName);
                $bareNew = getBareName($newName);
                
                // Jika nama dasarnya berbeda jauh (bukan sekadar tambah gelar / perbaikan typo ringan)
                // Kita anggap sebagai "Tertukar" jika tidak saling mengandung dan jarak stringnya jauh
                $isCompletelyDifferent = false;
                
                if (strpos($bareNew, $bareOld) === false && strpos($bareOld, $bareNew) === false) {
                    $levenshtein = levenshtein($bareOld, $bareNew);
                    $maxLength = max(strlen($bareOld), strlen($bareNew));
                    // Jika perbedaan lebih dari 50% dari panjang string, berarti beda orang
                    if ($maxLength > 0 && ($levenshtein / $maxLength) > 0.4) {
                        $isCompletelyDifferent = true;
                    }
                }
                
                if ($isCompletelyDifferent) {
                    $sk = SkDocument::withoutGlobalScopes()->find($log->subject_id);
                    // Pastikan SK masih ada dan namanya belum dibetulkan
                    if ($sk && $sk->nama === $newName) {
                        echo "🔄 MEMULIHKAN SK ID: {$sk->id}\n";
                        echo "   [DARI]  : {$newName}\n";
                        echo "   [MENJADI]: {$oldName}\n";
                        
                        $sk->nama = $oldName;
                        // Putuskan hubungan teacher_id karena ini pasti nyasar
                        $sk->teacher_id = null;
                        $sk->save();
                        $recoveredCount++;
                    }
                } else {
                    $skippedCount++;
                }
            }
        }
    }
    DB::commit();
    echo "\n===============================================\n";
    echo "✅ SELESAI!\n";
    echo "Total SK yang namanya berhasil dipulihkan & diputus dari guru nyasar: {$recoveredCount}\n";
    echo "Total perubahan wajar (tambah gelar/typo) yang dibiarkan: {$skippedCount}\n";
} catch (\Exception $e) {
    DB::rollBack();
    echo "❌ GAGAL: " . $e->getMessage() . "\n";
}
