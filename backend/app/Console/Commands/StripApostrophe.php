<?php

namespace App\Console\Commands;

use App\Models\Student;
use App\Models\Teacher;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class StripApostrophe extends Command
{
    protected $signature = 'data:strip-apostrophe
                            {--dry-run : Preview changes without saving}
                            {--model= : Only process specific model: teacher or student}';

    protected $description = 'Strip leading apostrophe from numeric fields (NUPTK, NIK, NISN, NIP, phone) caused by Excel export';

    public function handle(): int
    {
        $dryRun = $this->option('dry-run');
        $model  = $this->option('model');

        if ($dryRun) {
            $this->warn('DRY RUN — tidak ada perubahan yang disimpan.');
        }

        if (!$model || $model === 'teacher') {
            $this->processTeachers($dryRun);
        }

        if (!$model || $model === 'student') {
            $this->processStudents($dryRun);
        }

        $this->info('Selesai.');
        return self::SUCCESS;
    }

    private function processTeachers(bool $dryRun): void
    {
        $this->info('Memproses tabel teachers...');

        $fields = ['nuptk', 'nip', 'phone_number', 'nomor_induk_maarif'];
        $fixed  = 0;

        Teacher::withoutTenantScope()
            ->whereRaw("(nuptk LIKE '''%' OR nip LIKE '''%' OR phone_number LIKE '''%' OR nomor_induk_maarif LIKE '''%')")
            ->chunkById(200, function ($teachers) use ($fields, $dryRun, &$fixed) {
                foreach ($teachers as $teacher) {
                    $changes = [];
                    foreach ($fields as $field) {
                        $original = $teacher->$field;
                        if (is_string($original) && str_starts_with($original, "'")) {
                            $cleaned = ltrim($original, "'");
                            $changes[$field] = ['from' => $original, 'to' => $cleaned];
                        }
                    }

                    if (empty($changes)) continue;

                    $this->line("  Teacher ID {$teacher->id} ({$teacher->nama}):");
                    foreach ($changes as $field => $diff) {
                        $this->line("    {$field}: '{$diff['from']}' → '{$diff['to']}'");
                    }

                    if (!$dryRun) {
                        $teacher->update(array_map(fn($d) => $d['to'], $changes));
                    }

                    $fixed++;
                }
            });

        // Also fix: NIM stored in NUPTK column (9-digit, starts with 1134)
        $nimInNuptk = 0;
        Teacher::withoutTenantScope()
            ->whereNotNull('nuptk')
            ->whereRaw("nuptk ~ '^1134[0-9]{5}$'") // PostgreSQL regex
            ->chunkById(200, function ($teachers) use ($dryRun, &$nimInNuptk) {
                foreach ($teachers as $teacher) {
                    $this->line("  [NIM-in-NUPTK] Teacher ID {$teacher->id} ({$teacher->nama}): nuptk='{$teacher->nuptk}' → move to nomor_induk_maarif");
                    if (!$dryRun) {
                        $nim = $teacher->nuptk;
                        $teacher->nuptk = null;
                        if (empty($teacher->nomor_induk_maarif)) {
                            $teacher->nomor_induk_maarif = $nim;
                        }
                        $teacher->saveQuietly();
                    }
                    $nimInNuptk++;
                }
            });

        // Also fix: non-numeric text in nomor_induk_maarif (e.g. "Non PNS", "PNS")
        $badNim = 0;
        Teacher::withoutTenantScope()
            ->whereNotNull('nomor_induk_maarif')
            ->whereRaw("nomor_induk_maarif !~ '^[0-9]+$'") // PostgreSQL: not purely numeric
            ->chunkById(200, function ($teachers) use ($dryRun, &$badNim) {
                foreach ($teachers as $teacher) {
                    $this->line("  [Bad NIM] Teacher ID {$teacher->id} ({$teacher->nama}): nomor_induk_maarif='{$teacher->nomor_induk_maarif}' → cleared");
                    if (!$dryRun) {
                        $teacher->nomor_induk_maarif = null;
                        $teacher->saveQuietly();
                    }
                    $badNim++;
                }
            });

        $this->info("  → {$fixed} apostrop diperbaiki, {$nimInNuptk} NIM dipindah dari NUPTK, {$badNim} NIM tidak valid dibersihkan" . ($dryRun ? ' (dry run)' : '') . '.');
    }

    private function processStudents(bool $dryRun): void
    {
        $this->info('Memproses tabel students...');

        $fields = ['nisn', 'nik', 'nomor_telepon'];
        $fixed  = 0;

        Student::withoutTenantScope()
            ->whereRaw("(nisn LIKE '''%' OR nik LIKE '''%' OR nomor_telepon LIKE '''%')")
            ->chunkById(200, function ($students) use ($fields, $dryRun, &$fixed) {
                foreach ($students as $student) {
                    $changes = [];
                    foreach ($fields as $field) {
                        $original = $student->$field;
                        if (is_string($original) && str_starts_with($original, "'")) {
                            $cleaned = ltrim($original, "'");
                            $changes[$field] = ['from' => $original, 'to' => $cleaned];
                        }
                    }

                    if (empty($changes)) continue;

                    $this->line("  Student ID {$student->id} ({$student->nama}):");
                    foreach ($changes as $field => $diff) {
                        $this->line("    {$field}: '{$diff['from']}' → '{$diff['to']}'");
                    }

                    if (!$dryRun) {
                        $student->update(array_map(fn($d) => $d['to'], $changes));
                    }

                    $fixed++;
                }
            });

        $this->info("  → {$fixed} record siswa diperbaiki" . ($dryRun ? ' (dry run)' : '') . '.');
    }
}
