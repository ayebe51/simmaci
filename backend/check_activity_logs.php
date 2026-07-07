<?php
use App\Models\ActivityLog;
use App\Models\SkDocument;

echo "=== MEMERIKSA LOG AKTIVITAS (AUDIT LOGS) UNTUK PEMULIHAN NAMA ===\n\n";

$logs = ActivityLog::where('subject_type', SkDocument::class)
    ->where('event', 'updated')
    ->where('description', 'like', '%Updated SkDocument%')
    ->orderBy('created_at', 'desc')
    ->get();

$recoverableCount = 0;

foreach ($logs as $log) {
    $props = $log->properties;
    
    // Cek apakah ada perubahan nama di properti log
    if (isset($props['old']['nama']) && isset($props['new']['nama'])) {
        $oldName = $props['old']['nama'];
        $newName = $props['new']['nama'];
        
        if ($oldName !== $newName) {
            $skId = $log->subject_id;
            echo "SK ID: {$skId} | Waktu Perubahan: {$log->created_at}\n";
            echo "   Nama Asli (Hilang): {$oldName}\n";
            echo "   Nama Baru (Menimpa): {$newName}\n";
            echo "------------------------------------------------\n";
            $recoverableCount++;
        }
    }
}

echo "Total Nama SK yang tertimpa dan BISA DIPULIHKAN dari Log: {$recoverableCount} data.\n";
