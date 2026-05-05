<?php

namespace App\Console\Commands;

use App\Models\School;
use Illuminate\Console\Command;

class FixCorruptTeacherRecords extends Command
{
    protected $signature = 'fix:corrupt-teachers';
    protected $description = 'Auto-fix corrupt teacher records by matching unit_kerja to schools';

    public function handle()
    {
        $this->info('Starting auto-fix for corrupt teacher records...');

        $schools = School::all();
        $this->info("Found {$schools->count()} schools in system");

        $corruptTeachers = \App\Models\Teacher::withoutTenantScope()
            ->whereNotNull('unit_kerja')
            ->select('id', 'nama', 'unit_kerja', 'school_id')
            ->get();

        $this->info("Checking {$corruptTeachers->count()} teachers for corruption...\n");

        $fixedCount = 0;
        $unfixableCount = 0;
        $alreadyCorrectCount = 0;
        $unfixableTeachers = [];

        foreach ($corruptTeachers as $teacher) {
            $currentSchool = School::find($teacher->school_id);
            
            if ($this->schoolNameMatches($teacher->unit_kerja, $currentSchool->nama)) {
                $alreadyCorrectCount++;
                continue;
            }

            $matchedSchool = $this->findMatchingSchool($teacher->unit_kerja, $schools);

            if ($matchedSchool) {
                $oldSchoolId = $teacher->school_id;
                $teacher->update(['school_id' => $matchedSchool->id]);
                $fixedCount++;
                $this->line("✓ Fixed ID: {$teacher->id} | {$teacher->nama}");
                $this->line("  Unit Kerja: {$teacher->unit_kerja}");
                $this->line("  school_id: {$oldSchoolId} → {$matchedSchool->id} ({$matchedSchool->nama})");
            } else {
                $unfixableCount++;
                $unfixableTeachers[] = $teacher;
            }
        }

        $this->info("\n=== Summary ===");
        $this->info("✓ Fixed: {$fixedCount} teachers");
        $this->info("✓ Already correct: {$alreadyCorrectCount} teachers");
        $this->warn("✗ Unfixable: {$unfixableCount} teachers (no matching school found)");
        $this->info("Total processed: " . ($fixedCount + $alreadyCorrectCount + $unfixableCount));

        if ($unfixableCount > 0) {
            $this->warn("\n=== Unfixable Teachers (Manual Review Needed) ===");
            foreach ($unfixableTeachers as $teacher) {
                $currentSchool = School::find($teacher->school_id);
                $schoolName = $currentSchool ? $currentSchool->nama : 'DELETED';
                $this->line("ID: {$teacher->id} | {$teacher->nama}");
                $this->line("  NUPTK: {$teacher->nuptk}");
                $this->line("  Unit Kerja: {$teacher->unit_kerja}");
                $this->line("  Current School ID: {$teacher->school_id} ({$schoolName})");
                $this->line("");
            }
        }

        return 0;
    }

    private function schoolNameMatches(string $unitKerja, string $schoolName): bool
    {
        $unitKerjaLower = strtolower($unitKerja);
        $schoolNameLower = strtolower($schoolName);

        if ($unitKerjaLower === $schoolNameLower) {
            return true;
        }

        if (strpos($unitKerjaLower, $schoolNameLower) !== false || 
            strpos($schoolNameLower, $unitKerjaLower) !== false) {
            return true;
        }

        return false;
    }

    private function findMatchingSchool(string $unitKerja, $schools)
    {
        $unitKerjaLower = strtolower($unitKerja);
        $bestMatch = null;
        $bestScore = 0;

        foreach ($schools as $school) {
            $schoolNameLower = strtolower($school->nama);
            
            if ($unitKerjaLower === $schoolNameLower) {
                return $school;
            }

            if (strpos($unitKerjaLower, $schoolNameLower) !== false) {
                $score = strlen($schoolNameLower) / strlen($unitKerjaLower);
                if ($score > $bestScore) {
                    $bestScore = $score;
                    $bestMatch = $school;
                }
            }

            if (strpos($schoolNameLower, $unitKerjaLower) !== false) {
                $score = strlen($unitKerjaLower) / strlen($schoolNameLower);
                if ($score > $bestScore) {
                    $bestScore = $score;
                    $bestMatch = $school;
                }
            }

            $distance = levenshtein($unitKerjaLower, $schoolNameLower);
            $maxLen = max(strlen($unitKerjaLower), strlen($schoolNameLower));
            $similarity = 1 - ($distance / $maxLen);

            if ($similarity > 0.7 && $similarity > $bestScore) {
                $bestScore = $similarity;
                $bestMatch = $school;
            }
        }

        return ($bestScore > 0.6) ? $bestMatch : null;
    }
}
