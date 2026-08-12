<?php
// Script untuk menghapus data testing SK Kamad di Production
// Cara menjalankan via SSH VPS:
// 1. Masuk ke direktori backend aplikasi Laravel
// 2. Jalankan perintah: php clear_headmaster_testing.php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\HeadmasterTenure;
use Illuminate\Support\Facades\DB;

echo "Memulai proses penghapusan data testing SK Kamad...\n";

try {
    DB::beginTransaction();

    $count = HeadmasterTenure::count();
    
    // Truncate table beserta sequence-nya (jika PostgreSQL akan mereset ID serial)
    // Cascade digunakan untuk memastikan tabel yang berelasi tidak menghalangi truncate,
    // meski headmaster_tenures seharusnya tidak punya relasi child yang membatasi.
    DB::statement('TRUNCATE TABLE headmaster_tenures RESTART IDENTITY CASCADE');

    DB::commit();
    echo "BERHASIL: Sebanyak {$count} data pengajuan SK Kamad telah dihapus dari database produksi.\n";
} catch (\Exception $e) {
    DB::rollBack();
    echo "GAGAL: Terjadi kesalahan saat menghapus data.\n";
    echo "Error: " . $e->getMessage() . "\n";
}
