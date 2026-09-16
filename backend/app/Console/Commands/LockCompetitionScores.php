<?php

namespace App\Console\Commands;

use App\Models\Competition;
use Illuminate\Console\Command;

class LockCompetitionScores extends Command
{
    protected $signature = 'competition:lock-scores
                            {competition_id? : ID Cabang Lomba tertentu (opsional)}
                            {--all : Kunci seluruh cabang lomba secara global}
                            {--freeze-submitted : Bekukan nilai yang sudah diinput agar tidak bisa diedit, tapi juri masih bisa menilai peserta yang belum dinilai}
                            {--unlock : Buka kembali kunci penilaian}';

    protected $description = 'Kunci nilai lomba agar dewan juri dan operator tidak dapat lagi menambah atau merubah nilai.';

    public function handle(): int
    {
        $id       = $this->argument('competition_id');
        $isAll    = (bool) $this->option('all');
        $isUnlock = (bool) $this->option('unlock');
        $isFreeze = (bool) $this->option('freeze-submitted');

        $this->info("================================================================================");
        $this->info($isUnlock 
            ? "       BUKA KUNCI NILAI CABANG LOMBA SIMMACI" 
            : ($isFreeze 
                ? "       BEKUKAN NILAI YANG SUDAH DIINPUT (PESERTA SISA TETAP BISA DINILAI)" 
                : "       KUNCI NILAI CABANG LOMBA SIMMACI (FINALISASI HASIL)"));
        $this->info("================================================================================");

        if ($isUnlock) {
            if ($id) {
                $comp = Competition::findOrFail($id);
                $comp->unlockScores();
                $comp->unfreezeSubmittedScores();
                $this->info("✓ Kunci nilai cabang lomba [{$comp->id}] {$comp->name} berhasil DIBUKA.");
            } else {
                Competition::unlockAllScores();
                $this->info("✓ Kunci nilai SELURUH cabang lomba berhasil DIBUKA secara global.");
            }
            $this->showStatusTable();
            return 0;
        }

        if ($isFreeze) {
            if ($id) {
                $comp = Competition::findOrFail($id);
                $comp->freezeSubmittedScores();
                $this->info("✓ Mode BEKUKAN NILAI TERISI aktif untuk cabang [{$comp->id}] {$comp->name}.");
            } else {
                Competition::freezeAllSubmittedScores();
                $this->info("✓ Mode BEKUKAN NILAI TERISI aktif untuk SELURUH cabang lomba.");
            }
            $this->info("\n✓ Aturan Aktif:");
            $this->line("  1. Nilai peserta yang SUDAH disimpan oleh juri dikunci permanen (tidak bisa diedit).");
            $this->line("  2. Juri yang BELUM selesai tetap bisa menginput nilai untuk peserta yang tersisa.");
            $this->showStatusTable();
            return 0;
        }

        // Lock mode (Total Lock)
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
            $c->isScoresLocked() 
                ? '🔒 KUNCI TOTAL' 
                : ($c->isFreezeSubmittedScores() ? '❄️ KUNCI NILAI TERISI' : '🔓 TERBUKA'),
        ])->toArray();

        $this->table(
            ['ID', 'Nama Cabang Lomba', 'Tipe', 'Status DB', 'Status Kunci'],
            $rows
        );
    }
}
