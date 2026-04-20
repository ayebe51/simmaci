<?php

namespace App\Console\Commands;

use App\Models\ActivityLog;
use App\Models\School;
use App\Models\SkDocument;
use App\Models\Teacher;
use Illuminate\Console\Command;

class FixMissingUnitKerja extends Command
{
    protected $signature = 'fix:unit-kerja
                            {--dry-run : Preview changes without modifying database}
                            {--batch=500 : Number of records to process per batch}';

    protected $description = 'Fix teachers and SK documents that have school_id but missing/empty unit_kerja';

    public function handle(): int
    {
        $isDryRun = $this->option('dry-run');
        $batchSize = (int) $this->option('batch');

        $this->info('🔧 Fixing missing unit_kerja...');
        $this->info($isDryRun ? '📋 DRY RUN MODE - No changes will be saved' : '✏️  LIVE MODE - Database will be updated');
        $this->newLine();

        // Pre-load all schools into a map for fast lookup
        $schoolMap = School::pluck('nama', 'id')->all();

        $teachersFixed  = $this->fixTeachers($isDryRun, $batchSize, $schoolMap);
        $skDocsFixed    = $this->fixSkDocuments($isDryRun, $batchSize, $schoolMap);

        $this->newLine();
        $this->info('✅ Done!');
        $this->table(
            ['Entity', 'Records Fixed'],
            [
                ['Teachers',     $teachersFixed],
                ['SK Documents', $skDocsFixed],
                ['Total',        $teachersFixed + $skDocsFixed],
            ]
        );

        if (!$isDryRun && ($teachersFixed + $skDocsFixed) > 0) {
            ActivityLog::log(
                description: "fix:unit-kerja — fixed {$teachersFixed} teachers, {$skDocsFixed} SK documents",
                event: 'fix_unit_kerja',
                logName: 'system'
            );
        }

        return Command::SUCCESS;
    }

    private function fixTeachers(bool $isDryRun, int $batchSize, array $schoolMap): int
    {
        $fixed = 0;

        // Only records that have a school_id but unit_kerja is null or empty string
        $query = Teacher::withoutTenantScope()
            ->whereNotNull('school_id')
            ->where(function ($q) {
                $q->whereNull('unit_kerja')
                  ->orWhere('unit_kerja', '');
            });

        $total = $query->count();

        if ($total === 0) {
            $this->line('  ✓ No teachers need fixing.');
            return 0;
        }

        $this->info("👨‍🏫 Fixing {$total} teacher(s) with missing unit_kerja...");
        $bar = $this->output->createProgressBar($total);
        $bar->setFormat(' %current%/%max% [%bar%] %percent:3s%% %elapsed:6s%/%estimated:-6s% %memory:6s%');

        $query->chunk($batchSize, function ($teachers) use (&$fixed, $isDryRun, $schoolMap, $bar) {
            foreach ($teachers as $teacher) {
                $schoolName = $schoolMap[$teacher->school_id] ?? null;

                if ($schoolName === null) {
                    $bar->advance();
                    continue; // school_id points to non-existent school — skip
                }

                if ($isDryRun) {
                    $this->newLine();
                    $this->line("  [Teacher #{$teacher->id}] {$teacher->nama} → unit_kerja = \"{$schoolName}\"");
                } else {
                    Teacher::withoutTenantScope()
                        ->where('id', $teacher->id)
                        ->update(['unit_kerja' => $schoolName]);
                }

                $fixed++;
                $bar->advance();
            }
        });

        $bar->finish();
        $this->newLine();

        return $fixed;
    }

    private function fixSkDocuments(bool $isDryRun, int $batchSize, array $schoolMap): int
    {
        $fixed = 0;

        $query = SkDocument::withoutTenantScope()
            ->whereNotNull('school_id')
            ->where(function ($q) {
                $q->whereNull('unit_kerja')
                  ->orWhere('unit_kerja', '');
            });

        $total = $query->count();

        if ($total === 0) {
            $this->line('  ✓ No SK documents need fixing.');
            return 0;
        }

        $this->info("📄 Fixing {$total} SK document(s) with missing unit_kerja...");
        $bar = $this->output->createProgressBar($total);
        $bar->setFormat(' %current%/%max% [%bar%] %percent:3s%% %elapsed:6s%/%estimated:-6s% %memory:6s%');

        $query->chunk($batchSize, function ($docs) use (&$fixed, $isDryRun, $schoolMap, $bar) {
            foreach ($docs as $doc) {
                $schoolName = $schoolMap[$doc->school_id] ?? null;

                if ($schoolName === null) {
                    $bar->advance();
                    continue;
                }

                if ($isDryRun) {
                    $this->newLine();
                    $this->line("  [SK #{$doc->id}] {$doc->nama} → unit_kerja = \"{$schoolName}\"");
                } else {
                    SkDocument::withoutTenantScope()
                        ->where('id', $doc->id)
                        ->update(['unit_kerja' => $schoolName]);
                }

                $fixed++;
                $bar->advance();
            }
        });

        $bar->finish();
        $this->newLine();

        return $fixed;
    }
}
