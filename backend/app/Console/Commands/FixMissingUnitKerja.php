<?php

namespace App\Console\Commands;

use App\Models\School;
use App\Models\Teacher;
use Illuminate\Console\Command;

class FixMissingUnitKerja extends Command
{
    protected $signature = 'data:fix-unit-kerja
                            {--dry-run : Preview changes without saving}';

    protected $description = 'Fill missing unit_kerja on teachers using their school name (school_id lookup)';

    public function handle(): int
    {
        $dryRun = $this->option('dry-run');

        if ($dryRun) {
            $this->warn('DRY RUN — tidak ada perubahan yang disimpan.');
        }

        $fixed = 0;
        $skipped = 0;

        Teacher::withoutTenantScope()
            ->whereNull('unit_kerja')
            ->orWhere('unit_kerja', '')
            ->whereNotNull('school_id')
            ->with('school')
            ->chunkById(200, function ($teachers) use ($dryRun, &$fixed, &$skipped) {
                foreach ($teachers as $teacher) {
                    $schoolName = $teacher->school?->nama;

                    if (!$schoolName) {
                        $this->line("  SKIP Teacher ID {$teacher->id} ({$teacher->nama}) — school not found");
                        $skipped++;
                        continue;
                    }

                    $this->line("  Teacher ID {$teacher->id} ({$teacher->nama}): unit_kerja → '{$schoolName}'");

                    if (!$dryRun) {
                        $teacher->update(['unit_kerja' => $schoolName]);
                    }

                    $fixed++;
                }
            });

        $this->info("→ {$fixed} record diperbaiki, {$skipped} dilewati" . ($dryRun ? ' (dry run)' : '') . '.');
        return self::SUCCESS;
    }
}
