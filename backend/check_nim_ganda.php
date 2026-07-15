<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Teacher;
use App\Models\School;
use Illuminate\Support\Facades\DB;

echo "=== CEK DUPLIKAT NOMOR INDUK MAARIF (GURU) ===\n";
$teacherDups = Teacher::select('nomor_induk_maarif', DB::raw('COUNT(*) as count'))
    ->whereNotNull('nomor_induk_maarif')
    ->where('nomor_induk_maarif', '!=', '')
    ->where('nomor_induk_maarif', '!=', '-')
    ->groupBy('nomor_induk_maarif')
    ->having('count', '>', 1)
    ->get();

if ($teacherDups->isEmpty()) {
    echo "Tidak ditemukan NIM ganda pada data guru.\n";
} else {
    foreach ($teacherDups as $dup) {
        echo "- NIM: {$dup->nomor_induk_maarif} ({$dup->count} data)\n";
        $teachers = Teacher::where('nomor_induk_maarif', $dup->nomor_induk_maarif)->get(['id', 'nama', 'school_id']);
        foreach ($teachers as $t) {
            $schoolName = $t->school ? $t->school->nama : 'Tanpa Sekolah';
            echo "  > [ID: {$t->id}] {$t->nama} - {$schoolName}\n";
        }
    }
}

echo "\n=== CEK DUPLIKAT KEPALA NIM (SEKOLAH) ===\n";
$schoolDups = School::select('kepala_nim', DB::raw('COUNT(*) as count'))
    ->whereNotNull('kepala_nim')
    ->where('kepala_nim', '!=', '')
    ->where('kepala_nim', '!=', '-')
    ->groupBy('kepala_nim')
    ->having('count', '>', 1)
    ->get();

if ($schoolDups->isEmpty()) {
    echo "Tidak ditemukan NIM ganda pada data sekolah.\n";
} else {
    foreach ($schoolDups as $dup) {
        echo "- Kepala NIM: {$dup->kepala_nim} ({$dup->count} data)\n";
        $schools = School::where('kepala_nim', $dup->kepala_nim)->get(['id', 'nama', 'kepala_madrasah']);
        foreach ($schools as $s) {
            echo "  > [ID: {$s->id}] {$s->nama} (Kepala: {$s->kepala_madrasah})\n";
        }
    }
}
echo "\nSelesai.\n";
