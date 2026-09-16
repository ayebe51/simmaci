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
                            {--competition=all : Tipe lomba (guru_berprestasi, madrasah_berprestasi, atau all)}
                            {--repair : Sinkronkan dan perbaiki otomatis nilai berkas Fase 1 jika ada yang rumpang/kosong}';

    protected $description = 'Diagnosa status nilai seleksi berkas Fase 1 pada finalis Fase 2 Lomba Guru & Madrasah Berprestasi (dan perbaiki jika diminta).';

    public function handle(): int
    {
        $compKeyword = strtolower(trim((string) $this->option('competition')));
        $shouldRepair = (bool) $this->option('repair');

        $this->info("==================================================================");
        $this->info("   DIAGNOSA NILAI FASE 1 & FASE 2 ANUGERAH MA'ARIF");
        $this->info("   (GURU BERPRESTASI & MADRASAH BERPRESTASI)");
        $this->info("==================================================================");
        $this->line("");

        // Tentukan kompetisi yang akan diproses
        $query = Competition::query();

        if ($compKeyword === 'guru' || $compKeyword === 'guru_berprestasi') {
            $query->where('lomba_type', 'guru_berprestasi')->orWhere('name', 'like', '%Guru Berprestasi%');
        } elseif ($compKeyword === 'madrasah' || $compKeyword === 'madrasah_berprestasi') {
            $query->where('lomba_type', 'madrasah_berprestasi')->orWhere('name', 'like', '%Madrasah Berprestasi%');
        } elseif ($compKeyword !== 'all' && !empty($compKeyword)) {
            $query->where('lomba_type', $compKeyword)->orWhere('name', 'like', "%{$compKeyword}%");
        } else {
            // all
            $query->whereIn('lomba_type', ['guru_berprestasi', 'madrasah_berprestasi'])
                ->orWhere('name', 'like', '%Guru Berprestasi%')
                ->orWhere('name', 'like', '%Madrasah Berprestasi%');
        }

        $competitions = $query->get();

        if ($competitions->isEmpty()) {
            $this->error("Cabang lomba dengan keyword '{$compKeyword}' tidak ditemukan di database.");
            return 1;
        }

        foreach ($competitions as $competition) {
            $this->diagnoseCompetition($competition, $shouldRepair);
            $this->line("");
        }

        return 0;
    }

    private function diagnoseCompetition(Competition $competition, bool $shouldRepair): void
    {
        $lombaType = $competition->lomba_type;
        $maxP1 = ($lombaType === 'guru_berprestasi') ? 70.0 : 85.0;
        $maxP2 = ($lombaType === 'guru_berprestasi') ? 30.0 : 15.0;

        $this->info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        $this->info("Lomba: [ID: {$competition->id}] {$competition->name} ({$lombaType})");
        $this->line("Bobot: Fase 1 (Berkas) = {$maxP1}%, Fase 2 (Wawancara/Visitasi) = {$maxP2}%");
        $this->line("Status Lomba: {$competition->status}");
        $this->info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

        // 1. Ambil semua finalis (dan pemenang jika ada)
        $finalists = AnugerahRegistration::where('competition_id', $competition->id)
            ->whereIn('status', ['finalis', 'winner'])
            ->with('juryScores')
            ->orderBy('jenjang')
            ->orderBy('school_name')
            ->orderBy('applicant_name')
            ->get();

        if ($finalists->isEmpty()) {
            $this->warn("  Belum ada peserta berstatus 'finalis' pada cabang lomba ini.");
            $allRegs = AnugerahRegistration::where('competition_id', $competition->id)->count();
            $this->line("  Total pendaftar terdaftar: {$allRegs}");
            return;
        }

        $this->info("  Ditemukan {$finalists->count()} finalis yang dipromosikan ke Fase 2.");
        $this->line("");

        $grouped = $finalists->groupBy(fn ($r) => $r->jenjang ?: 'Umum');
        $issuesFound = 0;

        foreach ($grouped as $jenjang => $items) {
            $this->line("  [Jenjang: {$jenjang} ({$items->count()} Finalis)]");

            $tableRows = [];

            foreach ($items as $r) {
                $scores = $r->juryScores;
                $jCount = $scores->count();

                // Hitung Fase 1 dari masing-masing juri
                $juryDetails = [];
                $phase1Sum = 0.0;
                $validP1Count = 0;

                foreach ($scores as $s) {
                    $p1Val = $this->calculateP1FromBreakdown($lombaType, $s->score_breakdown);
                    if ($p1Val > 0) {
                        $phase1Sum += $p1Val;
                        $validP1Count++;
                    }
                    $juryDetails[] = "{$s->jury_name}: {$s->score} (P1: {$p1Val})";
                }

                $avgPhase1FromJuries = $validP1Count > 0 ? round($phase1Sum / $validP1Count, 2) : 0.0;

                // Hitung dari score_breakdown milik pendaftaran
                $p1FromReg = $this->calculateP1FromBreakdown($lombaType, $r->score_breakdown);

                // Resolusi nilai Fase 1
                $effectiveP1 = $avgPhase1FromJuries > 0 ? $avgPhase1FromJuries : $p1FromReg;
                if ($effectiveP1 <= 0 && (float) $r->total_score > 0 && (float) $r->total_score <= $maxP1) {
                    $effectiveP1 = (float) $r->total_score;
                }

                $isIssue = ($effectiveP1 <= 0);
                if ($isIssue) {
                    $issuesFound++;
                }

                $statusStr = $isIssue ? "<error>⚠️ 0.00 (KOSONG)</error>" : "<info>✓ {$effectiveP1} / {$maxP1}</info>";
                $displayName = $lombaType === 'madrasah_berprestasi' 
                    ? ($r->school_name . ($r->applicant_name ? " (Kamad: {$r->applicant_name})" : ''))
                    : ($r->applicant_name . " ({$r->school_name})");

                $tableRows[] = [
                    $r->id,
                    $displayName,
                    $r->status,
                    number_format((float) ($r->total_score ?? 0), 2),
                    $statusStr,
                    $jCount > 0 ? implode('; ', $juryDetails) : '(Belum ada juri)',
                ];
            }

            $this->table(
                ['ID', 'Peserta / Lembaga', 'Status', 'DB Total', "Skor Fase 1", 'Catatan Penilaian Juri'],
                $tableRows
            );
            $this->line("");
        }

        // Kesimpulan diagnosa untuk lomba ini
        if ($issuesFound === 0) {
            $this->info("  ✓ SEMUA FINALIS MEMILIKI NILAI FASE 1 YANG VALID DI DATABASE.");
            $this->line("  Catatan: Nilai resmi Fase 1 sekarang akan otomatis tampil di portal juri Fase 2.");
        } else {
            $this->warn("  ⚠️ Ditemukan {$issuesFound} finalis yang nilai seleksi berkas Fase 1-nya masih 0.00 di database.");

            if ($shouldRepair) {
                $this->line("");
                $this->info("  Menjalankan perbaikan (--repair) untuk {$competition->name}...");
                $this->repairMissingPhase1($competition, $finalists);
            } else {
                $this->line("");
                $this->comment("  Gunakan opsi --repair untuk menyinkronkan nilai:");
                $this->comment("  php artisan competition:diagnose-guru --competition={$lombaType} --repair");
            }
        }
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
            } elseif ($lombaType === 'madrasah_berprestasi') {
                if (str_contains($name, 'presentasi') || str_contains($name, 'visitasi') || str_contains($name, 'fact checking')) {
                    $isP1 = false;
                } else {
                    $isP1 = ($index < 3);
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
        $lombaType = $competition->lomba_type;
        $maxP1 = ($lombaType === 'guru_berprestasi') ? 70.0 : 85.0;

        DB::transaction(function () use ($competition, $finalists, $lombaType, $maxP1) {
            $repaired = 0;
            foreach ($finalists as $r) {
                $p1 = $this->calculateP1FromBreakdown($lombaType, $r->score_breakdown);
                if ($p1 <= 0 && (float) $r->total_score > 0 && (float) $r->total_score <= $maxP1) {
                    $p1 = (float) $r->total_score;
                }

                // Jika pendaftaran memiliki nilai total di fase 1 tapi breakdown-nya kosong
                if ($p1 > 0 && empty($r->score_breakdown)) {
                    $ratio = $p1 / $maxP1;
                    $val = round($ratio * 100.0, 2);
                    if ($lombaType === 'guru_berprestasi') {
                        $newBd = [
                            ['component' => 'Akumulasi Skor Kejuaraan / Prestasi', 'weight' => 40, 'value' => $val],
                            ['component' => 'Naskah Praktik Baik / Karya Inovasi Pembelajaran', 'weight' => 30, 'value' => $val],
                        ];
                    } else {
                        $newBd = [
                            ['component' => 'Akumulasi Skor Kejuaraan Lembaga', 'weight' => 45, 'value' => $val],
                            ['component' => 'Tata Kelola Institusi & Penguatan Karakter Aswaja', 'weight' => 25, 'value' => $val],
                            ['component' => 'Kemitraan, Keaktifan SIMNU & SIMMACI, Kontribusi Sosial', 'weight' => 15, 'value' => $val],
                        ];
                    }
                    $r->update(['score_breakdown' => $newBd]);
                    $name = $r->applicant_name ?: $r->school_name;
                    $this->info("    -> Ref #{$r->id} ({$name}): Breakdown Fase 1 diperbarui dari nilai total ({$p1} / {$maxP1}).");
                    $repaired++;
                }
            }

            CompetitionRankingService::autoRank($competition);
            $this->info("  ✓ Selesai perbaikan: {$repaired} data disinkronkan.");
        });
    }
}
