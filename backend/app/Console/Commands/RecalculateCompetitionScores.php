<?php

namespace App\Console\Commands;

use App\Models\AnugerahRegistration;
use App\Models\Competition;
use App\Models\CompetitionJuryScore;
use App\Models\CompetitionParticipant;
use App\Models\CompetitionResult;
use App\Services\CompetitionRankingService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class RecalculateCompetitionScores extends Command
{
    protected $signature = 'competition:recalculate-scores 
                            {competition_id? : ID Cabang Lomba (opsional, kosongkan untuk memproses semua)} 
                            {--normalize : Otomatis normalisasi nilai juri MTQ yang memasukkan skor bobot langsung (Tajwid <= 45, Lagu <= 35, Adab <= 20)}
                            {--force : Lewati konfirmasi}';

    protected $description = 'Hitung ulang seluruh nilai akumulasi rata-rata juri dan peringkat kejuaraan di database.';

    public function handle(): int
    {
        $id = $this->argument('competition_id');
        $shouldNormalize = $this->option('normalize');

        $query = Competition::query();
        if ($id) {
            $query->where('id', $id);
        }

        $competitions = $query->get();

        if ($competitions->isEmpty()) {
            $this->error($id ? "Cabang lomba dengan ID {$id} tidak ditemukan." : "Tidak ada cabang lomba yang ditemukan.");
            return 1;
        }

        $this->info("Ditemukan {$competitions->count()} cabang lomba untuk diproses.");

        foreach ($competitions as $comp) {
            $this->processCompetition($comp, $shouldNormalize);
        }

        $this->info("✓ Selesai! Semua nilai akumulasi rata-rata juri dan peringkat kejuaraan telah diperbarui.");
        return 0;
    }

    private function processCompetition(Competition $competition, bool $shouldNormalize): void
    {
        $this->line("──────────────────────────────────────────────────");
        $this->info("Memproses Lomba: [{$competition->id}] {$competition->name} ({$competition->lomba_type})");

        $isMtq = in_array($competition->lomba_type, ['mtq', 'mtq_pa', 'mtq_pi'], true) 
            || str_contains(strtolower($competition->name), 'mtq');

        $isAnugerah = in_array($competition->lomba_type, ['guru_berprestasi', 'madrasah_berprestasi'], true);

        // Step 1: Normalization if requested (or auto-detect MTQ input anomaly)
        if ($isMtq && $shouldNormalize) {
            $this->normalizeMtqJuryScores($competition);
        }

        // Step 2: Recalculate aggregates and ranks
        DB::transaction(function () use ($competition, $isAnugerah) {
            if ($isAnugerah) {
                $registrations = AnugerahRegistration::where('competition_id', $competition->id)
                    ->with('juryScores')
                    ->get();

                $updatedCount = 0;
                foreach ($registrations as $reg) {
                    if ($reg->juryScores && $reg->juryScores->isNotEmpty()) {
                        $avgScore = round((float) $reg->juryScores->avg('score'), 2);
                        $aggregatedBreakdown = $this->aggregateBreakdowns($reg->juryScores, $reg->score_breakdown);

                        $reg->update([
                            'total_score'     => $avgScore,
                            'score_breakdown' => $aggregatedBreakdown,
                        ]);
                        $updatedCount++;
                    }
                }
                $this->info("  -> {$updatedCount} pendaftar Anugerah disinkronkan dari rata-rata dewan juri.");
            } else {
                $participants = CompetitionParticipant::where('competition_id', $competition->id)
                    ->with(['juryScores', 'result'])
                    ->get();

                $updatedCount = 0;
                foreach ($participants as $p) {
                    if ($p->juryScores && $p->juryScores->isNotEmpty()) {
                        $avgScore = round((float) $p->juryScores->avg('score'), 2);
                        $aggregatedBreakdown = $this->aggregateBreakdowns($p->juryScores, $p->result?->score_breakdown);

                        CompetitionResult::updateOrCreate(
                            ['competition_id' => $competition->id, 'participant_id' => $p->id],
                            [
                                'score'           => $avgScore,
                                'score_breakdown' => $aggregatedBreakdown,
                            ]
                        );
                        $updatedCount++;
                    }
                }
                $this->info("  -> {$updatedCount} peserta Festival disinkronkan dari rata-rata dewan juri.");
            }

            // Step 3: Re-rank
            CompetitionRankingService::autoRank($competition);
            $this->info("  -> Peringkat otomatis (autoRank) telah dihitung ulang.");
        });
    }

    private function normalizeMtqJuryScores(Competition $competition): void
    {
        $scores = CompetitionJuryScore::where('competition_id', $competition->id)->get();
        $normalizedCount = 0;

        foreach ($scores as $js) {
            $bd = $js->score_breakdown;
            if (!is_array($bd) || empty($bd)) {
                continue;
            }

            // Extract values
            $tajwid = null;
            $lagu = null;
            $adab = null;

            foreach ($bd as $item) {
                $name = strtolower($item['component'] ?? '');
                $val = isset($item['value']) ? (float) $item['value'] : null;

                if (str_contains($name, 'tajwid')) {
                    $tajwid = $val;
                } elseif (str_contains($name, 'lagu') || str_contains($name, 'irama')) {
                    $lagu = $val;
                } elseif (str_contains($name, 'adab') || str_contains($name, 'penampilan')) {
                    $adab = $val;
                }
            }

            // Detection: Tajwid <= 45, Lagu <= 35, Adab <= 20, and sum >= 40, and calculated score < 45
            if ($tajwid !== null && $lagu !== null && $adab !== null) {
                $rawSum = $tajwid + $lagu + $adab;
                if ($tajwid <= 45 && $lagu <= 35 && $adab <= 20 && $rawSum >= 40 && (float) $js->score < 45) {
                    // Normalize to 0-100 scale for each component
                    $normTajwid = round(($tajwid / 45.0) * 100.0, 2);
                    $normLagu   = round(($lagu / 35.0) * 100.0, 2);
                    $normAdab   = round(($adab / 20.0) * 100.0, 2);
                    $realTotal  = round($rawSum, 2);

                    $updatedBd = array_map(function ($item) use ($normTajwid, $normLagu, $normAdab) {
                        $name = strtolower($item['component'] ?? '');
                        if (str_contains($name, 'tajwid')) {
                            $item['value'] = $normTajwid;
                        } elseif (str_contains($name, 'lagu') || str_contains($name, 'irama')) {
                            $item['value'] = $normLagu;
                        } elseif (str_contains($name, 'adab') || str_contains($name, 'penampilan')) {
                            $item['value'] = $normAdab;
                        }
                        return $item;
                    }, $bd);

                    $js->update([
                        'score'           => $realTotal,
                        'score_breakdown' => $updatedBd,
                    ]);

                    $this->warn("  [NORMALISASI] Juri '{$js->jury_name}' (Peserta ID: {$js->participant_id}): {$js->getOriginal('score')} -> {$realTotal} (Tajwid: {$tajwid}->{$normTajwid}, Lagu: {$lagu}->{$normLagu}, Adab: {$adab}->{$normAdab})");
                    $normalizedCount++;
                }
            }
        }

        if ($normalizedCount > 0) {
            $this->info("  -> Berhasil menormalisasi {$normalizedCount} entri nilai juri MTQ.");
        }
    }

    private function aggregateBreakdowns($juryScores, ?array $fallback = null): ?array
    {
        $componentSums = [];
        $componentCounts = [];
        $componentWeights = [];

        foreach ($juryScores as $js) {
            $bd = $js->score_breakdown;
            if (is_array($bd)) {
                foreach ($bd as $item) {
                    if (isset($item['component'])) {
                        $c = $item['component'];
                        $componentSums[$c] = ($componentSums[$c] ?? 0) + (float) ($item['value'] ?? 0);
                        $componentCounts[$c] = ($componentCounts[$c] ?? 0) + 1;
                        $componentWeights[$c] = (float) ($item['weight'] ?? 0);
                    }
                }
            }
        }

        if (empty($componentSums)) {
            return $fallback;
        }

        $aggregated = [];
        foreach ($componentSums as $c => $sum) {
            $count = $componentCounts[$c] ?: 1;
            $aggregated[] = [
                'component' => $c,
                'weight'    => $componentWeights[$c],
                'value'     => round($sum / $count, 2),
            ];
        }

        return $aggregated;
    }
}
