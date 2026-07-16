<?php

namespace App\Console\Commands;

use App\Models\Teacher;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Artisan command: nim:reset-range
 *
 * Reset (set ke NULL) semua nomor_induk_maarif yang berada dalam rentang tertentu.
 * Digunakan untuk membatalkan NIM yang terlanjur di-generate sebelum logika
 * gap-fill aktif.
 *
 * Aman dijalankan berkali-kali (idempotent).
 */
class ResetNimRange extends Command
{
    protected $signature = 'nim:reset-range
                            {--from=        : NIM awal range (inklusif), contoh: 113404131}
                            {--to=          : NIM akhir range (inklusif), contoh: 113404141}
                            {--dry-run      : Tampilkan yang akan direset tanpa menyimpan}
                            {--force        : Lewati konfirmasi interaktif}';

    protected $description = 'Reset nomor_induk_maarif ke NULL untuk teacher dalam rentang NIM tertentu';

    public function handle(): int
    {
        $fromNim = $this->option('from');
        $toNim   = $this->option('to');
        $isDry   = $this->option('dry-run');
        $force   = $this->option('force');

        if (!$fromNim || !$toNim) {
            $this->error('Wajib menyertakan --from dan --to. Contoh:');
            $this->line('  php artisan nim:reset-range --from=113404131 --to=113404141');
            return self::FAILURE;
        }

        if (!preg_match('/^1134\d{5}$/', $fromNim) || !preg_match('/^1134\d{5}$/', $toNim)) {
            $this->error('Format NIM tidak valid. Harus 9 digit numerik berawalan 1134.');
            return self::FAILURE;
        }

        if ((int) $fromNim > (int) $toNim) {
            $this->error("--from ({$fromNim}) harus lebih kecil atau sama dengan --to ({$toNim}).");
            return self::FAILURE;
        }

        $this->info($isDry ? '🔍 DRY RUN — tidak ada perubahan yang disimpan.' : '🔧 Reset NIM...');

        // Cari semua teacher yang NIM-nya dalam range ini (aktif, tidak deleted)
        $teachers = Teacher::withoutGlobalScope(\App\Models\Scopes\TenantScope::class)
            ->whereRaw("nomor_induk_maarif ~ '^[0-9]+$'")
            ->whereRaw("CAST(nomor_induk_maarif AS BIGINT) BETWEEN ? AND ?", [(int) $fromNim, (int) $toNim])
            ->whereNull('deleted_at')
            ->get(['id', 'nama', 'nomor_induk_maarif', 'school_id']);

        if ($teachers->isEmpty()) {
            $this->info("✅ Tidak ada teacher dengan NIM di range {$fromNim}–{$toNim}.");
            return self::SUCCESS;
        }

        $this->info("Ditemukan {$teachers->count()} teacher dengan NIM di range {$fromNim}–{$toNim}:");
        $this->table(
            ['ID', 'Nama', 'NIM', 'School ID'],
            $teachers->map(fn($t) => [$t->id, $t->nama, $t->nomor_induk_maarif, $t->school_id])->toArray()
        );

        if ($isDry) {
            $this->warn('DRY RUN — jalankan tanpa --dry-run untuk benar-benar mereset.');
            return self::SUCCESS;
        }

        if (!$force && !$this->confirm("Reset {$teachers->count()} NIM di atas ke NULL? Tindakan ini tidak bisa dibatalkan.", false)) {
            $this->info('Dibatalkan.');
            return self::SUCCESS;
        }

        $ids = $teachers->pluck('id')->toArray();

        DB::table('teachers')
            ->whereIn('id', $ids)
            ->update([
                'nomor_induk_maarif' => null,
                'updated_at'         => now(),
            ]);

        $this->info("✅ Berhasil mereset {$teachers->count()} NIM ke NULL.");
        $this->line('   NIM yang direset: ' . $teachers->pluck('nomor_induk_maarif')->implode(', '));

        return self::SUCCESS;
    }
}
