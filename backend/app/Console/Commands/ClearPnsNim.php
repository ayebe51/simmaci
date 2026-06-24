<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Teacher;

class ClearPnsNim extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'nim:clear-pns';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Mereset NIM milik guru dengan status PNS';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info("Mencari guru berstatus PNS yang memiliki NIM...");

        $query = Teacher::withoutTenantScope()
            ->whereNotNull('nomor_induk_maarif')
            ->where('nomor_induk_maarif', '!=', '')
            ->whereRaw("LOWER(status) LIKE '%pns%'");

        $count = $query->count();

        if ($count === 0) {
            $this->info('Tidak ada guru berstatus PNS yang memiliki NIM.');
            return;
        }

        $this->info("Daftar Guru PNS yang memiliki NIM:");
        $teachers = $query->with('school')->get();
        foreach ($teachers as $t) {
            $sekolah = $t->school ? $t->school->nama : 'Unknown';
            $this->line("- {$t->nomor_induk_maarif} : {$t->nama} ({$sekolah})");
        }

        if ($this->confirm("Reset {$count} NIM di atas menjadi kosong?")) {
            $query->update(['nomor_induk_maarif' => null]);
            $this->info("Berhasil mereset {$count} NIM guru PNS.");
        } else {
            $this->info('Dibatalkan.');
        }
    }
}
