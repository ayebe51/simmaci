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

        // Get all schools
        $schools = School::all();
        $this->info("Found {$schools->count()} schools in system");

        // Get all corrupt teachers (those with mismatched unit_kerja and school_id)
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
            
            // Check if teacher's unit_kerja matches their current school
            if ($this->schoolNameMatches($teacher->unit_kerja, $currentSchool->nama)) {
                $alreadyCorrectCount++;
                continue;
            }

            // Try to find matching school by unit_kerja
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
                $this->line("ID: {$teacher->id} | {$teacher->nama}");
                $this->line("  NUPTK: {$teacher->nuptk}");
                $this->line("  Unit Kerja: {$teacher->unit_kerja}");
                $this->line("  Current School ID: {$teacher->school_id} ({$currentSchool?->nama ?? 'DELETED'})");
                $this->line("");
            }
        }

        return 0;
    }

    /**
     * Check if unit_kerja name matches school name
     */
    private function schoolNameMatches(string $unitKerja, string $schoolName): bool
    {
        $unitKerjaLower = strtolower($unitKerja);
        $schoolNameLower = strtolower($schoolName);

        // Exact match
        if ($unitKerjaLower === $schoolNameLower) {
            return true;
        }

        // Partial match (school name is contained in unit_kerja or vice versa)
        if (strpos($unitKerjaLower, $schoolNameLower) !== false || 
            strpos($schoolNameLower, $unitKerjaLower) !== false) {
            return true;
        }

        return false;
    }

    /**
     * Find matching school by unit_kerja using fuzzy matching
     */
    private function findMatchingSchool(string $unitKerja, $schools): ?School
    {
        $unitKerjaLower = strtolower($unitKerja);
        $bestMatch = null;
        $bestScore = 0;

        foreach ($schools as $school) {
            $schoolNameLower = strtolower($school->nama);
            
            // Exact match - highest priority
            if ($unitKerjaLower === $schoolNameLower) {
                return $school;
            }

            // Check if school name is contained in unit_kerja
            if (strpos($unitKerjaLower, $schoolNameLower) !== false) {
                $score = strlen($schoolNameLower) / strlen($unitKerjaLower);
                if ($score > $bestScore) {
                    $bestScore = $score;
                    $bestMatch = $school;
                }
            }

            // Check if unit_kerja is contained in school name
            if (strpos($schoolNameLower, $unitKerjaLower) !== false) {
                $score = strlen($unitKerjaLower) / strlen($schoolNameLower);
                if ($score > $bestScore) {
                    $bestScore = $score;
                    $bestMatch = $school;
                }
            }

            // Levenshtein distance for fuzzy matching
            $distance = levenshtein($unitKerjaLower, $schoolNameLower);
            $maxLen = max(strlen($unitKerjaLower), strlen($schoolNameLower));
            $similarity = 1 - ($distance / $maxLen);

            // If similarity is high enough (>70%), consider it a match
            if ($similarity > 0.7 && $similarity > $bestScore) {
                $bestScore = $similarity;
                $bestMatch = $school;
            }
        }

        // Only return match if score is reasonably high
        return ($bestScore > 0.6) ? $bestMatch : null;
    }
}
