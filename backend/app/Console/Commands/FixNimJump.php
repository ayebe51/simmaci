<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Teacher;

class FixNimJump extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'nim:fix-jump {--threshold=113410000 : Threshold NIM lompat (default: 113410000)}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Mereset NIM yang melompat jauh (salah ketik) agar bisa di-generate ulang dengan benar';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $threshold = $this->option('threshold');

        $this->info("Mencari NIM yang lebih besar dari atau sama dengan {$threshold}...");

        $query = Teacher::withoutTenantScope()
            ->where('nomor_induk_maarif', 'like', '1134%')
            ->whereRaw("LENGTH(nomor_induk_maarif) = 9")
            ->whereRaw("CAST(nomor_induk_maarif AS BIGINT) >= ?", [$threshold]);

        $count = $query->count();

        if ($count === 0) {
            $this->info('Tidak ada NIM yang lompat (anomali) ditemukan.');
            return;
        }

        $this->info("Daftar Guru dengan NIM anomali:");
        $teachers = $query->get(['nama', 'nomor_induk_maarif']);
        foreach ($teachers as $t) {
            $this->line("- {$t->nomor_induk_maarif} : {$t->nama}");
        }

        if ($this->confirm("Reset {$count} NIM di atas menjadi kosong?")) {
            $query->update(['nomor_induk_maarif' => null]);
            $this->info("Berhasil mereset {$count} NIM. Anda sekarang bisa melakukan Generate NIM ulang.");
        } else {
            $this->info('Dibatalkan.');
        }
    }
}
