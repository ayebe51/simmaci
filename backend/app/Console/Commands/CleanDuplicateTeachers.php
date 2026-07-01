<?php

namespace App\Console\Commands;

use App\Models\Teacher;
use App\Services\NormalizationService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class CleanDuplicateTeachers extends Command
{
    protected $signature = 'teachers:clean-duplicates
                            {--dry-run : Only show duplicates without deleting}
                            {--school= : Filter by school_id}';

    protected $description = 'Find and soft-delete duplicate teachers with same bare name and school_id. Keeps the record with academic degrees (gelar) in the name.';

    public function handle(NormalizationService $normalizationService): int
    {
        $isDryRun = $this->option('dry-run');
        $schoolFilter = $this->option('school');

        if ($isDryRun) {
            $this->info('🔍 DRY RUN MODE — no records will be deleted.');
        } else {
            if (!$this->confirm('⚠️  This will SOFT-DELETE duplicate teacher records. Continue?')) {
                return self::FAILURE;
            }
        }

        $this->info('Scanning for duplicate teachers (same bare name + school_id)...');
        $this->info('Priority: keep record WITH academic degrees (gelar) in nama.');
        $this->newLine();

        // Find duplicates: group by UPPER(SPLIT_PART(nama, ',', 1)) globally
        $query = DB::table('teachers')
            ->select(
                DB::raw("UPPER(TRIM(SPLIT_PART(nama, ',', 1))) as bare_name"),
                DB::raw('COUNT(*) as cnt')
            )
            ->whereNull('deleted_at')
            ->groupBy(DB::raw("UPPER(TRIM(SPLIT_PART(nama, ',', 1)))"))
            ->having(DB::raw('COUNT(*)'), '>', 1)
            ->orderByDesc('cnt');

        if ($schoolFilter) {
            $query->where('school_id', $schoolFilter);
        }

        $duplicateGroups = $query->get();

        if ($duplicateGroups->isEmpty()) {
            $this->info('✅ No duplicate teachers found!');
            return self::SUCCESS;
        }

        $this->warn("Found {$duplicateGroups->count()} groups of duplicates:");
        $this->newLine();

        $totalDeleted = 0;
        $allDuplicates = [];

        foreach ($duplicateGroups as $group) {
            // Get all teachers in this duplicate group globally
            $teachers = Teacher::withoutTenantScope()
                ->whereNull('deleted_at')
                ->whereRaw("UPPER(TRIM(SPLIT_PART(nama, ',', 1))) = ?", [$group->bare_name])
                ->get();

            if ($teachers->count() <= 1) {
                continue;
            }

            // Sort: prioritize records WITH degrees (has comma = has gelar suffix)
            // Then by identifier completeness, then by most recently updated
            $sorted = $teachers->sortBy(function ($t) use ($normalizationService) {
                $parsed = $normalizationService->parseAcademicDegreesPublic($t->nama);
                $hasDegrees = !empty($parsed['prefix']) || !empty($parsed['suffix']);
                // Also check if nama contains a comma (simple degree indicator)
                $hasComma = str_contains($t->nama, ',');

                // Score: lower = better (keep first)
                $degreeScore = ($hasDegrees || $hasComma) ? 0 : 1;
                $identifierScore = match (true) {
                    !empty($t->nuptk) => 0,
                    !empty($t->nomor_induk_maarif) => 1,
                    !empty($t->nip) => 2,
                    default => 3,
                };
                // Combine: degree presence is most important, then identifiers
                return $degreeScore * 10 + $identifierScore;
            })->values();

            // Keep the first one (has degrees + most complete data)
            $keep = $sorted->first();
            $toDelete = $sorted->slice(1);

            $schoolNameKeep = DB::table('schools')->where('id', $keep->school_id)->value('nama') ?? 'Unknown';

            $this->line("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            $this->info("Bare Name: {$group->bare_name} | Target School: {$schoolNameKeep}");
            $this->line("  ✅ KEEP: ID={$keep->id} | nama=\"{$keep->nama}\" | nuptk={$keep->nuptk} | nim={$keep->nomor_induk_maarif} | nip={$keep->nip}");

            foreach ($toDelete as $dup) {
                $schoolNameDup = DB::table('schools')->where('id', $dup->school_id)->value('nama') ?? 'Unknown';

                // Safety check: only merge if they are in the same school (by ID or Name) OR share the same NUPTK OR NIM
                $sameSchool = $keep->school_id === $dup->school_id;
                $sameSchoolName = strtoupper(trim($schoolNameKeep)) === strtoupper(trim($schoolNameDup)) && $schoolNameKeep !== 'Unknown';
                $sameNuptk = !empty($keep->nuptk) && $keep->nuptk === $dup->nuptk;
                $sameNim = !empty($keep->nomor_induk_maarif) && $keep->nomor_induk_maarif === $dup->nomor_induk_maarif;

                $sameUnitKerja = !empty($keep->unit_kerja) && !empty($dup->unit_kerja) && strtoupper(trim($keep->unit_kerja)) === strtoupper(trim($dup->unit_kerja));

                if (!($sameSchool || $sameSchoolName || $sameUnitKerja || $sameNuptk || $sameNim)) {
                    $this->warn("  ⏭️ SKIP: ID={$dup->id} | School name differs ({$schoolNameDup}) and identifiers don't match.");
                    continue;
                }

                $this->line("  ❌ MERGE & DELETE: ID={$dup->id} | nama=\"{$dup->nama}\" | nuptk={$dup->nuptk} | nim={$dup->nomor_induk_maarif} | nip={$dup->nip} | school={$schoolNameDup}");

                // Migrate ALL relevant fields if keep is missing them
                $fields = [
                    'school_id', 'nuptk', 'nomor_induk_maarif', 'nip',
                    'tempat_lahir', 'tanggal_lahir', 'jenis_kelamin',
                    'pendidikan_terakhir', 'mapel', 'unit_kerja',
                    'status_kepegawaian', 'status', 'tmt',
                    'phone_number', 'email', 'is_certified',
                    'provinsi', 'kabupaten', 'kecamatan', 'kelurahan',
                    'pdpkpnu', 'kta_number',
                    'photo_id', 'surat_permohonan_url',
                    'nomor_surat_permohonan', 'tanggal_surat_permohonan',
                ];
                $merged = [];
                foreach ($fields as $f) {
                    $keepVal = $keep->$f;
                    $dupVal = $dup->$f;
                    // Treat '-', 'null', empty string as empty
                    $keepEmpty = empty($keepVal) || in_array(trim((string)$keepVal), ['-', 'null', 'NULL', 'N/A', '_']);
                    $dupEmpty = empty($dupVal) || in_array(trim((string)$dupVal), ['-', 'null', 'NULL', 'N/A', '_']);

                    if ($keepEmpty && !$dupEmpty) {
                        $keep->$f = $dupVal;
                        $merged[] = "{$f}=\"{$dupVal}\"";
                    }
                }
                if (!empty($merged)) {
                    $this->line("    📋 Merged fields: " . implode(', ', $merged));
                }
                if (!$isDryRun) {
                    $keep->save();
                }

                $allDuplicates[] = [
                    'id' => $dup->id,
                    'nama' => $dup->nama,
                ];

                if (!$isDryRun) {
                    $dup->delete(); // soft-delete
                    $totalDeleted++;
                }
            }
        }

        $this->newLine();
        $this->line("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

        if ($isDryRun) {
            $this->warn("📋 Total duplicates that WOULD be deleted: " . count($allDuplicates));
            $this->info("Run without --dry-run to actually delete them.");
        } else {
            $this->info("🗑️  Soft-deleted {$totalDeleted} duplicate teacher records.");
        }

        return self::SUCCESS;
    }
}
