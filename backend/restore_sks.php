<?php

use App\Models\SkDocument;

echo "=== MENGEMBALIKAN SK YANG SEBELUMNYA LENGKAP ===\n\n";

$trashedSks = SkDocument::withoutGlobalScopes()->onlyTrashed()->get();
$restoredCount = 0;
$deletedBadCount = 0;

foreach ($trashedSks as $trashedSk) {
    // Cari SK Aktif yang mengambil alih posisinya (teacher_id sama)
    $activeSk = SkDocument::withoutGlobalScopes()
        ->where('teacher_id', $trashedSk->teacher_id)
        ->whereNull('deleted_at')
        ->first();
        
    if (!$activeSk) {
        continue;
    }

    $shouldRestore = false;

    // KRITERIA 1: SK lama punya Nomor SK Asli, SK baru cuma REQ/DRAFT
    $trashedHasRealNomor = (strpos($trashedSk->nomor_sk, 'REQ') !== 0 && strpos($trashedSk->nomor_sk, 'DRAFT') !== 0);
    $activeHasFakeNomor = (strpos($activeSk->nomor_sk, 'REQ') === 0 || strpos($activeSk->nomor_sk, 'DRAFT') === 0);
    
    if ($trashedHasRealNomor && $activeHasFakeNomor) {
        $shouldRestore = true;
    }

    // KRITERIA 2: SK lama statusnya sudah diproses, SK baru masih pending
    if (in_array($trashedSk->status, ['approved', 'active', 'published']) && in_array($activeSk->status, ['pending', 'draft'])) {
        $shouldRestore = true;
    }

    // KRITERIA 3: SK lama punya hasil editan Admin (revision_data), SK baru masih perawan/kosong
    if (!empty($trashedSk->revision_data) && empty($activeSk->revision_data)) {
        $shouldRestore = true;
    }

    // KRITERIA 4: Jika SK lama punya jabatan/unit_kerja yang lebih lengkap
    if (empty($activeSk->jabatan) && !empty($trashedSk->jabatan)) {
        $shouldRestore = true;
    }

    if ($shouldRestore) {
        // Hapus SK yang jelek/kosong
        $activeSk->delete();
        $deletedBadCount++;
        
        // Pulihkan SK yang bagus/lengkap
        $trashedSk->restore();
        $restoredCount++;
        
        echo "✅ RESTORED: {$trashedSk->nama} | Nomor SK Dikembalikan: {$trashedSk->nomor_sk} (Menggantikan: {$activeSk->nomor_sk})\n";
    }
}

echo "\n============================================\n";
echo "Total SK Lengkap yang berhasil dipulihkan : {$restoredCount}\n";
echo "Total SK Kosong yang dihapus sebagai ganti: {$deletedBadCount}\n";
echo "Selesai!\n";
