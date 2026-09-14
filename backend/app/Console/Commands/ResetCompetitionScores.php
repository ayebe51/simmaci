<?php

namespace App\Console\Commands;

use App\Models\AnugerahRegistration;
use App\Models\Competition;
use App\Models\CompetitionJuryScore;
use App\Models\CompetitionResult;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ResetCompetitionScores extends Command
{
    protected $signature = 'competition:reset-scores {competition_id : ID dari Cabang Lomba} {--force : Lewati konfirmasi}';
    protected $description = 'Reset seluruh nilai juri, catatan, dan peringkat untuk sebuah cabang lomba.';

    public function handle(): int
    {
        $id = $this->argument('competition_id');
        $competition = Competition::find($id);

        if (!$competition) {
            $this->error("Cabang lomba dengan ID {$id} tidak ditemukan.");
            return 1;
        }

        $this->info("Target Lomba: [{$competition->id}] {$competition->name} ({$competition->lomba_type})");

        $scoresCount = CompetitionJuryScore::where('competition_id', $competition->id)->count();
        $this->warn("Ditemukan {$scoresCount} data nilai dewan juri.");

        if (!$this->option('force') && !$this->confirm("Apakah Anda yakin ingin mereset SEMUA nilai untuk lomba '{$competition->name}'?")) {
            $this->info("Operasi dibatalkan.");
            return 0;
        }

        DB::transaction(function () use ($competition) {
            CompetitionJuryScore::where('competition_id', $competition->id)->delete();

            if (in_array($competition->lomba_type, ['guru_berprestasi', 'madrasah_berprestasi'], true)) {
                $affected = AnugerahRegistration::where('competition_id', $competition->id)->update([
                    'total_score'     => null,
                    'rank'            => null,
                    'reviewer_notes'  => null,
                    'score_breakdown' => null,
                    'status'          => 'submitted',
                ]);
                $this->info("{$affected} pendaftar Anugerah berhasil direset ke nilai awal.");
            } else {
                $deleted = CompetitionResult::where('competition_id', $competition->id)->delete();
                $this->info("{$deleted} hasil lomba berhasil dihapus.");
            }
        });

        $this->info("✓ Berhasil! Semua nilai untuk '{$competition->name}' telah direset bersih.");
        return 0;
    }
}
