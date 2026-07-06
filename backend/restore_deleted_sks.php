<?php

use App\Models\SkDocument;
use Carbon\Carbon;

echo "Memulai proses pembatalan penghapusan (RESTORE) SK yang terhapus hari ini...\n";

// Ambil semua SK yang di-soft-delete dalam 1 jam terakhir
$recentDeletions = SkDocument::onlyTrashed()
    ->where('deleted_at', '>=', Carbon::now()->subHour())
    ->get();

$restoredCount = 0;

foreach ($recentDeletions as $sk) {
    $sk->restore();
    $restoredCount++;
}

echo "✅ BERHASIL MENGEMBALIKAN (RESTORE) {$restoredCount} SK yang tidak sengaja terhapus!\n";
echo "Semua SK Bapak kini sudah kembali ke tempat asalnya.\n";
