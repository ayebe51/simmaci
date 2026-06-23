<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Teacher;

class UndoGeneratedNim extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'nim:undo-bulk {--from= : Batas NIM. Semua NIM lebih besar dari batas ini akan di-reset.}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Mereset NIM yang baru saja di-generate secara massal dengan menentukan titik mulai hapus';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $from = $this->option('from');

        if (!$from) {
            $from = $this->ask('Masukkan NIM terakhir yang BENAR (Semua NIM yang angkanya LEBIH BESAR dari ini akan dihapus/direset). Contoh: 113403517');
        }

        if (strlen($from) !== 9) {
            $this->error('Format NIM salah. Harus 9 digit angka.');
            return;
        }

        $query = Teacher::withoutTenantScope()
            ->whereNotNull('nomor_induk_maarif')
            ->where('nomor_induk_maarif', 'like', '1134%')
            ->whereRaw("CAST(nomor_induk_maarif AS BIGINT) > ?", [$from]);

        $count = $query->count();

        if ($count === 0) {
            $this->info("Tidak ada NIM yang lebih besar dari {$from}.");
            return;
        }

        $this->info("Akan mereset {$count} NIM yang angkanya di atas {$from}.");

        if ($this->confirm("Apakah Anda yakin ingin mengosongkan {$count} NIM ini?")) {
            $query->update(['nomor_induk_maarif' => null]);
            $this->info("Berhasil mereset {$count} NIM. Anda sekarang bisa melakukan Generate NIM ulang dengan bersih.");
        } else {
            $this->info('Dibatalkan.');
        }
    }
}
