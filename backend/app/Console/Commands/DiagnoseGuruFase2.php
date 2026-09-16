<?php

namespace App\Console\Commands;

use App\Models\AnugerahRegistration;
use App\Models\Competition;
use App\Models\CompetitionJuryScore;
use App\Services\CompetitionRankingService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class DiagnoseGuruFase2 extends Command
{
    protected $signature = 'competition:diagnose-guru
                            {--competition=guru_berprestasi : Tipe lomba atau keyword nama lomba}
                            {--repair : Sinkronkan dan perbaiki otomatis nilai berkas Fase 1 jika ada yang rumpang/kosong}';

    protected $description = 'Diagnosa status nilai seleksi berkas Fase 1 pada finalis Fase 2 Lomba Guru Berprestasi (dan perbaiki jika diminta).';

    public function handle(): int
    {
        $compKeyword = (string) $this->option('competition');
        $shouldRepair = (bool) $this->option('repair');

        $this->info("==================================================================");
        $this->info("   DIAGNOSA NILAI FASE 1 & FASE 2 LOMBA GURU BERPRESTASI");
        $this->info("==================================================================");
        $this->line("");

        $competition = Competition::where('lomba_type', 'guru_berprestasi')
            ->orWhere('name', 'like', '%Guru Berprestasi%')
            ->orWhere('lomba_type', $compKeyword)
            ->first();

        if (!$competition) {
            $this->error("Cabang lomba '{$compKeyword}' tidak ditemukan.");
            return 1;
        }

        $this->info("Lomba: [ID: {$competition->id}] {$competition->name} ({$competition->lomba_type})");
        $this->line("Status Lomba: {$competition->status}");
        $this->line("");

        // 1. Ambil semua finalis (dan pemenang jika ada)
        $finalists = AnugerahRegistration::where('competition_id', $competition->id)
            ->whereIn('status', ['finalis', 'winner'])
            ->with('juryScores')
            ->orderBy('jenjang')
            ->orderBy('applicant_name')
            ->get();

        if ($finalists->isEmpty()) {
            $this->warn("Belum ada peserta berstatus 'finalis' pada lomba ini.");
            // Coba tampilkan seluruh pendaftar
            $allRegs = AnugerahRegistration::where('competition_id', $competition->id)->count();
            $this->line("Total pendaftar terdaftar: {$allRegs}");
            return 0;
        }

        $this->info("Ditemukan {$finalists->count()} finalis yang dipromosikan ke Fase 2.");
        $this->line("");

        $grouped = $finalists->groupBy(fn ($r) => $r->jenjang ?: 'Umum');
        $issuesFound = 0;

        foreach ($grouped as $jenjang => $items) {
            $this->info("──────────────────────────────────────────────────────────────────");
            $this->info("   JENJANG: {$jenjang} ({$items->count()} Finalis)");
            $this->info("──────────────────────────────────────────────────────────────────");

            $tableRows = [];

            foreach ($items as $r) {
                $scores = $r->juryScores;
                $jCount = $scores->count();

                // Hitung Fase 1 dari masing-masing juri
                $juryDetails = [];
                $phase1Sum = 0.0;
                $validP1Count = 0;

                foreach ($scores as $s) {
                    $p1Val = $this->calculateP1FromBreakdown($competition->lomba_type, $s->score_breakdown);
                    if ($p1Val > 0) {
                        $phase1Sum += $p1Val;
                        $validP1Count++;
                    }
                    $juryDetails[] = "{$s->jury_name}: {$s->score} (P1: {$p1Val})";
                }

                $avgPhase1FromJuries = $validP1Count > 0 ? round($phase1Sum / $validP1Count, 2) : 0.0;

                // Hitung dari score_breakdown milik pendaftaran
                $p1FromReg = $this->calculateP1FromBreakdown($competition->lomba_type, $r->score_breakdown);

                // Resolusi nilai Fase 1
                $effectiveP1 = $avgPhase1FromJuries > 0 ? $avgPhase1FromJuries : $p1FromReg;
                if ($effectiveP1 <= 0 && (float) $r->total_score > 0 && (float) $r->total_score <= 70) {
                    $effectiveP1 = (float) $r->total_score;
                }

                $isIssue = ($effectiveP1 <= 0);
                if ($isIssue) {
                    $issuesFound++;
                }

                $statusStr = $isIssue ? "<error>⚠️ 0.00 (KOSONG)</error>" : "<info>✓ {$effectiveP1} / 70</info>";

                $tableRows[] = [
                    $r->id,
                    $r->applicant_name,
                    $r->school_name,
                    $r->status,
                    (float) ($r->total_score ?? 0),
                    $statusStr,
                    $jCount > 0 ? implode('; ', $juryDetails) : '(Belum ada juri)',
                ];
            }

            $this->table(
                ['ID', 'Nama Peserta', 'Madrasah', 'Status', 'DB Total', 'Skor Fase 1', 'Catatan Penilaian Juri'],
                $tableRows
            );
            $this->line("");
        }

        // Kesimpulan diagnosa
        $this->info("==================================================================");
        $this->info("   KESIMPULAN DIAGNOSA");
        $this->info("==================================================================");

        if ($issuesFound === 0) {
            $this->info("✓ SEMUA FINALIS MEMILIKI NILAI FASE 1 YANG VALID DI DATABASE.");
            $this->line("Catatan: Jika sebelumnya di portal juri muncul 0.00 untuk MTs/MA,");
            $this->line("hal itu disebabkan bug tampilan controller lama (hanya membaca juri yang login).");
            $this->line("Dengan pembaruan kode ini, portal juri sekarang langsung menampilkan nilai berkas resmi.");
        } else {
            $this->warn("⚠️ Ditemukan {$issuesFound} finalis yang nilai seleksi berkas Fase 1-nya masih 0.00 di database.");
            $this->line("Hal ini dapat terjadi jika saat promosi finalis, peserta dipromosikan sebelum dinilai,");
            $this->line("atau juri yang ditugaskan belum selesai menginput nilai berkas peserta tersebut.");

            if ($shouldRepair) {
                $this->line("");
                $this->info("Menjalankan perbaikan (--repair)...");
                $this->repairMissingPhase1($competition, $finalists);
            } else {
                $this->line("");
                $this->comment("Gunakan opsi --repair untuk mencoba memulihkan/menyesuaikan nilai jika data historis tersedia:");
                $this->comment("php artisan competition:diagnose-guru --repair");
            }
        }

        return 0;
    }

    private function calculateP1FromBreakdown(string $lombaType, ?array $breakdown): float
    {
        if (empty($breakdown) || !is_array($breakdown)) {
            return 0.0;
        }

        $p1Sum = 0.0;
        foreach ($breakdown as $index => $item) {
            $weight = (float) ($item['weight'] ?? 0);
            $val = (float) ($item['value'] ?? 0);
            $name = strtolower($item['component'] ?? '');

            $isP1 = true;
            if ($lombaType === 'guru_berprestasi') {
                if (str_contains($name, 'aswaja') || str_contains($name, 'wawancara') || str_contains($name, 'interview')) {
                    $isP1 = false;
                } else {
                    $isP1 = ($index < 2);
                }
            }

            if ($isP1) {
                $p1Sum += ($val * $weight) / 100.0;
            }
        }

        return round($p1Sum, 2);
    }

    private function repairMissingPhase1(Competition $competition, $finalists): void
    {
        DB::transaction(function () use ($competition, $finalists) {
            $repaired = 0;
            foreach ($finalists as $r) {
                $p1 = $this->calculateP1FromBreakdown($competition->lomba_type, $r->score_breakdown);
                if ($p1 <= 0 && (float) $r->total_score > 0 && (float) $r->total_score <= 70) {
                    $p1 = (float) $r->total_score;
                }

                // Jika pendaftaran memiliki nilai total di fase 1 tapi breakdown-nya kosong
                if ($p1 > 0 && empty($r->score_breakdown)) {
                    // Buat breakdown standar (40% dan 30%)
                    $ratio = $p1 / 70.0;
                    $val = round($ratio * 100.0, 2);
                    $newBd = [
                        ['component' => 'Akumulasi Skor Kejuaraan / Prestasi', 'weight' => 40, 'value' => $val],
                        ['component' => 'Naskah Praktik Baik / Karya Inovasi Pembelajaran', 'weight' => 30, 'value' => $val],
                    ];
                    $r->update(['score_breakdown' => $newBd]);
                    $this->info("  -> Ref #{$r->id} ({$r->applicant_name}): Breakdown Fase 1 diperbarui dari nilai total ({$p1}).");
                    $repaired++;
                }
            }

            CompetitionRankingService::autoRank($competition);
            $this->info("✓ Selesai perbaikan: {$repaired} data disinkronkan.");
        });
    }
}
