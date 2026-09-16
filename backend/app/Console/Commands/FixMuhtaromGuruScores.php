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

class FixMuhtaromGuruScores extends Command
{
    protected $signature = 'competition:fix-guru-muhtarom
                            {--jury=Muhtarom : Nama juri yang dievaluasi (default: Muhtarom)}
                            {--competition=guru_berprestasi : Tipe atau nama lomba (default: guru_berprestasi)}
                            {--keep-jenjang=MI : Jenjang yang diperbolehkan / dipertahankan (default: MI)}
                            {--dry-run : Tampilkan daftar nilai yang akan dihapus tanpa mengubah database}
                            {--force : Lewati konfirmasi dan langsung eksekusi penghapusan}';

    protected $description = 'Hapus nilai juri Muhtarom pada lomba Guru Berprestasi khusus jenjang NON-MI (MTs, MA, dll) dan hitung ulang peringkat.';

    public function handle(): int
    {
        $juryPattern = trim((string) $this->option('jury'));
        $compPattern = trim((string) $this->option('competition'));
        $keepJenjang = trim((string) $this->option('keep-jenjang'));
        $isDryRun    = (bool) $this->option('dry-run');
        $isForce     = (bool) $this->option('force');

        $this->info("==================================================================");
        $this->info("   PEMBERSIHAN NILAI JURI '{$juryPattern}' (NON-{$keepJenjang})");
        $this->info("   LOMBA: GURU BERPRESTASI");
        $this->info("==================================================================");
        if ($isDryRun) {
            $this->warn("⚠️  MODE DRY-RUN AKTIF: Tidak ada data yang akan dihapus atau diubah di database.");
        }

        // 1. Cari cabang lomba Guru Berprestasi
        $competitions = Competition::where('lomba_type', 'guru_berprestasi')
            ->orWhere('name', 'like', '%Guru Berprestasi%')
            ->orWhere('lomba_type', $compPattern)
            ->orWhere('name', 'like', "%{$compPattern}%")
            ->get();

        if ($competitions->isEmpty()) {
            $this->error("Cabang lomba '{$compPattern}' tidak ditemukan di database.");
            return 1;
        }

        foreach ($competitions as $competition) {
            $this->processCompetition($competition, $juryPattern, $keepJenjang, $isDryRun, $isForce);
        }

        $this->info("==================================================================");
        $this->info("✓ Selesai!");
        $this->info("==================================================================");

        return 0;
    }

    private function processCompetition(
        Competition $competition,
        string $juryPattern,
        string $keepJenjang,
        bool $isDryRun,
        bool $isForce
    ): void {
        $this->line("");
        $this->info("Memproses Lomba: [ID: {$competition->id}] {$competition->name} ({$competition->lomba_type})");

        // Cari seluruh nilai juri yang cocok dengan nama juryPattern (case-insensitive)
        $juryScores = CompetitionJuryScore::where('competition_id', $competition->id)
            ->whereRaw('LOWER(jury_name) LIKE ?', ['%' . strtolower($juryPattern) . '%'])
            ->with(['anugerahRegistration', 'participant'])
            ->get();

        if ($juryScores->isEmpty()) {
            $this->warn("  -> Tidak ditemukan riwayat penilaian dari juri '{$juryPattern}' pada lomba ini.");
            return;
        }

        $scoresToKeep = collect();
        $scoresToDelete = collect();

        foreach ($juryScores as $score) {
            if ($score->anugerah_registration_id) {
                $reg = $score->anugerahRegistration;
                $name = $reg?->applicant_name ?? 'Tanpa Nama';
                $school = $reg?->school_name ?? '-';
                $jenjang = $reg?->jenjang ?? '-';
                $isKeep = $this->isTargetJenjang($jenjang, $school, $keepJenjang);

                $item = [
                    'score_id'  => $score->id,
                    'type'      => 'anugerah',
                    'ref_id'    => $score->anugerah_registration_id,
                    'name'      => $name,
                    'school'    => $school,
                    'jenjang'   => $jenjang,
                    'jury_name' => $score->jury_name,
                    'score'     => (float) $score->score,
                    'model'     => $score,
                ];

                if ($isKeep) {
                    $scoresToKeep->push($item);
                } else {
                    $scoresToDelete->push($item);
                }
            } elseif ($score->participant_id) {
                $p = $score->participant;
                $name = $p?->name ?? 'Tanpa Nama';
                $school = $p?->institution ?? '-';
                $jenjang = $p?->jenjang ?? '-';
                $isKeep = $this->isTargetJenjang($jenjang, $school, $keepJenjang);

                $item = [
                    'score_id'  => $score->id,
                    'type'      => 'participant',
                    'ref_id'    => $score->participant_id,
                    'name'      => $name,
                    'school'    => $school,
                    'jenjang'   => $jenjang,
                    'jury_name' => $score->jury_name,
                    'score'     => (float) $score->score,
                    'model'     => $score,
                ];

                if ($isKeep) {
                    $scoresToKeep->push($item);
                } else {
                    $scoresToDelete->push($item);
                }
            }
        }

        $this->info("  Total penilaian oleh '{$juryPattern}': " . $juryScores->count());
        $this->info("  - Penilaian Jenjang {$keepJenjang} (DIPERTAHANKAN): " . $scoresToKeep->count());
        $this->warn("  - Penilaian Jenjang NON-{$keepJenjang} (AKAN DIHAPUS): " . $scoresToDelete->count());

        // Tampilkan tabel nilai yang dipertahankan
        if ($scoresToKeep->isNotEmpty()) {
            $this->line("\n  [✓] NILAI YANG DIPERTAHANKAN (Jenjang {$keepJenjang}):");
            $this->table(
                ['ID Nilai', 'Ref ID', 'Nama Peserta', 'Sekolah', 'Jenjang', 'Juri', 'Nilai'],
                $scoresToKeep->map(fn ($s) => [
                    $s['score_id'], $s['ref_id'], $s['name'], $s['school'], $s['jenjang'], $s['jury_name'], $s['score']
                ])->toArray()
            );
        }

        // Tampilkan tabel nilai yang akan dihapus
        if ($scoresToDelete->isNotEmpty()) {
            $this->line("\n  [❌] NILAI YANG AKAN DIHAPUS (Bukan Jenjang {$keepJenjang}):");
            $this->table(
                ['ID Nilai', 'Ref ID', 'Nama Peserta', 'Sekolah', 'Jenjang', 'Juri', 'Nilai'],
                $scoresToDelete->map(fn ($s) => [
                    $s['score_id'], $s['ref_id'], $s['name'], $s['school'], $s['jenjang'], $s['jury_name'], $s['score']
                ])->toArray()
            );
        } else {
            $this->info("  -> Tidak ada nilai non-{$keepJenjang} yang ditemukan. Data sudah bersih!");
            return;
        }

        if ($isDryRun) {
            $this->warn("\n  [DRY-RUN] Simulasi selesai. Gunakan tanpa opsi --dry-run untuk mengeksekusi.");
            return;
        }

        if (!$isForce && !$this->confirm("Apakah Anda yakin ingin menghapus {$scoresToDelete->count()} nilai non-{$keepJenjang} di atas?", true)) {
            $this->warn("  Operasi dibatalkan.");
            return;
        }

        // Eksekusi penghapusan dan hitung ulang
        DB::transaction(function () use ($competition, $scoresToDelete) {
            $affectedRegIds = [];
            $affectedPartIds = [];

            foreach ($scoresToDelete as $item) {
                $scoreModel = $item['model'];
                if ($item['type'] === 'anugerah') {
                    $affectedRegIds[] = $item['ref_id'];
                } else {
                    $affectedPartIds[] = $item['ref_id'];
                }
                $scoreModel->delete();
            }

            $affectedRegIds = array_unique($affectedRegIds);
            $affectedPartIds = array_unique($affectedPartIds);

            // 1. Hitung ulang pendaftar Anugerah
            foreach ($affectedRegIds as $regId) {
                $reg = AnugerahRegistration::where('id', $regId)->with('juryScores')->first();
                if (!$reg) continue;

                if ($reg->juryScores && $reg->juryScores->isNotEmpty()) {
                    $avgScore = round((float) $reg->juryScores->avg('score'), 2);
                    $aggregatedBreakdown = CompetitionRankingService::aggregateBreakdowns($reg->juryScores, $reg->score_breakdown);

                    $reg->update([
                        'total_score'     => $avgScore,
                        'score_breakdown' => $aggregatedBreakdown,
                    ]);
                    $this->line("  -> Ref #{$reg->id} ({$reg->applicant_name}, {$reg->jenjang}): Nilai disesuaikan menjadi {$avgScore} dari {$reg->juryScores->count()} juri tersisa.");
                } else {
                    $reg->update([
                        'total_score'     => null,
                        'score_breakdown' => null,
                        'rank'            => null,
                    ]);
                    $this->line("  -> Ref #{$reg->id} ({$reg->applicant_name}, {$reg->jenjang}): Tidak ada juri lain tersisa, nilai direset ke kosong.");
                }
            }

            // 2. Hitung ulang peserta Festival (jika ada)
            foreach ($affectedPartIds as $pId) {
                $p = CompetitionParticipant::where('id', $pId)->with(['juryScores', 'result'])->first();
                if (!$p) continue;

                if ($p->juryScores && $p->juryScores->isNotEmpty()) {
                    $avgScore = round((float) $p->juryScores->avg('score'), 2);
                    $aggregatedBreakdown = CompetitionRankingService::aggregateBreakdowns($p->juryScores, $p->result?->score_breakdown);

                    CompetitionResult::updateOrCreate(
                        ['competition_id' => $competition->id, 'participant_id' => $p->id],
                        [
                            'score'           => $avgScore,
                            'score_breakdown' => $aggregatedBreakdown,
                        ]
                    );
                    $this->line("  -> Peserta #{$p->id} ({$p->name}): Nilai disesuaikan menjadi {$avgScore} dari {$p->juryScores->count()} juri tersisa.");
                } else {
                    if ($p->result) {
                        $p->result->update([
                            'score'           => null,
                            'score_breakdown' => null,
                            'rank'            => null,
                        ]);
                    }
                    $this->line("  -> Peserta #{$p->id} ({$p->name}): Tidak ada juri lain tersisa, nilai direset ke kosong.");
                }
            }

            // 3. Auto-rank ulang seluruh jenjang
            CompetitionRankingService::autoRank($competition);
            $this->info("\n  ✓ Peringkat kejuaraan (autoRank) telah dihitung ulang secara otomatis.");
        });

        // Tampilkan rekap peringkat terbaru per jenjang
        $this->displayCurrentStandings($competition);
    }

    /**
     * Cek apakah jenjang (atau sekolah) merupakan jenjang target (misal MI/SD).
     */
    protected function isTargetJenjang(?string $jenjang, ?string $schoolName, string $target = 'MI'): bool
    {
        $j = strtoupper(trim((string) $jenjang));
        $targetUpper = strtoupper(trim($target));

        if (!empty($j)) {
            // Jika target adalah MI / SD
            if ($targetUpper === 'MI' || $targetUpper === 'SD' || $targetUpper === 'MI/SD') {
                // Jangan anggap MI jika secara eksplisit jenjangnya adalah MTs, SMP, MA, SMA, SMK
                if (str_contains($j, 'MTS') || str_contains($j, 'SMP') || str_contains($j, 'SMA') || str_contains($j, 'SMK') || str_contains($j, 'MA/')) {
                    if (!str_contains($j, 'MI') && !str_contains($j, 'SD')) {
                        return false;
                    }
                }
                if (str_contains($j, 'MI') || str_contains($j, 'SD')) {
                    return true;
                }
            } else {
                if (str_contains($j, $targetUpper)) {
                    return true;
                }
            }
        }

        // Fallback cek nama sekolah/madrasah
        if (!empty($schoolName)) {
            $s = strtoupper(trim($schoolName));
            if ($targetUpper === 'MI' || $targetUpper === 'SD' || $targetUpper === 'MI/SD') {
                if (str_starts_with($s, 'MI ') || str_starts_with($s, 'SD ') || str_contains($s, 'MADRASAH IBTIDAIYAH')) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Tampilkan klasemen terkini per jenjang untuk konfirmasi visual admin.
     */
    protected function displayCurrentStandings(Competition $competition): void
    {
        $this->line("\n  [🏆] KLASEMEN PERINGKAT TERKINI:");

        $registrations = AnugerahRegistration::where('competition_id', $competition->id)
            ->whereNotNull('total_score')
            ->where('total_score', '>', 0)
            ->get()
            ->groupBy(fn ($r) => $r->jenjang ?: 'Umum');

        if ($registrations->isEmpty()) {
            $this->line("  (Belum ada peserta yang memiliki nilai)");
            return;
        }

        foreach ($registrations as $jenjangGroup => $group) {
            $this->line("\n  Jenjang: <comment>{$jenjangGroup}</comment>");
            $sorted = $group->sortByDesc(fn ($r) => (float) $r->total_score);

            $this->table(
                ['Rank', 'Nama Peserta', 'Sekolah', 'Nilai Akhir'],
                $sorted->map(fn ($r) => [
                    $r->rank ? "Juara {$r->rank}" : '-',
                    $r->applicant_name,
                    $r->school_name,
                    number_format((float) $r->total_score, 2),
                ])->toArray()
            );
        }
    }
}
