#!/bin/bash
# =============================================================================
# check-sk-gap.sh
# Cek gap nomor SK — bekerja tanpa deploy ulang.
# Script ini meng-copy file PHP command ke dalam container yang sedang berjalan,
# menjalankannya, lalu membersihkan cache artisan.
#
# Usage:
#   ./check-sk-gap.sh                                         # cek tahun ini
#   ./check-sk-gap.sh --year=2026                             # cek tahun tertentu
#   ./check-sk-gap.sh --all-years                             # cek semua tahun
#   ./check-sk-gap.sh --with-trashed                          # sertakan soft-deleted
#   ./check-sk-gap.sh --show-duplicates                       # detail duplikat
#   ./check-sk-gap.sh --year=2026 --with-trashed --show-duplicates
# =============================================================================

set -e

# ── Auto-detect nama container backend ───────────────────────────────────────
CONTAINER=$(docker ps --format '{{.Names}}' | grep -E 'backend' | head -1)

if [ -z "$CONTAINER" ]; then
    echo ""
    echo "❌  Tidak ada container backend yang berjalan."
    echo "    Pastikan stack sudah up. Container yang aktif:"
    docker ps --format '  {{.Names}}  ({{.Status}})'
    exit 1
fi

echo ""
echo "📦  Menggunakan container: ${CONTAINER}"

# ── Tulis file PHP command langsung ke container ──────────────────────────────
DEST="/var/www/html/app/Console/Commands/CheckSkNomorGap.php"

docker exec "${CONTAINER}" bash -c "cat > ${DEST}" << 'PHPEOF'
<?php

namespace App\Console\Commands;

use App\Models\SkDocument;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;

/**
 * Artisan command: sk:check-gap
 *
 * Cek gap nomor SK format NNNN/PC.L/.../TAHUN yang kosong.
 * Bisa sertakan soft-deleted dengan --with-trashed.
 */
class CheckSkNomorGap extends Command
{
    protected $signature = 'sk:check-gap
                            {--year=          : Tahun yang dicek (default: tahun ini)}
                            {--all-years      : Cek semua tahun yang ada di database}
                            {--with-trashed   : Sertakan SK yang sudah dihapus (soft-deleted)}
                            {--show-duplicates: Tampilkan detail SK duplikat}';

    protected $description = 'Cek gap nomor SK (NNNN/PC.L/...) dan tampilkan nomor urut yang kosong';

    public function handle(): int
    {
        $withTrashed    = (bool) $this->option('with-trashed');
        $showDuplicates = (bool) $this->option('show-duplicates');
        $allYears       = (bool) $this->option('all-years');
        $yearOpt        = $this->option('year');

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

    private function getAvailableYears(bool $withTrashed): Collection
    {
        $query = $withTrashed
            ? SkDocument::withoutTenantScope()->withTrashed()
            : SkDocument::withoutTenantScope();

        return $query
            ->whereRaw("nomor_sk ~ '^[0-9]'")
            ->pluck('nomor_sk')
            ->map(fn($n) => $this->extractYearFromNomor($n))
            ->filter()
            ->unique()
            ->sort()
            ->values();
    }

    private function analyzeYear(int $year, bool $withTrashed, bool $showDuplicates): void
    {
        $label = $withTrashed ? ' (termasuk soft-deleted)' : '';

        $this->line("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        $this->info("📋  Analisis nomor SK tahun <fg=cyan>{$year}</>{$label}");
        $this->line("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

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

        $validDocs   = $allDocs->filter(fn($d) => $this->extractSeqNum($d->nomor_sk) !== null);
        $invalidDocs = $allDocs->filter(fn($d) => $this->extractSeqNum($d->nomor_sk) === null);

        $sequences = $validDocs
            ->map(fn($d) => $this->extractSeqNum($d->nomor_sk))
            ->sort()
            ->values();

        $minSeq = $sequences->first();
        $maxSeq = $sequences->last();
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
                $nomorStr   = str_pad($seq, 4, '0', STR_PAD_LEFT);
                $wasDeleted = array_key_exists($seq, $deletedNomors) ? '🗑 ada di trash' : '';
                $rows[]     = [$i + 1, $nomorStr, $wasDeleted];
            }

            $showRows = array_slice($rows, 0, 200);
            $this->table(['#', 'Nomor Urut Kosong', 'Keterangan'], $showRows);

            if (count($gaps) > 200) {
                $this->line("  ... dan " . (count($gaps) - 200) . " gap lainnya.");
            }

            $this->line('');
            $this->line("  Nomor berikutnya yang akan di-generate sistem: <fg=green>"
                . str_pad($maxSeq + 1, 4, '0', STR_PAD_LEFT) . "</>");
            $this->line("  (Sistem pakai MAX+1 — gap tidak otomatis terisi kembali)");
        }

        if ($invalidDocs->isNotEmpty()) {
            $this->line('');
            $this->warn("⚠️  Nomor SK format tidak valid ({$invalidDocs->count()} record):");
            foreach ($invalidDocs as $doc) {
                $this->line("  ID {$doc->id}: <fg=red>{$doc->nomor_sk}</> | {$doc->nama}");
            }
        }
    }

    private function extractYearFromNomor(string $nomor): ?string
    {
        $parts = explode('/', $nomor);
        $last  = end($parts);
        if (preg_match('/^(20\d{2})$/', trim($last), $m)) {
            return $m[1];
        }
        return null;
    }

    private function extractSeqNum(string $nomor): ?int
    {
        if (preg_match('/^(\d{1,4})\//', $nomor, $m)) {
            return (int) $m[1];
        }
        return null;
    }
}
PHPEOF

echo "✅  File command berhasil di-copy ke container."

# ── Clear cache artisan agar command terdaftar ────────────────────────────────
echo "🔄  Membersihkan cache artisan..."
docker exec "${CONTAINER}" php artisan clear-compiled 2>/dev/null || true

# ── Jalankan command ──────────────────────────────────────────────────────────
echo "🚀  Menjalankan sk:check-gap ..."
echo ""

docker exec -it "${CONTAINER}" php artisan sk:check-gap "$@"

# ── Cleanup: hapus file setelah selesai (opsional, comment jika ingin simpan) ─
# docker exec "${CONTAINER}" rm -f "${DEST}"
# echo "🧹  File sementara dihapus."
