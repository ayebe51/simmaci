<?php

namespace App\Console\Commands;

use App\Models\School;
use Illuminate\Console\Command;

class FindUndefinedJamiyyah extends Command
{
    protected $signature = 'school:find-undefined-jamiyyah';
    protected $description = 'Find schools with undefined status_jamiyyah';

    public function handle()
    {
        // First, show all unique status_jamiyyah values
        $uniqueStatuses = School::select('status_jamiyyah')
            ->distinct()
            ->orderBy('status_jamiyyah')
            ->pluck('status_jamiyyah');

        $this->info("All unique status_jamiyyah values in database:");
        foreach ($uniqueStatuses as $status) {
            $count = School::where('status_jamiyyah', $status)->count();
            $displayStatus = $status ?: '(NULL/kosong)';
            $this->line("  - '{$displayStatus}' ({$count} schools)");
        }
        $this->newLine();

        // Find schools with undefined status based on the same logic as DashboardController
        // "undefined" = tidak cocok dengan pattern "jama'ah" atau "jam'iyyah"
        $schools = School::whereRaw("
            CASE
                WHEN LOWER(status_jamiyyah) LIKE '%jama%ah%'
                  OR LOWER(status_jamiyyah) LIKE '%afiliasi%' THEN 'jamaah'
                WHEN LOWER(status_jamiyyah) LIKE '%jam%iyyah%' THEN 'jamiyyah'
                ELSE 'undefined'
            END = 'undefined'
        ")
        ->select('id', 'nama', 'npsn', 'status_jamiyyah', 'jenjang', 'kecamatan')
        ->get();

        $this->info("Found {$schools->count()} schools with undefined status_jamiyyah:");
        $this->newLine();

        foreach ($schools as $school) {
            $this->line("ID: {$school->id}");
            $this->line("Nama: {$school->nama}");
            $this->line("NPSN: {$school->npsn}");
            $this->line("Jenjang: {$school->jenjang}");
            $this->line("Kecamatan: {$school->kecamatan}");
            $this->line("Status Jamiyyah: " . ($school->status_jamiyyah ?: '(NULL/kosong)'));
            $this->newLine();
        }

        return 0;
    }
}
