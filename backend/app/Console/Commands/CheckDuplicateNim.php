<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class CheckDuplicateNim extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'check:nim-ganda';

    protected $description = 'Cek NIM Ganda';

    public function handle()
    {
        $this->info("=== CEK DUPLIKAT NOMOR INDUK MAARIF (GURU) ===");
        $teacherDups = \App\Models\Teacher::select('nomor_induk_maarif', \Illuminate\Support\Facades\DB::raw('COUNT(*) as count'))
            ->whereNotNull('nomor_induk_maarif')
            ->where('nomor_induk_maarif', '!=', '')
            ->where('nomor_induk_maarif', '!=', '-')
            ->groupBy('nomor_induk_maarif')
            ->havingRaw('COUNT(*) > 1')
            ->get();

        if ($teacherDups->isEmpty()) {
            $this->info("Tidak ditemukan NIM ganda pada data guru.");
        } else {
            foreach ($teacherDups as $dup) {
                $this->warn("- NIM: {$dup->nomor_induk_maarif} ({$dup->count} data)");
                $teachers = \App\Models\Teacher::with('school')->where('nomor_induk_maarif', $dup->nomor_induk_maarif)->get();
                foreach ($teachers as $t) {
                    $schoolName = $t->school ? $t->school->nama : 'Tanpa Sekolah';
                    $this->line("  > [ID: {$t->id}] {$t->nama} - {$schoolName}");
                }
            }
        }
        return 0;
    }
}
