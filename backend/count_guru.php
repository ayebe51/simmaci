<?php
use App\Models\Teacher;

echo "=== MENGHITUNG DATA GURU (MADRASAH JAM'IYYAH) ===\n\n";

$count = Teacher::whereHas('school', function ($q) {
    // Kita asumsikan field-nya status_jamiyyah atau status
    $q->where('status_jamiyyah', 'Jam\'iyyah')
      ->orWhere('status_jamiyyah', 'jamiyyah')
      ->orWhere('status_jamiyyah', 'JAMIYYAH')
      ->orWhere('status', 'Jam\'iyyah')
      ->orWhere('status', 'jamiyyah');
})->count();

$totalAll = Teacher::count();

echo "Total seluruh guru di database: " . $totalAll . "\n";
echo "Total guru di madrasah berstatus Jam'iyyah: " . $count . "\n";
