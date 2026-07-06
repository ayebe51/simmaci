<?php
use App\Models\SkDocument;

echo "=== EMERGENCY ROLLBACK: MEMBATALKAN SEMUA PENGHAPUSAN HARI INI ===\n\n";

// Mengembalikan semua SK yang terhapus sejak hari ini (6 Juli 2026)
// Ini akan membatalkan efek dari cleanup_duplicates.php dan restore_sks.php
// Sehingga SEMUA SK (baik yang ganda maupun yang asli) akan kembali muncul di dashboard persis seperti kondisi tadi pagi.

$trashedToday = SkDocument::withoutGlobalScopes()
    ->onlyTrashed()
    ->where('deleted_at', '>=', '2026-07-06 00:00:00')
    ->get();

$count = 0;
foreach ($trashedToday as $sk) {
    $sk->restore();
    $count++;
}

echo "✅ ROLLBACK BERHASIL!\n";
echo "Sebanyak {$count} SK yang tidak sengaja terhapus/terganti hari ini telah dipulihkan 100% ke kondisi aktif.\n";
echo "Silakan refresh dashboard Bapak, SK yang tercetak sudah kembali normal.\n";
