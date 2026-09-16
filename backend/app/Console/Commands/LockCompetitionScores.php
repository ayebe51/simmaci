<?php

namespace App\Console\Commands;

use App\Models\Competition;
use Illuminate\Console\Command;

class LockCompetitionScores extends Command
{
    protected $signature = 'competition:lock-scores
                            {competition_id? : ID Cabang Lomba tertentu (opsional)}
                            {--all : Kunci seluruh cabang lomba secara global}
                            {--unlock : Buka kembali kunci penilaian}';

    protected $description = 'Kunci nilai lomba agar dewan juri dan operator tidak dapat lagi menambah atau merubah nilai.';

    public function handle(): int
    {
        $id       = $this->argument('competition_id');
        $isAll    = (bool) $this->option('all');
        $isUnlock = (bool) $this->option('unlock');

        $this->info("================================================================================");
        $this->info($isUnlock 
            ? "       BUKA KUNCI NILAI CABANG LOMBA SIMMACI" 
            : "       KUNCI NILAI CABANG LOMBA SIMMACI (FINALISASI HASIL)");
        $this->info("================================================================================");

        if ($isUnlock) {
            if ($id) {
                $comp = Competition::findOrFail($id);
                $comp->unlockScores();
                $this->info("✓ Kunci nilai cabang lomba [{$comp->id}] {$comp->name} berhasil DIBUKA.");
            } else {
                Competition::unlockAllScores();
                $this->info("✓ Kunci nilai SELURUH cabang lomba berhasil DIBUKA secara global.");
            }
            $this->showStatusTable();
            return 0;
        }

        // Lock mode
        if ($id) {
            $comp = Competition::findOrFail($id);
            $comp->lockScores();
            $this->info("✓ Nilai cabang lomba [{$comp->id}] {$comp->name} berhasil DIKUNCI PERMANEN.");
        } else {
            // Default: Lock all competitions
            Competition::lockAllScores();
            $this->info("✓ Nilai SELURUH cabang lomba berhasil DIKUNCI PERMANEN secara global.");
        }

        $this->showStatusTable();

        $this->info("\n✓ Selesai! Penilaian telah dikunci (Read-Only).");
        $this->line("  Dewan juri maupun operator tidak dapat lagi menginput atau mengedit nilai.");

        return 0;
    }

    private function showStatusTable(): void
    {
        $competitions = Competition::orderBy('id')->get();
        if ($competitions->isEmpty()) {
            $this->warn("Tidak ada data cabang lomba.");
            return;
        }

        $this->line("\n[🔒] STATUS PENILAIAN CABANG LOMBA:");
        $rows = $competitions->map(fn ($c) => [
            $c->id,
            $c->name,
            $c->lomba_type ?: '-',
            $c->status,
            $c->isScoresLocked() ? '🔒 TERKUNCI' : '🔓 TERBUKA',
        ])->toArray();

        $this->table(
            ['ID', 'Nama Cabang Lomba', 'Tipe', 'Status DB', 'Status Kunci'],
            $rows
        );
    }
}
