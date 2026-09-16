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

        $isAnugerah = in_array($competition->lomba_type, ['guru_berprestasi', 'madrasah_berprestasi'], true);

        // Step 1: Universal normalization if requested (works for ANY competition with criteria)
        if ($shouldNormalize) {
            $this->normalizeCompetitionJuryScores($competition);
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

    private function normalizeCompetitionJuryScores(Competition $competition): void
    {
        $criteria = $competition->scoring_criteria ?? [];
        if (empty($criteria)) {
            $criteria = $this->getDefaultCriteria($competition->lomba_type);
        }

        if (empty($criteria)) {
            return;
        }

        $scores = CompetitionJuryScore::where('competition_id', $competition->id)->get();
        $normalizedCount = 0;

        foreach ($scores as $js) {
            $bd = $js->score_breakdown;
            if (!is_array($bd) || empty($bd)) {
                continue;
            }

            $normResult = CompetitionRankingService::detectAndNormalizeBreakdown($bd, (float) $js->score, $criteria);
            if ($normResult !== null) {
                $oldScore = $js->score;
                $js->update([
                    'score'           => $normResult['real_score'],
                    'score_breakdown' => $normResult['normalized_breakdown'],
                ]);

                $targetLabel = $js->participant_id ? "Peserta ID: {$js->participant_id}" : "Pendaftar ID: {$js->anugerah_registration_id}";
                $this->warn("  [NORMALISASI] Juri '{$js->jury_name}' ({$targetLabel}): {$oldScore} -> {$normResult['real_score']}");
                $normalizedCount++;
            }
        }

        if ($normalizedCount > 0) {
            $this->info("  -> Berhasil menormalisasi {$normalizedCount} entri nilai juri di cabang [{$competition->name}].");
        }
    }

    private function getDefaultCriteria(string $lombaType): array
    {
        $map = [
            'mars_maarif'     => [
                ['component' => 'Teknik Vokal', 'weight' => 35],
                ['component' => 'Harmonisasi & Keselarasan', 'weight' => 35],
                ['component' => 'Penjiwaan & Ekspresi', 'weight' => 30],
            ],
            'mtq'             => [
                ['component' => 'Tajwid', 'weight' => 45],
                ['component' => 'Lagu & Irama', 'weight' => 35],
                ['component' => 'Adab & Penampilan', 'weight' => 20],
            ],
            'mtq_pa'          => [
                ['component' => 'Tajwid', 'weight' => 45],
                ['component' => 'Lagu & Irama', 'weight' => 35],
                ['component' => 'Adab & Penampilan', 'weight' => 20],
            ],
            'mtq_pi'          => [
                ['component' => 'Tajwid', 'weight' => 45],
                ['component' => 'Lagu & Irama', 'weight' => 35],
                ['component' => 'Adab & Penampilan', 'weight' => 20],
            ],
            'puji_pujian'     => [
                ['component' => 'Makhraj & Artikulasi Bahasa Jawa', 'weight' => 35],
                ['component' => 'Penjiwaan & Penghayatan', 'weight' => 30],
                ['component' => 'Harmonisasi Suara & Irama', 'weight' => 25],
                ['component' => 'Adab & Penampilan', 'weight' => 10],
            ],
            'film_dokumenter' => [
                ['component' => 'Kesesuaian Tema & Kedalaman Konten', 'weight' => 35],
                ['component' => 'Alur Cerita & Struktur Narasi', 'weight' => 25],
                ['component' => 'Sinematografi & Editing', 'weight' => 25],
                ['component' => 'Kreativitas & Estetika', 'weight' => 15],
            ],
            'guru_berprestasi' => [
                ['component' => 'Akumulasi Skor Kejuaraan / Prestasi', 'weight' => 40],
                ['component' => 'Naskah Praktik Baik / Karya Inovasi Pembelajaran', 'weight' => 30],
                ['component' => 'Pemahaman & Pengamalan Nilai Aswaja An-Nahdliyah', 'weight' => 15],
                ['component' => 'Presentasi, Wawancara, & Deep Interview', 'weight' => 15],
            ],
            'madrasah_berprestasi' => [
                ['component' => 'Akumulasi Skor Kejuaraan Lembaga', 'weight' => 45],
                ['component' => 'Tata Kelola Institusi & Penguatan Karakter Aswaja', 'weight' => 25],
                ['component' => 'Kemitraan, Keaktifan SIMNU & SIMMACI, Kontribusi Sosial', 'weight' => 15],
                ['component' => 'Presentasi Kepala Madrasah & Visitasi / Fact Checking', 'weight' => 15],
            ],
        ];

        return $map[$lombaType] ?? [];
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
