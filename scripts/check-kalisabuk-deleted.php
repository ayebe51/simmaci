<?php
/**
 * SIMMACI - Cek Data Guru Terhapus & Dokumen SK untuk MI Ma'arif NU 01 Kalisabuk
 *
 * Jalankan:
 * 1. Di lokal/VPS:
 *    php scripts/check-kalisabuk-deleted.php
 *
 * 2. Di Docker container:
 *    docker exec -i $(docker ps -qf "name=backend") php scripts/check-kalisabuk-deleted.php
 *
 * 3. Via Artisan:
 *    php artisan teachers:check-deleted-sk --school="Kalisabuk"
 */

$autoloadPaths = [
    __DIR__ . '/../backend/vendor/autoload.php',
    __DIR__ . '/vendor/autoload.php',
    dirname(__DIR__) . '/backend/vendor/autoload.php',
];

$autoloadFound = false;
foreach ($autoloadPaths as $path) {
    if (file_exists($path)) {
        require $path;
        $autoloadFound = true;
        break;
    }
}

if (! $autoloadFound) {
    echo "❌ Error: vendor/autoload.php tidak ditemukan.\n";
    exit(1);
}

$appPaths = [
    __DIR__ . '/../backend/bootstrap/app.php',
    __DIR__ . '/bootstrap/app.php',
    dirname(__DIR__) . '/backend/bootstrap/app.php',
];

$app = null;
foreach ($appPaths as $path) {
    if (file_exists($path)) {
        $app = require_once $path;
        break;
    }
}

if (! $app) {
    echo "❌ Error: bootstrap/app.php tidak ditemukan.\n";
    exit(1);
}

$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\School;
use App\Models\SkDocument;
use App\Models\Teacher;

echo "\n";
echo "=======================================================================\n";
echo "  CEK GURU TERHAPUS & STATUS DOKUMEN SK — MI MA'ARIF NU 01 KALISABUK   \n";
echo "=======================================================================\n\n";

$schoolKeyword = 'Kalisabuk';

$schools = School::withTrashed()
    ->where(function ($q) use ($schoolKeyword) {
        $q->where('nama', 'like', "%{$schoolKeyword}%")
          ->orWhere('nama', 'ilike', "%{$schoolKeyword}%");
    })
    ->get();

if ($schools->isEmpty()) {
    echo "❌ Sekolah dengan keyword '{$schoolKeyword}' tidak ditemukan di database.\n";
    exit(1);
}

$schoolIds = $schools->pluck('id')->toArray();
$schoolNames = $schools->pluck('nama')->toArray();

echo "• Sekolah yang ditemukan di database:\n";
foreach ($schools as $s) {
    $status = $s->deleted_at ? "[TERHAPUS: {$s->deleted_at}]" : "[AKTIF]";
    echo "  - [ID {$s->id}] {$s->nama} | NPSN: {$s->npsn} | Kec: {$s->kecamatan} {$status}\n";
}
echo "\n";

// 1. Ambil guru aktif vs guru terhapus
$activeTeachers = Teacher::withoutTenantScope()
    ->where(function ($q) use ($schoolIds, $schoolNames, $schoolKeyword) {
        $q->whereIn('school_id', $schoolIds)
          ->orWhere(function ($sub) use ($schoolNames, $schoolKeyword) {
              foreach ($schoolNames as $name) {
                  $sub->orWhere('unit_kerja', 'like', "%{$name}%");
              }
              $sub->orWhere('unit_kerja', 'like', "%{$schoolKeyword}%");
          });
    })
    ->get();

$deletedTeachers = Teacher::withoutTenantScope()
    ->onlyTrashed()
    ->where(function ($q) use ($schoolIds, $schoolNames, $schoolKeyword) {
        $q->whereIn('school_id', $schoolIds)
          ->orWhere(function ($sub) use ($schoolNames, $schoolKeyword) {
              foreach ($schoolNames as $name) {
                  $sub->orWhere('unit_kerja', 'like', "%{$name}%");
              }
              $sub->orWhere('unit_kerja', 'like', "%{$schoolKeyword}%");
          });
    })
    ->get();

echo "• Total Guru Aktif di Kalisabuk        : " . $activeTeachers->count() . " guru\n";
echo "• Total Guru TERHAPUS di Kalisabuk      : " . $deletedTeachers->count() . " guru\n\n";

// 2. Cek apakah ada guru terhapus yang punya SK
$deletedWithSk = [];
$deletedWithoutSk = [];

foreach ($deletedTeachers as $dt) {
    $sks = SkDocument::withoutTenantScope()
        ->withTrashed()
        ->where(function ($q) use ($dt, $schoolIds) {
            $q->where('teacher_id', $dt->id)
              ->orWhere(function ($sub) use ($dt, $schoolIds) {
                  $sub->whereRaw('LOWER(TRIM(nama)) = ?', [strtolower(trim($dt->nama))])
                      ->whereIn('school_id', $schoolIds);
              });
        })
        ->get();

    $dt->sk_items = $sks;

    if ($sks->isNotEmpty()) {
        $deletedWithSk[] = $dt;
    } else {
        $deletedWithoutSk[] = $dt;
    }
}

// 3. Cek seluruh dokumen SK yang terdaftar di Kalisabuk
$allSks = SkDocument::withoutTenantScope()
    ->withTrashed()
    ->where(function ($q) use ($schoolIds, $schoolKeyword) {
        $q->whereIn('school_id', $schoolIds)
          ->orWhere('unit_kerja', 'like', "%{$schoolKeyword}%");
    })
    ->get();

echo "───────────────────────────────────────────────────────────────────────\n";
echo "  HASIL ANALISIS DOKUMEN SK:\n";
echo "───────────────────────────────────────────────────────────────────────\n";
echo "• Total Dokumen SK di Kalisabuk         : " . $allSks->count() . " dokumen\n";
echo "• Guru Terhapus yang MEMILIKI SK         : " . count($deletedWithSk) . " guru\n";
echo "• Guru Terhapus TANPA SK                 : " . count($deletedWithoutSk) . " guru\n";
echo "───────────────────────────────────────────────────────────────────────\n\n";

if (count($deletedWithSk) > 0) {
    echo "=======================================================================\n";
    echo "⚠️  PERINGATAN: DITEMUKAN " . count($deletedWithSk) . " GURU TERHAPUS YANG MEMILIKI DOKUMEN SK!\n";
    echo "=======================================================================\n";

    foreach ($deletedWithSk as $dt) {
        echo "• ID Guru: {$dt->id} | {$dt->nama} | NUPTK: " . ($dt->nuptk ?: '-') . " | NIM: " . ($dt->nomor_induk_maarif ?: '-') . "\n";
        echo "  Dihapus pada : {$dt->deleted_at}\n";
        echo "  Unit Kerja   : {$dt->unit_kerja}\n";
        echo "  Dokumen SK   :\n";
        foreach ($dt->sk_items as $sk) {
            $st = $sk->deleted_at ? "[SK Terhapus]" : "[Status: {$sk->status}]";
            echo "    - SK ID #{$sk->id} | Nomor: {$sk->nomor_sk} | Jenis: {$sk->jenis_sk} {$st}\n";
        }
        echo "\n";
    }

    echo "💡 Cara Memulihkan Guru Tersebut via Artisan:\n";
    echo "   php artisan teachers:check-deleted-sk --school=\"Kalisabuk\" --restore\n\n";
} elseif ($deletedTeachers->isNotEmpty()) {
    echo "ℹ️  Ada " . $deletedTeachers->count() . " guru berstatus terhapus, tetapi TIDAK ADA yang memiliki dokumen SK.\n\n";
} else {
    echo "✅ TIDAK ADA data guru dari Kalisabuk yang terhapus di database. Semua guru aktif.\n\n";
}

echo "=======================================================================\n";
