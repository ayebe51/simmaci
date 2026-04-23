<?php

namespace App\Console\Commands;

use App\Models\Teacher;
use App\Services\NormalizationService;
use Illuminate\Console\Command;

class NormalizeTeacherNames extends Command
{
    protected $signature = 'data:normalize-teacher-names
                            {--dry-run : Preview changes without saving}
                            {--limit= : Limit number of records to process}';

    protected $description = 'Re-normalize teacher names to fix attached degrees (e.g. MAFTUHSAG → MAFTUH, S.Ag.)';

    public function __construct(private NormalizationService $normalizationService)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $dryRun = $this->option('dry-run');
        $limit  = $this->option('limit') ? (int) $this->option('limit') : null;

        if ($dryRun) {
            $this->warn('DRY RUN — tidak ada perubahan yang disimpan.');
        }

        $fixed   = 0;
        $skipped = 0;

        $query = Teacher::withoutTenantScope()->orderBy('id');
        if ($limit) {
            $query->limit($limit);
        }

        $query->chunkById(200, function ($teachers) use ($dryRun, &$fixed, &$skipped) {
            foreach ($teachers as $teacher) {
                $original   = $teacher->nama;
                $normalized = $this->normalizationService->normalizeTeacherName($original);

                if ($original === $normalized) {
                    $skipped++;
                    continue;
                }

                $this->line("  ID {$teacher->id}: '{$original}' → '{$normalized}'");

                if (!$dryRun) {
                    $teacher->update(['nama' => $normalized]);
                }

                $fixed++;
            }
        });

        $this->info("→ {$fixed} nama dinormalisasi, {$skipped} tidak berubah" . ($dryRun ? ' (dry run)' : '') . '.');
        return self::SUCCESS;
    }
}
