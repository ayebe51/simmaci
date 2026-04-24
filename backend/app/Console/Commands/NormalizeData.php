<?php

namespace App\Console\Commands;

use App\Models\School;
use App\Models\Teacher;
use App\Models\SkDocument;
use App\Models\ActivityLog;
use App\Services\NormalizationService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class NormalizeData extends Command
{
    protected $signature = 'normalize:data 
                            {--dry-run : Preview changes without modifying database}
                            {--batch=500 : Number of records to process per batch}';

    protected $description = 'Normalize existing school and teacher names in the database';

    public function __construct(
        private NormalizationService $normalizationService
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $isDryRun = $this->option('dry-run');
        $batchSize = (int) $this->option('batch');

        $this->info('🚀 Starting data normalization...');
        $this->info($isDryRun ? '📋 DRY RUN MODE - No changes will be saved' : '✏️  LIVE MODE - Database will be updated');
        $this->newLine();

        $stats = [
            'schools_updated' => 0,
            'teachers_updated' => 0,
            'sk_documents_updated' => 0,
            'errors' => [],
        ];

        try {
            // Normalize Schools
            $this->info('📚 Normalizing school names...');
            $stats['schools_updated'] = $this->normalizeSchools($isDryRun, $batchSize);

            // Normalize Teachers
            $this->info('👨‍🏫 Normalizing teacher names...');
            $stats['teachers_updated'] = $this->normalizeTeachers($isDryRun, $batchSize);

            // Normalize SK Documents
            $this->info('📄 Normalizing SK document names...');
            $stats['sk_documents_updated'] = $this->normalizeSkDocuments($isDryRun, $batchSize);

        } catch (\Exception $e) {
            $this->error("Fatal error during normalization: {$e->getMessage()}");
            return Command::FAILURE;
        }

        // Summary
        $this->newLine();
        $this->info('✅ Normalization complete!');
        $this->table(
            ['Entity', 'Records Updated'],
            [
                ['Schools', $stats['schools_updated']],
                ['Teachers', $stats['teachers_updated']],
                ['SK Documents', $stats['sk_documents_updated']],
                ['Total', array_sum(array_filter($stats, 'is_int'))],
            ]
        );

        // Report errors if any
        if (!empty($stats['errors'])) {
            $this->newLine();
            $this->warn('⚠️  Errors encountered during processing:');
            foreach ($stats['errors'] as $error) {
                $this->line("  • {$error}");
            }
        }

        // Create activity log entry
        if (!$isDryRun) {
            try {
                ActivityLog::log(
                    description: "Data normalization completed: {$stats['schools_updated']} schools, {$stats['teachers_updated']} teachers, {$stats['sk_documents_updated']} SK documents updated",
                    event: 'normalize_data',
                    logName: 'system'
                );
            } catch (\Exception $e) {
                $this->warn("Failed to create activity log: {$e->getMessage()}");
            }
        }

        return Command::SUCCESS;
    }

    /**
     * Create detailed activity logs for normalization changes
     */
    private function createNormalizationActivityLogs(array $normalizationLogs, string $entityType): void
    {
        try {
            // Group logs by batches to avoid creating too many individual entries
            $batchSize = 50;
            $batches = array_chunk($normalizationLogs, $batchSize);
            
            foreach ($batches as $batch) {
                $properties = [
                    'entity_type' => $entityType,
                    'changes' => $batch,
                    'batch_size' => count($batch)
                ];
                
                ActivityLog::create([
                    'description' => "Batch normalization: " . count($batch) . " {$entityType} records normalized",
                    'event' => 'batch_normalize_data',
                    'log_name' => 'system',
                    'subject_id' => null,
                    'subject_type' => null,
                    'causer_id' => null,
                    'causer_type' => 'App\Console\Commands\NormalizeData',
                    'school_id' => null,
                    'properties' => $properties,
                ]);
            }
        } catch (\Exception $e) {
            $this->warn("Failed to create detailed normalization logs: {$e->getMessage()}");
        }
    }

    private function normalizeSchools(bool $isDryRun, int $batchSize): int
    {
        $updated = 0;
        $totalSchools = School::count();
        $normalizationLogs = [];
        
        if ($totalSchools === 0) {
            $this->line('  No schools found to normalize.');
            return 0;
        }

        $bar = $this->output->createProgressBar($totalSchools);
        $bar->setFormat(' %current%/%max% [%bar%] %percent:3s%% %elapsed:6s%/%estimated:-6s% %memory:6s%');

        try {
            School::chunk($batchSize, function ($schools) use (&$updated, &$normalizationLogs, $isDryRun, $bar) {
                foreach ($schools as $school) {
                    try {
                        $original = $school->nama;
                        $normalized = $this->normalizationService->normalizeSchoolName($original);

                        if ($original !== $normalized) {
                            if (!$isDryRun) {
                                $school->update(['nama' => $normalized]);
                                
                                // Store normalization details for activity log
                                $normalizationLogs[] = [
                                    'table' => 'schools',
                                    'record_id' => $school->id,
                                    'field' => 'nama',
                                    'original' => $original,
                                    'normalized' => $normalized
                                ];
                            } else {
                                $this->line("  [{$school->id}] {$original} → {$normalized}");
                            }
                            $updated++;
                        }
                    } catch (\Exception $e) {
                        $this->error("Failed to update school {$school->id}: {$e->getMessage()}");
                    }
                    
                    $bar->advance();
                }
            });
            
            // Create detailed activity logs for school normalizations
            if (!$isDryRun && !empty($normalizationLogs)) {
                $this->createNormalizationActivityLogs($normalizationLogs, 'schools');
            }
            
        } catch (\Exception $e) {
            $this->error("Error processing schools: {$e->getMessage()}");
        }

        $bar->finish();
        $this->newLine();

        return $updated;
    }

    private function normalizeTeachers(bool $isDryRun, int $batchSize): int
    {
        $updated = 0;
        $totalTeachers = Teacher::count();
        $normalizationLogs = [];
        
        if ($totalTeachers === 0) {
            $this->line('  No teachers found to normalize.');
            return 0;
        }

        $bar = $this->output->createProgressBar($totalTeachers);
        $bar->setFormat(' %current%/%max% [%bar%] %percent:3s%% %elapsed:6s%/%estimated:-6s% %memory:6s%');

        try {
            Teacher::chunk($batchSize, function ($teachers) use (&$updated, &$normalizationLogs, $isDryRun, $bar) {
                foreach ($teachers as $teacher) {
                    try {
                        $originalName = $teacher->nama;
                        $originalUnit = $teacher->unit_kerja;
                        $originalTempatLahir = $teacher->tempat_lahir;
                        $originalStatus = $teacher->status;
                        
                        $normalizedName = $this->normalizationService->normalizeTeacherName($originalName);
                        $normalizedUnit = $this->normalizationService->normalizeSchoolName($originalUnit);
                        $normalizedTempatLahir = $this->normalizationService->normalizePlaceOfBirth($originalTempatLahir);
                        $tmt = $teacher->tmt ? \Carbon\Carbon::parse($teacher->tmt) : null;
                        $normalizedStatus = $this->normalizationService->normalizeEmploymentStatus($originalStatus, $tmt);

                        $changes = [];
                        $logChanges = [];
                        
                        if ($originalName !== $normalizedName) {
                            $changes['nama'] = $normalizedName;
                            $logChanges[] = [
                                'table' => 'teachers',
                                'record_id' => $teacher->id,
                                'field' => 'nama',
                                'original' => $originalName,
                                'normalized' => $normalizedName
                            ];
                        }
                        if ($originalUnit !== $normalizedUnit) {
                            $changes['unit_kerja'] = $normalizedUnit;
                            $logChanges[] = [
                                'table' => 'teachers',
                                'record_id' => $teacher->id,
                                'field' => 'unit_kerja',
                                'original' => $originalUnit,
                                'normalized' => $normalizedUnit
                            ];
                        }
                        if ($originalTempatLahir !== $normalizedTempatLahir) {
                            $changes['tempat_lahir'] = $normalizedTempatLahir;
                            $logChanges[] = [
                                'table' => 'teachers',
                                'record_id' => $teacher->id,
                                'field' => 'tempat_lahir',
                                'original' => $originalTempatLahir,
                                'normalized' => $normalizedTempatLahir
                            ];
                        }
                        if ($originalStatus !== $normalizedStatus) {
                            $changes['status'] = $normalizedStatus;
                            $logChanges[] = [
                                'table' => 'teachers',
                                'record_id' => $teacher->id,
                                'field' => 'status',
                                'original' => $originalStatus,
                                'normalized' => $normalizedStatus
                            ];
                        }

                        if (!empty($changes)) {
                            if (!$isDryRun) {
                                $teacher->update($changes);
                                $normalizationLogs = array_merge($normalizationLogs, $logChanges);
                            } else {
                                if (isset($changes['nama'])) {
                                    $this->line("  [{$teacher->id}] Name: {$originalName} → {$normalizedName}");
                                }
                                if (isset($changes['unit_kerja'])) {
                                    $this->line("  [{$teacher->id}] Unit: {$originalUnit} → {$normalizedUnit}");
                                }
                                if (isset($changes['status'])) {
                                    $this->line("  [{$teacher->id}] Status: {$originalStatus} → {$normalizedStatus}");
                                }
                            }
                            $updated++;
                        }
                    } catch (\Exception $e) {
                        $this->error("Failed to update teacher {$teacher->id}: {$e->getMessage()}");
                    }
                    
                    $bar->advance();
                }
            });
            
            // Create detailed activity logs for teacher normalizations
            if (!$isDryRun && !empty($normalizationLogs)) {
                $this->createNormalizationActivityLogs($normalizationLogs, 'teachers');
            }
            
        } catch (\Exception $e) {
            $this->error("Error processing teachers: {$e->getMessage()}");
        }

        $bar->finish();
        $this->newLine();

        return $updated;
    }

    private function normalizeSkDocuments(bool $isDryRun, int $batchSize): int
    {
        $updated = 0;
        $totalDocuments = SkDocument::count();
        $normalizationLogs = [];
        
        if ($totalDocuments === 0) {
            $this->line('  No SK documents found to normalize.');
            return 0;
        }

        $bar = $this->output->createProgressBar($totalDocuments);
        $bar->setFormat(' %current%/%max% [%bar%] %percent:3s%% %elapsed:6s%/%estimated:-6s% %memory:6s%');

        try {
            SkDocument::chunk($batchSize, function ($documents) use (&$updated, &$normalizationLogs, $isDryRun, $bar) {
                foreach ($documents as $doc) {
                    try {
                        $originalName = $doc->nama;
                        $originalUnit = $doc->unit_kerja;
                        
                        $normalizedName = $this->normalizationService->normalizeTeacherName($originalName);
                        $normalizedUnit = $this->normalizationService->normalizeSchoolName($originalUnit);

                        $changes = [];
                        $logChanges = [];
                        
                        if ($originalName !== $normalizedName) {
                            $changes['nama'] = $normalizedName;
                            $logChanges[] = [
                                'table' => 'sk_documents',
                                'record_id' => $doc->id,
                                'field' => 'nama',
                                'original' => $originalName,
                                'normalized' => $normalizedName
                            ];
                        }
                        if ($originalUnit !== $normalizedUnit) {
                            $changes['unit_kerja'] = $normalizedUnit;
                            $logChanges[] = [
                                'table' => 'sk_documents',
                                'record_id' => $doc->id,
                                'field' => 'unit_kerja',
                                'original' => $originalUnit,
                                'normalized' => $normalizedUnit
                            ];
                        }

                        if (!empty($changes)) {
                            if (!$isDryRun) {
                                $doc->update($changes);
                                $normalizationLogs = array_merge($normalizationLogs, $logChanges);
                            } else {
                                if (isset($changes['nama'])) {
                                    $this->line("  [{$doc->id}] Name: {$originalName} → {$normalizedName}");
                                }
                                if (isset($changes['unit_kerja'])) {
                                    $this->line("  [{$doc->id}] Unit: {$originalUnit} → {$normalizedUnit}");
                                }
                            }
                            $updated++;
                        }
                    } catch (\Exception $e) {
                        $this->error("Failed to update SK document {$doc->id}: {$e->getMessage()}");
                    }
                    
                    $bar->advance();
                }
            });
            
            // Create detailed activity logs for SK document normalizations
            if (!$isDryRun && !empty($normalizationLogs)) {
                $this->createNormalizationActivityLogs($normalizationLogs, 'sk_documents');
            }
            
        } catch (\Exception $e) {
            $this->error("Error processing SK documents: {$e->getMessage()}");
        }

        $bar->finish();
        $this->newLine();

        return $updated;
    }
}