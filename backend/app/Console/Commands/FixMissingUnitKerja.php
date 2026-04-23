<?php

namespace App\Console\Commands;

use App\Models\Teacher;
use Illuminate\Console\Command;

class FixMissingUnitKerja extends Command
{
    protected $signature = 'data:fix-unit-kerja
                            {--dry-run : Preview changes without saving}';

    protected $description = 'Fill missing/invalid unit_kerja on teachers using their school name (school_id lookup)';

    // Nilai unit_kerja yang dianggap tidak valid dan perlu diperbaiki
    private const INVALID_VALUES = [
        null, '', 'unknown', 'Unknown', 'UNKNOWN',
        '-', 'n/a', 'N/A', 'null', 'NULL', 'undefined',
    ];

    public function handle(): int
    {
        $dryRun = $this->option('dry-run');

        if ($dryRun) {
            $this->warn('DRY RUN — tidak ada perubahan yang disimpan.');
        }

        $fixed   = 0;
        $skipped = 0;

        Teacher::withoutTenantScope()
            ->whereNotNull('school_id')
            ->where(function ($q) {
                $q->whereNull('unit_kerja')
                  ->orWhere('unit_kerja', '')
                  ->orWhereRaw("LOWER(unit_kerja) IN ('unknown', '-', 'n/a', 'null', 'undefined')");
            })
            ->with('school')
            ->chunkById(200, function ($teachers) use ($dryRun, &$fixed, &$skipped) {
                foreach ($teachers as $teacher) {
                    $schoolName = $teacher->school?->nama;

                    if (!$schoolName) {
                        $this->line("  SKIP ID {$teacher->id} ({$teacher->nama}) — school not found");
                        $skipped++;
                        continue;
                    }

                    $old = $teacher->unit_kerja ?? '(null)';
                    $this->line("  ID {$teacher->id} ({$teacher->nama}): '{$old}' → '{$schoolName}'");

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
