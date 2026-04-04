<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class ArchiveAttendance extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:archive-attendance {--year= : The year to archive (defaults to previous year)}';

    protected $description = 'Move old attendance records to archives to maintain performance.';

    public function handle()
    {
        $year = $this->option('year') ?: now()->subYear()->year;
        $this->info("Archiving attendance data for year: {$year}...");

        $schools = \App\Models\School::all();

        foreach ($schools as $school) {
            $this->archiveForSchool($school, $year);
        }

        $this->info('Archiving completed successfully.');
    }

    protected function archiveForSchool($school, $year)
    {
        $records = \App\Models\StudentAttendanceLog::where('school_id', $school->id)
            ->whereYear('tanggal', $year)
            ->get();

        if ($records->isEmpty()) {
            return;
        }

        $this->info("- Archiving {$records->count()} logs for school: {$school->nama}");

        // 1. Export to JSON
        $jsonData = $records->toJson();
        $fileName = "archives/attendance/{$school->id}/{$year}_attendance.json";
        \Illuminate\Support\Facades\Storage::disk('local')->put($fileName, $jsonData);

        // 2. Create Archive Entry
        \App\Models\AttendanceArchive::create([
            'school_id' => $school->id,
            'type' => 'student_aggregate',
            'year' => $year,
            'month' => 'ALL',
            'file_url' => $fileName,
            'total_records' => $records->count(),
            'summary_data' => [
                'archived_at' => now()->toDateTimeString(),
                'original_count' => $records->count(),
            ],
            'archived_by' => null, // System
        ]);

        // 3. Delete from main table
        \App\Models\StudentAttendanceLog::where('school_id', $school->id)
            ->whereYear('tanggal', $year)
            ->delete();
    }

}
