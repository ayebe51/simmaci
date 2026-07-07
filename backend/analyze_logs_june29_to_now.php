<?php
use App\Models\ActivityLog;
use Illuminate\Support\Facades\DB;
use App\Models\User;

echo "=== ANALISA LOG AKTIVITAS (29 JUNI - SEKARANG) ===\n\n";

$logs = ActivityLog::with('causer')
    ->where('subject_type', 'App\Models\SkDocument')
    ->where('event', 'updated')
    ->whereDate('created_at', '>=', '2026-06-29')
    ->orderBy('created_at', 'asc')
    ->get();

$changesByDateAndCauser = [];

foreach ($logs as $log) {
    $date = $log->created_at->format('Y-m-d');
    
    // Tentukan siapa pelakunya
    $causer = "SYSTEM / COMMAND";
    if ($log->causer) {
        $causer = $log->causer->email ?? ("User ID: " . $log->causer_id);
    }
    
    // Hanya pedulikan perubahan pada kolom 'nama'
    $props = $log->properties;
    if (isset($props['old']['nama']) && isset($props['new']['nama'])) {
        $oldName = $props['old']['nama'];
        $newName = $props['new']['nama'];
        
        if ($oldName !== $newName) {
            $key = $date . " | Oleh: " . $causer;
            
            if (!isset($changesByDateAndCauser[$key])) {
                $changesByDateAndCauser[$key] = [];
            }
            
            $changesByDateAndCauser[$key][] = [
                'sk_id' => $log->subject_id,
                'old' => $oldName,
                'new' => $newName,
                'time' => $log->created_at->format('H:i:s')
            ];
        }
    }
}

foreach ($changesByDateAndCauser as $key => $changes) {
    echo "========================================================\n";
    echo "📅 TANGGAL & PELAKU : {$key}\n";
    echo "Total Perubahan Nama SK: " . count($changes) . " SK\n";
    echo "========================================================\n";
    
    // Tampilkan 10 contoh pertama dari grup ini
    $samples = array_slice($changes, 0, 10);
    foreach ($samples as $c) {
        echo "   - [{$c['time']}] SK ID {$c['sk_id']} : '{$c['old']}'  ==>  '{$c['new']}'\n";
    }
    if (count($changes) > 10) {
        echo "   ... dan " . (count($changes) - 10) . " lainnya.\n";
    }
    echo "\n";
}
