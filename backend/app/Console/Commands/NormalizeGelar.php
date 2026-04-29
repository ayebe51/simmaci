<?php

namespace App\Console\Commands;

use App\Models\HeadmasterTenure;
use App\Models\SkDocument;
use App\Models\Teacher;
use App\Services\NormalizationService;
use Illuminate\Console\Command;

class NormalizeGelar extends Command
{
    protected $signature = 'data:normalize-gelar
                            {--model=all : Model yang diproses: teacher, sk-document, headmaster, atau all}
                            {--school= : Filter berdasarkan school_id}
                            {--dry-run : Preview perubahan tanpa menyimpan}
                            {--limit= : Batasi jumlah record yang diproses per model}
                            {--show-unchanged : Tampilkan juga record yang tidak berubah}';

    protected $description = 'Normalisasi gelar akademik pada nama guru di semua model terkait (Teacher, SkDocument, HeadmasterTenure)';

    public function __construct(private NormalizationService $normalizationService)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $dryRun        = $this->option('dry-run');
        $model         = $this->option('model');
        $schoolId      = $this->option('school');
        $limit         = $this->option('limit') ? (int) $this->option('limit') : null;
        $showUnchanged = $this->option('show-unchanged');

        $validModels = ['teacher', 'sk-document', 'headmaster', 'all'];
        if (!in_array($model, $validModels, true)) {
            $this->error("Model tidak valid: '{$model}'. Pilihan: teacher, sk-document, headmaster, all");
            return self::FAILURE;
        }

        if ($dryRun) {
            $this->warn('DRY RUN — tidak ada perubahan yang disimpan.');
            $this->newLine();
        }

        if ($schoolId) {
            $this->line("<fg=cyan>Filter school_id: {$schoolId}</>");
            $this->newLine();
        }

        $totalFixed   = 0;
        $totalSkipped = 0;

        if (in_array($model, ['teacher', 'all'])) {
            [$fixed, $skipped] = $this->processTeachers($dryRun, $schoolId, $limit, $showUnchanged);
            $totalFixed   += $fixed;
            $totalSkipped += $skipped;
        }

        if (in_array($model, ['sk-document', 'all'])) {
            [$fixed, $skipped] = $this->processSkDocuments($dryRun, $schoolId, $limit, $showUnchanged);
            $totalFixed   += $fixed;
            $totalSkipped += $skipped;
        }

        if (in_array($model, ['headmaster', 'all'])) {
            [$fixed, $skipped] = $this->processHeadmasters($dryRun, $schoolId, $limit, $showUnchanged);
            $totalFixed   += $fixed;
            $totalSkipped += $skipped;
        }

        $this->newLine();
        $suffix = $dryRun ? ' (dry run)' : '';
        $this->info("Total: <fg=green>{$totalFixed}</> dinormalisasi, <fg=yellow>{$totalSkipped}</> tidak berubah{$suffix}.");

        return self::SUCCESS;
    }

    /**
     * Proses field nama dan pendidikan_terakhir pada model Teacher.
     *
     * @return array{int, int} [fixed, skipped]
     */
    private function processTeachers(bool $dryRun, ?string $schoolId, ?int $limit, bool $showUnchanged): array
    {
        $this->info('── Teacher (nama + pendidikan_terakhir) ──');

        $fixed   = 0;
        $skipped = 0;

        $query = Teacher::withoutTenantScope()->orderBy('id');

        if ($schoolId) {
            $query->where('school_id', $schoolId);
        }

        if ($limit) {
            $query->limit($limit);
        }

        $query->chunkById(200, function ($teachers) use ($dryRun, $showUnchanged, &$fixed, &$skipped) {
            foreach ($teachers as $teacher) {
                $changes = [];

                // Normalisasi field nama
                $originalNama = $teacher->nama;
                if ($originalNama !== null && trim($originalNama) !== '') {
                    $normalizedNama = $this->normalizationService->normalizeTeacherName($originalNama);
                    if ($originalNama !== $normalizedNama) {
                        $changes['nama'] = ['from' => $originalNama, 'to' => $normalizedNama];
                    } elseif ($showUnchanged) {
                        $this->line("  <fg=gray>ID {$teacher->id} [nama]: '{$originalNama}' (tidak berubah)</>");
                    }
                }

                // Normalisasi field pendidikan_terakhir
                $originalPendidikan = $teacher->pendidikan_terakhir;
                if ($originalPendidikan !== null && trim($originalPendidikan) !== '') {
                    $normalizedPendidikan = $this->normalizePendidikanTerakhir($originalPendidikan);
                    if ($originalPendidikan !== $normalizedPendidikan) {
                        $changes['pendidikan_terakhir'] = ['from' => $originalPendidikan, 'to' => $normalizedPendidikan];
                    } elseif ($showUnchanged) {
                        $this->line("  <fg=gray>ID {$teacher->id} [pendidikan_terakhir]: '{$originalPendidikan}' (tidak berubah)</>");
                    }
                }

                if (!empty($changes)) {
                    foreach ($changes as $field => $diff) {
                        $this->line("  <fg=yellow>ID {$teacher->id}</> [{$field}]: '<fg=red>{$diff['from']}</>' → '<fg=green>{$diff['to']}</>'");
                    }

                    if (!$dryRun) {
                        $teacher->update(array_map(fn($c) => $c['to'], $changes));
                    }

                    $fixed++;
                } else {
                    $skipped++;
                }
            }
        });

        $suffix = $dryRun ? ' (dry run)' : '';
        $this->line("  → <fg=green>{$fixed}</> dinormalisasi, <fg=yellow>{$skipped}</> tidak berubah{$suffix}.");
        $this->newLine();

        return [$fixed, $skipped];
    }

    /**
     * Proses field nama pada model SkDocument.
     * Field ini menyimpan nama guru yang di-denormalisasi saat SK dibuat.
     *
     * @return array{int, int} [fixed, skipped]
     */
    private function processSkDocuments(bool $dryRun, ?string $schoolId, ?int $limit, bool $showUnchanged): array
    {
        $this->info('── SkDocument (nama) ──');

        $fixed   = 0;
        $skipped = 0;

        $query = SkDocument::withoutTenantScope()->orderBy('id');

        if ($schoolId) {
            $query->where('school_id', $schoolId);
        }

        if ($limit) {
            $query->limit($limit);
        }

        $query->chunkById(200, function ($documents) use ($dryRun, $showUnchanged, &$fixed, &$skipped) {
            foreach ($documents as $document) {
                $original = $document->nama;

                if ($original === null || trim($original) === '') {
                    $skipped++;
                    continue;
                }

                $normalized = $this->normalizationService->normalizeTeacherName($original);

                if ($original === $normalized) {
                    $skipped++;
                    if ($showUnchanged) {
                        $this->line("  <fg=gray>ID {$document->id} [nama]: '{$original}' (tidak berubah)</>");
                    }
                    continue;
                }

                $this->line("  <fg=yellow>ID {$document->id}</> [nama]: '<fg=red>{$original}</>' → '<fg=green>{$normalized}</>'");

                if (!$dryRun) {
                    $document->update(['nama' => $normalized]);
                }

                $fixed++;
            }
        });

        $suffix = $dryRun ? ' (dry run)' : '';
        $this->line("  → <fg=green>{$fixed}</> dinormalisasi, <fg=yellow>{$skipped}</> tidak berubah{$suffix}.");
        $this->newLine();

        return [$fixed, $skipped];
    }

    /**
     * Proses field teacher_name pada model HeadmasterTenure.
     *
     * @return array{int, int} [fixed, skipped]
     */
    private function processHeadmasters(bool $dryRun, ?string $schoolId, ?int $limit, bool $showUnchanged): array
    {
        $this->info('── HeadmasterTenure (teacher_name) ──');

        $fixed   = 0;
        $skipped = 0;

        $query = HeadmasterTenure::withoutTenantScope()->orderBy('id');

        if ($schoolId) {
            $query->where('school_id', $schoolId);
        }

        if ($limit) {
            $query->limit($limit);
        }

        $query->chunkById(200, function ($tenures) use ($dryRun, $showUnchanged, &$fixed, &$skipped) {
            foreach ($tenures as $tenure) {
                $original = $tenure->teacher_name;

                if ($original === null || trim($original) === '') {
                    $skipped++;
                    continue;
                }

                $normalized = $this->normalizationService->normalizeTeacherName($original);

                if ($original === $normalized) {
                    $skipped++;
                    if ($showUnchanged) {
                        $this->line("  <fg=gray>ID {$tenure->id} [teacher_name]: '{$original}' (tidak berubah)</>");
                    }
                    continue;
                }

                $this->line("  <fg=yellow>ID {$tenure->id}</> [teacher_name]: '<fg=red>{$original}</>' → '<fg=green>{$normalized}</>'");

                if (!$dryRun) {
                    $tenure->update(['teacher_name' => $normalized]);
                }

                $fixed++;
            }
        });

        $suffix = $dryRun ? ' (dry run)' : '';
        $this->line("  → <fg=green>{$fixed}</> dinormalisasi, <fg=yellow>{$skipped}</> tidak berubah{$suffix}.");
        $this->newLine();

        return [$fixed, $skipped];
    }

    /**
     * Normalisasi nilai pendidikan_terakhir.
     *
     * Nilai ini biasanya berupa singkatan jenjang pendidikan (S1, S2, D3, SMA, dll.)
     * atau kadang gelar akademik yang menempel (SPDSD, AMAPDSD, dll.).
     */
    private function normalizePendidikanTerakhir(string $value): string
    {
        $trimmed = trim($value);

        // Mapping kanonik untuk jenjang pendidikan
        $map = [
            // Strata
            'S1'       => 'S1',
            'S2'       => 'S2',
            'S3'       => 'S3',
            'STRATA1'  => 'S1',
            'STRATA2'  => 'S2',
            'STRATA3'  => 'S3',
            'STRATA 1' => 'S1',
            'STRATA 2' => 'S2',
            'STRATA 3' => 'S3',
            // Diploma
            'D1'       => 'D1',
            'D2'       => 'D2',
            'D3'       => 'D3',
            'D4'       => 'D4',
            'DIII'     => 'D3',
            'DIV'      => 'D4',
            // SMA/sederajat
            'SMA'      => 'SMA',
            'SMK'      => 'SMK',
            'MA'       => 'MA',
            'SLTA'     => 'SLTA',
            'SMP'      => 'SMP',
            'MTS'      => 'MTs',
            'SLTP'     => 'SLTP',
            'SD'       => 'SD',
            'MI'       => 'MI',
        ];

        $key = mb_strtoupper(preg_replace('/[\s.]+/', '', $trimmed), 'UTF-8');

        if (isset($map[$key])) {
            return $map[$key];
        }

        // Jika nilai tidak mengandung spasi, kemungkinan gelar yang menempel
        // (misal "SPDSD", "AMAPDSD"). Coba normalisasi via normalizeTeacherName
        // dan ambil bagian gelarnya saja.
        if (!str_contains($trimmed, ' ')) {
            $asName = $this->normalizationService->normalizeTeacherName($trimmed);
            if ($asName !== $trimmed && str_contains($asName, ',')) {
                $parts = explode(',', $asName, 2);
                return trim($parts[1]);
            }
        }

        return $trimmed;
    }
}
