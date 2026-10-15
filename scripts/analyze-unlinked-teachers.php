<?php
/**
 * SIMMACI - Script Diagnosa Data Guru yang Tidak Terhubung dengan Sekolah
 *
 * Cara menjalankan:
 * 1. Di lokal/VPS langsung:
 *    php scripts/analyze-unlinked-teachers.php
 *
 * 2. Di dalam Docker container:
 *    docker exec -i $(docker ps -qf "name=backend") php /var/www/html/../scripts/analyze-unlinked-teachers.php
 *    (atau jalankan: bash diagnose-unlinked-teachers.sh)
 *
 * 3. Via Artisan:
 *    cd backend && php artisan teachers:analyze-unlinked --details --match
 */

// Load autoloader dan bootstrap Laravel
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

// Bootstrap Console Kernel
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\School;
use App\Models\Teacher;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

echo "\n";
echo "=======================================================================\n";
echo "   DIAGNOSA DATA GURU TIDAK TERHUBUNG DENGAN SEKOLAH (SIMMACI)         \n";
echo "=======================================================================\n\n";

// 1. Ambil data master sekolah
$activeSchools = School::all(['id', 'nama', 'npsn', 'jenjang', 'kecamatan']);
$deletedSchools = School::onlyTrashed()->get(['id', 'nama', 'deleted_at'])->keyBy('id');
$allSchoolIds = School::withTrashed()->pluck('id')->flip()->toArray();
$activeSchoolMap = $activeSchools->keyBy('id');

$totalTeachers = Teacher::withoutTenantScope()->count();
$totalTeachersWithDeleted = Teacher::withoutTenantScope()->withTrashed()->count();
$totalSchools = $activeSchools->count();

echo "• Total Sekolah Aktif        : {$totalSchools}\n";
echo "• Total Sekolah Soft-Deleted : " . $deletedSchools->count() . "\n";
echo "• Total Guru di Database     : {$totalTeachers} (aktif) / {$totalTeachersWithDeleted} (total termasuk terhapus)\n\n";

if ($totalTeachers === 0) {
    echo "✅ Database kosong atau belum ada data guru yang terdaftar.\n";
    exit(0);
}

// 2. Ambil data guru yang bermasalah relasi
$teachers = Teacher::withoutTenantScope()
    ->select(['id', 'nama', 'nuptk', 'nomor_induk_maarif', 'nip', 'unit_kerja', 'school_id', 'is_active', 'deleted_at'])
    ->get();

$nullWithUnit      = [];
$nullWithoutUnit   = [];
$orphanSchool      = [];
$softDeletedSchool = [];
$nameMismatch      = [];
$normalCount       = 0;

foreach ($teachers as $t) {
    $sid = $t->school_id;
    $unit = trim((string) $t->unit_kerja);
    $hasUnit = $unit !== '' && $unit !== '-' && strtolower($unit) !== 'null';

    // school_id NULL
    if (is_null($sid)) {
        if ($hasUnit) {
            $nullWithUnit[] = $t;
        } else {
            $nullWithoutUnit[] = $t;
        }
        continue;
    }

    // school_id Orphan (tidak ada di tabel schools)
    if (! isset($allSchoolIds[$sid])) {
        $orphanSchool[] = $t;
        continue;
    }

    // school_id mengarah ke sekolah yang di-soft-delete
    if ($deletedSchools->has($sid)) {
        $t->deleted_school = $deletedSchools->get($sid);
        $softDeletedSchool[] = $t;
        continue;
    }

    // Cek mismatch nama sekolah terhubung vs unit_kerja
    if ($activeSchoolMap->has($sid) && $hasUnit) {
        $currentSchool = $activeSchoolMap->get($sid);
        $cleanUnit = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $unit));
        $cleanSch  = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $currentSchool->nama));

        similar_text($cleanUnit, $cleanSch, $pct);
        $isSubstring = str_contains($cleanUnit, $cleanSch) || str_contains($cleanSch, $cleanUnit);

        if ($pct < 35.0 && ! $isSubstring) {
            $t->current_school_name = $currentSchool->nama;
            $t->similarity = round($pct, 1);
            $nameMismatch[] = $t;
            continue;
        }
    }

    $normalCount++;
}

$totalIssues = count($nullWithUnit) + count($nullWithoutUnit) + count($orphanSchool) + count($softDeletedSchool);

echo "───────────────────────────────────────────────────────────────────────\n";
echo "  RINGKASAN TEMUAN RELASI GURU\n";
echo "───────────────────────────────────────────────────────────────────────\n";
printf("  1. Terhubung Normal ke Sekolah Aktif           : %4d guru (%5.1f%%)\n", $normalCount, ($normalCount / $totalTeachers) * 100);
printf("  2. school_id NULL tapi Ada Unit Kerja          : %4d guru (%5.1f%%) [Perlu Dipetakan]\n", count($nullWithUnit), (count($nullWithUnit) / $totalTeachers) * 100);
printf("  3. school_id NULL & Unit Kerja Kosong (Yatim)  : %4d guru (%5.1f%%) [Kritis]\n", count($nullWithoutUnit), (count($nullWithoutUnit) / $totalTeachers) * 100);
printf("  4. school_id Orphan (ID Sekolah Tidak Ada)     : %4d guru (%5.1f%%) [Kritis]\n", count($orphanSchool), (count($orphanSchool) / $totalTeachers) * 100);
printf("  5. school_id Mengarah ke Sekolah Terhapus      : %4d guru (%5.1f%%) [Waspada]\n", count($softDeletedSchool), (count($softDeletedSchool) / $totalTeachers) * 100);
printf("  6. Potensi Mismatch (Unit Kerja ≠ Nama Sekolah): %4d guru (%5.1f%%) [Review]\n", count($nameMismatch), (count($nameMismatch) / $totalTeachers) * 100);
echo "───────────────────────────────────────────────────────────────────────\n";
printf("  TOTAL GURU DENGAN MASALAH RELASI SEKOLAH      : %4d guru\n", $totalIssues);
echo "───────────────────────────────────────────────────────────────────────\n\n";

if ($totalIssues === 0 && count($nameMismatch) === 0) {
    echo "🎉 SEMPURNA: Semua data guru terhubung ke sekolahnya dengan baik!\n\n";
    exit(0);
}

// 3. Tampilkan rincian data
if (! empty($nullWithUnit)) {
    echo "=======================================================================\n";
    echo "▶ GURU DENGAN school_id NULL TAPI MEMILIKI NAMA UNIT KERJA (" . count($nullWithUnit) . " data)\n";
    echo "  (Bisa dicocokkan otomatis dengan master sekolah)\n";
    echo "=======================================================================\n";

    // Matching lookup
    $exactSchoolMap = [];
    foreach ($activeSchools as $s) {
        $norm = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $s->nama));
        $exactSchoolMap[$norm] = $s;
    }

    $sample = array_slice($nullWithUnit, 0, 30);
    foreach ($sample as $t) {
        $cleanUnit = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $t->unit_kerja));
        $sug = 'Belum cocok otomatis (perlu review)';

        if (isset($exactSchoolMap[$cleanUnit])) {
            $s = $exactSchoolMap[$cleanUnit];
            $sug = "EXACT MATCH → [ID: {$s->id}] {$s->nama}";
        } else {
            // fuzzy
            $bestScore = 0;
            $bestSch = null;
            foreach ($activeSchools as $s) {
                $c = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $s->nama));
                similar_text($cleanUnit, $c, $p);
                if ($p > $bestScore) {
                    $bestScore = $p;
                    $bestSch = $s;
                }
            }
            if ($bestScore >= 75) {
                $sug = sprintf("KEMUNGKINAN COCOK (%d%%) → [ID: %d] %s", round($bestScore), $bestSch->id, $bestSch->nama);
            }
        }

        echo "• ID: {$t->id} | {$t->nama} | NUPTK: " . ($t->nuptk ?: '-') . "\n";
        echo "  Unit Kerja : {$t->unit_kerja}\n";
        echo "  Rekomendasi: {$sug}\n\n";
    }

    if (count($nullWithUnit) > 30) {
        echo "  ... dan " . (count($nullWithUnit) - 30) . " guru lainnya.\n\n";
    }
}

if (! empty($nullWithoutUnit)) {
    echo "=======================================================================\n";
    echo "▶ GURU TANPA SEKOLAH DAN TANPA UNIT KERJA / YATIM PIATU (" . count($nullWithoutUnit) . " data)\n";
    echo "=======================================================================\n";
    foreach (array_slice($nullWithoutUnit, 0, 20) as $t) {
        echo "• ID: {$t->id} | {$t->nama} | NUPTK: " . ($t->nuptk ?: '-') . " | NIM: " . ($t->nomor_induk_maarif ?: '-') . "\n";
    }
    if (count($nullWithoutUnit) > 20) {
        echo "  ... dan " . (count($nullWithoutUnit) - 20) . " guru lainnya.\n";
    }
    echo "\n";
}

if (! empty($orphanSchool)) {
    echo "=======================================================================\n";
    echo "▶ GURU DENGAN school_id ORPHAN (ID SEKOLAH HILANG DARI DB) (" . count($orphanSchool) . " data)\n";
    echo "=======================================================================\n";
    foreach ($orphanSchool as $t) {
        echo "• ID: {$t->id} | {$t->nama} | school_id: {$t->school_id} (TIDAK DITEMUKAN) | Unit: {$t->unit_kerja}\n";
    }
    echo "\n";
}

if (! empty($softDeletedSchool)) {
    echo "=======================================================================\n";
    echo "▶ GURU DI SEKOLAH YANG SUDAH TERHAPUS (SOFT-DELETED) (" . count($softDeletedSchool) . " data)\n";
    echo "=======================================================================\n";
    foreach ($softDeletedSchool as $t) {
        $del = $t->deleted_school;
        echo "• ID: {$t->id} | {$t->nama} | Sekolah: [ID {$t->school_id}] {$del->nama} (Dihapus: {$del->deleted_at})\n";
    }
    echo "\n";
}

if (! empty($nameMismatch)) {
    echo "=======================================================================\n";
    echo "▶ POTENSI MISMATCH NAMA UNIT KERJA VS SEKOLAH TERHUBUNG (" . count($nameMismatch) . " data)\n";
    echo "=======================================================================\n";
    foreach (array_slice($nameMismatch, 0, 15) as $t) {
        echo "• ID: {$t->id} | {$t->nama}\n";
        echo "  Unit Kerja Tertera : {$t->unit_kerja}\n";
        echo "  Sekolah Terhubung  : [ID: {$t->school_id}] {$t->current_school_name} (Kemiripan: {$t->similarity}%)\n\n";
    }
}

echo "=======================================================================\n";
echo "SARAN PERBAIKAN CEPAT:\n";
echo "1. Gunakan Artisan Command untuk analisa lebih lengkap + ekspor CSV:\n";
echo "   php artisan teachers:analyze-unlinked --details --match --csv=storage/unlinked_teachers.csv\n\n";
echo "2. Lakukan simulasi auto-link untuk guru yang unit_kerja-nya cocok:\n";
echo "   php artisan teachers:analyze-unlinked --auto-link --dry-run\n\n";
echo "3. Terapkan pemetaan otomatis secara permanen ke database:\n";
echo "   php artisan teachers:analyze-unlinked --auto-link\n";
echo "=======================================================================\n\n";
