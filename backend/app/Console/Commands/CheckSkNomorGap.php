<?php

namespace App\Console\Commands;

use App\Models\SkDocument;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;

/**
 * Artisan command: sk:check-gap
 *
 * Cek gap (nomor kosong) dalam urutan nomor SK format:
 *   - NNNN/PC.L/A.II/.../{TAHUN}   ← SK resmi yang sudah diterbitkan
 *   - REQ/{year}/NNNN               ← Nomor internal sementara (pending/draft)
 *
 * SK yang ter-soft-delete ikut dihitung agar gap terlihat akurat.
 *
 * Usage examples:
 *   php artisan sk:check-gap
 *   php artisan sk:check-gap --year=2026
 *   php artisan sk:check-gap --all-years
 *   php artisan sk:check-gap --with-trashed
 *   php artisan sk:check-gap --year=2026 --with-trashed
 */
class CheckSkNomorGap extends Command
{
    protected $signature = 'sk:check-gap
                            {--year=          : Tahun yang dicek (default: tahun ini). Digunakan untuk filter /{TAHUN} pada nomor resmi.}
                            {--all-years      : Cek semua tahun yang ada di database}
                            {--with-trashed   : Sertakan SK yang sudah dihapus (soft-deleted)}
                            {--show-duplicates: Tampilkan detail SK duplikat (nomor sama > 1 record)}';

    protected $description = 'Cek gap nomor SK (NNNN/PC.L/...) dan tampilkan nomor urut mana saja yang kosong';

    public function handle(): int
    {
        $withTrashed     = (bool) $this->option('with-trashed');
        $showDuplicates  = (bool) $this->option('show-duplicates');
        $allYears        = (bool) $this->option('all-years');
        $yearOpt         = $this->option('year');

        if ($allYears) {
            $years = $this->getAvailableYears($withTrashed);
            if ($years->isEmpty()) {
                $this->warn('Tidak ada nomor SK resmi (format NNNN/...) ditemukan di database.');
                return self::SUCCESS;
            }
        } else {
            $years = collect([$yearOpt ?: now()->year]);
        }

        foreach ($years as $y) {
            $this->analyzeYear((int) $y, $withTrashed, $showDuplicates);
            if ($years->count() > 1) $this->line('');
        }

        return self::SUCCESS;
    }

    // ──────────────────────────────────────────────────────────────────────

    /**
     * Ambil semua tahun yang muncul sebagai suffix pada nomor SK resmi
     * (format: NNNN/.../YYYY di segmen terakhir).
     */
    private function getAvailableYears(bool $withTrashed): Collection
    {
        $query = $withTrashed
            ? SkDocument::withoutTenantScope()->withTrashed()
            : SkDocument::withoutTenantScope();

        return $query
            ->whereRaw("nomor_sk ~ '^[0-9]'") // hanya nomor resmi (mulai digit)
            ->pluck('nomor_sk')
            ->map(fn($n) => $this->extractYearFromNomor($n))
            ->filter()
            ->unique()
            ->sort()
            ->values();
    }

    /**
     * Analisis gap nomor SK untuk satu tahun tertentu.
     */
    private function analyzeYear(int $year, bool $withTrashed, bool $showDuplicates): void
    {
        $label = $withTrashed ? ' (termasuk soft-deleted)' : '';

        $this->line("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        $this->info("📋  Analisis nomor SK tahun <fg=cyan>{$year}</>{$label}");
        $this->line("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

        // Ambil semua SK tahun ini — nomor resmi mulai digit, suffix /{year}
        $baseQuery = $withTrashed
            ? SkDocument::withoutTenantScope()->withTrashed()
            : SkDocument::withoutTenantScope();

        $allDocs = $baseQuery
            ->whereRaw("nomor_sk ~ '^[0-9]'")
            ->get(['id', 'nomor_sk', 'status', 'nama', 'jenis_sk', 'unit_kerja', 'deleted_at', 'school_id'])
            ->filter(fn($d) => $this->extractYearFromNomor($d->nomor_sk) == $year);

        if ($allDocs->isEmpty()) {
            $this->warn("Tidak ada nomor SK resmi untuk tahun {$year}.");
            return;
        }

        // Pisahkan format valid (NNNN/...) vs tidak valid
        $validDocs   = $allDocs->filter(fn($d) => $this->extractSeqNum($d->nomor_sk) !== null);
        $invalidDocs = $allDocs->filter(fn($d) => $this->extractSeqNum($d->nomor_sk) === null);

        // Kumpulkan sequence numbers
        $sequences = $validDocs
            ->map(fn($d) => $this->extractSeqNum($d->nomor_sk))
            ->sort()
            ->values();

        $minSeq = $sequences->first();
        $maxSeq = $sequences->last();

        // Jumlah duplikat (nomor yang muncul > 1 kali)
        $dupSeqs = $sequences->duplicates()->unique()->values();

        $this->table(
            ['Metrik', 'Nilai'],
            [
                ['Total SK resmi ditemukan',   $allDocs->count()],
                ['Format valid (NNNN/...)',     $validDocs->count()],
                ['Format tidak valid',          $invalidDocs->count()],
                ['Nomor urut terkecil',         str_pad($minSeq, 4, '0', STR_PAD_LEFT)],
                ['Nomor urut terbesar',         str_pad($maxSeq, 4, '0', STR_PAD_LEFT)],
                ['Jumlah nomor duplikat',       $dupSeqs->count()],
            ]
        );

        // ── Tampilkan duplikat ──────────────────────────────────────────
        if ($dupSeqs->isNotEmpty()) {
            $this->warn("⚠️  Nomor SK DUPLIKAT ({$dupSeqs->count()} nomor):");
            if ($showDuplicates) {
                foreach ($dupSeqs as $seq) {
                    $copies = $validDocs->filter(fn($d) => $this->extractSeqNum($d->nomor_sk) === $seq);
                    $this->line("  Urut <fg=red>" . str_pad($seq, 4, '0', STR_PAD_LEFT) . "</> — {$copies->count()} record:");
                    foreach ($copies as $doc) {
                        $deleted = $doc->deleted_at ? ' <fg=red>[SOFT-DELETED]</>' : '';
                        $this->line("    ID {$doc->id} | {$doc->nomor_sk} | {$doc->nama} | {$doc->jenis_sk} | {$doc->status}{$deleted}");
                    }
                }
            } else {
                $seqList = $dupSeqs->map(fn($s) => str_pad($s, 4, '0', STR_PAD_LEFT))->implode(', ');
                $this->line("  Nomor: <fg=yellow>{$seqList}</>");
                $this->line("  Jalankan dengan --show-duplicates untuk detail.");
            }
            $this->line('');
        }

        // ── Cari gap ──────────────────────────────────────────────────────
        $seqSet = $sequences->unique()->flip()->all();
        $gaps   = [];
        for ($seq = 1; $seq <= $maxSeq; $seq++) {
            if (! array_key_exists($seq, $seqSet)) {
                $gaps[] = $seq;
            }
        }

        if (empty($gaps)) {
            $this->info("✅  Tidak ada gap — urutan 0001 s/d " . str_pad($maxSeq, 4, '0', STR_PAD_LEFT) . " lengkap.");
        } else {
            $this->error("❌  Ditemukan " . count($gaps) . " nomor kosong (gap):");
            $this->line('');

            // Cek apakah nomor-nomor gap itu pernah ada sebagai soft-deleted
            $deletedNomors = SkDocument::withoutTenantScope()->withTrashed()
                ->whereNotNull('deleted_at')
                ->whereRaw("nomor_sk ~ '^[0-9]'")
                ->pluck('nomor_sk')
                ->map(fn($n) => $this->extractSeqNum($n))
                ->filter()
                ->flip()
                ->all();

            $rows = [];
            foreach ($gaps as $i => $seq) {
                $nomorStr    = str_pad($seq, 4, '0', STR_PAD_LEFT);
                $wasDeleted  = array_key_exists($seq, $deletedNomors) ? '🗑 ada di trash' : '';
                $rows[]      = [$i + 1, $nomorStr, $wasDeleted];
            }

            // Tampilkan tabel (max 200 baris, sisanya diringkas)
            $showRows = array_slice($rows, 0, 200);
            $this->table(['#', 'Nomor Urut Kosong', 'Keterangan'], $showRows);

            if (count($gaps) > 200) {
                $this->line("  ... dan " . (count($gaps) - 200) . " gap lainnya tidak ditampilkan.");
            }

            $this->line('');
            $this->line("  Nomor berikutnya yang akan di-generate sistem: <fg=green>"
                . str_pad($maxSeq + 1, 4, '0', STR_PAD_LEFT) . "</>");
            $this->line("  (Sistem pakai MAX+1 — gap tidak otomatis terisi kembali)");
        }

        // ── Format tidak valid ──────────────────────────────────────────
        if ($invalidDocs->isNotEmpty()) {
            $this->line('');
            $this->warn("⚠️  Nomor SK format tidak valid ({$invalidDocs->count()} record):");
            foreach ($invalidDocs as $doc) {
                $this->line("  ID {$doc->id}: <fg=red>{$doc->nomor_sk}</> | {$doc->nama}");
            }
        }

        // ── Rekomendasi fix ─────────────────────────────────────────────
        if (! empty($gaps)) {
            $this->line('');
            $this->comment("💡 Untuk mengisi ulang nomor kosong, jalankan: php artisan sk:fill-gap --year={$year}");
            $this->comment("   (command tersebut belum ada — implementasi manual diperlukan jika memang dibutuhkan)");
        }
    }

    // ──────────────────────────────────────────────────────────────────────

    /**
     * Ekstrak tahun dari nomor SK resmi.
     * Format: NNNN/.../YYYY  ← tahun ada di segmen terakhir setelah /
     * Contoh: "0247/PC.L/A.11/H-34.8/24.29/16/7/2026" → 2026
     */
    private function extractYearFromNomor(string $nomor): ?string
    {
        $parts = explode('/', $nomor);
        $last  = end($parts);
        if (preg_match('/^(20\d{2})$/', trim($last), $m)) {
            return $m[1];
        }
        return null;
    }

    /**
     * Ekstrak nomor urut (4 digit di depan) dari nomor SK resmi.
     * Contoh: "0247/PC.L/A.11/H-34.8/24.29/16/7/2026" → 247
     * Return null jika format tidak valid.
     */
    private function extractSeqNum(string $nomor): ?int
    {
        if (preg_match('/^(\d{1,4})\//', $nomor, $m)) {
            return (int) $m[1];
        }
        return null;
    }
}
