<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Teacher;

class ClearJamaahNim extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'nim:clear-jamaah';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Mereset NIM milik guru yang unit kerjanya berstatus Jama\'ah';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info("Mencari guru dengan NIM di sekolah berstatus Jama'ah...");

        $query = Teacher::withoutTenantScope()
            ->whereNotNull('nomor_induk_maarif')
            ->where('nomor_induk_maarif', '!=', '')
            ->whereHas('school', function ($q) {
                $q->whereRaw("LOWER(status_jamiyyah) LIKE '%jama%ah%'")
                  ->orWhereRaw("LOWER(status_jamiyyah) LIKE '%afiliasi%'");
            });

        $count = $query->count();

        if ($count === 0) {
            $this->info('Tidak ada guru dari sekolah Jama\'ah yang memiliki NIM.');
            return;
        }

        $this->info("Daftar Guru Jama'ah yang memiliki NIM:");
        $teachers = $query->with('school')->get();
        foreach ($teachers as $t) {
            $sekolah = $t->school ? $t->school->nama : 'Unknown';
            $this->line("- {$t->nomor_induk_maarif} : {$t->nama} ({$sekolah})");
        }

        if ($this->confirm("Reset {$count} NIM di atas menjadi kosong?")) {
            $query->update(['nomor_induk_maarif' => null]);
            $this->info("Berhasil mereset {$count} NIM guru Jama'ah.");
        } else {
            $this->info('Dibatalkan.');
        }
    }
}
