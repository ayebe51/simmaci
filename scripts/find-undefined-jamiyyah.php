<?php
/**
 * Script untuk mencari sekolah dengan status_jamiyyah "Tidak Terdefinisi"
 * 
 * Jalankan dengan: php scripts/find-undefined-jamiyyah.php
 * Atau dari backend: php artisan tinker < ../scripts/find-undefined-jamiyyah.php
 */

require __DIR__ . '/../backend/vendor/autoload.php';

$app = require_once __DIR__ . '/../backend/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\School;

echo "=== Mencari Sekolah dengan Status Jamiyyah Tidak Terdefinisi ===\n\n";

// Total sekolah
$total = School::count();
echo "Total sekolah di database: {$total}\n\n";

// Tampilkan semua nilai unik status_jamiyyah
echo "Nilai unik status_jamiyyah:\n";
$uniqueStatuses = School::select('status_jamiyyah')
    ->distinct()
    ->orderBy('status_jamiyyah')
    ->get();

foreach ($uniqueStatuses as $item) {
    $status = $item->status_jamiyyah ?: '(NULL/kosong)';
    $count = School::where('status_jamiyyah', $item->status_jamiyyah)->count();
    echo "  - '{$status}' ({$count} sekolah)\n";
}

echo "\n";

// Cari sekolah dengan status "undefined" berdasarkan logika DashboardController
echo "Sekolah dengan status_jamiyyah 'Tidak Terdefinisi':\n";
echo "(tidak cocok dengan pattern 'jama'ah' atau 'jam'iyyah')\n\n";

$schools = School::whereRaw("
    CASE
        WHEN LOWER(status_jamiyyah) LIKE '%jama%ah%'
          OR LOWER(status_jamiyyah) LIKE '%afiliasi%' THEN 'jamaah'
        WHEN LOWER(status_jamiyyah) LIKE '%jam%iyyah%' THEN 'jamiyyah'
        ELSE 'undefined'
    END = 'undefined'
")
->select('id', 'nama', 'npsn', 'status_jamiyyah', 'jenjang', 'kecamatan')
->get();

echo "Ditemukan: {$schools->count()} sekolah\n\n";

foreach ($schools as $school) {
    echo "─────────────────────────────────────────────────────\n";
    echo "ID           : {$school->id}\n";
    echo "Nama         : {$school->nama}\n";
    echo "NPSN         : {$school->npsn}\n";
    echo "Jenjang      : {$school->jenjang}\n";
    echo "Kecamatan    : {$school->kecamatan}\n";
    echo "Status Jamiyyah: " . ($school->status_jamiyyah ?: '(NULL/kosong)') . "\n";
    echo "\n";
}

echo "=== Selesai ===\n";
