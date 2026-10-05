<?php
/**
 * Standalone CLI Script untuk Perbaikan Satminkal SMP Ma'arif NU 1 Wanareja
 * Bisa dijalankan langsung via: php fix_satminkal_wanareja.php [--dry-run|--apply]
 */

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\School;
use App\Models\Teacher;
use App\Models\SkDocument;
use Illuminate\Support\Facades\DB;

$isApply = in_array('--apply', $argv);
$fromText = "SMP Ma'arif NU 1 Wanareja";
$toText = "SMP Ma'arif NU 01 Wanareja";

// Cek apakah ada filter IDs
$specificIds = null;
foreach ($argv as $arg) {
    if (str_starts_with($arg, '--ids=')) {
        $specificIds = explode(',', substr($arg, 6));
    }
}

echo "======================================================================\n";
echo " SINKRONISASI SATMINKAL GURU SIMMACI (STANDALONE RUNNER)\n";
echo "======================================================================\n";
echo "Satminkal Lama : {$fromText}\n";
echo "Satminkal Baru : {$toText}\n";
echo "Mode           : " . ($isApply ? "[EKSEKUSI / APPLY]" : "[DRY RUN / PREVIEW]") . "\n";
echo "======================================================================\n\n";

// 1. Cek master school
$targetSchool = School::withoutGlobalScopes()
    ->whereNull('deleted_at')
    ->whereRaw("LOWER(REPLACE(REPLACE(nama, '''', ''), '’', '')) = 'smp maarif nu 01 wanareja'")
    ->first();

$oldSchool = School::withoutGlobalScopes()
    ->whereNull('deleted_at')
    ->whereRaw("LOWER(REPLACE(REPLACE(nama, '''', ''), '’', '')) = 'smp maarif nu 1 wanareja'")
    ->first();

$targetSchoolId = $targetSchool?->id ?: $oldSchool?->id;

if ($targetSchool) {
    echo "✓ Ditemukan sekolah target: [ID: {$targetSchool->id}] {$targetSchool->nama}\n";
} elseif ($oldSchool) {
    echo "✓ Ditemukan sekolah lama di master: [ID: {$oldSchool->id}] {$oldSchool->nama}\n";
    echo "  (Akan di-rename menjadi '{$toText}')\n";
} else {
    echo "⚠️ Master sekolah belum ditemukan, mencari SMP di Wanareja...\n";
    $fallback = School::withoutGlobalScopes()
        ->whereNull('deleted_at')
        ->whereRaw('LOWER(kecamatan) LIKE ?', ['%wanareja%'])
        ->whereRaw('LOWER(nama) LIKE ?', ['%smp%'])
        ->first();
    if ($fallback) {
        $targetSchoolId = $fallback->id;
        echo "✓ Menggunakan fallback sekolah: [ID: {$fallback->id}] {$fallback->nama}\n";
    }
}

// 2. Query Guru
$query = Teacher::withoutGlobalScopes()->whereNull('deleted_at');
if ($specificIds) {
    $query->whereIn('id', array_map('intval', $specificIds));
} else {
    $query->where(function ($q) use ($oldSchool) {
        $q->whereRaw("LOWER(REPLACE(REPLACE(unit_kerja, '''', ''), '’', '')) LIKE '%smp maarif nu 1 wanareja%'")
          ->orWhereRaw("LOWER(unit_kerja) LIKE '%smp%nu 1 wanareja%'");
        if ($oldSchool) {
            $q->orWhere('school_id', $oldSchool->id);
        }
    });
}

$teachers = $query->get();

if ($teachers->isEmpty()) {
    echo "\n⚠️ Tidak ada guru yang ditemukan dengan satminkal '{$fromText}'.\n";
    exit(0);
}

echo "\nDitemukan " . $teachers->count() . " guru:\n";
echo str_repeat("-", 80) . "\n";
printf("%-6s | %-30s | %-18s | %-10s\n", "ID", "Nama Guru", "Satminkal Saat Ini", "School ID");
echo str_repeat("-", 80) . "\n";

$teacherIds = [];
foreach ($teachers as $t) {
    $teacherIds[] = $t->id;
    printf("%-6s | %-30s | %-18s | %-10s\n", $t->id, substr($t->nama, 0, 30), substr($t->unit_kerja, 0, 18), $t->school_id ?: '-');
}
echo str_repeat("-", 80) . "\n";

// 3. Query SK
$skQuery = SkDocument::withoutGlobalScopes()
    ->whereNull('deleted_at')
    ->where(function ($q) use ($teacherIds) {
        $q->whereIn('teacher_id', $teacherIds)
          ->orWhereRaw("LOWER(REPLACE(REPLACE(unit_kerja, '''', ''), '’', '')) LIKE '%smp maarif nu 1 wanareja%'");
    });
$skCount = $skQuery->count();
echo "Dokumen SK terkait yang akan diupdate: {$skCount} dokumen.\n\n";

if (!$isApply) {
    echo "⚠️ Ini adalah simulasi (DRY-RUN). Tidak ada data yang diubah.\n";
    echo "Jalankan perintah berikut untuk mengeksekusi ke database:\n";
    echo "  php fix_satminkal_wanareja.php --apply\n\n";
    exit(0);
}

// 4. Eksekusi
DB::beginTransaction();
try {
    if (!$targetSchool && $oldSchool) {
        $oldSchool->nama = $toText;
        $oldSchool->save();
        echo "✓ Master school ID {$oldSchool->id} diubah namanya menjadi '{$toText}'.\n";
    }

    $tCount = 0;
    foreach ($teachers as $t) {
        $t->unit_kerja = $toText;
        if ($targetSchoolId) {
            $t->school_id = $targetSchoolId;
        }
        if (empty($t->kecamatan)) {
            $t->kecamatan = 'Wanareja';
        }
        $t->save();
        $tCount++;
    }
    echo "✓ Berhasil memperbarui {$tCount} data guru.\n";

    $sks = $skQuery->get();
    $sCount = 0;
    foreach ($sks as $sk) {
        $sk->unit_kerja = $toText;
        if ($targetSchoolId) {
            $sk->school_id = $targetSchoolId;
        }
        $sk->save();
        $sCount++;
    }
    if ($sCount > 0) {
        echo "✓ Berhasil memperbarui {$sCount} data SK.\n";
    }

    DB::commit();
    echo "\n✅ TRANSAKSI BERHASIL DISIMPAN KE DATABASE!\n";
} catch (\Throwable $e) {
    DB::rollBack();
    echo "\n❌ ERROR: " . $e->getMessage() . "\n";
    echo "Transaksi telah dibatalkan (ROLLBACK).\n";
    exit(1);
}
