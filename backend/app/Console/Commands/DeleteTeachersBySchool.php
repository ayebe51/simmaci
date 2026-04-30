<?php

namespace App\Console\Commands;

use App\Models\School;
use App\Models\Teacher;
use Illuminate\Console\Command;

class DeleteTeachersBySchool extends Command
{
    protected $signature = 'teachers:delete-by-school
                            {school_name : Partial or full school name to search}
                            {--force : Skip confirmation prompt}';

    protected $description = 'Delete all teachers (soft delete) from a specific school by name';

    public function handle(): int
    {
        $schoolName = $this->argument('school_name');

        // Find matching schools
        $schools = School::where('nama', 'like', "%{$schoolName}%")->get(['id', 'nama', 'nsm']);

        if ($schools->isEmpty()) {
            $this->error("No school found matching: \"{$schoolName}\"");
            return self::FAILURE;
        }

        if ($schools->count() > 1) {
            $this->warn("Multiple schools found matching \"{$schoolName}\":");
            $this->table(['ID', 'Nama', 'NSM'], $schools->map(fn ($s) => [$s->id, $s->nama, $s->nsm])->toArray());
            $this->error('Please use a more specific name to match exactly one school.');
            return self::FAILURE;
        }

        $school = $schools->first();

        // Count teachers to be deleted
        $teacherCount = Teacher::where('school_id', $school->id)->count();

        $this->info("School found: [{$school->id}] {$school->nama}");
        $this->info("Teachers to delete: {$teacherCount}");

        if ($teacherCount === 0) {
            $this->warn('No teachers found for this school. Nothing to delete.');
            return self::SUCCESS;
        }

        if (! $this->option('force')) {
            if (! $this->confirm("Are you sure you want to delete all {$teacherCount} teachers from \"{$school->nama}\"?")) {
                $this->info('Aborted.');
                return self::SUCCESS;
            }
        }

        // Perform soft delete
        $deleted = Teacher::where('school_id', $school->id)->delete();

        $this->info("Successfully deleted {$deleted} teachers from \"{$school->nama}\".");

        return self::SUCCESS;
    }
}
