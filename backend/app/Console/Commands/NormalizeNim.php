<?php

namespace App\Console\Commands;

use App\Models\Teacher;
use App\Services\NormalizationService;
use Illuminate\Console\Command;

class NormalizeNim extends Command
{
    protected $signature = 'normalize:nim
                            {--dry-run : Preview changes without saving}
                            {--chunk=200 : Number of records to process per batch}';

    protected $description = 'Normalize NIM (Nomor Induk Maarif) — strip dots, dashes, spaces from existing records';

    public function __construct(private NormalizationService $normalizationService)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $dryRun = $this->option('dry-run');
        $chunk  = (int) $this->option('chunk');

        $this->info($dryRun ? '🔍 DRY RUN — no changes will be saved.' : '✏️  Normalizing NIM values...');

        $fixed   = 0;
        $skipped = 0;
        $errors  = 0;

        // Only process teachers whose NIM contains non-digit characters
        $driver = \DB::connection()->getDriverName();
        $query = Teacher::withoutTenantScope()->whereNotNull('nomor_induk_maarif');

        if ($driver === 'pgsql') {
            $query->whereRaw("nomor_induk_maarif ~ '[^0-9]'"); // has non-digit chars
        } else {
            $query->whereRaw("nomor_induk_maarif GLOB '*[^0-9]*'"); // SQLite
        }
        $query->chunkById($chunk, function ($teachers) use ($dryRun, &$fixed, &$skipped, &$errors) {
                foreach ($teachers as $teacher) {
                    $original   = $teacher->nomor_induk_maarif;
                    $normalized = $this->normalizationService->normalizeNim($original);

                    if ($normalized === null || $normalized === $original) {
                        $skipped++;
                        continue;
                    }

                    // Check for duplicate after normalization
                    $duplicate = Teacher::withoutTenantScope()
                        ->where('nomor_induk_maarif', $normalized)
                        ->where('id', '!=', $teacher->id)
                        ->first();

                    if ($duplicate) {
                        $this->warn("  ⚠ SKIP (duplicate): [{$teacher->id}] {$teacher->nama} — '{$original}' → '{$normalized}' already used by [{$duplicate->id}] {$duplicate->nama}");
                        $errors++;
                        continue;
                    }

                    $this->line("  ✓ [{$teacher->id}] {$teacher->nama}: '{$original}' → '{$normalized}'");

                    if (!$dryRun) {
                        $teacher->nomor_induk_maarif = $normalized;
                        $teacher->saveQuietly(); // skip model events / audit log for bulk fix
                    }

                    $fixed++;
                }
            });

        $this->newLine();
        $this->info("Done. Fixed: {$fixed} | Skipped (already clean): {$skipped} | Errors (duplicates): {$errors}");

        if ($dryRun && $fixed > 0) {
            $this->comment('Run without --dry-run to apply changes.');
        }

        return self::SUCCESS;
    }
}
