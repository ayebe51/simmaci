<?php

namespace App\Console\Commands;

use App\Models\AnugerahRegistration;
use App\Models\Competition;
use App\Models\CompetitionJuryScore;
use Illuminate\Console\Command;

class CheckMadrasahScores extends Command
{
    protected $signature = 'competition:check-madrasah
                            {--jenjang=MI : Jenjang yang difilter (MI, MTs, MA, atau all)}
                            {--details : Tampilkan rincian breakdown nilai per komponen juri}';

    protected $description = 'Audit dan periksa hasil input nilai lomba Madrasah Berprestasi serta deteksi potensi kekeliruan.';

    public function handle(): int
    {
        $targetJenjang = strtoupper(trim((string) $this->option('jenjang')));
        $showDetails   = (bool) $this->option('details');

        $this->info("================================================================================");
        $this->info("       AUDIT & PEMERIKSAAN NILAI LOMBA MADRASAH BERPRESTASI");
        $this->info("================================================================================");

        $competition = Competition::where('lomba_type', 'madrasah_berprestasi')
            ->orWhere('name', 'like', '%Madrasah Berprestasi%')
            ->first();

        if (!$competition) {
            $this->error("Cabang lomba Madrasah Berprestasi tidak ditemukan.");
            return 1;
        }

        $this->info("Cabang Lomba: [ID: {$competition->id}] {$competition->name}");

        // Ambil semua pendaftar Madrasah Berprestasi
        $query = AnugerahRegistration::where('competition_id', $competition->id)
            ->with(['juryScores', 'school']);

        if ($targetJenjang !== 'ALL') {
            $query->where(function ($q) use ($targetJenjang) {
                $q->whereRaw('UPPER(jenjang) LIKE ?', ["%{$targetJenjang}%"])
                  ->orWhereRaw('UPPER(school_name) LIKE ?', ["{$targetJenjang} %"])
                  ->orWhereRaw('UPPER(school_name) LIKE ?', ["% {$targetJenjang} %"]);
            });
        }

        $registrations = $query->orderBy('jenjang')->get();

        if ($registrations->isEmpty()) {
            $this->warn("Tidak ada data pendaftar untuk kriteria jenjang: {$targetJenjang}");
            return 0;
        }

        // Kelompokkan per jenjang
        $grouped = $registrations->groupBy(fn ($r) => $this->normalizeJenjangGroup($r->jenjang, $r->school_name));

        $allJuriesOverall = CompetitionJuryScore::where('competition_id', $competition->id)
            ->pluck('jury_name')
            ->unique()
            ->values();

        $this->line("\nTotal Pendaftar Ditemukan: " . $registrations->count());
        $this->line("Daftar Dewan Juri Terdaftar: " . ($allJuriesOverall->implode(', ') ?: 'Belum ada juri'));

        $anomaliesFound = [];

        foreach ($grouped as $jenjangName => $regs) {
            $this->line("\n────────────────────────────────────────────────────────────────────────────────");
            $this->info("📂 JENJANG: {$jenjangName} (" . $regs->count() . " Madrasah)");
            $this->line("────────────────────────────────────────────────────────────────────────────────");

            // Sort berdasarkan rank atau total_score desc
            $sorted = $regs->sortBy(function ($r) {
                if ($r->rank !== null && $r->rank > 0) {
                    return $r->rank;
                }
                return 9999 - ($r->total_score ? (float) $r->total_score : 0);
            });

            $rows = [];
            foreach ($sorted as $idx => $r) {
                $scores = $r->juryScores;
                $jCount = $scores->count();

                $juryDetails = [];
                $juryScoresList = [];
                $hasRawPointsAnomaly = false;
                $hasZeroComponent = false;

                foreach ($scores as $s) {
                    $juryDetails[] = "{$s->jury_name}: " . number_format((float) $s->score, 2);
                    $juryScoresList[] = (float) $s->score;

                    // Cek indikasi input skor mentah (nilai <= 45 padahal skala total 100)
                    if ((float) $s->score <= 45.0 && (float) $s->score > 0) {
                        $hasRawPointsAnomaly = true;
                    }

                    // Cek apakah ada komponen 0 dalam breakdown
                    if (is_array($s->score_breakdown)) {
                        foreach ($s->score_breakdown as $item) {
                            if (isset($item['value']) && (float) $item['value'] == 0) {
                                $hasZeroComponent = true;
                            }
                        }
                    }
                }

                $calculatedAvg = $jCount > 0 ? round(array_sum($juryScoresList) / $jCount, 2) : null;
                $dbTotal = $r->total_score !== null ? (float) $r->total_score : null;

                // Cek mismatch antara calculatedAvg dan dbTotal
                $mismatch = false;
                if ($calculatedAvg !== null && $dbTotal !== null && abs($calculatedAvg - $dbTotal) > 0.05) {
                    $mismatch = true;
                }

                $statusNotes = [];
                if ($jCount === 0) {
                    $statusNotes[] = "❌ Belum dinilai";
                }
                if ($hasRawPointsAnomaly) {
                    $statusNotes[] = "⚠️ Nilai <= 45 (Skor Mentah?)";
                    $anomaliesFound[] = "[{$jenjangName}] {$r->school_name}: Nilai juri sangat rendah (<= 45), kemungkinan juri memasukkan poin bobot langsung bukan skala 0-100.";
                }
                if ($hasZeroComponent) {
                    $statusNotes[] = "ℹ️ Ada komponen bernilai 0";
                }
                if ($mismatch) {
                    $statusNotes[] = "⚠️ Mismatch Rata-rata (Hitung: {$calculatedAvg} vs DB: {$dbTotal})";
                    $anomaliesFound[] = "[{$jenjangName}] {$r->school_name}: Rata-rata hitung ({$calculatedAvg}) berbeda dengan total_score di DB ({$dbTotal}).";
                }

                $rankStr = $r->rank ? "Juara {$r->rank}" : '-';

                $rows[] = [
                    'Rank'         => $rankStr,
                    'ID'           => $r->id,
                    'Madrasah'     => $r->school_name,
                    'Kecamatan'    => $r->kecamatan ?: '-',
                    'Juri'         => $jCount . ' Juri',
                    'Nilai Juri'   => implode("\n", $juryDetails) ?: '-',
                    'Nilai Akhir'  => $dbTotal !== null ? number_format($dbTotal, 2) : '-',
                    'Catatan'      => implode("; ", $statusNotes) ?: '✓ Normal',
                ];
            }

            $this->table(
                ['Rank', 'ID', 'Madrasah', 'Kecamatan', 'Jml Juri', 'Nilai Juri', 'Nilai Akhir', 'Status / Catatan'],
                $rows
            );

            // Jika opsi --details aktif, tampilkan breakdown per komponen
            if ($showDetails) {
                $this->line("\n  [🔍] Rincian Komponen Breakdown:");
                foreach ($sorted as $r) {
                    if ($r->juryScores->isEmpty()) continue;
                    $this->line("  ▶ #{$r->id} {$r->school_name} (Nilai Akhir: {$r->total_score}):");
                    foreach ($r->juryScores as $js) {
                        $this->line("    • Juri: <comment>{$js->jury_name}</comment> (Total: {$js->score})");
                        if (is_array($js->score_breakdown)) {
                            foreach ($js->score_breakdown as $b) {
                                $cName = $b['component'] ?? '-';
                                $cWeight = $b['weight'] ?? '-';
                                $cVal = $b['value'] ?? '-';
                                $this->line("      - {$cName} (Bobot: {$cWeight}%): Nilai = <info>{$cVal}</info>");
                            }
                        } else {
                            $this->line("      - (Tidak ada rincian breakdown)");
                        }
                    }
                }
            }
        }

        // Evaluasi Juri yang Menilai
        $this->line("\n────────────────────────────────────────────────────────────────────────────────");
        $this->info("👥 ANALISIS SEBARAN JURI PER JENJANG");
        $this->line("────────────────────────────────────────────────────────────────────────────────");

        $juriesByJenjang = [];
        foreach ($registrations as $r) {
            $jGroup = $this->normalizeJenjangGroup($r->jenjang, $r->school_name);
            foreach ($r->juryScores as $js) {
                $juriesByJenjang[$jGroup][$js->jury_name] = ($juriesByJenjang[$jGroup][$js->jury_name] ?? 0) + 1;
            }
        }

        foreach ($juriesByJenjang as $jGroup => $juryCounts) {
            $this->line("Jenjang <comment>{$jGroup}</comment>:");
            foreach ($juryCounts as $jName => $count) {
                $this->line("  • {$jName} : menilai {$count} madrasah");
            }
        }

        // Cek ketimpangan jumlah juri pada jenjang yang sama
        foreach ($grouped as $jenjangName => $regs) {
            $counts = $regs->map(fn ($r) => $r->juryScores->count())->unique()->values();
            if ($counts->count() > 1) {
                $anomaliesFound[] = "[{$jenjangName}] Ketimpangan Penilaian: Beberapa madrasah dinilai oleh {$counts->implode(', ')} juri berbeda.";
            }
        }

        // Ringkasan Temuan / Anomali
        $this->line("\n────────────────────────────────────────────────────────────────────────────────");
        $this->info("📋 KESIMPULAN TEMUAN / AUDIT");
        $this->line("────────────────────────────────────────────────────────────────────────────────");

        if (empty($anomaliesFound)) {
            $this->info("✓ Tidak ditemukan indikasi kesalahan format atau mismatch nilai.");
            $this->info("  Semua nilai dan rata-rata dewan juri telah terhitung secara konsisten.");
        } else {
            $this->warn("Ditemukan " . count($anomaliesFound) . " catatan/potensi kejanggalan:");
            foreach ($anomaliesFound as $anomaly) {
                $this->line("  $anomaly");
            }
        }

        return 0;
    }

    private function normalizeJenjangGroup(?string $jenjang, ?string $schoolName): string
    {
        $j = strtoupper(trim((string) $jenjang));

        if (str_contains($j, 'MI') || str_contains($j, 'SD')) {
            return 'MI/SD';
        }
        if (str_contains($j, 'MTS') || str_contains($j, 'SMP')) {
            return 'MTs/SMP';
        }
        if (str_contains($j, 'MA') || str_contains($j, 'SMA') || str_contains($j, 'SMK')) {
            return 'MA/SMA/SMK';
        }

        if (!empty($schoolName)) {
            $s = strtoupper(trim($schoolName));
            if (str_starts_with($s, 'MI ') || str_starts_with($s, 'SD ')) {
                return 'MI/SD';
            }
            if (str_starts_with($s, 'MTS ') || str_starts_with($s, 'SMP ')) {
                return 'MTs/SMP';
            }
            if (str_starts_with($s, 'MA ') || str_starts_with($s, 'SMA ') || str_starts_with($s, 'SMK ')) {
                return 'MA/SMA/SMK';
            }
        }

        return $jenjang ?: 'Umum';
    }
}
