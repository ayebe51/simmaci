<?php
use App\Models\Teacher;
use App\Models\ActivityLog;

echo "=== MENCARI DATA ASLI FATHURROHMAN ===\n\n";

$teacher = Teacher::withoutGlobalScopes()->where('nomor_induk_maarif', '113401741')->first();

if (!$teacher) {
    echo "Guru tidak ditemukan.\n";
    exit;
}

$logs = ActivityLog::where('subject_id', $teacher->id)
    ->where('subject_type', Teacher::class)
    ->orderBy('created_at', 'asc')
    ->get();

echo "CURRENT DATA (Saat Ini):\n";
echo "NIM: {$teacher->nomor_induk_maarif}\n";
echo "School ID: {$teacher->school_id}\n";
echo "Nama: {$teacher->nama}\n";
echo "Tempat/Tgl Lahir: {$teacher->tempat_lahir}, {$teacher->tanggal_lahir}\n";
echo "Pendidikan: {$teacher->pendidikan_terakhir}\n";
echo "TMT: {$teacher->tmt}\n\n";

echo "HISTORY PERUBAHAN DATA:\n";
foreach ($logs as $log) {
    echo "Tanggal Perubahan: {$log->created_at}\n";
    echo "Event: {$log->event}\n";
    
    $props = $log->properties;
    if (isset($props['old'])) {
        echo "[DATA SEBELUMNYA]:\n";
        foreach ($props['old'] as $key => $val) {
            echo "  $key: $val\n";
        }
    }
    if (isset($props['attributes']) || isset($props['new'])) {
        $new = $props['attributes'] ?? $props['new'];
        echo "[DATA BARU]:\n";
        foreach ($new as $key => $val) {
            echo "  $key: $val\n";
        }
    }
    echo "---------------------------------\n";
}
