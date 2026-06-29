<?php

namespace App\Console\Commands;

use App\Models\SkDocument;
use App\Models\Teacher;
use App\Services\NormalizationService;
use Illuminate\Console\Command;

class NormalizeSkNames extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'sk:normalize-names 
                            {--model=all : Model yang akan dinormalisasi (pengajuan, teacher, all)}
                            {--school= : Filter by school_id}
                            {--dry-run : Preview changes without saving}
                            {--limit= : Limit processing}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Normalisasi nama pada pengajuan SK dan data guru (untuk generator SK)';

    public function __construct(private NormalizationService $normalizationService)
    {
        parent::__construct();
    }

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $model = $this->option('model');
        $dryRun = $this->option('dry-run');
        $schoolId = $this->option('school');
        $limit = $this->option('limit') ? (int) $this->option('limit') : null;

        if ($dryRun) {
            $this->warn('DRY RUN — tidak ada perubahan yang disimpan ke database.');
            $this->newLine();
        }

        $totalFixed = 0;
        $totalSkipped = 0;

        // Pengajuan SK (SkDocument)
        if (in_array($model, ['pengajuan', 'all'])) {
            $this->info('── Memproses Pengajuan SK (SkDocument) ──');
            
            $query = SkDocument::withoutTenantScope()->orderBy('id');
            if ($schoolId) {
                $query->where('school_id', $schoolId);
            }
            if ($limit) {
                $query->limit($limit);
            }

            $fixed = 0;
            $skipped = 0;

            $query->chunkById(200, function ($documents) use ($dryRun, &$fixed, &$skipped) {
                foreach ($documents as $doc) {
                    $original = $doc->nama;
                    if (empty(trim($original))) {
                        $skipped++;
                        continue;
                    }

                    $normalized = $this->normalizationService->normalizeTeacherName($original);
                    if ($original === $normalized) {
                        $skipped++;
                        continue;
                    }

                    $this->line("  [Pengajuan SK] ID {$doc->id}: '<fg=red>{$original}</>' → '<fg=green>{$normalized}</>'");
                    if (!$dryRun) {
                        $doc->update(['nama' => $normalized]);
                    }
                    $fixed++;
                }
            });

            $this->info("✓ Pengajuan SK: {$fixed} diperbaiki, {$skipped} dilewati.");
            $this->newLine();
            
            $totalFixed += $fixed;
            $totalSkipped += $skipped;
        }

        // Generator SK relies heavily on Teacher records
        if (in_array($model, ['teacher', 'all'])) {
            $this->info('── Memproses Data Guru untuk Generator SK (Teacher) ──');
            
            $query = Teacher::withoutTenantScope()->orderBy('id');
            if ($schoolId) {
                $query->where('school_id', $schoolId);
            }
            if ($limit) {
                $query->limit($limit);
            }

            $fixed = 0;
            $skipped = 0;

            $query->chunkById(200, function ($teachers) use ($dryRun, &$fixed, &$skipped) {
                foreach ($teachers as $teacher) {
                    $original = $teacher->nama;
                    if (empty(trim($original))) {
                        $skipped++;
                        continue;
                    }

                    $normalized = $this->normalizationService->normalizeTeacherName($original);
                    if ($original === $normalized) {
                        $skipped++;
                        continue;
                    }

                    $this->line("  [Teacher] ID {$teacher->id}: '<fg=red>{$original}</>' → '<fg=green>{$normalized}</>'");
                    if (!$dryRun) {
                        $teacher->update(['nama' => $normalized]);
                    }
                    $fixed++;
                }
            });

            $this->info("✓ Data Guru: {$fixed} diperbaiki, {$skipped} dilewati.");
            $this->newLine();
            
            $totalFixed += $fixed;
            $totalSkipped += $skipped;
        }

        $this->info("Selesai! Total {$totalFixed} nama berhasil dinormalisasi.");
        return self::SUCCESS;
    }
}
