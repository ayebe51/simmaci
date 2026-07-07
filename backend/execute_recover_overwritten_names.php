<?php
use App\Models\ActivityLog;
use App\Models\SkDocument;
use Illuminate\Support\Facades\DB;

echo "=== EKSEKUSI FINAL MEMULIHKAN NAMA SK YANG TERTUKAR (MESIN WAKTU) ===\n";

// HANYA ambil log dari tanggal 4 Juli 2026 (hari dimana kerusakan massal terjadi)
$logs = ActivityLog::where('subject_type', SkDocument::class)
    ->where('event', 'updated')
    ->where('description', 'like', '%Updated SkDocument%')
    ->whereDate('created_at', '2026-07-04') // KUNCI PENTING: Jangan ambil log hari ini
    ->orderBy('created_at', 'asc') // Urutkan dari yang terlama agar tidak menimpa perbaikan terbaru
    ->get();

$recoveredCount = 0;
$skippedCount = 0;

function getBareName($name) {
    $bare = trim(explode(',', $name)[0]);
    $bare = strtolower(preg_replace('/[^a-zA-Z\s]/', '', $bare));
    return trim(preg_replace('/\s+/', ' ', $bare));
}

DB::beginTransaction();
try {
    // Lacak SK mana saja yang sudah dipulihkan agar tidak dipulihkan berulang kali jika ada multi-log
    $processedSkIds = [];
    
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
                    
                    // Pastikan SK masih ada. Kita tidak mengecek $sk->nama === $newName lagi
                    // karena mungkin namanya sudah terlanjur diubah lagi oleh skrip lain hari ini,
                    // tapi jika ternyata namanya saat ini MASIH salah (mirip dengan $newName yang salah),
                    // atau belum kembali ke $oldName, kita paksakan kembalikan ke $oldName.
                    if ($sk && $sk->nama !== $oldName) {
                        echo "🔄 MEMULIHKAN SK ID: {$sk->id}\n";
                        echo "           [NAMA SAAT INI] : {$sk->nama}\n";
                        echo "           [DIKEMBALIKAN KE]: {$oldName} (Serta memutus tautan dari Guru Nyasar)\n";
                        echo "------------------------------------------------------\n";
                        
                        $sk->nama = $oldName;
                        $sk->teacher_id = null; // Putuskan hubungan guru nyasar
                        $sk->save();
                        
                        $processedSkIds[] = $sk->id;
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
    echo "Total SK yang namanya BERHASIL DIPULIHKAN & diputus dari guru nyasar: {$recoveredCount}\n";
    echo "Total perubahan wajar (tambah gelar/typo) yang DIBIARKAN: {$skippedCount}\n";
} catch (\Exception $e) {
    DB::rollBack();
    echo "❌ GAGAL: " . $e->getMessage() . "\n";
}
