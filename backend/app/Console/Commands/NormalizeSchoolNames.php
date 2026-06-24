<?php

namespace App\Console\Commands;

use App\Models\School;
use Illuminate\Console\Command;

class NormalizeSchoolNames extends Command
{
    protected $signature = 'schools:normalize-names {--dry-run : Preview changes without saving}';
    protected $description = 'Normalize school names: fix prefix casing (MTs, MI, MA, SMK) and convert ALL CAPS to Title Case';

    public function handle(\App\Services\NormalizationService $normalizationService): int
    {
        $isDryRun = $this->option('dry-run');
        $schools  = School::all();
        $changed  = 0;

        foreach ($schools as $school) {
            $original    = $school->nama;
            $normalized  = $normalizationService->normalizeSchoolName($original);

            if ($original === $normalized) {
                continue;
            }

            $this->line(sprintf(
                "  <fg=yellow>BEFORE:</> %s\n  <fg=green>AFTER: </> %s\n",
                $original,
                $normalized
            ));

            if (! $isDryRun) {
                $school->update(['nama' => $normalized]);
            }

            $changed++;
        }

        $mode = $isDryRun ? '<fg=cyan>[DRY RUN]</>' : '<fg=green>[SAVED]</>';
        $this->info("\n{$mode} {$changed} nama sekolah " . ($isDryRun ? 'akan diubah' : 'berhasil diubah') . " dari {$schools->count()} total.");

        return self::SUCCESS;
    }
}
