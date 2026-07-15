<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\School;
use App\Models\Teacher;

echo "=== MEMULAI NORMALISASI KECAMATAN & KABUPATEN ===\n\n";

function normalizeLocation($text, $type) {
    if (empty(trim($text))) return $text;
    // Ubah ke Title Case terlebih dahulu
    $text = trim($text);
    // Hapus prefix
    if ($type === 'kecamatan') {
        $text = preg_replace('/^(Kecamatan|Kec\.|Kec)\s*/i', '', $text);
    } elseif ($type === 'kabupaten') {
        $text = preg_replace('/^(Kabupaten|Kab\.|Kab)\s*/i', '', $text);
    }
    // Ubah ke Title Case lagi untuk memastikan rapi
    return ucwords(strtolower(trim($text)));
}

$updatedSchools = 0;
School::withoutGlobalScopes()->chunk(100, function ($schools) use (&$updatedSchools) {
    foreach ($schools as $school) {
        $changes = [];
        
        $newKec = normalizeLocation($school->kecamatan, 'kecamatan');
        if ($school->kecamatan !== $newKec) {
            $school->kecamatan = $newKec;
            $changes['kecamatan'] = $newKec;
        }
        
        $newKab = normalizeLocation($school->kabupaten, 'kabupaten');
        if ($school->kabupaten !== $newKab) {
            $school->kabupaten = $newKab;
            $changes['kabupaten'] = $newKab;
        }
        
        if (count($changes) > 0) {
            $school->save();
            $updatedSchools++;
            echo "✅ [School ID: {$school->id}] {$school->nama} -> " . json_encode($changes) . "\n";
        }
    }
});
echo "\nTotal Sekolah Diperbarui: $updatedSchools\n\n";

$updatedTeachers = 0;
Teacher::withoutGlobalScopes()->chunk(200, function ($teachers) use (&$updatedTeachers) {
    foreach ($teachers as $teacher) {
        $changes = [];
        
        $newKec = normalizeLocation($teacher->kecamatan, 'kecamatan');
        if ($teacher->kecamatan !== $newKec) {
            $changes['kecamatan'] = $newKec;
        }
        
        $newKab = normalizeLocation($teacher->kabupaten, 'kabupaten');
        if ($teacher->kabupaten !== $newKab) {
            $changes['kabupaten'] = $newKab;
        }
        
        if (count($changes) > 0) {
            Teacher::withoutGlobalScopes()->where('id', $teacher->id)->update($changes);
            $updatedTeachers++;
            echo "✅ [Teacher ID: {$teacher->id}] {$teacher->nama} -> " . json_encode($changes) . "\n";
        }
    }
});

echo "\nTotal Guru Diperbarui: $updatedTeachers\n";
echo "\n=== NORMALISASI SELESAI ===\n";
